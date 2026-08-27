-- Durable local-real records owned by admin-ops. These tables contain only opaque references,
-- command intent metadata and redacted audit context; they never copy another service's facts.
ALTER TABLE support_ticket
    ADD COLUMN category VARCHAR(48) NOT NULL DEFAULT 'TECHNICAL',
    ADD COLUMN resource_ref VARCHAR(160) NOT NULL DEFAULT 'local-fixture',
    ADD COLUMN description_fingerprint CHAR(64) NOT NULL DEFAULT
        '0000000000000000000000000000000000000000000000000000000000000000',
    ADD COLUMN sla_due_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN assignee_subject VARCHAR(128) NULL,
    ADD COLUMN last_audit_id VARCHAR(128) NULL,
    ADD COLUMN ticket_version BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN attachments_json JSON NOT NULL;

CREATE TABLE admin_audit_record (
    sequence_id BIGINT NOT NULL AUTO_INCREMENT,
    audit_id VARCHAR(128) NOT NULL,
    tenant_ref VARCHAR(128) NOT NULL,
    actor_ref VARCHAR(128) NOT NULL,
    operation VARCHAR(128) NOT NULL,
    resource_ref VARCHAR(256) NOT NULL,
    command_id VARCHAR(128) NULL,
    trace_id VARCHAR(160) NOT NULL,
    decision_id VARCHAR(128) NOT NULL,
    safe_context JSON NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    previous_hash CHAR(64) NULL,
    record_hash CHAR(64) NOT NULL,
    PRIMARY KEY (sequence_id),
    UNIQUE KEY uk_admin_audit_id (audit_id),
    KEY idx_admin_audit_tenant_time (tenant_ref, occurred_at)
) ENGINE=InnoDB;

CREATE TABLE admin_idempotency (
    scope_hash CHAR(64) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    fingerprint VARCHAR(512) NOT NULL,
    result_type VARCHAR(64) NOT NULL,
    result_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (scope_hash, key_hash),
    KEY idx_admin_idempotency_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE admin_media_authorization (
    tenant_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    object_ref VARCHAR(160) NOT NULL,
    object_version VARCHAR(160) NOT NULL,
    purpose_code VARCHAR(160) NOT NULL,
    granted_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, subject_id, object_ref, object_version),
    KEY idx_admin_media_auth_purpose (tenant_id, subject_id, purpose_code)
) ENGINE=InnoDB;

CREATE TABLE admin_review_state (
    tenant_id VARCHAR(128) NOT NULL,
    domain_name VARCHAR(64) NOT NULL,
    resource_ref VARCHAR(256) NOT NULL,
    projection_version VARCHAR(160) NOT NULL,
    first_reviewer_subject VARCHAR(128) NULL,
    final_reviewer_subject VARCHAR(128) NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, domain_name, resource_ref, projection_version)
) ENGINE=InnoDB;
