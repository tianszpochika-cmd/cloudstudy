CREATE TABLE IF NOT EXISTS assessment_attempt (
    attempt_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    assessment_version BIGINT NOT NULL,
    attempt_status VARCHAR(32) NOT NULL,
    answer_digest CHAR(64) NOT NULL,
    score_bucket VARCHAR(32) NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (attempt_id),
    UNIQUE KEY uk_assessment_attempt_idempotency (tenant_id, idempotency_key),
    KEY idx_assessment_subject (tenant_id, subject_id, attempt_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_checkpoint (
    checkpoint_id CHAR(36) NOT NULL,
    attempt_id CHAR(36) NOT NULL,
    checkpoint_seq BIGINT NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (checkpoint_id),
    UNIQUE KEY uk_assessment_checkpoint_seq (attempt_id, checkpoint_seq)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_outbox_event (
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
    UNIQUE KEY uk_assessment_outbox_dedupe (dedupe_key),
    KEY idx_assessment_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
