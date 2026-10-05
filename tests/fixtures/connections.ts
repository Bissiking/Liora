// tests/fixtures/connections.ts
import express from "express";
import { createHash, randomUUID } from "node:crypto";
import { verifyKyrosToken } from "../../src/server/kyros.js";
export async function fixtureConnections(port: number) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  let failBrain = false,
    revision = 0;
  const notes: Record<string, any>[] = [];
  const events = new Map<string, Record<string, any>>();
  const codes = new Map<string, { challenge: string; redirect: string }>();
  const decorate = (e: Record<string, any>): Record<string, any> => ({
    ...e,
    etag: '"fixture-' + ++revision + '"',
    updated: new Date().toISOString(),
  });
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
  app.get("/authorize", (req, res) => {
    const code = randomUUID();
    codes.set(code, {
      challenge: String(req.query.code_challenge),
      redirect: String(req.query.redirect_uri),
    });
    const url = new URL(String(req.query.redirect_uri));
    url.search = new URLSearchParams({
      code,
      state: String(req.query.state),
    }).toString();
    res.redirect(url.toString());
  });
  app.post("/token", (req, res) => {
    if (req.body.grant_type === "authorization_code") {
      const c = codes.get(req.body.code);
      codes.delete(req.body.code);
      if (
        !c ||
        c.redirect !== req.body.redirect_uri ||
        c.challenge !==
          createHash("sha256")
            .update(req.body.code_verifier)
            .digest("base64url")
      )
        return res.status(400).json({ error: "invalid_grant" });
    }
    res.json({
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      scope:
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    });
  });
  app.post("/revoke", (_req, res) => res.json({}));
  app.get("/calendar/v3/users/me/calendarList", (_req, res) =>
    res.json({
      items: [
        {
          id: "primary-fixture",
          summary: "Agenda de démonstration",
          primary: true,
          accessRole: "owner",
        },
      ],
    }),
  );
  app.get("/calendar/v3/calendars/:calendar/events", (_req, res) =>
    res.json({ items: [...events.values()] }),
  );
  app.post("/calendar/v3/calendars/:calendar/events", (req, res) => {
    if (events.has(req.body.id)) return res.status(409).end();
    const row = decorate({ ...req.body, status: "confirmed" });
    events.set(row.id, row);
    res.status(201).json(row);
  });
  app.get("/calendar/v3/calendars/:calendar/events/:id", (req, res) => {
    const e = events.get(req.params.id);
    if (!e) return res.status(404).end();
    res.json(e);
  });
  app.patch("/calendar/v3/calendars/:calendar/events/:id", (req, res) => {
    const old = events.get(req.params.id);
    if (!old) return res.status(404).end();
    if (req.headers["if-match"] !== old.etag) return res.status(412).end();
    const row = decorate({ ...old, ...req.body });
    events.set(row.id, row);
    res.json(row);
  });
  app.delete("/calendar/v3/calendars/:calendar/events/:id", (req, res) => {
    const old = events.get(req.params.id);
    if (!old) return res.status(404).end();
    if (req.headers["if-match"] !== old.etag) return res.status(412).end();
    events.set(old.id, decorate({ ...old, status: "cancelled" }));
    res.status(204).end();
  });
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  return {
    notes,
    events,
    failBrain: (value: boolean) => {
      failBrain = value;
    },
    changeGoogle: (id: string, patch: Record<string, any>) => {
      const row = decorate({ ...events.get(id), ...patch });
      events.set(id, row);
      return row;
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
