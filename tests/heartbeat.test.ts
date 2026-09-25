// tests/heartbeat.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { sendHeartbeat } from "../scripts/send-heartbeat.js";

test("Argus sender checks health, authenticates, validates receipt and never follows redirects", async () => {
  let healthStatus = 200,
    healthBody = "ok",
    receiverStatus = 200;
  let receiverBody: unknown = {
    ok: true,
    received_at: new Date().toISOString(),
  };
  let received = 0;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") {
      res.writeHead(healthStatus);
      res.end(JSON.stringify({ status: healthBody }));
      return;
    }
    received++;
    assert.equal(req.method, "POST");
    assert.equal(req.headers.authorization, "Bearer test-only");
    res.writeHead(receiverStatus, { location: "/must-not-follow" });
    res.end(JSON.stringify(receiverBody));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const env = {
    LIORA_HEARTBEAT_URL: `${origin}/heartbeat`,
    ARGOS_HEALTH_URL: `${origin}/health`,
    LIORA_SERVICE_TOKEN: "test-only",
  };
  try {
    assert.equal(
      await sendHeartbeat(env),
      (receiverBody as { received_at: string }).received_at,
    );
    assert.equal(received, 1);
    healthStatus = 503;
    await assert.rejects(sendHeartbeat(env), /aucun heartbeat envoyé/);
    healthStatus = 200;
    healthBody = "DOWN";
    await assert.rejects(sendHeartbeat(env), /aucun heartbeat envoyé/);
    assert.equal(received, 1);
    healthBody = "ok";
    receiverStatus = 401;
    await assert.rejects(sendHeartbeat(env), /HTTP 401/);
    receiverStatus = 302;
    await assert.rejects(sendHeartbeat(env), /Envoi impossible/);
    assert.equal(received, 3);
    receiverStatus = 200;
    receiverBody = { ok: true };
    await assert.rejects(sendHeartbeat(env), /pas confirmé/);
    await assert.rejects(
      sendHeartbeat({ ...env, LIORA_SERVICE_TOKEN: "" }),
      /LIORA_SERVICE_TOKEN/,
    );
    await assert.rejects(
      sendHeartbeat({
        ...env,
        LIORA_HEARTBEAT_URL: "https://user:secret@example.com",
      }),
      /sans identifiants/,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
