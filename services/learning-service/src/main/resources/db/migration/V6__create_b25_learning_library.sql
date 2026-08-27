-- Learner-owned vocabulary collection facts.  Content-service remains the
-- source of vocabulary bodies; this table only records the learner's choice.
CREATE TABLE IF NOT EXISTS b25_learning_library_entry (
    entry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    item_type VARCHAR(24) NOT NULL,
    item_id VARCHAR(128) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    collection_status VARCHAR(24) NOT NULL DEFAULT 'SAVED',
    idempotency_key VARCHAR(192) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (entry_id),
    UNIQUE KEY uk_b25_learning_library_item (tenant_id, principal_id, item_type, item_id),
    UNIQUE KEY uk_b25_learning_library_idempotency (tenant_id, principal_id, idempotency_key),
    KEY idx_b25_learning_library_owner (tenant_id, principal_id, collection_status, updated_at),
    CONSTRAINT chk_b25_learning_library_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learning_library_item_type CHECK (item_type IN ('VOCAB', 'CHUNK', 'EXPRESSION')),
    CONSTRAINT chk_b25_learning_library_status CHECK (collection_status IN ('NEW_WORD', 'SAVED', 'MASTERED', 'REMOVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
