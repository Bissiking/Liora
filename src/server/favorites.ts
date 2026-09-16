// src/server/favorites.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
export const favoritesRouter = Router({ mergeParams: true });

favoritesRouter.get("/favorites", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const rows = await query(
    `SELECT f.*,
      CASE f.target_type
        WHEN 'channel' THEN (SELECT name FROM channels WHERE id=f.target_id)
        WHEN 'page' THEN (SELECT title FROM pages WHERE id=f.target_id)
        WHEN 'task' THEN (SELECT title FROM tasks WHERE id=f.target_id)
        WHEN 'event' THEN (SELECT title FROM calendar_events WHERE id=f.target_id)
        ELSE ''
      END AS target_name
    FROM favorites f WHERE f.workspace_id=$1 AND f.user_id=$2 ORDER BY f.position,f.created_at`,
    [w, req.actor.id],
  );
  res.json({ data: rows });
});

favoritesRouter.post("/favorites", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const b = z
    .object({
      target_type: z.enum(["channel", "message", "page", "task", "event"]),
      target_id: z.string().uuid(),
      label: z.string().max(200).default(""),
    })
    .parse(req.body);
  const maxPos = await query(
    "SELECT COALESCE(MAX(position),0)+1 pos FROM favorites WHERE workspace_id=$1 AND user_id=$2",
    [w, req.actor.id],
  );
  const [row] = await query(
    `INSERT INTO favorites(workspace_id,user_id,target_type,target_id,label,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,user_id,target_type,target_id) DO UPDATE SET label=EXCLUDED.label RETURNING *`,
    [w, req.actor.id, b.target_type, b.target_id, b.label, maxPos[0].pos],
  );
  res.status(201).json({ data: row });
});

favoritesRouter.patch("/favorites/:id", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const id = z.string().uuid().parse(req.params.id);
  const { position, label } = z
    .object({ position: z.number().int().optional(), label: z.string().optional() })
    .parse(req.body);
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (position !== undefined) {
    sets.push(`position=$${++i}`);
    vals.push(position);
  }
  if (label !== undefined) {
    sets.push(`label=$${++i}`);
    vals.push(label);
  }
  if (!sets.length) return res.json({ ok: true });
  vals.push(id, w, req.actor.id);
  await query(
    `UPDATE favorites SET ${sets.join(", ")} WHERE id=$${++i} AND workspace_id=$${++i} AND user_id=$${++i}`,
    vals,
  );
  res.json({ ok: true });
});

favoritesRouter.delete("/favorites/:id", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const id = z.string().uuid().parse(req.params.id);
  await query(
    "DELETE FROM favorites WHERE id=$1 AND workspace_id=$2 AND user_id=$3",
    [id, w, req.actor.id],
  );
  res.json({ ok: true });
});
