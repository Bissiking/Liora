// src/server/webhooks.ts
import { Router } from "express";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  webhookMessageSchema,
  webhookText,
} from "../shared/webhook-message.js";
import { type DB, query, transaction } from "./db.js";
import { hash, unseal } from "./crypto.js";
import { assert } from "./errors.js";
import { sendMessage } from "./chat.js";
import { emit, audit } from "./events.js";
import {
  matchesEvent,
  normalizeIntegrationEvent,
} from "../shared/integration-events.js";
const payload = z
  .object({
    content: z.string().trim().min(1).max(8000).optional(),
    type: z
      .string()
      .regex(/^[a-z][a-z0-9_.]{2,100}$/)
      .default("integration.event"),
    payload: z.record(z.string(), z.unknown()).default({}),
    task: z
      .object({ title: z.string().min(1).max(100), column_id: z.uuid() })
      .optional(),
    title: z.string().max(200).optional(),
    message: z.string().max(8000).optional(),
    severity: z.string().max(30).optional(),
    source: z.string().max(100).optional(),
    timestamp: z.string().max(100).optional(),
    fields: z.unknown().optional(),
  })
  .strict();
export const webhookRouter = Router();
webhookRouter.post("/:token", async (req, res) => {
  const raw = z.string().min(32).max(100).parse(req.params.token);
  const result = await transaction(async (db) => {
    const [w] = await query(
      "SELECT * FROM webhooks WHERE token_hash=$1 AND NOT revoked FOR SHARE",
      [hash(raw)],
      db,
    );
    assert(w, 404, "WEBHOOK_NOT_FOUND", "Webhook invalide ou révoqué.");
    let provider: string | undefined;
    if (w.integration_id) {
      const [i] = await query(
        "SELECT provider,enabled FROM integrations WHERE id=$1 FOR SHARE",
        [w.integration_id],
        db,
      );
      assert(i?.enabled, 403, "INTEGRATION_DISABLED", "Module désactivé.");
      provider = i.provider;
    }
    let idem = req.get("idempotency-key") || req.get("x-github-delivery");
    if (w.signature_mode !== "none") {
      const secret = await unseal<string>(w.hmac_secret),
        body = req.rawBody || Buffer.alloc(0);
      let signed: Buffer | string = body,
        provided = "";
      if (w.signature_mode === "github")
        provided = (req.get("x-hub-signature-256") || "").replace(
          /^sha256=/,
          "",
        );
      else {
        const stamp = req.get("x-liora-timestamp") || "";
        assert(
          /^\d{10}$/.test(stamp) &&
            Math.abs(Date.now() / 1000 - Number(stamp)) <= 300,
          401,
          "SIGNATURE_EXPIRED",
          "Horodatage de signature invalide.",
        );
        signed = Buffer.concat([Buffer.from(stamp + "."), body]);
        provided = req.get("x-liora-signature") || "";
      }
      const expected = createHmac("sha256", secret).update(signed).digest();
      assert(
        /^[a-f0-9]{64}$/i.test(provided) &&
          timingSafeEqual(expected, Buffer.from(provided, "hex")),
        401,
        "INVALID_SIGNATURE",
        "Signature invalide.",
      );
      idem ||= hash(provided);
    }
    if (idem) {
      z.string().max(100).parse(idem);
      const claimed = await query(
        "INSERT INTO idempotency_keys(webhook_id,key) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING key",
        [w.id, idem],
        db,
      );
      if (!claimed.length) return { duplicate: true };
    }
    return processWebhookMessage(w, req.body, db, req.get("x-github-event"));
  }).catch(async (error) => {
    const [w] = await query(
      "SELECT id,workspace_id FROM webhooks WHERE token_hash=$1 AND NOT revoked",
      [hash(raw)],
    );
    if (w)
      await query(
        "INSERT INTO webhook_receipts(webhook_id,workspace_id,http_status,error) VALUES($1,$2,$3,$4)",
        [
          w.id,
          w.workspace_id,
          typeof error.status === "number" ? error.status : 400,
          "Réception refusée : validation ou autorisation.",
        ],
      );
    throw error;
  });
  res.status(202).json({ data: result });
});

