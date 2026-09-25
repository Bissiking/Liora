// src/server/experience-access.ts
import { type Actor, authorize } from "./auth.js";
import { channelAccess, granted } from "./access.js";
import { query, pool, type DB } from "./db.js";
import { assert, HttpError } from "./errors.js";
export async function humanWorkspace(actor: Actor, workspace: string) {
  assert(
    actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Action réservée aux membres.",
  );
  await authorize(actor, workspace, "VIEW_WORKSPACE");
  const [user] = await query(
    "SELECT id FROM users WHERE id=$1 AND NOT disabled",
    [actor.id],
  );
  assert(user, 403, "ACCOUNT_DISABLED", "Ce compte est désactivé.");
}
export async function targetAccess(
  actor: Actor,
  workspace: string,
  kind: string,
  id: string,
  db: DB = pool,
) {
  if (kind === "channel") return channelAccess(actor, workspace, id, db);
  const permission =
    kind === "page"
      ? "VIEW_PAGES"
      : kind === "project"
        ? "VIEW_PROJECT"
        : kind === "task"
          ? "VIEW_BOARD"
          : "VIEW_WORKSPACE";
  await authorize(actor, workspace, permission);
  const table = {
    message: "messages",
    page: "pages",
    project: "projects",
    task: "tasks",
    event: "calendar_events",
  }[kind];
  assert(table, 400, "INVALID_TARGET", "Type de ressource inconnu.");
  const [row] = await query(
    `SELECT * FROM ${table} WHERE id=$1 AND workspace_id=$2${kind === "message" ? " AND deleted_at IS NULL" : ""}`,
    [id, workspace],
    db,
  );
  assert(row, 404, "NOT_FOUND", "Ressource introuvable.");
  if (row.channel_id) await channelAccess(actor, workspace, row.channel_id, db);
  if (kind === "task") {
    const [board] = await query(
      "SELECT b.id FROM boards b JOIN board_columns c ON c.board_id=b.id WHERE c.id=$1 AND b.workspace_id=$2",
      [row.column_id, workspace],
      db,
    );
    assert(board, 404, "NOT_FOUND", "Board introuvable.");
    row.board_id = board.id;
  }
  return row;
}
export async function canReadTarget(
  actor: Actor,
  workspace: string,
  kind: string,
  id: string,
  db: DB = pool,
) {
  try {
    return await targetAccess(actor, workspace, kind, id, db);
  } catch (e) {
    if (e instanceof HttpError && [403, 404].includes(e.status)) return null;
    throw e;
  }
}
export async function reminderReferences(
  actor: Actor,
  workspace: string,
  row: {
    channel_id?: string | null;
    message_id?: string | null;
    task_id?: string | null;
  },
  db: DB = pool,
) {
  let channel = row.channel_id || null;
  if (channel) await channelAccess(actor, workspace, channel, db);
  if (row.message_id) {
    const message = await targetAccess(
      actor,
      workspace,
      "message",
      row.message_id,
      db,
    );
    assert(
      !channel || channel === message.channel_id,
      400,
      "INVALID_REFERENCE",
      "Le message doit appartenir au salon choisi.",
    );
    channel = message.channel_id;
  }
  if (row.task_id)
    await targetAccess(actor, workspace, "task", row.task_id, db);
  return channel;
}
