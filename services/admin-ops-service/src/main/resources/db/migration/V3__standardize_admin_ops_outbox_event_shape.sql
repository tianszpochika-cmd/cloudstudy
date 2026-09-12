-- P1R-M2-005 / ADR-0015: bring admin_ops_outbox_event to the standard event-runtime outbox shape.
-- Non-destructive: legacy columns keep their names and values; the canonical columns are added,
-- backfilled from the legacy column where one exists, then tightened, and the (status,
-- available_at) claim index is added for FOR UPDATE SKIP LOCKED claiming.
ALTER TABLE admin_ops_outbox_event ADD COLUMN request_id VARCHAR(128) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN trace_id VARCHAR(128) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN locked_by VARCHAR(128) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN locked_until DATETIME(6) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN published_at DATETIME(6) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN last_error_code VARCHAR(64) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN last_error_message VARCHAR(255) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN occurred_at DATETIME(6) NULL;
ALTER TABLE admin_ops_outbox_event ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
CREATE INDEX idx_admin_ops_outbox_event_claim ON admin_ops_outbox_event (status, available_at);

-- Backfill before tightening to NOT NULL.
UPDATE admin_ops_outbox_event SET occurred_at = created_at WHERE occurred_at IS NULL;
UPDATE admin_ops_outbox_event SET occurred_at = UTC_TIMESTAMP(6) WHERE occurred_at IS NULL;
ALTER TABLE admin_ops_outbox_event MODIFY COLUMN occurred_at DATETIME(6) NOT NULL;
