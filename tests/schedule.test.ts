// tests/schedule.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  instantFromLocal,
  occurrenceAt,
  nextOccurrence,
  occurrences,
} from "../src/shared/schedule.js";
test("recurrences preserve local hours across DST and recover after nonexistent hours", () => {
  const anchor = "2026-03-28T01:30:00Z";
  assert.equal(
    occurrenceAt(anchor, "daily", "Europe/Paris", 1),
    "2026-03-29T01:30:00Z",
  );
  assert.equal(
    occurrenceAt(anchor, "daily", "Europe/Paris", 2),
    "2026-03-30T00:30:00Z",
  );
  assert.equal(
    occurrenceAt("2026-10-24T00:30:00Z", "daily", "Europe/Paris", 1),
    "2026-10-25T00:30:00Z",
  );
  assert.equal(
    occurrenceAt("2026-10-24T00:30:00Z", "daily", "Europe/Paris", 2),
    "2026-10-26T01:30:00Z",
  );
});
test("monthly and yearly schedules remain anchored to month-end and leap dates", () => {
  const jan = "2024-01-31T08:00:00Z";
  assert.equal(
    occurrenceAt(jan, "monthly", "Europe/Paris", 1),
    "2024-02-29T08:00:00Z",
  );
  assert.equal(
    occurrenceAt(jan, "monthly", "Europe/Paris", 2),
    "2024-03-31T07:00:00Z",
  );
  assert.equal(
    occurrenceAt("2024-02-29T08:00:00Z", "yearly", "Europe/Paris", 4),
    "2028-02-29T08:00:00Z",
  );
  assert.equal(
    nextOccurrence(jan, "monthly", "Europe/Paris", "2026-09-25T12:00:00Z"),
    "2026-09-30T07:00:00Z",
  );
});
test("monthly window includes old recurring series; date keys use the user's zone", () => {
  assert.equal(
    occurrences(
      "2020-01-01T09:00:00Z",
      "daily",
      "UTC",
      "2026-09-01T00:00:00Z",
      "2026-10-01T00:00:00Z",
    ).length,
    30,
  );
  assert.equal(
    occurrences(
      "2020-01-01T09:00:00Z",
      "none",
      "UTC",
      "2026-09-01T00:00:00Z",
      "2026-10-01T00:00:00Z",
    ).length,
    0,
  );
  assert.equal(dateKey("2026-09-24T22:30:00Z", "Europe/Paris"), "2026-09-25");
  assert.equal(
    instantFromLocal("2026-09-25T09:00", "Europe/Paris"),
    "2026-09-25T07:00:00Z",
  );
});
