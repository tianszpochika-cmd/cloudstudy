-- B25 durable learning owner. Content identifiers are references; no content table is written here.

CREATE TABLE IF NOT EXISTS b25_learning_plan (
    plan_id CHAR(36) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    target_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
    plan_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (plan_id),
    UNIQUE KEY uk_b25_learning_plan_owner (tenant_id, principal_id),
    CONSTRAINT chk_b25_learning_plan_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_learning_srs_state (
    principal_id VARCHAR(128) NOT NULL,
    item_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    stage VARCHAR(24) NOT NULL DEFAULT 'NEW',
    due_at DATETIME(6) NOT NULL,
    interval_days INT UNSIGNED NOT NULL DEFAULT 0,
    ease_factor DECIMAL(5,2) NOT NULL DEFAULT 2.50,
    review_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_idempotency_key VARCHAR(192) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (principal_id, item_id),
    KEY idx_b25_learning_srs_due (tenant_id, principal_id, due_at),
    CONSTRAINT chk_b25_learning_srs_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learning_srs_stage CHECK (stage IN ('NEW', 'LEARNING', 'REVIEW', 'MASTERED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_learning_review (
    review_id CHAR(36) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    item_id VARCHAR(128) NOT NULL,
    quality TINYINT UNSIGNED NOT NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (review_id),
    UNIQUE KEY uk_b25_learning_review_idempotency (tenant_id, principal_id, idempotency_key),
    CONSTRAINT chk_b25_learning_review_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learning_review_quality CHECK (quality BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Durable application-service facts. These names are deliberately versioned so the v1
-- compatibility tables above are never mistaken for the v2 domain model.
CREATE TABLE IF NOT EXISTS learning_id_sequence (
    aggregate_type VARCHAR(64) NOT NULL,
    next_value BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (aggregate_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO learning_id_sequence (aggregate_type, next_value) VALUES
    ('learning_plan', 100000),
    ('learning_task', 200000),
    ('schedule_snapshot', 300000),
    ('srs_state', 400000),
    ('review_event', 500000)
ON DUPLICATE KEY UPDATE aggregate_type = VALUES(aggregate_type);

CREATE TABLE IF NOT EXISTS learning_runtime_plan (
    plan_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    goal_code VARCHAR(128) NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    content_epoch BIGINT UNSIGNED NOT NULL,
    time_zone_id VARCHAR(64) NOT NULL,
    daily_quota_minutes SMALLINT UNSIGNED NOT NULL,
    status VARCHAR(32) NOT NULL,
    plan_version BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (plan_id),
    UNIQUE KEY uk_learning_runtime_plan_key
        (tenant_id, principal_id, user_id, target_id, content_version_id, content_epoch),
    KEY idx_learning_runtime_plan_owner (tenant_id, principal_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_task (
    learning_task_id BIGINT UNSIGNED NOT NULL,
    learning_plan_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    content_item_id BIGINT UNSIGNED NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    planned_local_date DATE NOT NULL,
    task_status VARCHAR(32) NOT NULL,
    progress_percent SMALLINT UNSIGNED NOT NULL,
    completion_version BIGINT UNSIGNED NOT NULL,
    last_updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (learning_task_id),
    UNIQUE KEY uk_learning_runtime_task_owner (learning_plan_id, learning_task_id),
    KEY idx_learning_runtime_task_owner (tenant_id, principal_id, user_id, learning_plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_progress (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    task_id BIGINT UNSIGNED NOT NULL,
    completed_units INT UNSIGNED NOT NULL,
    total_units INT UNSIGNED NOT NULL,
    study_seconds BIGINT UNSIGNED NOT NULL,
    progress_version BIGINT UNSIGNED NOT NULL,
    last_activity_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, user_id, plan_id, task_id),
    KEY idx_learning_runtime_progress_owner (tenant_id, principal_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_srs_state (
    srs_state_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    stage VARCHAR(32) NOT NULL,
    easiness_factor DECIMAL(6,3) NOT NULL,
    repetitions INT UNSIGNED NOT NULL,
    interval_days INT UNSIGNED NOT NULL,
    lapse_count INT UNSIGNED NOT NULL,
    time_zone_id VARCHAR(64) NOT NULL,
    due_at DATETIME(6) NOT NULL,
    last_reviewed_at DATETIME(6) NULL,
    state_version BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (srs_state_id),
    UNIQUE KEY uk_learning_runtime_srs_owner_item
        (tenant_id, principal_id, user_id, item_type, item_id),
    KEY idx_learning_runtime_srs_due (tenant_id, principal_id, user_id, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_review_event (
    review_event_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    algorithm_version VARCHAR(64) NOT NULL,
    srs_state_id BIGINT UNSIGNED NOT NULL,
    state_version BIGINT UNSIGNED NOT NULL,
    raw_quality TINYINT UNSIGNED NOT NULL,
    effective_quality TINYINT UNSIGNED NOT NULL,
    confidence VARCHAR(32) NOT NULL,
    reviewed_at DATETIME(6) NOT NULL,
    client_event_id VARCHAR(192) NOT NULL,
    PRIMARY KEY (review_event_id),
    UNIQUE KEY uk_learning_runtime_review_event_client
        (tenant_id, principal_id, user_id, client_event_id),
    KEY idx_learning_runtime_review_owner (tenant_id, principal_id, user_id, reviewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_mastery_projection (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    stage VARCHAR(32) NOT NULL,
    score INT NOT NULL,
    attempt_count INT UNSIGNED NOT NULL,
    correct_count INT UNSIGNED NOT NULL,
    projection_version BIGINT UNSIGNED NOT NULL,
    verification_stage VARCHAR(32) NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    last_evidence_at DATETIME(6) NOT NULL,
    applied_evidence_ids_json JSON NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, user_id, item_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_review_queue_snapshot (
    schedule_snapshot_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    local_date DATE NOT NULL,
    time_zone_id VARCHAR(64) NOT NULL,
    rules_version VARCHAR(64) NOT NULL,
    item_count INT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (schedule_snapshot_id),
    KEY idx_learning_runtime_queue_owner (tenant_id, principal_id, user_id, local_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_review_queue_item (
    schedule_snapshot_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    item_order INT UNSIGNED NOT NULL,
    srs_state_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    due_at DATETIME(6) NOT NULL,
    PRIMARY KEY (schedule_snapshot_id, item_order),
    KEY idx_learning_runtime_queue_item_owner (tenant_id, principal_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_idempotency_record (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    operation VARCHAR(96) NOT NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    response_type VARCHAR(64) NOT NULL,
    response_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, user_id, operation, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_runtime_outbox_event (
    event_id CHAR(36) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    aggregate_type VARCHAR(96) NOT NULL,
    aggregate_id VARCHAR(160) NOT NULL,
    event_type VARCHAR(160) NOT NULL,
    schema_version VARCHAR(64) NOT NULL,
    event_version INT UNSIGNED NOT NULL,
    actor_id VARCHAR(128) NOT NULL,
    dedupe_key VARCHAR(255) NOT NULL,
    payload_json JSON NOT NULL,
    request_id VARCHAR(128) NOT NULL,
    trace_id VARCHAR(128) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    status VARCHAR(32) NOT NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    available_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_learning_runtime_outbox_dedupe (tenant_id, principal_id, user_id, dedupe_key),
    KEY idx_learning_runtime_outbox_dispatch (status, available_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
