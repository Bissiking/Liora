// src/server/resources.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
import { audit, emit } from "./events.js";
import type { Permission } from "../shared/permissions.js";
import { channelAccess, granted, visibleChannel } from "./access.js";
import { randomUUID } from "node:crypto";
import { mergeBlocks, type Block } from "../shared/page-merge.js";
const name = z.string().trim().min(1).max(100),
  uuid = z.uuid(),
  text = z.string().max(12000);
const task = z
  .object({
    title: name,
    description: text.default(""),
    column_id: uuid,
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    tags: z.array(z.string().max(30)).max(12).default([]),
    assignee: uuid.nullable().default(null),
    participants: z.array(uuid).max(100).default([]),
    attachment_ids: z.array(uuid).max(50).default([]),
    due_at: z.iso.datetime().nullable().default(null),
    position: z.number().finite().default(0),
    checklist: z
      .array(z.object({ text: z.string().max(300), done: z.boolean() }))
      .max(50)
      .default([]),
    links: z
      .array(
        z.object({
          label: name,
          url: z.url().refine((s) => /^https?:/.test(s)),
        }),
      )
      .max(20)
      .default([]),
  })
  .strict();
const resources: Record<
  string,
  {
    table: string;
    read: Permission;
    create: Permission;
    manage: Permission;
    schema: z.ZodObject;
    json?: string[];
  }
