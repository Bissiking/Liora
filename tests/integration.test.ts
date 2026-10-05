// tests/integration.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import pg from "pg";
import { fixtureBrainDump } from "./fixtures/braindump.js";
import { fixtureConnections } from "./fixtures/connections.js";
import { fakeKyros } from "./fixtures/kyros.js";
import { fixturePlaces } from "./fixtures/places.js";
import type { Server } from "node:http";
process.env.NODE_ENV = "test";
process.env.ARGOS_BASE_URL = "";
process.env.ARGUS_HEALTH_URL = "";
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.VAPID_SUBJECT = "";
process.env.PLACES_GEOCODER_URL = "http://127.0.0.1:14316/photon";
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
let connections: Awaited<ReturnType<typeof fixtureConnections>>;
let server: Server,
  placesProvider: Awaited<ReturnType<typeof fixturePlaces>>,
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
  placesProvider = await fixturePlaces(14316);
  connections = await fixtureConnections(14318);
  process.env.BRAINDUMP_BASE_URL = "http://127.0.0.1:14318";
  process.env.BRAINDUMP_ALLOW_PRIVATE = "true";
  process.env.GOOGLE_CALENDAR_TEST_ORIGIN = "http://127.0.0.1:14318";
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "fixture-client";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "fixture-secret";
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
  await placesProvider?.close();
  await connections?.close();
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
test("heartbeat persists before first worker run, enforces service scope and detects expiration", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const service = await call(`${b}/accounts`, "POST", {
    name: "Heartbeat test",
    kind: "service",
    permissions: ["MANAGE_MONITORING"],
  });
  assert.equal(service.status, 201);
  const auth = `Bearer ${service.body.token}`;
  await db.query(
    "DELETE FROM monitoring_checks WHERE target_id IN (SELECT id FROM monitoring_targets WHERE workspace_id=$1 AND name='Heartbeat Argos')",
    [workspace],
  );
  await db.query(
    "DELETE FROM monitoring_targets WHERE workspace_id=$1 AND name='Heartbeat Argos'",
    [workspace],
  );
  assert.equal(
    (await call(`${b}/heartbeat`, "POST", undefined, memberCookie)).status,
    403,
  );
  const receipt = await call(`${b}/heartbeat`, "POST", undefined, auth);
  assert.equal(receipt.status, 200);
  assert.ok(Number.isFinite(Date.parse(receipt.body.received_at)));
  const [target] = await db.query(
    "SELECT * FROM monitoring_targets WHERE workspace_id=$1 AND name='Heartbeat Argos'",
    [workspace],
  );
  assert.equal(
    new Date(target.last_heartbeat).toISOString(),
    receipt.body.received_at,
  );
  assert.equal(
    (await call(`${b}/heartbeat`, "POST", undefined, auth)).status,
    200,
  );
  assert.equal(
    (
      await db.query(
        "SELECT * FROM monitoring_targets WHERE workspace_id=$1 AND kind='heartbeat'",
        [workspace],
      )
    ).length,
    1,
  );
  const [other] = await db.query(
    "INSERT INTO workspaces(name) VALUES('Heartbeat isolation') RETURNING id",
  );
  try {
    assert.equal(
      (
        await call(
          `/api/v1/workspaces/${other.id}/heartbeat`,
          "POST",
          undefined,
          auth,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await db.query(
          "SELECT * FROM monitoring_targets WHERE workspace_id=$1",
          [other.id],
        )
      ).length,
      0,
    );
  } finally {
    await db.query("DELETE FROM workspaces WHERE id=$1", [other.id]);
  }
  const { checkMonitoring } = await import("../src/server/workers.js");
  await checkMonitoring();
  assert.equal(
    (
      await db.query("SELECT state FROM monitoring_targets WHERE id=$1", [
        target.id,
      ])
    )[0].state,
    "up",
  );
  await db.query(
    "UPDATE monitoring_targets SET last_heartbeat=now()-interval '1 day' WHERE id=$1",
    [target.id],
  );
  await checkMonitoring();
  assert.equal(
    (
      await db.query("SELECT state FROM monitoring_targets WHERE id=$1", [
        target.id,
      ])
    )[0].state,
    "down",
  );
  await call(`${b}/accounts/${service.body.data.id}/token`, "POST", {
    revoke: true,
  });
  assert.equal(
    (await call(`${b}/heartbeat`, "POST", undefined, auth)).status,
    401,
  );
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
    // A replay uses the same signature even if the requests cross a second boundary.
    const signedAt = Math.floor(Date.now() / 1000);
    const send = async (severity: string, seconds = 0, invalid = false) => {
      const raw = JSON.stringify({
          type: `${provider}.item.ready`,
          title: "Test signature",
          severity,
          payload: {},
        }),
        stamp = String(signedAt + seconds);
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

test("0.4 calendar CRUD, recurring windows, human ownership and private references", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const event = await call(`${b}/calendar`, "POST", {
    title: "Monthly anchored",
    start_at: "2024-01-31T08:00:00Z",
    end_at: "2024-01-31T09:00:00Z",
    timezone: "Europe/Paris",
    recurrence: "monthly",
  });
  assert.equal(event.status, 201);
  const id = event.body.data.id;
  const result = await call(
    `${b}/calendar?start=2026-02-01&end=2026-03-31&timezone=Europe%2FParis`,
  );
  const found = result.body.data.filter((e: any) => e.id === id);
  assert.equal(found.length, 2);
  assert.equal(found[0].start_at, "2026-02-28T08:00:00Z");
  assert.equal(found[1].start_at, "2026-03-31T07:00:00Z");
  const allDay = await call(`${b}/calendar`, "POST", {
    title: "Whole day DST",
    start_at: "2026-03-27T23:00:00Z",
    end_at: "2026-03-28T23:00:00Z",
    timezone: "Europe/Paris",
    all_day: true,
    recurrence: "daily",
  });
  assert.equal(allDay.status, 201);
  const daylight = await call(
    `${b}/calendar?start=2026-03-29&end=2026-03-29&timezone=Europe%2FParis`,
  );
  const daily = daylight.body.data.filter(
    (r: any) => r.id === allDay.body.data.id,
  );
  assert.equal(daily.length, 1);
  assert.equal(daily[0].start_at, "2026-03-28T23:00:00Z");
  assert.equal(daily[0].end_at, "2026-03-29T22:00:00Z");
  const update = await call(`${b}/calendar/${id}`, "PATCH", {
    title: "Updated",
    end_at: "2024-01-31T10:00:00Z",
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.end_at, "2024-01-31T10:00:00.000Z");
  assert.equal(
    (
      await call(`${b}/calendar/${id}`, "PATCH", {
        end_at: "2024-01-30T10:00:00Z",
      })
    ).status,
    400,
  );
  assert.equal(
    (await call(`${b}/calendar/${id}`, "PATCH", { timezone: "Not/AZone" }))
      .status,
    400,
  );
  assert.equal(
    (await call(`${b}/calendar/${id}`, "DELETE", undefined, memberCookie))
      .status,
    403,
  );
  assert.equal(
    (await call(`${b}/calendar?start=2020-01-01&end=2030-01-01`)).status,
    400,
  );
  const privateChannel = await call(`${b}/channels`, "POST", {
    name: "private-calendar",
    is_private: true,
  });
  const hidden = await call(`${b}/calendar`, "POST", {
    title: "Private appointment",
    start_at: "2026-09-25T10:00:00Z",
    channel_id: privateChannel.body.data.id,
  });
  assert.equal(hidden.status, 201);
  const view = await call(
    `${b}/calendar?start=2026-09-01&end=2026-09-30`,
    "GET",
    undefined,
    memberCookie,
  );
  assert.equal(view.status, 200);
  assert.equal(
    view.body.data.some((e: any) => e.id === hidden.body.data.id),
    false,
  );
  assert.equal(
    (
      await call(
        `${b}/reminders`,
        "POST",
        {
          title: "Forbidden",
          remind_at: new Date().toISOString(),
          channel_id: privateChannel.body.data.id,
        },
        memberCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${b}/favorites`,
        "POST",
        { target_type: "event", target_id: hidden.body.data.id },
        memberCookie,
      )
    ).status,
    403,
  );
  assert.equal((await call(`${b}/calendar/${id}`, "DELETE")).status, 200);
});
test("0.4 reminder workers are idempotent, recur, snooze, resume and deliver calendar reminders", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const { processReminders } =
    await import("../src/server/experience-worker.js");
  const create = await call(`${b}/reminders`, "POST", {
    title: "Once only",
    body: "Private reminder",
    remind_at: "2020-01-01T09:00:00Z",
  });
  assert.equal(create.status, 201);
  const id = create.body.data.id;
  await Promise.all([processReminders(), processReminders()]);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM notifications WHERE title='Once only'",
      )
    )[0].n,
    "1",
  );
  assert.equal(
    (await db.query("SELECT state FROM reminders WHERE id=$1", [id]))[0].state,
    "done",
  );
  const snooze = await call(`${b}/reminders/${id}`, "PATCH", {
    state: "snoozed",
    remind_at: new Date(Date.now() + 3600000).toISOString(),
  });
  assert.equal(snooze.status, 200);
  const pending = await call(`${b}/reminders?state=pending`);
  assert.ok(pending.body.data.some((r: any) => r.id === id));
  const recurring = await call(`${b}/reminders`, "POST", {
    title: "Every month",
    remind_at: "2020-01-31T08:00:00Z",
    timezone: "Europe/Paris",
    recurring: true,
    recurring_interval: "monthly",
  });
  assert.equal(recurring.status, 201);
  await processReminders(new Date("2026-09-25T10:00:00Z"));
  const [next] = await db.query("SELECT * FROM reminders WHERE id=$1", [
    recurring.body.data.id,
  ]);
  assert.equal(next.remind_at.toISOString(), "2026-09-30T07:00:00.000Z");
  assert.equal(next.state, "pending");
  assert.equal(
    (
      await call(
        `${b}/reminders/${id}`,
        "PATCH",
        { title: "Other user" },
        memberCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(`${b}/reminders/${id}`, "PATCH", {
        state: "snoozed",
        remind_at: "2020-01-01T00:00:00Z",
      })
    ).status,
    400,
  );
  const event = await call(`${b}/calendar`, "POST", {
    title: "Calendar reminder test",
    start_at: new Date(Date.now() + 120000).toISOString(),
    reminder_minutes: 0,
  });
  assert.equal(event.status, 201);
  await processReminders(new Date(Date.now() + 180000));
  await processReminders(new Date(Date.now() + 180000));
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM notifications WHERE title='Calendrier : Calendar reminder test'",
      )
    )[0].n,
    "1",
  );
  assert.equal((await call(`${b}/reminders/${id}`, "DELETE")).status, 200);
});
test("0.4 favorites validate resources and mutations and exclude inaccessible resources", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const create = await call(`${b}/favorites`, "POST", {
    target_type: "channel",
    target_id: channel,
  });
  assert.equal(create.status, 201);
  const id = create.body.data.id;
  assert.equal(
    (
      await call(`${b}/favorites/${id}`, "PATCH", {
        label: "Pinned",
        position: 2,
      })
    ).status,
    200,
  );
  const list = await call(`${b}/favorites`);
  assert.equal(list.body.data.find((r: any) => r.id === id).label, "Pinned");
  assert.equal(
    (
      await call(`${b}/favorites`, "POST", {
        target_type: "channel",
        target_id: "00000000-0000-4000-8000-000000000099",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call(`${b}/favorites/${id}`, "DELETE", undefined, memberCookie))
      .status,
    404,
  );
  assert.equal((await call(`${b}/favorites/${id}`, "DELETE")).status, 200);
});
test("0.4 Web Push encrypts payloads, binds sessions, retries and rechecks permissions", async () => {
  const webpush = (await import("web-push")).default;
  const { createECDH } = await import("node:crypto");
  const { buildPushRequest, processPushDeliveries } =
    await import("../src/server/push.js");
  const { seal } = await import("../src/server/crypto.js");
  const saved = [
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
    process.env.VAPID_SUBJECT,
  ];
  const keys = webpush.generateVAPIDKeys();
  Object.assign(process.env, {
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: "mailto:local-test@example.com",
  });
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const subscription = {
    endpoint: "https://example.com/push-test",
    keys: {
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  const b = `/api/v1/workspaces/${workspace}`;
  try {
    assert.equal(
      (
        await call(`${b}/push/subscribe`, "POST", {
          ...subscription,
          endpoint: "https://127.0.0.1/push",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call(`${b}/push/subscribe`, "POST", subscription)).status,
      200,
    );
    assert.equal(
      (await call(`${b}/push/subscribe`, "POST", subscription)).status,
      200,
    );
    assert.equal(
      (await db.query("SELECT count(*) n FROM push_subscriptions"))[0].n,
      "1",
    );
    const details = buildPushRequest(subscription, {
      body: "Private test content",
    });
    assert.equal(details.headers["Content-Encoding"], "aes128gcm");
    assert.ok(details.body);
    assert.equal(
      details.body!.toString().includes("Private test content"),
      false,
    );
    const [sub] = await db.query("SELECT * FROM push_subscriptions");
    assert.equal(sub.subscription.includes(subscription.endpoint), false);
    const [notification] = await db.query(
      "INSERT INTO notifications(workspace_id,user_id,type,title,body) VALUES($1,$2,'system','Secret title','Secret body') RETURNING id",
      [workspace, sub.user_id],
    );
    let calls = 0;
    const fake = async (_s: unknown, payload: any) => {
      calls++;
      assert.equal(payload.body.includes("Secret"), false);
      assert.ok(payload.url.includes(workspace));
      return 503;
    };
    await Promise.all([
      processPushDeliveries(fake, new Date(Date.now() + 1000)),
      processPushDeliveries(fake, new Date(Date.now() + 1000)),
    ]);
    assert.equal(calls, 1);
    let [delivery] = await db.query(
      "SELECT * FROM push_deliveries WHERE notification_id=$1",
      [notification.id],
    );
    assert.equal(delivery.state, "pending");
    assert.equal(delivery.attempts, 1);
    await processPushDeliveries(async () => 201, new Date(Date.now() + 60000));
    [delivery] = await db.query(
      "SELECT * FROM push_deliveries WHERE notification_id=$1",
      [notification.id],
    );
    assert.equal(delivery.state, "sent");
    const privateChannel = await call(`${b}/channels`, "POST", {
      name: "push-private",
      is_private: true,
    });
    const [memberSession] = await db.query(
      "SELECT id FROM user_sessions WHERE user_id=$1 LIMIT 1",
      [memberId],
    );
    await db.query(
      "INSERT INTO push_subscriptions(user_id,session_id,endpoint_hash,subscription) VALUES($1,$2,'member-test',$3)",
      [memberId, memberSession.id, await seal(subscription)],
    );
    const [privateNotice] = await db.query(
      "INSERT INTO notifications(workspace_id,user_id,type,title,channel_id) VALUES($1,$2,'message','Do not deliver',$3) RETURNING id",
      [workspace, memberId, privateChannel.body.data.id],
    );
    await processPushDeliveries(
      async () => {
        throw Error("Must not send private content");
      },
      new Date(Date.now() + 1000),
    );
    assert.equal(
      (
        await db.query(
          "SELECT state FROM push_deliveries WHERE notification_id=$1",
          [privateNotice.id],
        )
      )[0].state,
      "cancelled",
    );
    await db.query(
      "INSERT INTO notifications(workspace_id,user_id,type,title) VALUES($1,$2,'system','Expired endpoint')",
      [workspace, sub.user_id],
    );
    await processPushDeliveries(async () => 410, new Date(Date.now() + 1000));
    assert.equal(
      (await db.query("SELECT * FROM push_subscriptions WHERE id=$1", [sub.id]))
        .length,
      0,
    );
    assert.equal(
      (await call(`${b}/push/subscribe`, "POST", subscription)).status,
      200,
    );
    assert.equal(
      (
        await call(`${b}/push/subscribe`, "DELETE", {
          endpoint: subscription.endpoint,
        })
      ).status,
      200,
    );
    assert.equal(
      (await call(`${b}/push/vapid-public-key`)).body.subscribed,
      false,
    );
  } finally {
    await db.query("DELETE FROM push_subscriptions");
    for (const [index, name] of [
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ].entries()) {
      if (saved[index] === undefined) delete process.env[name];
      else process.env[name] = saved[index];
    }
  }
});
test("0.4 search filters preserve channel access and use dates and author", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const r = await call(`${b}/search?q=Bienvenue&channel=${channel}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.every((m: any) => m.channel_id === channel));
  assert.equal(
    (await call(`${b}/search?q=Bienvenue&author=DoesNotExist`)).body.data
      .length,
    0,
  );
  assert.equal(
    (await call(`${b}/search?q=Bienvenue&from=2099-01-01T00:00:00Z`)).body.data
      .length,
    0,
  );
  assert.equal(
    (
      await call(
        `${b}/search?q=Bienvenue&from=2030-01-01T00:00:00Z&until=2020-01-01T00:00:00Z`,
      )
    ).status,
    400,
  );
});
test("0.5 personal messages persist offline without shared workspace and enforce privacy", async () => {
  const owner = (await call("/api/v1/me")).body.data.id;
  const pair = [owner, memberId].sort();
  await db.query(
    "INSERT INTO friendships(user_a,user_b) VALUES($1,$2) ON CONFLICT DO NOTHING",
    pair,
  );
  const [membership] = await db.query(
    "SELECT * FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
    [workspace, memberId],
  );
  const [original] = await db.query(
    "SELECT status,preferences FROM users WHERE id=$1",
    [memberId],
  );
  try {
    await db.query(
      "DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
      [workspace, memberId],
    );
    await db.query(
      "UPDATE users SET status='invisible',preferences=jsonb_set(preferences,'{dmPolicy}','\"friends\"') WHERE id=$1",
      [memberId],
    );
    const client_id = crypto.randomUUID(),
      b = { content: "Un message qui attend ton retour", client_id };
    const sent = await call(`/api/v1/friends/${memberId}/messages`, "POST", b);
    assert.equal(sent.status, 201);
    const retry = await call(`/api/v1/friends/${memberId}/messages`, "POST", b);
    assert.equal(retry.body.data.id, sent.body.data.id);
    assert.equal(
      (
        await call(`/api/v1/friends/${memberId}/messages`, "POST", {
          ...b,
          content: "Autre contenu",
        })
      ).status,
      409,
    );
    const inbox = await call(
      `/api/v1/friends/${owner}/messages`,
      "GET",
      undefined,
      memberCookie,
    );
    assert.equal(inbox.status, 200);
    assert.ok(inbox.body.data.some((m: any) => m.id === sent.body.data.id));
    assert.ok(
      (
        await call("/api/v1/friends", "GET", undefined, memberCookie)
      ).body.data.find((f: any) => f.id === owner).unread_count > 0,
    );
    assert.equal(
      (
        await call(
          `/api/v1/friends/${owner}/messages/read`,
          "POST",
          { through: sent.body.data.id },
          memberCookie,
        )
      ).status,
      200,
    );
    assert.ok(
      (await call(`/api/v1/friends/${memberId}/messages`)).body.data.find(
        (m: any) => m.id === sent.body.data.id,
      ).read_at,
    );
    await db.query(
      "UPDATE users SET preferences=jsonb_set(preferences,'{dmPolicy}','\"nobody\"') WHERE id=$1",
      [memberId],
    );
    assert.equal(
      (
        await call(`/api/v1/friends/${memberId}/messages`, "POST", {
          content: "Bloqué",
          client_id: crypto.randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(`/api/v1/friends/${crypto.randomUUID()}/messages`)).status,
      403,
    );
    const bot = await call(`/api/v1/workspaces/${workspace}/accounts`, "POST", {
      name: "Personal isolation",
      kind: "bot",
      permissions: ["VIEW_WORKSPACE"],
    });
    assert.equal(bot.status, 201);
    assert.equal(
      (
        await call(
          `/api/v1/friends/${memberId}/messages`,
          "GET",
          undefined,
          "Bearer " + bot.body.token,
        )
      ).status,
      403,
    );
  } finally {
    await db.query("UPDATE users SET status=$2,preferences=$3 WHERE id=$1", [
      memberId,
      original.status,
      JSON.stringify(original.preferences),
    ]);
    if (membership)
      await db.query(
        "INSERT INTO workspace_members(workspace_id,user_id,role_id,state) VALUES($1,$2,$3,$4)",
        [workspace, memberId, membership.role_id, membership.state],
      );
  }
});
test("0.5 map entries are personal and visitor visibility never exposes private notes", async () => {
  const owner = (await call("/api/v1/me")).body.data.id;
  const created = await call("/api/v1/places", "POST", {
    category: "burger-king",
    name: "Burger King Test",
    address: "Adresse synthétique",
    latitude: 48.85,
    longitude: 2.35,
    entry: {
      state: "wishlist",
      notes: "secret propriétaire",
      visibility: "private",
    },
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal(
    (
      await call(
        `/api/v1/places/${id}/entry`,
        "PUT",
        {
          state: "visited",
          notes: "secret ami",
          visibility: "private",
          visited_on: "2026-10-03",
        },
        memberCookie,
      )
    ).status,
    200,
  );
  assert.deepEqual((await call(`/api/v1/places/${id}/visitors`)).body.data, []);
  let bounds = (
    await call("/api/v1/places?south=48&north=49&west=2&east=3")
  ).body.data.find((p: any) => p.id === id);
  assert.equal(bounds.notes, "secret propriétaire");
  assert.equal(bounds.state, "wishlist");
  assert.equal(
    (
      await call(
        `/api/v1/places/${id}/entry`,
        "PUT",
        {
          state: "visited",
          notes: "secret ami",
          visibility: "friends",
          visited_on: "2026-10-03",
        },
        memberCookie,
      )
    ).status,
    200,
  );
  let visitors = (await call(`/api/v1/places/${id}/visitors`)).body.data;
  assert.ok(visitors.some((v: any) => v.id === memberId));
  assert.ok(
    visitors.every((v: any) => !("notes" in v) && !("visited_on" in v)),
  );
  await db.query("DELETE FROM friendships WHERE user_a=$1 AND user_b=$2", [
    ...[owner, memberId].sort(),
  ]);
  assert.deepEqual((await call(`/api/v1/places/${id}/visitors`)).body.data, []);
  assert.equal(
    (await call(`/api/v1/friends/${memberId}/messages`)).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/v1/places/${id}/entry`,
        "PUT",
        { state: "visited", visibility: "community" },
        memberCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(`/api/v1/places/${id}/visitors`)).body.data[0].id,
    memberId,
  );
  assert.equal(
    (await call(`/api/v1/places/${id}/entry`, "DELETE")).status,
    200,
  );
  assert.ok(
    (
      await call("/api/v1/places/mine", "GET", undefined, memberCookie)
    ).body.data.some((p: any) => p.id === id),
  );
  assert.equal(
    (
      await call("/api/v1/places", "POST", {
        category: "bad",
        name: "Bad",
        latitude: 99,
        longitude: 2,
        entry: { state: "visited" },
      })
    ).status,
    400,
  );
});
test("0.5 place discovery is human-only, bounded, read-only and cached", async () => {
  const path = "/api/v1/places/search?q=MacDo&latitude=48.1&longitude=-1.6";
  assert.equal((await call(path, "GET", undefined, "")).status, 401);
  const bot = await call(`/api/v1/workspaces/${workspace}/accounts`, "POST", {
    name: "Discovery guard",
    kind: "bot",
    permissions: ["VIEW_WORKSPACE", "VIEW_CHANNEL"],
  });
  assert.equal(bot.status, 201);
  assert.equal(
    (await call(path, "GET", undefined, `Bearer ${bot.body.token}`)).status,
    403,
  );
  assert.equal(
    (await call("/api/v1/places/search?q=Rennes&latitude=100&longitude=0"))
      .status,
    400,
  );
  const n = (await db.query("SELECT count(*) n FROM places"))[0].n;
  const r = await call(path);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 1);
  assert.match(r.body.data[0].name, /McDonald's/);
  assert.equal(r.body.data[0].category, "place");
  assert.ok(
    r.body.data.every(
      (p: any) =>
        p.id.startsWith("osm:") && !("notes" in p) && !("visibility" in p),
    ),
  );
  assert.equal((await db.query("SELECT count(*) n FROM places"))[0].n, n);
  assert.equal(placesProvider.calls.length, 1);
  const repeated = await call(path);
  assert.deepEqual(repeated.body, r.body);
  assert.equal(placesProvider.calls.length, 1);
  const p = r.body.data[0],
    body = {
      category: p.category,
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      entry: { state: "wishlist" },
    };
  const a = await call("/api/v1/places", "POST", body),
    b = await call("/api/v1/places", "POST", body, memberCookie);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.body.data.id, b.body.data.id);
  assert.equal(
    (await db.query("SELECT count(*) n FROM places"))[0].n,
    String(Number(n) + 1),
  );
});
test("0.5 saved date suggestions remain anchored after reload", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const r = await call(`${b}/channels/${channel}/messages`, "POST", {
    content: "demain à 14h",
    timezone: "Europe/Paris",
  });
  assert.equal(r.status, 201);
  const first = r.body.detectedDates[0];
  assert.equal(first.timezone, "Europe/Paris");
  const reloaded = await call(`${b}/messages/${r.body.data.id}`);
  assert.deepEqual(reloaded.body.data.detectedDates[0], first);
  const model = (await call("/api/v1/me")).body.data;
  for (const theme of ["atelier", "orbit", "terminal"])
    assert.equal(
      (
        await call("/api/v1/me", "PATCH", {
          name: model.name,
          bio: model.bio,
          status: model.status,
          preferences: { ...model.preferences, theme },
        })
      ).status,
      200,
    );
});
test("0.5 project archive and column deletion enforce task permissions", async () => {
  const b = `/api/v1/workspaces/${workspace}`;
  const p = await call(`${b}/projects`, "POST", { name: "Archive test" });
  assert.equal(p.status, 201);
  const board = await call(`${b}/boards`, "POST", {
    name: "Archive board",
    project_id: p.body.data.id,
  });
  assert.equal(board.status, 201);
  const col = await call(`${b}/columns`, "POST", {
    name: "Archive column",
    board_id: board.body.data.id,
  });
  assert.equal(col.status, 201);
  const task = await call(`${b}/tasks`, "POST", {
    title: "Keep me",
    column_id: col.body.data.id,
  });
  assert.equal(task.status, 201);
  assert.equal(
    (await call(`${b}/projects/${p.body.data.id}`, "PATCH", { archived: true }))
      .status,
    200,
  );
  assert.equal(
    (
      await call(`${b}/tasks`, "POST", {
        title: "Forbidden in archive",
        column_id: col.body.data.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`${b}/boards`, "POST", {
        name: "Forbidden in archive",
        project_id: p.body.data.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`${b}/projects/${p.body.data.id}`, "PATCH", {
        archived: false,
      })
    ).status,
    200,
  );
  const [membership] = await db.query(
    "SELECT role_id FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
    [workspace, memberId],
  );
  const role = await call(`${b}/roles`, "POST", {
    name: "Column manager only",
    permissions: ["VIEW_WORKSPACE", "MANAGE_BOARD"],
  });
  assert.equal(role.status, 201);
  try {
    await db.query(
      "UPDATE workspace_members SET role_id=$3 WHERE workspace_id=$1 AND user_id=$2",
      [workspace, memberId, role.body.data.id],
    );
    assert.equal(
      (
        await call(
          `${b}/columns/${col.body.data.id}`,
          "DELETE",
          undefined,
          memberCookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call(`${b}/tasks/${task.body.data.id}`)).body.data.id,
      task.body.data.id,
    );
  } finally {
    await db.query(
      "UPDATE workspace_members SET role_id=$3 WHERE workspace_id=$1 AND user_id=$2",
      [workspace, memberId, membership.role_id],
    );
  }
  assert.equal(
    (await call(`${b}/projects/${p.body.data.id}`, "DELETE")).status,
    200,
  );
});
test("0.6 Kyros avatar is proxied and refresh preserves a local avatar", async () => {
  const me = (await call("/api/v1/me")).body.data;
  // Earlier upload tests may have established a local override; test provider synchronization explicitly.
  const [original] = await db.query(
    "SELECT avatar,avatar_key,avatar_mime FROM users WHERE id=$1",
    [me.id],
  );
  try {
    await db.query(
      "UPDATE users SET avatar_key=NULL,avatar_mime=NULL WHERE id=$1",
      [me.id],
    );
    provider.setAvatar(provider.issuer + "/avatar.png");
    const freshCookie = await login();
    const fresh = (await call("/api/v1/me", "GET", undefined, freshCookie)).body
      .data;
    assert.equal(fresh.avatar, `/api/v1/avatars/${me.id}?kyros=1`);
    const image = await fetch(origin + fresh.avatar, {
      headers: { cookie: freshCookie },
    });
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type")!, /image\/png/);
    assert.equal(
      Buffer.from(await image.arrayBuffer())
        .subarray(0, 8)
        .toString("hex"),
      "89504e470d0a1a0a",
    );
    await db.query(
      "UPDATE users SET avatar_key='local-override',avatar='/local-avatar' WHERE id=$1",
      [me.id],
    );
    provider.setAvatar("javascript:alert(1)");
    await db.query(
      "UPDATE user_sessions SET access_expires_at=now() WHERE user_id=$1",
      [me.id],
    );
    assert.equal(
      (await call("/auth/refresh", "POST", {}, freshCookie)).status,
      200,
    );
    assert.equal(
      (await call("/api/v1/me", "GET", undefined, freshCookie)).body.data
        .avatar,
      "/local-avatar",
    );
    assert.equal(
      (
        await db.query("SELECT kyros_avatar_url FROM users WHERE id=$1", [
          me.id,
        ])
      )[0].kyros_avatar_url,
      null,
    );
  } finally {
    await db.query(
      "UPDATE users SET avatar=$2,avatar_key=$3,avatar_mime=$4 WHERE id=$1",
      [me.id, original.avatar, original.avatar_key, original.avatar_mime],
    );
    provider.setAvatar(provider.issuer + "/avatar.png");
  }
});
test("0.6 navigation preferences preserve other settings", async () => {
  const original = (await call("/api/v1/me")).body.data.preferences;
  assert.equal(
    (
      await call("/api/v1/me/navigation", "PATCH", {
        collapsedNavigation: ["Équipe", "channel:test"],
      })
    ).status,
    200,
  );
  const saved = (await call("/api/v1/me")).body.data.preferences;
  assert.deepEqual(saved.collapsedNavigation, ["Équipe", "channel:test"]);
  for (const [key, value] of Object.entries(original))
    if (key !== "collapsedNavigation") assert.deepEqual(saved[key], value);
  assert.equal(
    (await call("/api/v1/me/navigation", "PATCH", { collapsedNavigation: [1] }))
      .status,
    400,
  );
});
test("0.6 Gotify encrypts tokens and enforces current rights, preferences and retries", async () => {
  const owner = (await call("/api/v1/me")).body.data.id;
  const { unseal } = await import("../src/server/crypto.js");
  const { processGotifyDeliveries } = await import("../src/server/gotify.js");
  const flush = (send: Parameters<typeof processGotifyDeliveries>[0]) =>
    processGotifyDeliveries(send, new Date(Date.now() + 1000));
  // Local fixture transport is injected. No message is sent to a real Gotify server.
  assert.equal(
    (
      await call("/api/v1/gotify", "PUT", {
        url: "https://93.184.216.34",
        token: "fixture-application-token",
        enabled: true,
      })
    ).status,
    200,
  );
  const settings = await call("/api/v1/gotify");
  assert.equal(settings.status, 200);
  assert.ok(
    !JSON.stringify(settings.body).includes("fixture-application-token"),
  );
  assert.ok(!("token" in settings.body.connection));
  const [stored] = await db.query(
    "SELECT token FROM gotify_connections WHERE user_id=$1",
    [owner],
  );
  assert.notEqual(stored.token, "fixture-application-token");
  assert.equal(await unseal(stored.token), "fixture-application-token");
  assert.equal(
    (
      await call("/api/v1/gotify", "PUT", {
        url: "http://127.0.0.1:80",
        token: "bad",
        enabled: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/v1/gotify", "PUT", {
        url: "https://gotify.example/?token=bad",
        token: "bad",
        enabled: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/api/v1/gotify/test", "POST", { workspace })).status,
    202,
  );
  let captured: any;
  await flush(async (_url, token, body) => {
    assert.equal(token, "fixture-application-token");
    captured = body;
    return 200;
  });
  assert.equal(captured.title, "Liora");
  assert.ok(!JSON.stringify(captured).includes("Test en file"));
  assert.equal((await call("/api/v1/gotify")).body.deliveries[0].state, "sent");
  assert.equal(
    (await call("/api/v1/gotify", "GET", undefined, memberCookie)).body
      .connection,
    null,
  );
  await call("/api/v1/gotify/test", "POST", { workspace });
  await flush(async () => 503);
  let pending = (await call("/api/v1/gotify")).body.deliveries.find(
    (d: any) => d.state === "pending",
  );
  assert.equal(pending.attempts, 1);
  assert.equal(pending.last_error, "HTTP 503");
  assert.equal(
    (
      await call(
        `/api/v1/gotify/deliveries/${pending.id}/cancel`,
        "POST",
        {},
        memberCookie,
      )
    ).status,
    409,
  );
  await db.query(
    "UPDATE gotify_deliveries SET next_attempt_at=now(),attempts=4 WHERE id=$1",
    [pending.id],
  );
  await flush(async () => 503);
  assert.equal(
    (await call("/api/v1/gotify")).body.deliveries.find(
      (d: any) => d.id === pending.id,
    ).state,
    "failed",
  );
  assert.equal(
    (await call(`/api/v1/gotify/deliveries/${pending.id}/retry`, "POST", {}))
      .status,
    200,
  );
  await flush(async () => 401);
  assert.equal(
    (await call("/api/v1/gotify")).body.deliveries.find(
      (d: any) => d.id === pending.id,
    ).state,
    "failed",
  );
  await call("/api/v1/gotify/test", "POST", { workspace });
  const [privateChannel] = await db.query(
    "INSERT INTO channels(workspace_id,name,is_private) VALUES($1,'gotify-private',true) RETURNING id",
    [workspace],
  );
  await db.query(
    "INSERT INTO notifications(workspace_id,user_id,type,title,body,channel_id) VALUES($1,$2,'message','Secret','Private body',$3)",
    [workspace, owner, privateChannel.id],
  );
  await db.query(
    "UPDATE users SET preferences=jsonb_set(preferences,'{tasks}','false'::jsonb) WHERE id=$1",
    [owner],
  );
  await db.query(
    "INSERT INTO notifications(workspace_id,user_id,type,title,body) VALUES($1,$2,'task','Task','Secret task')",
    [workspace, owner],
  );
  await db.query(
    "UPDATE workspace_members SET state='disabled' WHERE user_id=$1 AND workspace_id=$2",
    [owner, workspace],
  );
  try {
    await flush(async () => {
      throw Error("Must not deliver after rights revocation");
    });
  } finally {
    await db.query(
      "UPDATE workspace_members SET state='active' WHERE user_id=$1 AND workspace_id=$2",
      [owner, workspace],
    );
  }
  assert.equal(
    (await call("/api/v1/gotify")).body.deliveries.filter(
      (d: any) => d.state === "pending",
    ).length,
    0,
  );
  // Preference cancellation while the account is still active.
  await db.query(
    "INSERT INTO notifications(workspace_id,user_id,type,title,body) VALUES($1,$2,'task','Task','Secret task')",
    [workspace, owner],
  );
  let sends = 0;
  await flush(async () => {
    sends++;
    return 200;
  });
  assert.equal(sends, 0);
  await db.query(
    "UPDATE users SET preferences=jsonb_set(preferences,'{tasks}','true'::jsonb) WHERE id=$1",
    [owner],
  );
  await call("/api/v1/gotify/test", "POST", { workspace });
  pending = (await call("/api/v1/gotify")).body.deliveries.find(
    (d: any) => d.state === "pending",
  );
  assert.equal(
    (await call(`/api/v1/gotify/deliveries/${pending.id}/cancel`, "POST", {}))
      .status,
    200,
  );
  assert.equal((await call("/api/v1/gotify", "DELETE")).status, 200);
  assert.equal((await call("/api/v1/gotify")).body.connection, null);
});

test("dated notes stay personal, BrainDump uses the verified Kyros owner and failed sync preserves the cache", async () => {
  const me = (await call("/api/v1/me")).body.data;
  const created = await call("/api/v1/notes", "POST", {
    title: "Note personnelle",
    content: "## Une idée",
    due_at: "2026-10-06T10:00:00Z",
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal(
    (
      await call(
        "/api/v1/notes/" + id,
        "PATCH",
        { title: "Vol", content: "", due_at: "2026-10-06T10:00:00Z" },
        memberCookie,
      )
    ).status,
    404,
  );
  assert.ok(
    [401, 403].includes(
      (
        await call(
          "/api/v1/notes",
          "POST",
          { title: "Bot", content: "", due_at: "2026-10-06T10:00:00Z" },
          "Bearer " + technicalToken,
        )
      ).status,
    ),
  );
  const personalBot = randomBytes(32).toString("base64url");
  const { hash: hashPersonal } = await import("../src/server/crypto.js");
  await db.query(
    "INSERT INTO technical_accounts(workspace_id,name,kind,token_hash) VALUES($1,'Notes forbidden service','service',$2)",
    [workspace, hashPersonal(personalBot)],
  );
  assert.equal(
    (await call("/api/v1/notes", "GET", undefined, "Bearer " + personalBot))
      .status,
    403,
  );
  connections.notes.push(
    {
      id: 1,
      userId: me.kyros_user_id,
      title: "Note BrainDump",
      content: "Une **idée**",
      type: "note",
      dueAt: "2026-10-07T13:00:00Z",
      updatedAt: "2026-10-05T10:00:00Z",
      createdAt: "2026-10-05T10:00:00Z",
      archivedAt: null,
    },
    {
      id: 2,
      userId: me.kyros_user_id,
      title: "Sans date",
      content: "",
      type: "note",
      dueAt: null,
      updatedAt: "2026-10-05T10:00:00Z",
      createdAt: "2026-10-05T10:00:00Z",
      archivedAt: null,
    },
    {
      id: 3,
      userId: "other-kyros-subject",
      title: "Secret",
      content: "Autre compte",
      type: "note",
      dueAt: "2026-10-07T13:00:00Z",
      updatedAt: "2026-10-05T10:00:00Z",
      createdAt: "2026-10-05T10:00:00Z",
      archivedAt: null,
    },
  );
  assert.equal(
    (await call("/api/v1/braindump", "PUT", { enabled: true })).status,
    200,
  );
  assert.equal((await call("/api/v1/braindump/sync", "POST")).body.count, 1);
  const list = (await call("/api/v1/notes")).body.data;
  assert.equal(list.filter((n: any) => n.source === "braindump").length, 1);
  assert.ok(!list.some((n: any) => n.title === "Secret"));
  const imported = list.find((n: any) => n.source === "braindump");
  assert.equal(
    (await call("/api/v1/notes/" + imported.id, "DELETE")).status,
    404,
  );
  connections.failBrain(true);
  assert.equal((await call("/api/v1/braindump/sync", "POST")).status, 502);
  assert.ok(
    (await call("/api/v1/notes")).body.data.some(
      (n: any) => n.id === imported.id,
    ),
  );
  connections.failBrain(false);
  connections.notes[0].dueAt = "2026-10-08T15:00:00Z";
  await call("/api/v1/braindump/sync", "POST");
  assert.equal(
    new Date(
      (await call("/api/v1/notes")).body.data.find(
        (n: any) => n.id === imported.id,
      ).due_at,
    ).toISOString(),
    "2026-10-08T15:00:00.000Z",
  );
  connections.notes[0].dueAt = null;
  await call("/api/v1/braindump/sync", "POST");
  assert.ok(
    !(await call("/api/v1/notes")).body.data.some(
      (n: any) => n.id === imported.id,
    ),
  );
  await call("/api/v1/braindump", "PUT", { enabled: false });
  assert.ok(
    (await call("/api/v1/notes")).body.data.some((n: any) => n.id === id),
  );
});

test("appearance patches preserve independent account preferences and accept the new theme", async () => {
  const me = (await call("/api/v1/me")).body.data;
  const before = me.preferences;
  assert.equal(
    (
      await call("/api/v1/me/appearance", "PATCH", {
        theme: "lagoon",
        density: "compact",
      })
    ).status,
    200,
  );
  const changed = (await call("/api/v1/me")).body.data.preferences;
  assert.equal(changed.theme, "lagoon");
  assert.deepEqual(changed.collapsedNavigation, before.collapsedNavigation);
  assert.equal(changed.mentions, before.mentions);
  await call("/api/v1/me/appearance", "PATCH", { fontSize: "large" });
  assert.equal(
    (await call("/api/v1/me")).body.data.preferences.theme,
    "lagoon",
  );
  assert.equal(
    (await call("/api/v1/me/appearance", "PATCH", { theme: "unknown" })).status,
    400,
  );
});

test("CalDAV discovery, conditional edits, privacy, device revocation and native event round trip", async () => {
  const me = (await call("/api/v1/me")).body.data;
  const cred = await call("/api/v1/calendar-sync", "POST", {
    name: "Mac de test",
  });
  assert.equal(cred.status, 201);
  const authorization =
    "Basic " + Buffer.from(me.id + ":" + cred.body.password).toString("base64");
  const dav = async (
    path: string,
    method: string,
    body?: string,
    extra: Record<string, string> = {},
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        authorization,
        "content-type": method === "PUT" ? "text/calendar" : "application/xml",
        ...extra,
      },
      body,
    });
  const discovery = await dav(
    "/dav/",
    "PROPFIND",
    '<D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>',
    { depth: "0" },
  );
  assert.equal(discovery.status, 207);
  assert.match(await discovery.text(), new RegExp(me.id));
  const home = "/dav/calendars/" + me.id + "/";
  const props = await dav(home, "PROPFIND", "", { depth: "1" });
  assert.equal(props.status, 207);
  assert.match(await props.text(), /Mes notes datées/);
  const path = home + workspace + "/native-test.ics";
  const ics =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Fixture//FR\r\nBEGIN:VEVENT\r\nUID:native-test\r\nDTSTAMP:20261005T090000Z\r\nDTSTART;TZID=Europe/Paris:20261008T100000\r\nDTEND;TZID=Europe/Paris:20261008T110000\r\nSUMMARY:Depuis mon Mac\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
  const created = await dav(path, "PUT", ics, { "if-none-match": "*" });
  assert.equal(created.status, 201);
  const etag = created.headers.get("etag")!;
  const events = (
    await call(
      "/api/v1/workspaces/" +
        workspace +
        "/calendar?start=2026-10-01&end=2026-10-31&timezone=Europe%2FParis",
    )
  ).body.data;
  const native = events.find((e: any) => e.title === "Depuis mon Mac");
  assert.ok(native);
  assert.equal(
    new Date(native.start_at).toISOString(),
    "2026-10-08T08:00:00.000Z",
  );
  assert.equal(
    (
      await dav(path, "PUT", ics.replace("mon Mac", "un second Mac"), {
        "if-match": '"obsolete"',
      })
    ).status,
    412,
  );
  assert.equal(
    (
      await dav(path, "PUT", ics.replace("mon Mac", "un second Mac"), {
        "if-match": etag,
      })
    ).status,
    204,
  );
  const get = await dav(path, "GET");
  assert.match(await get.text(), /un second Mac/);
  const newTag = get.headers.get("etag")!;
  await call(
    "/api/v1/workspaces/" + workspace + "/calendar/" + native.id,
    "PATCH",
    { title: "Modifié dans Liora" },
  );
  const updated = await dav(path, "GET");
  assert.notEqual(updated.headers.get("etag"), newTag);
  assert.match(await updated.text(), /Modifié dans Liora/);
  const report = await dav(
    home + workspace + "/",
    "REPORT",
    '<C:calendar-multiget xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:"><D:prop><D:getetag/><C:calendar-data/></D:prop><D:href>' +
      path +
      "</D:href></C:calendar-multiget>",
  );
  assert.equal(report.status, 207);
  assert.match(await report.text(), /Modifié dans Liora/);
  assert.equal(
    (
      await dav(
        "/dav/calendars/" + memberId + "/" + workspace + "/",
        "PROPFIND",
        "",
        { depth: "1" },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await dav(
        home + workspace + "/",
        "PROPFIND",
        '<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><propfind/>',
        { depth: "0" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await dav(path, "DELETE", undefined, {
        "if-match": updated.headers.get("etag")!,
      })
    ).status,
    204,
  );
  assert.equal((await dav(path, "GET")).status, 404);
  assert.ok(
    !JSON.stringify((await call("/api/v1/calendar-sync")).body).includes(
      cred.body.password,
    ),
  );
  const [{ password_hash }] = await db.query(
    "SELECT password_hash FROM calendar_credentials WHERE id=$1",
    [cred.body.data.id],
  );
  assert.notEqual(password_hash, cred.body.password);
  assert.equal(
    (
      await call(
        "/api/v1/calendar-sync/" + cred.body.data.id,
        "DELETE",
        undefined,
        memberCookie,
      )
    ).status,
    200,
  );
  assert.equal((await dav(home, "PROPFIND", "", { depth: "0" })).status, 207);
  await call("/api/v1/calendar-sync/" + cred.body.data.id, "DELETE");
  assert.equal((await dav(home, "PROPFIND", "", { depth: "0" })).status, 401);
});

test("Google OAuth session binding, encrypted tokens, bidirectional edits, conflicts and deletion", async () => {
  const me = (await call("/api/v1/me")).body.data;
  const connect = (await call("/api/v1/google-calendar/connect", "POST")).body;
  const authResponse = await fetch(connect.url, { redirect: "manual" });
  const callback = authResponse.headers.get("location")!;
  const wrong = await fetch(callback, {
    headers: { cookie: memberCookie },
    redirect: "manual",
  });
  assert.equal(wrong.status, 400);
  const valid = await fetch(callback, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(valid.status, 302);
  const replay = await fetch(callback, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(replay.status, 400);
  const [stored] = await db.query(
    "SELECT tokens FROM google_calendar_connections WHERE user_id=$1",
    [me.id],
  );
  assert.ok(!stored.tokens.includes("fixture-refresh"));
  assert.equal(
    (await call("/api/v1/google-calendar/calendars")).body.data[0].id,
    "primary-fixture",
  );
  assert.equal(
    (
      await call("/api/v1/google-calendar", "PUT", {
        workspace_id: workspace,
        calendar_id: "primary-fixture",
        enabled: true,
      })
    ).status,
    200,
  );
  const event = (
    await call("/api/v1/workspaces/" + workspace + "/calendar", "POST", {
      title: "Google aller retour",
      start_at: "2026-10-08T10:00:00Z",
      end_at: "2026-10-08T11:00:00Z",
      timezone: "Europe/Paris",
    })
  ).body.data;
  const privateChannel = (
    await call("/api/v1/workspaces/" + workspace + "/channels", "POST", {
      name: "google-prive",
      type: "text",
      is_private: true,
    })
  ).body.data;
  await call("/api/v1/workspaces/" + workspace + "/calendar", "POST", {
    title: "Secret Google interdit",
    start_at: "2026-10-08T10:00:00Z",
    channel_id: privateChannel.id,
  });
  const first = await call("/api/v1/google-calendar/sync", "POST");
  assert.equal(first.body.ok, true);
  assert.ok(
    ![...connections.events.values()].some(
      (e) => e.summary === "Secret Google interdit",
    ),
  );
  const [{ google_id }] = await db.query(
    "SELECT google_id FROM google_calendar_links WHERE event_id=$1",
    [event.id],
  );
  connections.changeGoogle(google_id, { summary: "Changé sur Android" });
  assert.equal(
    (await call("/api/v1/google-calendar/sync", "POST")).body.ok,
    true,
  );
  assert.equal(
    (await call("/api/v1/workspaces/" + workspace + "/calendar/" + event.id))
      .body.data.title,
    "Changé sur Android",
  );
  await call(
    "/api/v1/workspaces/" + workspace + "/calendar/" + event.id,
    "PATCH",
    { title: "Changé sur Liora" },
  );
  await call("/api/v1/google-calendar/sync", "POST");
  assert.equal(connections.events.get(google_id)!.summary, "Changé sur Liora");
  connections.changeGoogle(google_id, { summary: "Version Google" });
  await call(
    "/api/v1/workspaces/" + workspace + "/calendar/" + event.id,
    "PATCH",
    { title: "Version Liora" },
  );
  const conflict = await call("/api/v1/google-calendar/sync", "POST");
  assert.ok(conflict.body.conflicts > 0);
  assert.equal(connections.events.get(google_id)!.summary, "Version Google");
  assert.equal(
    (await call("/api/v1/workspaces/" + workspace + "/calendar/" + event.id))
      .body.data.title,
    "Version Liora",
  );
  assert.ok(
    (await call("/api/v1/google-calendar")).body.issues.some(
      (i: any) => i.google_id === google_id,
    ),
  );
  await call("/api/v1/google-calendar/resolve", "POST", {
    google_id,
    version: "google",
  });
  assert.equal(
    (await call("/api/v1/workspaces/" + workspace + "/calendar/" + event.id))
      .body.data.title,
    "Version Google",
  );
  connections.changeGoogle(google_id, { status: "cancelled" });
  await call("/api/v1/google-calendar/sync", "POST");
  assert.equal(
    (await call("/api/v1/workspaces/" + workspace + "/calendar/" + event.id))
      .status,
    404,
  );
  const e2 = (
    await call("/api/v1/workspaces/" + workspace + "/calendar", "POST", {
      title: "Supprimer depuis Liora",
      start_at: "2026-10-10T10:00:00Z",
    })
  ).body.data;
  await call("/api/v1/google-calendar/sync", "POST");
  const [link2] = await db.query(
    "SELECT google_id FROM google_calendar_links WHERE event_id=$1",
    [e2.id],
  );
  await call(
    "/api/v1/workspaces/" + workspace + "/calendar/" + e2.id,
    "DELETE",
  );
  await call("/api/v1/google-calendar/sync", "POST");
  assert.equal(connections.events.get(link2.google_id)!.status, "cancelled");
  assert.equal(
    (await call("/api/v1/google-calendar", "GET", undefined, memberCookie)).body
      .connected,
    false,
  );
  await call("/api/v1/google-calendar", "DELETE");
  assert.equal((await call("/api/v1/google-calendar")).body.connected, false);
});

test("BrainDump integration uses real module routes, private consent, refresh and revocation", async () => {
  provider.setSubject("test-owner");
  const remote = await fixtureBrainDump(
    14319,
    origin + "/api/v1/integration-callback",
  );
  try {
    const created = await call(
      `/api/v1/workspaces/${workspace}/connectors`,
      "POST",
      {
        provider: "braindump",
        name: "BrainDump de test",
        config: {
          base_url: remote.origin,
          client_id: remote.client.client_id,
          allow_private: true,
        },
        api_key: remote.client.api_key,
      },
    );
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    assert.equal(created.body.incoming_url, undefined);
    assert.ok(!JSON.stringify(created.body).includes(remote.client.api_key));
    assert.equal(
      (await db.query("SELECT * FROM webhooks WHERE integration_id=$1", [id]))
        .length,
      0,
    );
    assert.equal(
      (
        await call(
          `/api/v1/workspaces/${workspace}/connectors/${id}/test`,
          "POST",
          {},
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/v1/braindump", "PUT", {
          enabled: true,
          integration_id: id,
        })
      ).status,
      409,
    );
    const consent = async () => {
      const start = await call(
        `/api/v1/workspaces/${workspace}/connections/${id}/start`,
        "POST",
        {},
      );
      assert.equal(start.status, 200);
      const url = new URL(start.body.url);
      const page = await fetch(url, { redirect: "manual" });
      const html = await page.text();
      const csrf = /name="csrf" value="([^"]+)"/.exec(html)![1];
      const sessionCookie = page.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      const allowed = await fetch(remote.origin + "/integrations/authorize", {
        method: "POST",
        headers: {
          origin: remote.origin,
          cookie: sessionCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...Object.fromEntries(url.searchParams),
          csrf,
          decision: "allow",
        }),
        redirect: "manual",
      });
      assert.equal(allowed.status, 302);
      return allowed.headers.get("location")!;
    };
    const redirect = await consent();
    const second = await login();
    assert.equal(
      (
        await fetch(redirect, {
          headers: { cookie: second },
          redirect: "manual",
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(redirect, { headers: { cookie }, redirect: "manual" }))
        .status,
      302,
    );
    assert.equal(
      (await fetch(redirect, { headers: { cookie }, redirect: "manual" }))
        .status,
      400,
    );
    const me = (await call("/api/v1/me")).body.data;
    const noteId = remote.note("test-owner", { title: "Note privée datée" });
    remote.note("test-owner", { title: "Sans date", dueAt: null });
    remote.note("test-owner", { type: "task" });
    remote.note("someone-else", { title: "Secret étranger" });
    assert.ok(
      (await call("/api/v1/braindump")).body.available.some(
        (i: any) => i.id === id && i.connected,
      ),
    );
    assert.equal(
      (
        await call("/api/v1/braindump", "PUT", {
          enabled: true,
          integration_id: id,
        })
      ).status,
      200,
    );
    assert.equal((await call("/api/v1/braindump/sync", "POST")).body.count, 1);
    const copied = (await call("/api/v1/notes")).body.data.find(
      (n: any) => n.title === "Note privée datée",
    );
    assert.ok(copied);
    assert.ok(
      !(await call("/api/v1/notes")).body.data.some(
        (n: any) => n.title === "Secret étranger" || n.title === "Sans date",
      ),
    );
    remote.fail(true);
    assert.equal((await call("/api/v1/braindump/sync", "POST")).status, 502);
    assert.ok(
      (await call("/api/v1/notes")).body.data.some(
        (n: any) => n.id === copied.id,
      ),
    );
    remote.fail(false);
    const [beforeRefresh] = await db.query(
      "SELECT tokens FROM integration_grants WHERE integration_id=$1 AND user_id=$2",
      [id, me.id],
    );
    await db.query(
      "UPDATE integration_grants SET expires_at=now()-interval '1 minute' WHERE integration_id=$1",
      [id],
    );
    assert.equal((await call("/api/v1/braindump/sync", "POST")).status, 200);
    const [afterRefresh] = await db.query(
      "SELECT tokens FROM integration_grants WHERE integration_id=$1 AND user_id=$2",
      [id, me.id],
    );
    assert.notEqual(afterRefresh.tokens, beforeRefresh.tokens);
    remote.database
      .prepare("UPDATE dumps SET due_at=NULL WHERE id=?")
      .run(noteId);
    await call("/api/v1/braindump/sync", "POST");
    assert.ok(
      !(await call("/api/v1/notes")).body.data.some(
        (n: any) => n.id === copied.id,
      ),
    );
    remote.database
      .prepare("UPDATE dumps SET due_at='2026-10-07T10:00:00Z' WHERE id=?")
      .run(noteId);
    await call("/api/v1/braindump/sync", "POST");
    const grant = remote.database
      .prepare("SELECT id FROM app_grants WHERE revoked_at IS NULL")
      .get();
    remote.database
      .prepare("UPDATE app_grants SET revoked_at=? WHERE id=?")
      .run(Date.now(), grant.id);
    assert.equal((await call("/api/v1/braindump/sync", "POST")).status, 409);
    assert.equal((await call("/api/v1/braindump")).body.data.enabled, false);
    assert.equal(
      (await call("/api/v1/notes")).body.data.filter(
        (n: any) => n.source === "braindump",
      ).length,
      0,
    );
    remote.setSubject("someone-else");
    const foreign = await consent();
    assert.equal(
      (await fetch(foreign, { headers: { cookie }, redirect: "manual" }))
        .status,
      403,
    );
    remote.setSubject("test-owner");
    const reconnect = await consent();
    assert.equal(
      (await fetch(reconnect, { headers: { cookie }, redirect: "manual" }))
        .status,
      302,
    );
    await call("/api/v1/braindump", "PUT", {
      enabled: true,
      integration_id: id,
    });
    await call("/api/v1/braindump/sync", "POST");
    assert.equal(
      (
        await call(
          `/api/v1/workspaces/${workspace}/connectors/${id}`,
          "PATCH",
          { enabled: false },
        )
      ).status,
      200,
    );
    assert.equal((await call("/api/v1/braindump")).body.data.enabled, false);
    assert.equal(
      (await call("/api/v1/notes")).body.data.filter(
        (n: any) => n.source === "braindump",
      ).length,
      0,
    );
  } finally {
    await remote.close();
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
