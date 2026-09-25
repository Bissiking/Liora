// src/server/push.ts
import { Router } from "express";
import https from "node:https";
import webpush from "web-push";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert } from "./errors.js";
import { hash, seal, unseal } from "./crypto.js";
import { humanWorkspace } from "./experience-access.js";
import { validateOutboundUrl } from "./network.js";
import { visibleChannel } from "./access.js";
export const pushRouter = Router({ mergeParams: true });
export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "",
    privateKey = process.env.VAPID_PRIVATE_KEY || "",
    subject = process.env.VAPID_SUBJECT || "";
  if (!publicKey || !privateKey || !subject) return null;
  try {
    webpush.getVapidHeaders(
      "https://example.com",
      subject,
      publicKey,
      privateKey,
      "aes128gcm",
    );
    return { publicKey, privateKey, subject };
  } catch {
    return null;
  }
}
const key = (length: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine(
      (s) => Buffer.from(s, "base64url").length === length,
      "Clé d’abonnement invalide.",
    );
const subscriptionSchema = z
  .object({
    endpoint: z.url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: key(65), auth: key(16) }).strict(),
  })
  .strict();
pushRouter.get("/push/vapid-public-key", async (req, res) => {
  await humanWorkspace(req.actor, req.workspaceId);
  const config = pushConfig();
  const [row] = await query(
    "SELECT count(*) n FROM push_subscriptions WHERE user_id=$1 AND session_id=$2",
    [req.actor.id, req.actor.sessionId],
  );
  res.json({
    key: config?.publicKey || "",
    enabled: !!config,
    subscribed: Number(row.n) > 0,
  });
});
pushRouter.post("/push/subscribe", async (req, res) => {
  await humanWorkspace(req.actor, req.workspaceId);
  assert(
    req.actor.sessionId,
    403,
    "SESSION_REQUIRED",
    "Session navigateur requise.",
  );
  assert(
    pushConfig(),
    503,
    "PUSH_NOT_CONFIGURED",
    "Les notifications de cet appareil ne sont pas encore configurées sur le serveur.",
  );
  const sub = subscriptionSchema.parse(req.body);
  assert(
    Buffer.from(sub.keys.p256dh, "base64url")[0] === 4,
    400,
    "INVALID_KEY",
    "Clé d’abonnement invalide.",
  );
  await validateOutboundUrl(sub.endpoint);
  assert(
    !new URL(sub.endpoint).hash,
    400,
    "INVALID_DESTINATION",
    "Endpoint invalide.",
  );
  await transaction(async (db) => {
    await query(
      "SELECT id FROM users WHERE id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    const [count] = await query(
      "SELECT count(*) n FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash<>$2",
      [req.actor.id, hash(sub.endpoint)],
      db,
    );
    assert(
      Number(count.n) < 10,
      409,
      "PUSH_LIMIT",
      "Limite de dix appareils atteinte ; révoquez une session inutilisée.",
    );
    await query(
      `INSERT INTO push_subscriptions(user_id,session_id,endpoint_hash,subscription) VALUES($1,$2,$3,$4) ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=EXCLUDED.user_id,session_id=EXCLUDED.session_id,subscription=EXCLUDED.subscription`,
      [req.actor.id, req.actor.sessionId, hash(sub.endpoint), await seal(sub)],
      db,
    );
  });
  res.json({ ok: true });
});
pushRouter.delete("/push/subscribe", async (req, res) => {
  await humanWorkspace(req.actor, req.workspaceId);
  const { endpoint } = z
    .object({ endpoint: z.string().max(2048).optional() })
    .strict()
    .parse(req.body || {});
  await query(
    "DELETE FROM push_subscriptions WHERE user_id=$1 AND (($2::text IS NOT NULL AND endpoint_hash=$2) OR ($2::text IS NULL AND session_id=$3))",
    [req.actor.id, endpoint ? hash(endpoint) : null, req.actor.sessionId],
  );
  res.json({ ok: true });
});
pushRouter.post("/push/test", async (req, res) => {
  await humanWorkspace(req.actor, req.workspaceId);
  assert(
    pushConfig(),
    503,
    "PUSH_NOT_CONFIGURED",
    "Notifications serveur non configurées.",
  );
  const [subscription] = await query(
    "SELECT id FROM push_subscriptions WHERE user_id=$1 AND session_id=$2",
    [req.actor.id, req.actor.sessionId],
  );
  assert(
    subscription,
    409,
    "PUSH_NOT_SUBSCRIBED",
    "Activez d’abord les notifications sur cet appareil.",
  );
  await query(
    "INSERT INTO notifications(workspace_id,user_id,type,title,body) VALUES($1,$2,'system','Test des notifications','Le test a été mis en file d’envoi.')",
    [req.workspaceId, req.actor.id],
  );
  res.status(202).json({ ok: true });
});
export function buildPushRequest(
  subscription: webpush.PushSubscription,
  payload: unknown,
) {
  const config = pushConfig();
  if (!config) throw Error("Push unavailable");
  return webpush.generateRequestDetails(subscription, JSON.stringify(payload), {
    TTL: 300,
    urgency: "normal",
    vapidDetails: config,
    contentEncoding: "aes128gcm",
  });
}
export async function sendWebPush(
  subscription: webpush.PushSubscription,
  payload: unknown,
): Promise<number> {
  const address = await validateOutboundUrl(subscription.endpoint);
  const details = buildPushRequest(subscription, payload);
  return new Promise((resolve, reject) => {
    const req = https.request(
      details.endpoint,
      {
        method: details.method,
        headers: details.headers,
        lookup: (_hostname, _options, cb) => cb(null, address, 4),
      },
      (res) => {
        res.resume();
        resolve(res.statusCode || 500);
      },
    );
    req.setTimeout(5000, () => req.destroy(Error("timeout")));
    req.on("error", reject);
    req.end(details.body);
  });
}
export async function processPushDeliveries(
  send = sendWebPush,
  now = new Date(),
) {
  if (!pushConfig()) return;
  await transaction(async (db) => {
    const rows = await query(
      `SELECT d.*,s.user_id,s.session_id,s.subscription FROM push_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id WHERE d.state='pending' AND d.next_attempt_at<=$1 ORDER BY d.created_at LIMIT 20 FOR UPDATE OF d SKIP LOCKED`,
      [now],
      db,
    );
    for (const d of rows) {
      // Re-evaluate membership, session, preferences and private-channel visibility immediately before delivery.
      const [n] = await query(
        `SELECT n.* FROM notifications n JOIN users u ON u.id=n.user_id JOIN user_sessions s ON s.id=$3 AND s.user_id=u.id JOIN workspace_members m ON m.workspace_id=n.workspace_id AND m.user_id=u.id JOIN roles r ON r.id=m.role_id WHERE n.id=$1 AND n.user_id=$2 AND n.state='unread' AND s.expires_at>now() AND NOT u.disabled AND m.state='active' AND 'VIEW_WORKSPACE'=ANY(r.permissions) AND (n.type<>'argos' OR ('VIEW_MONITORING'=ANY(r.permissions) AND COALESCE((u.preferences->>'argos')::boolean,true))) AND (n.type<>'task' OR COALESCE((u.preferences->>'tasks')::boolean,true)) AND (n.type<>'mention' OR COALESCE((u.preferences->>'mentions')::boolean,true)) AND (n.type<>'message' OR COALESCE((u.preferences->>CASE WHEN EXISTS(SELECT 1 FROM channels dm WHERE dm.id=n.channel_id AND dm.is_dm) THEN 'directMessages' ELSE 'messages' END)::boolean,true)) AND (n.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=n.channel_id AND c.workspace_id=n.workspace_id AND ${visibleChannel("c", "$2", "r.permissions")}))`,
        [d.notification_id, d.user_id, d.session_id],
        db,
      );
      if (!n) {
        await query(
          "UPDATE push_deliveries SET state='cancelled' WHERE id=$1",
          [d.id],
          db,
        );
        continue;
      }
      let status = 0;
      try {
        status = await send(
          await unseal<webpush.PushSubscription>(d.subscription),
          {
            title: "Liora",
            body: "Une nouvelle notification vous attend dans votre espace.",
            tag: `liora-${n.id}`,
            url: `/#workspace=${n.workspace_id}&view=notifications`,
          },
        );
      } catch {
        /* Keep errors generic: endpoints and credentials must never be logged. */
      }
      if (status === 404 || status === 410) {
        await query(
          "DELETE FROM push_subscriptions WHERE id=$1",
          [d.subscription_id],
          db,
        );
        continue;
      }
      const ok = status >= 200 && status < 300;
      const retry =
        !ok &&
        (status === 0 || status === 429 || status >= 500) &&
        d.attempts < 4;
      await query(
        "UPDATE push_deliveries SET state=$2,attempts=attempts+1,next_attempt_at=$3,last_error=$4 WHERE id=$1",
        [
          d.id,
          ok ? "sent" : retry ? "pending" : "failed",
          new Date(now.getTime() + Math.min(3600, 30 * 2 ** d.attempts) * 1000),
          ok ? null : status ? `HTTP ${status}` : "Service push inaccessible",
        ],
        db,
      );
    }
    await query(
      "DELETE FROM push_deliveries WHERE state<>'pending' AND created_at<now()-interval '30 days'",
      [],
      db,
    );
  });
}
