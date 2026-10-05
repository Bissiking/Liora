// tests/fixtures/braindump.ts
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
export async function fixtureBrainDump(port: number, callback: string) {
  const require = createRequire(
    new URL("../../../BrainDump/package.json", import.meta.url),
  );
  const Fastify = require("fastify"),
    Database = require("better-sqlite3");
  const database = new Database(":memory:");
  database.pragma("foreign_keys=ON");
  database.exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
    CREATE TABLE dumps(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,title TEXT,content TEXT NOT NULL DEFAULT '',type TEXT NOT NULL DEFAULT 'note',due_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archived_at TEXT);`);
  const app = Fastify({ logger: false }),
    origin = `http://127.0.0.1:${port}`;
  let subject = "test-owner",
    fail = false;
  app.addHook("onRequest", async (req: any, reply: any) => {
    if (fail && req.url === "/api/integrations/notes")
      return reply.code(503).send({ error: "Panne de test" });
  });
  await app.register(require("@fastify/cookie"));
  await app.register(require("@fastify/session"), {
    secret: randomBytes(48).toString("base64url"),
    cookieName: "braindump.fixture",
    saveUninitialized: false,
    cookie: { secure: false, sameSite: "lax", path: "/" },
  });
  await app.register(require("@fastify/static"), {
    root: fileURLToPath(new URL("../../../BrainDump/public", import.meta.url)),
    index: false,
  });
  const { registerIntegrationRoutes } = await import(
    new URL("../../../BrainDump/src/integrations/routes.js", import.meta.url)
      .href
  );
  const auth = {
    config: { issuer: process.env.KYROS_BASE_URL, appBaseUrl: origin },
    refreshSessionIfNeeded: async (req: any) => {
      req.session.user = {
        id: subject,
        displayName:
          subject === "test-owner"
            ? "Camille · démonstration"
            : "Compte de démonstration",
        username: subject,
      };
      return true;
    },
  };
  await registerIntegrationRoutes(app, auth, database, {
    allowLocalRedirects: true,
  });
  await app.listen({ port, host: "127.0.0.1" });
  const clientResponse = await fetch(origin + "/api/integrations/clients", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Liora · démonstration",
      redirect_uri: callback,
    }),
  });
  if (clientResponse.status !== 201)
    throw Error("Fixture BrainDump: création refusée");
  const client = (await clientResponse.json()) as {
    client_id: string;
    api_key: string;
  };
  function note(owner: string, input: Record<string, any> = {}) {
    const now = new Date().toISOString();
    return Number(
      database
        .prepare(
          "INSERT INTO dumps(user_id,title,content,type,due_at,created_at,updated_at,archived_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          owner,
          input.title ?? "Préparer Liora · démonstration",
          input.content ?? "Une **note** avec rendez-vous.",
          input.type ?? "note",
          input.dueAt === undefined
            ? new Date(Date.now() + 86400000).toISOString()
            : input.dueAt,
          now,
          now,
          input.archivedAt ?? null,
        ).lastInsertRowid,
    );
  }
  return {
    app,
    origin,
    client,
    database,
    note,
    setSubject: (value: string) => {
      subject = value;
    },
    fail: (value: boolean) => {
      fail = value;
    },
    close: async () => {
      await app.close();
      database.close();
    },
  };
}
