// src/server/calendar.ts
import { Router } from "express";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { query, transaction } from "./db.js";
import { authorize } from "./auth.js";
import { granted, visibleChannel } from "./access.js";
import { assert } from "./errors.js";
import { emit } from "./events.js";
import { humanWorkspace, targetAccess } from "./experience-access.js";
import {
  dayBoundary,
  nextOccurrence,
  occurrences,
  validTimezone,
} from "../shared/schedule.js";
export const calendarRouter = Router({ mergeParams: true });
export const timezoneSchema = z
  .string()
  .max(100)
  .refine(validTimezone, "Fuseau horaire IANA invalide.");
const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  start_at: z.iso.datetime({ offset: true }),
  end_at: z.iso.datetime({ offset: true }).nullable(),
  timezone: timezoneSchema,
  all_day: z.boolean(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
  channel_id: z.uuid().nullable(),
  color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/),
  reminder_minutes: z.number().int().min(0).max(10080).nullable(),
};
const eventSchema = z.object(fields).strict();
function validateDates(row: Record<string, any>) {
  assert(
    !row.end_at || Date.parse(row.end_at) > Date.parse(row.start_at),
    400,
    "INVALID_DATES",
    "La fin doit suivre le début.",
  );
  assert(
    !row.end_at ||
      Date.parse(row.end_at) - Date.parse(row.start_at) <= 366 * 86400000,
    400,
    "INVALID_DATES",
    "Un événement ne peut pas dépasser un an.",
  );
  if (row.all_day) {
    for (const value of [row.start_at, row.end_at].filter(Boolean)) {
      const local = Temporal.Instant.from(value).toZonedDateTimeISO(
        row.timezone,
      );
      assert(
        local.hour === 0 && local.minute === 0 && local.second === 0,
        400,
        "INVALID_DATES",
        "Une journée entière commence et finit à minuit dans son fuseau.",
      );
    }
  }
}
export function calendarReminderAt(row: Record<string, any>, now = new Date()) {
  if (row.reminder_minutes === null || row.reminder_minutes === undefined)
    return null;
  const lead = row.reminder_minutes * 60000;
  const next = nextOccurrence(
    row.start_at,
    row.recurrence,
    row.timezone,
    new Date(now.getTime() + lead - 1),
  );
  return next ? new Date(Date.parse(next) - lead).toISOString() : null;
}
calendarRouter.get("/calendar", async (req, res) => {
  const w = req.workspaceId;
  await authorize(req.actor, w, "VIEW_WORKSPACE");
  const zone = timezoneSchema.parse(req.query.timezone || "UTC");
  const start = z.iso
    .date()
    .parse(req.query.start || new Date().toISOString().slice(0, 10));
  const end = z.iso.date().parse(req.query.end || start);
  const from = dayBoundary(start, zone),
    until = dayBoundary(
      Temporal.PlainDate.from(end).add({ days: 1 }).toString(),
      zone,
    );
  const length = Temporal.PlainDate.from(start).until(
    Temporal.PlainDate.from(end),
  ).days;
  assert(
    length >= 0 && length <= 366,
    400,
    "INVALID_RANGE",
    "Choisissez une période de 367 jours maximum.",
  );
  const rows = await query(
    `SELECT e.*,u.name author_name FROM calendar_events e JOIN users u ON u.id=e.user_id WHERE e.workspace_id=$1 AND e.start_at<$4::timestamptz AND (e.recurrence<>'none' OR COALESCE(e."end",e.start_at)>=$5::timestamptz) AND (e.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=e.channel_id AND ${visibleChannel()})) ORDER BY e.start_at LIMIT 501`,
    [w, req.actor.id, await granted(req.actor, w), until, from],
  );
  assert(
    rows.length <= 500,
    400,
    "RANGE_TOO_LARGE",
    "Trop de séries à afficher ; réduisez le calendrier.",
  );
  const data = rows
    .flatMap((row) => {
      // Include occurrences spanning the start of the requested period.
      const duration = row.end
        ? new Date(row.end).getTime() - new Date(row.start_at).getTime()
        : 0;
      const scanFrom = new Date(
        Date.parse(from) - duration - 86400000,
      ).toISOString();
      return occurrences(
        row.start_at,
        row.recurrence,
        row.timezone,
        scanFrom,
        until,
      )
        .map((at) => {
          let endAt = row.end
            ? new Date(Date.parse(at) + duration).toISOString()
            : null;
          if (row.all_day && row.end) {
            const a = Temporal.Instant.from(
              row.start_at.toISOString(),
            ).toZonedDateTimeISO(row.timezone);
            const b = Temporal.Instant.from(
              row.end.toISOString(),
            ).toZonedDateTimeISO(row.timezone);
            endAt = Temporal.Instant.from(at)
              .toZonedDateTimeISO(row.timezone)
              .add({ days: a.toPlainDate().until(b.toPlainDate()).days })
              .toInstant()
              .toString();
          }
          return {
            ...row,
            start_at: at,
            end_at: endAt,
            end: endAt,
            series_start_at: row.start_at,
            series_end_at: row.end,
            occurrence_id: `${row.id}:${at}`,
          };
        })
        .filter((r) =>
          r.end_at
            ? Date.parse(r.end_at) > Date.parse(from)
            : Date.parse(r.start_at) >= Date.parse(from),
        );
    })
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  assert(
    data.length <= 10000,
    400,
    "RANGE_TOO_LARGE",
    "Réduisez la période du calendrier.",
  );
  res.json({ data });
});
calendarRouter.get("/calendar/:id", async (req, res) => {
  const row = await targetAccess(
    req.actor,
    req.workspaceId,
    "event",
    z.uuid().parse(req.params.id),
  );
  const [author] = await query("SELECT name FROM users WHERE id=$1", [
    row.user_id,
  ]);
  res.json({ data: { ...row, end_at: row.end, author_name: author.name } });
});
calendarRouter.post("/calendar", async (req, res) => {
  const w = req.workspaceId;
  await humanWorkspace(req.actor, w);
  await authorize(req.actor, w, "CREATE_CALENDAR_EVENT");
  const b = eventSchema.parse({
    description: "",
    end_at: null,
    timezone: "UTC",
    all_day: false,
    recurrence: "none",
    channel_id: null,
    color: "",
    reminder_minutes: null,
    ...req.body,
  });
  validateDates(b);
  if (b.channel_id) await targetAccess(req.actor, w, "channel", b.channel_id);
  const row = await transaction(async (db) => {
    const [row] = await query(
      `INSERT INTO calendar_events(workspace_id,user_id,title,description,start_at,"end",timezone,all_day,recurrence,channel_id,color,reminder_minutes,next_reminder_at,reminder_initialized) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) RETURNING *,"end" AS end_at`,
      [
        w,
        req.actor.id,
        b.title,
        b.description,
        b.start_at,
        b.end_at,
        b.timezone,
        b.all_day,
        b.recurrence,
        b.channel_id,
        b.color,
        b.reminder_minutes,
        calendarReminderAt(b),
      ],
      db,
    );
    await emit(w, "calendar.updated", req.actor.id, {}, db);
    return row;
  });
  res.status(201).json({ data: row });
});
calendarRouter.patch("/calendar/:id", async (req, res) => {
  const w = req.workspaceId,
    id = z.uuid().parse(req.params.id);
  await humanWorkspace(req.actor, w);
  const patch = eventSchema.partial().parse(req.body);
  const row = await transaction(async (db) => {
    await query(
      "SELECT id FROM calendar_events WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
      [id, w],
      db,
    );
    const original = await targetAccess(req.actor, w, "event", id, db);
    if (original.user_id !== req.actor.id)
      await authorize(req.actor, w, "MANAGE_CALENDAR");
    const picked = Object.fromEntries(
      Object.keys(fields).map((k) => [k, original[k]]),
    );
    const b = eventSchema.parse({
      ...picked,
      start_at: original.start_at.toISOString(),
      end_at: original.end?.toISOString() || null,
      ...patch,
    });
    validateDates(b);
    if (b.channel_id)
      await targetAccess(req.actor, w, "channel", b.channel_id, db);
    const timingChanged = [
      "start_at",
      "end_at",
      "timezone",
      "recurrence",
      "reminder_minutes",
    ].some((k) => k in patch);
    const [updated] = await query(
      `UPDATE calendar_events SET title=$3,description=$4,start_at=$5,"end"=$6,timezone=$7,all_day=$8,recurrence=$9,channel_id=$10,color=$11,reminder_minutes=$12,next_reminder_at=$13,reminder_initialized=true,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING *,"end" AS end_at`,
      [
        id,
        w,
        b.title,
        b.description,
        b.start_at,
        b.end_at,
        b.timezone,
        b.all_day,
        b.recurrence,
        b.channel_id,
        b.color,
        b.reminder_minutes,
        timingChanged ? calendarReminderAt(b) : original.next_reminder_at,
      ],
      db,
    );
    await emit(w, "calendar.updated", req.actor.id, {}, db);
    return updated;
  });
  res.json({ data: row });
});
calendarRouter.delete("/calendar/:id", async (req, res) => {
  const w = req.workspaceId,
    id = z.uuid().parse(req.params.id);
  await humanWorkspace(req.actor, w);
  await transaction(async (db) => {
    const row = await targetAccess(req.actor, w, "event", id, db);
    if (row.user_id !== req.actor.id)
      await authorize(req.actor, w, "MANAGE_CALENDAR");
    await query(
      "DELETE FROM calendar_events WHERE id=$1 AND workspace_id=$2",
      [id, w],
      db,
    );
    await emit(w, "calendar.updated", req.actor.id, {}, db);
  });
  res.json({ ok: true });
});
