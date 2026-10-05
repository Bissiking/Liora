// src/shared/calendar-rule.ts
import { dateKey } from "./schedule.js";
const frequencies: Record<string, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};
/** Match Liora's anchored month-end semantics instead of dropping February occurrences. */
export function calendarRule(
  anchor: string | Date,
  zone: string,
  recurrence: string,
) {
  const date = dateKey(anchor, zone),
    month = Number(date.slice(5, 7)),
    day = Number(date.slice(8, 10));
  if (!frequencies[recurrence]) return null;
  if (recurrence === "monthly" && day > 28)
    return `FREQ=MONTHLY;BYMONTHDAY=${day},-1;BYSETPOS=1`;
  if (recurrence === "yearly" && month === 2 && day === 29)
    return "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29,-1;BYSETPOS=1";
  return "FREQ=" + frequencies[recurrence];
}
export function parseCalendarRule(
  rule: string,
  anchor: string | Date,
  zone: string,
) {
  const parts = rule
    .replace(/^RRULE:/, "")
    .split(";")
    .filter((p) => p !== "INTERVAL=1");
  const freq = parts.find((p) => p.startsWith("FREQ="))?.slice(5);
  const recurrence = Object.keys(frequencies).find(
    (k) => frequencies[k] === freq,
  );
  if (!recurrence) return null;
  const expected = calendarRule(anchor, zone, recurrence)!;
  const canonical = (r: string) => r.split(";").sort().join(";");
  return canonical(parts.join(";")) === canonical(expected) ? recurrence : null;
}
