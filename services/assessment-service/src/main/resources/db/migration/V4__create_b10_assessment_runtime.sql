-- B10 canonical assessment runtime.  The public API uses immutable content pins,
-- attempt submissions and attempt-scoped checkpoints; no client answer is used as
-- a grading rule and no cross-service table is written here.

CREATE TABLE IF NOT EXISTS b10_assessment_session (
    session_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    mode VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
    content_code VARCHAR(128) NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    content_epoch BIGINT UNSIGNED NOT NULL DEFAULT 1,
    snapshot_id BIGINT UNSIGNED NOT NULL,
    snapshot_hash CHAR(64) NOT NULL,
    items_json JSON NOT NULL,
    answers_json JSON NOT NULL,
    state_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_attempt_id VARCHAR(128) NULL,
    last_report_id VARCHAR(128) NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (session_id),
    UNIQUE KEY uk_b10_session_idempotency (tenant_id, principal_id, idempotency_key),
    KEY idx_b10_session_owner (tenant_id, principal_id, status, updated_at),
    CONSTRAINT chk_b10_session_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b10_session_mode CHECK (mode IN ('PRACTICE', 'REVIEW', 'PLACEMENT', 'MOCK')),
    CONSTRAINT chk_b10_session_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'ASSESSED', 'EXPIRED', 'CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b10_assessment_attempt (
    attempt_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    attempt_version INT UNSIGNED NOT NULL,
    submission_id VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL,
    item_count INT UNSIGNED NOT NULL,
    submission_digest CHAR(64) NOT NULL,
    score_bucket VARCHAR(24) NOT NULL DEFAULT 'UNASSESSED',
    mistake_codes_json JSON NOT NULL,
    report_id VARCHAR(128) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (attempt_id),
    UNIQUE KEY uk_b10_attempt_submission (session_id, submission_id),
    KEY idx_b10_attempt_owner (tenant_id, principal_id, created_at),
    CONSTRAINT chk_b10_attempt_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b10_attempt_status CHECK (status IN ('ACCEPTED', 'ASSESSING', 'ASSESSED', 'REJECTED', 'COMPENSATED')),
    CONSTRAINT chk_b10_attempt_score CHECK (score_bucket IN ('UNASSESSED', 'ZERO', 'PARTIAL', 'FULL', 'PENDING_REVIEW'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b10_assessment_checkpoint (
    attempt_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    checkpoint_version BIGINT UNSIGNED NOT NULL,
    item_cursor INT UNSIGNED NOT NULL,
    completed_item_ids_json JSON NOT NULL,
    checkpoint_digest CHAR(64) NOT NULL,
    saved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (attempt_id, checkpoint_version),
    KEY idx_b10_checkpoint_owner (tenant_id, principal_id, saved_at),
    CONSTRAINT chk_b10_checkpoint_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b10_assessment_report (
    report_id VARCHAR(128) NOT NULL,
    attempt_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    report_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    status VARCHAR(24) NOT NULL DEFAULT 'READY',
    score_bucket VARCHAR(24) NOT NULL,
    mistake_codes_json JSON NOT NULL,
    mastery_signal VARCHAR(24) NOT NULL DEFAULT 'NO_SIGNAL',
    pin_json JSON NOT NULL,
    generated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (report_id),
    UNIQUE KEY uk_b10_report_attempt (attempt_id),
    KEY idx_b10_report_owner (tenant_id, principal_id, generated_at),
    CONSTRAINT chk_b10_report_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b10_report_status CHECK (status IN ('READY', 'PARTIAL', 'FAILED', 'COMPENSATED')),
    CONSTRAINT chk_b10_report_score CHECK (score_bucket IN ('ZERO', 'PARTIAL', 'FULL', 'PENDING_REVIEW')),
    CONSTRAINT chk_b10_report_mastery CHECK (mastery_signal IN ('NO_SIGNAL', 'WEAK', 'STABLE', 'MASTERED', 'RETRY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
