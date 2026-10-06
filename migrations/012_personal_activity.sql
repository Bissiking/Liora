-- migrations/012_personal_activity.sql
-- Personal reminders and notifications preserve the workspace-owned historical tables.
CREATE TABLE personal_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 title text NOT NULL, body text NOT NULL DEFAULT '', remind_at timestamptz NOT NULL,
 anchor_at timestamptz NOT NULL, timezone text NOT NULL DEFAULT 'UTC',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','snoozed','done','dismissed')),
 recurring boolean NOT NULL DEFAULT false, recurring_interval text CHECK(recurring_interval IN ('daily','weekly','monthly')),
 last_fired_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT recurring OR recurring_interval IS NOT NULL)
);
CREATE INDEX personal_reminders_due ON personal_reminders(remind_at) WHERE state IN ('pending','snoozed');
CREATE INDEX personal_reminders_owner ON personal_reminders(user_id,remind_at,id);
CREATE TABLE personal_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 type text NOT NULL DEFAULT 'reminder', title text NOT NULL, body text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'unread' CHECK(state IN ('unread','read','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_notifications_owner ON personal_notifications(user_id,created_at DESC,id);
CREATE TABLE personal_push_deliveries (LIKE push_deliveries INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE personal_push_deliveries ADD FOREIGN KEY(notification_id) REFERENCES personal_notifications(id) ON DELETE CASCADE;
ALTER TABLE personal_push_deliveries ADD FOREIGN KEY(subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE;
CREATE TABLE personal_gotify_deliveries (LIKE gotify_deliveries INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE personal_gotify_deliveries ADD FOREIGN KEY(notification_id) REFERENCES personal_notifications(id) ON DELETE CASCADE;
ALTER TABLE personal_gotify_deliveries ADD FOREIGN KEY(user_id) REFERENCES gotify_connections(user_id) ON DELETE CASCADE;
CREATE FUNCTION queue_personal_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO personal_push_deliveries(notification_id,subscription_id) SELECT NEW.id,s.id FROM push_subscriptions s WHERE s.user_id=NEW.user_id;
 INSERT INTO personal_gotify_deliveries(notification_id,user_id) SELECT NEW.id,c.user_id FROM gotify_connections c WHERE c.user_id=NEW.user_id AND c.enabled;
 RETURN NEW;
END $$;
CREATE TRIGGER personal_notification_delivery AFTER INSERT ON personal_notifications FOR EACH ROW EXECUTE FUNCTION queue_personal_notification();
