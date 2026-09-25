// src/server/favorites.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert } from "./errors.js";
import {
  humanWorkspace,
  targetAccess,
  canReadTarget,
} from "./experience-access.js";
import { emit } from "./events.js";
export const favoritesRouter = Router({ mergeParams: true });
const kinds = z.enum([
  "channel",
  "message",
  "page",
  "task",
  "event",
  "project",
]);
favoritesRouter.get("/favorites", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  const rows = await query(
    "SELECT * FROM favorites WHERE workspace_id=$1 AND user_id=$2 ORDER BY position,created_at LIMIT 500",
    [w, req.actor.id],
  );
  const data = [];
  for (const r of rows) {
    const target = await canReadTarget(
      req.actor,
      w,
      r.target_type,
      r.target_id,
    );
    if (target)
      data.push({
        ...r,
        target_name:
          target.title || target.name || target.content?.slice(0, 100) || "",
        channel_id: target.channel_id,
        board_id: target.board_id,
      });
  }
  res.json({ data });
});
favoritesRouter.post("/favorites", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  const b = z
    .object({
      target_type: kinds,
      target_id: z.uuid(),
      label: z.string().max(200).default(""),
    })
    .strict()
    .parse(req.body);
  await targetAccess(req.actor, w, b.target_type, b.target_id);
  const row = await transaction(async (db) => {
    await query(
      "SELECT id FROM users WHERE id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    const [pos] = await query(
      "SELECT count(*) n,COALESCE(max(position),0)+1 pos FROM favorites WHERE workspace_id=$1 AND user_id=$2",
      [w, req.actor.id],
      db,
    );
    assert(
      Number(pos.n) < 500,
      409,
      "FAVORITES_LIMIT",
      "Limite de 500 favoris atteinte.",
    );
    const [row] = await query(
      "INSERT INTO favorites(workspace_id,user_id,target_type,target_id,label,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,user_id,target_type,target_id) DO UPDATE SET label=EXCLUDED.label RETURNING *",
      [w, req.actor.id, b.target_type, b.target_id, b.label, pos.pos],
      db,
    );
    await emit(w, "favorite.updated", req.actor.id, {}, db);
    return row;
  });
  res.status(201).json({ data: row });
});
favoritesRouter.patch("/favorites/:id", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  const b = z
    .object({
      position: z.number().int().min(0).max(100000).optional(),
      label: z.string().max(200).optional(),
    })
    .strict()
    .parse(req.body);
  const rows = await query(
    "UPDATE favorites SET position=COALESCE($4,position),label=COALESCE($5,label) WHERE id=$1 AND workspace_id=$2 AND user_id=$3 RETURNING *",
    [
      z.uuid().parse(req.params.id),
      w,
      req.actor.id,
      b.position ?? null,
      b.label ?? null,
    ],
  );
  assert(rows.length, 404, "NOT_FOUND", "Favori introuvable.");
  res.json({ data: rows[0] });
});
favoritesRouter.delete("/favorites/:id", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  const rows = await query(
    "DELETE FROM favorites WHERE id=$1 AND workspace_id=$2 AND user_id=$3 RETURNING id",
    [z.uuid().parse(req.params.id), w, req.actor.id],
  );
  assert(rows.length, 404, "NOT_FOUND", "Favori introuvable.");
  res.json({ ok: true });
});
