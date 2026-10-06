// src/server/personal-activity.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert } from "./errors.js";
import {
  canReadTarget,
  reminderReferences,
  humanWorkspace,
} from "./experience-access.js";
import { visibleChannel } from "./access.js";
import { favoritesRouter } from "./favorites.js";
import { remindersRouter } from "./reminders.js";
import { validTimezone } from "../shared/schedule.js";
export const personalActivityRouter = Router();
personalActivityRouter.use((_req, _res, next) => {
  assert(
    _req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte personnel requis.",
  );
  next();
});
const notificationAccess = `n.user_id=$1 AND m.state='active' AND 'VIEW_WORKSPACE'=ANY(r.permissions) AND (n.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=n.channel_id AND c.workspace_id=n.workspace_id AND ${visibleChannel("c", "$1", "r.permissions")})) AND (n.type<>'argos' OR 'VIEW_MONITORING'=ANY(r.permissions)) AND (n.type<>'task' OR 'VIEW_BOARD'=ANY(r.permissions))`;
personalActivityRouter.get("/notifications", async (req, res) => {
  const workspace = await query(
    `SELECT n.*,w.name workspace_name FROM notifications n JOIN workspaces w ON w.id=n.workspace_id JOIN workspace_members m ON m.workspace_id=n.workspace_id AND m.user_id=n.user_id JOIN roles r ON r.id=m.role_id WHERE ${notificationAccess} ORDER BY n.created_at DESC,n.id DESC LIMIT 500`,
    [req.actor.id],
  );
  const own = await query(
    "SELECT * FROM personal_notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 500",
    [req.actor.id],
  );
  res.json({
    data: [...workspace, ...own]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 500),
  });
});
personalActivityRouter.patch("/notifications/:id", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    { state } = z
      .object({ state: z.enum(["unread", "read", "dismissed"]) })
      .strict()
      .parse(req.body);
  const own = await query(
    "UPDATE personal_notifications SET state=$3 WHERE id=$2 AND user_id=$1 RETURNING id",
    [req.actor.id, id, state],
  );
  if (!own.length) {
    const rows = await query(
      `UPDATE notifications SET state=$3 WHERE id IN (SELECT n.id FROM notifications n JOIN workspace_members m ON m.workspace_id=n.workspace_id AND m.user_id=n.user_id JOIN roles r ON r.id=m.role_id WHERE n.id=$2 AND ${notificationAccess}) RETURNING id`,
      [req.actor.id, id, state],
    );
    assert(rows.length, 404, "NOT_FOUND", "Notification introuvable.");
  }
  res.json({ ok: true });
});
personalActivityRouter.get("/favorites", async (req, res) => {
  const rows = await query(
    "SELECT f.*,w.name workspace_name FROM favorites f JOIN workspaces w ON w.id=f.workspace_id JOIN workspace_members m ON m.workspace_id=f.workspace_id AND m.user_id=f.user_id AND m.state='active' JOIN roles r ON r.id=m.role_id WHERE 'VIEW_WORKSPACE'=ANY(r.permissions) AND f.user_id=$1 AND f.target_type<>'page' ORDER BY f.position,f.created_at LIMIT 500",
    [req.actor.id],
  );
  const data = [];
  for (const r of rows) {
    const t = await canReadTarget(
      req.actor,
      r.workspace_id,
      r.target_type,
      r.target_id,
    );
    if (t)
      data.push({
        ...r,
        target_name: t.title || t.name || t.content?.slice(0, 100) || "",
        channel_id: t.channel_id,
        board_id: t.board_id,
      });
  }
  res.json({ data });
});
const targetTables = {
  channel: "channels",
  message: "messages",
  project: "projects",
  task: "tasks",
  event: "calendar_events",
} as const;
personalActivityRouter.get("/favorite-targets", async (req, res) => {
  const kind = z
      .enum(["channel", "project", "task", "event"])
      .parse(req.query.type),
    table = targetTables[kind];
  const rows = await query(
    `SELECT t.*,w.name workspace_name FROM ${table} t JOIN workspaces w ON w.id=t.workspace_id JOIN workspace_members m ON m.workspace_id=t.workspace_id AND m.user_id=$1 AND m.state='active' JOIN roles r ON r.id=m.role_id WHERE 'VIEW_WORKSPACE'=ANY(r.permissions) ORDER BY t.id LIMIT 500`,
    [req.actor.id],
  );
  const data = [];
  for (const r of rows) {
    const t = await canReadTarget(req.actor, r.workspace_id, kind, r.id);
    if (t && !r.archived) data.push({ ...t, workspace_name: r.workspace_name });
  }
  res.json({ data });
});
personalActivityRouter.use("/favorites", async (req, res, next) => {
  let w: string | undefined;
  if (req.method === "POST") {
    const kind = z
      .enum(["channel", "message", "project", "task", "event"])
      .parse(req.body.target_type);
    const [r] = await query(
      `SELECT workspace_id FROM ${targetTables[kind]} WHERE id=$1`,
      [z.uuid().parse(req.body.target_id)],
    );
    w = r?.workspace_id;
  } else {
    const id = req.path.split("/").filter(Boolean)[0];
    if (id) {
      const [r] = await query(
        "SELECT workspace_id FROM favorites WHERE id=$1 AND user_id=$2",
        [z.uuid().parse(id), req.actor.id],
      );
      w = r?.workspace_id;
    }
  }
  assert(w, 404, "NOT_FOUND", "Favori introuvable.");
  req.workspaceId = w;
  // Restore /favorites prefix because this middleware is mounted at /favorites.
  const old = req.url;
  req.url = `/favorites${req.url}`;
  favoritesRouter(req, res, (e) => {
    req.url = old;
    next(e);
  });
});
const reminderSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().max(2000).default(""),
    remind_at: z.iso.datetime({ offset: true }),
    timezone: z.string().refine(validTimezone).default("UTC"),
    recurring: z.boolean().default(false),
    recurring_interval: z
      .enum(["daily", "weekly", "monthly"])
      .nullable()
      .default(null),
  })
  .strict();
