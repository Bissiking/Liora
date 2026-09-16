// src/server/integrations.ts
import { Router, type Request } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import { channelAccess } from "./access.js";
import { assert } from "./errors.js";
import { token, hash, seal, unseal } from "./crypto.js";
import { audit, emit } from "./events.js";
import { getKyrosConfig } from "./kyros.js";
import { moduleRequest } from "./module-http.js";
const configSchema = z
  .object({
    base_url: z.url().max(1000),
    client_id: z.string().max(100).default(""),
    allow_private: z.boolean().default(false),
  })
  .strict();
const schema = z
  .object({
    name: z.string().trim().min(1).max(80),
    provider: z.enum(["dropit", "github", "nino", "narra", "argos", "generic"]),
    config: configSchema,
    api_key: z
      .string()
      .min(16)
      .max(4000)
      .regex(/^[!-~]+$/)
      .optional(),
    channel_id: z.uuid(),
  })
  .strict();
const callback = () => `${process.env.APP_URL}/api/v1/integration-callback`;
async function human(req: Request) {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
}
async function manage(req: Request) {
  await human(req);
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_WORKSPACE");
  await authorize(req.actor, w, "MANAGE_WEBHOOK");
  return w;
}
async function validateConfig(req: Request, c: z.infer<typeof configSchema>) {
  const u = new URL(c.base_url);
  assert(
    ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash,
    400,
    "INVALID_URL",
    "URL de module invalide.",
  );
  if (c.allow_private)
    await authorize(
      req.actor,
      z.uuid().parse(req.workspaceId),
      "MANAGE_SECURITY",
    );
  else
    assert(
      u.protocol === "https:",
      400,
      "HTTPS_REQUIRED",
      "Une URL HTTPS est requise.",
    );
}
const fields =
  "id,provider,name,config,state,enabled,revision,last_checked_at,last_error,secret IS NOT NULL has_key";
