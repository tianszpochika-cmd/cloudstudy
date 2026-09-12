-- P1R-M2-005 / ADR-0015: bring commerce_outbox_event to the standard event-runtime outbox shape.
-- Non-destructive: legacy columns keep their names and values; the canonical columns are added,
-- backfilled from the legacy column where one exists, then tightened, and the (status,
-- available_at) claim index is added for FOR UPDATE SKIP LOCKED claiming.
ALTER TABLE commerce_outbox_event ADD COLUMN event_name VARCHAR(128) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN dedupe_key VARCHAR(512) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN request_id VARCHAR(128) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN trace_id VARCHAR(128) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN locked_by VARCHAR(128) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN locked_until DATETIME(6) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN published_at DATETIME(6) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN last_error_code VARCHAR(64) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN last_error_message VARCHAR(255) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN occurred_at DATETIME(6) NULL;
ALTER TABLE commerce_outbox_event ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PENDING';
ALTER TABLE commerce_outbox_event ADD COLUMN attempt_count INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE commerce_outbox_event ADD COLUMN available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE commerce_outbox_event ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
CREATE INDEX idx_commerce_outbox_event_claim ON commerce_outbox_event (status, available_at);

-- Backfill before tightening to NOT NULL.
UPDATE commerce_outbox_event SET event_name = event_type WHERE event_name IS NULL;
UPDATE commerce_outbox_event SET event_name = 'legacy.unnamed.v1' WHERE event_name IS NULL;
ALTER TABLE commerce_outbox_event MODIFY COLUMN event_name VARCHAR(128) NOT NULL;
UPDATE commerce_outbox_event SET dedupe_key = SHA2(event_id, 256) WHERE dedupe_key IS NULL;
ALTER TABLE commerce_outbox_event MODIFY COLUMN dedupe_key VARCHAR(512) NOT NULL;
UPDATE commerce_outbox_event SET occurred_at = created_at WHERE occurred_at IS NULL;
UPDATE commerce_outbox_event SET occurred_at = UTC_TIMESTAMP(6) WHERE occurred_at IS NULL;
ALTER TABLE commerce_outbox_event MODIFY COLUMN occurred_at DATETIME(6) NOT NULL;
