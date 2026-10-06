-- migrations/014_channel_read_states.sql
ALTER TABLE notifications ADD COLUMN message_id uuid REFERENCES messages(id) ON DELETE SET NULL;
CREATE TABLE channel_read_states (
 channel_id uuid NOT NULL REFERENCES channels(id), user_id uuid NOT NULL REFERENCES users(id),
 through_at timestamptz NOT NULL, through_id uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(channel_id,user_id)
);
-- New membership markers use the installation cutoff, without mutating existing notifications.
CREATE TABLE channel_read_cutoff (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO channel_read_cutoff DEFAULT VALUES;
CREATE INDEX messages_mentions_recent ON messages(channel_id,created_at,id) WHERE deleted_at IS NULL;
