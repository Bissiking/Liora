-- migrations/005_experience.sql
-- 0.4.0: calendrier, rappels, favoris, notifications push, thèmes avancés

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  "end" timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  recurrence text CHECK(recurrence IN ('none','daily','weekly','monthly','yearly')),
  channel_id uuid,
  color text NOT NULL DEFAULT '',
  reminder_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(channel_id,workspace_id) REFERENCES channels(id,workspace_id)
);
CREATE INDEX calendar_events_workspace ON calendar_events(workspace_id,start_at);
CREATE INDEX calendar_events_user ON calendar_events(user_id);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  remind_at timestamptz NOT NULL,
  channel_id uuid,
  message_id uuid,
  task_id uuid,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','snoozed','done','dismissed')),
  recurring boolean NOT NULL DEFAULT false,
  recurring_interval text CHECK(recurring_interval IN ('daily','weekly','monthly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(channel_id,workspace_id) REFERENCES channels(id,workspace_id)
);
CREATE INDEX reminders_workspace ON reminders(workspace_id,remind_at);
CREATE INDEX reminders_user_pending ON reminders(user_id,state,remind_at);

CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL CHECK(target_type IN ('channel','message','page','task','event')),
  target_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,user_id,target_type,target_id)
);
CREATE INDEX favorites_user ON favorites(workspace_id,user_id,position);

ALTER TABLE users ADD COLUMN push_subscriptions jsonb NOT NULL DEFAULT '[]';
