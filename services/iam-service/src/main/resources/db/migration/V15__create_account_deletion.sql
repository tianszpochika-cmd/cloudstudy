-- M6-008: self-scoped account deletion requests with a 168-hour cooling window.
-- Sessions are revoked and the account flips to DELETED only through the internal
-- execute path after cooling elapses. The row is retained for audit and recovery.
CREATE TABLE IF NOT EXISTS iam_account_deletion (
  deletion_request_id VARCHAR(128) NOT NULL,
  principal_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'REQUESTED',
  execute_at DATETIME(6) NOT NULL,
  idempotency_key VARCHAR(256) NOT NULL,
  receipt_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  decided_at DATETIME(6) NULL,
  PRIMARY KEY (deletion_request_id),
  UNIQUE KEY uk_iam_deletion_idempotency (tenant_id, principal_id, idempotency_key),
  KEY idx_iam_deletion_principal (tenant_id, principal_id, status),
  CONSTRAINT chk_iam_deletion_status CHECK (status IN ('REQUESTED', 'CANCELLED', 'EXECUTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
