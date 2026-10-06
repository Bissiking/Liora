// src/server/events.ts
import { matchesEvent } from "../shared/integration-events.js";
import { query, pool, type DB } from "./db.js";
export async function emit(
  workspace: string,
  type: string,
  actor: string,
  payload: unknown,
  db: DB = pool,
) {
  const [event] = await query(
    "INSERT INTO events(workspace_id,type,source,actor,payload) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [workspace, type, type.split(".")[0], actor, JSON.stringify(payload)],
    db,
  );
  const destinations = await query(
    "SELECT * FROM outbound_webhooks WHERE workspace_id=$1 AND enabled",
    [workspace],
    db,
  );
  for (const d of destinations)
    if (
      !d.event_types.length ||
      d.event_types.some((p: string) => matchesEvent(p, type))
    )
      await query(
        "INSERT INTO webhook_deliveries(workspace_id,url,secret,payload,outbound_id) VALUES($1,$2,$3,$4,$5)",
        [workspace, d.url, d.secret, JSON.stringify(event), d.id],
        db,
      );
  return event;
}
export async function audit(
  workspace: string,
  actor: string,
  action: string,
  target: string,
  db: DB = pool,
) {
  await query(
    "INSERT INTO audit_logs(workspace_id,actor,action,target) VALUES($1,$2,$3,$4)",
    [workspace, actor, action, target],
    db,
  );
}
