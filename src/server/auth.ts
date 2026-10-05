// src/server/auth.ts
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { query, transaction } from "./db.js";
import { token, hash, seal, unseal } from "./crypto.js";
import { assert, HttpError } from "./errors.js";
import {
  kyrosAvatar,
  createPkce,
  createAuthorizationRequest,
  exchangeAuthorizationCode,
  verifyKyrosToken,
  refreshKyrosTokens,
  revokeKyrosToken,
  KyrosTokenError,
  type KyrosTokenResponse,
} from "./kyros.js";
import { permissions, type Permission } from "../shared/permissions.js";
export type Actor = {
  id: string;
  kind: "human" | "bot" | "service";
  sessionId?: string;
  workspace?: string;
  permissions?: string[];
  name?: string;
};
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      actor: Actor;
      requestId: string;
      workspaceId: string;
    }
  }
}
const cookie = "liora_session";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (bearer) {
    const [bot] = await query(
      "UPDATE technical_accounts SET last_used_at=now() WHERE token_hash=$1 AND NOT revoked RETURNING id,kind,workspace_id,permissions,name",
      [hash(bearer)],
    );
    assert(bot, 401, "INVALID_TOKEN", "Jeton invalide ou révoqué.");
    req.actor = {
      id: bot.id,
      kind: bot.kind,
      workspace: bot.workspace_id,
      permissions: bot.permissions,
      name: bot.name,
    };
    return next();
  }
  const raw = req.cookies[cookie];
  assert(
    typeof raw === "string",
    401,
    "LOGIN_REQUIRED",
    "Connectez-vous avec Kyros.",
  );
  const sid = hash(raw);
  const session = await transaction(async (db) => {
    const [s] = await query(
      "SELECT s.*,u.kyros_user_id,u.disabled,u.name FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 FOR UPDATE OF s",
      [sid],
      db,
    );
    if (!s || s.disabled || new Date(s.expires_at).getTime() <= Date.now())
      return null;
    if (new Date(s.access_expires_at).getTime() < Date.now() + 120000) {
      try {
        const old = await unseal<KyrosTokenResponse>(s.tokens);
        const fresh = await refreshKyrosTokens(old.refresh_token);
        const claims = await verifyKyrosToken(fresh.access_token);
        if (claims.sub !== s.kyros_user_id) {
          await query("DELETE FROM user_sessions WHERE id=$1", [sid], db);
          return null;
        }
        await query(
          "UPDATE user_sessions SET tokens=$2,access_expires_at=$3,expires_at=$4 WHERE id=$1",
          [
            sid,
            await seal(fresh),
            new Date(Number(claims.exp) * 1000),
            fresh.refresh_token_expires_at,
          ],
          db,
        );
        await query(
          "UPDATE users SET kyros_avatar_url=$2,avatar=CASE WHEN avatar_key IS NULL THEN CASE WHEN $2::text IS NULL THEN NULL ELSE '/api/v1/avatars/'||id::text||'?kyros=1' END ELSE avatar END WHERE id=$1",
          [s.user_id, kyrosAvatar(claims)],
          db,
        );
        s.expires_at = fresh.refresh_token_expires_at;
      } catch (e) {
        if (e instanceof KyrosTokenError && !e.retryable) {
          await query("DELETE FROM user_sessions WHERE id=$1", [sid], db);
          return null;
        }
        if (new Date(s.access_expires_at).getTime() <= Date.now())
          throw new HttpError(
            503,
            "AUTH_UNAVAILABLE",
            "Kyros est temporairement indisponible. Votre session est conservée.",
          );
      }
    }
    await query(
      "UPDATE user_sessions SET last_seen_at=now() WHERE id=$1",
      [sid],
      db,
    );
    return s;
  });
  assert(session, 401, "SESSION_EXPIRED", "Votre session a expiré.");
  res.cookie(cookie, raw, {
    ...cookieOptions(),
    maxAge: Math.max(0, new Date(session.expires_at).getTime() - Date.now()),
  });
  req.actor = {
    id: session.user_id,
    kind: "human",
    sessionId: sid,
    name: session.name,
  };
  next();
}
export async function authorize(
  actor: Actor,
  workspace: string,
  permission: Permission,
) {
  if (actor.kind !== "human") {
    assert(
      actor.workspace === workspace && actor.permissions?.includes(permission),
      403,
      "FORBIDDEN",
      "Permission insuffisante.",
    );
    return;
  }
  const [role] = await query(
    "SELECT r.permissions FROM workspace_members m JOIN roles r ON r.id=m.role_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.state='active'",
    [workspace, actor.id],
  );
  assert(
    role?.permissions.includes(permission),
    403,
    "FORBIDDEN",
    "Vous ne disposez pas de cette permission.",
  );
}
export const authRouter = Router();
authRouter.get("/login", async (req, res) => {
  const pkce = createPkce();
  const state = token();
  const authorizeUrl = await createAuthorizationRequest(state, pkce.challenge);
  await query("DELETE FROM auth_attempts WHERE expires_at<now()");
  await query(
    "INSERT INTO auth_attempts(id,verifier,expires_at) VALUES($1,$2,now()+interval '10 minutes')",
    [hash(state), await seal(pkce.verifier)],
  );
  res.cookie("liora_auth", state, { ...cookieOptions(), maxAge: 600000 });
  res.redirect(authorizeUrl.toString());
});
authRouter.get("/callback", async (req, res) => {
  res.clearCookie("liora_auth", cookieOptions());
  assert(
    typeof req.query.state === "string" &&
      req.query.state === req.cookies.liora_auth,
    400,
    "INVALID_STATE",
    "La tentative de connexion est invalide.",
  );
  assert(
    typeof req.query.iss === "string" &&
      req.query.iss ===
        (process.env.KYROS_ISSUER ||
          process.env.KYROS_BASE_URL?.replace(/\/$/, "")),
    400,
    "INVALID_ISSUER",
    "Émetteur Kyros invalide.",
  );
  assert(
    typeof req.query.code === "string",
    400,
    "MISSING_CODE",
    "Code Kyros absent.",
  );
  const [attempt] = await query(
    "DELETE FROM auth_attempts WHERE id=$1 AND expires_at>now() RETURNING verifier",
    [hash(req.query.state)],
  );
  assert(attempt, 400, "AUTH_EXPIRED", "La tentative de connexion a expiré.");
  const tokens = await exchangeAuthorizationCode(
    req.query.code,
    await unseal<string>(attempt.verifier),
  );
  const claims = await verifyKyrosToken(tokens.access_token);
  const raw = token();
  await transaction(async (db) => {
    const [user] = await query(
      `INSERT INTO users(kyros_user_id,name,kyros_avatar_url,last_login_at) VALUES($1,$2,$3,now()) ON CONFLICT(kyros_user_id) DO UPDATE SET last_login_at=now(),kyros_avatar_url=EXCLUDED.kyros_avatar_url RETURNING *`,
      [
        claims.sub,
        String(
          claims.name ||
            claims.username ||
            claims.preferred_username ||
            "Membre LUMA",
        ).slice(0, 80),
        kyrosAvatar(claims),
      ],
      db,
    );
    await query(
      "UPDATE users SET avatar=CASE WHEN $2::text IS NULL THEN NULL ELSE '/api/v1/avatars/'||id::text||'?kyros=1' END WHERE id=$1 AND avatar_key IS NULL",
      [user.id, kyrosAvatar(claims)],
      db,
    );
    assert(!user.disabled, 403, "ACCOUNT_DISABLED", "Ce compte est désactivé.");
    if (claims.sub === process.env.BOOTSTRAP_OWNER_KYROS_ID)
      await query(
        `INSERT INTO workspace_members(workspace_id,user_id,role_id) SELECT r.workspace_id,$1,r.id FROM roles r WHERE r.is_owner AND NOT EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=r.workspace_id) ON CONFLICT DO NOTHING`,
        [user.id],
        db,
      );
    await query(
      "INSERT INTO user_sessions(id,user_id,tokens,access_expires_at,expires_at,user_agent) VALUES($1,$2,$3,$4,$5,$6)",
      [
        hash(raw),
        user.id,
        await seal(tokens),
        new Date(Number(claims.exp) * 1000),
        tokens.refresh_token_expires_at,
        req.headers["user-agent"]?.slice(0, 300),
      ],
      db,
    );
  });
  res.cookie(cookie, raw, {
    ...cookieOptions(),
    maxAge: Math.max(
      0,
      new Date(tokens.refresh_token_expires_at).getTime() - Date.now(),
    ),
  });
  res.redirect("/");
});
authRouter.post("/refresh", authenticate, (_req, res) =>
  res.json({ ok: true }),
);
authRouter.post("/logout", async (req, res) => {
  const raw = req.cookies[cookie];
  if (typeof raw === "string") {
    const [s] = await query(
      "DELETE FROM user_sessions WHERE id=$1 RETURNING tokens",
      [hash(raw)],
    );
    if (s) {
      try {
        await revokeKyrosToken(
          (await unseal<KyrosTokenResponse>(s.tokens)).refresh_token,
        );
      } catch {
        /* local revocation is unconditional */
      }
    }
  }
  res.clearCookie(cookie, cookieOptions());
  res.json({ ok: true });
});
export async function createWorkspace(name: string, actor: Actor) {
  assert(
    actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Action réservée aux membres.",
  );
  return transaction(async (db) => {
    const [w] = await query(
      "INSERT INTO workspaces(name) VALUES($1) RETURNING *",
      [name],
      db,
    );
    const [r] = await query(
      "INSERT INTO roles(workspace_id,name,permissions,is_owner) VALUES($1,'Owner',$2,true) RETURNING id",
      [w.id, [...permissions]],
      db,
    );
    await query(
      "INSERT INTO workspace_members(workspace_id,user_id,role_id) VALUES($1,$2,$3)",
      [w.id, actor.id, r.id],
      db,
    );
    await query(
      "INSERT INTO feature_flags(workspace_id,key) VALUES($1,'jellyfin.enabled'),($1,'media_requests.enabled')",
      [w.id],
      db,
    );
    return w;
  });
}
