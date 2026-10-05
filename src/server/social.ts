// src/server/social.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
import { token, hash } from "./crypto.js";
import { memberPermissions } from "../shared/permissions.js";
import { emit, audit } from "./events.js";
export const socialRouter = Router();
socialRouter.use(
  ["/friends", "/invitations", "/integrations"],
  (req, _res, next) => {
    assert(
      req.actor.kind === "human",
      403,
      "HUMAN_REQUIRED",
      "Compte humain requis.",
    );
    next();
  },
);
socialRouter.get("/friends", async (req, res) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  res.json({
    data: await query(
      `SELECT u.id,u.name,u.avatar,(SELECT count(*)::int FROM friend_messages fm WHERE fm.sender_id=u.id AND fm.recipient_id=$1 AND fm.read_at IS NULL) unread_count,(SELECT content FROM friend_messages fm WHERE (fm.sender_id=u.id AND fm.recipient_id=$1) OR (fm.sender_id=$1 AND fm.recipient_id=u.id) ORDER BY fm.created_at DESC,fm.id DESC LIMIT 1) last_message,(SELECT fm.created_at FROM friend_messages fm WHERE (fm.sender_id=u.id AND fm.recipient_id=$1) OR (fm.sender_id=$1 AND fm.recipient_id=u.id) ORDER BY fm.created_at DESC,fm.id DESC LIMIT 1) last_message_at,CASE WHEN u.status<>'invisible' AND COALESCE((u.preferences->>'presence')::boolean,true) AND EXISTS(SELECT 1 FROM user_sessions s WHERE s.user_id=u.id AND s.expires_at>now() AND s.last_seen_at>now()-interval '2 minutes') THEN u.status ELSE 'offline' END status FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END WHERE (f.user_a=$1 OR f.user_b=$1) AND NOT u.disabled ORDER BY u.name`,
      [req.actor.id],
    ),
  });
});
socialRouter.delete("/friends/:id", async (req, res) => {
  await query(
    "DELETE FROM friendships WHERE (user_a=$1 AND user_b=$2) OR (user_b=$1 AND user_a=$2)",
    [req.actor.id, z.uuid().parse(req.params.id)],
  );
  res.json({ ok: true });
});
socialRouter.get("/invitations", async (req, res) => {
  res.json({
    data: await query(
      "SELECT id,workspace_id,expires_at,accepted_by,revoked,created_at FROM invitations WHERE issuer=$1 ORDER BY created_at DESC LIMIT 100",
      [req.actor.id],
    ),
  });
});
socialRouter.post("/invitations", async (req, res) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const b = z
    .object({ workspace_id: z.uuid(), allow_join: z.boolean().default(false) })
    .parse(req.body);
  await authorize(req.actor, b.workspace_id, "SEND_MESSAGE");
  const raw = token();
  const result = await transaction(async (db) => {
    let role: string | null = null;
    if (b.allow_join) {
      await authorize(req.actor, b.workspace_id, "MANAGE_MEMBERS");
      for (const p of memberPermissions)
        await authorize(req.actor, b.workspace_id, p);
      let [r] = await query(
        "SELECT id,permissions FROM roles WHERE workspace_id=$1 AND name='Member' AND NOT is_owner",
        [b.workspace_id],
        db,
      );
      if (!r)
        [r] = await query(
          "INSERT INTO roles(workspace_id,name,permissions) VALUES($1,'Member',$2) RETURNING id,permissions",
          [b.workspace_id, memberPermissions],
          db,
        );
      for (const p of r.permissions)
        await authorize(req.actor, b.workspace_id, p);
      role = r.id;
    }
    const [r] = await query(
      "INSERT INTO invitations(token_hash,workspace_id,issuer,join_role) VALUES($1,$2,$3,$4) RETURNING id,expires_at",
      [hash(raw), b.workspace_id, req.actor.id, role],
      db,
    );
    await audit(b.workspace_id, req.actor.id, "invitation.created", r.id, db);
    return r;
  });
  res
    .status(201)
    .json({ data: result, url: `${process.env.APP_URL}/#invite=${raw}` });
});
socialRouter.delete("/invitations/:id", async (req, res) => {
  await query("UPDATE invitations SET revoked=true WHERE id=$1 AND issuer=$2", [
    z.uuid().parse(req.params.id),
    req.actor.id,
  ]);
  res.json({ ok: true });
});
socialRouter.get("/invitations/token/:token", async (req, res) => {
  const [i] = await query(
    "SELECT i.id,i.expires_at,i.join_role IS NOT NULL can_join,u.name issuer_name,w.name workspace_name FROM invitations i JOIN users u ON u.id=i.issuer JOIN workspaces w ON w.id=i.workspace_id WHERE token_hash=$1 AND NOT revoked AND accepted_by IS NULL AND expires_at>now()",
    [hash(z.string().min(32).max(100).parse(req.params.token))],
  );
  assert(
    i,
    404,
    "INVITATION_EXPIRED",
    "Cette invitation a expiré, a été utilisée ou révoquée.",
  );
  res.json({ data: i });
});
socialRouter.post("/invitations/token/:token/accept", async (req, res) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const data = await transaction(async (db) => {
    const [i] = await query(
      "SELECT * FROM invitations WHERE token_hash=$1 AND NOT revoked AND accepted_by IS NULL AND expires_at>now() FOR UPDATE",
      [hash(z.string().min(32).max(100).parse(req.params.token))],
      db,
    );
    assert(
      i,
      404,
      "INVITATION_EXPIRED",
      "Invitation expirée ou déjà utilisée.",
    );
    assert(
      i.issuer !== req.actor.id,
      400,
      "OWN_INVITATION",
      "Partagez cette invitation avec votre ami.",
    );
    const [issuer] = await query(
      "SELECT 1 FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.state='active' AND NOT u.disabled",
      [i.workspace_id, i.issuer],
      db,
    );
    assert(
      issuer,
      403,
      "INVITER_UNAVAILABLE",
      "Cette invitation n’est plus disponible.",
    );
    const [member] = await query(
      "SELECT state FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
      [i.workspace_id, req.actor.id],
      db,
    );
    if (member && member.state !== "active") {
      assert(
        false,
        403,
        "MEMBERSHIP_DISABLED",
        "Votre accès à cet espace est désactivé.",
      );
    }
    if (!member && i.join_role) {
      const actor = { kind: "human" as const, id: i.issuer };
      await authorize(actor, i.workspace_id, "MANAGE_MEMBERS");
      const [r] = await query(
        "SELECT permissions FROM roles WHERE id=$1 AND workspace_id=$2 AND NOT is_owner",
        [i.join_role, i.workspace_id],
        db,
      );
      if (r) {
        for (const p of r.permissions)
          await authorize(actor, i.workspace_id, p);
        await query(
          "INSERT INTO workspace_members(workspace_id,user_id,role_id) VALUES($1,$2,$3)",
          [i.workspace_id, req.actor.id, i.join_role],
          db,
        );
      }
    }
    const pair = [i.issuer, req.actor.id].sort();
    await query(
      "INSERT INTO friendships(user_a,user_b) VALUES($1,$2) ON CONFLICT DO NOTHING",
      pair,
      db,
    );
    await query(
      "UPDATE invitations SET accepted_by=$2 WHERE id=$1",
      [i.id, req.actor.id],
      db,
    );
    await emit(i.workspace_id, "access.updated", req.actor.id, {}, db);
    return { workspace_id: i.workspace_id };
  });
  res.json({ data });
});
socialRouter.get("/integrations", async (req, res) => {
  res.json({
    data: await query(
      "SELECT id,name,url FROM user_integrations WHERE user_id=$1 ORDER BY name",
      [req.actor.id],
    ),
  });
});
socialRouter.post("/integrations", async (req, res) => {
  const b = z
    .object({
      name: z.string().trim().min(1).max(80),
      url: z.url().refine((s) => {
        const u = new URL(s);
        return u.protocol === "https:" && !u.username && !u.password;
      }),
    })
    .parse(req.body);
  const [r] = await query(
    "INSERT INTO user_integrations(user_id,name,url) VALUES($1,$2,$3) RETURNING id,name,url",
    [req.actor.id, b.name, b.url],
  );
  res.status(201).json({ data: r });
});
socialRouter.delete("/integrations/:id", async (req, res) => {
  await query("DELETE FROM user_integrations WHERE id=$1 AND user_id=$2", [
    z.uuid().parse(req.params.id),
    req.actor.id,
  ]);
  res.json({ ok: true });
});
