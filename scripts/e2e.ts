// scripts/e2e.ts
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, appendFile, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import puppeteer from "puppeteer";
import { fixtureDropIt } from "../tests/fixtures/dropit.js";
import { fakeKyros } from "../tests/fixtures/kyros.js";
import { fixturePlaces } from "../tests/fixtures/places.js";
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
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  PLACES_GEOCODER_URL: "http://127.0.0.1:14326/photon",
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
const placesProvider = await fixturePlaces(14326);
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
const expectedOfflineResponses = new Set<string>();
const expectedPlaceSearchResponses = new Set<string>();
page.on("response", async (response) => {
  if (
    response.status() === 503 &&
    new URL(response.url()).pathname === "/api/v1/places/search" &&
    new URL(response.url()).searchParams.get("q") === "Panne050"
  ) {
    try {
      if ((await response.json()).error?.code === "PLACE_SEARCH_UNAVAILABLE")
        expectedPlaceSearchResponses.add(response.url());
    } catch {}
  }
  if (response.status() !== 503 || !response.fromServiceWorker()) return;
  try {
    if ((await response.json()).error?.code === "OFFLINE")
      expectedOfflineResponses.add(response.url());
  } catch {
    /* A response discarded by navigation is not classified as expected. */
  }
});
function assertNoBrowserErrors() {
  assert.deepEqual(
    failures.filter(
      (message) =>
        ![...expectedOfflineResponses, ...expectedPlaceSearchResponses].some(
          (url) => message.includes("503") && message.endsWith(url),
        ),
    ),
    [],
  );
}

