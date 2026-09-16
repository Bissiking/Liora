-- migrations/003_collaboration_plus.sql
ALTER TABLE users ADD COLUMN avatar_key text, ADD COLUMN avatar_mime text;
CREATE TABLE friendships(user_a uuid NOT NULL REFERENCES users(id),user_b uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_a,user_b),CHECK(user_a<user_b));
CREATE TABLE invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),token_hash text NOT NULL UNIQUE,workspace_id uuid NOT NULL REFERENCES workspaces(id),issuer uuid NOT NULL REFERENCES users(id),join_role uuid REFERENCES roles(id),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',accepted_by uuid REFERENCES users(id),revoked boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE workspace_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES workspaces(id),name text NOT NULL,UNIQUE(workspace_id,name),UNIQUE(id,workspace_id));
CREATE TABLE group_members(group_id uuid NOT NULL REFERENCES workspace_groups(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id),PRIMARY KEY(group_id,user_id));
CREATE TABLE channel_groups(channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,group_id uuid NOT NULL REFERENCES workspace_groups(id) ON DELETE CASCADE,PRIMARY KEY(channel_id,group_id));
ALTER TABLE tasks ADD COLUMN participants uuid[] NOT NULL DEFAULT '{}', ADD COLUMN attachment_ids uuid[] NOT NULL DEFAULT '{}', ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE attachments ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
CREATE TABLE task_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES workspaces(id),task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,actor text NOT NULL,action text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE task_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES workspaces(id),name text NOT NULL,description text NOT NULL DEFAULT '',checklist jsonb NOT NULL DEFAULT '[]',tags text[] NOT NULL DEFAULT '{}',priority text NOT NULL DEFAULT 'normal');
CREATE TABLE page_revisions(page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,revision integer NOT NULL,title text NOT NULL,blocks jsonb NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(page_id,revision));
CREATE TABLE page_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id),content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE user_integrations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),name text NOT NULL,url text NOT NULL,UNIQUE(user_id,name));
UPDATE pages SET blocks=COALESCE((SELECT jsonb_agg(b.value || jsonb_build_object('id',gen_random_uuid()::text) ORDER BY b.ordinality) FROM jsonb_array_elements(blocks) WITH ORDINALITY b),'[]'::jsonb);
CREATE INDEX tasks_activity_lookup ON task_activity(task_id,created_at DESC,id);
