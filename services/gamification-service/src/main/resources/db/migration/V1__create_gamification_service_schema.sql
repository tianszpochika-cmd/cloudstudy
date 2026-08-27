CREATE TABLE IF NOT EXISTS xp_ledger (
    ledger_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    source_event_id CHAR(36) NOT NULL,
    delta INT NOT NULL,
    balance_after BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (ledger_id),
    UNIQUE KEY uk_xp_source_event (source_event_id),
    KEY idx_xp_subject (tenant_id, subject_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reward_grant (
    grant_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    reward_key VARCHAR(128) NOT NULL,
    probability_version VARCHAR(64) NOT NULL,
    claim_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (grant_id),
    UNIQUE KEY uk_reward_idempotency (tenant_id, idempotency_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_outbox_event (
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
    UNIQUE KEY uk_gamification_outbox_dedupe (dedupe_key),
    KEY idx_gamification_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
