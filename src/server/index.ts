// src/server/index.ts
import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import express from "express";
import { createApp, errorHandler, VERSION } from "./app.js";
import { startWorkers } from "./workers.js";
import { pool } from "./db.js";
import { seal } from "./crypto.js";
await seal("configuration-check");

const clientDist = path.resolve(process.env.CLIENT_DIST || "dist/client");
let scriptHashes: string[] = [];
if (process.env.NODE_ENV === "production") {
  try {
    const html = await readFile(path.join(clientDist, "index.html"), "utf8");
    scriptHashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1])
      .filter((script) => script.trim().length > 0)
      .map(
        (script) =>
          `'sha256-${createHash("sha256").update(script).digest("base64")}'`,
      );
  } catch {
    scriptHashes = [];
  }
}

const app = createApp({ scriptHashes });
if (process.env.NODE_ENV === "production") {
  app.use(
    express.static(clientDist),
  );
  app.get("/{*path}", (_req, res) =>
    res.sendFile(
      path.join(clientDist, "index.html"),
    ),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use(errorHandler);
const server = app.listen(
  Number(process.env.PORT || 4310),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "liora",
        message: "Liora started",
        version: VERSION,
        port: Number(process.env.PORT || 4310),
      }),
    ),
);
const stopWorkers = startWorkers();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopWorkers();
    server.close(() => void pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 8000).unref();
  });
