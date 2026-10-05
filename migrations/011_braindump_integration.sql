-- migrations/011_braindump_integration.sql
ALTER TABLE braindump_connections ADD COLUMN integration_id uuid REFERENCES integrations(id);
ALTER TABLE integration_attempts ADD COLUMN session_id text REFERENCES user_sessions(id) ON DELETE CASCADE;
CREATE INDEX braindump_connection_integration ON braindump_connections(integration_id);
