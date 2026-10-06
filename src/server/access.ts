// src/server/access.ts
import { query, type DB, pool } from "./db.js";
import { type Actor, authorize } from "./auth.js";
import {
  channelPermissions,
  type ChannelPermission,
} from "../shared/channel-permissions.js";
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
    return (a?.permissions || []).filter(
      (p: string) => !actor.permissions || actor.permissions.includes(p),
    );
  }
  const [r] = await query(
    "SELECT r.permissions FROM workspace_members m JOIN roles r ON r.id=m.role_id JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.state='active' AND NOT u.disabled",
    [workspace, actor.id],
  );
  return r?.permissions || [];
}
export function visibleChannel(
  alias = "c",
  actor = "$2",
  perms = "$3",
  read = true,
) {
  return `(channel_permission(${alias}.id,${actor}::uuid,${perms}::text[],'VIEW_CHANNEL') ${read ? `AND channel_permission(${alias}.id,${actor}::uuid,${perms}::text[],'READ_MESSAGE')` : ""} AND (${alias}.type<>'monitoring' OR 'VIEW_MONITORING'=ANY(${perms}::text[])) AND (NOT ${alias}.is_private OR EXISTS(SELECT 1 FROM channel_access ca WHERE ca.channel_id=${alias}.id AND ca.user_id=${actor}::uuid) OR (NOT ${alias}.is_dm AND EXISTS(SELECT 1 FROM webhooks wh WHERE wh.technical_id=${actor}::uuid AND wh.workspace_id=${alias}.workspace_id AND NOT wh.revoked AND (wh.channel_id=${alias}.id OR EXISTS(SELECT 1 FROM integration_rules ir WHERE ir.integration_id=wh.integration_id AND ir.channel_id=${alias}.id AND ir.enabled)))) OR (NOT ${alias}.is_dm AND ('MANAGE_CHANNEL'=ANY(${perms}::text[]) OR EXISTS(SELECT 1 FROM channel_groups cg JOIN group_members gm ON gm.group_id=cg.group_id WHERE cg.channel_id=${alias}.id AND gm.user_id=${actor}::uuid)))))`;
}
export async function channelAccess(
  actor: Actor,
  workspace: string,
  id: string,
  db: DB = pool,
  permission: ChannelPermission = "READ_MESSAGE",
) {
  if (actor.kind === "human")
    await authorize(actor, workspace, "VIEW_WORKSPACE");
  else
    assert(
      !actor.workspace || actor.workspace === workspace,
      403,
      "CHANNEL_FORBIDDEN",
      "Accès au canal refusé.",
    );
  const p = await granted(actor, workspace);
  const [c] = await query(
    `SELECT c.*,ARRAY(SELECT k FROM unnest($5::text[]) k WHERE channel_permission(c.id,$2::uuid,$3::text[],k)) capabilities FROM channels c WHERE c.workspace_id=$1 AND c.id=$4 AND ${visibleChannel("c", "$2", "$3", false)}`,
    [workspace, actor.id, p, id, Object.keys(channelPermissions)],
    db,
  );
  assert(
    c && c.capabilities.includes(permission),
    403,
    "CHANNEL_FORBIDDEN",
    "Vous n’avez pas cette permission dans ce canal.",
  );
  return c;
}
export async function authorizeChannel(
  actor: Actor,
  workspace: string,
  id: string,
  permission: ChannelPermission,
  db: DB = pool,
) {
  return channelAccess(actor, workspace, id, db, permission);
}
