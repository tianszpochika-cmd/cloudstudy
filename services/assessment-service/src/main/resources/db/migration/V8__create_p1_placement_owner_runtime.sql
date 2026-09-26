-- Dedicated canonical P1 placement facts. B25 and general B10 attempts do not
-- share these rows or act as substitutes for the ten-item placement manifest.
CREATE TABLE p1_placement_session (
    session_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    state_version BIGINT UNSIGNED NOT NULL,
    current_sequence TINYINT UNSIGNED NOT NULL,
    session_snapshot_digest CHAR(64) NOT NULL,
    manifest_json JSON NOT NULL,
    content_pin_json JSON NOT NULL,
    answer_rule_pin_json JSON NOT NULL,
    target_pin_json JSON NOT NULL,
    learner_items_json JSON NOT NULL,
    sealed_items_json JSON NOT NULL,
    started_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (session_id),
    KEY idx_p1_placement_owner (tenant_id, principal_id, updated_at),
    CONSTRAINT chk_p1_placement_session_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_p1_placement_session_status CHECK (status IN ('CREATED', 'IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT chk_p1_placement_session_cursor CHECK (current_sequence BETWEEN 1 AND 11)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE p1_placement_response (
    session_id VARCHAR(128) NOT NULL,
    item_sequence TINYINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    response_digest CHAR(64) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    correct BOOLEAN NOT NULL,
    time_spent_sec SMALLINT UNSIGNED NOT NULL,
    accepted_at DATETIME(6) NOT NULL,
    PRIMARY KEY (session_id, item_sequence),
    CONSTRAINT chk_p1_placement_response_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_p1_placement_response_sequence CHECK (item_sequence BETWEEN 1 AND 10),
    CONSTRAINT chk_p1_placement_response_time CHECK (time_spent_sec BETWEEN 0 AND 3600)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE p1_placement_checkpoint (
    session_id VARCHAR(128) NOT NULL,
    state_version BIGINT UNSIGNED NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    next_sequence TINYINT UNSIGNED NOT NULL,
    checkpoint_digest CHAR(64) NOT NULL,
    saved_at DATETIME(6) NOT NULL,
    PRIMARY KEY (session_id, state_version),
    CONSTRAINT chk_p1_placement_checkpoint_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_p1_placement_checkpoint_cursor CHECK (next_sequence BETWEEN 2 AND 11)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE p1_placement_result (
    placement_result_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    report_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    result_kind VARCHAR(16) NOT NULL,
    result_json JSON NOT NULL,
    report_json JSON NOT NULL,
    completed_at DATETIME(6) NOT NULL,
    PRIMARY KEY (placement_result_id),
    UNIQUE KEY uk_p1_placement_result_session (session_id),
    UNIQUE KEY uk_p1_placement_result_report (report_id),
    CONSTRAINT chk_p1_placement_result_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_p1_placement_result_kind CHECK (result_kind IN ('ASSESSED', 'SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE p1_placement_idempotency (
    tenant_id VARCHAR(64) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    operation VARCHAR(24) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    response_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, idempotency_key),
    CONSTRAINT chk_p1_placement_idempotency_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_p1_placement_idempotency_operation CHECK (operation IN ('CREATE', 'RESPONSE', 'SKIP'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
