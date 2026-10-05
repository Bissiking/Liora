-- migrations/009_gotify.sql
ALTER TABLE users ADD COLUMN kyros_avatar_url text;
CREATE TABLE gotify_connections (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  token text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gotify_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES gotify_connections(user_id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id,user_id)
);
CREATE INDEX gotify_due ON gotify_deliveries(next_attempt_at) WHERE state='pending';
CREATE FUNCTION queue_notification_gotify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gotify_deliveries(notification_id,user_id)
  SELECT NEW.id,c.user_id FROM gotify_connections c WHERE c.user_id=NEW.user_id AND c.enabled;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_gotify AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION queue_notification_gotify();
