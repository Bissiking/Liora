// src/server/experience-worker.ts
import { query, transaction } from "./db.js";
import { emit } from "./events.js";
import {
  humanWorkspace,
  reminderReferences,
  targetAccess,
} from "./experience-access.js";
import { nextOccurrence } from "../shared/schedule.js";
import { calendarReminderAt } from "./calendar.js";
import { HttpError } from "./errors.js";
export async function processReminders(now = new Date()) {
  await transaction(async (db) => {
    const legacy = await query(
      "SELECT * FROM calendar_events WHERE NOT reminder_initialized LIMIT 100 FOR UPDATE SKIP LOCKED",
      [],
      db,
    );
    for (const row of legacy)
      await query(
        "UPDATE calendar_events SET next_reminder_at=$2,reminder_initialized=true WHERE id=$1",
        [row.id, calendarReminderAt(row, now)],
        db,
      );

    const rows = await query(
      "SELECT * FROM reminders WHERE state IN ('pending','snoozed') AND remind_at<=$1 ORDER BY remind_at LIMIT 100 FOR UPDATE SKIP LOCKED",
      [now],
      db,
    );
    for (const r of rows) {
      const actor = { id: r.user_id, kind: "human" as const };
      try {
        await humanWorkspace(actor, r.workspace_id);
        await reminderReferences(actor, r.workspace_id, r, db);
      } catch (e) {
        if (!(e instanceof HttpError && [403, 404].includes(e.status))) throw e;
        await query(
          "UPDATE reminders SET state='dismissed',updated_at=now() WHERE id=$1",
          [r.id],
          db,
        );
        continue;
      }
      await query(
        "INSERT INTO notifications(workspace_id,user_id,type,title,body,channel_id) VALUES($1,$2,'reminder',$3,$4,$5)",
        [r.workspace_id, r.user_id, r.title, r.body, r.channel_id],
        db,
      );
      const next = r.recurring
        ? nextOccurrence(r.anchor_at, r.recurring_interval, r.timezone, now)
        : null;
      await query(
        "UPDATE reminders SET state=$2,remind_at=COALESCE($3,remind_at),last_fired_at=$4,updated_at=now() WHERE id=$1",
        [r.id, next ? "pending" : "done", next, now],
        db,
      );
      await emit(r.workspace_id, "reminder.fired", r.user_id, {}, db);
    }
    const events = await query(
      "SELECT * FROM calendar_events WHERE next_reminder_at<=$1 ORDER BY next_reminder_at LIMIT 100 FOR UPDATE SKIP LOCKED",
      [now],
      db,
    );
    for (const e of events) {
      const actor = { id: e.user_id, kind: "human" as const };
      try {
        await humanWorkspace(actor, e.workspace_id);
        await targetAccess(actor, e.workspace_id, "event", e.id, db);
      } catch (error) {
        if (!(error instanceof HttpError && [403, 404].includes(error.status)))
          throw error;
        await query(
          "UPDATE calendar_events SET next_reminder_at=null WHERE id=$1",
          [e.id],
          db,
        );
        continue;
      }
      await query(
        "INSERT INTO notifications(workspace_id,user_id,type,title,body,channel_id) VALUES($1,$2,'reminder',$3,$4,$5)",
        [
          e.workspace_id,
          e.user_id,
          `Calendrier : ${e.title}`,
          e.description,
          e.channel_id,
        ],
        db,
      );
      const lead = e.reminder_minutes * 60000;
      const next = nextOccurrence(
        e.start_at,
        e.recurrence,
        e.timezone,
        new Date(now.getTime() + lead),
      );
      await query(
        "UPDATE calendar_events SET next_reminder_at=$2 WHERE id=$1",
        [e.id, next ? new Date(Date.parse(next) - lead) : null],
        db,
      );
      await emit(e.workspace_id, "calendar.reminded", e.user_id, {}, db);
    }
  });
}
