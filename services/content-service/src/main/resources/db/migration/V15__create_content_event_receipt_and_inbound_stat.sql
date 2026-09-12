-- P1R-M2-005 / ADR-0015: consumer-side idempotency records for content-service.
--
-- The event runtime contract requires deduplication keyed on (consumerGroup, eventId) with the
-- effect and the deduplication record written in the same transaction, and it forbids a duplicate
-- effect. The B-line receipt tables (analytics_event_receipt, notification_trusted_event_receipt)
-- carry event_id but no consumer_group, so the same event arriving for two different consumer
-- groups collides there; the contract's unique key is therefore not satisfiable by them.
--
-- content_event_receipt is the deduplication record. content_inbound_event_stat is a real, owned
-- effect applied in the same transaction: it counts applied events per consumer group and event
-- name. A duplicate delivery finds the receipt already present, so the insert conflicts and the
-- whole transaction rolls back, leaving the counter untouched. That makes "the effect did not run
-- twice" directly observable rather than merely asserted.

CREATE TABLE IF NOT EXISTS content_event_receipt (
    consumer_group  VARCHAR(96)  NOT NULL,
    event_id        CHAR(36)     NOT NULL,
    event_name      VARCHAR(160) NOT NULL,
    schema_version  VARCHAR(32)  NOT NULL,
    dedupe_key      VARCHAR(256) NOT NULL,
    payload_hash    CHAR(64)     NOT NULL,
    receipt_state   VARCHAR(24)  NOT NULL DEFAULT 'APPLIED',
    received_at     DATETIME(6)  NOT NULL,
    PRIMARY KEY (consumer_group, event_id),
    KEY idx_content_event_receipt_dedupe (dedupe_key),
    KEY idx_content_event_receipt_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_inbound_event_stat (
    consumer_group  VARCHAR(96)  NOT NULL,
    event_name      VARCHAR(160) NOT NULL,
    applied_count   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    first_applied_at DATETIME(6) NOT NULL,
    last_applied_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (consumer_group, event_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
