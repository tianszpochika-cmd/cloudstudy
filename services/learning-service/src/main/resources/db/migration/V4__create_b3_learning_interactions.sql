-- B3 learner actions are durable facts owned by learning-service. The payload is
-- retained for replay/audit; content-service remains the content owner.
CREATE TABLE IF NOT EXISTS b3_learning_interaction (
    interaction_id CHAR(36) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    principal_id VARCHAR(128) NOT NULL,
    domain_code VARCHAR(32) NOT NULL,
    action_code VARCHAR(64) NOT NULL,
    resource_key VARCHAR(192) NOT NULL,
    idempotency_key VARCHAR(192) NOT NULL,
    payload_json JSON NOT NULL,
    result_json JSON NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACCEPTED',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (interaction_id),
    UNIQUE KEY uk_b3_learning_interaction_idempotency (tenant_id, principal_id, idempotency_key),
    KEY idx_b3_learning_interaction_owner (tenant_id, principal_id, domain_code, action_code, created_at),
    CONSTRAINT chk_b3_learning_interaction_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b3_learning_interaction_status CHECK (status IN ('ACCEPTED', 'REJECTED', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
