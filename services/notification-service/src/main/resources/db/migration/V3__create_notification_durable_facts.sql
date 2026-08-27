ALTER TABLE notification_message
    ADD COLUMN notification_type VARCHAR(128) NOT NULL DEFAULT 'general',
    ADD COLUMN channel VARCHAR(16) NOT NULL DEFAULT 'IN_APP',
    ADD COLUMN template_version VARCHAR(40) NOT NULL DEFAULT 'v1',
    ADD COLUMN title VARCHAR(160) NOT NULL DEFAULT 'notification',
    ADD COLUMN safe_body VARCHAR(4000) NOT NULL DEFAULT 'notification',
    ADD COLUMN content_version VARCHAR(80) NOT NULL DEFAULT 'v1',
    ADD COLUMN locale VARCHAR(20) NOT NULL DEFAULT 'zh-CN',
    ADD COLUMN structured_attributes_json JSON NULL,
    ADD COLUMN not_before DATETIME(6) NULL,
    ADD COLUMN template_only BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN message_version BIGINT NOT NULL DEFAULT 1;

UPDATE notification_message
SET structured_attributes_json = JSON_OBJECT(),
    not_before = created_at
WHERE structured_attributes_json IS NULL OR not_before IS NULL;

ALTER TABLE notification_message
    MODIFY structured_attributes_json JSON NOT NULL,
    MODIFY not_before DATETIME(6) NOT NULL,
    MODIFY notification_id VARCHAR(160) NOT NULL;

ALTER TABLE notification_outbox_event
    ADD COLUMN aggregate_type VARCHAR(128) NOT NULL DEFAULT 'notification',
    ADD COLUMN tenant_id VARCHAR(128) NOT NULL DEFAULT 'unknown',
    ADD COLUMN principal_id VARCHAR(128) NOT NULL DEFAULT 'unknown',
    ADD COLUMN trace_id VARCHAR(128) NOT NULL DEFAULT 'unknown',
    ADD COLUMN request_id VARCHAR(128) NOT NULL DEFAULT 'unknown',
    ADD COLUMN occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    MODIFY event_id VARCHAR(160) NOT NULL;

CREATE TABLE IF NOT EXISTS notification_preference (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    notification_type VARCHAR(128) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    enabled BOOLEAN NOT NULL,
    locale VARCHAR(20) NOT NULL,
    version_no BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, notification_type, channel),
    KEY idx_notification_preference_owner (tenant_id, principal_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_delivery_attempt (
    attempt_id VARCHAR(160) NOT NULL,
    message_id VARCHAR(160) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    attempt_number INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_code VARCHAR(80) NULL,
    next_attempt_at DATETIME(6) NULL,
    request_id VARCHAR(128) NOT NULL,
    trace_id VARCHAR(128) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    retryable BOOLEAN NOT NULL,
    PRIMARY KEY (attempt_id),
    UNIQUE KEY uk_notification_delivery_attempt (message_id, attempt_number),
    KEY idx_notification_delivery_message (message_id, occurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_idempotency (
    scope_key VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    fingerprint VARCHAR(512) NOT NULL,
    value_type VARCHAR(64) NOT NULL,
    value_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (scope_key, idempotency_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_consent_fact (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    granted BOOLEAN NOT NULL,
    source VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, channel),
    UNIQUE KEY uk_notification_consent_idempotency (idempotency_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_audit_event (
    audit_id VARCHAR(160) NOT NULL,
    action VARCHAR(96) NOT NULL,
    outcome VARCHAR(48) NOT NULL,
    actor_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    request_id VARCHAR(128) NOT NULL,
    trace_id VARCHAR(128) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    attributes_json JSON NOT NULL,
    PRIMARY KEY (audit_id),
    KEY idx_notification_audit_owner (tenant_id, principal_id, occurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_trusted_event_receipt (
    consumer_name VARCHAR(128) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(128) NOT NULL,
    dedupe_key VARCHAR(255) NOT NULL,
    fingerprint VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    attempt INT NOT NULL,
    reason_code VARCHAR(100) NULL,
    message_id VARCHAR(160) NULL,
    workflow_task_id VARCHAR(160) NULL,
    first_seen_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (consumer_name, event_id),
    UNIQUE KEY uk_notification_trusted_dedupe (consumer_name, dedupe_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_workflow_task (
    task_id VARCHAR(160) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    action VARCHAR(96) NOT NULL,
    aggregate_type VARCHAR(96) NOT NULL,
    aggregate_id VARCHAR(160) NOT NULL,
    state VARCHAR(32) NOT NULL,
    attempt INT NOT NULL,
    max_attempts INT NOT NULL,
    reason_code VARCHAR(100) NULL,
    next_run_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (task_id),
    UNIQUE KEY uk_notification_workflow_aggregate (aggregate_type, aggregate_id),
    KEY idx_notification_workflow_due (state, next_run_at)
) ENGINE=InnoDB;
