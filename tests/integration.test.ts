// tests/integration.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import pg from "pg";
import { fakeKyros } from "./fixtures/kyros.js";
import type { Server } from "node:http";
process.env.NODE_ENV = "test";
process.env.ARGOS_BASE_URL = "";
process.env.ARGUS_HEALTH_URL = "";
const origin = "http://127.0.0.1:14310";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://matheohemery@127.0.0.1:55432/liora_test";
process.env.APP_URL = origin;
process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
process.env.KYROS_CLIENT_ID = "liora-test";
process.env.KYROS_SCOPES = "profile email offline_access";
process.env.KYROS_BASE_URL = "http://127.0.0.1:14312";
process.env.BOOTSTRAP_OWNER_KYROS_ID = "test-owner";
process.env.KYROS_RESOURCE_AUDIENCE = "kyros:liora";
process.env.KYROS_ISSUER = "";
let server: Server,
  provider: Awaited<ReturnType<typeof fakeKyros>>,
  db: typeof import("../src/server/db.js"),
  cookie = "",
  workspace = "",
  channel = "",
  memberCookie = "",
  memberId = "",
  technicalToken = "",
  accountId = "",
  webhookUrl = "",
  column = "",
  message = "";
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  auth = cookie,
) {
  const res = await fetch(`${origin}${path}`, {
    method,
    headers: {
      origin,
      ...(auth.startsWith("Bearer ")
        ? { authorization: auth }
        : { cookie: auth }),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
async function login() {
  let response = await fetch(`${origin}/auth/login`, { redirect: "manual" });
  assert.equal(response.status, 302);
  const auth = response.headers.getSetCookie()[0].split(";")[0];
  response = await fetch(response.headers.get("location")!, {
    redirect: "manual",
  });
  response = await fetch(response.headers.get("location")!, {
    headers: { cookie: auth },
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  return response.headers
    .getSetCookie()
    .find((c) => c.startsWith("liora_session="))!
    .split(";")[0];
}
before(async () => {
  assert.match(
    new URL(process.env.DATABASE_URL!).pathname,
    /_test$/,
    "Tests require a database ending in _test",
  );
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query("DROP SCHEMA public CASCADE");
  await admin.query("CREATE SCHEMA public");
  await admin.end();
  db = await import("../src/server/db.js");
  const { migrate } = await import("../scripts/migrate.js");
  const { seed } = await import("../scripts/seed.js");
  await migrate();
  workspace = await seed();
  provider = await fakeKyros(14312, origin);
  const { createApp, errorHandler } = await import("../src/server/app.js");
  const app = createApp();
  app.use(
    (
      error: Error,
      _req: import("express").Request,
      _res: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      console.error(error.message);
      next(error);
    },
  );
  app.use(errorHandler);
  server = app.listen(14310, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  cookie = await login();
  channel = (await db.query("SELECT id FROM channels WHERE name='general'"))[0]
    .id;
  column = (await db.query("SELECT id FROM board_columns LIMIT 1"))[0].id;
});
after(async () => {
  await new Promise<void>((r) => server?.close(() => r()));
  await new Promise<void>((r) => provider?.server.close(() => r()));
  await db?.pool.end();
});
test("Kyros PAR + PKCE login bootstraps only explicit owner, encrypted persistent session", async () => {
  const r = await call("/api/v1/me");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.kyros_user_id, "test-owner");
  assert.equal(r.body.workspaces[0].role_name, "Owner");
  const [s] = await db.query("SELECT * FROM user_sessions");
  assert.equal(s.tokens.split(".").length, 5);
  assert.ok(!s.id.includes(cookie.split("=")[1]));
});
test("CSRF and unauthenticated requests are rejected", async () => {
  assert.equal((await call("/api/v1/me", "GET", undefined, "")).status, 401);
  const r = await fetch(`${origin}/api/v1/workspaces`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "forged" }),
  });
  assert.equal(r.status, 403);
  assert.equal((await call("/auth/callback?code=x&state=x&iss=x")).status, 400);
});
test("second Kyros user has no implicit membership, then local member permissions", async () => {
  provider.setSubject("test-member");
  memberCookie = await login();
  provider.setSubject("test-owner");
  const r = await call("/api/v1/me", "GET", undefined, memberCookie);
  memberId = r.body.data.id;
  assert.equal(r.body.workspaces.length, 0);
  const [role] = await db.query(
    "SELECT id FROM roles WHERE workspace_id=$1 AND name='Member'",
    [workspace],
  );
  assert.equal(
    (
      await call(`/api/v1/workspaces/${workspace}/members`, "POST", {
        kyros_user_id: "test-member",
        role_id: role.id,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        `/api/v1/workspaces/${workspace}/channels`,
        "POST",
        { name: "denied" },
        memberCookie,
      )
    ).status,
    403,
  );
});
test("channel create, partial patch preserves fields, cross-workspace references denied", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const r = await call(`${b}/channels`, "POST", {
    name: "qa",
    description: "kept",
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await call(`${b}/channels/${r.body.data.id}`, "PATCH", {
        name: "renamed",
      })
    ).body.data.description,
    "kept",
  );
  const other = await call("/api/v1/workspaces", "POST", { name: "Other" });
  const cat = await call(
    `/api/v1/workspaces/${other.body.data.id}/categories`,
    "POST",
    { name: "Private" },
  );
  assert.equal(
    (
      await call(`${b}/channels`, "POST", {
        name: "cross",
        category_id: cat.body.data.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/v1/workspaces/${other.body.data.id}/channels`,
        "GET",
        undefined,
        memberCookie,
      )
    ).status,
    403,
  );
});
test("message, mention, reaction toggle, own edit, other-user edit denial, reply scope", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const r = await call(`${b}/channels/${channel}/messages`, "POST", {
    content: `Bonjour @[${memberId}]`,
  });
  assert.equal(r.status, 201);
  message = r.body.data.id;
  assert.equal(
    (
      await call(
        `${b}/messages/${message}`,
        "PATCH",
        { content: "tamper" },
        memberCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `${b}/messages/${message}/reactions`,
        "POST",
        { emoji: "👍" },
        memberCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(`${b}/channels/${channel}/messages`)).body.data.find(
      (m: { id: string }) => m.id === message,
    ).reactions.length,
    1,
  );
  await call(
    `${b}/messages/${message}/reactions`,
    "POST",
    { emoji: "👍" },
    memberCookie,
  );
  assert.equal(
    (await call(`${b}/notifications`, "GET", undefined, memberCookie)).body
      .data[0].type,
    "mention",
  );
  const ch = await call(`${b}/channels`, "POST", { name: "another" });
  assert.equal(
    (
      await call(`${b}/channels/${ch.body.data.id}/messages`, "POST", {
        content: "cross",
        reply_to: message,
      })
    ).status,
    400,
  );
});
test("bot API token hashed, permissioned, rotatable and revoked", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const r = await call(`${b}/accounts`, "POST", {
    name: "QA bot",
    kind: "bot",
    permissions: [
      "VIEW_WORKSPACE",
      "VIEW_CHANNEL",
      "SEND_MESSAGE",
      "ADD_REACTION",
    ],
  });
  technicalToken = r.body.token;
  accountId = r.body.data.id;
  assert.equal(r.status, 201);
  const [stored] = await db.query(
    "SELECT token_hash FROM technical_accounts WHERE id=$1",
    [accountId],
  );
  assert.notEqual(stored.token_hash, technicalToken);
  assert.equal(
    (
      await call(
        `${b}/channels/${channel}/messages`,
        "POST",
        { content: "From bot" },
        `Bearer ${technicalToken}`,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        `${b}/channels`,
        "POST",
        { name: "nope" },
        `Bearer ${technicalToken}`,
      )
    ).status,
    403,
  );
  await call(`${b}/accounts/${accountId}/token`, "POST", { revoke: true });
  assert.equal(
    (await call(`${b}/channels`, "GET", undefined, `Bearer ${technicalToken}`))
      .status,
    401,
  );
});
test("incoming webhook handles actual Argos payload, tasks, idempotency and revocation", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const w = await call(`${b}/webhooks`, "POST", {
    name: "Argos",
    channel_id: channel,
    allow_tasks: true,
  });
  webhookUrl = w.body.url;
  const payload = {
    event: "alert.active",
    alert: {
      title: "Server down",
      message: "Argus unreachable",
      severity: "critical",
      sourceName: "Argus",
    },
  };
  const send = () =>
    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "same-event",
      },
      body: JSON.stringify(payload),
    });
  assert.equal((await send()).status, 202);
  assert.equal((await (await send()).json()).data.duplicate, true);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM events WHERE type='argos.alert.created'",
      )
    )[0].count,
    "1",
  );
  assert.equal(
    (
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: { title: "Investigate", column_id: column },
        }),
      })
    ).status,
    202,
  );
  await call(`${b}/webhooks/${w.body.data.id}`, "DELETE");
  assert.equal((await send()).status, 404);
});
test("kanban move persists, pages protect concurrent revisions, flags remain disabled", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const task = await call(`${b}/tasks`, "POST", {
    title: "Plan",
    column_id: column,
    checklist: [{ text: "Verify", done: false }],
  });
  assert.equal(task.status, 201);
  const [other] = await db.query(
    "SELECT id FROM board_columns WHERE id<>$1 LIMIT 1",
    [column],
  );
  const moved = await call(`${b}/tasks/${task.body.data.id}`, "PATCH", {
    column_id: other.id,
  });
  assert.equal(moved.body.data.column_id, other.id);
  assert.equal(moved.body.data.checklist.length, 1);
  const page = await call(`${b}/pages`, "POST", { title: "Concurrent" });
  assert.equal(
    (
      await call(`${b}/pages/${page.body.data.id}`, "PATCH", {
        blocks: [{ type: "text", content: "First" }],
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`${b}/pages/${page.body.data.id}`, "PATCH", {
        blocks: [],
        revision: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call(`${b}/flags/jellyfin.enabled`, "PUT", { enabled: true }))
      .status,
    409,
  );
  assert.equal((await call(`${b}/jellyfin`)).status, 404);
});
test("refresh is serialized across concurrent requests and outage preserves session", async () => {
  await db.query(
    "UPDATE user_sessions SET access_expires_at=now()+interval '30 seconds'",
  );
  const before = provider.rotations;
  const results = await Promise.all(
    Array.from({ length: 6 }, () => call("/auth/refresh", "POST")),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(provider.rotations - before, 1);
  provider.setUnavailable(true);
  await db.query(
    "UPDATE user_sessions SET access_expires_at=now()-interval '1 second'",
  );
  assert.equal((await call("/auth/refresh", "POST")).status, 503);
  assert.ok((await db.query("SELECT id FROM user_sessions")).length >= 2);
  provider.setUnavailable(false);
  assert.equal((await call("/auth/refresh", "POST")).status, 200);
});
test("monitoring failure creates one incident per transition, restore notified, local destinations denied", async () => {
  const { checkMonitoring } = await import("../src/server/workers.js");
  await checkMonitoring();
  await checkMonitoring();
  assert.equal(
    (
      await db.query("SELECT count(*) FROM events WHERE type='argos.core.down'")
    )[0].count,
    "1",
  );
  await db.query(
    "UPDATE monitoring_targets SET last_heartbeat=now() WHERE kind='heartbeat'",
  );
  await checkMonitoring();
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM events WHERE type='argos.core.recovered'",
      )
    )[0].count,
    "1",
  );
  const r = await call(`/api/v1/workspaces/${workspace}/outbound`, "POST", {
    name: "unsafe",
    url: "https://127.0.0.1/",
  });
  assert.equal(r.status, 400);
});
test("0.2 monitoring permissions follow admin grants and revocation; private channels, search and files stay private", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const [role] = await db.query(
    "SELECT * FROM roles WHERE workspace_id=$1 AND name='Member'",
    [workspace],
  );
  const monitoring = await call(`${b}/channels`, "POST", {
    name: "restricted-monitoring",
    type: "monitoring",
  });
  assert.equal(monitoring.status, 201);
  assert.equal(
    (await call(`${b}/monitoring`, "GET", undefined, memberCookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/channels/${monitoring.body.data.id}/messages`,
        "GET",
        undefined,
        memberCookie,
      )
    ).status,
    403,
  );
  assert.ok(
    !(
      await call(`${b}/channels`, "GET", undefined, memberCookie)
    ).body.data.some((c: { id: string }) => c.id === monitoring.body.data.id),
  );
  const supervised = await call(`${b}/roles`, "POST", {
    name: "Supervision autorisée",
    permissions: [...role.permissions, "VIEW_MONITORING"],
  });
  assert.equal(supervised.status, 201);
  assert.equal(
    (
      await call(`${b}/members/${memberId}`, "PATCH", {
        role_id: supervised.body.data.id,
        state: "active",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`${b}/monitoring`, "GET", undefined, memberCookie)).status,
    200,
  );
  assert.equal(
    (
      await call(
        `${b}/channels/${monitoring.body.data.id}/messages`,
        "GET",
        undefined,
        memberCookie,
      )
    ).status,
    200,
  );
  await call(`${b}/members/${memberId}`, "PATCH", {
    role_id: role.id,
    state: "active",
  });
  assert.equal(
    (await call(`${b}/monitoring`, "GET", undefined, memberCookie)).status,
    403,
  );
  const privateChannel = await call(`${b}/channels`, "POST", {
    name: "confidentiel",
    is_private: true,
  });
  assert.equal(privateChannel.status, 201);
  const ch = privateChannel.body.data.id;
  const secret = await call(`${b}/channels/${ch}/messages`, "POST", {
    content: `confidentialneedle @[${memberId}]`,
  });
  assert.equal(secret.status, 201);
  const file = await call(`${b}/attachments`, "POST", {
    name: "secret.txt",
    data: Buffer.from("secret").toString("base64"),
    channel_id: ch,
  });
  assert.equal(file.status, 201);
  assert.equal(
    (
      await fetch(`${origin}${b}/attachments/${file.body.data.id}`, {
        headers: { cookie: memberCookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/messages/${secret.body.data.id}/reactions`,
        "POST",
        { emoji: "👍" },
        memberCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/messages/${secret.body.data.id}`,
        "DELETE",
        undefined,
        memberCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/search?q=confidentialneedle`,
        "GET",
        undefined,
        memberCookie,
      )
    ).body.data.length,
    0,
  );
  assert.ok(
    !(
      await call(`${b}/notifications`, "GET", undefined, memberCookie)
    ).body.data.some((n: { body: string }) =>
      n.body.includes("confidentialneedle"),
    ),
  );
  assert.equal(
    (await call(`${b}/channels/${ch}/access`, "PUT", { user_ids: [memberId] }))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        `${b}/search?q=confidentialneedle`,
        "GET",
        undefined,
        memberCookie,
      )
    ).body.data.length,
    1,
  );
  assert.equal(
    (
      await fetch(`${origin}${b}/attachments/${file.body.data.id}`, {
        headers: { cookie: memberCookie },
      })
    ).status,
    200,
  );
  await call(`${b}/channels/${ch}/access`, "PUT", { user_ids: [] });
  assert.equal(
    (await call(`${b}/channels/${ch}/messages`, "GET", undefined, memberCookie))
      .status,
    403,
  );
});
test("0.2 threads, pins and direct messages persist with participant-only access", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const root = await call(`${b}/channels/${channel}/messages`, "POST", {
    content: "Racine du fil",
  });
  const id = root.body.data.id;
  const reply = await call(
    `${b}/channels/${channel}/messages`,
    "POST",
    { content: "Réponse du fil", thread_id: id },
    memberCookie,
  );
  assert.equal(reply.status, 201);
  const feed = (await call(`${b}/channels/${channel}/messages`)).body.data;
  assert.ok(!feed.some((m: { id: string }) => m.id === reply.body.data.id));
  assert.equal(feed.find((m: { id: string }) => m.id === id).reply_count, 1);
  assert.equal(
    (await call(`${b}/channels/${channel}/messages?thread=${id}`)).body.data[0]
      .content,
    "Réponse du fil",
  );
  assert.equal(
    (
      await call(
        `${b}/messages/${id}/pin`,
        "PUT",
        { pinned: true },
        memberCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call(`${b}/messages/${id}/pin`, "PUT", { pinned: true })).status,
    200,
  );
  assert.ok(
    (
      await call(`${b}/channels/${channel}/messages?pinned=true`)
    ).body.data.some((m: { id: string }) => m.id === id),
  );
  const dm = await call(`${b}/conversations`, "POST", { user_id: memberId });
  assert.equal(dm.status, 201);
  assert.equal(
    (await call(`${b}/conversations`, "POST", { user_id: memberId })).body.data
      .id,
    dm.body.data.id,
  );
  assert.equal(
    (
      await call(`${b}/channels/${dm.body.data.id}`, "PATCH", {
        is_private: false,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/channels/${dm.body.data.id}/messages`,
        "POST",
        { content: "privatedmneedle" },
        memberCookie,
      )
    ).status,
    201,
  );
  provider.setSubject("test-outsider");
  const outsiderCookie = await login();
  provider.setSubject("test-owner");
  const adminRole = (
    await db.query(
      "SELECT id FROM roles WHERE workspace_id=$1 AND name='Admin'",
      [workspace],
    )
  )[0];
  await call(`${b}/members`, "POST", {
    kyros_user_id: "test-outsider",
    role_id: adminRole.id,
  });
  assert.equal(
    (
      await call(
        `${b}/channels/${dm.body.data.id}/messages`,
        "GET",
        undefined,
        outsiderCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/search?q=privatedmneedle`,
        "GET",
        undefined,
        outsiderCookie,
      )
    ).body.data.length,
    0,
  );
});
test("0.2.1 invitation consent, single use, role checks, friendship and DM preferences", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  assert.equal(
    (
      await call(
        "/api/v1/invitations",
        "POST",
        { workspace_id: workspace, allow_join: true },
        memberCookie,
      )
    ).status,
    403,
  );
  const invite = await call("/api/v1/invitations", "POST", {
    workspace_id: workspace,
  });
  assert.equal(invite.status, 201);
  const token = invite.body.url.split("#invite=")[1];
  assert.equal(
    (
      await call(
        `/api/v1/invitations/token/${token}/accept`,
        "POST",
        {},
        memberCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/api/v1/invitations/token/${token}/accept`,
        "POST",
        {},
        memberCookie,
      )
    ).status,
    404,
  );
  assert.ok(
    (await call("/api/v1/friends")).body.data.some(
      (u: { id: string }) => u.id === memberId,
    ),
  );
  const joining = await call("/api/v1/invitations", "POST", {
    workspace_id: workspace,
    allow_join: true,
  });
  provider.setSubject("test-invited");
  const invitedCookie = await login();
  provider.setSubject("test-owner");
  assert.equal(
    (
      await call(
        `/api/v1/invitations/token/${joining.body.url.split("#invite=")[1]}/accept`,
        "POST",
        {},
        invitedCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/api/v1/me", "GET", undefined, invitedCookie)).body
      .workspaces[0].role_name,
    "Member",
  );
  const revoked = await call("/api/v1/invitations", "POST", {
    workspace_id: workspace,
  });
  await call(`/api/v1/invitations/${revoked.body.data.id}`, "DELETE");
  assert.equal(
    (
      await call(
        `/api/v1/invitations/token/${revoked.body.url.split("#invite=")[1]}`,
        "GET",
        undefined,
        memberCookie,
      )
    ).status,
    404,
  );
  const dm = (await call(`${b}/conversations`, "POST", { user_id: memberId }))
    .body.data.id;
  await db.query(
    'UPDATE users SET preferences=preferences||\'{"dmPolicy":"nobody"}\'::jsonb WHERE id=$1',
    [memberId],
  );
  assert.equal(
    (await call(`${b}/channels/${dm}/messages`, "POST", { content: "blocked" }))
      .status,
    403,
  );
  await db.query(
    'UPDATE users SET preferences=preferences||\'{"dmPolicy":"friends"}\'::jsonb WHERE id=$1',
    [memberId],
  );
  assert.equal(
    (
      await call(`${b}/channels/${dm}/messages`, "POST", {
        content: "friend accepted",
      })
    ).status,
    201,
  );
  await call(`/api/v1/friends/${memberId}`, "DELETE");
  assert.equal(
    (
      await call(`${b}/channels/${dm}/messages`, "POST", {
        content: "no longer a friend",
      })
    ).status,
    403,
  );
  await db.query(
    'UPDATE users SET preferences=preferences||\'{"dmPolicy":"members"}\'::jsonb WHERE id=$1',
    [memberId],
  );
});
test("0.2.1 group access is scoped, revoked immediately and cannot expose DMs", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const c = (
    await call(`${b}/channels`, "POST", {
      name: "groupe-prive",
      is_private: true,
    })
  ).body.data.id;
  const g = await call(`${b}/groups`, "POST", { name: "Groupe test" });
  assert.equal(g.status, 201);
  assert.equal(
    (
      await call(`${b}/groups/${g.body.data.id}`, "PUT", {
        name: "Groupe test",
        user_ids: [memberId],
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`${b}/channels/${c}/groups`, "PUT", {
        group_ids: [g.body.data.id],
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`${b}/channels/${c}/messages`, "GET", undefined, memberCookie))
      .status,
    200,
  );
  await call(`${b}/groups/${g.body.data.id}`, "PUT", {
    name: "Groupe test",
    user_ids: [],
  });
  assert.equal(
    (await call(`${b}/channels/${c}/messages`, "GET", undefined, memberCookie))
      .status,
    403,
  );
  assert.equal(
    (await call(`${b}/groups`, "POST", { name: "Denied" }, memberCookie))
      .status,
    403,
  );
});
test("0.2.1 page block merge preserves unrelated changes and rejects same-block conflict, with history and comments", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const created = await call(`${b}/pages`, "POST", {
    title: "Page collaborative",
    blocks: [
      { type: "text", content: "A" },
      { type: "text", content: "B" },
    ],
  });
  assert.equal(created.status, 201);
  const p = created.body.data;
  const a = p.blocks.map((x: object, i: number) =>
      i === 0 ? { ...x, content: "A modifié" } : x,
    ),
    other = p.blocks.map((x: object, i: number) =>
      i === 1 ? { ...x, content: "B modifié" } : x,
    );
  assert.equal(
    (
      await call(`${b}/pages/${p.id}`, "PATCH", {
        revision: 1,
        blocks: a,
        base_blocks: p.blocks,
      })
    ).status,
    200,
  );
  const merged = await call(`${b}/pages/${p.id}`, "PATCH", {
    revision: 1,
    blocks: other,
    base_blocks: p.blocks,
  });
  assert.equal(merged.status, 200);
  assert.deepEqual(
    merged.body.data.blocks.map((b: { content: string }) => b.content),
    ["A modifié", "B modifié"],
  );
  assert.equal(
    (
      await call(`${b}/pages/${p.id}`, "PATCH", {
        revision: 1,
        blocks: p.blocks.map((x: object, i: number) =>
          i === 0 ? { ...x, content: "Conflict" } : x,
        ),
        base_blocks: p.blocks,
      })
    ).status,
    409,
  );
  assert.equal((await call(`${b}/pages/${p.id}/history`)).body.data.length, 2);
  assert.equal(
    (
      await call(
        `${b}/pages/${p.id}/comments`,
        "POST",
        { content: "Commentaire lecteur" },
        memberCookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (await call(`${b}/pages/${p.id}/comments`)).body.data[0].content,
    "Commentaire lecteur",
  );
  const board = (
    await db.query("SELECT id FROM boards WHERE workspace_id=$1 LIMIT 1", [
      workspace,
    ])
  )[0].id;
  const embedded = await call(`${b}/pages`, "POST", {
    title: "Board embarqué",
    blocks: [
      { type: "board", content: board },
      { type: "stats", content: "" },
    ],
  });
  const ep = embedded.body.data;
  assert.equal(
    (
      await call(
        `${b}/pages/${ep.id}/embeds/${ep.blocks[0].id}`,
        "GET",
        undefined,
        memberCookie,
      )
    ).status,
    200,
  );
  assert.ok(
    (await call(`${b}/pages/${ep.id}/embeds/${ep.blocks[1].id}`)).body.data
      .total >= 0,
  );
});
test("0.2.1 task participants, file linkage, activity, templates and project deletion", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const project = (
    await call(`${b}/projects`, "POST", { name: "Delete project" })
  ).body.data;
  const board = (
    await call(`${b}/boards`, "POST", {
      name: "Delete board",
      project_id: project.id,
    })
  ).body.data;
  const col = (
    await call(`${b}/columns`, "POST", { name: "Todo", board_id: board.id })
  ).body.data;
  const task = (
    await call(`${b}/tasks`, "POST", {
      title: "Enriched task",
      column_id: col.id,
      participants: [memberId],
    })
  ).body.data;
  const file = await call(`${b}/attachments`, "POST", {
    task_id: task.id,
    name: "task.txt",
    data: Buffer.from("Task attachment").toString("base64"),
  });
  assert.equal(file.status, 201);
  const patched = await call(`${b}/tasks/${task.id}`, "PATCH", {
    revision: 1,
    attachment_ids: [file.body.data.id],
  });
  assert.equal(patched.status, 200);
  assert.equal(
    (
      await call(`${b}/tasks/${task.id}`, "PATCH", {
        revision: 1,
        title: "Stale",
      })
    ).status,
    409,
  );
  assert.equal(
    (await call(`${b}/tasks/${task.id}/activity`)).body.data.length,
    2,
  );
  const elsewhere = (
    await call("/api/v1/workspaces", "POST", { name: "Deletion isolation" })
  ).body.data;
  assert.equal(
    (
      await call(
        `/api/v1/workspaces/${elsewhere.id}/projects/${project.id}`,
        "DELETE",
      )
    ).status,
    404,
  );
  assert.equal((await call(`${b}/tasks/${task.id}`)).body.data.id, task.id);
  assert.equal(
    (await call(`${b}/attachments/${file.body.data.id}?metadata=true`)).status,
    200,
  );
  const comment = await call(`${b}/tasks/${task.id}/comments`, "POST", {
    content: "Activity comment",
  });
  assert.equal(comment.status, 201);
  assert.ok(
    (await call(`${b}/tasks/${task.id}/activity`)).body.data.some(
      (a: { action: string }) => a.action === "commented",
    ),
  );
  const template = await call(`${b}/templates`, "POST", {
    name: "Template QA",
    description: "Reusable",
    checklist: [{ text: "Do it", done: false }],
  });
  assert.equal(template.status, 201);
  assert.equal(
    (await call(`${b}/projects/${project.id}`, "PATCH", { archived: true }))
      .body.data.archived,
    true,
  );
  assert.equal(
    (await call(`${b}/projects/${project.id}`, "DELETE")).status,
    200,
  );
  assert.equal((await call(`${b}/tasks/${task.id}`)).body.data, null);
  assert.equal(
    (
      await fetch(`${origin}${b}/attachments/${file.body.data.id}`, {
        headers: { cookie },
      })
    ).status,
    404,
  );
});
test("0.2.1 collection pagination beyond 500, Unicode flags, GIF and avatar storage", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  await db.query(
    "INSERT INTO categories(workspace_id,name) SELECT $1,'Page '||n FROM generate_series(1,505)n",
    [workspace],
  );
  const first = await call(`${b}/categories`);
  assert.equal(first.body.data.length, 500);
  assert.ok(first.body.nextCursor);
  const second = await call(`${b}/categories?after=${first.body.nextCursor}`);
  assert.ok(second.body.data.length >= 5);
  assert.ok(
    !second.body.data.some((x: { id: string }) =>
      first.body.data.some((y: { id: string }) => y.id === x.id),
    ),
  );
  const m = (
    await call(`${b}/channels/${channel}/messages`, "POST", {
      content: `Bonjour @[${memberId}]`,
    })
  ).body.data;
  assert.equal(
    (await call(`${b}/messages/${m.id}/reactions`, "POST", { emoji: "🇫🇷" }))
      .status,
    200,
  );
  const feed = await call(`${b}/channels/${channel}/messages`);
  assert.equal(
    feed.body.data.find((x: { id: string }) => x.id === m.id).mentions[0].id,
    memberId,
  );
  const gif = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const f = await call(`${b}/attachments`, "POST", {
    name: "tiny.gif",
    data: gif,
    channel_id: channel,
  });
  assert.equal(f.status, 201);
  assert.equal(f.body.data.mime, "image/gif");
  assert.equal(
    (await call("/api/v1/me/avatar", "POST", { data: gif })).status,
    200,
  );
  const me = await call("/api/v1/me");
  assert.ok(me.body.data.avatar.startsWith("/api/v1/avatars/"));
  assert.equal(
    (
      await fetch(`${origin}${me.body.data.avatar}`, { headers: { cookie } })
    ).headers.get("content-type"),
    "image/gif",
  );
});
test("0.3 connector secrets, signed GitHub routing, automation and private commands", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  assert.equal(
    (await call(`${b}/connectors`, "GET", undefined, memberCookie)).status,
    403,
  );
  const c = await call(`${b}/connectors`, "POST", {
    provider: "github",
    name: "GitHub QA",
    config: { base_url: "https://api.github.com" },
    api_key: "test-key-never-expose-12345",
    channel_id: channel,
  });
  assert.equal(c.status, 201);
  assert.ok(c.body.signing_secret);
  assert.equal(c.body.data.secret, undefined);
  const list = await call(`${b}/connectors`);
  assert.ok(!JSON.stringify(list.body).includes("test-key-never-expose"));
  const stored = (
    await db.query("SELECT secret FROM integrations WHERE id=$1", [
      c.body.data.id,
    ])
  )[0];
  assert.ok(!stored.secret.includes("test-key-never-expose"));
  const rule = await call(`${b}/connectors/${c.body.data.id}/rules`, "POST", {
    name: "Issues to tasks",
    event_pattern: "github.issues.*",
    channel_id: channel,
    column_id: column,
  });
  assert.equal(rule.status, 201);
  const payload = {
    action: "opened",
    repository: { full_name: "luma/test" },
    issue: {
      title: "Issue créée",
      html_url: "https://github.com/luma/test/issues/1",
    },
  };
  const raw = JSON.stringify(payload),
    sign = createHmac("sha256", c.body.signing_secret)
      .update(raw)
      .digest("hex");
  const send = (signature: string) =>
    fetch(c.body.incoming_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "issues",
        "x-github-delivery": "qa-github-delivery",
      },
      body: raw,
    });
  assert.equal((await send("sha256=" + "0".repeat(64))).status, 401);
  assert.equal((await send("sha256=" + sign)).status, 202);
  assert.equal(
    (await (await send("sha256=" + sign)).json()).data.duplicate,
    true,
  );
  const tasks = await db.query(
    "SELECT id FROM tasks WHERE title LIKE 'luma/test%Issue créée%'",
  );
  assert.equal(tasks.length, 1);
  assert.equal(
    (
      await call(
        `${b}/commands`,
        "POST",
        { channel_id: channel, command: "/statut" },
        memberCookie,
      )
    ).status,
    403,
  );
  const before = (await db.query("SELECT count(*) count FROM messages"))[0]
    .count;
  assert.equal(
    (
      await call(
        `${b}/commands`,
        "POST",
        { channel_id: channel, command: "/aide" },
        memberCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await db.query("SELECT count(*) count FROM messages"))[0].count,
    before,
  );
  await call(`${b}/connectors/${c.body.data.id}`, "PATCH", { enabled: false });
  assert.equal((await send("sha256=" + sign)).status, 403);
});
test("0.3 outbound filters only queue matching events", async () => {
  const { seal } = await import("../src/server/crypto.js");
  const { emit } = await import("../src/server/events.js");
  const [out] = await db.query(
    "INSERT INTO outbound_webhooks(workspace_id,name,url,secret,event_types) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [
      workspace,
      "Filtered",
      "https://example.com/only03",
      await seal("secret"),
      ["narra.*"],
    ],
  );
  await emit(workspace, "nino.video.ready", "test", {});
  await emit(workspace, "narra.chapter.published", "test", {});
  const rows = await db.query(
    "SELECT payload FROM webhook_deliveries WHERE url='https://example.com/only03'",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.type, "narra.chapter.published");
  assert.equal(
    (
      await call(
        `/api/v1/workspaces/${workspace}/outbound/${out.id}`,
        "PATCH",
        { event_types: ["github.*"] },
      )
    ).status,
    200,
  );
});
test("0.3 real DropIt router: matching identity, persisted grant, refresh and revocation", async () => {
  const { fixtureDropIt } = await import("./fixtures/dropit.js");
  const drop = await fixtureDropIt(
    14314,
    origin + "/api/v1/integration-callback",
  );
  const b = `/api/v1/workspaces/${workspace}`;
  try {
    const c = await call(`${b}/connectors`, "POST", {
      provider: "dropit",
      name: "DropIt QA",
      channel_id: channel,
      api_key: drop.client.api_key,
      config: {
        base_url: drop.origin,
        client_id: drop.client.id,
        allow_private: true,
      },
    });
    assert.equal(c.status, 201);
    const id = c.body.data.id;
    assert.equal(
      (await call(`${b}/connectors/${id}/test`, "POST", {})).status,
      200,
    );
    async function connect() {
      const start = await call(`${b}/connections/${id}/start`, "POST", {});
      assert.equal(start.status, 200);
      const html = await (await fetch(start.body.url)).text();
      const nonce = html.match(/name="nonce" value="([^"]+)"/)![1];
      const accepted = await fetch(drop.origin + "/integrations/authorize", {
        method: "POST",
        redirect: "manual",
        headers: { origin: drop.origin, "content-type": "application/json" },
        body: JSON.stringify({ nonce }),
      });
      return fetch(accepted.headers.get("location")!, {
        redirect: "manual",
        headers: { cookie },
      });
    }
    drop.setSubject("someone-else");
    assert.equal((await connect()).status, 403);
    drop.setSubject("test-owner");
    assert.equal((await connect()).status, 302);
    let files = await call(`${b}/connections/${id}/files`);
    assert.equal(files.status, 200);
    assert.deepEqual(
      files.body.data.map((f: any) => f.name),
      ["Guide de démonstration.pdf"],
    );
    assert.equal(
      (
        await call(
          `${b}/connections/${id}/files`,
          "GET",
          undefined,
          memberCookie,
        )
      ).status,
      409,
    );
    await db.query(
      "UPDATE integration_grants SET expires_at=now()-interval '1 minute' WHERE integration_id=$1",
      [id],
    );
    assert.equal(
      (
        await call(
          `${b}/connections/${id}/shares/00000000-0000-4000-8000-000000000000/link`,
          "POST",
          {},
        )
      ).status,
      500,
    );
    // A failed operation after refreshing must not roll back the rotated credentials.
    files = await call(`${b}/connections/${id}/files`);
    assert.equal(files.status, 200);
    const shared = await call(
      `${b}/connections/${id}/shares/${drop.own}/link`,
      "POST",
      {},
    );
    assert.equal(shared.body.public, true);
    await call(`${b}/connections/${id}`, "DELETE");
    assert.equal((await call(`${b}/connections/${id}/files`)).status, 409);
  } finally {
    await drop.close();
  }
});
test("0.3 timestamped Nino/Narra signatures, unmatched routes and rule cleanup", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  for (const provider of ["nino", "narra"]) {
    const c = await call(`${b}/connectors`, "POST", {
      provider,
      name: provider,
      config: { base_url: "https://example.com" },
      channel_id: channel,
    });
    assert.equal(c.status, 201);
    const board = await call(`${b}/boards`, "POST", {
      name: `Automation ${provider}`,
    });
    assert.equal(board.status, 201);
    const col = await call(`${b}/columns`, "POST", {
      name: "Incoming",
      board_id: board.body.data.id,
    });
    assert.equal(col.status, 201);
    assert.equal(
      (
        await call(`${b}/connectors/${c.body.data.id}/rules`, "POST", {
          name: "Errors",
          event_pattern: `${provider}.*`,
          severity: "error",
          channel_id: channel,
          column_id: col.body.data.id,
        })
      ).status,
      201,
    );
    const send = async (severity: string, seconds = 0, invalid = false) => {
      const raw = JSON.stringify({
          type: `${provider}.item.ready`,
          title: "Test signature",
          severity,
          payload: {},
        }),
        stamp = String(Math.floor(Date.now() / 1000) + seconds);
      return fetch(c.body.incoming_url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-liora-timestamp": stamp,
          "x-liora-signature": invalid
            ? "0".repeat(64)
            : createHmac("sha256", c.body.signing_secret)
                .update(stamp + "." + raw)
                .digest("hex"),
        },
        body: raw,
      });
    };
    assert.equal((await send("info", -600)).status, 401);
    assert.equal((await send("info", 0, true)).status, 401);
    const before = (await db.query("SELECT count(*) n FROM messages"))[0].n;
    assert.equal((await send("info")).status, 202);
    assert.equal(
      (await db.query("SELECT count(*) n FROM messages"))[0].n,
      before,
    );
    assert.equal((await send("error")).status, 202);
    assert.equal((await (await send("error")).json()).data.duplicate, true);
    assert.equal(
      (
        await db.query("SELECT id FROM tasks WHERE column_id=$1", [
          col.body.data.id,
        ])
      ).length,
      1,
    );
    assert.equal(
      (await call(`${b}/boards/${board.body.data.id}`, "DELETE")).status,
      200,
    );
    assert.equal(
      (
        await db.query(
          "SELECT id FROM integration_rules WHERE integration_id=$1",
          [c.body.data.id],
        )
      ).length,
      0,
    );
  }
});

test("SSE delivers durable invalidations and session revocation closes access", async () => {
  const controller = new AbortController();
  const response = await fetch(
    `${origin}/api/v1/workspaces/${workspace}/stream?after=0`,
    { headers: { cookie }, signal: controller.signal },
  );
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  let output = "";
  for (let i = 0; i < 4 && !output.includes("data:"); i++)
    output += new TextDecoder().decode((await reader.read()).value);
  assert.match(output, /data:/);
  controller.abort();
  const sessions = await call("/api/v1/sessions");
  const current = sessions.body.data.find(
    (s: { current: boolean }) => s.current,
  );
  await call(`/api/v1/sessions/${current.id}`, "DELETE");
  assert.equal((await call("/api/v1/me")).status, 401);
});
