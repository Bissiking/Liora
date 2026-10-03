// src/shared/date-detection.ts
import * as french from "chrono-node/fr";
import type { ParsedComponents } from "chrono-node";
import { Temporal } from "@js-temporal/polyfill";
import { validTimezone } from "./schedule.js";
export interface DetectedDateTime {
  originalText: string;
  start: Date;
  end?: Date;
  index: number;
  allDay: boolean;
  timezone: string;
}
/** French spans, anchored to the message's creation instant and author's timezone. */
export function detectDateTimes(
  text: string,
  referenceDate = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): DetectedDateTime[] {
  if (!text || !Number.isFinite(referenceDate.getTime())) return [];
  const zone = validTimezone(timezone) ? timezone : "UTC";
  const reference = Temporal.Instant.from(
    referenceDate.toISOString(),
  ).toZonedDateTimeISO(zone);
  const options = {
    instant: referenceDate,
    timezone: reference.offsetNanoseconds / 60e9,
  };
  // Apostrophe normalization preserves string offsets.
  let input = text.slice(0, 8000).replace(/[’‘]/g, "'");
  const supplements: { index: number; text: string; input: string }[] = [];
  for (const match of input.matchAll(
    /\b(?:après[- ]demain|apres[- ]demain)(?:\s+(?:à|a|de)\s+\d{1,2}[h:]\d{0,2}(?:\s+(?:à|a)\s+\d{1,2}[h:]\d{0,2})?)?/gi,
  )) {
    supplements.push({
      index: match.index!,
      text: match[0],
      input: match[0].replace(
        /après[- ]demain|apres[- ]demain/i,
        "dans 2 jours",
      ),
    });
  }
  for (const match of input.matchAll(
    /\b\d{4}-\d{2}-\d{2}(?:[ T](?:\d{2}:\d{2}))?/g,
  )) {
    const [year, month, day] = match[0].slice(0, 10).split("-");
    supplements.push({
      index: match.index!,
      text: match[0],
      input: `${day}/${month}/${year}${match[0].length > 10 ? ` à ${match[0].slice(11)}` : ""}`,
    });
  }
  for (const s of supplements)
    input =
      input.slice(0, s.index) +
      " ".repeat(s.text.length) +
      input.slice(s.index + s.text.length);
  const candidates = french
    .parse(input, options, { forwardDate: true })
    .map((r) => ({
      r,
      index: r.index,
      originalText: text.slice(r.index, r.index + r.text.length),
    }));
  for (const s of supplements)
    for (const r of french.parse(s.input, options, { forwardDate: true }))
      candidates.push({ r, index: s.index, originalText: s.text });
  function instant(
    c: ParsedComponents,
    allDay: boolean,
    hour?: number,
    minute?: number,
  ) {
    const local = Temporal.PlainDateTime.from(
      {
        year: c.get("year")!,
        month: c.get("month")!,
        day: c.get("day")!,
        hour: allDay ? 0 : (hour ?? c.get("hour") ?? 0),
        minute: allDay ? 0 : (minute ?? c.get("minute") ?? 0),
        second: 0,
      },
      { overflow: "reject" },
    );
    // Explicit timezone offsets in the text take priority; otherwise resolve DST at the target date.
    const explicit = c.isCertain("timezoneOffset");
    const offset = c.get("timezoneOffset") || 0;
    const targetZone = explicit
      ? `${offset < 0 ? "-" : "+"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`
      : zone;
    return new Date(
      Number(
        local.toZonedDateTime(targetZone, { disambiguation: "reject" })
          .epochMilliseconds,
      ),
    );
  }
  const result: DetectedDateTime[] = [];
  for (const { r, index, originalText } of candidates.sort(
    (a, b) =>
      a.index - b.index || b.originalText.length - a.originalText.length,
  )) {
    if (
      (index > 0 && /[\p{L}\p{N}_]/u.test(text[index - 1])) ||
      /[\p{L}\p{N}_]/u.test(text[index + originalText.length] || "")
    )
      continue;
    if (/^(?:lun|mar|mer|jeu|ven|sam|dim)$/i.test(originalText)) continue;
    // A duration only describes a length; it is not a separate appointment.
    if (/^(?:pendant|durant)\b/i.test(originalText)) continue;
    if (
      result.some(
        (v) =>
          index < v.index + v.originalText.length &&
          index + originalText.length > v.index,
      )
    )
      continue;
    const tail = text.slice(index + originalText.length);
    if (/^\s+(?:à|a|de)\s+(?:2[4-9]|[3-9]\d)[h:]/i.test(tail)) continue;
    try {
      const allDay = !r.start.isCertain("hour");
      const clocks = [...originalText.matchAll(/\b(\d{1,2})[h:](\d{1,2})?/gi)];
      const start = instant(
        r.start,
        allDay,
        clocks[0] ? Number(clocks[0][1]) : undefined,
        clocks[0] ? Number(clocks[0][2] || 0) : undefined,
      );
      let end = r.end
        ? instant(
            r.end,
            allDay,
            clocks[1] ? Number(clocks[1][1]) : undefined,
            clocks[1] ? Number(clocks[1][2] || 0) : undefined,
          )
        : undefined;
      if (end && end <= start && !allDay)
        end = new Date(
          Number(
            Temporal.Instant.from(end.toISOString())
              .toZonedDateTimeISO(zone)
              .add({ days: 1 }).epochMilliseconds,
          ),
        );
      // French date ranges include their last day; calendar all-day ends are exclusive.
      if (end && allDay)
        end = new Date(
          Number(
            Temporal.Instant.from(end.toISOString())
              .toZonedDateTimeISO(zone)
              .add({ days: 1 }).epochMilliseconds,
          ),
        );
      const duration = tail.match(
        /^\s+(?:pendant|durant)\s+(\d{1,3})\s*(heures?|minutes?)/i,
      );
      let span = originalText;
      if (duration && !allDay && !end) {
        end = new Date(
          start.getTime() +
            Number(duration[1]) *
              (duration[2].startsWith("heure") ? 3600000 : 60000),
        );
        span += duration[0];
      }
      if (end && end <= start) continue;
      result.push({
        originalText: span,
        index,
        start,
        end,
        allDay,
        timezone: zone,
      });
    } catch {
      /* Invalid calendar dates and nonexistent/ambiguous DST times require manual input. */
    }
    if (result.length === 32) break;
  }
  return result;
}
export function formatDateTimeForDisplay(
  date: Date | string,
  timezone?: string,
) {
  return new Date(date).toLocaleString("fr-FR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
}
export function formatDateOnlyForDisplay(
  date: Date | string,
  timezone?: string,
) {
  return new Date(date).toLocaleDateString("fr-FR", {
    timeZone: timezone,
    dateStyle: "short",
  });
}

export function formatTimeOnlyForDisplay(
  date: Date | string,
  timezone?: string,
) {
  return new Date(date).toLocaleTimeString("fr-FR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}
