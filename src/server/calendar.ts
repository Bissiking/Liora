// src/server/calendar.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "./db.js";
import { authorize } from "./auth.js";
import { assert, HttpError } from "./errors.js";
export const calendarRouter = Router({ mergeParams: true });

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(""),
  start_at: z.string(),
  end_at: z.string().optional(),
  all_day: z.boolean().default(false),
  recurrence: z
    .enum(["none", "daily", "weekly", "monthly", "yearly"])
    .default("none"),
  channel_id: z.string().uuid().nullable().optional(),
  color: z.string().max(20).default(""),
  reminder_minutes: z.number().int().min(0).max(10080).nullable().optional(),
});

calendarRouter.get("/calendar", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const start = z
    .string()
    .parse(req.query.start || new Date().toISOString().slice(0, 10));
  const end = z
    .string()
    .parse(
      req.query.end ||
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    );
  const rows = await query(
    `SELECT c.*,u.name author_name FROM calendar_events c JOIN users u ON u.id=c.user_id WHERE c.workspace_id=$1 AND c.start_at::date >= $2::date AND c.start_at::date <= $3::date ORDER BY c.start_at`,
    [w, start, end],
  );
  res.json({ data: rows });
});

calendarRouter.post("/calendar", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "CREATE_CHANNEL");
  const b = eventSchema.parse(req.body);
  assert(b.title, 400, "VALIDATION_ERROR", "Titre requis.");
  const [row] = await query(
    `INSERT INTO calendar_events(workspace_id,user_id,title,description,start_at,"end",all_day,recurrence,channel_id,color,reminder_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      w,
      req.actor.id,
      b.title,
      b.description,
      b.start_at,
      b.end_at || null,
      b.all_day,
      b.recurrence,
      b.channel_id || null,
      b.color,
      b.reminder_minutes ?? null,
    ],
  );
  res.status(201).json({ data: row });
});

calendarRouter.patch("/calendar/:id", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "CREATE_CHANNEL");
  const id = z.string().uuid().parse(req.params.id);
  const existing = await query(
    "SELECT * FROM calendar_events WHERE id=$1 AND workspace_id=$2",
    [id, w],
  );
  assert(existing.length, 404, "NOT_FOUND", "Événement introuvable.");
  const b = eventSchema.partial().parse(req.body);
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    if (v !== undefined) {
      fields.push(`${k}=$${++i}`);
      values.push(v);
    }
  }
  fields.push(`updated_at=now()`);
  values.push(id, w);
  const [row] = await query(
    `UPDATE calendar_events SET ${fields.join(", ")} WHERE id=$${++i} AND workspace_id=$${++i} RETURNING *`,
    values,
  );
  res.json({ data: row });
});

calendarRouter.delete("/calendar/:id", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "CREATE_CHANNEL");
  const id = z.string().uuid().parse(req.params.id);
  await query(
    "DELETE FROM calendar_events WHERE id=$1 AND workspace_id=$2",
    [id, w],
  );
  res.json({ ok: true });
});
