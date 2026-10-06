// src/server/channels.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import {
  channelAccess,
  authorizeChannel,
  granted,
  visibleChannel,
} from "./access.js";
import { channelPermissions } from "../shared/channel-permissions.js";
import { audit, emit } from "./events.js";
import { assert } from "./errors.js";
export const channelsRouter = Router({ mergeParams: true });
channelsRouter.get("/channels/:id/settings", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  const channel = await authorizeChannel(req.actor, w, id, "MANAGE_CHANNEL");
  const permissions = await granted(req.actor, w);
  res.json({
    data: channel,
    webhooks: permissions.includes("VIEW_WEBHOOKS")
      ? await query(
          "SELECT id,name,revoked FROM webhooks WHERE workspace_id=$1 AND channel_id=$2",
          [w, id],
        )
      : [],
    integrations:
      permissions.includes("MANAGE_WORKSPACE") &&
      permissions.includes("MANAGE_WEBHOOK")
        ? await query(
            "SELECT i.id,i.name,i.enabled,i.provider FROM integrations i WHERE i.workspace_id=$1 AND (EXISTS(SELECT 1 FROM integration_rules r WHERE r.integration_id=i.id AND r.channel_id=$2) OR EXISTS(SELECT 1 FROM webhooks h WHERE h.integration_id=i.id AND h.channel_id=$2))",
            [w, id],
          )
        : [],
    overrides: await query(
      "SELECT * FROM channel_overrides WHERE channel_id=$1 AND workspace_id=$2",
      [id, w],
    ),
  });
});
channelsRouter.patch("/channels/:id/options", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  const channel = await authorizeChannel(req.actor, w, id, "MANAGE_CHANNEL");
  assert(
    !channel.is_dm,
    403,
    "DM_PROTECTED",
    "Les options d’un DM ne peuvent pas être modifiées.",
  );
  const b = z
    .object({
      slowmode_seconds: z.number().int().min(0).max(21600),
      threads_enabled: z.boolean(),
    })
    .strict()
    .parse(req.body);
  await transaction(async (db) => {
    await query(
      "UPDATE channels SET slowmode_seconds=$3,threads_enabled=$4 WHERE id=$1 AND workspace_id=$2",
      [id, w, b.slowmode_seconds, b.threads_enabled],
      db,
    );
    await audit(w, req.actor.id, "channel.options", id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
channelsRouter.put("/channels/:id/permissions", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  await authorizeChannel(req.actor, w, id, "MANAGE_CHANNEL");
  await authorize(req.actor, w, "MANAGE_PERMISSIONS");
  const b = z
    .object({
      role_id: z.uuid().nullable(),
      user_id: z.uuid().nullable(),
      permissions: z.partialRecord(
        z.enum(
          Object.keys(channelPermissions) as [
            keyof typeof channelPermissions,
            ...(keyof typeof channelPermissions)[],
          ],
        ),
        z.boolean(),
      ),
    })
    .strict()
    .parse(req.body);
  assert(
    !!b.role_id !== !!b.user_id,
    400,
    "INVALID_SUBJECT",
    "Choisissez un rôle ou un membre.",
  );
  await transaction(async (db) => {
    await query(
      "SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
      [id, w],
      db,
    );
    const [subject] = b.role_id
      ? await query(
          "SELECT id,is_owner FROM roles WHERE id=$1 AND workspace_id=$2",
          [b.role_id, w],
          db,
        )
      : await query(
          "SELECT m.user_id id,r.is_owner FROM workspace_members m JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 AND m.workspace_id=$2 AND m.state='active'",
          [b.user_id, w],
          db,
        );
    assert(
      subject && !subject.is_owner,
      403,
      "INVALID_SUBJECT",
      "Le propriétaire est protégé ; choisissez un rôle ou membre de cet espace.",
    );
    const capabilities = await authorizeChannel(
      req.actor,
      w,
      id,
      "MANAGE_CHANNEL",
      db,
    );
    for (const [key, value] of Object.entries(b.permissions))
      if (value)
        assert(
          capabilities.capabilities.includes(key),
          403,
          "FORBIDDEN",
          "Vous ne pouvez pas accorder un droit que vous ne possédez pas.",
        );
    await query(
      "DELETE FROM channel_overrides WHERE channel_id=$1 AND workspace_id=$2 AND (role_id=$3 OR user_id=$4)",
      [id, w, b.role_id, b.user_id],
      db,
    );
    if (Object.keys(b.permissions).length)
      await query(
        "INSERT INTO channel_overrides(workspace_id,channel_id,role_id,user_id,permissions) VALUES($1,$2,$3,$4,$5)",
        [w, id, b.role_id, b.user_id, JSON.stringify(b.permissions)],
        db,
      );
    await audit(w, req.actor.id, "channel.permissions", id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
channelsRouter.post("/channels/:id/read", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  await channelAccess(req.actor, w, id);
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte personnel requis.",
  );
  const { through } = z.object({ through: z.uuid() }).strict().parse(req.body);
  await transaction(async (db) => {
    const [message] = await query(
      "SELECT id,created_at FROM messages WHERE id=$1 AND channel_id=$2 AND workspace_id=$3 AND deleted_at IS NULL",
      [through, id, w],
      db,
    );
    assert(message, 404, "NOT_FOUND", "Message introuvable.");
    await query(
      "INSERT INTO channel_read_states(channel_id,user_id,through_at,through_id) SELECT $1,$2,created_at,id FROM messages WHERE id=$3 ON CONFLICT(channel_id,user_id) DO UPDATE SET through_at=EXCLUDED.through_at,through_id=EXCLUDED.through_id,updated_at=now() WHERE (channel_read_states.through_at,channel_read_states.through_id)<(EXCLUDED.through_at,EXCLUDED.through_id)",
      [id, req.actor.id, message.id],
      db,
    );
    await query(
      "UPDATE notifications n SET state='read' WHERE channel_id=$1 AND user_id=$2 AND state='unread' AND type IN ('message','mention') AND (EXISTS(SELECT 1 FROM messages m,messages stop WHERE m.id=n.message_id AND stop.id=$3 AND (m.created_at,m.id)<=(stop.created_at,stop.id)) OR (message_id IS NULL AND n.created_at<=(SELECT created_at FROM messages WHERE id=$3)))",
      [id, req.actor.id, message.id],
      db,
    );
  });
  res.json({ ok: true });
});
channelsRouter.get("/channels/:id/context", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  const ch = await channelAccess(req.actor, w, id);
  const members = await query(
    `SELECT u.id,u.name,u.username,u.bio,u.avatar,u.status,m.role_id,r.name role_name,r.is_owner FROM workspace_members m JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id JOIN channels c ON c.workspace_id=m.workspace_id WHERE c.id=$1 AND m.state='active' AND NOT u.disabled AND ${visibleChannel("c", "u.id", "r.permissions")} ORDER BY r.is_owner DESC,u.name LIMIT 500`,
    [id],
  );
  const threads = ch.threads_enabled
    ? await query(
        "SELECT m.id,m.content,m.created_at,(SELECT count(*)::int FROM messages child WHERE child.thread_id=m.id AND child.deleted_at IS NULL) reply_count FROM messages m WHERE m.channel_id=$1 AND m.deleted_at IS NULL AND m.thread_opened_at IS NOT NULL ORDER BY m.thread_opened_at DESC LIMIT 20",
        [id],
      )
    : [];
  const pins = await query(
    "SELECT id,content,created_at FROM messages WHERE channel_id=$1 AND deleted_at IS NULL AND pinned_at IS NOT NULL ORDER BY pinned_at DESC LIMIT 20",
    [id],
  );
  const mentionIds = [
    ...new Set(
      [...threads, ...pins].flatMap((m) =>
        [...m.content.matchAll(/@\[([0-9a-f-]{36})\]/gi)].map(
          (match) => match[1],
        ),
      ),
    ),
  ];
  const mentionNames = mentionIds.length
    ? await query(
        "SELECT u.id,u.kyros_user_id,u.name FROM users u JOIN workspace_members wm ON wm.user_id=u.id WHERE wm.workspace_id=$1 AND (u.id::text=ANY($2::text[]) OR u.kyros_user_id=ANY($2::text[]))",
        [w, mentionIds],
      )
    : [];
  for (const message of [...threads, ...pins]) message.mentions = mentionNames;
  const files = await query(
    "SELECT id,name,mime,size,created_at FROM attachments WHERE channel_id=$1 AND workspace_id=$2 ORDER BY created_at DESC LIMIT 20",
    [id, w],
  );
  res.json({ data: { members, threads, pins, files } });
});
