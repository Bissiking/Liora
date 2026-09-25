// src/shared/schedule.ts
import { Temporal } from "@js-temporal/polyfill";
export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export const recurrenceLabels = {
  none: "Aucune",
  daily: "Chaque jour",
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
  yearly: "Chaque année",
};
export function validTimezone(zone: string) {
  try {
    Temporal.Now.zonedDateTimeISO(zone);
    return !/^[+-]/.test(zone);
  } catch {
    return false;
  }
}
export function localDateTime(instant: string | Date, timezone: string) {
  return Temporal.Instant.from(new Date(instant).toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function instantFromLocal(local: string, timezone: string) {
  return Temporal.PlainDateTime.from(local)
    .toZonedDateTime(timezone, { disambiguation: "compatible" })
    .toInstant()
    .toString();
}
export function dateKey(value: string | Date, timezone: string) {
  return Temporal.Instant.from(new Date(value).toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}
export function dayBoundary(date: string, timezone: string) {
  return Temporal.PlainDate.from(date)
    .toZonedDateTime(timezone)
    .toInstant()
    .toString();
}
/** Anchor-based arithmetic preserves the original day after February and the local hour after DST. */
export function occurrenceAt(
  anchor: string | Date,
  recurrence: Recurrence,
  timezone: string,
  n: number,
) {
  const instant = Temporal.Instant.from(new Date(anchor).toISOString());
  if (!n || recurrence === "none") return instant.toString();
  const local = instant.toZonedDateTimeISO(timezone).toPlainDateTime();
  const duration =
    recurrence === "daily"
      ? { days: n }
      : recurrence === "weekly"
        ? { weeks: n }
        : recurrence === "monthly"
          ? { months: n }
          : { years: n };
  return local
    .add(duration, { overflow: "constrain" })
    .toZonedDateTime(timezone, { disambiguation: "compatible" })
    .toInstant()
    .toString();
}
export function occurrenceIndex(
  anchor: string | Date,
  recurrence: Recurrence,
  timezone: string,
  at: string | Date,
) {
  const a = Temporal.Instant.from(new Date(anchor).toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
  const b = Temporal.Instant.from(new Date(at).toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
  const days = a.until(b, { largestUnit: "day" }).days;
  return Math.max(
    0,
    (recurrence === "yearly"
      ? b.year - a.year
      : recurrence === "monthly"
        ? (b.year - a.year) * 12 + b.month - a.month
        : recurrence === "weekly"
          ? Math.floor(days / 7)
          : days) - 1,
  );
}
export function nextOccurrence(
  anchor: string | Date,
  recurrence: Recurrence,
  timezone: string,
  after: string | Date,
) {
  const threshold = new Date(after).getTime();
  if (recurrence === "none")
    return new Date(anchor).getTime() > threshold
      ? new Date(anchor).toISOString()
      : null;
  for (let n = occurrenceIndex(anchor, recurrence, timezone, after); ; n++) {
    const result = occurrenceAt(anchor, recurrence, timezone, n);
    if (Date.parse(result) > threshold) return result;
  }
}
export function occurrences(
  anchor: string | Date,
  recurrence: Recurrence,
  timezone: string,
  from: string,
  until: string,
) {
  const result: string[] = [];
  for (
    let n =
      recurrence === "none"
        ? 0
        : occurrenceIndex(anchor, recurrence, timezone, from);
    ;
    n++
  ) {
    const value = occurrenceAt(anchor, recurrence, timezone, n);
    if (Date.parse(value) >= Date.parse(until)) break;
    if (Date.parse(value) >= Date.parse(from)) result.push(value);
    if (recurrence === "none") break;
    if (result.length > 800) throw Error("Plage de récurrence trop longue.");
  }
  return result;
}
