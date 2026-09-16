// src/server/storage.ts
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { query } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
import { audit } from "./events.js";
import { channelAccess, granted, visibleChannel } from "./access.js";
import { imageMime } from "./previews.js";
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export class LocalStorage implements StorageProvider {
  root = path.resolve(process.env.UPLOAD_DIR || "uploads");
  file(key: string) {
    assert(/^[a-f0-9-]{36}$/.test(key), 400, "INVALID_KEY", "Clé invalide.");
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.file(key), data, { mode: 0o600, flag: "wx" });
  }
  get(key: string) {
    return readFile(this.file(key));
  }
  delete(key: string) {
    return unlink(this.file(key));
  }
}
export const storage = new LocalStorage();
export const storageRouter = Router({ mergeParams: true });
storageRouter.get("/attachments", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  res.json({
    data: await query(
      `SELECT a.id,a.name,a.mime,a.size,a.created_at FROM attachments a WHERE workspace_id=$1 AND (a.task_id IS NULL OR 'VIEW_BOARD'=ANY($3::text[])) AND (a.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=a.channel_id AND ${visibleChannel()})) ORDER BY created_at DESC LIMIT 100`,
      [w, req.actor.id, await granted(req.actor, w)],
    ),
  });
});
storageRouter.post("/attachments", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(
    req.actor,
    w,
    req.body.task_id ? "MANAGE_TASK" : "SEND_MESSAGE",
  );
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const b = z
    .object({
      name: z.string().min(1).max(150),
      data: z.string().max(1400000),
      channel_id: z.uuid().nullable().default(null),
      task_id: z.uuid().nullable().default(null),
    })
    .parse(req.body);
  assert(
    !(b.channel_id && b.task_id),
    400,
    "INVALID_FILE_SCOPE",
    "Choisissez un salon ou une tâche.",
  );
  if (b.task_id) {
    const [task] = await query(
      "SELECT id FROM tasks WHERE id=$1 AND workspace_id=$2",
      [b.task_id, w],
    );
    assert(task, 404, "NOT_FOUND", "Tâche introuvable.");
  }
  if (b.channel_id) await channelAccess(req.actor, w, b.channel_id);
  const bytes = Buffer.from(b.data, "base64");
  assert(
    bytes.length > 0 && bytes.length <= 1000000,
    400,
    "FILE_TOO_LARGE",
    "Maximum 1 Mo.",
  );
  const mime = imageMime(bytes) || "application/octet-stream";
  const key = randomUUID();
  await storage.put(key, bytes);
  try {
    const [row] = await query(
      "INSERT INTO attachments(workspace_id,user_id,name,mime,size,storage_key,channel_id,task_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,mime,size",
      [
        w,
        req.actor.id,
        b.name,
        mime,
        bytes.length,
        key,
        b.channel_id,
        b.task_id,
      ],
    );
    res.status(201).json({ data: row });
  } catch (e) {
    await storage.delete(key);
    throw e;
  }
});
storageRouter.get("/attachments/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const [file] = await query(
    "SELECT * FROM attachments WHERE workspace_id=$1 AND id=$2",
    [w, z.uuid().parse(req.params.id)],
  );
  assert(file, 404, "NOT_FOUND", "Fichier introuvable.");
  if (file.task_id) await authorize(req.actor, w, "VIEW_BOARD");
  if (file.channel_id) await channelAccess(req.actor, w, file.channel_id);
  if (req.query.metadata === "true") {
    res.json({
      data: { id: file.id, name: file.name, mime: file.mime, size: file.size },
    });
    return;
  }
  res
    .set("Content-Type", file.mime)
    .set(
      "Content-Disposition",
      `${file.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    )
    .send(await storage.get(file.storage_key));
});
storageRouter.get("/emojis", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_CHANNEL");
  res.json({
    data: await query("SELECT * FROM custom_emojis WHERE workspace_id=$1", [w]),
  });
});
storageRouter.post("/emojis", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_EMOJIS");
  const b = z
    .object({
      name: z.string().regex(/^[a-z0-9_]{2,30}$/),
      attachment_id: z.uuid(),
    })
    .parse(req.body);
  const [a] = await query(
    "SELECT id FROM attachments WHERE id=$1 AND workspace_id=$2 AND mime LIKE 'image/%' AND size<=256000 AND channel_id IS NULL",
    [b.attachment_id, w],
  );
  assert(a, 400, "INVALID_IMAGE", "Image PNG, JPEG ou WebP de 256 Ko maximum.");
  const [row] = await query(
    "INSERT INTO custom_emojis(workspace_id,name,attachment_id) VALUES($1,$2,$3) RETURNING *",
    [w, b.name, b.attachment_id],
  );
  await audit(w, req.actor.id, "emoji.created", row.id);
  res.status(201).json({ data: row });
});
storageRouter.patch("/emojis/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_EMOJIS");
  const b = z
    .object({ name: z.string().regex(/^[a-z0-9_]{2,30}$/) })
    .parse(req.body);
  await query(
    "UPDATE custom_emojis SET name=$3 WHERE id=$1 AND workspace_id=$2",
    [z.uuid().parse(req.params.id), w, b.name],
  );
  await audit(w, req.actor.id, "emoji.renamed", String(req.params.id));
  res.json({ ok: true });
});
storageRouter.delete("/emojis/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_EMOJIS");
  await query("DELETE FROM custom_emojis WHERE workspace_id=$1 AND id=$2", [
    w,
    z.uuid().parse(req.params.id),
  ]);
  await audit(w, req.actor.id, "emoji.deleted", String(req.params.id));
  res.json({ ok: true });
});

export const avatarRouter = Router();
avatarRouter.post("/me/avatar", async (req, res) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const { data } = z.object({ data: z.string().max(1400000) }).parse(req.body);
  const bytes = Buffer.from(data, "base64"),
    mime = imageMime(bytes);
  assert(
    mime && bytes.length <= 1_000_000,
    400,
    "INVALID_IMAGE",
    "Image PNG, JPEG, WebP ou GIF de 1 Mo maximum.",
  );
  const key = randomUUID();
  await storage.put(key, bytes);
  const [old] = await query(
    "UPDATE users SET avatar_key=$2,avatar_mime=$3,avatar=$4 WHERE id=$1 RETURNING id",
    [req.actor.id, key, mime, `/api/v1/avatars/${req.actor.id}?v=${key}`],
  );
  assert(old, 404, "NOT_FOUND", "Utilisateur introuvable.");
  res.json({ ok: true });
});
avatarRouter.get("/avatars/:id", async (req, res) => {
  const [u] = await query(
    "SELECT avatar_key,avatar_mime FROM users WHERE id=$1 AND NOT disabled",
    [z.uuid().parse(req.params.id)],
  );
  assert(u?.avatar_key, 404, "NOT_FOUND", "Avatar introuvable.");
  res.type(u.avatar_mime).send(await storage.get(u.avatar_key));
});
