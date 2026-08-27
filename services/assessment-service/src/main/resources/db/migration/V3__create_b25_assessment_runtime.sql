-- Compatibility projection for the B25 assessment HTTP seam. The assessment owner keeps this
-- projection in its own schema; scoring remains server-side and content rules are read-only.

CREATE TABLE IF NOT EXISTS b25_assessment_item_rule (
    item_id VARCHAR(128) NOT NULL,
    content_code VARCHAR(128) NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    prompt VARCHAR(2048) NOT NULL,
    options_json JSON NOT NULL,
    dimension VARCHAR(32) NOT NULL DEFAULT 'VOCABULARY',
    difficulty TINYINT UNSIGNED NOT NULL DEFAULT 2,
    answer_rule_json JSON NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (item_id),
    KEY idx_b25_assessment_rule_content (content_code, content_version_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_assessment_session (
    session_id CHAR(36) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    content_code VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
    answers_json JSON NOT NULL,
    score DECIMAL(6,3) NULL,
    report_id CHAR(36) NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (session_id),
    UNIQUE KEY uk_b25_assessment_session_idempotency (tenant_id, principal_id, idempotency_key),
    KEY idx_b25_assessment_session_owner (tenant_id, principal_id, status, updated_at),
    CONSTRAINT chk_b25_assessment_session_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_assessment_session_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_assessment_report (
    report_id CHAR(36) NOT NULL,
    session_id CHAR(36) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    cefr_level VARCHAR(8) NOT NULL,
    score DECIMAL(6,3) NOT NULL,
    radar_json JSON NOT NULL,
    mistakes_json JSON NOT NULL,
    report_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (report_id),
    UNIQUE KEY uk_b25_assessment_report_session (session_id),
    KEY idx_b25_assessment_report_owner (tenant_id, principal_id, created_at),
    CONSTRAINT chk_b25_assessment_report_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_assessment_report_level CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_assessment_idempotency (
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    idempotency_key VARCHAR(192) NOT NULL,
    operation_code VARCHAR(96) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (principal_id, idempotency_key),
    CONSTRAINT chk_b25_assessment_idempotency_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
