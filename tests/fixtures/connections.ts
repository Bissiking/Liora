// tests/fixtures/connections.ts
import express from "express";
import { verifyKyrosToken } from "../../src/server/kyros.js";
export async function fixtureConnections(port: number) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  let failBrain = false;
  const notes: Record<string, any>[] = [];
  app.get("/api/braindump/dumps", async (req, res) => {
    try {
      if (failBrain) return res.status(503).end();
      const claims = await verifyKyrosToken(
        req.headers.authorization?.slice(7) || "",
      );
      res.json(notes.filter((n) => n.userId === claims.sub));
    } catch {
      res.status(401).end();
    }
  });
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  return {
    notes,
    failBrain: (value: boolean) => {
      failBrain = value;
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
