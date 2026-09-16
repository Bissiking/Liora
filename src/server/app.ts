// src/server/app.ts
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "./db.js";
import {
  authRouter,
  authenticate,
  authorize,
  createWorkspace,
} from "./auth.js";
import { resourceRouter } from "./resources.js";
import { chatRouter } from "./chat.js";
import { adminRouter } from "./admin.js";
import { webhookRouter } from "./webhooks.js";
import { storageRouter } from "./storage.js";
import { granted, visibleChannel } from "./access.js";
import { KyrosTokenError } from "./kyros.js";
import { HttpError, assert } from "./errors.js";
import { VERSION } from "../shared/version.js";
import { socialRouter } from "./social.js";
import { collaborationRouter } from "./collaboration.js";
import { avatarRouter } from "./storage.js";
import { previewRouter } from "./previews.js";
import { integrationRouter, integrationCallback } from "./integrations.js";
import { commandRouter } from "./commands.js";
export { VERSION };
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
              },
            }
          : false,
    }),
  );
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    const start = Date.now();
    const logged = req.path.startsWith("/api") || req.path.startsWith("/auth");
    res.on("finish", () => {
      if (logged)
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: res.statusCode >= 500 ? "error" : "info",
            service: "liora",
            requestId: req.requestId,
            userId: req.actor?.id,
            method: req.method,
            status: res.statusCode,
            durationMs: Date.now() - start,
            message: "Request completed",
          }),
        );
    });
    next();
  });
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth"))
      res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.headers.authorization &&
      !req.path.startsWith("/api/webhooks/")
    ) {
      const origin = req.get("origin");
      if (
        origin !==
        new URL(process.env.APP_URL || "http://localhost:4310").origin
      )
        return next(
          new HttpError(403, "INVALID_ORIGIN", "Origine de requête refusée."),
        );
    }
    next();
  });
  const limiter = (limit: number) =>
    rateLimit({
      windowMs: 60000,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Trop de requêtes. Réessayez dans une minute.",
            requestId: req.requestId,
          },
        }),
    });
  const readLimiter = limiter(1200),
    writeLimiter = limiter(300);
  app.use("/api", (req, res, next) =>
    (["GET", "HEAD"].includes(req.method) ? readLimiter : writeLimiter)(
      req,
      res,
      next,
    ),
  );
  app.use("/auth", limiter(30));
  app.use("/api/webhooks", limiter(60));
  app.use(
    express.json({
      limit: "1500kb",
      verify: (req, _res, bytes) => {
        (req as express.Request).rawBody = Buffer.from(bytes);
      },
    }),
  );
  app.get(["/health", "/health/ready"], async (_req, res) => {
    try {
      await query("SELECT 1 FROM schema_migrations LIMIT 1");
      res.json({ status: "up", database: "up", version: VERSION });
    } catch {
      res
        .status(503)
        .json({ status: "down", database: "unavailable", version: VERSION });
    }
  });
  app.get("/health/live", (_req, res) =>
    res.json({ status: "up", version: VERSION }),
  );
  app.use("/auth", authRouter);
  app.use("/api/webhooks", webhookRouter);
  app.use("/api/v1", authenticate);
  app.use("/api/v1", socialRouter, avatarRouter, integrationCallback);
  app.get("/api/v1/me", async (req, res) => {
    assert(
      req.actor.kind === "human",
      403,
      "HUMAN_REQUIRED",
      "Compte humain requis.",
    );
    const [u] = await query(
      "SELECT id,kyros_user_id,name,avatar,bio,status,preferences FROM users WHERE id=$1",
      [req.actor.id],
    );
    const workspaces = await query(
      `SELECT w.*,r.permissions,r.name role_name FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 AND m.state='active' ORDER BY w.created_at`,
      [req.actor.id],
    );
    res.json({ data: u, workspaces, version: VERSION });
  });
  app.patch("/api/v1/me", async (req, res) => {
    assert(
      req.actor.kind === "human",
      403,
      "HUMAN_REQUIRED",
      "Compte humain requis.",
    );
    const b = z
      .object({
        name: z.string().trim().min(1).max(80),
        bio: z.string().max(300),
        status: z.enum(["available", "busy", "away", "invisible"]),
        preferences: z
          .object({
            theme: z.enum(["dark", "light", "dusk"]).default("dark"),
            density: z.enum(["comfortable", "compact"]).default("comfortable"),
            fontSize: z.enum(["normal", "large"]).default("normal"),
            mentions: z.boolean().default(true),
            argos: z.boolean().default(true),
            presence: z.boolean().default(true),
            enterToSend: z.boolean().default(true),
            timestamps: z.boolean().default(true),
            linkPreviews: z.boolean().default(false),
            sound: z.boolean().default(false),
            messages: z.boolean().default(true),
            directMessages: z.boolean().default(true),
            tasks: z.boolean().default(true),
            dmPolicy: z
              .enum(["members", "friends", "nobody"])
              .default("members"),
            soundMessages: z.boolean().default(false),
            soundMentions: z.boolean().default(false),
            soundCritical: z.boolean().default(false),
            soundVolume: z.enum(["low", "normal"]).default("low"),
          })
          .strict(),
      })
      .strict()
      .parse(req.body);
    await query(
      "UPDATE users SET name=$2,bio=$3,status=$4,preferences=$5 WHERE id=$1",
      [req.actor.id, b.name, b.bio, b.status, JSON.stringify(b.preferences)],
    );
    res.json({ ok: true });
  });
  app.get("/api/v1/sessions", async (req, res) => {
    assert(
      req.actor.kind === "human",
      403,
      "HUMAN_REQUIRED",
      "Compte humain requis.",
    );
    res.json({
      data: await query(
        "SELECT id,user_agent,created_at,last_seen_at,expires_at,(id=$2) current FROM user_sessions WHERE user_id=$1 ORDER BY last_seen_at DESC",
        [req.actor.id, req.actor.sessionId],
      ),
    });
  });
  app.delete("/api/v1/sessions/:id", async (req, res) => {
    assert(
      req.actor.kind === "human",
      403,
      "HUMAN_REQUIRED",
      "Compte humain requis.",
    );
    await query("DELETE FROM user_sessions WHERE id=$1 AND user_id=$2", [
      z.string().length(64).parse(req.params.id),
      req.actor.id,
    ]);
    res.json({ ok: true });
  });
  app.post("/api/v1/workspaces", async (req, res) => {
    const { name } = z
      .object({ name: z.string().trim().min(1).max(100) })
      .parse(req.body);
    res.status(201).json({ data: await createWorkspace(name, req.actor) });
  });
  app.get("/api/v1/workspaces/:workspace/notifications", async (req, res) => {
    const w = z.uuid().parse(req.params.workspace);
    await authorize(req.actor, w, "VIEW_WORKSPACE");
    res.json({
      data: await query(
        `SELECT n.* FROM notifications n WHERE n.workspace_id=$1 AND n.user_id=$2 AND n.state<>'dismissed' AND (n.type<>'task' OR COALESCE((SELECT (preferences->>'tasks')::boolean FROM users WHERE id=$2),true)) AND (n.type<>'mention' OR COALESCE((SELECT (preferences->>'mentions')::boolean FROM users WHERE id=$2),true)) AND (n.type<>'message' OR COALESCE((SELECT (preferences->>CASE WHEN EXISTS(SELECT 1 FROM channels dc WHERE dc.id=n.channel_id AND dc.is_dm) THEN 'directMessages' ELSE 'messages' END)::boolean FROM users WHERE id=$2),true)) AND (n.type<>'argos' OR 'VIEW_MONITORING'=ANY($3::text[])) AND (n.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=n.channel_id AND ${visibleChannel()})) ORDER BY n.created_at DESC LIMIT 100`,
        [w, req.actor.id, await granted(req.actor, w)],
      ),
    });
  });
  app.patch(
    "/api/v1/workspaces/:workspace/notifications/:id",
    async (req, res) => {
      const w = z.uuid().parse(req.params.workspace);
      await authorize(req.actor, w, "VIEW_WORKSPACE");
      const { state } = z
        .object({ state: z.enum(["read", "dismissed"]) })
        .parse(req.body);
      await query(
        "UPDATE notifications SET state=$4 WHERE workspace_id=$1 AND user_id=$2 AND id=$3",
        [w, req.actor.id, z.uuid().parse(req.params.id), state],
      );
      res.json({ ok: true });
    },
  );
  app.get("/api/v1/workspaces/:workspace/presence", async (req, res) => {
    const w = z.uuid().parse(req.params.workspace);
    await authorize(req.actor, w, "VIEW_WORKSPACE");
    res.json({
      data: await query(
        `SELECT DISTINCT u.id,u.name,u.status FROM users u JOIN workspace_members m ON m.user_id=u.id JOIN user_sessions s ON s.user_id=u.id WHERE m.workspace_id=$1 AND m.state='active' AND s.expires_at>now() AND s.last_seen_at>now()-interval '2 minutes' AND u.status<>'invisible' AND COALESCE((u.preferences->>'presence')::boolean,true)`,
        [w],
      ),
    });
  });
  app.get("/api/v1/workspaces/:workspace/stream", async (req, res) => {
    const w = z.uuid().parse(req.params.workspace);
    await authorize(req.actor, w, "VIEW_WORKSPACE");
    const cursor = req.get("last-event-id") || req.query.after;
    let last = cursor
      ? z.coerce.number().int().nonnegative().parse(cursor)
      : Number(
          (
            await query(
              "SELECT COALESCE(max(seq),0) seq FROM events WHERE workspace_id=$1",
              [w],
            )
          )[0].seq,
        );
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write("retry: 4000\n\n");
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (closed) return;
      try {
        await authorize(req.actor, w, "VIEW_WORKSPACE");
        if (req.actor.sessionId) {
          const [s] = await query(
            "SELECT 1 FROM user_sessions WHERE id=$1 AND expires_at>now()",
            [req.actor.sessionId],
          );
          if (!s) return res.end();
        }
        const events = await query(
          "SELECT seq,type FROM events WHERE workspace_id=$1 AND seq>$2 ORDER BY seq LIMIT 100",
          [w, last],
        );
        const rights = await granted(req.actor, w);
        for (const e of events) {
          last = Number(e.seq);
          if (
            e.type.startsWith("argos.") &&
            !rights.includes("VIEW_MONITORING")
          )
            continue;
          res.write(
            `id: ${e.seq}\ndata: ${JSON.stringify({ type: e.type === "access.updated" ? e.type : "workspace.changed" })}\n\n`,
          );
          last = Number(e.seq);
        }
        res.write(": heartbeat\n\n");
      } catch {
        res.end();
        return;
      }
      if (!closed) timer = setTimeout(tick, 2000);
    };
    req.on("close", () => {
      closed = true;
      clearTimeout(timer);
    });
    void tick();
  });
  app.use(
    "/api/v1/workspaces/:workspace",
    (req, _res, next) => {
      req.workspaceId = z.uuid().parse(req.params.workspace);
      next();
    },
    integrationRouter,
    commandRouter,
    previewRouter,
    collaborationRouter,
    chatRouter,
    adminRouter,
    storageRouter,
    resourceRouter,
  );
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "Endpoint introuvable.")),
  );
  return app;
}
export const errorHandler: express.ErrorRequestHandler = (
  error,
  req,
  res,
  _next,
) => {
  if (res.headersSent) return;
  let status = 500,
    code = "INTERNAL_ERROR",
    message = "Une erreur est survenue. Réessayez.";
  if (error instanceof KyrosTokenError) {
    status = error.retryable ? 503 : 401;
    code = error.code;
    message = error.message;
  } else if (error instanceof HttpError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else if (error instanceof z.ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" ; ");
  } else if (error?.code === "23505") {
    status = 409;
    code = "CONFLICT";
    message = "Cet élément existe déjà.";
  } else if (error?.code === "23503") {
    status = 409;
    code = "INVALID_REFERENCE";
    message = "Élément lié absent, utilisé ou appartenant à un autre espace.";
  } else if (error?.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "La requête dépasse la taille maximale.";
  } else if (error instanceof SyntaxError) {
    status = 400;
    code = "INVALID_JSON";
    message = "JSON invalide.";
  }
  if (status === 500)
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "liora",
        requestId: req.requestId,
        message: "Unhandled request failure",
        errorType: error?.constructor?.name,
        dbCode: error?.code,
      }),
    );
  res
    .status(status)
    .json({ error: { code, message, requestId: req.requestId } });
};
