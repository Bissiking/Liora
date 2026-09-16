// src/server/workers.ts
import https from "node:https";
import { createHmac } from "node:crypto";
import { query, transaction } from "./db.js";
import { emit } from "./events.js";
import { unseal } from "./crypto.js";
import { validateOutboundUrl } from "./network.js";
export async function checkMonitoring() {
  await transaction(async (db) => {
    const [lock] = await query(
      "SELECT pg_try_advisory_xact_lock(431002) locked",
      [],
      db,
    );
    if (!lock.locked) return;
    const targets = await query("SELECT * FROM monitoring_targets", [], db);
    for (const t of targets) {
      let state = "unknown",
        latency: number | null = null,
        detail = "En attente de configuration";
      if (t.kind === "heartbeat") {
        const age = t.last_heartbeat
          ? Date.now() - new Date(t.last_heartbeat).getTime()
          : Infinity;
        state =
          age < Number(process.env.HEARTBEAT_TIMEOUT_SECONDS || 180) * 1000
            ? "up"
            : "down";
        detail =
          state === "up" ? "Heartbeat reçu" : "Heartbeat absent ou expiré";
      } else if (t.url) {
        const start = Date.now();
        try {
          const r = await fetch(t.url, {
            signal: AbortSignal.timeout(5000),
            redirect: "error",
          });
          let payload: Record<string, unknown> = {};
          if (r.headers.get("content-type")?.includes("application/json"))
            payload = (await r.json()) as Record<string, unknown>;
          state =
            r.ok &&
            !["DOWN", "CRITICAL", "unhealthy", "error"].includes(
              String(payload.status),
            )
              ? "up"
              : "down";
          latency = Date.now() - start;
          detail = `HTTP ${r.status}`;
        } catch {
          state = "down";
          detail = "API inaccessible";
          latency = Date.now() - start;
        }
      }
      await query(
        "UPDATE monitoring_targets SET state=$2,latency_ms=$3,last_checked_at=now() WHERE id=$1",
        [t.id, state, latency],
        db,
      );
      await query(
        "INSERT INTO monitoring_checks(target_id,state,latency_ms,detail) VALUES($1,$2,$3,$4)",
        [t.id, state, latency, detail],
        db,
      );
      if (t.state !== state && state !== "unknown") {
        await emit(
          t.workspace_id,
          state === "down" ? "argos.core.down" : "argos.core.recovered",
          "monitor",
          { target: t.name, state, detail },
          db,
        );
        await query(
          `INSERT INTO notifications(workspace_id,user_id,type,title,body,priority) SELECT $1,m.user_id,'argos',$2,$3,$4 FROM workspace_members m JOIN roles r ON r.id=m.role_id JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.state='active' AND 'VIEW_MONITORING'=ANY(r.permissions) AND COALESCE((u.preferences->>'argos')::boolean,true)`,
          [
            t.workspace_id,
            state === "down" ? "ARGOS CORE DOWN" : "Supervision rétablie",
            `${t.name} : ${detail}`,
            state === "down" ? "critical" : "normal",
          ],
          db,
        );
      }
    }
    await query(
      "DELETE FROM monitoring_checks WHERE created_at<now()-interval '30 days'",
      [],
      db,
    );
  });
}
async function deliver(url: string, body: string, secret: string) {
  const address = await validateOutboundUrl(url);
  const u = new URL(url);
  const timestamp = String(Math.floor(Date.now() / 1000));
  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      u,
      {
        method: "POST",
        lookup: (_hostname, _options, cb) => cb(null, address, 4),
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "x-liora-timestamp": timestamp,
          "x-liora-signature": createHmac("sha256", secret)
            .update(`${timestamp}.${body}`)
            .digest("hex"),
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300)
          resolve();
        else reject(Error(`HTTP ${res.statusCode}`));
      },
    );
    req.setTimeout(5000, () => req.destroy(Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}
export async function processDeliveries() {
  await transaction(async (db) => {
    const rows = await query(
      "SELECT * FROM webhook_deliveries WHERE state='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED",
      [],
      db,
    );
    for (const d of rows) {
      try {
        await deliver(
          d.url,
          JSON.stringify(d.payload),
          await unseal<string>(d.secret),
        );
        await query(
          "UPDATE webhook_deliveries SET state='sent',attempts=attempts+1,last_error=null WHERE id=$1",
          [d.id],
          db,
        );
      } catch {
        await query(
          "UPDATE webhook_deliveries SET attempts=attempts+1,state=$2,last_error='Destination inaccessible ou refusée',next_attempt_at=now()+($3*interval '1 second') WHERE id=$1",
          [
            d.id,
            d.attempts >= 4 ? "failed" : "pending",
            Math.min(3600, 30 * 2 ** d.attempts),
          ],
          db,
        );
      }
    }
  });
}
export function startWorkers() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const loop = async () => {
    try {
      await checkMonitoring();
      await processDeliveries();
      await query("DELETE FROM user_sessions WHERE expires_at<now()");
      await query(
        "DELETE FROM idempotency_keys WHERE created_at<now()-interval '7 days'",
      );
    } catch {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "worker",
          message: "Cycle failed; retry scheduled",
        }),
      );
    }
    if (!stopped)
      timer = setTimeout(
        loop,
        Math.max(10000, Number(process.env.MONITOR_INTERVAL_MS) || 60000),
      );
  };
  void loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