function recurrence(b: z.infer<typeof reminderSchema>) {
  assert(
    !b.recurring || b.recurring_interval,
    400,
    "INVALID_RECURRENCE",
    "Choisissez une fréquence de répétition.",
  );
}
personalActivityRouter.get("/reminders", async (req, res) => {
  const state = z
    .enum(["all", "pending", "snoozed", "done", "dismissed"])
    .parse(req.query.state || "all");
  const own = await query(
    "SELECT * FROM personal_reminders WHERE user_id=$1 AND ($2='all' OR ($2='pending' AND state IN ('pending','snoozed')) OR ($2='done' AND state IN ('done','dismissed')) OR state=$2) ORDER BY remind_at,id LIMIT 500",
    [req.actor.id, state],
  );
  const rows = await query(
    "SELECT r.*,w.name workspace_name FROM reminders r JOIN workspaces w ON w.id=r.workspace_id JOIN workspace_members m ON m.workspace_id=r.workspace_id AND m.user_id=r.user_id AND m.state='active' WHERE r.user_id=$1 AND ($2='all' OR ($2='pending' AND r.state IN ('pending','snoozed')) OR ($2='done' AND r.state IN ('done','dismissed')) OR r.state=$2) ORDER BY r.remind_at,r.id LIMIT 500",
    [req.actor.id, state],
  );
  const data = [...own];
  for (const r of rows) {
    try {
      await humanWorkspace(req.actor, r.workspace_id);
      await reminderReferences(req.actor, r.workspace_id, r);
      data.push({ ...r, source_base: `/api/v1/workspaces/${r.workspace_id}` });
    } catch (e) {
      if (!(
        e instanceof Error &&
        "status" in e &&
        [403, 404].includes(Number(e.status))
      ))
        throw e;
    }
  }
  res.json({
    data: data
      .sort((a, b) => +new Date(a.remind_at) - +new Date(b.remind_at))
      .slice(0, 500),
  });
});
personalActivityRouter.post("/reminders", async (req, res) => {
  const b = reminderSchema.parse(req.body);
  recurrence(b);
  const [row] = await query(
    "INSERT INTO personal_reminders(user_id,title,body,remind_at,anchor_at,timezone,recurring,recurring_interval) VALUES($1,$2,$3,$4,$4,$5,$6,$7) RETURNING *",
    [
      req.actor.id,
      b.title,
      b.body,
      b.remind_at,
      b.timezone,
      b.recurring,
      b.recurring ? b.recurring_interval : null,
    ],
  );
  res.status(201).json({ data: row });
});
personalActivityRouter.patch("/reminders/:id", async (req, res, next) => {
  const id = z.uuid().parse(req.params.id);
  const [legacy] = await query(
    "SELECT workspace_id FROM reminders WHERE id=$1 AND user_id=$2",
    [id, req.actor.id],
  );
  if (legacy) {
    req.workspaceId = legacy.workspace_id;
    return remindersRouter(req, res, next);
  }
  const patch = reminderSchema
    .partial()
    .extend({
      state: z.enum(["pending", "snoozed", "done", "dismissed"]).optional(),
    })
    .strict()
    .parse(req.body);
  const row = await transaction(async (db) => {
    const [old] = await query(
      "SELECT * FROM personal_reminders WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [id, req.actor.id],
      db,
    );
    assert(old, 404, "NOT_FOUND", "Rappel introuvable.");
    const b = reminderSchema.parse({
      title: old.title,
      body: old.body,
      remind_at: old.remind_at.toISOString(),
      timezone: old.timezone,
      recurring: old.recurring,
      recurring_interval: old.recurring_interval,
      ...Object.fromEntries(
        Object.entries(patch).filter(([k]) => k !== "state"),
      ),
    });
    recurrence(b);
    const state = patch.state || old.state;
    assert(
      state !== "snoozed" || Date.parse(b.remind_at) > Date.now(),
      400,
      "INVALID_DATE",
      "Reportez le rappel à une date future.",
    );
    const [row] = await query(
      "UPDATE personal_reminders SET title=$3,body=$4,remind_at=$5,timezone=$6,recurring=$7,recurring_interval=$8,state=$9,anchor_at=$10,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
      [
        id,
        req.actor.id,
        b.title,
        b.body,
        b.remind_at,
        b.timezone,
        b.recurring,
        b.recurring ? b.recurring_interval : null,
        state,
        patch.state !== "snoozed" &&
        (patch.remind_at || patch.timezone || patch.recurring_interval)
          ? b.remind_at
          : old.anchor_at,
      ],
      db,
    );
    return row;
  });
  res.json({ data: row });
});
personalActivityRouter.delete("/reminders/:id", async (req, res, next) => {
  const id = z.uuid().parse(req.params.id);
  const [legacy] = await query(
    "SELECT workspace_id FROM reminders WHERE id=$1 AND user_id=$2",
    [id, req.actor.id],
  );
  if (legacy) {
    req.workspaceId = legacy.workspace_id;
    return remindersRouter(req, res, next);
  }
  const rows = await query(
    "DELETE FROM personal_reminders WHERE id=$1 AND user_id=$2 RETURNING id",
    [id, req.actor.id],
  );
  assert(rows.length, 404, "NOT_FOUND", "Rappel introuvable.");
  res.json({ ok: true });
});
personalActivityRouter.get("/conversations", async (req, res) => {
  const friends = await query(
    `SELECT u.id,u.name,u.avatar,u.status,'friend' kind,(SELECT content FROM friend_messages fm WHERE (fm.sender_id=$1 AND fm.recipient_id=u.id) OR (fm.sender_id=u.id AND fm.recipient_id=$1) ORDER BY created_at DESC,id DESC LIMIT 1) last_message,(SELECT count(*)::int FROM friend_messages fm WHERE fm.sender_id=u.id AND fm.recipient_id=$1 AND fm.read_at IS NULL) unread_count FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END WHERE (f.user_a=$1 OR f.user_b=$1) AND NOT u.disabled ORDER BY u.name LIMIT 500`,
    [req.actor.id],
  );
  const legacy = await query(
    `SELECT c.*,'workspace' kind,w.name workspace_name FROM channels c JOIN workspaces w ON w.id=c.workspace_id JOIN workspace_members m ON m.workspace_id=c.workspace_id AND m.user_id=$1 AND m.state='active' JOIN roles r ON r.id=m.role_id WHERE c.is_dm AND NOT c.archived AND ${visibleChannel("c", "$1", "r.permissions")} ORDER BY c.name LIMIT 500`,
    [req.actor.id],
  );
  res.json({ data: [...friends, ...legacy] });
});
