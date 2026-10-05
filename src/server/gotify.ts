// src/server/gotify.ts
import { Router } from "express";
import https from "node:https";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert } from "./errors.js";
import { seal, unseal } from "./crypto.js";
import { validateOutboundUrl } from "./network.js";
import { visibleChannel } from "./access.js";
import { humanWorkspace } from "./experience-access.js";
export const gotifyRouter = Router();
gotifyRouter.use("/gotify", (req, _res, next) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  next();
});
gotifyRouter.get("/gotify", async (req, res) => {
  const [connection] = await query(
    "SELECT url,enabled FROM gotify_connections WHERE user_id=$1",
    [req.actor.id],
  );
  const deliveries = await query(
    "SELECT id,state,attempts,last_error,created_at FROM gotify_deliveries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
    [req.actor.id],
  );
  res.json({ connection: connection || null, deliveries });
});
gotifyRouter.put("/gotify", async (req, res) => {
  const body = z
    .object({
      url: z.url().max(2048),
      token: z.string().trim().max(512).optional(),
      enabled: z.boolean(),
    })
    .strict()
    .parse(req.body);
  const url = new URL(body.url);
  assert(
    !url.search && !url.hash,
    400,
    "INVALID_DESTINATION",
    "Utilisez l’adresse du serveur Gotify sans paramètres ni jeton.",
  );
  await validateOutboundUrl(url.href);
  await transaction(async (db) => {
    await query(
      "SELECT id FROM users WHERE id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    const [old] = await query(
      "SELECT * FROM gotify_connections WHERE user_id=$1",
      [req.actor.id],
      db,
    );
    assert(
      body.token || (old && old.url === url.href.replace(/\/$/, "")),
      400,
      "TOKEN_REQUIRED",
      "Un jeton d’application est requis pour cette destination.",
    );
    await query(
      "INSERT INTO gotify_connections(user_id,url,token,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET url=EXCLUDED.url,token=EXCLUDED.token,enabled=EXCLUDED.enabled",
      [
        req.actor.id,
        url.href.replace(/\/$/, ""),
        body.token ? await seal(body.token) : old.token,
        body.enabled,
      ],
      db,
    );
    // A change of destination/secret never reroutes notifications queued for the old destination.
    if (!body.enabled || body.token || old?.url !== url.href.replace(/\/$/, ""))
      await query(
        "UPDATE gotify_deliveries SET state='cancelled' WHERE user_id=$1 AND state IN ('pending','failed')",
        [req.actor.id],
        db,
      );
  });
  res.json({ ok: true });
});
gotifyRouter.delete("/gotify", async (req, res) => {
  await query("DELETE FROM gotify_connections WHERE user_id=$1", [
    req.actor.id,
  ]);
  res.json({ ok: true });
});
gotifyRouter.post("/gotify/test", async (req, res) => {
  const { workspace } = z
    .object({ workspace: z.uuid() })
    .strict()
    .parse(req.body);
  await humanWorkspace(req.actor, workspace);
  await transaction(async (db) => {
    const [c] = await query(
      "SELECT enabled FROM gotify_connections WHERE user_id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    assert(
      c?.enabled,
      409,
      "GOTIFY_DISABLED",
      "Enregistrez et activez Gotify avant le test.",
    );
    await query(
      "INSERT INTO notifications(workspace_id,user_id,type,title,body) VALUES($1,$2,'system','Test Gotify','Test en file d’envoi.')",
      [workspace, req.actor.id],
      db,
    );
  });
  res.status(202).json({ ok: true });
});
gotifyRouter.post("/gotify/deliveries/:id/:action", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    action = z.enum(["retry", "cancel"]).parse(req.params.action);
  const rows = await query(
    `UPDATE gotify_deliveries SET state=$3,attempts=CASE WHEN $3='pending' THEN 0 ELSE attempts END,next_attempt_at=now(),last_error=null WHERE id=$1 AND user_id=$2 AND state=ANY($4::text[]) AND ($3<>'pending' OR EXISTS(SELECT 1 FROM gotify_connections c WHERE c.user_id=$2 AND c.enabled)) RETURNING id`,
    [
      id,
      req.actor.id,
      action === "retry" ? "pending" : "cancelled",
      action === "retry" ? ["failed"] : ["pending", "failed"],
    ],
  );
  assert(
    rows.length,
    409,
    "DELIVERY_UNAVAILABLE",
    "Cet envoi n’est plus disponible pour cette action.",
  );
  res.json({ ok: true });
});
export function gotifyMessage(
  workspace: string,
  notification: string,
  critical: boolean,
) {
  return {
    title: "Liora",
    message: "Une nouvelle notification vous attend dans votre espace.",
    priority: critical ? 8 : 4,
    extras: {
      "client::notification": {
        click: {
          url: `${process.env.APP_URL}/#workspace=${workspace}&view=notifications`,
        },
      },
    },
  };
}
export async function sendGotify(
  url: string,
  token: string,
  message: unknown,
): Promise<number> {
  const destination = `${url}/message`,
    address = await validateOutboundUrl(destination),
    body = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const req = https.request(
      destination,
      {
        method: "POST",
        lookup: (_host, _options, cb) => cb(null, address, 4),
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "X-Gotify-Key": token,
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode || 500);
      },
    );
    const timeout = setTimeout(() => req.destroy(Error("timeout")), 5000);
    req.on("close", () => clearTimeout(timeout));
    req.on("error", reject);
    req.end(body);
  });
}
export async function processGotifyDeliveries(
  send = sendGotify,
  now = new Date(),
) {
  await transaction(async (db) => {
    const deliveries = await query(
      "SELECT d.*,c.url,c.token,c.enabled FROM gotify_deliveries d JOIN gotify_connections c ON c.user_id=d.user_id WHERE d.state='pending' AND d.next_attempt_at<=$1 ORDER BY d.created_at LIMIT 10 FOR UPDATE OF d,c SKIP LOCKED",
      [now],
      db,
    );
    for (const d of deliveries) {
      // Enforce current rights and preferences immediately before delivery; no private content leaves Liora.
      const [n] = await query(
        `SELECT n.* FROM notifications n JOIN users u ON u.id=n.user_id JOIN workspace_members m ON m.workspace_id=n.workspace_id AND m.user_id=u.id JOIN roles r ON r.id=m.role_id WHERE n.id=$1 AND n.user_id=$2 AND n.state='unread' AND NOT u.disabled AND m.state='active' AND 'VIEW_WORKSPACE'=ANY(r.permissions) AND (n.type<>'argos' OR ('VIEW_MONITORING'=ANY(r.permissions) AND COALESCE((u.preferences->>'argos')::boolean,true))) AND (n.type<>'task' OR ('VIEW_BOARD'=ANY(r.permissions) AND COALESCE((u.preferences->>'tasks')::boolean,true))) AND (n.type<>'mention' OR COALESCE((u.preferences->>'mentions')::boolean,true)) AND (n.type<>'message' OR COALESCE((u.preferences->>CASE WHEN EXISTS(SELECT 1 FROM channels dm WHERE dm.id=n.channel_id AND dm.is_dm) THEN 'directMessages' ELSE 'messages' END)::boolean,true)) AND (n.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=n.channel_id AND c.workspace_id=n.workspace_id AND ${visibleChannel("c", "$2", "r.permissions")}))`,
        [d.notification_id, d.user_id],
        db,
      );
      if (
        !n ||
        !d.enabled ||
        Date.parse(d.created_at) < now.getTime() - 86400000
      ) {
        await query(
          "UPDATE gotify_deliveries SET state='cancelled' WHERE id=$1",
          [d.id],
          db,
        );
        continue;
      }
      let status = 0;
      try {
        status = await send(
          d.url,
          await unseal<string>(d.token),
          gotifyMessage(n.workspace_id, n.id, n.priority === "critical"),
        );
      } catch {
        /* Never log destination or token. */
      }
      const ok = status >= 200 && status < 300,
        retry =
          !ok &&
          (status === 0 || status === 429 || status >= 500) &&
          d.attempts < 4;
      await query(
        "UPDATE gotify_deliveries SET state=$2,attempts=attempts+1,next_attempt_at=$3,last_error=$4 WHERE id=$1",
        [
          d.id,
          ok ? "sent" : retry ? "pending" : "failed",
          new Date(now.getTime() + Math.min(3600, 30 * 2 ** d.attempts) * 1000),
          ok ? null : status ? `HTTP ${status}` : "Gotify inaccessible",
        ],
        db,
      );
    }
    await query(
      "DELETE FROM gotify_deliveries WHERE state<>'pending' AND created_at<now()-interval '30 days'",
      [],
      db,
    );
  });
}
