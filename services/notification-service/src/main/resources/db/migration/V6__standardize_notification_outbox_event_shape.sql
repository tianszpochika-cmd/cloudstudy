-- P1R-M2-005 / ADR-0015: bring notification_outbox_event to the standard event-runtime outbox shape.
-- Non-destructive: legacy columns keep their names and values; the canonical columns are added,
-- backfilled from the legacy column where one exists, then tightened, and the (status,
-- available_at) claim index is added for FOR UPDATE SKIP LOCKED claiming.
ALTER TABLE notification_outbox_event ADD COLUMN locked_by VARCHAR(128) NULL;
ALTER TABLE notification_outbox_event ADD COLUMN locked_until DATETIME(6) NULL;
ALTER TABLE notification_outbox_event ADD COLUMN published_at DATETIME(6) NULL;
ALTER TABLE notification_outbox_event ADD COLUMN last_error_code VARCHAR(64) NULL;
ALTER TABLE notification_outbox_event ADD COLUMN last_error_message VARCHAR(255) NULL;
ALTER TABLE notification_outbox_event ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
CREATE INDEX idx_notification_outbox_event_claim ON notification_outbox_event (status, available_at);
