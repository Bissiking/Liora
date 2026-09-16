// src/server/access.ts
import { query, type DB, pool } from "./db.js";
import { type Actor, authorize } from "./auth.js";
import { assert } from "./errors.js";
export async function granted(
  actor: Actor,
  workspace: string,
): Promise<string[]> {
  if (actor.kind !== "human") {
    const [a] = await query(
      "SELECT permissions FROM technical_accounts WHERE id=$1 AND workspace_id=$2 AND NOT revoked",
      [actor.id, workspace],
    );
    return a?.permissions || [];
  }
  const [r] = await query(
    "SELECT r.permissions FROM workspace_members m JOIN roles r ON r.id=m.role_id JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.state='active' AND NOT u.disabled",
    [workspace, actor.id],
  );
  return r?.permissions || [];
}
export function visibleChannel(alias = "c", actor = "$2", perms = "$3") {
  return `('VIEW_CHANNEL'=ANY(${perms}::text[]) AND (${alias}.type<>'monitoring' OR 'VIEW_MONITORING'=ANY(${perms}::text[])) AND (NOT ${alias}.is_private OR EXISTS(SELECT 1 FROM channel_access ca WHERE ca.channel_id=${alias}.id AND ca.user_id=${actor}::uuid) OR (NOT ${alias}.is_dm AND ('MANAGE_CHANNEL'=ANY(${perms}::text[]) OR EXISTS(SELECT 1 FROM channel_groups cg JOIN group_members gm ON gm.group_id=cg.group_id WHERE cg.channel_id=${alias}.id AND gm.user_id=${actor}::uuid)))))`;
}
export async function channelAccess(
  actor: Actor,
  workspace: string,
  id: string,
  db: DB = pool,
) {
  await authorize(actor, workspace, "VIEW_CHANNEL");
  const p = await granted(actor, workspace);
  const [c] = await query(
    `SELECT c.* FROM channels c WHERE c.workspace_id=$1 AND c.id=$4 AND ${visibleChannel()}`,
    [workspace, actor.id, p, id],
    db,
  );
  assert(c, 403, "CHANNEL_FORBIDDEN", "Vous n’avez pas accès à ce salon.");
  return c;
}
