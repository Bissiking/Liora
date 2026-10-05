// src/server/google-calendar.ts
import { Router } from "express";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { query, transaction, type DB } from "./db.js";
import { token, hash, seal, unseal } from "./crypto.js";
import { assert, HttpError } from "./errors.js";
import { authorize } from "./auth.js";
import { humanWorkspace } from "./experience-access.js";
import {
  calendarSchema,
  calendarReminderAt,
  validateDates,
} from "./calendar.js";
import { calendarRule, parseCalendarRule } from "../shared/calendar-rule.js";
import { dateKey, dayBoundary, validTimezone } from "../shared/schedule.js";
import { emit } from "./events.js";
const scopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
const redirect = () =>
  new URL("/api/v1/google-calendar/callback", process.env.APP_URL).toString();
function endpoints() {
  const fixture =
    process.env.NODE_ENV !== "production" &&
    process.env.GOOGLE_CALENDAR_TEST_ORIGIN;
  if (fixture) {
    const u = new URL(fixture);
    assert(
      u.protocol === "http:" && u.hostname === "127.0.0.1",
      500,
      "INVALID_FIXTURE",
      "Fixture Google invalide.",
    );
    return {
      authorize: fixture + "/authorize",
      token: fixture + "/token",
      revoke: fixture + "/revoke",
      api: fixture + "/calendar/v3",
    };
  }
  return {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    revoke: "https://oauth2.googleapis.com/revoke",
    api: "https://www.googleapis.com/calendar/v3",
  };
}
const configured = () =>
  Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};