export const integrationRouter = Router({ mergeParams: true });
integrationRouter.get("/connectors", async (req, res) => {
  const w = await manage(req);
  res.json({
    data: await query(
      `SELECT ${fields} FROM integrations WHERE workspace_id=$1 ORDER BY name`,
      [w],
    ),
    callback_url: callback(),
  });
});
integrationRouter.post("/connectors", async (req, res) => {
  const w = await manage(req),
    b = schema.parse(req.body);
  await validateConfig(req, b.config);
  await authorize(req.actor, w, "CREATE_WEBHOOK");
  const ch = await channelAccess(req.actor, w, b.channel_id);
  assert(!ch.is_dm, 403, "DM_PROTECTED", "Choisissez un salon d’équipe.");
  const raw = token(),
    signing = token();
  const data = await transaction(async (db) => {
    const [i] = await query(
      `INSERT INTO integrations(workspace_id,provider,name,config,secret) VALUES($1,$2,$3,$4,$5) RETURNING ${fields}`,
      [
        w,
        b.provider,
        b.name,
        JSON.stringify(b.config),
        b.api_key ? await seal(b.api_key) : null,
      ],
      db,
    );
    const [t] = await query(
      "INSERT INTO technical_accounts(workspace_id,name,kind) VALUES($1,$2,'service') RETURNING id",
      [w, b.name],
      db,
    );
    await query(
      "INSERT INTO webhooks(workspace_id,channel_id,technical_id,name,token_hash,integration_id,hmac_secret,signature_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        w,
        ch.id,
        t.id,
        b.name,
        hash(raw),
        i.id,
        await seal(signing),
        b.provider === "github" ? "github" : "liora",
      ],
      db,
    );
    await audit(w, req.actor.id, "integration.created", i.id, db);
    return i;
  });
  res.status(201).json({
    data,
    incoming_url: `${process.env.APP_URL}/api/webhooks/${raw}`,
    signing_secret: signing,
  });
});
integrationRouter.patch("/connectors/:id", async (req, res) => {
  const w = await manage(req),
    id = z.uuid().parse(req.params.id);
  const b = z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      enabled: z.boolean().optional(),
      config: configSchema.optional(),
      api_key: z
        .string()
        .min(16)
        .max(4000)
        .regex(/^[!-~]+$/)
        .optional(),
    })
    .strict()
    .parse(req.body);
  if (b.config) await validateConfig(req, b.config);
  await transaction(async (db) => {
    const [old] = await query(
      "SELECT * FROM integrations WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
      [w, id],
      db,
    );
    assert(old, 404, "NOT_FOUND", "Intégration introuvable.");
    const credentialsChanged =
      b.api_key !== undefined ||
      (b.config !== undefined &&
        ["base_url", "client_id", "allow_private"].some(
          (k) => b.config![k as keyof typeof b.config] !== old.config[k],
        ));
    await query(
      "UPDATE integrations SET name=$3,enabled=$4,config=$5,secret=$6,revision=revision+1,state=$7,last_error=NULL WHERE id=$1 AND workspace_id=$2",
      [
        id,
        w,
        b.name ?? old.name,
        b.enabled ?? old.enabled,
        JSON.stringify(b.config ?? old.config),
        b.api_key ? await seal(b.api_key) : old.secret,
        credentialsChanged ? "unconfigured" : old.state,
      ],
      db,
    );
    if (credentialsChanged || b.enabled === false) {
      await query(
        "DELETE FROM integration_grants WHERE integration_id=$1",
        [id],
        db,
      );
      await query(
        "DELETE FROM integration_attempts WHERE integration_id=$1",
        [id],
        db,
      );
    }
    await audit(w, req.actor.id, "integration.updated", id, db);
    await emit(w, "integrations.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
integrationRouter.post("/connectors/:id/incoming-key", async (req, res) => {
  const w = await manage(req),
    id = z.uuid().parse(req.params.id);
  const b = z
    .object({
      signature_mode: z.enum(["liora", "github", "none"]).default("liora"),
    })
    .strict()
    .parse(req.body);
  const raw = token(),
    signing = token();
  const [i] = await query(
    "SELECT provider FROM integrations WHERE id=$1 AND workspace_id=$2",
    [id, w],
  );
  assert(i, 404, "NOT_FOUND", "Intégration introuvable.");
  assert(
    i.provider !== "github" || b.signature_mode === "github",
    400,
    "SIGNATURE_REQUIRED",
    "GitHub exige sa signature SHA-256.",
  );
  const rows = await query(
    "UPDATE webhooks SET token_hash=$3,hmac_secret=$4,signature_mode=$5,revoked=false WHERE integration_id=$1 AND workspace_id=$2 RETURNING id",
    [id, w, hash(raw), await seal(signing), b.signature_mode],
  );
  assert(rows.length, 404, "NOT_FOUND", "Webhook introuvable.");
  await audit(w, req.actor.id, "integration.key_rotated", id);
  res.json({
    incoming_url: `${process.env.APP_URL}/api/webhooks/${raw}`,
    signing_secret: b.signature_mode === "none" ? null : signing,
  });
});
integrationRouter.post("/connectors/:id/test", async (req, res) => {
  const w = await manage(req),
    id = z.uuid().parse(req.params.id);
  const [i] = await query(
    "SELECT * FROM integrations WHERE id=$1 AND workspace_id=$2",
    [id, w],
  );
  assert(i?.enabled, 409, "DISABLED", "Activez le module pour le tester.");
  try {
    const remote = await moduleRequest(
      i.config.base_url,
      i.provider === "dropit"
        ? "/api/integrations/capabilities"
        : i.provider === "github"
          ? "/user"
          : "/health",
      {
        key: i.secret ? await unseal<string>(i.secret) : undefined,
        allowPrivate: i.config.allow_private,
      },
    );
    if (i.provider === "dropit")
      assert(
        remote.client_id === i.config.client_id &&
          remote.identity_issuer === getKyrosConfig().issuer,
        400,
        "CLIENT_MISMATCH",
        "La clé ne correspond pas au client DropIt.",
      );
    await query(
      "UPDATE integrations SET state='connected',last_error=NULL,last_checked_at=now() WHERE id=$1 AND revision=$2",
      [id, i.revision],
    );
    res.json({ ok: true });
  } catch {
    await query(
      "UPDATE integrations SET state='error',last_error='Module inaccessible, clé refusée ou réponse incompatible',last_checked_at=now() WHERE id=$1 AND revision=$2",
      [id, i.revision],
    );
    res.status(502).json({
      error: {
        code: "MODULE_UNAVAILABLE",
        message: "Module inaccessible, clé refusée ou réponse incompatible.",
      },
    });
  }
});
integrationRouter.get("/connectors/:id/rules", async (req, res) => {
  const w = await manage(req);
  res.json({
    data: await query(
      "SELECT * FROM integration_rules WHERE workspace_id=$1 AND integration_id=$2 ORDER BY created_at",
      [w, z.uuid().parse(req.params.id)],
    ),
  });
});
integrationRouter.post("/connectors/:id/rules", async (req, res) => {
  const w = await manage(req),
    id = z.uuid().parse(req.params.id);
  const b = z
    .object({
      name: z.string().trim().min(1).max(80),
      event_pattern: z
        .string()
        .regex(/^(\*|[a-z][a-z0-9_.]*(\.\*)?)$/)
        .max(110),
      severity: z
        .enum(["", "info", "warning", "error", "critical"])
        .default(""),
      channel_id: z.uuid(),
      column_id: z.uuid().nullable().default(null),
    })
    .strict()
    .parse(req.body);
  const [i] = await query(
    "SELECT id FROM integrations WHERE workspace_id=$1 AND id=$2",
    [w, id],
  );
  assert(i, 404, "NOT_FOUND", "Intégration introuvable.");
  const ch = await channelAccess(req.actor, w, b.channel_id);
  assert(
    !ch.is_dm,
    403,
    "DM_PROTECTED",
    "Les règles utilisent un salon d’équipe.",
  );
  await authorize(req.actor, w, "SEND_MESSAGE");
  if (b.column_id) {
    await authorize(req.actor, w, "CREATE_TASK");
    const [c] = await query(
      "SELECT id FROM board_columns WHERE id=$1 AND workspace_id=$2",
      [b.column_id, w],
    );
    assert(c, 400, "INVALID_COLUMN", "Colonne introuvable.");
  }
  const data = await transaction(async (db) => {
    await query("SELECT id FROM integrations WHERE id=$1 FOR UPDATE", [id], db);
    const [{ count }] = await query(
      "SELECT count(*) FROM integration_rules WHERE integration_id=$1",
      [id],
      db,
    );
    assert(
      Number(count) < 30,
      400,
      "RULE_LIMIT",
      "30 règles maximum par module.",
    );
    const [r] = await query(
      "INSERT INTO integration_rules(workspace_id,integration_id,name,event_pattern,severity,channel_id,column_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [w, id, b.name, b.event_pattern, b.severity, b.channel_id, b.column_id],
      db,
    );
    await audit(w, req.actor.id, "integration.rule_created", r.id, db);
    return r;
  });
  res.status(201).json({ data });
});
integrationRouter.delete("/connectors/:id/rules/:rule", async (req, res) => {
  const w = await manage(req);
  await query(
    "DELETE FROM integration_rules WHERE workspace_id=$1 AND integration_id=$2 AND id=$3",
    [w, z.uuid().parse(req.params.id), z.uuid().parse(req.params.rule)],
  );
  await audit(
    w,
    req.actor.id,
    "integration.rule_deleted",
    String(req.params.rule),
  );
  res.json({ ok: true });
});
integrationRouter.get("/connections", async (req, res) => {
  await human(req);
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  res.json({
    data: await query(
      "SELECT i.id,i.name,i.provider,i.enabled,i.state,EXISTS(SELECT 1 FROM integration_grants g WHERE g.integration_id=i.id AND g.user_id=$2) connected FROM integrations i WHERE i.workspace_id=$1 AND i.provider='dropit' ORDER BY i.name",
      [w, req.actor.id],
    ),
  });
});
integrationRouter.post("/connections/:id/start", async (req, res) => {
  await human(req);
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const [i] = await query(
    "SELECT * FROM integrations WHERE id=$1 AND workspace_id=$2 AND enabled AND provider='dropit'",
    [z.uuid().parse(req.params.id), w],
  );
  assert(
    i?.secret && i.config.client_id,
    409,
    "NOT_CONFIGURED",
    "Un admin doit configurer et tester DropIt.",
  );
  assert(
    i.state === "connected",
    409,
    "NOT_TESTED",
    "Un admin doit tester cette connexion.",
  );
  const state = token(),
    verifier = token();
  await query("DELETE FROM integration_attempts WHERE expires_at<now()");
  await query(
    "INSERT INTO integration_attempts(id,user_id,integration_id,revision,verifier) VALUES($1,$2,$3,$4,$5)",
    [hash(state), req.actor.id, i.id, i.revision, await seal(verifier)],
  );
  const u = new URL(i.config.base_url + "/integrations/authorize");
  u.search = new URLSearchParams({
    client_id: i.config.client_id,
    redirect_uri: callback(),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  }).toString();
  res.json({ url: u.toString() });
});
async function personal(req: Request, route: string, body?: unknown) {
  await human(req);
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const access = await transaction(async (db) => {
    const [i] = await query(
      "SELECT i.*,g.tokens,g.expires_at FROM integrations i JOIN integration_grants g ON g.integration_id=i.id WHERE i.id=$1 AND i.workspace_id=$2 AND i.enabled AND i.provider='dropit' AND g.user_id=$3 FOR UPDATE OF g",
      [z.uuid().parse(req.params.id), w, req.actor.id],
      db,
    );
    assert(i, 409, "CONNECT_REQUIRED", "Connectez votre compte DropIt.");
    let tokens = await unseal<any>(i.tokens);
    const key = await unseal<string>(i.secret);
    const options = { key, allowPrivate: i.config.allow_private };
    if (new Date(i.expires_at).getTime() < Date.now() + 60000) {
      tokens = await moduleRequest(
        i.config.base_url,
        "/api/integrations/token",
        {
          ...options,
          body: {
            grant_type: "refresh_token",
            refresh_token: tokens.refresh_token,
          },
        },
      );
      assert(
        typeof tokens.access_token === "string" &&
          typeof tokens.refresh_token === "string" &&
          Number.isFinite(tokens.expires_in) &&
          tokens.expires_in > 0 &&
          tokens.expires_in <= 3600,
        502,
        "INVALID_TOKENS",
        "Réponse de connexion DropIt invalide.",
      );
      const [u] = await query(
        "SELECT kyros_user_id FROM users WHERE id=$1",
        [req.actor.id],
        db,
      );
      assert(
        tokens.sub === u.kyros_user_id &&
          tokens.identity_issuer === getKyrosConfig().issuer,
        403,
        "IDENTITY_MISMATCH",
        "Compte distant différent.",
      );
      await query(
        "UPDATE integration_grants SET tokens=$3,expires_at=$4 WHERE integration_id=$1 AND user_id=$2",
        [
          i.id,
          req.actor.id,
          await seal(tokens),
          new Date(Date.now() + Number(tokens.expires_in) * 1000),
        ],
        db,
      );
    }
    return {
      base: i.config.base_url,
      options: { ...options, userToken: tokens.access_token },
    };
  });
  return moduleRequest(access.base, route, { ...access.options, body });
}
integrationRouter.get("/connections/:id/files", async (req, res) => {
  const after = z.string().max(200).optional().parse(req.query.after);
  res.json(
    await personal(
      req,
      `/api/integrations/files${after ? "?after=" + encodeURIComponent(after) : ""}`,
    ),
  );
});
integrationRouter.post(
  "/connections/:id/shares/:share/link",
  async (req, res) => {
    res.json(
      await personal(
        req,
        `/api/integrations/shares/${z.uuid().parse(req.params.share)}/link`,
        {},
      ),
    );
  },
);
integrationRouter.delete("/connections/:id", async (req, res) => {
  await human(req);
  const w = z.uuid().parse(req.workspaceId),
    id = z.uuid().parse(req.params.id);
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const [i] = await query(
    "SELECT i.*,g.tokens FROM integrations i JOIN integration_grants g ON i.id=g.integration_id WHERE i.id=$1 AND i.workspace_id=$2 AND g.user_id=$3",
    [id, w, req.actor.id],
  );
  if (i) {
    try {
      const tokens = await unseal<any>(i.tokens);
      await moduleRequest(i.config.base_url, "/api/integrations/revoke", {
        key: await unseal<string>(i.secret),
        allowPrivate: i.config.allow_private,
        body: { refresh_token: tokens.refresh_token },
      });
    } catch {
      /* Local revocation remains effective when the module is unavailable. */
    }
    await query(
      "DELETE FROM integration_grants WHERE integration_id=$1 AND user_id=$2",
      [id, req.actor.id],
    );
  }
  res.json({ ok: true });
});
export const integrationCallback = Router();
integrationCallback.get("/integration-callback", async (req, res) => {
  await human(req);
  const state = z.string().min(30).max(100).parse(req.query.state),
    code = z.string().min(30).max(100).parse(req.query.code);
  const connectedWorkspace = await transaction(async (db) => {
    const [a] = await query(
      "SELECT a.*,i.config,i.secret,i.workspace_id,i.enabled,i.revision current_revision FROM integration_attempts a JOIN integrations i ON i.id=a.integration_id WHERE a.id=$1 AND a.user_id=$2 AND a.expires_at>now() FOR UPDATE OF a",
      [hash(state), req.actor.id],
      db,
    );
    assert(
      a?.enabled && a.revision === a.current_revision,
      400,
      "INVALID_ATTEMPT",
      "Connexion expirée ou configuration modifiée.",
    );
    await authorize(req.actor, a.workspace_id, "VIEW_WORKSPACE");
    const tokens = await moduleRequest(
      a.config.base_url,
      "/api/integrations/token",
      {
        key: await unseal<string>(a.secret),
        allowPrivate: a.config.allow_private,
        body: {
          grant_type: "authorization_code",
          code,
          redirect_uri: callback(),
          code_verifier: await unseal<string>(a.verifier),
        },
      },
    );
    const [u] = await query(
      "SELECT kyros_user_id FROM users WHERE id=$1",
      [req.actor.id],
      db,
    );
    assert(
      tokens.sub === u.kyros_user_id &&
        tokens.identity_issuer === getKyrosConfig().issuer,
      403,
      "IDENTITY_MISMATCH",
      "Connectez le même compte Kyros dans DropIt et Liora.",
    );
    assert(
      typeof tokens.access_token === "string" &&
        typeof tokens.refresh_token === "string" &&
        Number.isFinite(tokens.expires_in) &&
        tokens.expires_in > 0 &&
        tokens.expires_in <= 3600,
      502,
      "INVALID_MODULE",
      "Jetons distants invalides.",
    );
    await query(
      "INSERT INTO integration_grants(integration_id,user_id,subject,tokens,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(integration_id,user_id) DO UPDATE SET subject=$3,tokens=$4,expires_at=$5",
      [
        a.integration_id,
        req.actor.id,
        tokens.sub,
        await seal(tokens),
        new Date(Date.now() + tokens.expires_in * 1000),
      ],
      db,
    );
    await query("DELETE FROM integration_attempts WHERE id=$1", [a.id], db);
    await audit(
      a.workspace_id,
      req.actor.id,
      "integration.connected",
      a.integration_id,
      db,
    );
    return a.workspace_id;
  });
  res.redirect(
    "/#connected=dropit&workspace=" + encodeURIComponent(connectedWorkspace),
  );
});
// Monitoring URLs already live in PostgreSQL; expose their administration without editing deployment variables.
integrationRouter.get("/monitoring-settings", async (req, res) => {
  await human(req);
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MONITORING");
  res.json({
    data: await query(
      "SELECT id,name,kind,url,state FROM monitoring_targets WHERE workspace_id=$1 ORDER BY name",
      [w],
    ),
  });
});
integrationRouter.patch("/monitoring-settings/:id", async (req, res) => {
  await human(req);
  const w = z.uuid().parse(req.workspaceId);
  await authorize(req.actor, w, "MANAGE_MONITORING");
  await authorize(req.actor, w, "MANAGE_SECURITY");
  const { url } = z
    .object({ url: z.union([z.url().max(1000), z.literal("")]) })
    .strict()
    .parse(req.body);
  if (url) {
    const u = new URL(url);
    assert(
      ["https:", "http:"].includes(u.protocol) &&
        !u.username &&
        !u.password &&
        !u.hash,
      400,
      "INVALID_URL",
      "URL HTTP(S) sans identifiants requise.",
    );
  }
  const rows = await query(
    "UPDATE monitoring_targets SET url=$3,state='unknown' WHERE workspace_id=$1 AND id=$2 AND kind='http' RETURNING id",
    [w, z.uuid().parse(req.params.id), url || null],
  );
  assert(rows.length, 404, "NOT_FOUND", "Cible HTTP introuvable.");
  await audit(w, req.actor.id, "monitoring.configured", String(req.params.id));
  res.json({ ok: true });
});
