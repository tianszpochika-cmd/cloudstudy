-- Local-real durability for the gamification aggregate.  These tables belong
-- exclusively to gamification_service; no learner or IAM table is joined here.

CREATE TABLE IF NOT EXISTS coin_ledger (
    ledger_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    source_event_id CHAR(36) NOT NULL,
    delta INT NOT NULL,
    balance_after BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (ledger_id),
    UNIQUE KEY uk_coin_source_event (source_event_id),
    KEY idx_coin_subject (tenant_id, subject_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_event_record (
    event_id VARCHAR(200) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    response_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id),
    KEY idx_gam_event_subject (subject_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_idempotency_record (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    subject_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    response_type VARCHAR(96) NOT NULL,
    response_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_gam_idempotency (subject_id, idempotency_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_active_date (
    subject_id VARCHAR(128) NOT NULL,
    active_date DATE NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (subject_id, active_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_season_fact (
    season_id VARCHAR(128) NOT NULL,
    event_id VARCHAR(200) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    points BIGINT NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    PRIMARY KEY (subject_id, event_id),
    KEY idx_gam_season_subject (subject_id, season_id, occurred_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_user_timezone (
    subject_id VARCHAR(128) NOT NULL,
    time_zone VARCHAR(64) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (subject_id)
) ENGINE=InnoDB;

ALTER TABLE reward_grant
    ADD COLUMN source_event_id VARCHAR(200) NULL AFTER subject_id,
    ADD COLUMN outcome_code VARCHAR(128) NULL AFTER claim_status,
    ADD COLUMN claimed_at DATETIME(6) NULL AFTER outcome_code;

CREATE INDEX idx_reward_subject_created
    ON reward_grant (tenant_id, subject_id, created_at);
