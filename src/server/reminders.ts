// src/server/reminders.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert } from "./errors.js";
import { emit } from "./events.js";
import { humanWorkspace, reminderReferences } from "./experience-access.js";
import { timezoneSchema } from "./calendar.js";
export const remindersRouter = Router({ mergeParams: true });
const fields = {
  title: z.string().trim().min(1).max(200),
  body: z.string().max(2000),
  remind_at: z.iso.datetime({ offset: true }),
  timezone: timezoneSchema,
  channel_id: z.uuid().nullable(),
  message_id: z.uuid().nullable(),
  task_id: z.uuid().nullable(),
  recurring: z.boolean(),
  recurring_interval: z.enum(["daily", "weekly", "monthly"]).nullable(),
};
const schema = z.object(fields).strict();
function validateRecurrence(b: {
  recurring: boolean;
  recurring_interval: string | null;
}) {
  assert(
    !b.recurring || b.recurring_interval,
    400,
    "INVALID_RECURRENCE",
    "Choisissez la fréquence du rappel.",
  );
}
remindersRouter.get("/reminders", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  const state = z
    .enum(["all", "pending", "snoozed", "done", "dismissed"])
    .parse(req.query.state || "all");
  const rows = await query(
    `SELECT * FROM reminders WHERE workspace_id=$1 AND user_id=$2 AND ($3='all' OR ($3='pending' AND state IN ('pending','snoozed')) OR ($3='done' AND state IN ('done','dismissed')) OR state=$3) ORDER BY remind_at,id LIMIT 500`,
    [w, req.actor.id, state],
  );
  const data = [];
  for (const row of rows) {
    try {
      await reminderReferences(req.actor, w, row);
      data.push(row);
    } catch (e) {
      if (!(
        e instanceof Error &&
        "status" in e &&
        [403, 404].includes(Number(e.status))
      ))
        throw e;
    }
  }
  res.json({ data });
});
remindersRouter.post("/reminders", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  const b = schema.parse({
    body: "",
    timezone: "UTC",
    channel_id: null,
    message_id: null,
    task_id: null,
    recurring: false,
    recurring_interval: null,
    ...req.body,
  });
  validateRecurrence(b);
  const channel = await reminderReferences(req.actor, w, b);
  const row = await transaction(async (db) => {
    const [row] = await query(
      `INSERT INTO reminders(workspace_id,user_id,title,body,remind_at,anchor_at,timezone,channel_id,message_id,task_id,recurring,recurring_interval) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        w,
        req.actor.id,
        b.title,
        b.body,
        b.remind_at,
        b.timezone,
        channel,
        b.message_id,
        b.task_id,
        b.recurring,
        b.recurring ? b.recurring_interval : null,
      ],
      db,
    );
    await emit(w, "reminder.updated", req.actor.id, {}, db);
    return row;
  });
  res.status(201).json({ data: row });
});
remindersRouter.patch("/reminders/:id", async (req, res) => {
  const w = req.workspaceId,
    id = z.uuid().parse(req.params.id);
  await humanWorkspace(req.actor, w);
  const patch = schema
    .partial()
    .extend({
      state: z.enum(["pending", "snoozed", "done", "dismissed"]).optional(),
    })
    .strict()
    .parse(req.body);
  const row = await transaction(async (db) => {
    const [old] = await query(
      "SELECT * FROM reminders WHERE id=$1 AND workspace_id=$2 AND user_id=$3 FOR UPDATE",
      [id, w, req.actor.id],
      db,
    );
    assert(old, 404, "NOT_FOUND", "Rappel introuvable.");
    const picked = Object.fromEntries(
      Object.keys(fields).map((k) => [k, old[k]]),
    );
    const b = {
      ...schema.parse({
        ...picked,
        remind_at: old.remind_at.toISOString(),
        ...Object.fromEntries(
          Object.entries(patch).filter(([k]) => k !== "state"),
        ),
      }),
      state: patch.state || old.state,
    };
    validateRecurrence(b);
    const channel = await reminderReferences(req.actor, w, b, db);
    assert(
      b.state !== "snoozed" || Date.parse(b.remind_at) > Date.now(),
      400,
      "INVALID_DATE",
      "Reportez le rappel à une date future.",
    );
    const resetAnchor =
      patch.state !== "snoozed" &&
      (patch.remind_at !== undefined ||
        patch.timezone !== undefined ||
        patch.recurring_interval !== undefined);
    const [row] = await query(
      `UPDATE reminders SET title=$4,body=$5,remind_at=$6,timezone=$7,channel_id=$8,message_id=$9,task_id=$10,recurring=$11,recurring_interval=$12,state=$13,anchor_at=$14,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 RETURNING *`,
      [
        id,
        w,
        req.actor.id,
        b.title,
        b.body,
        b.remind_at,
        b.timezone,
        channel,
        b.message_id,
        b.task_id,
        b.recurring,
        b.recurring ? b.recurring_interval : null,
        b.state,
        resetAnchor ? b.remind_at : old.anchor_at,
      ],
      db,
    );
    await emit(w, "reminder.updated", req.actor.id, {}, db);
    return row;
  });
  res.json({ data: row });
});
remindersRouter.delete("/reminders/:id", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  await transaction(async (db) => {
    const rows = await query(
      "DELETE FROM reminders WHERE id=$1 AND workspace_id=$2 AND user_id=$3 RETURNING id",
      [z.uuid().parse(req.params.id), w, req.actor.id],
      db,
    );
    assert(rows.length, 404, "NOT_FOUND", "Rappel introuvable.");
    await emit(w, "reminder.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