async function http(url: string, options: RequestInit = {}) {
  const r = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text();
  assert(
    Buffer.byteLength(text) <= 4_000_000,
    502,
    "GOOGLE_LIMIT",
    "Réponse Google trop volumineuse.",
  );
  if (!r.ok)
    throw new HttpError(
      r.status === 412 ? 409 : 502,
      "GOOGLE_" + r.status,
      r.status === 412
        ? "Google a modifié l’événement pendant la synchronisation."
        : "Google Agenda a refusé la requête ; reconnectez le compte ou réessayez.",
    );
  return text ? JSON.parse(text) : {};
}
async function googleTokens(c: Record<string, any>, db: DB) {
  let t = await unseal<Tokens>(c.tokens);
  if (t.expires_at < Date.now() + 120000) {
    const r = await http(endpoints().token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: t.refresh_token,
      }),
    });
    assert(
      typeof r.access_token === "string" && Number.isFinite(r.expires_in),
      502,
      "GOOGLE_TOKEN",
      "Réponse Google invalide.",
    );
    t = {
      ...t,
      access_token: r.access_token,
      expires_at: Date.now() + r.expires_in * 1000,
    };
    await query(
      "UPDATE google_calendar_connections SET tokens=$2 WHERE user_id=$1",
      [c.user_id, await seal(t)],
      db,
    );
  }
  return t;
}
const api = (
  t: Tokens,
  path: string,
  method = "GET",
  body?: unknown,
  match?: string,
) =>
  http(endpoints().api + path, {
    method,
    headers: {
      authorization: "Bearer " + t.access_token,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(match ? { "if-match": match } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
const frequency: Record<string, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};
function values(row: Record<string, any>) {
  return calendarSchema.parse({
    title: row.title,
    description: row.description,
    start_at: new Date(row.start_at).toISOString(),
    end_at: row.end ? new Date(row.end).toISOString() : null,
    timezone: row.timezone,
    all_day: row.all_day,
    recurrence: row.recurrence,
    channel_id: row.channel_id,
    color: row.color,
    reminder_minutes: row.reminder_minutes,
  });
}
const signature = (row: Record<string, any>) =>
  hash(JSON.stringify(values(row)));
export function googleEvent(row: Record<string, any>, user: string) {
  const b = values(row),
    startDate = dateKey(b.start_at, b.timezone);
  const start = b.all_day
    ? { date: startDate }
    : { dateTime: b.start_at, timeZone: b.timezone };
  const end = b.all_day
    ? {
        date: b.end_at
          ? dateKey(b.end_at, b.timezone)
          : Temporal.PlainDate.from(startDate).add({ days: 1 }).toString(),
      }
    : {
        dateTime:
          b.end_at || new Date(Date.parse(b.start_at) + 3600000).toISOString(),
        timeZone: b.timezone,
      };
  return {
    summary: b.title,
    description: b.description,
    start,
    end,
    recurrence: calendarRule(b.start_at, b.timezone, b.recurrence)
      ? ["RRULE:" + calendarRule(b.start_at, b.timezone, b.recurrence)]
      : [],
    reminders: {
      useDefault: false,
      overrides:
        b.reminder_minutes === null
          ? []
          : [{ method: "popup", minutes: b.reminder_minutes }],
    },
    extendedProperties: {
      private: {
        liora_user_id: user,
        liora_event_id: row.id,
        liora_workspace_id: row.workspace_id,
        liora_no_end: String(b.end_at === null),
      },
    },
  };
}
export function fromGoogle(
  event: Record<string, any>,
  old: Record<string, any>,
) {
  assert(
    !event.attendees?.length,
    409,
    "UNSUPPORTED_GOOGLE",
    "Les invitations ajoutées dans Google ne peuvent pas être modifiées depuis Liora.",
  );
  assert(
    !event.recurringEventId &&
      (!event.eventType || event.eventType === "default"),
    409,
    "UNSUPPORTED_GOOGLE",
    "Les exceptions de série et événements spéciaux doivent être traités dans Google.",
  );
  const timezone = event.start?.timeZone || old.timezone || "UTC";
  assert(
    validTimezone(timezone),
    409,
    "UNSUPPORTED_GOOGLE",
    "Fuseau Google non pris en charge.",
  );
  let recurrence = "none";
  const all_day = Boolean(event.start?.date);
  const start_at = all_day
    ? dayBoundary(z.iso.date().parse(event.start.date), timezone)
    : z.iso.datetime({ offset: true }).parse(event.start?.dateTime);
  let end_at = all_day
    ? dayBoundary(z.iso.date().parse(event.end?.date), timezone)
    : z.iso.datetime({ offset: true }).parse(event.end?.dateTime);
  if (
    event.extendedProperties?.private?.liora_no_end === "true" &&
    !all_day &&
    Date.parse(end_at) - Date.parse(start_at) === 3600000
  )
    end_at = null as any;
  if (event.recurrence?.length) {
    const parsed =
      event.recurrence.length === 1
        ? parseCalendarRule(event.recurrence[0], start_at, timezone)
        : null;
    assert(
      parsed,
      409,
      "UNSUPPORTED_GOOGLE",
      "La répétition Google comporte une limite ou des exceptions non prises en charge.",
    );
    recurrence = parsed;
  }
  const reminders = event.reminders?.overrides || [];
  assert(
    reminders.length <= 1 &&
      (!reminders.length || reminders[0].method === "popup"),
    409,
    "UNSUPPORTED_GOOGLE",
    "Utilisez un seul rappel visuel.",
  );
  const b = calendarSchema.parse({
    ...values(old),
    title: event.summary || "Sans titre",
    description: event.description || "",
    start_at: new Date(start_at).toISOString(),
    end_at: end_at ? new Date(end_at).toISOString() : null,
    timezone,
    all_day,
    recurrence,
    reminder_minutes: reminders.length ? reminders[0].minutes : null,
  });
  validateDates(b);
  return b;
}
export const googleCalendarRouter = Router();
googleCalendarRouter.use("/google-calendar", (req, _res, next) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  next();
});
googleCalendarRouter.get("/google-calendar", async (req, res) => {
  const [c] = await query(
    "SELECT workspace_id,calendar_id,calendar_name,enabled,last_synced_at,last_error FROM google_calendar_connections WHERE user_id=$1",
    [req.actor.id],
  );
  const issues = c
    ? await query(
        "SELECT google_id,event_id,original_id,local_snapshot,remote_snapshot,issue FROM google_calendar_links WHERE user_id=$1 AND issue IS NOT NULL ORDER BY google_id LIMIT 100",
        [req.actor.id],
      )
    : [];
  res.json({
    configured: configured(),
    connected: Boolean(c),
    data: c || null,
    issues,
  });
});
googleCalendarRouter.post("/google-calendar/connect", async (req, res) => {
  assert(
    configured(),
    409,
    "GOOGLE_NOT_CONFIGURED",
    "Le client Google Agenda doit être configuré par l’opérateur.",
  );
  const state = token(),
    verifier = token() + token();
  await query("DELETE FROM google_calendar_attempts WHERE expires_at<now()");
  await query(
    "INSERT INTO google_calendar_attempts(id,user_id,session_id,verifier) VALUES($1,$2,$3,$4)",
    [hash(state), req.actor.id, req.actor.sessionId, await seal(verifier)],
  );
  const url = new URL(endpoints().authorize);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: redirect(),
    response_type: "code",
    scope: scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
    code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
    code_challenge_method: "S256",
  }).toString();
  res.json({ url: url.toString() });
});
googleCalendarRouter.get("/google-calendar/callback", async (req, res) => {
  const state = z.string().min(32).max(100).parse(req.query.state);
  const [attempt] = await query(
    "DELETE FROM google_calendar_attempts WHERE id=$1 AND user_id=$2 AND session_id=$3 AND expires_at>now() RETURNING *",
    [hash(state), req.actor.id, req.actor.sessionId],
  );
  assert(
    attempt,
    400,
    "INVALID_STATE",
    "Autorisation Google expirée ou déjà utilisée.",
  );
  if (req.query.error) {
    res.redirect("/#google-calendar=denied");
    return;
  }
  const code = z.string().min(1).max(4000).parse(req.query.code);
  const t = await http(endpoints().token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: redirect(),
      grant_type: "authorization_code",
      code,
      code_verifier: await unseal<string>(attempt.verifier),
    }),
  });
  assert(
    typeof t.access_token === "string" &&
      typeof t.refresh_token === "string" &&
      Number.isFinite(t.expires_in) &&
      scopes.every((s) => String(t.scope).split(" ").includes(s)),
    400,
    "GOOGLE_SCOPES",
    "Autorisez la lecture des agendas et la gestion des événements.",
  );
  await query(
    "INSERT INTO google_calendar_connections(user_id,tokens) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET tokens=EXCLUDED.tokens,last_error=NULL",
    [
      req.actor.id,
      await seal({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: Date.now() + t.expires_in * 1000,
      }),
    ],
  );
  res.redirect("/#google-calendar=connected");
});
async function calendars(t: Tokens) {
  const result: Record<string, any>[] = [];
  let cursor = "";
  for (let n = 0; n < 10; n++) {
    const r = await api(
      t,
      "/users/me/calendarList?minAccessRole=writer&maxResults=250" +
        (cursor ? "&pageToken=" + encodeURIComponent(cursor) : ""),
    );
    assert(
      Array.isArray(r.items),
      502,
      "GOOGLE_RESPONSE",
      "Liste Google invalide.",
    );
    result.push(
      ...r.items.filter((c: any) => ["owner", "writer"].includes(c.accessRole)),
    );
    cursor = r.nextPageToken || "";
    if (!cursor) return result;
  }
  throw new HttpError(409, "GOOGLE_LIMIT", "Trop d’agendas Google.");
}
googleCalendarRouter.get("/google-calendar/calendars", async (req, res) => {
  const data = await transaction(async (db) => {
    const [c] = await query(
      "SELECT * FROM google_calendar_connections WHERE user_id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    assert(c, 409, "GOOGLE_NOT_CONNECTED", "Connectez Google Agenda.");
    return (await calendars(await googleTokens(c, db))).map((c) => ({
      id: c.id,
      name: c.summary,
      primary: Boolean(c.primary),
    }));
  });
  res.json({ data });
});
googleCalendarRouter.put("/google-calendar", async (req, res) => {
  const b = z
    .object({
      workspace_id: z.uuid(),
      calendar_id: z.string().min(1).max(1000),
      enabled: z.boolean(),
    })
    .strict()
    .parse(req.body);
  await humanWorkspace(req.actor, b.workspace_id);
  await authorize(req.actor, b.workspace_id, "CREATE_CALENDAR_EVENT");
  await transaction(async (db) => {
    const [c] = await query(
      "SELECT * FROM google_calendar_connections WHERE user_id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    assert(c, 409, "GOOGLE_NOT_CONNECTED", "Connectez Google Agenda.");
    assert(
      !c.calendar_id ||
        (c.calendar_id === b.calendar_id && c.workspace_id === b.workspace_id),
      409,
      "GOOGLE_ALREADY_LINKED",
      "Déconnectez ce lien avant de choisir un autre agenda ; les événements déjà exportés seront conservés.",
    );
    const cal = (await calendars(await googleTokens(c, db))).find(
      (c) => c.id === b.calendar_id,
    );
    assert(cal, 403, "GOOGLE_READ_ONLY", "Choisissez un agenda modifiable.");
    await query(
      "UPDATE google_calendar_connections SET workspace_id=$2,calendar_id=$3,calendar_name=$4,enabled=$5,last_error=NULL WHERE user_id=$1",
      [req.actor.id, b.workspace_id, b.calendar_id, cal.summary, b.enabled],
      db,
    );
  });
  res.json({ ok: true });
});
googleCalendarRouter.post("/google-calendar/sync", async (req, res) => {
  res.json(await syncGoogleCalendar(req.actor.id));
});
googleCalendarRouter.post("/google-calendar/resolve", async (req, res) => {
  const b = z
    .object({
      google_id: z.string().min(1).max(1024),
      version: z.enum(["liora", "google"]),
    })
    .strict()
    .parse(req.body);
  await query(
    "UPDATE google_calendar_links SET resolution=$3 WHERE user_id=$1 AND google_id=$2 AND issue IS NOT NULL",
    [req.actor.id, b.google_id, b.version],
  );
  res.json(await syncGoogleCalendar(req.actor.id));
});
googleCalendarRouter.delete("/google-calendar", async (req, res) => {
  const [c] = await query(
    "DELETE FROM google_calendar_connections WHERE user_id=$1 RETURNING tokens",
    [req.actor.id],
  );
  await query("DELETE FROM google_calendar_attempts WHERE user_id=$1", [
    req.actor.id,
  ]);
  if (c)
    try {
      const t = await unseal<Tokens>(c.tokens);
      await http(endpoints().revoke, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: t.refresh_token }),
      });
    } catch {
      /* local revocation is unconditional */
    }
  res.json({ ok: true });
});
export async function syncGoogleCalendar(user: string) {
  return transaction(async (db) => {
    const [lock] = await query(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) locked",
      ["google-calendar:" + user],
      db,
    );
    assert(
      lock.locked,
      409,
      "GOOGLE_BUSY",
      "Une synchronisation est déjà en cours.",
    );
    const [c] = await query(
      "SELECT c.* FROM google_calendar_connections c JOIN users u ON u.id=c.user_id WHERE c.user_id=$1 AND NOT u.disabled FOR UPDATE OF c",
      [user],
      db,
    );
    assert(
      c?.enabled && c.calendar_id && c.workspace_id,
      409,
      "GOOGLE_DISABLED",
      "Choisissez et activez votre agenda.",
    );
    const actor = { id: user, kind: "human" as const };
    let count = 0;
    try {
      await humanWorkspace(actor, c.workspace_id);
      await authorize(actor, c.workspace_id, "CREATE_CALENDAR_EVENT");
      const t = await googleTokens(c, db),
        base = "/calendars/" + encodeURIComponent(c.calendar_id) + "/events";
      // Only the author's events outside private salons are exported. Unrelated Google events never enter the team workspace.
      const local = await query(
        `SELECT e.* FROM calendar_events e WHERE e.workspace_id=$1 AND e.user_id=$2 AND (e.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels ch WHERE ch.id=e.channel_id AND ch.workspace_id=e.workspace_id AND NOT ch.is_private AND NOT ch.is_dm AND NOT ch.archived)) ORDER BY e.id LIMIT 501 FOR UPDATE OF e`,
        [c.workspace_id, user],
        db,
      );
      const links = await query(
        "SELECT * FROM google_calendar_links WHERE user_id=$1 ORDER BY google_id",
        [user],
        db,
      );
      assert(
        local.length <= 500 && links.length <= 1000,
        409,
        "GOOGLE_LIMIT",
        "La synchronisation est limitée à 500 événements actifs et 1000 liens.",
      );
      const remote: Record<string, any>[] = [];
      let cursor = "";
      for (let n = 0; n < 10; n++) {
        const r = await api(
          t,
          base +
            "?showDeleted=true&maxResults=2500&privateExtendedProperty=" +
            encodeURIComponent("liora_user_id=" + user) +
            (cursor ? "&pageToken=" + encodeURIComponent(cursor) : ""),
        );
        assert(
          Array.isArray(r.items),
          502,
          "GOOGLE_RESPONSE",
          "Réponse Google invalide.",
        );
        remote.push(...r.items);
        cursor = r.nextPageToken || "";
        if (!cursor) break;
      }
      assert(!cursor, 409, "GOOGLE_LIMIT", "Trop de résultats Google.");
      const save = async (
        row: Record<string, any> | null,
        r: Record<string, any>,
        old?: Record<string, any>,
      ) => {
        assert(
          typeof r.id === "string" && typeof r.etag === "string",
          502,
          "GOOGLE_RESPONSE",
          "Identifiant Google invalide.",
        );
        await query(
          `INSERT INTO google_calendar_links(user_id,event_id,original_id,google_id,local_hash,remote_etag,local_snapshot,remote_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,google_id) DO UPDATE SET event_id=EXCLUDED.event_id,local_hash=EXCLUDED.local_hash,remote_etag=EXCLUDED.remote_etag,local_snapshot=EXCLUDED.local_snapshot,remote_snapshot=EXCLUDED.remote_snapshot,issue=NULL,resolution=NULL`,
          [
            user,
            row?.id || null,
            row?.id || old!.original_id,
            r.id,
            row ? signature(row) : "deleted",
            r.etag,
            JSON.stringify(row ? values(row) : old!.local_snapshot),
            JSON.stringify(r),
          ],
          db,
        );
      };
      for (const link of links) {
        const row = local.find((e) => e.id === link.event_id);
        // A moved/private/archived event is not a deletion: pause its link without touching Google.
        if (link.event_id && !row) {
          await query(
            "UPDATE google_calendar_links SET issue='Événement hors du périmètre autorisé ; aucune modification envoyée.' WHERE user_id=$1 AND google_id=$2",
            [user, link.google_id],
            db,
          );
          continue;
        }
        let r = remote.find((r) => r.id === link.google_id);
        if (!r)
          try {
            r = await api(t, base + "/" + encodeURIComponent(link.google_id));
          } catch (e) {
            if (
              e instanceof HttpError &&
              ["GOOGLE_404", "GOOGLE_410"].includes(e.code)
            )
              r = { id: link.google_id, status: "cancelled", etag: "deleted" };
            else throw e;
          }
        try {
          const deleted = r!.status === "cancelled",
            localChanged =
              (row ? signature(row) : "deleted") !== link.local_hash,
            remoteChanged = r!.etag !== link.remote_etag;
          if (!localChanged && !remoteChanged && !link.resolution) continue;
          if (localChanged && remoteChanged && !link.resolution)
            throw new HttpError(
              409,
              "CONFLICT",
              "Modifié dans Liora et Google. Choisissez la version à conserver.",
            );
          const useLocal =
            link.resolution === "liora" || (!link.resolution && localChanged);
          if (useLocal) {
            if (!row) {
              if (!deleted)
                await api(
                  t,
                  base + "/" + encodeURIComponent(link.google_id),
                  "DELETE",
                  undefined,
                  r!.etag,
                );
              await save(
                null,
                { ...r, status: "cancelled", etag: "deleted" },
                link,
              );
              count++;
              continue;
            }
            if (deleted) {
              const replacement =
                "liora" +
                user.replaceAll("-", "") +
                row.id.replaceAll("-", "") +
                "r" +
                token()
                  .replace(/[^a-v0-9]/g, "")
                  .slice(0, 20);
              const restored = await api(t, base, "POST", {
                ...googleEvent(row, user),
                id: replacement,
              });
              await query(
                "UPDATE google_calendar_links SET google_id=$3 WHERE user_id=$1 AND google_id=$2",
                [user, link.google_id, replacement],
                db,
              );
              await save(row, restored);
              count++;
              continue;
            }
            const updated = await api(
              t,
              base + "/" + encodeURIComponent(link.google_id),
              "PATCH",
              googleEvent(row, user),
              r!.etag,
            );
            await save(row, updated);
            count++;
          } else {
            if (deleted) {
              if (row) {
                await query(
                  "DELETE FROM calendar_events WHERE id=$1 AND user_id=$2",
                  [row.id, user],
                  db,
                );
                await emit(c.workspace_id, "calendar.updated", user, {}, db);
              }
              await save(null, { ...r, etag: "deleted" }, link);
              count++;
              continue;
            }
            const b = fromGoogle(
              r!,
              row || {
                ...link.local_snapshot,
                end: link.local_snapshot.end_at,
              },
            );
            let updated;
            if (row)
              [updated] = await query(
                `UPDATE calendar_events SET title=$3,description=$4,start_at=$5,"end"=$6,timezone=$7,all_day=$8,recurrence=$9,reminder_minutes=$10,next_reminder_at=$11,updated_at=now(),dav_data=NULL WHERE id=$1 AND user_id=$2 RETURNING *`,
                [
                  row.id,
                  user,
                  b.title,
                  b.description,
                  b.start_at,
                  b.end_at,
                  b.timezone,
                  b.all_day,
                  b.recurrence,
                  b.reminder_minutes,
                  calendarReminderAt(b),
                ],
                db,
              );
            else {
              // Restore only on an explicit conflict choice; preserve the same external identity.
              assert(
                link.resolution === "google",
                409,
                "CONFLICT",
                "Supprimé dans Liora et modifié dans Google. Choisissez une version.",
              );
              assert(
                !b.channel_id,
                409,
                "RESTORE_SCOPE",
                "Pour restaurer un événement de salon, recréez-le dans Liora.",
              );
              [updated] = await query(
                `INSERT INTO calendar_events(id,workspace_id,user_id,title,description,start_at,"end",timezone,all_day,recurrence,reminder_minutes,next_reminder_at,reminder_initialized) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true) RETURNING *`,
                [
                  link.original_id,
                  c.workspace_id,
                  user,
                  b.title,
                  b.description,
                  b.start_at,
                  b.end_at,
                  b.timezone,
                  b.all_day,
                  b.recurrence,
                  b.reminder_minutes,
                  calendarReminderAt(b),
                ],
                db,
              );
            }
            await save(updated, r!);
            await emit(c.workspace_id, "calendar.updated", user, {}, db);
            count++;
          }
        } catch (e) {
          await query(
            "UPDATE google_calendar_links SET issue=$3,remote_snapshot=$4,local_snapshot=$5,resolution=NULL WHERE user_id=$1 AND google_id=$2",
            [
              user,
              link.google_id,
              e instanceof HttpError
                ? e.message
                : "Synchronisation refusée ; réessayez.",
              JSON.stringify(r),
              JSON.stringify(row ? values(row) : link.local_snapshot),
            ],
            db,
          );
        }
      }
      for (const row of local) {
        if (links.some((l) => l.original_id === row.id)) continue;
        const id =
          "liora" + user.replaceAll("-", "") + row.id.replaceAll("-", "");
        let r = remote.find((e) => e.id === id);
        if (!r) {
          try {
            r = await api(t, base, "POST", { ...googleEvent(row, user), id });
          } catch (e) {
            if (e instanceof HttpError && e.code === "GOOGLE_409")
              r = await api(t, base + "/" + id);
            else throw e;
          }
        }
        assert(
          r?.status !== "cancelled" &&
            r?.extendedProperties?.private?.liora_user_id === user &&
            r?.extendedProperties?.private?.liora_event_id === row.id,
          409,
          "GOOGLE_COLLISION",
          "Un identifiant Google existe déjà.",
        );
        await save(row, r!);
        if (signature(row) !== hash(JSON.stringify(fromGoogle(r!, row)))) {
          await query(
            "UPDATE google_calendar_links SET local_hash='',remote_etag='',issue='Un export déjà présent a été modifié dans Google. Choisissez une version.' WHERE user_id=$1 AND google_id=$2",
            [user, r!.id],
            db,
          );
        }
        count++;
      }
      await query(
        "UPDATE google_calendar_connections SET last_synced_at=now(),last_error=NULL WHERE user_id=$1",
        [user],
        db,
      );
      const [issues] = await query(
        "SELECT count(*)::int n FROM google_calendar_links WHERE user_id=$1 AND issue IS NOT NULL",
        [user],
        db,
      );
      return { ok: true, count, conflicts: issues.n };
    } catch (e) {
      const message =
        e instanceof HttpError
          ? e.message
          : "Google Agenda est inaccessible. Les événements sont conservés ; réessayez.";
      await query(
        "UPDATE google_calendar_connections SET last_error=$2,last_synced_at=now() WHERE user_id=$1",
        [user, message],
        db,
      );
      return { ok: false, count, error: message };
    }
  });
}
export async function processGoogleCalendars() {
  const accounts = await query(
    `SELECT user_id FROM google_calendar_connections WHERE enabled AND calendar_id IS NOT NULL AND (last_synced_at IS NULL OR last_synced_at<now()-interval '5 minutes') LIMIT 5`,
  );
  for (const c of accounts)
    try {
      await syncGoogleCalendar(c.user_id);
    } catch {
      /* another worker or disconnected account */
    }
}