let plannedRestart = false;
let plannedOffline = false;
page.on("pageerror", (e) =>
  failures.push(e instanceof Error ? e.stack || String(e) : String(e)),
);
page.on("console", (m) => {
  if (
    !(
      plannedRestart &&
      /ERR_INCOMPLETE_CHUNKED_ENCODING|ERR_CONNECTION_REFUSED/.test(m.text())
    ) &&
    !plannedOffline &&
    m.type() === "error" &&
    !m.text().includes("401") &&
    !m.text().includes("net::ERR_ABORTED")
  )
    failures.push(m.text() + " " + (m.location().url || ""));
});
async function click(text: string) {
  if (text === "Administration") {
    if (!(await page.$("#workspace-choices")))
      await page.click(".workspace-title");
    await click("Paramètres de l’espace");
    await page.waitForSelector(".admin-layout");
    return;
  }
  if (text === "Aide et tutoriels") text = "Aide";
  await page.waitForFunction(
    (t) => {
      return [...document.querySelectorAll("button")].some((b) =>
        [b.textContent, b.getAttribute("aria-label"), b.title].some(
          (label) =>
            (label || "").trim().replaceAll("’", "'") ===
            (t || "").trim().replaceAll("’", "'"),
        ),
      );
    },
    {},
    text,
  );
  await page.evaluate((t) => {
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        ".admin-layout nav button",
      ),
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ];
    buttons
      .find((b) =>
        [b.textContent, b.getAttribute("aria-label"), b.title].some(
          (label) =>
            (label || "").trim().replaceAll("’", "'") ===
            (t || "").trim().replaceAll("’", "'"),
        ),
      )
      ?.click();
  }, text);
}
async function waitText(text: string) {
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    {},
    text,
  );
}
async function verifyExperience() {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.click(".topbar");
  await page.keyboard.down("Control");
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyF");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Control");
  await page.waitForSelector(".search-filters");
  await page.type(
    'dialog input[placeholder="Un sujet, une décision…"]',
    "Bienvenue",
  );
  const generalId = (
    await db.query("SELECT id FROM channels WHERE name='general' LIMIT 1")
  ).rows[0].id;
  await page.select(".search-filters select", generalId);
  await page.type('dialog input[placeholder="Nom affiché"]', "Argos");
  await click("Rechercher");
  await page.waitForSelector(".search-results button");
  await page.click('dialog [aria-label="Fermer"]');
  await click("Calendrier");
  await page.waitForSelector(".calendar-grid");
  await click("Nouvel événement");
  await page.type('dialog input[name="title"]', "Rendez-vous récurrent 0.4");
  await page.select('dialog select[name="recurrence"]', "daily");
  await page.click("dialog button.primary");
  await page.waitForSelector(".calendar-agenda-row");
  assert.ok(
    await page.$$eval(".calendar-agenda-row", (rows) => rows.length >= 1),
  );
  await page.click(".calendar-agenda-row");
  await click("Modifier");
  await page.$eval('dialog:last-of-type input[name="title"]', (el) => {
    (el as HTMLInputElement).value = "";
  });
  await page.type(
    'dialog:last-of-type input[name="title"]',
    "Rendez-vous modifié",
  );
  await page.click("dialog:last-of-type button.primary");
  await waitText("Rendez-vous modifié");
  await page.click(".calendar-agenda-row");
  await click("Ajouter aux favoris");
  await page.waitForSelector(".calendar-grid");
  await page.waitForSelector(".calendar-agenda-row");
  await page.screenshot({
    path: ".impeccable/review/experience-calendar-desktop.png",
    fullPage: false,
  });
  await click("Favoris");
  await waitText("Rendez-vous modifié");
  await click("Ouvrir");
  await page.waitForSelector("dialog[open]");
  await page.click('dialog [aria-label="Fermer"]');
  await click("Rappels");
  await click("Nouveau rappel");
  await page.type('dialog input[name="title"]', "Rappel réel 0.4");
  await page.select('dialog select[name="recurring_interval"]', "monthly");
  await page.click("dialog button.primary");
  await waitText("Rappel réel 0.4");
  await click("Reporter d’une heure");
  await waitText("Reporté");
  await click("Modifier");
  await page.click("dialog button.primary");
  await waitText("À venir");
  const [r] = (
    await db.query("SELECT * FROM reminders WHERE title='Rappel réel 0.4'")
  ).rows;
  await db.query(
    "UPDATE reminders SET remind_at=now()-interval '1 minute' WHERE id=$1",
    [r.id],
  );
  const { processReminders } =
    await import("../src/server/experience-worker.js");
  await processReminders();
  await page.waitForFunction(() =>
    document.body.innerText.includes("Rappel réel 0.4"),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM notifications WHERE title='Rappel réel 0.4'",
      )
    ).rows[0].n,
    "1",
  );
  await page.screenshot({
    path: ".impeccable/review/experience-reminders-desktop.png",
    fullPage: false,
  });
  await click("Terminer");
  await click("Terminés");
  await waitText("Rappel réel 0.4");
  await page.click(".profile-button");
  await click("Apparence");
  for (const theme of ["midnight", "forest", "ember"]) {
    await page.click(`input[name="theme"][value="${theme}"]`);
    await click("Enregistrer");
    await page.waitForFunction(
      (t) => document.documentElement.dataset.theme === t,
      {},
      theme,
    );
  }
  await click("Notifications");
  await page.waitForSelector(".push-settings");
  assert.equal(
    await page.$eval(
      ".push-settings button",
      (el) => (el as HTMLButtonElement).disabled,
    ),
    true,
  );
  await page.screenshot({
    path: ".impeccable/review/experience-push-desktop.png",
    fullPage: false,
  });
  await page.select('select[name="soundVolume"]', "low");
  await page.keyboard.press("Tab");
  await page.click(".topbar");
  await page.keyboard.down("Control");
  await page.keyboard.press("Digit3");
  await page.keyboard.up("Control");
  await page.waitForSelector(".calendar-grid");
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/experience-calendar-mobile.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.click('[aria-label="Ouvrir la navigation"]');
  await click("Rappels");
  await page.waitForSelector(".reminder-row");
  await page.screenshot({
    path: ".impeccable/review/experience-reminders-mobile.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewport({ width: 1440, height: 1000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const rows = await Promise.all(
      keys.map(async (key) =>
        (await (await caches.open(key)).keys()).map(
          (r) => new URL(r.url).pathname,
        ),
      ),
    );
    return rows.flat();
  });
  assert.ok(cached.includes("/"));
  assert.equal(
    cached.some(
      (path) => path.startsWith("/api/") || path.startsWith("/auth/"),
    ),
    false,
  );
  const workerTarget = browser
    .targets()
    .find(
      (t) => t.type() === "service_worker" && t.url() === `${origin}/sw.js`,
    );
  assert.ok(workerTarget);
  const workerNetwork = await workerTarget.createCDPSession();
  await workerNetwork.send("Network.enable");
  plannedOffline = true;
  try {
    await workerNetwork.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.setOfflineMode(true);
    const response = await page.evaluate(async () => {
      const r = await fetch("/api/v1/me");
      return { status: r.status, body: await r.json() };
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, "OFFLINE");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitText("hors ligne");
    await page.screenshot({
      path: ".impeccable/review/experience-offline.png",
      fullPage: false,
    });
  } finally {
    await workerNetwork.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await workerNetwork.detach();
    await page.setOfflineMode(false);
    await page.reload({ waitUntil: "domcontentloaded" });
    plannedOffline = false;
  }
  await page.waitForSelector(".sidebar");
  // Exercise an actual worker update and cache turnover without changing source files.
  const workerFile = "dist/client/sw.js";
  const originalWorker = await readFile(workerFile, "utf8");
  const replacement = originalWorker.replace(
    /const CACHE_NAME = "([^"]+)"/,
    'const CACHE_NAME = "$1-e2e"',
  );
  assert.notEqual(replacement, originalWorker);
  try {
    await writeFile(workerFile, replacement);
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await page.waitForSelector(".pwa-update");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      click("Mettre à jour Liora"),
    ]);
    await page.waitForSelector(".sidebar");
    await page.waitForFunction(async () => {
      const keys = (await caches.keys()).filter((k) => k.startsWith("liora-"));
      return keys.length === 1 && keys[0].endsWith("-e2e");
    });
    assert.equal(
      (await page.evaluate(() => caches.keys())).filter((k) =>
        k.startsWith("liora-"),
      ).length,
      1,
    );
  } finally {
    await writeFile(workerFile, originalWorker);
  }
  console.log(
    "EXPERIENCE PASS: calendar create/edit/recurrence, favorites opening, reminders/snooze/delivery, themes, keyboard, responsive UI, offline shell and service-worker update.",
  );
}
async function verifyUx() {
  await page.waitForFunction(() => !document.querySelector(".home-skeleton"));
  const workspaceId = (
    await db.query("SELECT id FROM workspaces WHERE name='LUMA'")
  ).rows[0].id;
  const currentUser = await page.evaluate(
    async () => (await (await fetch("/api/v1/me")).json()).data,
  );
  await page.evaluate(async (w) => {
    await fetch(`/api/v1/workspaces/${w}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Préparer le point d’équipe",
        remind_at: new Date(Date.now() + 3600000).toISOString(),
        timezone: "Europe/Paris",
        recurring: false,
        recurring_interval: null,
      }),
    });
  }, workspaceId);
  await page.evaluate(async (w) => {
    await fetch(`/api/v1/workspaces/${w}/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Point d’équipe LUMA",
        start_at: new Date(Date.now() + 7200000).toISOString(),
        end_at: new Date(Date.now() + 10800000).toISOString(),
        timezone: "Europe/Paris",
        all_day: false,
        recurrence: "none",
        reminder_minutes: null,
      }),
    });
  }, workspaceId);
  await db.query(
    "INSERT INTO notifications(workspace_id,user_id,type,title,body,channel_id) VALUES($1,$2,'mention','Une conversation vous attend','Revue du parcours de collaboration — données de test',(SELECT id FROM channels WHERE workspace_id=$1 AND name='general' LIMIT 1))",
    [workspaceId, currentUser.id],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".home-page");
  await waitText("Préparer le point d’équipe");
  await waitText("Point d’équipe LUMA");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: ".impeccable/review/ux-home-desktop.png",
    fullPage: true,
  });
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyK");
  await page.keyboard.up("Control");
  await page.waitForSelector(".quick-switch input");
  await page.type(".quick-switch input", "general");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".composer textarea");
  assert.equal(await page.$(".quick-switch"), null);
  await click("Boîte de réception");
  await page.waitForSelector(".notification.unread");
  await click("Tout marquer comme lu");
  await page.waitForFunction(
    () => !document.querySelector(".notification.unread"),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM notifications WHERE workspace_id=$1 AND user_id=$2 AND state='unread'",
        [workspaceId, currentUser.id],
      )
    ).rows[0].n,
    "0",
  );
  await click("Lues");
  await page.waitForSelector(".notification.read");
  await page.screenshot({
    path: ".impeccable/review/ux-inbox-desktop.png",
    fullPage: true,
  });
  await click("Ouvrir la conversation");
  await page.waitForSelector(".composer textarea");
  assert.equal(
    await page.$eval(".channel-heading h1", (el) => el.textContent),
    "general",
  );
  for (const [label, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewport({ width, height });
    for (const [route, selector] of [
      ["Accueil", ".home-page"],
      ["Conversations", ".composer textarea"],
      ["Projets", ".project-page"],
      ["Calendrier", ".calendar-page"],
      ["Pages de l'équipe", ".document"],
      ["Préférences", ".settings-panel"],
      ["Administration", ".admin-panel"],
      ["Supervision", ".monitoring-page"],
      ["Amis", ".friends-page"],
      ["Aide", ".help-article"],
      ["Boîte de réception", ".inbox-page"],
      ["Rappels", ".reminders-page"],
      ["Favoris", ".favorites-page"],
    ]) {
      if (label === "mobile") {
        await page.click('[aria-label="Ouvrir la navigation"]');
        await page.waitForFunction(
          () =>
            document.querySelector(".sidebar.open")?.getBoundingClientRect()
              .x === 0,
        );
      }
      await page.click(
        `.nav-group button[aria-label=${JSON.stringify(route)}]`,
      );
      await page.waitForSelector(selector);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${route} overflows at ${width}`,
      );
      // Wait for data/fonts before capturing the entire visible application viewport.
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `.impeccable/review/ux-${route.replaceAll(" ", "-").replaceAll("'", "")}-${label}.png`,
        fullPage: true,
      });
    }
    await click("Boîte de réception");
    await click("Lues");
    await page.screenshot({
      path: `.impeccable/review/ux-inbox-${label}.png`,
      fullPage: true,
    });
    await click("Accueil");
    if (label === "mobile") {
      await page.click(".mobile-dock button:last-child");
      await page.waitForSelector(".sidebar.open");
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.querySelector(".sidebar.open"),
      );
      await page.click('.mobile-dock [aria-current="page"]');
      await click("Conversations");
      await page.click(".channel-picker");
      await page.waitForSelector(".conversation-index.open");
      await page.click(".conversation-index .channel-group button");
      await page.waitForFunction(
        () => !document.querySelector(".conversation-index.open"),
      );
    }
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await click("Accueil");
  console.log(
    "UX PASS: persisted home/calendar/reminder data, command palette keyboard navigation, notification batch update, all main surfaces at 1440 and 390, mobile menu and channel picker.",
  );
}
async function verify050() {
  const observedSearchQueries: string[] = [];
  // This suite exercises HTTP search/error fixtures. PWA handling is qualified by verifyExperience.
  await page.setBypassServiceWorker(true);
  // Avoid automated tile traffic against the public OSM service. These tiles are synthetic QA fixtures.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/v1/places/search")
      observedSearchQueries.push(
        new URL(req.url()).searchParams.get("q") || "",
      );
    if (
      new URL(req.url()).pathname === "/api/v1/places/search" &&
      new URL(req.url()).searchParams.get("q") === "Panne050"
    )
      void req.respond({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "PLACE_SEARCH_UNAVAILABLE",
            message:
              "La recherche de lieux est momentanément indisponible. Réessayez ou placez le lieu sur la carte.",
          },
        }),
      });
    else if (req.url().startsWith("https://tile.openstreetmap.org/"))
      void req.respond({
        status: 200,
        contentType: "image/svg+xml",
        body: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dde4df"/><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#c7d1cb"/><text x="18" y="30" fill="#52645a" font-family="sans-serif" font-size="12">Fond simulé — test local</text></svg>',
        ),
      });
    else void req.continue();
  });
  const user = await page.evaluate(async () => {
    const r = await fetch("/api/v1/me");
    return (await r.json()).data;
  });
  const workspaceId = (
    await db.query("SELECT id FROM workspaces WHERE name='LUMA'")
  ).rows[0].id;
  async function request(path: string, method = "GET", body?: unknown) {
    return page.evaluate(
      async (p, m, b) => {
        const r = await fetch(p, {
          method: m,
          headers: b ? { "Content-Type": "application/json" } : {},
          body: b ? JSON.stringify(b) : undefined,
        });
        const data = await r.json();
        if (!r.ok) throw Error(JSON.stringify(data));
        return data;
      },
      path,
      method,
      body,
    );
  }
  const b = `/api/v1/workspaces/${workspaceId}`;
  const project = (await request(`${b}/projects`)).data[0],
    board = (await request(`${b}/boards`)).data[0];
  const column = (await request(`${b}/columns`)).data.find(
    (c: { board_id: string }) => c.board_id === board.id,
  );
  await request(`${b}/tasks`, "POST", {
    title: "Préparer la sortie Burger King",
    description: "Une tâche synthétique pour vérifier les filtres",
    column_id: column.id,
    priority: "urgent",
    due_at: new Date(Date.now() + 3600000).toISOString(),
  });
  await request(`${b}/calendar`, "POST", {
    title: "Déjeuner Burger King",
    start_at: new Date().toISOString(),
    timezone: "Europe/Paris",
    all_day: false,
    recurrence: "none",
  });
  await click("Conversations");
  await click("general");
  await page.waitForSelector(".composer textarea");
  await page.type(".composer textarea", "demain à 14h pendant 2 heures");
  await page.waitForSelector(".date-pill");
  await page.click(".date-pill");
  await page.waitForSelector('dialog input[name="start_at"]');
  assert.ok(
    (
      await page.$eval(
        'dialog input[name="start_at"]',
        (el) => (el as HTMLInputElement).value,
      )
    ).endsWith("T14:00"),
  );
  assert.ok(
    (
      await page.$eval(
        'dialog input[name="end_at"]',
        (el) => (el as HTMLInputElement).value,
      )
    ).endsWith("T16:00"),
  );
  await page.click('dialog [aria-label="Fermer"]');
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await page.click('[aria-label="Envoyer le message"]');
  await page.waitForSelector(".message-date-badge");
  await page.click(".message-date-badge");
  await page.waitForSelector('dialog input[name="start_at"]');
  assert.ok(
    (
      await page.$eval(
        'dialog input[name="start_at"]',
        (el) => (el as HTMLInputElement).value,
      )
    ).endsWith("T14:00"),
  );
  await page.screenshot({
    path: ".impeccable/review/050-dates-desktop.png",
    fullPage: true,
  });
  await page.click('dialog [aria-label="Fermer"]');
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  await click("Mes lieux");
  await page.waitForSelector(".places-map");
  await page.waitForSelector(".leaflet-control-attribution");
  assert.equal(placesProvider.calls.length, 0);
  await page.type("#place-discovery-query", "Burger King Rennes");
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(
    placesProvider.calls.length,
    0,
    "Typing alone must not call the provider",
  );
  await page.keyboard.press("Enter");
  await page.waitForSelector(".place-list-row");
  assert.equal(await page.$$eval(".place-list-row", (rows) => rows.length), 3);
  await page.screenshot({
    path: ".impeccable/review/050-search-desktop.png",
    fullPage: false,
  });
  await page.click(".place-list-row");
  assert.equal(await page.$("dialog[open]"), null);
  assert.equal(await page.$('input[name="latitude"]'), null);
  await page.click(".place-quick-actions button:first-child");
  await page.waitForSelector(
    '.place-quick-actions button:first-child[aria-pressed="true"]',
  );
  await page.click(".place-quick-actions button:last-child");
  await page.waitForSelector(
    '.place-quick-actions button:last-child[aria-pressed="true"]',
  );
  await click("Notes, date et partage");
  await page.click(".place-editor .place-extra summary");
  await page.select('select[name="visibility"]', "friends");
  await page.type('textarea[name="notes"]', "Notes privées de test");
  await page.click(".place-editor button.primary");
  await page.waitForFunction(() => !document.querySelector(".place-editor"));
  assert.equal((await request("/api/v1/places/mine")).data[0].state, "visited");
  await page.$eval(".content", (el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: ".impeccable/review/050-map-desktop.png",
    fullPage: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".place-list-row");
  await page.click(".place-list-row");
  await waitText("Notes privées de test");
  await page.click(".places-page .help-hint summary");
  await page.screenshot({
    path: ".impeccable/review/050-map-help-desktop.png",
    fullPage: true,
  });
  await page.click(".places-page .help-hint summary");
  // Manual addition keeps the map visible. No coordinate is typed and no modal opens.
  await click("Ajouter manuellement");
  assert.equal(await page.$("dialog[open]"), null);
  assert.equal(
    await page.$eval(
      'input[name="latitude"]',
      (el) => !!el.closest("details[open]"),
    ),
    false,
  );
  assert.equal(await page.$('input[name="visited_on"]'), null);
  await page.type('input[name="name"]', "Burger King · lieu manuel de test");
  await page.type('input[name="address"]', "Lieu synthétique — Rennes");
  const mapBox = await (await page.$(".places-map"))!.boundingBox();
  await page.mouse.click(
    mapBox!.x + mapBox!.width * 0.55,
    mapBox!.y + mapBox!.height * 0.5,
  );
  await page.waitForSelector(".place-position.ready");
  await page.$eval(".content", (el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: ".impeccable/review/050-add-desktop.png",
    fullPage: false,
  });
  await page.click(".place-editor button.primary");
  await page.waitForFunction(() => !document.querySelector(".place-editor"));
  assert.equal((await request("/api/v1/places/mine")).data.length, 2);
  // An unknown city and an explicitly simulated service outage have recovery actions.
  async function searchText(q: string) {
    if (await page.$('[aria-label="Effacer la recherche de lieux"]'))
      await page.click('[aria-label="Effacer la recherche de lieux"]');
    await page.type("#place-discovery-query", q);
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/places/search" &&
        new URL(r.url()).searchParams.get("q") === q,
    );
    await page.keyboard.press("Enter");
    try {
      await response;
    } catch (e) {
      throw Error(
        `Search ${q} received queries ${JSON.stringify(observedSearchQueries)}: ${e}`,
      );
    }
  }
  await searchText("MacDo Rennes");
  await waitText("McDonald's Rennes · test");
  await page.screenshot({
    path: ".impeccable/review/050-free-search-desktop.png",
    fullPage: false,
  });
  await page.click(".place-list-row");
  await page.click(".place-quick-actions button:first-child");
  await page.waitForSelector(
    '.place-quick-actions button:first-child[aria-pressed="true"]',
  );
  assert.ok(
    (await request("/api/v1/places/mine")).data.some(
      (p: any) => p.category === "place" && p.name.includes("McDonald's"),
    ),
  );
  await searchText("Camping Rennes");
  await waitText("Camping des étoiles · test");
  await page.click(".place-list-row");
  await page.click(".place-quick-actions button:last-child");
  await page.waitForSelector(
    '.place-quick-actions button:last-child[aria-pressed="true"]',
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".place-list-row");
  assert.ok(
    (await request("/api/v1/places/mine")).data.some(
      (p: any) =>
        p.category === "place" &&
        p.name.includes("Camping") &&
        p.state === "visited",
    ),
  );
  await searchText("Introuvable050");
  await waitText("Aucun lieu trouvé");
  await page.screenshot({
    path: ".impeccable/review/050-search-empty-desktop.png",
    fullPage: false,
  });
  await searchText("Panne050");
  await page.waitForSelector(".place-search-error");
  await page.screenshot({
    path: ".impeccable/review/050-search-error-desktop.png",
    fullPage: false,
  });
  assert.ok(await page.$(".place-search-error button"));
  await page.setViewport({ width: 390, height: 844 });
  await searchText("Musée Rennes");
  await waitText("Musée de test");
  await page.waitForSelector(".place-list-row");
  await page.$eval(".places-page", (el) =>
    el.scrollIntoView({ block: "start" }),
  );
  await page.screenshot({
    path: ".impeccable/review/050-search-mobile.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.click(".place-list-row");
  await page.screenshot({
    path: ".impeccable/review/050-place-mobile.png",
    fullPage: false,
  });
  await browser
    .defaultBrowserContext()
    .overridePermissions(origin, ["geolocation"]);
  await page.setGeolocation({ latitude: 48.1173, longitude: -1.6778 });
  await click("autour de moi");
  await page.waitForSelector(".place-list-row");
  await click("Ajouter manuellement");
  await page.type('input[name="name"]', "Lieu libre · ajout mobile de test");
  assert.equal(await page.$('select[name="category"]'), null);
  await page.screenshot({
    path: ".impeccable/review/050-add-mobile.png",
    fullPage: false,
  });
  await click("Placer au centre de la carte");
  await page.waitForSelector(".place-position.ready");
  assert.equal(
    await page.$eval(
      'input[name="latitude"]',
      (el) => !!el.closest("details[open]"),
    ),
    false,
  );
  await page.click(".place-editor button.primary");
  await page.waitForFunction(() => !document.querySelector(".place-editor"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewport({ width: 1440, height: 1000 });
  // A friend with no membership and no active session can receive durable messages.
  const friend = (
    await db.query(
      "INSERT INTO users(kyros_user_id,name,status) VALUES('test-friend-050','Ami hors ligne','invisible') RETURNING id",
    )
  ).rows[0];
  await db.query("INSERT INTO friendships(user_a,user_b) VALUES($1,$2)", [
    ...[user.id, friend.id].sort(),
  ]);
  await click("Amis");
  await page.waitForSelector(`[aria-label="Écrire à Ami hors ligne"]`);
  await page.click('[aria-label="Écrire à Ami hors ligne"]');
  await page.waitForSelector("#friend-draft");
  await page.type("#friend-draft", "Ce message t’attend à ton retour.");
  await page.click(".friend-messenger form button");
  await page.waitForSelector(".friend-bubble.mine");
  assert.equal(
    (
      await db.query(
        "SELECT count(*) n FROM friend_messages WHERE recipient_id=$1",
        [friend.id],
      )
    ).rows[0].n,
    "1",
  );
  await page.screenshot({
    path: ".impeccable/review/050-friend-desktop.png",
    fullPage: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Écrire à Ami hors ligne"]');
  await page.click('[aria-label="Écrire à Ami hors ligne"]');
  await waitText("Ce message t’attend à ton retour.");
  await click("Projets");
  await page.waitForSelector(".task-filters");
  await click("Liste");
  await page.select('[aria-label="Filtrer par priorité"]', "urgent");
  await waitText("Préparer la sortie Burger King");
  assert.ok(await page.$(".task-list-view"));
  await page.screenshot({
    path: ".impeccable/review/050-project-desktop.png",
    fullPage: true,
  });
  await click("Nouveau projet");
  await page.waitForSelector('dialog input[name="name"]');
  await page.type('dialog input[name="name"]', "Projet de sortie");
  await page.click("dialog button.primary");
  await page.waitForFunction(
    () =>
      document.querySelector(".project-context h2")?.textContent ===
      "Projet de sortie",
  );
  await page.click(".board-toolbar button");
  await page.waitForSelector('dialog input[name="name"]');
  await page.type('dialog input[name="name"]', "Repérage des lieux");
  await page.click("dialog button.primary");
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLSelectElement>('[aria-label="Board"]')
        ?.selectedOptions[0]?.textContent === "Repérage des lieux",
  );
  await page.click('.project-tabs button[aria-label="Liora"]');
  await page.waitForFunction(
    () =>
      document.querySelector(".project-context h2")?.textContent === "Liora",
  );
  await click("Calendrier");
  await page.waitForSelector(".calendar-page");
  await click("Agenda");
  await waitText("Déjeuner Burger King");
  assert.equal(await page.$(".calendar-grid"), null);
  await page.screenshot({
    path: ".impeccable/review/050-calendar-desktop.png",
    fullPage: true,
  });
  await click("Préférences");
  await click("Apparence");
  await page.waitForSelector(".theme-gallery");
  for (const theme of ["atelier", "orbit", "terminal", "dark"]) {
    await page.click(`input[name="theme"][value="${theme}"]`);
    await click("Enregistrer");
    await page.waitForFunction(
      (t) => document.documentElement.dataset.theme === t,
      {},
      theme,
    );
    assert.ok(
      (
        await page.$eval(
          '.theme-preview[data-theme="dark"] strong',
          (el) => getComputedStyle(el).fontFamily,
        )
      ).includes("Manrope"),
    );
    await page.screenshot({
      path: `.impeccable/review/050-theme-${theme}-desktop.png`,
      fullPage: true,
    });
    await click("Projets");
    await page.waitForSelector(".task-filters");
    await page.screenshot({
      path: `.impeccable/review/050-project-${theme}-desktop.png`,
      fullPage: true,
    });
    await click("Préférences");
    await click("Apparence");
  }
  for (const theme of ["atelier", "orbit", "terminal", "dark"]) {
    await page.click(`input[name="theme"][value="${theme}"]`);
    await click("Enregistrer");
    await page.waitForFunction(
      (t) => document.documentElement.dataset.theme === t,
      {},
      theme,
    );
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/050-theme-${theme}-mobile.png`,
      fullPage: true,
    });
    await page.setViewport({ width: 1440, height: 1000 });
  }
  await page.click(".settings-panel .help-hint summary");
  await page.screenshot({
    path: ".impeccable/review/050-preferences-desktop.png",
    fullPage: true,
  });
  await click("Administration");
  await page.waitForSelector(".admin-panel .help-hint");
  await click("Rôles et permissions");
  await page.click(".admin-panel .help-hint summary");
  await page.screenshot({
    path: ".impeccable/review/050-admin-desktop.png",
    fullPage: true,
  });
  await click("Aide");
  await page.type('[aria-label="Rechercher dans l’aide"]', "dates détectées");
  await waitText("Les expressions relatives restent attachées");
  await page.screenshot({
    path: ".impeccable/review/050-help-desktop.png",
    fullPage: true,
  });
  await page.setViewport({ width: 390, height: 844 });
  for (const [route, selector] of [
    ["Mes lieux", ".places-map"],
    ["Amis", ".friends-page"],
    ["Projets", ".task-filters"],
    ["Calendrier", ".calendar-page"],
    ["Préférences", ".settings-panel"],
    ["Administration", ".admin-panel"],
    ["Aide", ".help-article"],
  ]) {
    await page.click('[aria-label="Ouvrir la navigation"]');
    await page.waitForFunction(
      () =>
        document.querySelector(".sidebar.open")?.getBoundingClientRect().x ===
        0,
    );
    await page.click(`.nav-group button[aria-label=${JSON.stringify(route)}]`);
    await page.waitForSelector(selector);
    if (route === "Amis") {
      await page.waitForSelector('[aria-label="Écrire à Ami hors ligne"]');
      await page.click('[aria-label="Écrire à Ami hors ligne"]');
      await page.waitForSelector(".friend-bubble.mine");
    }
    if (route === "Préférences") {
      await click("Apparence");
      await page.waitForSelector(".theme-gallery");
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${route} overflows on mobile`,
    );
    await page.screenshot({
      path: `.impeccable/review/050-${route.replaceAll(" ", "-")}-mobile.png`,
      fullPage: true,
    });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  // The personal tools also work for a signed-in user without any workspace.
  await db.query("DELETE FROM workspace_members WHERE user_id=$1", [user.id]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".personal-nav");
  await page.click(".personal-nav button:nth-child(2)");
  await page.waitForSelector(".places-map");
  await page.waitForSelector(".place-list-row");
  await page.screenshot({
    path: ".impeccable/review/050-no-workspace-desktop.png",
    fullPage: true,
  });
  await page.click(".personal-nav button:nth-child(3)");
  await page.waitForSelector('[aria-label="Écrire à Ami hors ligne"]');
  await page.click('[aria-label="Écrire à Ami hors ligne"]');
  await waitText("Ce message t’attend à ton retour.");
  console.log(
    "0.5.0 PASS: personal map persistence, private notes, offline friend without common workspace, project list/filters, calendar agenda, structural themes, contextual help, desktop/mobile and personal tools without membership. OSM tiles mocked.",
  );
}

async function runBrowserChecks() {
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('a[href="/auth/login"]');
  await page.screenshot({
    path: ".impeccable/review/login.png",
    fullPage: false,
  });
  await page.click('a[href="/auth/login"]');
  await page.waitForSelector(".home-page");
  if (process.env.E2E_050_ONLY === "1") {
    await verify050();
    assertNoBrowserErrors();
    return;
  }
  if (process.env.E2E_UX_ONLY === "1") {
    await verifyUx();
    assertNoBrowserErrors();
    return;
  }
  await click("Conversations");
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
  if (process.env.E2E_EXPERIENCE_ONLY === "1") {
    await verifyExperience();
    assertNoBrowserErrors();
    return;
  }
  if (process.env.E2E_MONITORING_ONLY === "1") {
    const workspaceId = (
      await db.query("SELECT id FROM workspaces WHERE name='LUMA'")
    ).rows[0].id;
    await click("Supervision");
    await page.waitForSelector(".heartbeat-help");
    await waitText("Jamais reçu");
    await page.click(".heartbeat-help summary");
    await waitText("Une clé API Argos ne convient pas.");
    for (const [label, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewport({ width, height });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (label === "mobile")
        await page.$eval(".monitor-target-heartbeat", (el) =>
          el.scrollIntoView({ block: "start" }),
        );
      await page.screenshot({
        path: `.impeccable/review/heartbeat-${label}.png`,
        fullPage: true,
      });
    }
    const receipt = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/workspaces/${id}/heartbeat`, {
        method: "POST",
      });
      return { status: response.status, body: await response.json() };
    }, workspaceId);
    assert.equal(receipt.status, 200);
    assert.ok(receipt.body.received_at);
    const { checkMonitoring } = await import("../src/server/workers.js");
    await checkMonitoring();
    await click("Actualiser");
    await waitText("Liora reçoit les signaux");
    await page.screenshot({
      path: ".impeccable/review/heartbeat-received-mobile.png",
      fullPage: true,
    });
    await db.query(
      "UPDATE monitoring_targets SET last_heartbeat=now()-interval '1 day' WHERE workspace_id=$1 AND kind='heartbeat'",
      [workspaceId],
    );
    await checkMonitoring();
    await click("Actualiser");
    await waitText("Le dernier signal a expiré.");
    await page.screenshot({
      path: ".impeccable/review/heartbeat-expired-mobile.png",
      fullPage: true,
    });
    assertNoBrowserErrors();
    console.log(
      "E2E MONITORING PASS: never received, authenticated receipt, recovery, expiration, 1440×1000 and 390×844.",
    );
    return;
  }
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
  await click("Conversations");
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
  await member.waitForSelector(".home-page");
  await member.click('.nav-group button[aria-label="Conversations"]');
  await member.waitForSelector(".composer textarea");
  assert.equal(
    await member.$$eval(".nav-group button", (buttons) =>
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
    [...document.querySelectorAll(".nav-group button")].some((b) =>
      b.textContent?.includes("Supervision"),
    ),
  );
  await member.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>(".nav-group button")]
      .find((b) => b.textContent?.includes("Supervision"))
      ?.click(),
  );
  await member.waitForSelector(".monitor-target");
  assert.equal(await updateRole(role.permissions), 200);
  await member.waitForFunction(
    () =>
      ![...document.querySelectorAll(".nav-group button")].some((b) =>
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
  await click("Conversations");
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
  await second.waitForSelector(".home-page");
  await second.click('.nav-group button[aria-label="Conversations"]');
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
  await click("Générer un lien");
  await page.waitForSelector('input[aria-label="Lien d\'invitation"]');
  const invitation = await page.$eval(
    'input[aria-label="Lien d\'invitation"]',
    (el) => (el as HTMLInputElement).value,
  );
  provider.setSubject("browser-member");
  const friendContext = await browser.createBrowserContext();
  const friendPage = await friendContext.newPage();
  await friendPage.goto(`${origin}/auth/login`);
  await friendPage.waitForSelector(".home-page");
  provider.setSubject("test-owner");
  await friendPage.goto(invitation);
  await friendPage.waitForSelector(".invitation-page");
  await friendPage.waitForSelector(".invitation-page button.primary");
  await friendPage.click(".invitation-page button.primary");
  await friendPage.waitForSelector(".home-page");
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
  await click("Conversations");
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
  await click("Conversations");
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
  await waitText("Jamais reçu");
  await page.click(".heartbeat-help summary");
  await waitText("Une clé API Argos ne convient pas.");
  await page.screenshot({
    path: ".impeccable/review/monitoring.png",
    fullPage: false,
  });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: ".impeccable/review/monitoring-mobile.png",
    fullPage: true,
  });
  await page.setViewport({ width: 1440, height: 1000 });
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
    await page.$$eval(".nav-group button", (els) =>
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
  await page.click('input[name="theme"][value="dusk"]');
  await click("Enregistrer");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dusk",
  );
  await page.screenshot({
    path: ".impeccable/review/dusk.png",
    fullPage: false,
  });
  await page.click('input[name="theme"][value="light"]');
  await click("Enregistrer");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({
    path: ".impeccable/review/light.png",
    fullPage: false,
  });
  await page.click('input[name="theme"][value="dark"]');
  await click("Enregistrer");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await click("Conversations");
  await click("general");
  await page.waitForSelector(".composer textarea");
  plannedRestart = true;
  await stop();
  start();
  await ready();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".composer textarea");
  await click("Conversations");
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
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sidebar");
  await verifyExperience();
  assertNoBrowserErrors();
  console.log(
    "E2E PASS: Kyros, refresh of monitoring grants, member/role race, workspace menus, threads, pins, search, private channel access, DMs, messages, kanban, pages, themes, persistence, 1440×1000 and 390×844.",
  );
}
try {
  await runBrowserChecks();
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
  await placesProvider.close();
}
