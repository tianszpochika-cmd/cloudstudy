-- B36 local real-data gate: the learner's continue checkpoint is owned by
-- learning-service and remains scoped to the verified principal.
CREATE TABLE IF NOT EXISTS b25_learning_continue_context (
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    principal_id VARCHAR(128) NOT NULL,
    module_id VARCHAR(128) NOT NULL,
    module_label VARCHAR(255) NOT NULL,
    lesson_id VARCHAR(128) NOT NULL,
    lesson_title VARCHAR(255) NOT NULL,
    step_index INT UNSIGNED NOT NULL DEFAULT 1,
    total_steps INT UNSIGNED NOT NULL DEFAULT 1,
    elapsed_time_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    last_idempotency_key VARCHAR(192) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, principal_id),
    CONSTRAINT chk_b25_continue_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_continue_status CHECK (status IN ('ACTIVE', 'EXPIRED')),
    CONSTRAINT chk_b25_continue_steps CHECK (step_index <= total_steps)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
