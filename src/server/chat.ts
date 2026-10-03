// src/server/chat.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction, type DB } from "./db.js";
import { authorize, type Actor } from "./auth.js";
import { assert } from "./errors.js";
import { emit, audit } from "./events.js";
import { channelAccess, granted, visibleChannel } from "./access.js";
import { validTimezone } from "../shared/schedule.js";
import emojiData from "emojibase-data/fr/data.json" with { type: "json" };
import {
  detectDateTimes,
  type DetectedDateTime,
} from "../shared/date-detection.js";
const nativeEmojis = new Set(
  emojiData
    .flatMap((e) => [e.emoji, ...(e.skins || []).map((s) => s.emoji)])
    .map((e) => e.replace(/[\uFE0E\uFE0F]/g, "")),
);
const body = z
  .object({
    content: z.string().trim().min(1).max(8000),
    reply_to: z.uuid().nullable().optional(),
    thread_id: z.uuid().nullable().optional(),
    attachment_ids: z.array(z.uuid()).max(10).default([]),
    timezone: z.string().max(80).refine(validTimezone).default("UTC"),
  })
  .strict();
export async function sendMessage(
  workspace: string,
  channel: string,
  actor: Actor,
  content: string,
  reply: string | null,
  db: DB,
  thread: string | null = null,
  attachments: string[] = [],
  timezone = "UTC",
): Promise<{ message: any; detectedDates: DetectedDateTime[] }> {
  const [ch] = await query(
    "SELECT * FROM channels WHERE id=$1 AND workspace_id=$2 AND NOT archived",
    [channel, workspace],
    db,
  );
  assert(ch, 404, "CHANNEL_NOT_FOUND", "Salon introuvable ou archivé.");
  if (ch.is_dm) {
    const [recipient] = await query(
      "SELECT u.id,u.preferences FROM channel_access a JOIN users u ON u.id=a.user_id JOIN workspace_members wm ON wm.user_id=u.id AND wm.workspace_id=$2 AND wm.state='active' WHERE a.channel_id=$1 AND u.id<>$3 AND NOT u.disabled",
      [channel, workspace, actor.id],
      db,
    );
    assert(
      recipient,
      403,
      "RECIPIENT_UNAVAILABLE",
      "Destinataire indisponible.",
    );
    const policy = recipient.preferences.dmPolicy || "members";
    const friends = await query(
      "SELECT 1 FROM friendships WHERE (user_a=$1 AND user_b=$2) OR (user_b=$1 AND user_a=$2)",
      [actor.id, recipient.id],
      db,
    );
    assert(
      policy !== "nobody" && (policy !== "friends" || friends.length > 0),
      403,
      "DM_POLICY",
      "Ce membre ne reçoit pas de messages privés de votre part.",
    );
  }
  if (reply) {
    const [parent] = await query(
      "SELECT id FROM messages WHERE id=$1 AND channel_id=$2 AND deleted_at IS NULL",
      [reply, channel],
      db,
    );
    assert(parent, 400, "INVALID_REPLY", "Message de réponse introuvable.");
  }
  if (thread) {
    await authorize(actor, workspace, "CREATE_THREAD");
    const [root] = await query(
      "SELECT id FROM messages WHERE id=$1 AND channel_id=$2 AND thread_id IS NULL AND deleted_at IS NULL",
      [thread, channel],
      db,
    );
    assert(root, 400, "INVALID_THREAD", "Fil introuvable.");
  }
  if (attachments.length) {
    const files = await query(
      "SELECT id FROM attachments WHERE id=ANY($1::uuid[]) AND workspace_id=$2 AND user_id=$3 AND channel_id=$4",
      [attachments, workspace, actor.id, channel],
      db,
    );
    assert(
      files.length === new Set(attachments).size,
      400,
      "INVALID_ATTACHMENT",
      "Pièce jointe invalide pour ce salon.",
    );
  }
  const [message] = await query(
    "INSERT INTO messages(workspace_id,channel_id,user_id,technical_id,content,reply_to,thread_id,attachment_ids,detection_timezone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [
      workspace,
      channel,
      actor.kind === "human" ? actor.id : null,
      actor.kind === "human" ? null : actor.id,
      content,
      reply,
      thread,
      attachments,
      timezone,
    ],
    db,
  );
  await emit(
    workspace,
    "message.created",
    actor.id,
    { id: message.id, channel_id: channel },
    db,
  );
  const mentions = [...content.matchAll(/@\[([0-9a-f-]{36})\]/g)].map(
    (m) => m[1],
  );
  if (mentions.length)
    await query(
      `INSERT INTO notifications(workspace_id,user_id,type,title,body,channel_id) SELECT $1,m.user_id,'mention','Nouvelle mention',$3,$5 FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=ANY($2::uuid[]) AND m.state='active' AND m.user_id::text<>$4 AND COALESCE((u.preferences->>'mentions')::boolean,true)`,
      [workspace, mentions, content.slice(0, 500), actor.id, channel],
      db,
    );
  await query(
    `INSERT INTO notifications(workspace_id,user_id,type,title,body,channel_id) SELECT $1,c.user_id,'message',$3,$4,$2 FROM channel_members c JOIN workspace_members m ON m.user_id=c.user_id AND m.workspace_id=$1 WHERE c.channel_id=$2 AND c.following AND NOT c.muted AND m.state='active' AND c.user_id::text<>$5 AND NOT(c.user_id=ANY($6::uuid[]))`,
    [
      workspace,
      channel,
      `Nouveau message dans #${ch.name}`,
      content.slice(0, 500),
      actor.id,
      mentions,
    ],
    db,
  );
  const detectedDates = detectDateTimes(
    content,
    new Date(message.created_at),
    message.detection_timezone,
  );
  return { message, detectedDates };
}
export const chatRouter = Router({ mergeParams: true });
chatRouter.use("/messages/:id", async (req, _res, next) => {
  const w = z.uuid().parse(req.workspaceId);
  const [m] = await query(
    "SELECT channel_id FROM messages WHERE id=$1 AND workspace_id=$2 AND deleted_at IS NULL",
    [z.uuid().parse(req.params.id), w],
  );
  assert(m, 404, "NOT_FOUND", "Message introuvable.");
  await channelAccess(req.actor, w, m.channel_id);
  next();
});
chatRouter.get("/channels/:channel/messages", async (req, res) => {
  const workspace = z.uuid().parse(req.workspaceId),
    channel = z.uuid().parse(req.params.channel);
  await authorize(req.actor, workspace, "VIEW_CHANNEL");
  await channelAccess(req.actor, workspace, channel);
  const thread = req.query.thread ? z.uuid().parse(req.query.thread) : null;
  const pinned = req.query.pinned === "true";
  const cursor = req.query.before ? z.uuid().parse(req.query.before) : null;
  const rows = await query(
    `SELECT m.*,u.avatar author_avatar,(SELECT count(*)::int FROM messages child WHERE child.thread_id=m.id AND child.deleted_at IS NULL) reply_count,COALESCE(u.name,t.name) author_name,COALESCE(t.kind,'human') author_kind,COALESCE((SELECT json_agg(json_build_object('emoji',r.emoji,'actor_id',r.actor_id)) FROM message_reactions r WHERE r.message_id=m.id),'[]') reactions FROM messages m LEFT JOIN users u ON u.id=m.user_id LEFT JOIN technical_accounts t ON t.id=m.technical_id WHERE m.workspace_id=$1 AND m.channel_id=$2 AND m.deleted_at IS NULL AND (($5::boolean AND m.pinned_at IS NOT NULL) OR (NOT $5::boolean AND m.thread_id IS NOT DISTINCT FROM $4::uuid)) AND ($3::uuid IS NULL OR (m.created_at,m.id)<(SELECT created_at,id FROM messages WHERE id=$3 AND channel_id=$2)) ORDER BY m.created_at DESC,m.id DESC LIMIT 50`,
    [workspace, channel, cursor, thread, pinned],
  );
  for (const row of rows) {
    const ids = [...row.content.matchAll(/@\[([0-9a-f-]{36})\]/gi)].map(
      (m: RegExpMatchArray) => m[1],
    );
    row.mentions = ids.length
      ? await query(
          "SELECT u.id,u.kyros_user_id,u.name FROM users u JOIN workspace_members wm ON wm.user_id=u.id WHERE wm.workspace_id=$1 AND (u.id::text=ANY($2::text[]) OR u.kyros_user_id=ANY($2::text[]))",
          [workspace, ids],
        )
      : [];
    row.detectedDates = detectDateTimes(
      row.content,
      new Date(row.created_at),
      row.detection_timezone,
    );
  }
  res.json({
    data: rows.reverse(),
    nextCursor: rows.length === 50 ? rows[0].id : null,
  });
});
chatRouter.post("/channels/:channel/messages", async (req, res) => {
  const workspace = z.uuid().parse(req.workspaceId),
    channel = z.uuid().parse(req.params.channel);
  await authorize(req.actor, workspace, "SEND_MESSAGE");
  await channelAccess(req.actor, workspace, channel);
  const input = body.parse(req.body);
  const [ch] = await query(
    "SELECT type FROM channels WHERE id=$1 AND workspace_id=$2",
    [channel, workspace],
  );
  if (ch?.type === "announcement")
    await authorize(req.actor, workspace, "MANAGE_CHANNEL");
  const result = await transaction((db) =>
    sendMessage(
      workspace,
      channel,
      req.actor,
      input.content,
      input.reply_to ?? null,
      db,
      input.thread_id ?? null,
      input.attachment_ids,
      input.timezone,
    ),
  );
  res.status(201).json({
    data: result.message,
    detectedDates: result.detectedDates,
  });
});
chatRouter.get("/messages/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  const [m] = await query(
    "SELECT m.*,u.name author_name,u.avatar author_avatar,COALESCE((SELECT json_agg(json_build_object('emoji',r.emoji,'actor_id',r.actor_id)) FROM message_reactions r WHERE message_id=m.id),'[]') reactions FROM messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.workspace_id=$2",
    [req.params.id, w],
  );
  if (m)
    m.detectedDates = detectDateTimes(
      m.content,
      new Date(m.created_at),
      m.detection_timezone,
    );
  res.json({ data: m });
});
chatRouter.patch("/messages/:id", async (req, res) => {
  const workspace = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  const { content } = body.pick({ content: true }).parse(req.body);
  await authorize(req.actor, workspace, "EDIT_OWN_MESSAGE");
  const [row] = await query(
    "UPDATE messages SET content=$3,edited_at=now() WHERE id=$1 AND workspace_id=$2 AND COALESCE(user_id,technical_id)=$4 AND deleted_at IS NULL RETURNING id",
    [id, workspace, content, req.actor.id],
  );
  assert(row, 404, "NOT_FOUND", "Message introuvable ou non modifiable.");
  await emit(workspace, "message.updated", req.actor.id, { id });
  res.json({ ok: true });
});
chatRouter.delete("/messages/:id", async (req, res) => {
  const workspace = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  const [message] = await query(
    "SELECT COALESCE(user_id,technical_id) actor FROM messages WHERE id=$1 AND workspace_id=$2",
    [id, workspace],
  );
  assert(message, 404, "NOT_FOUND", "Message introuvable.");
  await authorize(
    req.actor,
    workspace,
    message.actor === req.actor.id ? "DELETE_OWN_MESSAGE" : "MANAGE_MESSAGES",
  );
  await transaction(async (db) => {
    await query(
      "UPDATE messages SET deleted_at=now(),content='[Message supprimé]' WHERE id=$1",
      [id],
      db,
    );
    await audit(workspace, req.actor.id, "message.deleted", id, db);
    await emit(workspace, "message.deleted", req.actor.id, { id }, db);
  });
  res.json({ ok: true });
});
chatRouter.post("/messages/:id/reactions", async (req, res) => {
  const workspace = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  await authorize(req.actor, workspace, "ADD_REACTION");
  const { emoji } = z
    .object({ emoji: z.string().min(1).max(64) })
    .parse(req.body);
  assert(
    nativeEmojis.has(emoji.replace(/[\uFE0E\uFE0F]/g, "")) ||
      /^:[a-z0-9_]+:$/.test(emoji),
    400,
    "INVALID_EMOJI",
    "Emoji invalide.",
  );
  if (emoji.startsWith(":")) {
    const [e] = await query(
      "SELECT id FROM custom_emojis WHERE workspace_id=$1 AND name=$2",
      [workspace, emoji.slice(1, -1)],
    );
    assert(e, 400, "INVALID_EMOJI", "Emoji inconnu.");
  }
  await transaction(async (db) => {
    const [m] = await query(
      "SELECT id FROM messages WHERE id=$1 AND workspace_id=$2 AND deleted_at IS NULL FOR UPDATE",
      [id, workspace],
      db,
    );
    assert(m, 404, "NOT_FOUND", "Message introuvable.");
    const removed = await query(
      "DELETE FROM message_reactions WHERE message_id=$1 AND actor_id=$2 AND emoji=$3 RETURNING *",
      [id, req.actor.id, emoji],
      db,
    );
    if (!removed.length)
      await query(
        "INSERT INTO message_reactions VALUES($1,$2,$3)",
        [id, req.actor.id, emoji],
        db,
      );
    await emit(workspace, "reaction.updated", req.actor.id, { id }, db);
  });
  res.json({ ok: true });
});
chatRouter.put("/channels/:channel/follow", async (req, res) => {
  const workspace = z.uuid().parse(req.workspaceId);
  await channelAccess(req.actor, workspace, z.uuid().parse(req.params.channel));
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const data = z
    .object({ following: z.boolean(), muted: z.boolean() })
    .parse(req.body);
  const [row] = await query(
    "INSERT INTO channel_members(channel_id,user_id,following,muted) SELECT id,$3,$4,$5 FROM channels WHERE id=$1 AND workspace_id=$2 ON CONFLICT(channel_id,user_id) DO UPDATE SET following=$4,muted=$5 RETURNING *",
    [
      z.uuid().parse(req.params.channel),
      workspace,
      req.actor.id,
      data.following,
      data.muted,
    ],
  );
  assert(row, 404, "NOT_FOUND", "Salon introuvable.");
  res.json({ data: row });
});

