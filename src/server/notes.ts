// src/server/notes.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert, HttpError } from "./errors.js";
import { unseal } from "./crypto.js";
import { moduleRequest, ModuleHttpError } from "./module-http.js";
import {
  verifyKyrosToken,
  getKyrosConfig,
  type KyrosTokenResponse,
} from "./kyros.js";
import { personalModule } from "./integrations.js";
export const notesRouter = Router();
notesRouter.use(["/notes", "/braindump"], (req, _res, next) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  next();
});
const fields = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().max(20000).default(""),
    due_at: z.iso.datetime({ offset: true }),
  })
  .strict();
export function brainDumpConfig() {
  const base = process.env.BRAINDUMP_BASE_URL?.replace(/\/$/, "") || "";
  if (!base) return null;
  const url = new URL(base);
  assert(
    !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ["https:", "http:"].includes(url.protocol),
    500,
    "BRAINDUMP_CONFIG",
    "La configuration BrainDump est invalide.",
  );
  return { base, allowPrivate: process.env.BRAINDUMP_ALLOW_PRIVATE === "true" };
}
notesRouter.get("/notes", async (req, res) => {
  const before = req.query.before ? z.uuid().parse(req.query.before) : null;
  const rows = await query(
    `SELECT * FROM personal_notes WHERE user_id=$1 AND ($2::uuid IS NULL OR (due_at,id)>(SELECT due_at,id FROM personal_notes WHERE id=$2 AND user_id=$1)) ORDER BY due_at,id LIMIT 101`,
    [req.actor.id, before],
  );
  res.json({
    data: rows.slice(0, 100),
    nextCursor: rows.length > 100 ? rows[99].id : null,
  });
});
notesRouter.post("/notes", async (req, res) => {
  const b = fields.parse(req.body);
  const [data] = await query(
    "INSERT INTO personal_notes(user_id,title,content,due_at) VALUES($1,$2,$3,$4) RETURNING *",
    [req.actor.id, b.title, b.content, b.due_at],
  );
  res.status(201).json({ data });
});
notesRouter.patch("/notes/:id", async (req, res) => {
  const b = fields.parse(req.body);
  const [data] = await query(
    "UPDATE personal_notes SET title=$3,content=$4,due_at=$5,updated_at=now() WHERE id=$1 AND user_id=$2 AND source='liora' RETURNING *",
    [z.uuid().parse(req.params.id), req.actor.id, b.title, b.content, b.due_at],
  );
  assert(data, 404, "NOT_FOUND", "Note introuvable ou gérée dans BrainDump.");
  res.json({ data });
});
notesRouter.delete("/notes/:id", async (req, res) => {
  const rows = await query(
    "DELETE FROM personal_notes WHERE id=$1 AND user_id=$2 AND source='liora' RETURNING id",
    [z.uuid().parse(req.params.id), req.actor.id],
  );
  assert(
    rows.length,
    404,
    "NOT_FOUND",
    "Note introuvable ou gérée dans BrainDump.",
  );
  res.json({ ok: true });
});
notesRouter.get("/braindump", async (req, res) => {
  const [c] = await query(
    "SELECT enabled,last_synced_at,last_error,integration_id FROM braindump_connections WHERE user_id=$1",
    [req.actor.id],
  );
  const available = await query(
    `SELECT i.id,i.name,i.workspace_id,w.name workspace_name,i.enabled,i.state,EXISTS(SELECT 1 FROM integration_grants g WHERE g.integration_id=i.id AND g.user_id=$1) connected FROM integrations i JOIN workspaces w ON w.id=i.workspace_id JOIN workspace_members m ON m.workspace_id=i.workspace_id AND m.user_id=$1 WHERE i.provider='braindump' AND i.enabled AND EXISTS(SELECT 1 FROM roles r WHERE r.id=m.role_id AND 'VIEW_WORKSPACE'=ANY(r.permissions)) ORDER BY w.name,i.name`,
    [req.actor.id],
  );
  res.json({
    configured:
      available.some((i) => i.state === "connected" && i.connected) ||
      Boolean(brainDumpConfig()),
    available,
    data: c || { enabled: false, last_synced_at: null, last_error: null },
  });
});
notesRouter.put("/braindump", async (req, res) => {
  const { enabled, integration_id } = z
    .object({
      enabled: z.boolean(),
      integration_id: z.uuid().nullable().optional(),
    })
    .strict()
    .parse(req.body);
  if (enabled && !integration_id)
    assert(
      brainDumpConfig(),
      409,
      "NOT_CONFIGURED",
      "BrainDump doit être configuré par l’opérateur.",
    );
  await transaction(async (db) => {
    const [old] = await query(
      "SELECT * FROM braindump_connections WHERE user_id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    if (enabled && integration_id) {
      const [i] = await query(
        "SELECT i.id FROM integrations i JOIN integration_grants g ON g.integration_id=i.id AND g.user_id=$1 JOIN workspace_members m ON m.workspace_id=i.workspace_id AND m.user_id=$1 JOIN roles r ON r.id=m.role_id WHERE i.id=$2 AND i.provider='braindump' AND i.enabled AND i.state='connected' AND 'VIEW_WORKSPACE'=ANY(r.permissions)",
        [req.actor.id, integration_id],
        db,
      );
      assert(
        i,
        409,
        "CONNECT_REQUIRED",
        "Connectez et autorisez votre compte BrainDump avant de lier ses notes.",
      );
    }
    await query(
      "INSERT INTO braindump_connections(user_id,enabled,integration_id) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,integration_id=EXCLUDED.integration_id,last_error=NULL,last_synced_at=CASE WHEN braindump_connections.integration_id IS DISTINCT FROM EXCLUDED.integration_id THEN NULL ELSE braindump_connections.last_synced_at END",
      [req.actor.id, enabled, integration_id ?? null],
      db,
    );
    if (!enabled || old?.integration_id !== (integration_id ?? null))
      await query(
        "DELETE FROM personal_notes WHERE user_id=$1 AND source='braindump'",
        [req.actor.id],
        db,
      );
  });
  res.json({ ok: true });
});
const dumpSchema = z.object({
  id: z.number().int().positive(),
  userId: z.string(),
  title: z.string().max(200).nullable(),
  content: z.string().max(20000),
  type: z.string(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
  archivedAt: z.string().nullable(),
});
notesRouter.post("/braindump/sync", async (req, res) => {
  const [connection] = await query(
    "SELECT * FROM braindump_connections WHERE user_id=$1",
    [req.actor.id],
  );
  assert(
    connection?.enabled,
    409,
    "DISABLED",
    "Activez le lien BrainDump pour récupérer vos notes datées.",
  );
  const [integration] = connection.integration_id
    ? await query(
        "SELECT * FROM integrations WHERE id=$1 AND provider='braindump' AND enabled",
        [connection.integration_id],
      )
    : [];
  const config = integration
    ? {
        base: integration.config.base_url,
        allowPrivate: integration.config.allow_private,
      }
    : connection.integration_id
      ? null
      : brainDumpConfig();
  assert(
    config,
    409,
    "NOT_CONFIGURED",
    "Configurez une intégration BrainDump et connectez votre compte.",
  );
  const [session] = !integration
    ? await query(
        "SELECT s.tokens,u.kyros_user_id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND s.access_expires_at>now() AND s.expires_at>now() AND NOT u.disabled",
        [req.actor.sessionId, req.actor.id],
      )
    : [null];
  assert(
    integration || session,
    401,
    "SESSION_EXPIRED",
    "La session Kyros doit être renouvelée.",
  );
  try {
    let subject: string;
    let payload: unknown;
    if (integration) {
      const remote = await personalModule(
        req,
        integration.id,
        integration.workspace_id,
        "braindump",
        "/api/integrations/notes",
      );
      const [user] = await query(
        "SELECT kyros_user_id FROM users WHERE id=$1",
        [req.actor.id],
      );
      assert(
        remote.sub === user.kyros_user_id &&
          remote.identity_issuer === getKyrosConfig().issuer,
        403,
        "IDENTITY_MISMATCH",
        "Compte BrainDump différent du compte Liora.",
      );
      subject = user.kyros_user_id;
      payload = remote.data;
    } else {
      assert(
        session,
        401,
        "SESSION_EXPIRED",
        "La session Kyros doit être renouvelée.",
      );
      const tokens = await unseal<KyrosTokenResponse>(session.tokens);
      const claims = await verifyKyrosToken(tokens.access_token);
      assert(
        claims.sub === session.kyros_user_id,
        403,
        "IDENTITY_MISMATCH",
        "Identité Kyros invalide.",
      );
      payload = await moduleRequest(
        config.base,
        "/api/braindump/dumps?type=note&limit=500",
        { key: tokens.access_token, allowPrivate: config.allowPrivate },
      );
      subject = session.kyros_user_id;
    }
    const dumps = z.array(dumpSchema).max(500).parse(payload);
    assert(
      dumps.every((d) => d.userId === subject && d.type === "note"),
      502,
      "IDENTITY_MISMATCH",
      "BrainDump a renvoyé des notes incompatibles avec votre compte.",
    );
    assert(
      integration ? dumps.length <= 500 : dumps.length < 500,
      409,
      "TOO_MANY_NOTES",
      "BrainDump atteint la limite de 500 notes. La synchronisation est conservée sans modification ; réduisez les notes actives avant de réessayer.",
    );
    const notes = dumps.filter((d) => d.dueAt && !d.archivedAt);
    await transaction(async (db) => {
      if (integration) {
        const [active] = await query(
          "SELECT i.id FROM integrations i JOIN integration_grants g ON g.integration_id=i.id AND g.user_id=$1 JOIN workspace_members m ON m.workspace_id=i.workspace_id AND m.user_id=$1 JOIN roles r ON r.id=m.role_id WHERE i.id=$2 AND i.revision=$3 AND i.enabled AND 'VIEW_WORKSPACE'=ANY(r.permissions) FOR UPDATE OF i,g",
          [req.actor.id, integration.id, integration.revision],
          db,
        );
        assert(
          active,
          409,
          "CONFIG_CHANGED",
          "La connexion BrainDump a changé. Relancez la récupération.",
        );
      }
      const [current] = await query(
        "SELECT enabled,integration_id FROM braindump_connections WHERE user_id=$1 FOR UPDATE",
        [req.actor.id],
        db,
      );
      assert(
        current?.enabled &&
          current.integration_id === connection.integration_id,
        409,
        "DISABLED",
        "Le lien BrainDump a été désactivé.",
      );
      for (const n of notes)
        await query(
          `INSERT INTO personal_notes(user_id,title,content,due_at,source,source_id,source_base,created_at,updated_at) VALUES($1,$2,$3,$4,'braindump',$5,$6,$7,$8) ON CONFLICT(user_id,source_base,source_id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,due_at=EXCLUDED.due_at,updated_at=EXCLUDED.updated_at`,
          [
            req.actor.id,
            n.title?.trim() ||
              n.content.split("\n")[0].trim().slice(0, 200) ||
              "Note BrainDump",
            n.content,
            n.dueAt,
            n.id,
            config.base,
            n.createdAt,
            n.updatedAt,
          ],
          db,
        );
      await query(
        "DELETE FROM personal_notes WHERE user_id=$1 AND source='braindump' AND (source_base<>$2 OR NOT (source_id=ANY($3::int[])))",
        [req.actor.id, config.base, notes.map((n) => n.id)],
        db,
      );
      await query(
        "UPDATE braindump_connections SET last_synced_at=now(),last_error=NULL WHERE user_id=$1",
        [req.actor.id],
        db,
      );
    });
    res.json({ ok: true, count: notes.length });
  } catch (e) {
    if (
      integration &&
      e instanceof ModuleHttpError &&
      [401, 403].includes(e.status)
    ) {
      await transaction(async (db) => {
        const rows = await query(
          "UPDATE braindump_connections SET enabled=false,last_error='Autorisation BrainDump retirée ou clé refusée. Reconnectez votre compte.' WHERE user_id=$1 AND integration_id=$2 RETURNING user_id",
          [req.actor.id, integration.id],
          db,
        );
        await query(
          "DELETE FROM integration_grants WHERE user_id=$1 AND integration_id=$2",
          [req.actor.id, integration.id],
          db,
        );
        if (rows.length)
          await query(
            "DELETE FROM personal_notes WHERE user_id=$1 AND source='braindump'",
            [req.actor.id],
            db,
          );
      });
      throw new HttpError(
        409,
        "CONNECT_REQUIRED",
        "Autorisation BrainDump retirée ou clé refusée. Reconnectez votre compte.",
      );
    }
    const message =
      e instanceof HttpError
        ? e.message
        : "BrainDump est inaccessible ou refuse l’accès Kyros. Vos dernières notes restent disponibles.";
    await query(
      "UPDATE braindump_connections SET last_error=$2 WHERE user_id=$1",
      [req.actor.id, message],
    );
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, "BRAINDUMP_UNAVAILABLE", message);
  }
});