export async function processWebhookMessage(
  w: any,
  input: any,
  db: DB,
  githubEvent?: string,
  isTest = false,
) {
  let provider: string | undefined;
  if (w.integration_id) {
    const [i] = await query(
      "SELECT provider,enabled FROM integrations WHERE id=$1 FOR SHARE",
      [w.integration_id],
      db,
    );
    assert(i?.enabled, 403, "INTEGRATION_DISABLED", "Module désactivé.");
    provider = i.provider;
  }
  const argos = z
    .object({
      event: z.enum(["alert.active", "alert.resolved"]),
      alert: z
        .object({ title: z.string().max(200), message: z.string().max(7000) })
        .passthrough(),
    })
    .safeParse(input);
  let normalized: any = argos.success
    ? {
        type:
          argos.data.event === "alert.active"
            ? "argos.alert.created"
            : "argos.alert.resolved",
        content: `${argos.data.alert.title}\n${argos.data.alert.message}`,
        payload: argos.data.alert,
      }
    : input;
  const rich =
    input && typeof input === "object" && "mode" in input
      ? webhookMessageSchema.parse(input)
      : null;
  if (!rich && provider && provider !== "argos" && provider !== "generic") {
    try {
      normalized = normalizeIntegrationEvent(provider, input, githubEvent);
    } catch {
      assert(
        false,
        400,
        "INVALID_EVENT",
        "Événement du fournisseur invalide ou non pris en charge.",
      );
    }
  }
  if (rich)
    normalized = {
      content: webhookText(rich),
      payload: rich.metadata,
      type: "integration.event",
    };
  const b = payload.parse(normalized),
    content =
      b.content ||
      b.message ||
      (b.title ? `${b.title}${b.severity ? ` · ${b.severity}` : ""}` : null);
  const rules = w.integration_id
    ? await query(
        "SELECT r.* FROM integration_rules r JOIN channels c ON c.id=r.channel_id WHERE r.integration_id=$1 AND r.enabled AND NOT c.archived AND NOT c.is_dm ORDER BY r.created_at",
        [w.integration_id],
        db,
      )
    : [];
  const applicable = rules.filter(
    (r) =>
      matchesEvent(r.event_pattern, b.type) &&
      (!r.severity || r.severity === b.severity),
  );
  const [count] = w.integration_id
    ? await query(
        "SELECT count(*) count FROM integration_rules WHERE integration_id=$1",
        [w.integration_id],
        db,
      )
    : [{ count: 0 }];
  const targets =
    Number(count.count) > 0
      ? applicable
      : [{ channel_id: w.channel_id, column_id: null }];
  for (const channel of new Set(targets.map((r) => r.channel_id)))
    if (content)
      await sendMessage(
        w.workspace_id,
        channel,
        { id: w.technical_id, kind: "service" },
        content,
        null,
        db,
        null,
        [],
        "UTC",
        rich,
      );
  for (const column of new Set(
    targets.map((r) => r.column_id).filter(Boolean),
  )) {
    const [task] = await query(
      "INSERT INTO tasks(workspace_id,column_id,title,description) VALUES($1,$2,$3,$4) RETURNING id",
      [
        w.workspace_id,
        column,
        (b.title || content || b.type).slice(0, 100),
        content || "",
      ],
      db,
    );
    await query(
      "INSERT INTO task_activity(workspace_id,task_id,actor,action) VALUES($1,$2,$3,'created')",
      [w.workspace_id, task.id, w.technical_id],
      db,
    );
    await emit(
      w.workspace_id,
      "tasks.updated",
      w.technical_id,
      { id: task.id },
      db,
    );
  }
  if (b.task) {
    assert(
      w.allow_tasks,
      403,
      "TASKS_FORBIDDEN",
      "Création de tâches interdite pour ce webhook.",
    );
    await query(
      "INSERT INTO tasks(workspace_id,column_id,title) VALUES($1,$2,$3)",
      [w.workspace_id, b.task.column_id, b.task.title],
      db,
    );
  }
  const event = await emit(
    w.workspace_id,
    b.type,
    w.technical_id,
    b.payload,
    db,
  );
  await audit(w.workspace_id, w.technical_id, "webhook.received", w.id, db);
  await query(
    "INSERT INTO webhook_receipts(webhook_id,workspace_id,http_status,mode,is_test,event_id) VALUES($1,$2,202,$3,$4,$5)",
    [w.id, w.workspace_id, rich?.mode || "TEXT", isTest, event.id],
    db,
  );
  return { id: event.id, routed: targets.length };
}
