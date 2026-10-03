// tests/date-detection.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDateTimes } from "../src/shared/date-detection.js";
const ref = new Date("2026-10-03T12:00:00Z");
const parse = (text: string) => detectDateTimes(text, ref, "Europe/Paris");
test("French spans bind adjacent times and retain exact offsets", () => {
  const text = "RDV 12/10/2026 à 14h, puis 13/10/2026 à 9h";
  const dates = parse(text);
  assert.equal(dates.length, 2);
  assert.equal(dates[0].start.toISOString(), "2026-10-12T12:00:00.000Z");
  assert.equal(dates[1].start.toISOString(), "2026-10-13T07:00:00.000Z");
  for (const d of dates)
    assert.equal(
      text.slice(d.index, d.index + d.originalText.length),
      d.originalText,
    );
  assert.equal(parse("12/10/2026. Une réunion à 18h")[0].allDay, true);
});
test("invalid dates, invalid times and words never become appointments", () => {
  for (const text of [
    "31/02/2026",
    "29/02/2025",
    "marque commerciale merci jeu vidéo",
    "demain à 25h",
    "pendant 2 heures",
  ])
    assert.deepEqual(parse(text), [], text);
});
test("relative French dates and durations are anchored", () => {
  assert.equal(
    parse("après-demain à 10h")[0].start.toISOString(),
    "2026-10-05T08:00:00.000Z",
  );
  assert.equal(
    parse("aujourd’hui")[0].start.toISOString(),
    "2026-10-02T22:00:00.000Z",
  );
  assert.equal(
    parse("dans 3 jours à 10h30")[0].start.toISOString(),
    "2026-10-06T08:30:00.000Z",
  );
  const d = parse("à 14h pendant 2 heures")[0];
  assert.equal(d.end!.getTime() - d.start.getTime(), 7200000);
});
test("ranges, ISO dates and DST use calendar semantics", () => {
  const range = parse("du 12 au 14 octobre 2026")[0];
  assert.equal(range.allDay, true);
  assert.equal(range.end!.toISOString(), "2026-10-14T22:00:00.000Z");
  const night = parse("demain de 23h à 1h")[0];
  assert.equal(night.end!.getTime() - night.start.getTime(), 7200000);
  assert.equal(
    parse("2026-12-12 14:30")[0].start.toISOString(),
    "2026-12-12T13:30:00.000Z",
  );
  assert.equal(
    parse("26 octobre 2026 à 10h")[0].start.toISOString(),
    "2026-10-26T09:00:00.000Z",
  );
  assert.deepEqual(parse("25 octobre 2026 à 2h30"), []);
});
