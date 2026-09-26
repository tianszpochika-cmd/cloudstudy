-- The receipt claim, media asset/rendition mutation and outbox append use one
-- JDBC owner transaction. A nullable response exists only inside an uncommitted claim.
-- Preserve exact matching for the pre-existing registration receipt as well;
-- otherwise its case-insensitive key could alias two distinct V7 binary keys.
ALTER TABLE media_idempotency_record
    MODIFY tenant_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    MODIFY subject_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    MODIFY idempotency_key VARCHAR(128) COLLATE utf8mb4_bin NOT NULL;

CREATE TABLE media_write_idempotency_record (
    tenant_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    subject_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    operation_name VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
    idempotency_key VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    response_json LONGTEXT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, subject_id, operation_name, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
