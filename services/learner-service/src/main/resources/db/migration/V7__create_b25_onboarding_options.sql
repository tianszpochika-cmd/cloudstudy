-- B25 local onboarding reference options.  These are platform-owned reference
-- facts, kept in learner-service so the public onboarding contract has a
-- durable owner instead of falling back to the retired core-api constants.
CREATE TABLE IF NOT EXISTS b25_onboarding_option (
    option_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    option_type VARCHAR(32) NOT NULL,
    option_code VARCHAR(64) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description VARCHAR(512) NULL,
    numeric_value INT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (option_id),
    UNIQUE KEY uk_b25_onboarding_option (option_type, option_code),
    KEY idx_b25_onboarding_option_type (option_type, enabled, display_order),
    CONSTRAINT chk_b25_onboarding_option_type CHECK (option_type IN ('LANGUAGE', 'GOAL', 'EXAM', 'QUOTA', 'ACCENT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