chatRouter.get("/channels/:channel/follow", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await channelAccess(req.actor, w, z.uuid().parse(req.params.channel));
  const [r] = await query(
    "SELECT cm.following,cm.muted FROM channel_members cm JOIN channels c ON c.id=cm.channel_id WHERE c.workspace_id=$1 AND cm.channel_id=$2 AND cm.user_id=$3",
    [w, z.uuid().parse(req.params.channel), req.actor.id],
  );
  res.json({ data: r || { following: false, muted: false } });
});

chatRouter.put("/messages/:id/pin", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MESSAGES");
  const { pinned } = z.object({ pinned: z.boolean() }).parse(req.body);
  await query(
    "UPDATE messages SET pinned_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1 AND workspace_id=$2",
    [req.params.id, w, pinned],
  );
  await emit(w, "message.updated", req.actor.id, {});
  res.json({ ok: true });
});
chatRouter.get("/search", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_CHANNEL");
  const q = z.string().trim().min(2).max(200).parse(req.query.q);
  const before = req.query.before ? z.uuid().parse(req.query.before) : null;
  const channel = req.query.channel ? z.uuid().parse(req.query.channel) : null;
  if (channel) await channelAccess(req.actor, w, channel);
  const author = z
    .string()
    .trim()
    .max(100)
    .parse(req.query.author || "");
  const from = req.query.from
    ? z.iso.datetime({ offset: true }).parse(req.query.from)
    : null;
  const until = req.query.until
    ? z.iso.datetime({ offset: true }).parse(req.query.until)
    : null;
  assert(
    !from || !until || Date.parse(from) < Date.parse(until),
    400,
    "INVALID_RANGE",
    "La fin doit suivre le début.",
  );
  const rows = await query(
    `SELECT m.id,m.content,m.created_at,m.channel_id,m.thread_id,c.name channel_name,COALESCE(u.name,t.name) author_name FROM messages m JOIN channels c ON c.id=m.channel_id LEFT JOIN users u ON u.id=m.user_id LEFT JOIN technical_accounts t ON t.id=m.technical_id WHERE m.workspace_id=$1 AND ${visibleChannel()} AND m.deleted_at IS NULL AND to_tsvector('simple',m.content) @@ websearch_to_tsquery('simple',$4) AND ($5::uuid IS NULL OR (m.created_at,m.id)<(SELECT created_at,id FROM messages WHERE id=$5 AND workspace_id=$1)) AND ($6::uuid IS NULL OR m.channel_id=$6) AND ($7='' OR COALESCE(u.name,t.name) ILIKE '%'||$7||'%') AND ($8::timestamptz IS NULL OR m.created_at>=$8) AND ($9::timestamptz IS NULL OR m.created_at<$9) ORDER BY m.created_at DESC,m.id DESC LIMIT 50`,
    [
      w,
      req.actor.id,
      await granted(req.actor, w),
      q,
      before,
      channel,
      author,
      from,
      until,
    ],
  );
  for (const row of rows) {
    row.detectedDates = detectDateTimes(
      row.content,
      new Date(row.created_at),
      row.detection_timezone,
    );
  }
  res.json({
    data: rows,
    nextCursor: rows.length === 50 ? rows.at(-1)?.id : null,
  });
});
chatRouter.get("/channels/:channel/access", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  const ch = await channelAccess(
    req.actor,
    w,
    z.uuid().parse(req.params.channel),
  );
  if (!ch.is_dm) await authorize(req.actor, w, "MANAGE_CHANNEL");
  res.json({
    data: await query(
      "SELECT u.id,u.name FROM channel_access a JOIN users u ON u.id=a.user_id WHERE channel_id=$1",
      [ch.id],
    ),
  });
});
chatRouter.put("/channels/:channel/access", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_CHANNEL");
  const ch = await channelAccess(
    req.actor,
    w,
    z.uuid().parse(req.params.channel),
  );
  assert(
    !ch.is_dm,
    403,
    "DM_PROTECTED",
    "Les participants de cette conversation sont fixes.",
  );
  const { user_ids } = z
    .object({ user_ids: z.array(z.uuid()).max(500) })
    .parse(req.body);
  await transaction(async (db) => {
    const valid = await query(
      "SELECT user_id FROM workspace_members WHERE workspace_id=$1 AND user_id=ANY($2::uuid[]) AND state='active'",
      [w, user_ids],
      db,
    );
    assert(
      valid.length === new Set(user_ids).size,
      400,
      "INVALID_MEMBERS",
      "Membres invalides.",
    );
    await query("DELETE FROM channel_access WHERE channel_id=$1", [ch.id], db);
    for (const id of new Set(user_ids))
      await query("INSERT INTO channel_access VALUES($1,$2)", [ch.id, id], db);
    await audit(w, req.actor.id, "channel.access.updated", ch.id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
chatRouter.post("/conversations", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "SEND_MESSAGE");
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const { user_id } = z.object({ user_id: z.uuid() }).parse(req.body);
  assert(
    user_id !== req.actor.id,
    400,
    "INVALID_MEMBER",
    "Choisissez un autre membre.",
  );
  const [other] = await query(
    "SELECT u.name FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE workspace_id=$1 AND user_id=$2 AND state='active'",
    [w, user_id],
  );
  assert(other, 400, "INVALID_MEMBER", "Membre indisponible.");
  const [self] = await query("SELECT name FROM users WHERE id=$1", [
    req.actor.id,
  ]);
  const data = await transaction(async (db) => {
    const key = [req.actor.id, user_id].sort().join(":");
    const [ch] = await query(
      "INSERT INTO channels(workspace_id,name,is_private,is_dm,dm_key,created_by) VALUES($1,$2,true,true,$3,$4) ON CONFLICT(workspace_id,dm_key) WHERE dm_key IS NOT NULL DO UPDATE SET dm_key=EXCLUDED.dm_key RETURNING *",
      [w, `${self.name} · ${other.name}`.slice(0, 100), key, req.actor.id],
      db,
    );
    for (const id of [req.actor.id, user_id])
      await query(
        "INSERT INTO channel_access VALUES($1,$2) ON CONFLICT DO NOTHING",
        [ch.id, id],
        db,
      );
    for (const id of [req.actor.id, user_id])
      await query(
        "INSERT INTO channel_members(channel_id,user_id,following,muted) VALUES($1,$2,true,false) ON CONFLICT DO NOTHING",
        [ch.id, id],
        db,
      );
    await emit(w, "access.updated", req.actor.id, {}, db);
    return ch;
  });
  res.status(201).json({ data });
});
