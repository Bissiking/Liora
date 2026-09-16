// tests/fixtures/dropit.ts
import express from "express";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
// Uses the actual external module router, with authentication supplied only by this isolated fixture.
export async function fixtureDropIt(port: number, callback: string) {
  const source = new URL("../../../DropIt/src/integrations.js", import.meta.url)
    .href;
  const { createIntegrationRouter } = await import(source);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "liora-dropit-"));
  const app = express(),
    origin = `http://127.0.0.1:${port}`;
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  let subject = "test-owner";
  const own = randomUUID();
  const shares = [
    {
      id: own,
      slug: "synthetic-only",
      owner: { sub: "test-owner" },
      expiresAt: Date.now() + 86400000,
      files: [
        {
          id: randomUUID(),
          name: "Guide de démonstration.pdf",
          size: 32000,
          mime: "application/pdf",
        },
      ],
    },
    {
      id: randomUUID(),
      slug: "private-other",
      owner: { sub: "someone-else" },
      expiresAt: Date.now() + 86400000,
      files: [
        { id: randomUUID(), name: "Fichier privé étranger.pdf", size: 100 },
      ],
    },
  ];
  const module = createIntegrationRouter({
    dataDir,
    identityIssuer: process.env.KYROS_ISSUER || process.env.KYROS_BASE_URL,
    baseUrl: origin,
    shares: () => shares,
    requireUser: (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      (req as any).user = { sub: subject, name: "Camille Martin" };
      (req as any).sid = "fixture-only";
      next();
    },
  });
  app.use(module.router);
  app.use(
    express.static(
      fileURLToPath(new URL("../../../DropIt/public", import.meta.url)),
    ),
  );
  app.get("/integrations", (_req, res) =>
    res.sendFile(
      fileURLToPath(
        new URL("../../../DropIt/public/integrations.html", import.meta.url),
      ),
    ),
  );
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.status(err.status || 500).json({ error: err.message }),
  );
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const c = await fetch(origin + "/api/integrations/clients", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ name: "Liora de test", redirect_uri: callback }),
  });
  const client = await c.json();
  return {
    origin,
    client,
    own,
    setSubject: (value: string) => (subject = value),
    close: async () => {
      await new Promise<void>((r) => server.close(() => r()));
      module.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}
