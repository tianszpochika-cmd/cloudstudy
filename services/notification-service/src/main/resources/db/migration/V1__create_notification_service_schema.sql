CREATE TABLE IF NOT EXISTS notification_message (
    notification_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    template_key VARCHAR(160) NOT NULL,
    notification_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (notification_id),
    UNIQUE KEY uk_notification_idempotency (tenant_id, idempotency_key),
    KEY idx_notification_subject (tenant_id, subject_id, notification_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS offline_sync_cursor (
    cursor_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    client_seq BIGINT NOT NULL,
    cursor_version BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (cursor_id),
    UNIQUE KEY uk_offline_cursor_device (tenant_id, subject_id, device_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_outbox_event (
    event_id CHAR(36) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(160) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    dedupe_key VARCHAR(256) NOT NULL,
    payload_json JSON NOT NULL,
    status VARCHAR(24) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    available_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_notification_outbox_dedupe (dedupe_key),
    KEY idx_notification_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
