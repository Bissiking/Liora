// src/server/collaboration.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
import { channelAccess } from "./access.js";
import { emit, audit } from "./events.js";
export const collaborationRouter = Router({ mergeParams: true });
collaborationRouter.get("/groups", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MEMBERS");
  res.json({
    data: await query(
      "SELECT g.*,COALESCE((SELECT json_agg(user_id) FROM group_members WHERE group_id=g.id),'[]') user_ids FROM workspace_groups g WHERE workspace_id=$1 ORDER BY name",
      [w],
    ),
  });
});
collaborationRouter.post("/groups", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MEMBERS");
  const { name } = z
    .object({ name: z.string().trim().min(1).max(80) })
    .parse(req.body);
  const [r] = await query(
    "INSERT INTO workspace_groups(workspace_id,name) VALUES($1,$2) RETURNING *",
    [w, name],
  );
  res.status(201).json({ data: r });
});
collaborationRouter.put("/groups/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  await authorize(req.actor, w, "MANAGE_MEMBERS");
  const b = z
    .object({
      name: z.string().trim().min(1).max(80),
      user_ids: z.array(z.uuid()).max(1000),
    })
    .parse(req.body);
  await transaction(async (db) => {
    const [g] = await query(
      "UPDATE workspace_groups SET name=$3 WHERE id=$1 AND workspace_id=$2 RETURNING id",
      [id, w, b.name],
      db,
    );
    assert(g, 404, "NOT_FOUND", "Groupe introuvable.");
    const members = await query(
      "SELECT user_id FROM workspace_members WHERE workspace_id=$1 AND user_id=ANY($2::uuid[]) AND state='active'",
      [w, b.user_ids],
      db,
    );
    assert(
      members.length === new Set(b.user_ids).size,
      400,
      "INVALID_MEMBERS",
      "Membres invalides.",
    );
    await query("DELETE FROM group_members WHERE group_id=$1", [id], db);
    for (const u of new Set(b.user_ids))
      await query("INSERT INTO group_members VALUES($1,$2)", [id, u], db);
    await audit(w, req.actor.id, "group.updated", id, db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
collaborationRouter.delete("/groups/:id", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MEMBERS");
  await transaction(async (db) => {
    await query(
      "DELETE FROM workspace_groups WHERE id=$1 AND workspace_id=$2",
      [z.uuid().parse(req.params.id), w],
      db,
    );
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
collaborationRouter.get("/channels/:id/groups", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_CHANNEL");
  const ch = await channelAccess(req.actor, w, z.uuid().parse(req.params.id));
  assert(!ch.is_dm, 403, "DM_PROTECTED", "Conversation privée.");
  res.json({
    data: await query(
      "SELECT g.*,EXISTS(SELECT 1 FROM channel_groups cg WHERE cg.group_id=g.id AND cg.channel_id=$2) enabled FROM workspace_groups g WHERE g.workspace_id=$1 ORDER BY name",
      [w, ch.id],
    ),
  });
});
collaborationRouter.put("/channels/:id/groups", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_CHANNEL");
  const ch = await channelAccess(req.actor, w, z.uuid().parse(req.params.id));
  assert(!ch.is_dm, 403, "DM_PROTECTED", "Conversation privée.");
  const { group_ids } = z
    .object({ group_ids: z.array(z.uuid()).max(200) })
    .parse(req.body);
  await transaction(async (db) => {
    const groups = await query(
      "SELECT id FROM workspace_groups WHERE workspace_id=$1 AND id=ANY($2::uuid[])",
      [w, group_ids],
      db,
    );
    assert(
      groups.length === new Set(group_ids).size,
      400,
      "INVALID_GROUPS",
      "Groupes invalides.",
    );
    await query("DELETE FROM channel_groups WHERE channel_id=$1", [ch.id], db);
    for (const id of new Set(group_ids))
      await query("INSERT INTO channel_groups VALUES($1,$2)", [ch.id, id], db);
    await emit(w, "access.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
collaborationRouter.get("/tasks/:id/activity", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_BOARD");
  res.json({
    data: await query(
      "SELECT a.*,u.name author_name FROM task_activity a LEFT JOIN users u ON u.id::text=a.actor WHERE a.workspace_id=$1 AND a.task_id=$2 ORDER BY a.created_at DESC LIMIT 100",
      [w, z.uuid().parse(req.params.id)],
    ),
  });
});
collaborationRouter.get("/pages/:id/history", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_PAGES");
  res.json({
    data: await query(
      "SELECT r.* FROM page_revisions r JOIN pages p ON p.id=r.page_id WHERE p.workspace_id=$1 AND p.id=$2 ORDER BY r.revision DESC LIMIT 50",
      [w, z.uuid().parse(req.params.id)],
    ),
  });
});
collaborationRouter.get("/pages/:id/comments", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_PAGES");
  res.json({
    data: await query(
      "SELECT c.*,u.name FROM page_comments c JOIN pages p ON p.id=c.page_id JOIN users u ON u.id=c.user_id WHERE p.workspace_id=$1 AND p.id=$2 ORDER BY c.created_at",
      [w, z.uuid().parse(req.params.id)],
    ),
  });
});
collaborationRouter.post("/pages/:id/comments", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_PAGES");
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  const { content } = z
    .object({ content: z.string().trim().min(1).max(4000) })
    .parse(req.body);
  const [r] = await query(
    "INSERT INTO page_comments(page_id,user_id,content) SELECT id,$3,$4 FROM pages WHERE id=$1 AND workspace_id=$2 RETURNING *",
    [z.uuid().parse(req.params.id), w, req.actor.id, content],
  );
  assert(r, 404, "NOT_FOUND", "Page introuvable.");
  await emit(w, "pages.updated", req.actor.id, {});
  res.status(201).json({ data: r });
});
collaborationRouter.get("/pages/:id/embeds/:block", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_PAGES");
  const [p] = await query(
    "SELECT blocks FROM pages WHERE id=$1 AND workspace_id=$2",
    [z.uuid().parse(req.params.id), w],
  );
  let b = p?.blocks.find((b: { id: string }) => b.id === req.params.block);
  if (req.query.draft === "true") {
    await authorize(req.actor, w, "MANAGE_PAGES");
    assert(p, 404, "NOT_FOUND", "Page introuvable.");
    b = z
      .object({
        type: z.enum(["board", "message", "stats", "integration"]),
        content: z.string().max(2000),
      })
      .parse({ type: req.query.type, content: req.query.content });
  }
  assert(b, 404, "NOT_FOUND", "Bloc introuvable.");
  let data;
  if (b.type === "board") {
    await authorize(req.actor, w, "VIEW_BOARD");
    const id = z.uuid().parse(b.content);
    const [board] = await query(
      "SELECT id,name FROM boards WHERE id=$1 AND workspace_id=$2",
      [id, w],
    );
    assert(board, 404, "NOT_FOUND", "Board introuvable.");
    data = {
      ...board,
      columns: await query(
        "SELECT c.id,c.name,COALESCE((SELECT json_agg(t) FROM (SELECT id,title,priority FROM tasks WHERE column_id=c.id ORDER BY position,id LIMIT 50)t),'[]') tasks FROM board_columns c WHERE c.board_id=$1 AND c.workspace_id=$2 ORDER BY c.position,c.id",
        [id, w],
      ),
    };
  } else if (b.type === "message") {
    const [m] = await query(
      "SELECT m.*,u.name author_name FROM messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.workspace_id=$2 AND m.deleted_at IS NULL",
      [z.uuid().parse(b.content), w],
    );
    assert(m, 404, "NOT_FOUND", "Message introuvable.");
    await channelAccess(req.actor, w, m.channel_id);
    data = m;
  } else if (b.type === "stats") {
    await authorize(req.actor, w, "VIEW_BOARD");
    [data] = await query(
      "SELECT count(*)::int total,count(*) FILTER(WHERE due_at<now())::int overdue,count(*) FILTER(WHERE priority IN ('high','urgent'))::int priority FROM tasks WHERE workspace_id=$1",
      [w],
    );
  } else if (b.type === "integration") {
    await authorize(req.actor, w, "VIEW_WEBHOOKS");
    [data] = await query(
      "SELECT id,name,url,enabled FROM outbound_webhooks WHERE id=$1 AND workspace_id=$2",
      [z.uuid().parse(b.content), w],
    );
    assert(data, 404, "NOT_FOUND", "Intégration introuvable.");
  } else assert(false, 400, "INVALID_EMBED", "Type de bloc non embarqué.");
  res.json({ data });
});
