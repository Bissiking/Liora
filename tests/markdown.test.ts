// tests/markdown.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../src/client/Markdown.js";
const render = (text: string) =>
  renderToStaticMarkup(createElement(Markdown, { text }));
test("Markdown renders GFM while preserving authored line breaks", () => {
  const html = render(
    "# Titre\n\n**Gras** et *italique*\nDeuxième ligne\n\n- [x] Terminé\n- [ ] À faire\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```\n\nhttps://example.com",
  );
  assert.match(html, /<h1>Titre/);
  assert.match(html, /<strong>Gras/);
  assert.match(html, /<em>italique/);
  assert.match(html, /\nDeuxième ligne/);
  assert.match(html, /<table>/);
  assert.match(html, /disabled=""/);
  assert.match(html, /<pre><code/);
  assert.match(html, /rel="noopener noreferrer"/);
});
test("Markdown refuses executable HTML, unsafe protocols and remote image tracking", () => {
  const html = render(
    "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[attaque](javascript:alert%281%29)\n\n[unsafe](data:text/html,test)\n\n![Image privée](https://tracker.example/pixel)\n\n[sûr](https://example.com)",
  );
  assert.ok(
    !/<script|<img|onerror|javascript:|data:text|tracker\.example/.test(html),
  );
  assert.match(html, /Image privée/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("Markdown preserves styled mentions without interpreting member names as markup or code", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const html = renderToStaticMarkup(
    createElement(Markdown, {
      text: `**Bonjour** @[${id}] \`@[${id}]\``,
      mentionNames: { [id]: "<img src=x> **Nom**" },
    }),
  );
  assert.match(html, /class="mention"/);
  assert.match(html, /&lt;img src=x&gt; \*\*Nom\*\*/);
  assert.ok(!html.includes("<img"));
  assert.match(html, new RegExp(`<code>@\\[${id}\\]`));
});

test("Markdown includes safe underlines, headings, quotes, strikethrough and tables without permitting HTML", () => {
  const html = render(
    '# Titre\n\n++Souligné++ et ~~barré~~\n\n> Une citation\n\n| A | B |\n| - | - |\n| un | deux |\n\n`++code++`\n\n<u onclick="alert(1)">HTML</u>',
  );
  assert.match(html, /<h1>Titre<\/h1>/);
  assert.match(html, /<u class="markdown-underline">Souligné<\/u>/);
  assert.match(html, /<del>barré<\/del>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<table>/);
  assert.match(html, /<code>\+\+code\+\+<\/code>/);
  assert.ok(!/onclick|alert\(1\)/.test(html));
});
