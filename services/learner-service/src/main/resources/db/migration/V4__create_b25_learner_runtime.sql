-- B25 local Phase 1 compatibility facts owned by learner-service.
-- This migration is additive and intentionally contains no fixture rows.

CREATE TABLE IF NOT EXISTS b25_learner_profile (
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    status VARCHAR(24) NOT NULL DEFAULT 'ONBOARDING',
    birth_year SMALLINT UNSIGNED NULL,
    age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
    terms_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    theme_mode VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
    state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (principal_id),
    KEY idx_b25_learner_profile_scope (tenant_id, status, updated_at),
    CONSTRAINT chk_b25_learner_profile_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learner_profile_status CHECK (status IN ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_learner_goal (
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    goal_code VARCHAR(96) NOT NULL,
    target_level VARCHAR(8) NOT NULL,
    daily_quota_minutes SMALLINT UNSIGNED NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    idempotency_key VARCHAR(192) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (principal_id),
    UNIQUE KEY uk_b25_learner_goal_idempotency (tenant_id, idempotency_key),
    CONSTRAINT chk_b25_learner_goal_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learner_goal_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    CONSTRAINT chk_b25_learner_goal_minutes CHECK (daily_quota_minutes IN (5, 15, 30, 45, 60))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_learner_preferences (
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    theme_mode VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
    high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
    motion_mode VARCHAR(16) NOT NULL DEFAULT 'FULL',
    idempotency_key VARCHAR(192) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (principal_id),
    UNIQUE KEY uk_b25_learner_preferences_idempotency (tenant_id, idempotency_key),
    CONSTRAINT chk_b25_learner_preferences_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learner_preferences_theme CHECK (theme_mode IN ('LIGHT', 'DARK', 'SYSTEM', 'HIGH_CONTRAST')),
    CONSTRAINT chk_b25_learner_preferences_motion CHECK (motion_mode IN ('FULL', 'REDUCED', 'OFF'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_learner_daily_task (
    task_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    content_code VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    task_type VARCHAR(24) NOT NULL DEFAULT 'LESSON',
    minutes SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    task_status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
    task_order INT UNSIGNED NOT NULL DEFAULT 0,
    idempotency_key VARCHAR(192) NOT NULL,
    completed_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (task_id),
    UNIQUE KEY uk_b25_learner_task_owner_content (principal_id, content_code),
    UNIQUE KEY uk_b25_learner_task_idempotency (tenant_id, idempotency_key),
    KEY idx_b25_learner_task_owner (tenant_id, principal_id, task_status, task_order),
    CONSTRAINT chk_b25_learner_task_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learner_task_status CHECK (task_status IN ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
