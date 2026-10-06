// scripts/e2e.ts
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, appendFile, readdir, readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import puppeteer from "puppeteer";
import { fakeKyros } from "../tests/fixtures/kyros.js";
import { fixturePlaces } from "../tests/fixtures/places.js";
const origin = "http://localhost:14320";
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  "postgresql://matheohemery@127.0.0.1:55432/liora_e2e";
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /_e2e$/,
  "E2E requires an isolated _e2e database",
);
Object.assign(process.env, {
  NODE_ENV: "production",
  APP_URL: origin,
  HOST: "127.0.0.1",
  PORT: "14320",
  SESSION_SECRET: randomBytes(48).toString("base64url"),
  KYROS_BASE_URL: "http://127.0.0.1:14322",
  KYROS_CLIENT_ID: "liora-test",
  KYROS_CLIENT_SECRET: "",
  KYROS_SCOPES: "profile email offline_access",
  KYROS_ISSUER: "",
  KYROS_RESOURCE_AUDIENCE: "kyros:liora",
  BOOTSTRAP_OWNER_KYROS_ID: "test-owner",
  ARGOS_BASE_URL: "",
  ARGUS_HEALTH_URL: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  PLACES_GEOCODER_URL: "http://127.0.0.1:14326/photon",
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("DROP SCHEMA public CASCADE");
await db.query("CREATE SCHEMA public");
const { migrate } = await import("./migrate.js"),
  { seed } = await import("./seed.js"),
  { pool } = await import("../src/server/db.js");
// Upgrade a populated 0.7.1 database, including retired features, without changing their data.
await db.query(
  "CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
);
for (const name of (await readdir("migrations"))
  .filter((n) => n.endsWith(".sql") && n < "012")
  .sort()) {
  const sql = await readFile(`migrations/${name}`, "utf8");
  await db.query(sql);
  await db.query("INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)", [
    name,
    createHash("sha256").update(sql).digest("hex"),
  ]);
}
const workspace = await seed();
const historicUser = (
  await db.query(
    "INSERT INTO users(kyros_user_id,name) VALUES('historic-account','Compte historique') RETURNING id",
  )
).rows[0].id;
const historicPage = (
  await db.query(
    'INSERT INTO pages(workspace_id,title,blocks) VALUES($1,\'Document historique\',\'[{"type":"text","content":"Conserver"}]\') RETURNING *',
    [workspace],
  )
).rows[0];
await db.query(
  "INSERT INTO google_calendar_connections(user_id,tokens,enabled,calendar_id) VALUES($1,'fixture-encrypted-token',true,'historic-calendar')",
  [historicUser],
);
await db.query(
  "UPDATE roles SET permissions=array_remove(array_remove(array_remove(array_remove(permissions,'READ_MESSAGE'),'ATTACH_FILES'),'MENTION_USERS'),'REPLY_THREAD')",
);
await migrate();
assert.deepEqual(
  (await db.query("SELECT * FROM pages WHERE id=$1", [historicPage.id]))
    .rows[0],
  historicPage,
);
assert.equal(
  (
    await db.query(
      "SELECT tokens FROM google_calendar_connections WHERE user_id=$1",
      [historicUser],
    )
  ).rows[0].tokens,
  "fixture-encrypted-token",
);
assert.equal(
  (await db.query("SELECT count(*)::int count FROM schema_migrations")).rows[0]
    .count,
  15,
);
await migrate(); // Existing checksums and new migrations are idempotent.
const provider = await fakeKyros(14322, origin),
  places = await fixturePlaces(14326);
let server: ChildProcess | undefined,
  browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
await mkdir(".impeccable/review", { recursive: true });
try {
  server = spawn(process.execPath, ["dist/server/server/index.js"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on(
    "data",
    (c) => void appendFile("/tmp/liora-100-e2e-server.log", c),
  );
  server.stderr?.on(
    "data",
    (c) => void appendFile("/tmp/liora-100-e2e-server.log", c),
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${origin}/health/ready`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "Server ready");
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
    protocolTimeout: 30000,
  });
  const page = await browser.newPage(),
    failures: string[] = [];
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.setViewport({ width: 1440, height: 1000 });
  page.on("pageerror", (e) => failures.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("Failed to load resource"))
      failures.push(m.text());
  });
  page.on("dialog", async (d) => d.accept());
  async function click(label: string, target: import("puppeteer").Page = page) {
    const button = await target.waitForFunction(
      (text) => {
        const list = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button,a"),
        );
        return list.find(
          (b) =>
            (b.textContent?.trim() === text ||
              b.getAttribute("aria-label") === text) &&
            b.getBoundingClientRect().width > 0 &&
            b.getBoundingClientRect().right > 0 &&
            b.getBoundingClientRect().left < innerWidth &&
            b.getBoundingClientRect().height > 0 &&
            !b.hasAttribute("disabled"),
        );
      },
      { timeout: 10000 },
      label,
    );
    await (
      button.asElement() as import("puppeteer").ElementHandle<Element>
    ).click();
  }
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    expected = 200,
  ) {
    const result = await page.evaluate(
      async ({ path, method, body }) => {
        const r = await fetch(path, {
          method,
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await r.text();
        let value: any;
        try {
          value = JSON.parse(text);
        } catch {
          value = { text };
        }
        return { status: r.status, body: value };
      },
      { path, method, body },
    );
    assert.equal(
      result.status,
      expected,
      `${method} ${path}: ${JSON.stringify(result.body.error || {})}`,
    );
    return result.body;
  }
  await page.goto(origin);
  await page.click('a[href="/auth/login"]');
  await page.waitForSelector(".shell-sidebar");
  await page.evaluate(() => document.fonts.ready);
  const me = (await request("/api/v1/me")).data,
    base = `/api/v1/workspaces/${workspace}`;
  await page.waitForSelector(".personal-home");
  await capture("v1-personal-desktop");
  assert.equal(
    await page.$$(".scope-personal .shell-channels").then((r) => r.length),
    0,
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.body.textContent?.includes("Pages de l’équipe") ||
        document.body.textContent?.includes("En direct"),
    ),
    false,
  );
  // Populated personal views: real friendship/message tables in the isolated E2E DB.
  const friend = (
    await db.query(
      "INSERT INTO users(kyros_user_id,name) VALUES('social-fixture-anais','Anaïs Laurent') RETURNING id",
      [],
    )
  ).rows[0];
  const otherFriend = (
    await db.query(
      "INSERT INTO users(kyros_user_id,name) VALUES('social-fixture-eliott','Eliott Moreau') RETURNING id",
      [],
    )
  ).rows[0];
  for (const person of [friend, otherFriend]) {
    await db.query(
      "INSERT INTO friendships(user_a,user_b) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))",
      [me.id, person.id],
    );
  }
  await db.query(
    "INSERT INTO friend_messages(sender_id,recipient_id,client_id,content,created_at,read_at) VALUES($1,$2,$3,'Salut ! On fait le point sur Liora demain ?',now()-interval '1 day',now())",
    [me.id, friend.id, crypto.randomUUID()],
  );
  await db.query(
    "INSERT INTO friend_messages(sender_id,recipient_id,client_id,content) VALUES($1,$2,gen_random_uuid(),'Oui, à 14 h. Je prépare **les dernières notes**. À demain !')",
    [friend.id, me.id],
  );
  await db.query(
    "INSERT INTO friend_messages(sender_id,recipient_id,client_id,content,read_at) VALUES($1,$2,gen_random_uuid(),'Merci pour ton retour, tout est prêt.',now())",
    [otherFriend.id, me.id],
  );
  await click("Messages privés");
  await page.waitForSelector(".personal-message-row");
  await click("Non lues");
  assert.equal((await page.$$(".personal-message-row")).length, 1);
  await click("Toutes");
  await page.click(".personal-message-row");
  await page.waitForSelector(".friend-bubble");
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".friend-message-list")
        ?.getAttribute("aria-busy")
        ?.includes("true"),
  );
  await page.type(".friend-messenger textarea", "Parfait, à demain !");
  await click("Envoyer");
  await page.waitForFunction(() =>
    document
      .querySelector(".friend-message-list")
      ?.textContent?.includes("Parfait, à demain !"),
  );
  assert.ok(
    (await request(`/api/v1/friends/${friend.id}/messages`)).data.some(
      (m: any) => m.content === "Parfait, à demain !",
    ),
  );
  const messengerBounds = await page.$eval(".friend-messenger", (el) => ({
    width: el.getBoundingClientRect().width,
    bottom: el.getBoundingClientRect().bottom,
  }));
  assert.ok(
    messengerBounds.width > 650,
    "Conversation fills available desktop width",
  );
  assert.ok(messengerBounds.bottom <= 1000, "Composer remains within viewport");
  assert.equal(
    await page.$eval(".personal-message-row .avatar", (el) =>
      Math.round(el.getBoundingClientRect().width),
    ),
    38,
  );
  await capture("social-messages-desktop");
  await page.setViewport({ width: 390, height: 844 });
  await capture("social-messages-mobile");
  await click("Retour aux conversations");
  await page.waitForSelector(".conversation-index");
  await capture("social-index-mobile");
  await click("Ouvrir la navigation");
  await click("Amis");
  await page.waitForSelector(".friend-open");
  await capture("social-friends-mobile");
  await page.setViewport({ width: 1440, height: 1000 });
  await page.type(".friend-search input", "Eliott");
  assert.equal((await page.$$(".friend-open")).length, 1);
  await page.$eval(".friend-search input", (el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".friend-open").length === 2,
  );
  await click("Écrire à Anaïs Laurent");
  await page.waitForSelector(".friend-bubble");
  await capture("social-friends-desktop");
  await click("Ajouter un ami");
  await page.waitForSelector(".friend-invite-dialog");
  await capture("social-invitation-desktop");
  await page.keyboard.press("Escape");
  await click("Messages privés");
  await page.waitForSelector(".personal-message-row");
  await page.click(".personal-message-row");
  await page.waitForSelector(".friend-bubble");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await capture(`social-messages-${theme}`);
  }
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Social overflow ${width}`,
    );
    assert.equal(
      await page.$eval(
        ".friend-send-row button",
        (el) => el.getBoundingClientRect().bottom <= innerHeight,
      ),
      true,
      `Send button visible ${width}`,
    );
  }
  await page.setViewport({ width: 1440, height: 1000 });
  const category = (
    await request(
      `${base}/categories`,
      "POST",
      { name: "Organisation · démonstration" },
      201,
    )
  ).data;
  const channel = (
    await request(
      `${base}/channels`,
      "POST",
      {
        name: "releases-demo",
        category_id: category.id,
        description: "Préparer les versions Liora · données de démonstration",
      },
      201,
    )
  ).data;
  await page.reload();
  await page.waitForSelector(".workspace-rail");
  await click("Espace LUMA");
  await page.waitForSelector(".shell-channels");
  await click(channel.name);
  await page.waitForSelector(".composer textarea");
  await page.type(
    ".composer textarea",
    "Revue **1.0** · message de démonstration",
  );
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector(".message-scroll")?.textContent?.includes("Revue"),
  );
  const message = (
    await request(`${base}/channels/${channel.id}/messages`)
  ).data.at(-1);
  await page.$eval(".message", (el) => (el as HTMLElement).focus());
  await page.keyboard.down("Shift");
  await page.keyboard.press("F10");
  await page.keyboard.up("Shift");
  await page.waitForSelector('[role="menu"]');
  await page.keyboard.press("Escape");
  assert.equal(
    await page.$eval(".composer textarea", (el) => {
      const e = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    }),
    false,
    "Native editor context menu preserved",
  );
  const mentionedThread = (
    await request(
      `${base}/channels/${channel.id}/messages`,
      "POST",
      {
        content: `**@[${me.id}]** Préparation de la prochaine version`,
      },
      201,
    )
  ).data;
  await request(
    `${base}/channels/${channel.id}/messages`,
    "POST",
    {
      content: "Les notes sont prêtes.",
      thread_id: mentionedThread.id,
    },
    201,
  );
  await page.waitForFunction(
    (name) =>
      document
        .querySelector(".channel-context")
        ?.textContent?.includes(`@${name} Préparation`),
    {},
    me.name,
  );
  const threadText = await page.$eval(
    ".channel-context",
    (el) => el.textContent,
  );
  assert.ok(
    !threadText?.includes(`@[${me.id}]`),
    "Thread titles resolve mentions",
  );
  assert.ok(threadText?.includes("1 réponse"), "Singular reply count");
  await capture("social-threads-desktop");
  await click("Paramètres du canal");
  await page.waitForSelector(".channel-settings");
  await page.waitForSelector(".settings-form fieldset");
  await capture("social-channel-general-desktop");
  await page.setViewport({ width: 390, height: 844 });
  await capture("social-channel-general-mobile");
  await page.setViewport({ width: 320, height: 844 });
  await capture("social-channel-general-320");
  assert.equal(
    await page.$eval(
      ".channel-settings",
      (el) => el.scrollWidth <= el.clientWidth,
    ),
    true,
    "Settings do not overflow at 320px",
  );
  await page.setViewport({ width: 1440, height: 1000 });
  await click("Permissions");
  await page.waitForSelector(".permission-row");
  await capture("social-channel-permissions-desktop");
  await click("Options");
  await page.$eval('.channel-settings input[type="number"]', (el) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "5");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click(".channel-settings .settings-toggle:last-of-type input");
  await page.waitForFunction(() =>
    document
      .querySelector(".settings-notice")
      ?.textContent?.includes("Paramètres enregistrés"),
  );
  assert.equal(
    await page.$eval(
      '.channel-settings input[type="number"]',
      (el) => (el as HTMLInputElement).value,
    ),
    "5",
    "Following preserves unsaved channel options",
  );
  await click("Enregistrer les options");
  await page.waitForFunction(() =>
    document
      .querySelector(".channel-settings")
      ?.textContent?.includes("Paramètres enregistrés"),
  );
  await capture("v1-channel-settings-desktop");
  await page.setViewport({ width: 390, height: 844 });
  await capture("social-channel-options-mobile");
  await page.setViewport({ width: 1440, height: 1000 });
  await page.keyboard.press("Escape");
  await click("Membres et contexte");
  await page.waitForSelector(".context-drawer");
  await page.waitForFunction(() =>
    document.querySelector(".context-drawer .member-open"),
  );
  await page.click(".context-drawer .member-open");
  await page.waitForSelector(".member-profile");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const fixtureRole = (
    await request(
      `${base}/roles`,
      "POST",
      {
        name: "Membres UX · démonstration",
        permissions: ["VIEW_WORKSPACE", "VIEW_CHANNEL", "READ_MESSAGE"],
      },
      201,
    )
  ).data;
  const accessNames = [
    "Anaïs Laurent",
    "Eliott Moreau",
    "Léa Bernard",
    "Hugo Petit",
    "Emma Robert",
    "Louis Durand",
    "Manon Dubois",
    "Lucas Leroy",
    "Chloé Morel",
    "Nathan Simon",
    "Camille Laurent",
    "Jules Lefebvre",
    "Inès Michel",
    "Gabriel Garcia",
    "Sarah Roux",
    "Arthur David",
    "Zoé Bertrand",
    "Noah Vincent",
    "Louise Fournier",
    "Raphaël Moreau",
  ];
  for (let i = 0; i < accessNames.length; i++) {
    await db.query(
      "INSERT INTO users(kyros_user_id,name) VALUES($1,$2) ON CONFLICT(kyros_user_id) DO NOTHING",
      [`access-fixture-${i}`, accessNames[i]],
    );
    await db.query(
      "INSERT INTO workspace_members(workspace_id,user_id,role_id) SELECT $1,id,$3 FROM users WHERE kyros_user_id=$2",
      [workspace, `access-fixture-${i}`, fixtureRole.id],
    );
  }
  const privateChannel = (
    await request(
      `${base}/channels`,
      "POST",
      { name: "equipe-privee-demo", is_private: true },
      201,
    )
  ).data;
  await page.reload();
  await page.waitForSelector(".shell-sidebar");
  await click(privateChannel.name);
  await page.waitForSelector(".channel-heading");
  await click("Paramètres du canal");
  await click("Accès privés");
  await page.waitForSelector(".channel-access-content .check-line");
  assert.equal(
    (await page.$$("dialog[open]")).length,
    1,
    "Private access is embedded in the existing settings dialog",
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".channel-access-content .check-line").length >=
      21,
  );
  await page.$eval(".channel-access-fields", (el) => {
    el.scrollTop = el.scrollHeight;
  });
  const accessFooter = await page.$eval(
    ".channel-access-content .settings-form-actions",
    (el) => el.getBoundingClientRect().bottom,
  );
  assert.ok(
    accessFooter <= 1000,
    "Access save button remains visible with a long member list",
  );
  await capture("social-channel-access-desktop");
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(
    (await page.$eval(
      ".channel-access-content .settings-form-actions",
      (el) => el.getBoundingClientRect().bottom,
    )) <= 844,
    "Mobile access save remains visible",
  );
  await capture("social-channel-access-mobile");
  await page.setViewport({ width: 1440, height: 1000 });
  await page.keyboard.press("Escape");
  await click(channel.name);
  await page.waitForSelector(".composer textarea");
  await request(`${base}/messages/${message.id}/pin`, "PUT", { pinned: true });
  // TEXT/EMBED preview and actual test use the same message pipeline.
  const hook = (
    await request(
      `${base}/webhooks`,
      "POST",
      { name: "Livraisons · démonstration", channel_id: channel.id },
      201,
    )
  ).data;
  await click("Administration");
  await click("Webhooks entrants");
  await page.waitForSelector(".webhook-settings");
  await page.select(".webhook-settings>label select", hook.id);
  await page.select(".webhook-editor select", "EMBED");
  await page.type(
    '.webhook-editor input[type="text"]',
    "Version 1.0 · démonstration",
  );
  await page.type(
    ".webhook-editor textarea",
    "Le nouveau contexte personnel est prêt pour la revue.",
  );
  await page.waitForSelector(".webhook-preview .webhook-embed");
  await click("Publier un test");
  await page.waitForFunction(() =>
    document.querySelector(".webhook-history")?.textContent?.includes("202"),
  );
  await capture("v1-webhook-history-desktop");
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      "main,.page,.shell-content,.shell-body,.webhook-settings",
    ))
      el.scrollTop = 0;
  });
  await capture("v1-webhooks-desktop");
  const rich = (
    await request(`${base}/channels/${channel.id}/messages`)
  ).data.find((m: any) => m.rich_content);
  assert.equal(rich.rich_content.mode, "EMBED");
  await request("/api/v1/google-calendar/connect", "POST", {}, 404);
  // Personal functions remain usable independently of the selected workspace.
  await click("Accueil personnel");
  await click("Rappels");
  await click("Nouveau rappel");
  await page.waitForSelector("dialog input");
  await page.type(
    'dialog input[name="title"]',
    "Revoir le brief · démonstration",
  );
  await click("Enregistrer");
  await page.waitForSelector(".reminder-row");
  await request(
    "/api/v1/me/favorites",
    "POST",
    { target_type: "channel", target_id: channel.id },
    201,
  );
  await click("Favoris");
  await page.waitForSelector(".favorite-row");
  await page.click(".favorite-row button");
  await page.waitForSelector(".composer textarea");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector(".scope-workspace .channel-heading h1")
          ?.textContent,
    ),
    channel.name,
  );
  await click("Accueil personnel");
  await click("Notes datées");
  await click("Nouvelle note");
  await page.waitForSelector("dialog input");
  await page.type(
    'dialog input[name="title"]',
    "Point de départ · démonstration",
  );
  await page.type("dialog textarea", "Notes privées en Markdown.");
  await click("Enregistrer");
  await page.waitForSelector(".dated-note");
  await click("Préférences");
  await click("Synchronisation Agenda");
  await page.waitForSelector(".caldav-settings");
  await page.waitForSelector(".caldav-settings form input");
  await page.type(".caldav-settings form input", "Mac · démonstration");
  await click("Créer un accès");
  await page.waitForSelector(".caldav-password");
  assert.equal((await request("/api/v1/calendar-sync")).data.length, 1);
  await click("J’ai conservé le mot de passe");
  assert.equal((await page.$$(".caldav-password")).length, 0);
  const credentials = await request("/api/v1/calendar-sync");
  await request(`/api/v1/calendar-sync/${credentials.data[0].id}`, "DELETE");
  // Kanban actions retain their business APIs and keyboard menus.
  await click("Espace LUMA");
  await click("Projets");
  await page.waitForSelector(".project-tabs");
  await page.waitForSelector(".project-tabs .entity-surface");
  await page.$eval(".project-tabs .entity-surface", (el) =>
    (el as HTMLElement).focus(),
  );
  await page.keyboard.down("Shift");
  await page.keyboard.press("F10");
  await page.keyboard.up("Shift");
  await page.waitForSelector('[role="menu"]');
  await page.keyboard.press("Escape");
  // Capture one batch of the built desktop/mobile surfaces and supported themes.
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `.impeccable/review/${name}.png`,
      fullPage: false,
    });
  }
  await page.waitForSelector(".kanban");
  await capture("v1-kanban-desktop");
  await click("releases-demo");
  await page.waitForSelector(".webhook-embed");
  await capture("desktop");
  const dimensions = await page.$eval(
    ".shell-v1",
    (el) => getComputedStyle(el).gridTemplateColumns,
  );
  for (const theme of [
    "light",
    "dusk",
    "midnight",
    "forest",
    "ember",
    "atelier",
    "orbit",
    "terminal",
    "lagoon",
    "dark",
  ]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    assert.equal(
      await page.$eval(
        ".shell-v1",
        (el) => getComputedStyle(el).gridTemplateColumns,
      ),
      dimensions,
      `${theme}: shared shell geometry`,
    );
    if (theme === "light") await capture("v1-paper-desktop");
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  await capture("mobile");
  await click("Membres et contexte");
  await page.waitForSelector(".context-drawer");
  await capture("v1-context-mobile");
  await page.keyboard.press("Escape");
  await click("Accueil personnel");
  await click("Ouvrir la navigation");
  await page.waitForSelector(".shell-sidebar.open");
  await click("Notes datées");
  await page.waitForSelector(".dated-note");
  assert.equal((await page.$$(".shell-sidebar.open")).length, 0);
  await capture("v1-notes-mobile");
  for (const width of [320, 768, 1024, 1440, 1920]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Overflow ${width}`,
    );
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await click("Préférences");
  await click("Synchronisation Agenda");
  await page.waitForSelector(".caldav-settings");
  await capture("v1-caldav-desktop");
  await page.setViewport({ width: 390, height: 844 });
  await capture("v1-caldav-mobile");
  // A fresh Kyros account has the same personal navigation with zero workspaces.
  provider.setSubject("v1-no-workspace");
  const context = await browser.createBrowserContext(),
    fresh = await context.newPage();
  await fresh.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await fresh.setViewport({ width: 390, height: 844 });
  await fresh.goto(`${origin}/auth/login`);
  await fresh.waitForSelector(".personal-home");
  assert.equal(
    await fresh.$$eval(".rail-workspaces button", (e) => e.length),
    0,
  );
  await fresh.screenshot({
    path: ".impeccable/review/v1-no-workspace-mobile.png",
    fullPage: false,
  });
  // The same account can subsequently read a workspace while write actions remain absent.
  provider.setSubject("test-owner");
  const readRole = (
    await request(
      `${base}/roles`,
      "POST",
      {
        name: "Lecture seule · démonstration",
        permissions: ["VIEW_WORKSPACE", "VIEW_CHANNEL", "READ_MESSAGE"],
      },
      201,
    )
  ).data;
  await request(
    `${base}/members`,
    "POST",
    { kyros_user_id: "v1-no-workspace", role_id: readRole.id },
    201,
  );
  await request(`${base}/messages/${message.id}/reactions`, "POST", {
    emoji: "👍",
  });
  await fresh.setViewport({ width: 1440, height: 1000 });
  await fresh.reload();
  await fresh.waitForSelector(".workspace-rail");
  await click("Espace LUMA", fresh);
  await click(channel.name, fresh);
  await fresh.waitForSelector(".message");
  await fresh.waitForSelector(".reactions > span");
  assert.equal(
    (await fresh.$$('.message-actions [aria-label="Répondre"]')).length,
    0,
  );
  assert.equal((await fresh.$$(".reactions button")).length, 0);
  assert.equal((await fresh.$$(".composer textarea")).length, 0);
  await fresh.click(".message > .entity-menu-button");
  await fresh.waitForSelector('[role="menu"]');
  const readonlyActions = await fresh.$$eval('[role="menuitem"]', (els) =>
    els.map((e) => e.textContent),
  );
  assert.equal(readonlyActions.includes("Répondre"), false);
  assert.equal(readonlyActions.includes("Ajouter une réaction"), false);
  await fresh.keyboard.press("Escape");
  await fresh.setViewport({ width: 1440, height: 1000 });
  await fresh.screenshot({
    path: ".impeccable/review/v1-readonly-desktop.png",
    fullPage: false,
  });
  await page.setViewport({ width: 320, height: 844 });
  await click("Espace LUMA");
  await click("Ouvrir la navigation");
  await click(channel.name);
  await page.waitForSelector(".message");
  await capture("v1-channel-320");
  await context.close();
  provider.setSubject("test-owner");
  assert.deepEqual(failures, [], "No critical console errors");
  console.log(
    "E2E 1.0 PASS: Kyros, personal/workspace navigation, chat, keyboard menus, channel options, context/profile drawers, generic webhook preview/test/history, personal reminders/favorites/notes, CalDAV credentials, Kanban, responsive widths, no-workspace account.",
  );
} finally {
  await browser?.close();
  if (server?.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((r) => server!.once("exit", () => r()));
  }
  await Promise.all([
    new Promise<void>((r) => provider.server.close(() => r())),
    places.close(),
    db.end(),
    pool.end(),
  ]);
}
