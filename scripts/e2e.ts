// scripts/e2e.ts
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import puppeteer from "puppeteer";
import { fixtureDropIt } from "../tests/fixtures/dropit.js";
import { fakeKyros } from "../tests/fixtures/kyros.js";
const origin = "http://localhost:14320";
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  "postgresql://matheohemery@127.0.0.1:55432/liora_e2e";
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /_e2e$/,
  "E2E requires a database ending in _e2e",
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
  KYROS_AUDIENCE: "kyros-modules",
  KYROS_RESOURCE_AUDIENCE: "kyros:liora",
  BOOTSTRAP_OWNER_KYROS_ID: "test-owner",
  ARGOS_BASE_URL: "",
  ARGUS_HEALTH_URL: "",
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("DROP SCHEMA public CASCADE");
await db.query("CREATE SCHEMA public");
const { migrate } = await import("./migrate.js");
const { seed } = await import("./seed.js");
const { pool } = await import("../src/server/db.js");
await migrate();
await seed();
const provider = await fakeKyros(14322, origin);
const dropit = await fixtureDropIt(
  14324,
  origin + "/api/v1/integration-callback",
);
await mkdir(".impeccable/review", { recursive: true });
let server: ChildProcess;
function start() {
  server = spawn(
    process.execPath,
    [process.env.E2E_SERVER_ENTRY || "dist/server/server/index.js"],
    {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on(
    "data",
    (chunk) => void appendFile("/tmp/liora-e2e-server.log", chunk),
  );
  server.stderr?.on(
    "data",
    (chunk) => void appendFile("/tmp/liora-e2e-server.log", chunk),
  );
}
async function ready() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${origin}/health/ready`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Server not ready");
}
async function stop() {
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => server.once("exit", () => resolve()));
}
start();
await ready();
const browser = await puppeteer.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const failures: string[] = [];
let plannedRestart = false;
page.on("pageerror", (e) => failures.push(String(e)));
page.on("console", (m) => {
  if (
    !(
      plannedRestart &&
      /ERR_INCOMPLETE_CHUNKED_ENCODING|ERR_CONNECTION_REFUSED/.test(m.text())
    ) &&
    m.type() === "error" &&
    !m.text().includes("401") &&
    !m.text().includes("net::ERR_ABORTED")
  )
    failures.push(m.text() + " " + (m.location().url || ""));
});
async function click(text: string) {
  await page.waitForFunction(
    (t) =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent?.trim() === t,
      ),
    {},
    text,
  );
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === t,
    );
    b?.click();
  }, text);
}
async function waitText(text: string) {
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    {},
    text,
  );
}
try {
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin, { waitUntil: "networkidle0" });
  await page.screenshot({
    path: ".impeccable/review/login.png",
    fullPage: false,
  });
  await page.click('a[href="/auth/login"]');
  await page.waitForSelector(".composer textarea");
  await page.evaluate(() => document.fonts.ready);
  await waitText("Bienvenue dans Liora.");
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  // Regression: the workspace disclosure works by mouse and keyboard.
  await page.click(".workspace-title");
  await page.waitForSelector("#workspace-choices");
  await page.screenshot({
    path: ".impeccable/review/workspace-menu.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  assert.equal(await page.$("#workspace-choices"), null);
  // Regression: stale member rows must never be rendered as roles, even with a delayed response.
  await click("Administration");
  await click("Membres");
  await page.waitForSelector(".admin-row");
  await page.setRequestInterception(true);
  const delayRoles = (request: import("puppeteer").HTTPRequest) => {
    if (request.url().endsWith("/roles"))
      setTimeout(() => void request.continue(), 350);
    else void request.continue();
  };
  page.on("request", delayRoles);
  await click("Rôles et permissions");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".admin-row")].some((r) =>
      r.textContent?.includes("Owner"),
    ),
  );
  await click("Membres");
  await click("Rôles et permissions");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".admin-row")].some((r) =>
      r.textContent?.includes("Owner"),
    ),
  );
  assert.equal(await page.$(".empty[role=alert]"), null);
  await page.screenshot({
    path: ".impeccable/review/roles.png",
    fullPage: false,
  });
  await page.setRequestInterception(false);
  page.off("request", delayRoles);
  await click("general");
  // Thread and pin workflow.
  await page.waitForSelector(".thread-link");
  await page.click(".thread-link");
  await page.type("dialog textarea", "Une réponse dans un fil persistant.");
  await click("Envoyer la réponse");
  await waitText("Une réponse dans un fil persistant.");
  await page.screenshot({
    path: ".impeccable/review/thread.png",
    fullPage: false,
  });
  await page.click('dialog [aria-label="Fermer"]');
  await page.click('[aria-label="Épingler"]');
  await page.click('[aria-label="Messages épinglés"]');
  await waitText("Message épinglé");
  await page.click('[aria-label="Tous les messages"]');
  await click("Rechercher des messages");
  await page.type("dialog input", "Bienvenue");
  await click("Rechercher");
  await page.waitForSelector(".search-results button");
  await page.click('dialog [aria-label="Fermer"]');
  // A second human receives and loses monitoring permission without logging out.
  provider.setSubject("browser-member");
  const memberContext = await browser.createBrowserContext();
  const member = await memberContext.newPage();
  await member.goto(`${origin}/auth/login`);
  await member.waitForSelector(".waiting");
  provider.setSubject("test-owner");
  const workspaceId = (
    await db.query("SELECT id FROM workspaces WHERE name='LUMA'")
  ).rows[0].id;
  const memberRow = (
    await db.query("SELECT id FROM users WHERE kyros_user_id='browser-member'")
  ).rows[0];
  const role = (
    await db.query(
      "SELECT * FROM roles WHERE workspace_id=$1 AND name='Member'",
      [workspaceId],
    )
  ).rows[0];
  await db.query(
    "INSERT INTO workspace_members(workspace_id,user_id,role_id) VALUES($1,$2,$3)",
    [workspaceId, memberRow.id, role.id],
  );
  await member.reload({ waitUntil: "domcontentloaded" });
  await member.waitForSelector(".composer textarea");
  assert.equal(
    await member.$$eval(".main-nav button", (buttons) =>
      buttons.some((b) => b.textContent?.includes("Supervision")),
    ),
    false,
  );
  const updateRole = async (permissions: string[]) =>
    page.evaluate(
      async ({ workspaceId, role, permissions }) => {
        const r = await fetch(
          `/api/v1/workspaces/${workspaceId}/roles/${role.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: role.name, permissions }),
          },
        );
        return r.status;
      },
      { workspaceId, role, permissions },
    );
  assert.equal(await updateRole([...role.permissions, "VIEW_MONITORING"]), 200);
  await member.waitForFunction(() =>
    [...document.querySelectorAll(".main-nav button")].some((b) =>
      b.textContent?.includes("Supervision"),
    ),
  );
  await member.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>(".main-nav button")]
      .find((b) => b.textContent?.includes("Supervision"))
      ?.click(),
  );
  await member.waitForSelector(".monitor-target");
  assert.equal(await updateRole(role.permissions), 200);
  await member.waitForFunction(
    () =>
      ![...document.querySelectorAll(".main-nav button")].some((b) =>
        b.textContent?.includes("Supervision"),
      ),
  );
  assert.equal(await member.$(".monitor-target"), null);
  await page.click('[aria-label="Créer un salon"]');
  await page.type('dialog input[name="name"]', "salon-prive-navigateur");
  await page.select('dialog select[name="is_private"]', "true");
  await page.click("dialog button.primary");
  await page.waitForSelector('[aria-label="Gérer les accès du salon"]');
  await page.click('[aria-label="Gérer les accès du salon"]');
  await page.waitForSelector("dialog .check-line input");
  await page.$$eval("dialog .check-line input", (inputs) =>
    inputs.forEach((el) => {
      const input = el as HTMLInputElement;
      if (!input.checked) input.click();
    }),
  );
  await click("Enregistrer les accès");
  await member.waitForFunction(() =>
    document.body.innerText.includes("salon-prive-navigateur"),
  );
  await click("Conversation privée");
  await page.waitForSelector('dialog select[name="user_id"]');
  await page.select('dialog select[name="user_id"]', memberRow.id);
  await page.click("dialog button.primary");
  await page.waitForFunction(() =>
    document.querySelector(".channel-heading h1")?.textContent?.includes(" · "),
  );
  await page.type(".composer textarea", "Message direct depuis le navigateur.");
  await page.click('[aria-label="Envoyer le message"]');
  await waitText("Message direct depuis le navigateur.");
  await page.screenshot({
    path: ".impeccable/review/direct-message.png",
    fullPage: false,
  });
  await click("general");
  await page.waitForSelector(".composer textarea");
  await memberContext.close();
  await page.type(
    ".composer textarea",
    "Le test navigateur confirme que les messages persistent.",
  );
  await page.click('[aria-label="Envoyer le message"]');
  await waitText("Le test navigateur confirme");
  const context = await browser.createBrowserContext();
  const second = await context.newPage();
  await context.setCookie(...(await browser.defaultBrowserContext().cookies()));
  await second.goto(origin);
  await second.waitForSelector(".composer textarea");
  await second.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>(".channel-group button")]
      .find((b) => b.textContent?.trim() === "general")
      ?.click(),
  );
  await second.waitForFunction(
    () =>
      document.querySelector(".channel-heading h1")?.textContent === "general",
  );
  await second.type(
    ".composer textarea",
    "Signal envoyé depuis une seconde session navigateur.",
  );
  await second.click('[aria-label="Envoyer le message"]');
  await waitText("Signal envoyé depuis une seconde");
  await context.close();
  await page.evaluate(() => {
    const m = [...document.querySelectorAll(".message")].find((m) =>
      m.textContent?.includes("Le test navigateur confirme"),
    );
    (
      m?.querySelector(
        '[aria-label="Ajouter une réaction"]',
      ) as HTMLButtonElement
    )?.click();
  });
  await page.waitForSelector('[aria-label="Insérer pouce vers le haut"]');
  await page.click('[aria-label="Insérer pouce vers le haut"]');
  await page.waitForSelector(".reactions .selected");
  await click("Amis");
  await click("Créer une invitation");
  await page.waitForSelector('[aria-label="Lien d’invitation"]');
  const invitation = await page.$eval(
    '[aria-label="Lien d’invitation"]',
    (el) => (el as HTMLInputElement).value,
  );
  provider.setSubject("browser-member");
  const friendContext = await browser.createBrowserContext();
  const friendPage = await friendContext.newPage();
  await friendPage.goto(`${origin}/auth/login`);
  await friendPage.waitForSelector(".composer textarea");
  provider.setSubject("test-owner");
  await friendPage.goto(invitation);
  await friendPage.waitForSelector(".invitation-page");
  await friendPage.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((b) => b.textContent === "Accepter l’invitation")
      ?.click(),
  );
  await friendPage.waitForSelector(".composer textarea");
  await page.waitForSelector(".friends-list article");
  await page.screenshot({
    path: ".impeccable/review/friends.png",
    fullPage: false,
  });
  await friendContext.close();
  await click("Aide et tutoriels");
  await waitText("Inviter un ami");
  await page.type('[aria-label="Rechercher dans l’aide"]', "aperçu");
  await waitText("Rédiger une page");
  await page.screenshot({
    path: ".impeccable/review/help.png",
    fullPage: false,
  });
  await click("general");
  await page.waitForSelector(".composer textarea");
  await page.click('[aria-label="Mentionner un membre"]');
  await page.waitForSelector(".mention-menu button");
  await page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>(".mention-menu button")]
      .find((b) => b.textContent?.includes("Alex"))
      ?.click(),
  );
  assert.ok(
    (
      await page.$eval(
        ".composer textarea",
        (el) => (el as HTMLTextAreaElement).value,
      )
    ).includes("@Alex"),
  );
  await page.keyboard.type("bonjour !");
  await page.click('[aria-label="Envoyer le message"]');
  await page.waitForSelector(".message-text .mention");
  assert.equal(
    await page.$eval(".message-text .mention", (el) => el.textContent),
    "@Alex Dupont",
  );
  await page.click('[aria-label="Ajouter un emoji"]');
  await page.waitForSelector(".emoji-grid button");
  await page.type('[aria-label="Rechercher un emoji"]', "chat");
  await page.screenshot({
    path: ".impeccable/review/emojis.png",
    fullPage: false,
  });
  await page.click(".emoji-grid button");
  await page.$eval(".composer textarea", (el) => {
    (el as HTMLTextAreaElement).value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Clear via keyboard so React's controlled draft follows.
  await page.focus(".composer textarea");
  await page.keyboard.down("Meta");
  await page.keyboard.press("A");
  await page.keyboard.up("Meta");
  await page.keyboard.press("Backspace");
  await writeFile(
    "/tmp/liora-preview.gif",
    Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
  );
  const fileInput = await page.$('.composer input[type="file"]');
  await fileInput!.uploadFile("/tmp/liora-preview.gif");
  await page.waitForFunction(() =>
    Boolean(
      (
        document.querySelector(".composer textarea") as HTMLTextAreaElement
      )?.value.includes("/attachments/"),
    ),
  );
  await page.click('[aria-label="Envoyer le message"]');
  await page.waitForSelector(".chat-image img");
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>(".chat-image img")].some(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await click("Administration");
  await click("Groupes");
  await page.type('[aria-label="Nom du groupe"]', "Équipe navigateur");
  await click("Créer le groupe");
  await click("Équipe navigateur · 0");
  await page.click(".group-management fieldset input");
  await click("Enregistrer le groupe");
  await waitText("Groupe enregistré");
  await page.screenshot({
    path: ".impeccable/review/groups.png",
    fullPage: false,
  });

  await click("Intégrations");
  await click("Ajouter un module");
  await page.select('.connector-form select[name="provider"]', "github");
  assert.equal(await page.$('.connector-form input[name="client_id"]'), null);
  assert.equal(await page.$('[aria-label="URL de retour DropIt"]'), null);
  await page.type('.connector-form input[name="name"]', "GitHub navigateur");
  await page.type(
    '.connector-form input[name="base_url"]',
    "https://api.github.com",
  );
  await click("Enregistrer le module");
  await page.waitForSelector("dialog[open]");
  await page.click('dialog [aria-label="Fermer"]');
  assert.equal(await page.$('.connector-form input[name="client_id"]'), null);
  await page.screenshot({
    path: ".impeccable/review/github-desktop.png",
    fullPage: false,
  });
  await click("Ajouter un module");
  await page.type('.connector-form input[name="name"]', "DropIt navigateur");
  await page.type('.connector-form input[name="base_url"]', dropit.origin);
  await page.type('.connector-form input[name="client_id"]', dropit.client.id);
  await page.type(
    '.connector-form input[name="api_key"]',
    dropit.client.api_key,
  );
  await page.click('.connector-form input[name="allow_private"]');
  await click("Enregistrer le module");
  await page.waitForSelector("dialog[open]");
  await page.click('dialog [aria-label="Fermer"]');
  await click("Tester la connexion");
  await waitText("Connexion vérifiée.");
  await page.screenshot({
    path: ".impeccable/review/integrations.png",
    fullPage: false,
  });
  await page.click(".profile-button");
  await click("Comptes connectés");
  await click("Connecter mon compte");
  await page.waitForSelector('form[action="/integrations/authorize"]');
  await page.screenshot({
    path: ".impeccable/review/dropit-consent.png",
    fullPage: false,
  });
  await click("Autoriser la connexion");
  await page.waitForSelector(".connected-accounts");
  await click("Mes fichiers");
  await waitText("Guide de démonstration.pdf");
  assert.equal(
    await page.evaluate(() =>
      document.body.innerText.includes("Fichier privé étranger.pdf"),
    ),
    false,
  );
  await page.screenshot({
    path: ".impeccable/review/connected-files.png",
    fullPage: false,
  });
  await click("general");
  await page.click('[aria-label="Commandes disponibles"]');
  await waitText("Commandes personnelles");
  await page.screenshot({
    path: ".impeccable/review/commands.png",
    fullPage: false,
  });
  await page.click('dialog [aria-label="Fermer"]');
  await page.click('[aria-label="Fichiers DropIt"]');
  await click("Mes fichiers");
  await click("Insérer le partage");
  await click("Insérer le lien dans mon brouillon");
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLTextAreaElement>(".composer textarea")
      ?.value.includes("/d/synthetic-only"),
  );
  await page.click(".composer textarea");
  await page.keyboard.down("Meta");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Meta");
  await page.keyboard.press("Backspace");
  await click("Projets");
  await page.waitForSelector(".task-card");
  await page.screenshot({
    path: ".impeccable/review/board.png",
    fullPage: false,
  });
  await page.click(".task-title");
  await page.waitForSelector(".task-detail");
  const target = await page.$eval(
    ".task-detail select",
    (el) => (el as HTMLSelectElement).options[1].value,
  );
  await page.select(".task-detail select", target);
  await page.waitForFunction(
    (t) =>
      (document.querySelector(".task-detail select") as HTMLSelectElement)
        ?.value === t,
    {},
    target,
  );
  await page.click('dialog [aria-label="Fermer"]');
  await click("Pages de l’équipe");
  await page.waitForSelector(".document-block textarea");
  await page.click(".document-block textarea");
  await page.keyboard.press("End");
  await page.keyboard.type(" Version enregistrée.");
  await click("Enregistrer");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Modifications non enregistrées"),
  );
  await click("Aperçu");
  await page.waitForFunction(() =>
    document
      .querySelector(".document-modes")
      ?.textContent?.includes("Mode lecture"),
  );
  assert.equal(await page.$(".document-block textarea"), null);
  await page.screenshot({
    path: ".impeccable/review/page-preview.png",
    fullPage: false,
  });
  await click("Modifier");
  await page.select('[aria-label="Ajouter un bloc"]', "stats");
  await click("Aperçu");
  await page.waitForSelector(".embedded-stats");
  await click("Enregistrer");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Modifications non enregistrées"),
  );
  await click("Supervision");
  await page.waitForSelector(".monitor-target");
  await page.screenshot({
    path: ".impeccable/review/monitoring.png",
    fullPage: false,
  });
  await click("Administration");
  await click("Salons");
  await page.waitForSelector(".admin-row");
  await click("Ajouter");
  await page.type('dialog input[name="name"]', "salon-navigateur");
  await page.click("dialog button.primary");
  await waitText("salon-navigateur");
  await click("Feature flags");
  await waitText("jellyfin.enabled");
  assert.equal(
    await page.$$eval(".main-nav button", (els) =>
      els.some((e) => /jellyfin|films|séries/i.test(e.textContent || "")),
    ),
    false,
  );
  await page.screenshot({
    path: ".impeccable/review/admin.png",
    fullPage: false,
  });
  await page.click(".profile-button");
  await click("Apparence");
  await page.select('select[name="theme"]', "dusk");
  await click("Enregistrer");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dusk",
  );
  await page.screenshot({
    path: ".impeccable/review/dusk.png",
    fullPage: false,
  });
  await page.select('select[name="theme"]', "light");
  await click("Enregistrer");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({
    path: ".impeccable/review/light.png",
    fullPage: false,
  });
  await page.select('select[name="theme"]', "dark");
  await click("Enregistrer");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await click("general");
  await page.waitForSelector(".composer textarea");
  plannedRestart = true;
  await stop();
  start();
  await ready();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".composer textarea");
  await click("general");
  await waitText("Le test navigateur confirme");
  plannedRestart = false;
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  });
  await waitText("Le test navigateur confirme");
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.click('[aria-label="Ouvrir la navigation"]');
  await page.waitForFunction(
    () =>
      document.querySelector(".sidebar.open")?.getBoundingClientRect().x === 0,
  );
  await page.click(".workspace-title");
  await page.waitForSelector("#workspace-choices");
  await page.screenshot({
    path: ".impeccable/review/mobile-workspace-menu.png",
    fullPage: false,
  });
  await page.click(".workspace-title");
  await click("Projets");
  await page.waitForSelector(".task-card");
  await page.waitForFunction(
    () =>
      (document.querySelector(".sidebar")?.getBoundingClientRect().right ??
        1) <= 0,
  );
  await page.screenshot({
    path: ".impeccable/review/mobile-board.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.click('[aria-label="Ouvrir la navigation"]');
  await page.waitForFunction(
    () =>
      document.querySelector(".sidebar.open")?.getBoundingClientRect().x === 0,
  );
  await click("Aide et tutoriels");
  await page.waitForSelector(".help-article");
  await page.waitForFunction(
    () =>
      (document.querySelector(".sidebar")?.getBoundingClientRect().right ??
        1) <= 0,
  );
  await page.screenshot({
    path: ".impeccable/review/mobile-help.png",
    fullPage: false,
  });
  await page.click('[aria-label="Ouvrir la navigation"]');
  await page.waitForSelector(".sidebar.open");
  await page.click(".profile-button");
  await click("Comptes connectés");
  await click("Mes fichiers");
  await waitText("Guide de démonstration.pdf");
  await page.screenshot({
    path: ".impeccable/review/mobile-connections.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.click('[aria-label="Ouvrir la navigation"]');
  await page.waitForSelector(".sidebar.open");
  await click("Administration");
  await click("Intégrations");
  await page.waitForSelector(".integration-list");
  await page.screenshot({
    path: ".impeccable/review/mobile-integrations.png",
    fullPage: false,
  });
  await page.evaluate(() => {
    const btn = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".integration-list button"),
    ).find((b) => b.innerText.includes("GitHub navigateur"));
    btn?.click();
  });
  await page.waitForSelector('.connector-form input[name="base_url"]');
  assert.equal(await page.$('.connector-form input[name="client_id"]'), null);
  await page.screenshot({
    path: ".impeccable/review/github-mobile.png",
    fullPage: false,
  });
  await page.goto(dropit.origin + "/integrations");
  await page.waitForSelector("#clients article");
  await page.screenshot({
    path: ".impeccable/review/dropit-mobile.png",
    fullPage: false,
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".impeccable/review/dropit-desktop.png",
    fullPage: false,
  });
  assert.deepEqual(failures, []);
  console.log(
    "E2E PASS: Kyros, refresh of monitoring grants, member/role race, workspace menus, threads, pins, search, private channel access, DMs, messages, kanban, pages, themes, persistence, 1440×1000 and 390×844.",
  );
} catch (e) {
  console.error("Browser QA failure:", e);
  await page
    .screenshot({ path: ".impeccable/review/failure.png", fullPage: false })
    .catch(() => {});
  console.error(
    await page
      .evaluate(() => document.body.innerText.slice(-3500))
      .catch(() => ""),
  );
  throw e;
} finally {
  await browser.close();
  await stop();
  await new Promise<void>((resolve) => provider.server.close(() => resolve()));
  await db.end();
  await pool.end();
  await dropit.close();
}
