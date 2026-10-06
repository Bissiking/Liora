// tests/message-preview.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { messageExcerpt } from "../src/shared/message-preview.js";

const id = "da26ece9-2449-43d5-9007-1c9b4309cac7";
test("thread excerpts resolve persisted mentions before removing Markdown", () => {
  assert.equal(
    messageExcerpt(`**@[${id}]**\n> Revue [Liora](https://example.com)`, [
      { id, name: "Matheo" },
    ]),
    "@Matheo Revue Liora",
  );
});
test("unresolved mentions never expose a raw identifier", () => {
  assert.equal(messageExcerpt(`@[${id}] Bonjour`), "@membre Bonjour");
});
test("excerpts preserve names using Kyros subjects and flatten headings", () => {
  assert.equal(
    messageExcerpt(`## @[${id.toUpperCase()}]\nSuite`, [
      { id: "local-account", kyros_user_id: id, name: "Camille" },
    ]),
    "@Camille Suite",
  );
});
