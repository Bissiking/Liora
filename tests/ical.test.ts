// tests/ical.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import ICAL from "ical.js";
import {
  eventIcal,
  parseEventIcal,
  etag,
  foldIcal,
} from "../src/server/ical.js";
const event = {
  id: "00000000-0000-4000-8000-000000000010",
  workspace_id: "00000000-0000-4000-8000-000000000011",
  title: "Titre français, virgule; et saut\nfin",
  description: "Une idée **avec du texte**",
  start_at: "2026-03-22T09:00:00.000Z",
  end: "2026-03-22T10:00:00.000Z",
  timezone: "Europe/Paris",
  all_day: false,
  recurrence: "weekly",
  channel_id: null,
  color: "",
  reminder_minutes: 15,
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-01T00:00:00.000Z",
};
test("iCalendar preserves Unicode, escaping, local recurrence hour across DST and ETags", () => {
  const data = eventIcal(event),
    cal = new ICAL.Component(ICAL.parse(data));
  assert.ok(cal.getFirstSubcomponent("vtimezone"));
  const values = parseEventIcal(data).values;
  assert.equal(values.title, event.title);
  assert.equal(values.start_at, event.start_at.replace(".000", ""));
  assert.equal(values.timezone, "Europe/Paris");
  assert.equal(values.reminder_minutes, 15);
  const zone = new ICAL.Timezone({
    component: cal.getFirstSubcomponent("vtimezone")!,
    tzid: "Europe/Paris",
  });
  ICAL.TimezoneService.register(zone);
  const item = new ICAL.Event(
    new ICAL.Component(ICAL.parse(data)).getFirstSubcomponent("vevent")!,
  );
  const iter = item.iterator();
  const first = iter.next()!,
    second = iter.next()!;
  assert.equal(first.hour, 10);
  assert.equal(second.hour, 10);
  assert.equal((second.toUnixTime() - first.toUnixTime()) / 3600, 167);
  assert.notEqual(etag(data), etag(eventIcal({ ...event, title: "Autre" })));
  const folded = foldIcal(["SUMMARY:" + "é".repeat(100)]);
  assert.ok(
    folded
      .trimEnd()
      .split("\r\n")
      .every((l) => Buffer.byteLength(l) <= 75),
  );
});
test("iCalendar all-day dates have exclusive end and reject unsupported series or injected components", () => {
  const data = eventIcal({
    ...event,
    all_day: true,
    start_at: "2026-03-28T23:00:00Z",
    end: "2026-03-29T22:00:00Z",
    recurrence: "none",
  });
  assert.match(data, /DTSTART;VALUE=DATE:20260329/);
  assert.match(data, /DTEND;VALUE=DATE:20260330/);
  assert.equal(parseEventIcal(data).values.all_day, true);
  assert.throws(
    () =>
      parseEventIcal(
        eventIcal(event).replace("FREQ=WEEKLY", "FREQ=WEEKLY;COUNT=5"),
      ),
    /répétition/,
  );
  assert.throws(
    () =>
      parseEventIcal(
        data.replace(
          "END:VEVENT",
          "END:VEVENT\r\nBEGIN:VEVENT\r\nUID:other\r\nEND:VEVENT",
        ),
      ),
    /seul événement/,
  );
});
test("calendar exports preserve Liora month-end and leap-day anchors", () => {
  for (const row of [
    {
      ...event,
      start_at: "2026-01-31T09:00:00Z",
      end: "2026-01-31T10:00:00Z",
      recurrence: "monthly",
    },
    {
      ...event,
      start_at: "2024-02-29T09:00:00Z",
      end: "2024-02-29T10:00:00Z",
      recurrence: "yearly",
    },
  ]) {
    const data = eventIcal(row);
    assert.match(data, /BYSETPOS=1/);
    assert.equal(parseEventIcal(data).values.recurrence, row.recurrence);
    const c = new ICAL.Component(ICAL.parse(data));
    ICAL.TimezoneService.register(
      new ICAL.Timezone({
        component: c.getFirstSubcomponent("vtimezone")!,
        tzid: row.timezone,
      }),
    );
    const it = new ICAL.Event(c.getFirstSubcomponent("vevent")!).iterator();
    it.next();
    const second = it.next()!;
    assert.equal(second.day, 28);
  }
});
