// src/server/push.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "./db.js";
import { authorize } from "./auth.js";
import { assert } from "./errors.js";
export const pushRouter = Router({ mergeParams: true });

pushRouter.post("/push/subscribe", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const sub = z
    .object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    })
    .parse(req.body);
  const [user] = await query(
    "SELECT push_subscriptions FROM users WHERE id=$1",
    [req.actor.id],
  );
  const subs: { endpoint: string; keys: { p256dh: string; auth: string } }[] =
    JSON.parse(JSON.stringify(user.push_subscriptions || "[]"));
  const exists = subs.some((s) => s.endpoint === sub.endpoint);
  if (!exists) {
    subs.push(sub);
    await query("UPDATE users SET push_subscriptions=$2 WHERE id=$1", [
      req.actor.id,
      JSON.stringify(subs),
    ]);
  }
  res.json({ ok: true });
});

pushRouter.delete("/push/subscribe", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const { endpoint } = z
    .object({ endpoint: z.string() })
    .parse(req.body);
  const [user] = await query(
    "SELECT push_subscriptions FROM users WHERE id=$1",
    [req.actor.id],
  );
  const subs: { endpoint: string }[] = JSON.parse(
    JSON.stringify(user.push_subscriptions || "[]"),
  );
  const filtered = subs.filter((s) => s.endpoint !== endpoint);
  await query("UPDATE users SET push_subscriptions=$2 WHERE id=$1", [
    req.actor.id,
    JSON.stringify(filtered),
  ]);
  res.json({ ok: true });
});

pushRouter.get("/push/vapid-public-key", async (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  res.json({ key });
});
