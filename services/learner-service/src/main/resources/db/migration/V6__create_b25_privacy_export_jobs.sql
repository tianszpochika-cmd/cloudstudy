-- Learner-owned privacy export requests. The verified JWT subject is the only
-- principal identity; the client never supplies a user/tenant owner field.
CREATE TABLE IF NOT EXISTS b25_learner_privacy_export (
    export_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    policy_name VARCHAR(64) NOT NULL,
    export_status VARCHAR(24) NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (export_id),
    UNIQUE KEY uk_b25_privacy_export_idempotency (tenant_id, principal_id, idempotency_key),
    KEY idx_b25_privacy_export_principal (tenant_id, principal_id, created_at)
) ENGINE=InnoDB;
