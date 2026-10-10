-- V12: planning-input history is append-only. pin_version joins the primary
-- key so a later digest inserts a new row instead of rewriting the old one.
-- explanation_text is the sentence stored at insert time.

ALTER TABLE learning_plan_input_snapshot
    ADD COLUMN explanation_text VARCHAR(512) NOT NULL DEFAULT '' AFTER input_json;

ALTER TABLE learning_plan_input_snapshot
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (tenant_id, principal_id, target_id, content_version_id, pin_version);

CREATE TABLE IF NOT EXISTS learning_plan_replan_receipt (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    result_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, principal_id, idempotency_key),
    CONSTRAINT chk_plan_replan_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
