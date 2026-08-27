-- Completes the content-service-owned fact/read schema after the minimal V1 ledger.
-- Legacy rows that cannot be rehydrated (missing payload/hash/identity facts) are rejected by the
-- JDBC adapter; this migration never invents content values for them.

CREATE TABLE IF NOT EXISTS content_definition (
    content_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    content_code VARCHAR(128) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    locale VARCHAR(64) NOT NULL,
    target_level VARCHAR(64) NOT NULL,
    goal_code VARCHAR(128) NOT NULL,
    created_by VARCHAR(128) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    current_published_version_id BIGINT NULL,
    content_epoch BIGINT NOT NULL DEFAULT 0,
    projection_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (content_id),
    UNIQUE KEY uk_content_definition_code (tenant_id, content_code),
    KEY idx_content_definition_published (current_published_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE content_version
    MODIFY copyright_status VARCHAR(32) NULL,
    ADD COLUMN kind VARCHAR(32) NULL AFTER version_no,
    ADD COLUMN payload_json JSON NULL AFTER kind,
    ADD COLUMN rights_source_code VARCHAR(128) NULL AFTER payload_hash,
    ADD COLUMN rights_license_code VARCHAR(128) NULL AFTER rights_source_code,
    ADD COLUMN rights_allows_learning BOOLEAN NULL AFTER rights_license_code,
    ADD COLUMN rights_permitted_channels JSON NULL AFTER rights_allows_learning,
    ADD COLUMN rights_starts_at DATETIME(6) NULL AFTER rights_permitted_channels,
    ADD COLUMN rights_expires_at DATETIME(6) NULL AFTER rights_starts_at,
    ADD COLUMN authorization_evidence_ref VARCHAR(128) NULL AFTER rights_expires_at,
    ADD COLUMN editor VARCHAR(128) NULL AFTER authorization_evidence_ref,
    ADD COLUMN release_note VARCHAR(255) NULL AFTER editor,
    ADD COLUMN first_reviewer VARCHAR(128) NULL AFTER release_note,
    ADD COLUMN final_reviewer VARCHAR(128) NULL AFTER first_reviewer,
    ADD COLUMN publisher VARCHAR(128) NULL AFTER final_reviewer,
    ADD COLUMN archived_at DATETIME(6) NULL AFTER published_at,
    ADD COLUMN rollback_of_version_id BIGINT NULL AFTER archived_at,
    ADD COLUMN first_review_version INT NULL AFTER rollback_of_version_id,
    ADD COLUMN final_review_version INT NULL AFTER first_review_version,
    ADD COLUMN state_version BIGINT NULL AFTER final_review_version,
    ADD KEY idx_content_published_rights
        (content_id, status, copyright_status, published_at, rights_expires_at);

ALTER TABLE content_outbox_event
    ADD COLUMN owner_domain VARCHAR(128) NULL AFTER event_id,
    ADD COLUMN aggregate_type VARCHAR(64) NULL AFTER owner_domain,
    ADD COLUMN event_version INT NULL AFTER schema_version,
    ADD COLUMN actor_id VARCHAR(128) NULL AFTER event_version,
    ADD COLUMN request_id VARCHAR(128) NULL AFTER payload_json,
    ADD COLUMN trace_id VARCHAR(128) NULL AFTER request_id,
    ADD COLUMN occurred_at DATETIME(6) NULL AFTER trace_id;

CREATE TABLE IF NOT EXISTS content_public_projection (
    content_id VARCHAR(128) NOT NULL,
    content_version_id BIGINT NOT NULL,
    audience VARCHAR(16) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    locale VARCHAR(64) NOT NULL,
    target_level VARCHAR(64) NOT NULL,
    goal_code VARCHAR(128) NOT NULL,
    fields_json JSON NOT NULL,
    content_hash CHAR(64) NOT NULL,
    generated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (content_id, content_version_id, audience),
    KEY idx_content_projection_read (content_id, audience, content_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_idempotency_record (
    scope VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL,
    response_json JSON NULL,
    recorded_at DATETIME(6) NOT NULL,
    PRIMARY KEY (scope, idempotency_key),
    KEY idx_content_idempotency_status (status, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_cache_invalidation (
    content_id VARCHAR(128) NOT NULL,
    content_version_id BIGINT NOT NULL,
    reason VARCHAR(64) NOT NULL,
    invalidated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (content_id, content_version_id, reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
