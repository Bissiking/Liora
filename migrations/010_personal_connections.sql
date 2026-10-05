-- migrations/010_personal_connections.sql
CREATE TABLE personal_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 content text NOT NULL DEFAULT '' CHECK(length(content)<=20000),
 due_at timestamptz NOT NULL,
 source text NOT NULL DEFAULT 'liora' CHECK(source IN ('liora','braindump')),
 source_id integer,
 source_base text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((source='liora' AND source_id IS NULL AND source_base IS NULL) OR (source='braindump' AND source_id>0 AND source_base IS NOT NULL)),
 UNIQUE(user_id,source_base,source_id)
);
CREATE INDEX personal_notes_date ON personal_notes(user_id,due_at,id);
CREATE TABLE braindump_connections (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 last_synced_at timestamptz,
 last_error text
);
CREATE TABLE calendar_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 password_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_used_at timestamptz
);
ALTER TABLE calendar_events ADD COLUMN dav_href text;
ALTER TABLE calendar_events ADD COLUMN calendar_uid text;
ALTER TABLE calendar_events ADD COLUMN dav_data text;
CREATE UNIQUE INDEX calendar_dav_href ON calendar_events(workspace_id,dav_href) WHERE dav_href IS NOT NULL;
CREATE UNIQUE INDEX calendar_dav_uid ON calendar_events(workspace_id,calendar_uid) WHERE calendar_uid IS NOT NULL;
CREATE TABLE google_calendar_attempts (
 id text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id text NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
 verifier text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE google_calendar_connections (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 tokens text NOT NULL,
 workspace_id uuid REFERENCES workspaces(id),
 calendar_id text,
 calendar_name text,
 enabled boolean NOT NULL DEFAULT false,
 last_synced_at timestamptz,
 last_error text
);
CREATE TABLE google_calendar_links (
 user_id uuid NOT NULL REFERENCES google_calendar_connections(user_id) ON DELETE CASCADE,
 event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
 original_id uuid NOT NULL,
 google_id text NOT NULL,
 local_hash text NOT NULL,
 remote_etag text NOT NULL,
 local_snapshot jsonb NOT NULL,
 remote_snapshot jsonb NOT NULL,
 issue text,
 resolution text CHECK(resolution IN ('liora','google')),
 PRIMARY KEY(user_id,google_id),
 UNIQUE(user_id,original_id)
);
