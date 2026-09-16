-- migrations/004_integrations.sql
ALTER TABLE integrations ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE integrations ADD COLUMN enabled boolean NOT NULL DEFAULT true;
ALTER TABLE integrations ADD COLUMN last_checked_at timestamptz;
ALTER TABLE integrations ADD COLUMN last_error text;
ALTER TABLE webhooks ADD COLUMN integration_id uuid REFERENCES integrations(id);
ALTER TABLE webhooks ADD COLUMN hmac_secret text;
ALTER TABLE webhooks ADD COLUMN signature_mode text NOT NULL DEFAULT 'none' CHECK(signature_mode IN ('none','liora','github'));
ALTER TABLE outbound_webhooks ADD COLUMN event_types text[] NOT NULL DEFAULT '{}';
CREATE TABLE integration_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id), integration_id uuid NOT NULL REFERENCES integrations(id), name text NOT NULL, event_pattern text NOT NULL, severity text NOT NULL DEFAULT '', channel_id uuid NOT NULL, column_id uuid, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(channel_id,workspace_id) REFERENCES channels(id,workspace_id), FOREIGN KEY(column_id,workspace_id) REFERENCES board_columns(id,workspace_id));
CREATE TABLE integration_attempts (id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), integration_id uuid NOT NULL REFERENCES integrations(id), revision integer NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes');
CREATE TABLE integration_grants (integration_id uuid NOT NULL REFERENCES integrations(id), user_id uuid NOT NULL REFERENCES users(id), subject text NOT NULL, tokens text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(integration_id,user_id));
CREATE INDEX integration_rules_connection ON integration_rules(integration_id);
