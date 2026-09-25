-- migrations/006_experience_complete.sql
ALTER TABLE calendar_events ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE calendar_events ADD COLUMN next_reminder_at timestamptz;
ALTER TABLE calendar_events ADD COLUMN reminder_initialized boolean NOT NULL DEFAULT false;
UPDATE calendar_events SET recurrence='none' WHERE recurrence IS NULL;
ALTER TABLE calendar_events ALTER COLUMN recurrence SET DEFAULT 'none';
ALTER TABLE calendar_events ALTER COLUMN recurrence SET NOT NULL;
ALTER TABLE reminders ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE reminders ADD COLUMN anchor_at timestamptz;
ALTER TABLE reminders ADD COLUMN last_fired_at timestamptz;
UPDATE reminders SET anchor_at=remind_at;
ALTER TABLE reminders ALTER COLUMN anchor_at SET NOT NULL;
-- Old pending reminders are picked up once by the new worker, then re-planned if recurring.
UPDATE reminders SET recurring=false,recurring_interval=null WHERE recurring AND recurring_interval IS NULL;
ALTER TABLE reminders ADD CONSTRAINT reminder_recurrence_valid CHECK(NOT recurring OR recurring_interval IS NOT NULL);
UPDATE roles SET permissions=array_append(permissions,'CREATE_CALENDAR_EVENT') WHERE 'CREATE_CHANNEL'=ANY(permissions) AND NOT 'CREATE_CALENDAR_EVENT'=ANY(permissions);
UPDATE roles SET permissions=array_append(permissions,'MANAGE_CALENDAR') WHERE 'MANAGE_WORKSPACE'=ANY(permissions) AND NOT 'MANAGE_CALENDAR'=ANY(permissions);
CREATE INDEX calendar_reminders_due ON calendar_events(next_reminder_at) WHERE next_reminder_at IS NOT NULL;
CREATE INDEX reminders_due ON reminders(remind_at) WHERE state IN ('pending','snoozed');
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  endpoint_hash text NOT NULL UNIQUE,
  subscription text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Legacy JSON subscriptions had no session binding: require explicit consent again, never import silently.
UPDATE users SET push_subscriptions='[]'::jsonb;
CREATE TABLE push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id,subscription_id)
);
CREATE INDEX push_due ON push_deliveries(next_attempt_at) WHERE state='pending';
CREATE FUNCTION queue_notification_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO push_deliveries(notification_id,subscription_id)
  SELECT NEW.id,s.id FROM push_subscriptions s WHERE s.user_id=NEW.user_id;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_push AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION queue_notification_push();
ALTER TABLE favorites DROP CONSTRAINT favorites_target_type_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_target_type_check CHECK(target_type IN ('channel','message','page','task','event','project'));