> = {
  categories: {
    table: "categories",
    read: "VIEW_CHANNEL",
    create: "CREATE_CHANNEL",
    manage: "MANAGE_CHANNEL",
    schema: z.object({ name, position: z.number().int().default(0) }).strict(),
  },
  channels: {
    table: "channels",
    read: "VIEW_CHANNEL",
    create: "CREATE_CHANNEL",
    manage: "MANAGE_CHANNEL",
    schema: z
      .object({
        name: name.refine((n) => !n.includes("/")),
        description: text.default(""),
        category_id: uuid.nullable().default(null),
        project_id: uuid.nullable().default(null),
        type: z
          .enum(["text", "announcement", "project", "monitoring"])
          .default("text"),
        position: z.number().int().default(0),
        archived: z.boolean().default(false),
        is_private: z.boolean().default(false),
      })
      .strict(),
  },
  projects: {
    table: "projects",
    read: "VIEW_PROJECT",
    create: "CREATE_PROJECT",
    manage: "MANAGE_PROJECT",
    schema: z
      .object({
        name,
        description: text.default(""),
        archived: z.boolean().default(false),
      })
      .strict(),
  },
  boards: {
    table: "boards",
    read: "VIEW_BOARD",
    create: "CREATE_BOARD",
    manage: "MANAGE_BOARD",
    schema: z
      .object({
        name,
        project_id: uuid.nullable().default(null),
        archived: z.boolean().default(false),
      })
      .strict(),
  },
  columns: {
    table: "board_columns",
    read: "VIEW_BOARD",
    create: "MANAGE_BOARD",
    manage: "MANAGE_BOARD",
    schema: z
      .object({ name, board_id: uuid, position: z.number().int().default(0) })
      .strict(),
  },
  tasks: {
    table: "tasks",
    read: "VIEW_BOARD",
    create: "CREATE_TASK",
    manage: "MANAGE_TASK",
    schema: task,
    json: ["checklist", "links"],
  },
  templates: {
    table: "task_templates",
    read: "VIEW_BOARD",
    create: "CREATE_TASK",
    manage: "MANAGE_TASK",
    schema: z
      .object({
        name,
        description: text.default(""),
        checklist: task.shape.checklist,
        tags: task.shape.tags,
        priority: task.shape.priority,
      })
      .strict(),
    json: ["checklist"],
  },
  pages: {
    table: "pages",
    read: "VIEW_PAGES",
    create: "MANAGE_PAGES",
    manage: "MANAGE_PAGES",
    schema: z
      .object({
        title: name,
        project_id: uuid.nullable().default(null),
        blocks: z
          .array(
            z.object({
              id: uuid.optional(),
              type: z.enum([
                "text",
                "heading",
                "list",
                "checklist",
                "code",
                "quote",
                "divider",
                "link",
                "board",
                "message",
                "stats",
                "integration",
              ]),
              content: z.string().max(12000),
              checked: z.boolean().optional(),
            }),
          )
          .max(200)
          .default([]),
      })
      .strict(),
    json: ["blocks"],
  },
};
export const resourceRouter = Router({ mergeParams: true });
resourceRouter.all("/:resource{/:id}", async (req, res, next) => {
  const resource = String(req.params.resource),
    config = resources[resource];
  if (!config) return next();
  const workspace = uuid.parse(req.workspaceId),
    id = req.params.id ? uuid.parse(req.params.id) : undefined;
  const method = req.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) return next();
  await authorize(
    req.actor,
    workspace,
    method === "GET"
      ? config.read
      : method === "POST"
        ? config.create
        : resource === "channels" && method === "DELETE"
          ? "DELETE_CHANNEL"
          : config.manage,
  );
  if (resource === "channels" && id) {
    const ch = await channelAccess(req.actor, workspace, id);
    if (ch.is_dm && method !== "GET")
      assert(
        false,
        403,
        "DM_PROTECTED",
        "Une conversation privée ne peut pas être reconfigurée comme un salon.",
      );
  }
  if (method === "GET") {
    const after = req.query.after ? uuid.parse(req.query.after) : null;
    const limit = req.query.limit
      ? z.coerce.number().int().min(1).max(500).parse(req.query.limit)
      : 500;
    let rows;
    if (resource === "channels")
      rows = await query(
        `SELECT c.* FROM channels c WHERE c.workspace_id=$1 AND ${visibleChannel()} AND ($4::uuid IS NULL OR c.id>$4) ${id ? "AND c.id=$6" : ""} ORDER BY c.id LIMIT $5`,
        [
          workspace,
          req.actor.id,
          await granted(req.actor, workspace),
          after,
          limit + 1,
          ...(id ? [id] : []),
        ],
      );
    else
      rows = await query(
        `SELECT * FROM ${config.table} WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id>$2) ${id ? "AND id=$4" : ""} ORDER BY id LIMIT $3`,
        [workspace, after, limit + 1, ...(id ? [id] : [])],
      );
    const more = rows.length > limit;
    rows = rows.slice(0, limit);
    return res.json({
      data: id ? rows[0] || null : rows,
      nextCursor: !id && more ? rows.at(-1)?.id : null,
    });
  }
  if (method === "DELETE") {
    assert(id, 400, "ID_REQUIRED", "Identifiant requis.");
    if (resource === "projects") {
      await authorize(req.actor, workspace, "MANAGE_BOARD");
      await authorize(req.actor, workspace, "MANAGE_TASK");
    }
    if (resource === "boards")
      await authorize(req.actor, workspace, "MANAGE_TASK");
    await transaction(async (db) => {
      const [target] = await query(
        `SELECT id FROM ${config.table} WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
        [id, workspace],
        db,
      );
      assert(target, 404, "NOT_FOUND", "Élément introuvable.");
      if (["projects", "boards", "tasks", "columns"].includes(resource)) {
        const boardIds =
          resource === "projects"
            ? (
                await query(
                  "SELECT id FROM boards WHERE workspace_id=$1 AND project_id=$2",
                  [workspace, id],
                  db,
                )
              ).map((r) => r.id)
            : resource === "boards"
              ? [id]
              : [];
        const tasks =
          resource === "tasks"
            ? [id]
            : (
                await query(
                  `SELECT id FROM tasks WHERE workspace_id=$1 AND column_id IN (SELECT id FROM board_columns WHERE ${resource === "columns" ? "id=$2" : "board_id=ANY($2::uuid[])"})`,
                  [workspace, resource === "columns" ? id : boardIds],
                  db,
                )
              ).map((r) => r.id);
        await query(
          "DELETE FROM task_comments WHERE task_id=ANY($1::uuid[])",
          [tasks],
          db,
        );
        await query(
          "DELETE FROM attachments WHERE task_id=ANY($1::uuid[])",
          [tasks],
          db,
        );
        await query(
          "DELETE FROM tasks WHERE id=ANY($1::uuid[]) AND workspace_id=$2",
          [tasks, workspace],
          db,
        );
        if (resource !== "tasks") {
          await query(
            `DELETE FROM integration_rules WHERE workspace_id=$1 AND column_id IN (SELECT id FROM board_columns WHERE workspace_id=$1 AND ${resource === "columns" ? "id=$2" : "board_id=ANY($2::uuid[])"})`,
            [workspace, resource === "columns" ? id : boardIds],
            db,
          );
        }
        if (boardIds.length) {
          await query(
            "DELETE FROM board_columns WHERE board_id=ANY($1::uuid[]) AND workspace_id=$2",
            [boardIds, workspace],
            db,
          );
          await query(
            "DELETE FROM boards WHERE id=ANY($1::uuid[]) AND workspace_id=$2",
            [boardIds, workspace],
            db,
          );
        }
        if (resource === "projects") {
          await query(
            "UPDATE channels SET project_id=NULL WHERE project_id=$1 AND workspace_id=$2",
            [id, workspace],
            db,
          );
          await query(
            "UPDATE pages SET project_id=NULL WHERE project_id=$1 AND workspace_id=$2",
            [id, workspace],
            db,
          );
        }
      }
      if (resource === "channels") {
        await query(
          "UPDATE channels SET archived=true WHERE id=$1 AND workspace_id=$2",
          [id, workspace],
          db,
        );
      } else {
        await query(
          `DELETE FROM ${config.table} WHERE id=$1 AND workspace_id=$2`,
          [id, workspace],
          db,
        );
      }
      await audit(workspace, req.actor.id, `${resource}.deleted`, id, db);
      await emit(workspace, `${resource}.updated`, req.actor.id, { id }, db);
    });
    return res.json({ ok: true });
  }
  assert(method !== "PATCH" || id, 400, "ID_REQUIRED", "Identifiant requis.");
  const expectedRevision =
    (resource === "pages" ||
      (resource === "tasks" && req.body.revision !== undefined)) &&
    method === "PATCH"
      ? z.number().int().positive().parse(req.body.revision)
      : null;
  const input = expectedRevision
    ? Object.fromEntries(
        Object.entries(req.body).filter(
          ([k]) => k !== "revision" && k !== "base_blocks",
        ),
      )
    : req.body;
  const parsed =
    method === "PATCH"
      ? config.schema.partial().parse(input)
      : config.schema.parse(input);
  const body =
    method === "PATCH"
      ? Object.fromEntries(
          Object.entries(parsed).filter(([key]) =>
            Object.prototype.hasOwnProperty.call(input, key),
          ),
        )
      : parsed;
  if (resource === "channels" && body.type === "monitoring")
    await authorize(req.actor, workspace, "MANAGE_MONITORING");
  if (resource === "pages" && body.blocks)
    body.blocks = (body.blocks as Block[]).map((b) => ({
      ...b,
      id: b.id || randomUUID(),
    }));
  const keys = Object.keys(body);
  assert(keys.length, 400, "EMPTY_PATCH", "Aucune modification.");
  const row = await transaction(async (db) => {
    if (expectedRevision) {
      const [current] = await query(
        `SELECT * FROM ${config.table} WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
        [id, workspace],
        db,
      );
      assert(current, 404, "NOT_FOUND", "Élément introuvable.");
      if (current.revision !== expectedRevision) {
        const base =
          resource === "pages" && req.body.base_blocks
            ? resources.pages.schema.shape.blocks.parse(req.body.base_blocks)
            : null;
        const merged =
          base && body.blocks
            ? mergeBlocks(
                base as Block[],
                body.blocks as Block[],
                current.blocks,
              )
            : null;
        assert(
          merged && keys.every((k) => k === "blocks"),
          409,
          "REVISION_CONFLICT",
          "Le même contenu a changé. Votre brouillon est conservé : copiez-le ou rechargez la version publiée.",
        );
        body.blocks = merged;
      }
      if (resource === "pages")
        await query(
          "INSERT INTO page_revisions(page_id,revision,title,blocks,actor) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [
            id,
            current.revision,
            current.title,
            JSON.stringify(current.blocks),
            req.actor.id,
          ],
          db,
        );
    }
    if (body.participants) {
      const ids = body.participants as string[];
      const valid = await query(
        "SELECT user_id FROM workspace_members WHERE workspace_id=$1 AND user_id=ANY($2::uuid[]) AND state='active'",
        [workspace, ids],
        db,
      );
      assert(
        valid.length === new Set(ids).size,
        400,
        "INVALID_PARTICIPANTS",
        "Participants invalides.",
      );
    }
    if (body.attachment_ids) {
      const ids = body.attachment_ids as string[];
      const files = await query(
        "SELECT id FROM attachments WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND task_id=$3",
        [workspace, ids, id || null],
        db,
      );
      assert(
        files.length === new Set(ids).size,
        400,
        "INVALID_FILES",
        "Pièces jointes invalides.",
      );
    }
    if (body.assignee) {
      const [m] = await query(
        "SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND state='active'",
        [workspace, body.assignee],
        db,
      );
      assert(m, 400, "INVALID_ASSIGNEE", "Responsable absent de cet espace.");
    }
    const values = keys.map((k) =>
      config.json?.includes(k) ? JSON.stringify(body[k]) : body[k],
    );
    const [result] =
      method === "POST"
        ? await query(
            `INSERT INTO ${config.table}(workspace_id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => `$${i + 2}`).join(",")}) RETURNING *`,
            [workspace, ...values],
            db,
          )
        : await query(
            `UPDATE ${config.table} SET ${keys.map((k, i) => `${k}=$${i + 3}`).join(",")}${resource === "tasks" ? ",updated_at=now(),revision=revision+1" : ""}${resource === "pages" ? ",revision=revision+1,updated_at=now()" : ""} WHERE workspace_id=$1 AND id=$2 RETURNING *`,
            [workspace, id, ...values],
            db,
          );
    assert(result, 404, "NOT_FOUND", "Élément introuvable.");
    if (resource === "tasks")
      await query(
        "INSERT INTO task_activity(workspace_id,task_id,actor,action,detail) VALUES($1,$2,$3,$4,$5)",
        [
          workspace,
          result.id,
          req.actor.id,
          method === "POST" ? "created" : "updated",
          JSON.stringify({ fields: keys }),
        ],
        db,
      );
    if (
      resource === "channels" &&
      method === "POST" &&
      req.actor.kind === "human"
    )
      await query(
        "INSERT INTO channel_access(channel_id,user_id) VALUES($1,$2)",
        [result.id, req.actor.id],
        db,
      );
    await audit(
      workspace,
      req.actor.id,
      `${resource}.${method === "POST" ? "created" : "updated"}`,
      result.id,
      db,
    );
    await emit(
      workspace,
      `${resource}.updated`,
      req.actor.id,
      { id: result.id },
      db,
    );
    if (
      resource === "tasks" &&
      result.assignee &&
      result.assignee !== req.actor.id
    )
      await query(
        "INSERT INTO notifications(workspace_id,user_id,type,title,body) VALUES($1,$2,'task',$3,$4)",
        [workspace, result.assignee, "Tâche attribuée", result.title],
        db,
      );
    return result;
  });
  res.status(method === "POST" ? 201 : 200).json({ data: row });
});
resourceRouter.get("/tasks/:id/comments", async (req, res) => {
  await authorize(req.actor, uuid.parse(req.workspaceId), "VIEW_BOARD");
  res.json({
    data: await query(
      "SELECT c.*,u.name FROM task_comments c JOIN tasks t ON t.id=c.task_id JOIN users u ON u.id=c.user_id WHERE t.workspace_id=$1 AND t.id=$2 ORDER BY c.created_at",
      [req.workspaceId, uuid.parse(req.params.id)],
    ),
  });
});
resourceRouter.post("/tasks/:id/comments", async (req, res) => {
  const workspace = uuid.parse(req.workspaceId);
  await authorize(req.actor, workspace, "MANAGE_TASK");
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const { content } = z
    .object({ content: z.string().trim().min(1).max(4000) })
    .parse(req.body);
  const row = await transaction(async (db) => {
    const [row] = await query(
      "INSERT INTO task_comments(task_id,user_id,content) SELECT id,$3,$4 FROM tasks WHERE id=$1 AND workspace_id=$2 RETURNING *",
      [uuid.parse(req.params.id), workspace, req.actor.id, content],
      db,
    );
    assert(row, 404, "NOT_FOUND", "Tâche introuvable.");
    await query(
      "UPDATE tasks SET updated_at=now() WHERE id=$1",
      [row.task_id],
      db,
    );
    await query(
      "INSERT INTO task_activity(workspace_id,task_id,actor,action) VALUES($1,$2,$3,'commented')",
      [workspace, row.task_id, req.actor.id],
      db,
    );
    await emit(
      workspace,
      "tasks.updated",
      req.actor.id,
      { id: row.task_id },
      db,
    );
    return row;
  });
  res.status(201).json({ data: row });
});
