// src/server/ical.ts
import ICAL from "ical.js";
import tz from "@touch4it/ical-timezones";
import { Temporal } from "@js-temporal/polyfill";
import { createHash } from "node:crypto";
import { assert, HttpError } from "./errors.js";
import {
  dateKey,
  dayBoundary,
  localDateTime,
  validTimezone,
} from "../shared/schedule.js";
import { calendarRule, parseCalendarRule } from "../shared/calendar-rule.js";
import { calendarSchema, validateDates } from "./calendar.js";
export const xml = (text: unknown) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const compact = (value: string) => value.replace(/[-:]/g, "");
const stamp = (d: string | Date) =>
  new Date(d)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export function foldIcal(lines: string[]) {
  return (
    lines
      .flatMap((line) => {
        const pieces: string[] = [];
        let part = "",
          size = 0;
        for (const c of line) {
          const len = Buffer.byteLength(c);
          if (size + len > 75) {
            pieces.push(part);
            part = " ";
            size = 1;
          }
          part += c;
          size += len;
        }
        pieces.push(part);
        return pieces;
      })
      .join("\r\n") + "\r\n"
  );
}
const frequency: Record<string, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};
export function eventIcal(row: Record<string, any>) {
  if (row.dav_data) return row.dav_data as string;
  const zone = row.timezone || "UTC";
  const end = row.end || row.end_at;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LUMA//Liora 0.7//FR",
    "CALSCALE:GREGORIAN",
  ];
  if (!row.all_day && row.recurrence !== "none" && zone !== "UTC") {
    const component = tz.getVtimezoneComponent(zone);
    assert(
      component,
      409,
      "UNSUPPORTED_TIMEZONE",
      "Ce fuseau ne peut pas être exporté en CalDAV.",
    );
    lines.push(...component.trim().split(/\r?\n/));
  }
  lines.push(
    "BEGIN:VEVENT",
    `UID:${esc(row.calendar_uid || row.id + "@liora")}`,
    `DTSTAMP:${stamp(row.updated_at || row.created_at)}`,
    `LAST-MODIFIED:${stamp(row.updated_at || row.created_at)}`,
    `SUMMARY:${esc(row.title)}`,
    `DESCRIPTION:${esc(row.description)}`,
  );
  if (row.all_day) {
    const start = dateKey(row.start_at, zone);
    lines.push(`DTSTART;VALUE=DATE:${compact(start)}`);
    lines.push(
      `DTEND;VALUE=DATE:${compact(end ? dateKey(end, zone) : Temporal.PlainDate.from(start).add({ days: 1 }).toString())}`,
    );
  } else if (row.recurrence !== "none" && zone !== "UTC") {
    const local = (v: string | Date) =>
      compact(
        Temporal.Instant.from(new Date(v).toISOString())
          .toZonedDateTimeISO(zone)
          .toPlainDateTime()
          .toString({ smallestUnit: "second" }),
      );
    lines.push(`DTSTART;TZID=${zone}:${local(row.start_at)}`);
    if (end) lines.push(`DTEND;TZID=${zone}:${local(end)}`);
  } else {
    lines.push(`DTSTART:${stamp(row.start_at)}`);
    if (end) lines.push(`DTEND:${stamp(end)}`);
  }
  const rule = calendarRule(row.start_at, zone, row.recurrence);
  if (rule) lines.push("RRULE:" + rule);
  if (row.reminder_minutes !== null && row.reminder_minutes !== undefined)
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(row.title)}`,
      `TRIGGER:-PT${row.reminder_minutes}M`,
      "END:VALARM",
    );
  lines.push("END:VEVENT", "END:VCALENDAR");
  return foldIcal(lines);
}
export function noteIcal(row: Record<string, any>) {
  return eventIcal({
    ...row,
    calendar_uid: row.id + "@liora-notes",
    description: row.content,
    start_at: row.due_at,
    end: null,
    timezone: "UTC",
    all_day: false,
    recurrence: "none",
    reminder_minutes: null,
  });
}
export function etag(data: string) {
  return '"' + createHash("sha256").update(data).digest("hex") + '"';
}
export function parseEventIcal(data: string) {
  try {
    assert(
      Buffer.byteLength(data) <= 100000,
      413,
      "TOO_LARGE",
      "Événement trop volumineux.",
    );
    const cal = new ICAL.Component(ICAL.parse(data));
    assert(
      cal.name === "vcalendar",
      400,
      "INVALID_ICAL",
      "Calendrier invalide.",
    );
    const events = cal.getAllSubcomponents("vevent");
    assert(
      events.length === 1,
      409,
      "UNSUPPORTED_RECURRENCE",
      "Un seul événement par ressource ; les exceptions de série ne sont pas prises en charge.",
    );
    const event = events[0];
    assert(
      !event.hasProperty("recurrence-id") &&
        !event.hasProperty("exdate") &&
        !event.hasProperty("rdate"),
      409,
      "UNSUPPORTED_RECURRENCE",
      "Les exceptions de série ne sont pas prises en charge.",
    );
    assert(
      !event.hasProperty("organizer") && !event.hasProperty("attendee"),
      409,
      "UNSUPPORTED_SCHEDULING",
      "Les invitations et participants externes ne sont pas pris en charge.",
    );
    const uid = String(event.getFirstPropertyValue("uid") || "");
    assert(
      uid.length > 0 && uid.length <= 255 && !/[\r\n]/.test(uid),
      400,
      "INVALID_UID",
      "UID invalide.",
    );
    const startProp = event.getFirstProperty("dtstart");
    assert(startProp, 400, "INVALID_DATES", "Le début est requis.");
    const start = startProp.getFirstValue() as ICAL.Time;
    const timezone = String(
      startProp.getParameter("tzid") ||
        (start.zone.tzid === "UTC" ? "UTC" : "UTC"),
    );
    assert(
      validTimezone(timezone),
      409,
      "UNSUPPORTED_TIMEZONE",
      "Utilisez un fuseau IANA ou UTC.",
    );
    const instant = (time: ICAL.Time, prop: ICAL.Property) => {
      if (time.isDate) return dayBoundary(time.toString(), timezone);
      const zone = String(
        prop.getParameter("tzid") ||
          (time.zone.tzid === "UTC" ? "UTC" : timezone),
      );
      assert(
        validTimezone(zone),
        409,
        "UNSUPPORTED_TIMEZONE",
        "Utilisez un fuseau IANA ou UTC.",
      );
      const local = time.toString().replace(/Z$/, "");
      return Temporal.PlainDateTime.from(local)
        .toZonedDateTime(zone, { disambiguation: "compatible" })
        .toInstant()
        .toString();
    };
    const start_at = instant(start, startProp);
    const endProp = event.getFirstProperty("dtend");
    let end_at = endProp
      ? instant(endProp.getFirstValue() as ICAL.Time, endProp)
      : null;
    if (event.hasProperty("duration")) {
      assert(
        !endProp,
        400,
        "INVALID_DATES",
        "DTEND et DURATION ne peuvent pas coexister.",
      );
      const d = event.getFirstPropertyValue("duration") as ICAL.Duration;
      end_at = new Date(
        Date.parse(start_at) + d.toSeconds() * 1000,
      ).toISOString();
    }
    if (start.isDate && !end_at)
      end_at = Temporal.Instant.from(start_at)
        .toZonedDateTimeISO(timezone)
        .add({ days: 1 })
        .toInstant()
        .toString();
    if (endProp)
      assert(
        (endProp.getFirstValue() as ICAL.Time).isDate === start.isDate,
        400,
        "INVALID_DATES",
        "Les types début et fin doivent correspondre.",
      );
    let recurrence = "none";
    const rules = event.getAllProperties("rrule");
    assert(
      rules.length <= 1,
      409,
      "UNSUPPORTED_RECURRENCE",
      "Une seule règle est prise en charge.",
    );
    if (rules.length) {
      const rule = rules[0].getFirstValue() as ICAL.Recur;
      const parsed = parseCalendarRule(rule.toString(), start_at, timezone);
      assert(
        parsed,
        409,
        "UNSUPPORTED_RECURRENCE",
        "Utilisez une répétition sans limite ni exception, avec ancrage en fin de mois pour les dates après le 28.",
      );
      recurrence = parsed;
    }
    let reminder_minutes: number | null = null;
    const alarms = event.getAllSubcomponents("valarm");
    assert(
      alarms.length <= 1,
      409,
      "UNSUPPORTED_ALARM",
      "Un seul rappel est pris en charge.",
    );
    if (alarms.length) {
      const alarm = alarms[0],
        trigger = alarm.getFirstProperty("trigger");
      assert(
        alarm.getFirstPropertyValue("action") === "DISPLAY" &&
          trigger?.type === "duration" &&
          (!trigger.getParameter("related") ||
            trigger.getParameter("related") === "START") &&
          !alarm.hasProperty("repeat"),
        409,
        "UNSUPPORTED_ALARM",
        "Utilisez un rappel visuel avant le début.",
      );
      reminder_minutes =
        -(trigger!.getFirstValue() as ICAL.Duration).toSeconds() / 60;
    }
    const values = calendarSchema.parse({
      title: String(event.getFirstPropertyValue("summary") || "Sans titre"),
      description: String(event.getFirstPropertyValue("description") || ""),
      start_at,
      end_at,
      timezone,
      all_day: start.isDate,
      recurrence,
      channel_id: null,
      color: "",
      reminder_minutes,
    });
    validateDates(values);
    return { uid, values };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "INVALID_ICAL", "Événement iCalendar invalide.");
  }
}
