// src/server/reminders.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
export const remindersRouter = Router({ mergeParams: true });

const reminderSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(2000).default(""),
  remind_at: z.string(),
  channel_id: z.string().uuid().nullable().optional(),
  message_id: z.string().uuid().nullable().optional(),
  task_id: z.string().uuid().nullable().optional(),
  recurring: z.boolean().default(false),
  recurring_interval: z
    .enum(["daily", "weekly", "monthly"])
    .nullable()
    .optional(),
});

remindersRouter.get("/reminders", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const state = z
    .enum(["all", "pending", "snoozed", "done", "dismissed"])
    .default("all")
    .parse(req.query.state || "all");
  const filter = state === "all" ? "" : `AND r.state='${state}'`;
  const rows = await query(
    `SELECT r.*,u.name user_name FROM reminders r JOIN users u ON u.id=r.user_id WHERE r.workspace_id=$1 AND r.user_id=$2${filter} ORDER BY r.remind_at ASC`,
    [w, req.actor.id],
  );
  res.json({ data: rows });
});

remindersRouter.post("/reminders", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const b = reminderSchema.parse(req.body);
  assert(b.title, 400, "VALIDATION_ERROR", "Titre requis.");
  const [row] = await query(
    `INSERT INTO reminders(workspace_id,user_id,title,body,remind_at,channel_id,message_id,task_id,recurring,recurring_interval) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      w,
      req.actor.id,
      b.title,
      b.body,
      b.remind_at,
      b.channel_id || null,
      b.message_id || null,
      b.task_id || null,
      b.recurring,
      b.recurring_interval || null,
    ],
  );
  res.status(201).json({ data: row });
});

remindersRouter.patch("/reminders/:id", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const id = z.string().uuid().parse(req.params.id);
  const { state, remind_at } = z
    .object({
      state: z.enum(["pending", "snoozed", "done", "dismissed"]).optional(),
      remind_at: z.string().optional(),
    })
    .parse(req.body);
  const sets: string[] = ["updated_at=now()"];
  const vals: unknown[] = [];
  let i = 1;
  if (state) {
    sets.push(`state=$${++i}`);
    vals.push(state);
  }
  if (remind_at) {
    sets.push(`remind_at=$${++i}`);
    vals.push(remind_at);
  }
  vals.push(id, w, req.actor.id);
  const [row] = await query(
    `UPDATE reminders SET ${sets.join(", ")} WHERE id=$${++i} AND workspace_id=$${++i} AND user_id=$${++i} RETURNING *`,
    vals,
  );
  assert(row, 404, "NOT_FOUND", "Rappel introuvable.");
  res.json({ data: row });
});

remindersRouter.delete("/reminders/:id", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const id = z.string().uuid().parse(req.params.id);
  await query(
    "DELETE FROM reminders WHERE id=$1 AND workspace_id=$2 AND user_id=$3",
    [id, w, req.actor.id],
  );
  res.json({ ok: true });
});
