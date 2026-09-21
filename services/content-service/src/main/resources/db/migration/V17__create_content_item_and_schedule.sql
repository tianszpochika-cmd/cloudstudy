-- B2 content production: row-level items, scheduled publish tasks, lexeme publish snapshots.
-- content_item carries identity/lifecycle/query columns; fields_json carries the
-- extensible item configuration (options, answer rules, explanations, media refs).
CREATE TABLE IF NOT EXISTS content_item (
    item_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL DEFAULT 'platform',
    pack_code VARCHAR(128) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    stem VARCHAR(2048) NOT NULL DEFAULT '',
    availability VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    state_version BIGINT NOT NULL DEFAULT 1,
    created_by VARCHAR(128) NOT NULL,
    updated_by VARCHAR(128) NULL,
    first_reviewer VARCHAR(128) NULL,
    final_reviewer VARCHAR(128) NULL,
    publisher VARCHAR(128) NULL,
    source_code VARCHAR(128) NULL,
    license_code VARCHAR(128) NULL,
    fields_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (item_id),
    KEY idx_content_item_pack (tenant_id, pack_code, availability, item_id),
    KEY idx_content_item_kind (tenant_id, kind, availability),
    CONSTRAINT chk_content_item_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_content_item_kind CHECK (kind IN ('QUESTION', 'EXAMPLE', 'GRAMMAR_POINT', 'PASSAGE', 'EXERCISE')),
    CONSTRAINT chk_content_item_availability CHECK (availability IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Content-owned scheduled publish tasks for PACK/LEXEME/ITEM targets.
-- Execution re-validates owner facts at run time; a stale pin fails the task
-- instead of publishing the wrong version.
CREATE TABLE IF NOT EXISTS scheduled_publish_task (
    task_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL DEFAULT 'platform',
    pack_code VARCHAR(128) NOT NULL,
    target_type VARCHAR(16) NOT NULL,
    target_ref VARCHAR(128) NOT NULL,
    expected_state_version BIGINT NULL,
    run_at DATETIME(6) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED',
    reason_code VARCHAR(96) NULL,
    failure_code VARCHAR(128) NULL,
    created_by VARCHAR(128) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (task_id),
    KEY idx_scheduled_publish_due (tenant_id, status, run_at),
    KEY idx_scheduled_publish_target (tenant_id, pack_code, target_type, target_ref),
    CONSTRAINT chk_scheduled_publish_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_scheduled_publish_target CHECK (target_type IN ('PACK', 'LEXEME', 'ITEM')),
    CONSTRAINT chk_scheduled_publish_status CHECK (status IN ('SCHEDULED', 'CANCELLED', 'EXECUTED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lexeme publish snapshot for version diff (draft fields vs last published).
ALTER TABLE lexeme
    ADD COLUMN published_fields_json JSON NULL AFTER fields_json;
