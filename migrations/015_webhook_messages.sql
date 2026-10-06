-- migrations/015_webhook_messages.sql
ALTER TABLE messages ADD COLUMN rich_content jsonb;
ALTER TABLE webhook_deliveries ADD COLUMN outbound_id uuid REFERENCES outbound_webhooks(id);
ALTER TABLE webhook_deliveries ADD COLUMN http_status integer CHECK(http_status BETWEEN 100 AND 599);
ALTER TABLE webhook_deliveries ADD COLUMN last_attempt_at timestamptz;
ALTER TABLE webhook_deliveries ADD COLUMN sent_at timestamptz;
-- Only an unambiguous destination is attached to old queue records.
UPDATE webhook_deliveries d SET outbound_id=(SELECT min(o.id::text)::uuid FROM outbound_webhooks o WHERE o.workspace_id=d.workspace_id AND o.url=d.url AND o.secret=d.secret HAVING count(*)=1);
CREATE TABLE webhook_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), webhook_id uuid NOT NULL REFERENCES webhooks(id), workspace_id uuid NOT NULL REFERENCES workspaces(id),
 http_status integer NOT NULL, mode text NOT NULL DEFAULT 'TEXT', is_test boolean NOT NULL DEFAULT false,
 event_id uuid, error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_receipts_history ON webhook_receipts(webhook_id,created_at DESC);
