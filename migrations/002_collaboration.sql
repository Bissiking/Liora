-- migrations/002_collaboration.sql
-- Permissions explicitly granted by administrators are preserved. Only the untouched legacy Moderator preset is migrated.
UPDATE roles SET permissions=array_remove(permissions,'VIEW_MONITORING') WHERE name='Moderator' AND NOT is_owner AND permissions @> ARRAY['VIEW_WORKSPACE','VIEW_CHANNEL','SEND_MESSAGE','EDIT_OWN_MESSAGE','DELETE_OWN_MESSAGE','ADD_REACTION','VIEW_PROJECT','VIEW_BOARD','CREATE_TASK','MANAGE_TASK','VIEW_PAGES','MANAGE_MESSAGES','VIEW_MONITORING']::text[] AND cardinality(permissions)=13;
UPDATE roles SET permissions=array_append(permissions,'CREATE_THREAD') WHERE ('SEND_MESSAGE'=ANY(permissions)) AND NOT ('CREATE_THREAD'=ANY(permissions));
ALTER TABLE channels ADD COLUMN is_private boolean NOT NULL DEFAULT false, ADD COLUMN is_dm boolean NOT NULL DEFAULT false, ADD COLUMN dm_key text, ADD COLUMN created_by uuid REFERENCES users(id);
CREATE UNIQUE INDEX channels_dm_key ON channels(workspace_id,dm_key) WHERE dm_key IS NOT NULL;
CREATE TABLE channel_access(channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id),PRIMARY KEY(channel_id,user_id));
ALTER TABLE messages ADD COLUMN thread_id uuid REFERENCES messages(id), ADD COLUMN pinned_at timestamptz, ADD COLUMN attachment_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX messages_search ON messages USING gin(to_tsvector('simple',content)) WHERE deleted_at IS NULL;
CREATE INDEX messages_thread ON messages(thread_id,created_at,id);
ALTER TABLE notifications ADD COLUMN channel_id uuid REFERENCES channels(id);
ALTER TABLE projects ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE boards ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE attachments ADD COLUMN channel_id uuid REFERENCES channels(id);
