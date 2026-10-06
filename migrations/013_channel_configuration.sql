-- migrations/013_channel_configuration.sql
ALTER TABLE channels ADD COLUMN slowmode_seconds integer NOT NULL DEFAULT 0 CHECK(slowmode_seconds BETWEEN 0 AND 21600);
ALTER TABLE channels ADD COLUMN threads_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN username text;
ALTER TABLE messages ADD COLUMN thread_opened_at timestamptz;
UPDATE messages root SET thread_opened_at=(SELECT min(child.created_at) FROM messages child WHERE child.thread_id=root.id) WHERE EXISTS(SELECT 1 FROM messages child WHERE child.thread_id=root.id);
UPDATE roles SET permissions=ARRAY(SELECT DISTINCT p FROM unnest(permissions || CASE WHEN 'VIEW_CHANNEL'=ANY(permissions) THEN ARRAY['READ_MESSAGE'] ELSE ARRAY[]::text[] END || CASE WHEN 'SEND_MESSAGE'=ANY(permissions) THEN ARRAY['ATTACH_FILES','MENTION_USERS'] ELSE ARRAY[]::text[] END || CASE WHEN 'CREATE_THREAD'=ANY(permissions) THEN ARRAY['REPLY_THREAD'] ELSE ARRAY[]::text[] END) p);
UPDATE technical_accounts SET permissions=ARRAY(SELECT DISTINCT p FROM unnest(permissions || CASE WHEN 'VIEW_CHANNEL'=ANY(permissions) THEN ARRAY['READ_MESSAGE'] ELSE ARRAY[]::text[] END || CASE WHEN 'SEND_MESSAGE'=ANY(permissions) THEN ARRAY['ATTACH_FILES','MENTION_USERS'] ELSE ARRAY[]::text[] END || CASE WHEN 'CREATE_THREAD'=ANY(permissions) THEN ARRAY['REPLY_THREAD'] ELSE ARRAY[]::text[] END) p);
UPDATE technical_accounts t SET permissions=ARRAY(SELECT DISTINCT p FROM unnest(t.permissions || ARRAY['VIEW_CHANNEL','READ_MESSAGE','SEND_MESSAGE','MENTION_USERS']) p) WHERE t.token_hash IS NULL AND EXISTS(SELECT 1 FROM webhooks w WHERE w.technical_id=t.id);
CREATE TABLE channel_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, channel_id uuid NOT NULL,
 role_id uuid, user_id uuid, permissions jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(permissions)='object'),
 FOREIGN KEY(channel_id,workspace_id) REFERENCES channels(id,workspace_id),
 FOREIGN KEY(role_id,workspace_id) REFERENCES roles(id,workspace_id),
 FOREIGN KEY(workspace_id,user_id) REFERENCES workspace_members(workspace_id,user_id),
 CHECK((role_id IS NULL) <> (user_id IS NULL))
);
CREATE UNIQUE INDEX channel_role_override ON channel_overrides(channel_id,role_id) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX channel_user_override ON channel_overrides(channel_id,user_id) WHERE user_id IS NOT NULL;
CREATE FUNCTION channel_permission(channel uuid, actor uuid, base text[], capability text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT CASE WHEN r.is_owner THEN capability=ANY(base) ELSE COALESCE((uo.permissions->>capability)::boolean,(ro.permissions->>capability)::boolean,capability=ANY(base)) END
 FROM channels c JOIN workspace_members m ON m.workspace_id=c.workspace_id AND m.user_id=actor AND m.state='active'
 JOIN users u ON u.id=m.user_id AND NOT u.disabled JOIN roles r ON r.id=m.role_id
 LEFT JOIN channel_overrides ro ON ro.channel_id=c.id AND ro.role_id=m.role_id
 LEFT JOIN channel_overrides uo ON uo.channel_id=c.id AND uo.user_id=actor
 WHERE c.id=channel),
 (SELECT capability=ANY(base) AND capability=ANY(t.permissions) FROM technical_accounts t JOIN channels c ON c.workspace_id=t.workspace_id WHERE c.id=channel AND t.id=actor AND NOT t.revoked),false)
$$;
