CREATE TABLE IF NOT EXISTS learning_plan (
    learning_plan_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    plan_version BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (learning_plan_id),
    KEY idx_learning_plan_subject (tenant_id, subject_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS learning_task (
    learning_task_id CHAR(36) NOT NULL,
    learning_plan_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    content_id VARCHAR(128) NOT NULL,
    content_version BIGINT NOT NULL,
    task_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (learning_task_id),
    UNIQUE KEY uk_learning_task_idempotency (tenant_id, idempotency_key),
    KEY idx_learning_task_subject (subject_id, task_status, content_version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mastery_projection (
    projection_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    item_id VARCHAR(128) NOT NULL,
    source_assessment_event_id CHAR(36) NOT NULL,
    projection_version BIGINT NOT NULL,
    mastery_signal VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (projection_id),
    UNIQUE KEY uk_mastery_source_event (source_assessment_event_id),
    KEY idx_mastery_subject_item (subject_id, item_id, projection_version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS learning_outbox_event (
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
    UNIQUE KEY uk_learning_outbox_dedupe (dedupe_key),
    KEY idx_learning_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
