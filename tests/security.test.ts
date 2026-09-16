// tests/security.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { seal, unseal, token, hash } from "../src/server/crypto.js";
import { permits, memberPermissions } from "../src/shared/permissions.js";
import { privateAddress } from "../src/server/network.js";
process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
test("sealed credentials reject tampering and a rotated encryption key", async () => {
  const secret = { refresh_token: token() };
  const encoded = await seal(secret);
  assert.ok(!encoded.includes(secret.refresh_token));
  assert.deepEqual(await unseal(encoded), secret);
  const parts = encoded.split(".");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  await assert.rejects(() => unseal(parts.join(".")));
  process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
  await assert.rejects(() => unseal(encoded));
  assert.equal(hash(secret.refresh_token).length, 64);
  assert.notEqual(token(), token());
});
test("atomic permission checks never infer administrator rights from role-like strings", () => {
  assert.equal(permits(memberPermissions, "SEND_MESSAGE"), true);
  assert.equal(permits(memberPermissions, "MANAGE_ROLES"), false);
  assert.equal(permits(["Owner", "admin", "*"], "MANAGE_SECURITY"), false);
});
test("outbound address policy excludes local, metadata, shared and reserved ranges", () => {
  for (const ip of [
    "127.0.0.1",
    "10.2.3.4",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.2",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.2",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(privateAddress(ip), true, ip);
  assert.equal(privateAddress("8.8.8.8"), false);
  assert.equal(privateAddress("172.32.0.1"), false);
});

test("public preview parser never emits executable HTML and recognizes GIF signatures", async () => {
  const { extractPreview, imageMime } =
    await import("../src/server/previews.js");
  const result = extractPreview(
    '<title>Example &amp; team</title><meta name="description" content="&lt;script&gt;hello&lt;/script&gt;"><script>alert(1)</script>',
    "https://example.com",
  );
  assert.equal(result.title, "Example & team");
  assert.equal(result.host, "example.com");
  assert.equal(imageMime(Buffer.from("GIF89a")), "image/gif");
  assert.equal(imageMime(Buffer.from('<svg onload="x">')), null);
});
test("page merge rejects competing reorder and preserves remote additions", async () => {
  const { mergeBlocks } = await import("../src/shared/page-merge.js");
  const a = { id: "a", type: "text", content: "A" },
    b = { id: "b", type: "text", content: "B" },
    c = { id: "c", type: "text", content: "C" };
  assert.deepEqual(
    mergeBlocks([a, b], [{ ...a, content: "A2" }, b], [a, b, c]),
    [{ ...a, content: "A2" }, b, c],
  );
  assert.equal(mergeBlocks([a, b, c], [b, a, c], [a, c, b]), null);
});

test("reply previews resolve mentions before clipping, using source metadata", async () => {
  const { replyPreview } = await import("../src/client/MessageContent.js");
  const id = "12345678-1234-1234-1234-123456789abc";
  const result = replyPreview(
    {
      content: "a".repeat(80) + `@[${id}] bonjour`,
      mentions: [{ id, kyros_user_id: "kyros-alex", name: "Alex" }],
    },
    [],
  );
  assert.equal(result, "a".repeat(80) + "@Alex bonj");
  assert.equal(result.includes("@["), false);
  assert.equal(replyPreview(undefined, []), "Réponse à un message précédent");
});
