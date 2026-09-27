-- V10: immutable planning-input snapshots for the plan wiring.
-- Assembled once by learning-service at plans:ensure from the verified
-- placement report, active target, profile/preferences and bank pins; served
-- verbatim to learner home for READY. Natural key replays regenerate the
-- identical snapshot (idempotent); history is never rewritten.
CREATE TABLE IF NOT EXISTS learning_plan_input_snapshot (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    content_epoch BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    pin_id VARCHAR(128) NOT NULL,
    pin_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    pin_digest CHAR(64) NOT NULL,
    input_fact_watermark CHAR(64) NOT NULL,
    input_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, principal_id, target_id, content_version_id),
    KEY idx_plan_input_plan (plan_id),
    CONSTRAINT chk_plan_input_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
