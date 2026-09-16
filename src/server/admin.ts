// src/server/admin.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
import { audit, emit } from "./events.js";
import { token, hash, seal } from "./crypto.js";
import { permissions } from "../shared/permissions.js";
import { validateOutboundUrl } from "./network.js";
import { channelAccess } from "./access.js";
export const adminRouter = Router({ mergeParams: true });
const name = z.string().trim().min(1).max(100),
  grants = z.array(z.enum(permissions)).max(permissions.length);
adminRouter.get("/members", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const after = req.query.after ? z.uuid().parse(req.query.after) : null;
  const rows = await query(
    "SELECT u.id,u.name,u.kyros_user_id,u.avatar,u.status,u.last_login_at,m.role_id,m.state,r.name role_name,r.is_owner FROM workspace_members m JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id WHERE m.workspace_id=$1 AND ($2::uuid IS NULL OR u.id>$2) ORDER BY u.id LIMIT 501",
    [w, after],
  );
  const more = rows.length > 500;
  const data = rows.slice(0, 500);
  res.json({ data, nextCursor: more ? data.at(-1)?.id : null });
});
adminRouter.post("/members", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MEMBERS");
  const b = z
    .object({ kyros_user_id: z.string().min(1).max(200), role_id: z.uuid() })
    .parse(req.body);
  await transaction(async (db) => {
    const [r] = await query(
      "SELECT id,is_owner,permissions FROM roles WHERE id=$1 AND workspace_id=$2",
      [b.role_id, w],
      db,
    );
    assert(
      r && !r.is_owner,
      400,
      "INVALID_ROLE",
      "Choisissez un rôle hors Owner.",
    );
    for (const p of r.permissions) await authorize(req.actor, w, p);
    const [u] = await query(
      "SELECT id FROM users WHERE kyros_user_id=$1",
      [b.kyros_user_id],
      db,
    );
    assert(
      u,
      404,
      "USER_NOT_FOUND",
      "Ce membre doit d’abord se connecter à Liora avec Kyros.",
    );
    await query(
      "INSERT INTO workspace_members(workspace_id,user_id,role_id) VALUES($1,$2,$3)",
      [w, u.id, b.role_id],
      db,
    );
    await audit(w, req.actor.id, "member.added", u.id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.status(201).json({ ok: true });
});
adminRouter.patch("/members/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  await authorize(req.actor, w, "MANAGE_MEMBERS");
  const b = z
    .object({
      role_id: z.uuid(),
      state: z.enum(["active", "disabled", "banned"]),
    })
    .parse(req.body);
  await transaction(async (db) => {
    const [old] = await query(
      "SELECT r.is_owner FROM workspace_members m JOIN roles r ON r.id=m.role_id WHERE m.workspace_id=$1 AND m.user_id=$2 FOR UPDATE OF m",
      [w, id],
      db,
    );
    assert(
      old && !old.is_owner,
      403,
      "OWNER_PROTECTED",
      "Le propriétaire ne peut pas être désactivé ou rétrogradé ici.",
    );
    const [r] = await query(
      "SELECT id,permissions FROM roles WHERE id=$1 AND workspace_id=$2 AND NOT is_owner",
      [b.role_id, w],
      db,
    );
    assert(r, 400, "INVALID_ROLE", "Rôle invalide.");
    for (const p of r.permissions) await authorize(req.actor, w, p);
    await query(
      "UPDATE workspace_members SET role_id=$3,state=$4 WHERE workspace_id=$1 AND user_id=$2",
      [w, id, b.role_id, b.state],
      db,
    );
    await audit(w, req.actor.id, "member.updated", id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
adminRouter.get("/roles", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const after = req.query.after ? z.uuid().parse(req.query.after) : null;
  const rows = await query(
    "SELECT * FROM roles WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 501",
    [w, after],
  );
  const data = rows.slice(0, 500);
  res.json({
    data,
    permissions,
    nextCursor: rows.length > 500 ? data.at(-1)?.id : null,
  });
});
adminRouter.post("/roles", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_ROLES");
  await authorize(req.actor, w, "MANAGE_PERMISSIONS");
  const b = z.object({ name, permissions: grants }).parse(req.body);
  for (const p of b.permissions) await authorize(req.actor, w, p);
  const row = await transaction(async (db) => {
    const [r] = await query(
      "INSERT INTO roles(workspace_id,name,permissions) VALUES($1,$2,$3) RETURNING *",
      [w, b.name, b.permissions],
      db,
    );
    await audit(w, req.actor.id, "role.created", r.id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
    return r;
  });
  res.status(201).json({ data: row });
});
adminRouter.patch("/roles/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_ROLES");
  await authorize(req.actor, w, "MANAGE_PERMISSIONS");
  const b = z.object({ name, permissions: grants }).parse(req.body);
  for (const p of b.permissions) await authorize(req.actor, w, p);
  const row = await transaction(async (db) => {
    const [r] = await query(
      "UPDATE roles SET name=$3,permissions=$4 WHERE workspace_id=$1 AND id=$2 AND NOT is_owner RETURNING *",
      [w, z.uuid().parse(req.params.id), b.name, b.permissions],
      db,
    );
    assert(r, 403, "OWNER_PROTECTED", "Rôle protégé ou introuvable.");
    await audit(w, req.actor.id, "role.updated", r.id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
    return r;
  });
  res.json({ data: row });
});
adminRouter.patch("/settings", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_WORKSPACE");
  const b = z
    .object({
      name,
      description: z.string().max(2000),
      settings: z
        .object({
          locale: z.string().max(10).default("fr-FR"),
          domain: z.string().max(200).default(""),
          logo: z.string().max(500).default(""),
        })
        .default({ locale: "fr-FR", domain: "", logo: "" }),
    })
    .parse(req.body);
  await transaction(async (db) => {
    await query(
      "UPDATE workspaces SET name=$2,description=$3,settings=$4 WHERE id=$1",
      [w, b.name, b.description, JSON.stringify(b.settings)],
      db,
    );
    await audit(w, req.actor.id, "workspace.updated", w, db);
  });
  res.json({ ok: true });
});
adminRouter.get("/accounts", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_BOTS");
  res.json({
    data: await query(
      "SELECT id,name,kind,description,permissions,revoked,last_used_at,created_at FROM technical_accounts WHERE workspace_id=$1 ORDER BY created_at",
      [w],
    ),
  });
});
adminRouter.post("/accounts", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "CREATE_BOT");
  const b = z
    .object({
      name,
      kind: z.enum(["bot", "service"]),
      description: z.string().max(1000).default(""),
      permissions: grants,
    })
    .parse(req.body);
  for (const p of b.permissions) await authorize(req.actor, w, p);
  const raw = token();
  const row = await transaction(async (db) => {
    const [r] = await query(
      "INSERT INTO technical_accounts(workspace_id,name,kind,description,permissions,token_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,kind,permissions",
      [w, b.name, b.kind, b.description, b.permissions, hash(raw)],
      db,
    );
    await audit(w, req.actor.id, "account.created", r.id, db);
    return r;
  });
  res.status(201).json({ data: row, token: raw });
});
adminRouter.post("/accounts/:id/token", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_BOT_TOKEN");
  const b = z.object({ revoke: z.boolean() }).parse(req.body);
  const raw = token();
  await transaction(async (db) => {
    const [r] = await query(
      "UPDATE technical_accounts SET token_hash=$3,revoked=$4 WHERE workspace_id=$1 AND id=$2 RETURNING id",
      [w, z.uuid().parse(req.params.id), b.revoke ? null : hash(raw), b.revoke],
      db,
    );
    assert(r, 404, "NOT_FOUND", "Identité introuvable.");
    await audit(
      w,
      req.actor.id,
      b.revoke ? "token.revoked" : "token.rotated",
      r.id,
      db,
    );
  });
  res.json({ ok: true, ...(!b.revoke ? { token: raw } : {}) });
});
adminRouter.get("/webhooks", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WEBHOOKS");
  res.json({
    data: await query(
      "SELECT id,name,channel_id,revoked,allow_tasks,created_at FROM webhooks WHERE workspace_id=$1",
      [w],
    ),
  });
});
adminRouter.post("/webhooks", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "CREATE_WEBHOOK");
  const b = z
    .object({
      name,
      channel_id: z.uuid(),
      allow_tasks: z.boolean().default(false),
    })
    .parse(req.body);
  const channel = await channelAccess(req.actor, w, b.channel_id);
  assert(
    !channel.is_dm,
    403,
    "DM_PROTECTED",
    "Les webhooks ne peuvent pas publier dans une conversation privée.",
  );
  if (b.allow_tasks) await authorize(req.actor, w, "CREATE_TASK");
  const raw = token();
  const row = await transaction(async (db) => {
    const [t] = await query(
      "INSERT INTO technical_accounts(workspace_id,name,kind) VALUES($1,$2,'service') RETURNING id",
      [w, b.name],
      db,
    );
    const [r] = await query(
      "INSERT INTO webhooks(workspace_id,channel_id,technical_id,name,token_hash,allow_tasks) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name",
      [w, b.channel_id, t.id, b.name, hash(raw), b.allow_tasks],
      db,
    );
    await audit(w, req.actor.id, "webhook.created", r.id, db);
    return r;
  });
  res
    .status(201)
    .json({ data: row, url: `${process.env.APP_URL}/api/webhooks/${raw}` });
});
adminRouter.delete("/webhooks/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "DELETE_WEBHOOK");
  await transaction(async (db) => {
    await query(
      "UPDATE webhooks SET revoked=true WHERE workspace_id=$1 AND id=$2",
      [w, z.uuid().parse(req.params.id)],
      db,
    );
    await audit(w, req.actor.id, "webhook.revoked", String(req.params.id), db);
  });
  res.json({ ok: true });
});
adminRouter.get("/outbound", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WEBHOOKS");
  res.json({
    data: await query(
      "SELECT id,name,url,enabled,event_types FROM outbound_webhooks WHERE workspace_id=$1",
      [w],
    ),
    deliveries: await query(
      "SELECT id,state,attempts,last_error,created_at FROM webhook_deliveries WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50",
      [w],
    ),
  });
});
adminRouter.post("/outbound", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "CREATE_WEBHOOK");
  const b = z
    .object({
      name,
      url: z.url(),
      event_types: z
        .array(z.string().regex(/^(\*|[a-z][a-z0-9_.]*(\.\*)?)$/))
        .max(30)
        .default([]),
    })
    .parse(req.body);
  await validateOutboundUrl(b.url);
  const raw = token();
  const [row] = await query(
    "INSERT INTO outbound_webhooks(workspace_id,name,url,secret,event_types) VALUES($1,$2,$3,$4,$5) RETURNING id,name,url,event_types",
    [w, b.name, b.url, await seal(raw), b.event_types],
  );
  await audit(w, req.actor.id, "outbound.created", row.id);
  res.status(201).json({ data: row, secret: raw });
});
adminRouter.patch("/outbound/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_WEBHOOK");
  const { event_types } = z
    .object({
      event_types: z
        .array(z.string().regex(/^(\*|[a-z][a-z0-9_.]*(\.\*)?)$/))
        .max(30),
    })
    .strict()
    .parse(req.body);
  const rows = await query(
    "UPDATE outbound_webhooks SET event_types=$3 WHERE workspace_id=$1 AND id=$2 RETURNING id",
    [w, z.uuid().parse(req.params.id), event_types],
  );
  assert(rows.length, 404, "NOT_FOUND", "Destination introuvable.");
  await audit(
    w,
    req.actor.id,
    "outbound.filters_updated",
    String(req.params.id),
  );
  res.json({ ok: true });
});
adminRouter.delete("/outbound/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "DELETE_WEBHOOK");
  await query(
    "UPDATE outbound_webhooks SET enabled=false WHERE workspace_id=$1 AND id=$2",
    [w, z.uuid().parse(req.params.id)],
  );
  await audit(w, req.actor.id, "outbound.disabled", String(req.params.id));
  res.json({ ok: true });
});
adminRouter.post("/deliveries/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_WEBHOOK");
  const b = z.object({ action: z.enum(["retry", "cancel"]) }).parse(req.body);
  await query(
    "UPDATE webhook_deliveries SET state=$3,attempts=0,next_attempt_at=now() WHERE workspace_id=$1 AND id=$2 AND state<>'sent'",
    [
      w,
      z.uuid().parse(req.params.id),
      b.action === "retry" ? "pending" : "cancelled",
    ],
  );
  await audit(w, req.actor.id, `delivery.${b.action}`, String(req.params.id));
  res.json({ ok: true });
});
adminRouter.get("/flags", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_FEATURE_FLAGS");
  res.json({
    data: await query(
      "SELECT * FROM feature_flags WHERE workspace_id=$1 ORDER BY key",
      [w],
    ),
  });
});
adminRouter.put("/flags/:key", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_FEATURE_FLAGS");
  const key = z
    .enum(["jellyfin.enabled", "media_requests.enabled"])
    .parse(req.params.key);
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  assert(
    !enabled,
    409,
    "FEATURE_NOT_IMPLEMENTED",
    "Ce module est différé et ne peut pas encore être activé.",
  );
  await query(
    "INSERT INTO feature_flags(workspace_id,key,enabled) VALUES($1,$2,false) ON CONFLICT(workspace_id,key) DO UPDATE SET enabled=false",
    [w, key],
  );
  await audit(w, req.actor.id, "flag.disabled", key);
  res.json({ ok: true });
});
adminRouter.get("/audit", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_AUDIT_LOG");
  res.json({
    data: await query(
      "SELECT * FROM audit_logs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100",
      [w],
    ),
  });
});
adminRouter.get("/events", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_MONITORING");
  res.json({
    data: await query(
      "SELECT * FROM events WHERE workspace_id=$1 ORDER BY seq DESC LIMIT 100",
      [w],
    ),
  });
});
adminRouter.get("/monitoring", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_MONITORING");
  res.json({
    data: await query(
      `SELECT t.*,COALESCE((SELECT json_agg(c) FROM (SELECT state,latency_ms,created_at,detail FROM monitoring_checks WHERE target_id=t.id ORDER BY created_at DESC LIMIT 30)c),'[]') history FROM monitoring_targets t WHERE workspace_id=$1 ORDER BY name`,
      [w],
    ),
  });
});
adminRouter.post("/heartbeat", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MONITORING");
  await query(
    "UPDATE monitoring_targets SET last_heartbeat=now() WHERE workspace_id=$1 AND kind='heartbeat'",
    [w],
  );
  res.json({ ok: true });
});
adminRouter.post("/events", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "SEND_MESSAGE");
  const b = z
    .object({
      type: z.string().regex(/^[a-z][a-z0-9_.]{2,100}$/),
      payload: z.record(z.string(), z.unknown()),
    })
    .parse(req.body);
  res
    .status(201)
    .json({ data: await emit(w, b.type, req.actor.id, b.payload) });
});
