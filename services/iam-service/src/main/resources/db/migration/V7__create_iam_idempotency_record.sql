-- Durable claim/replay state for every persistent IAM write.
CREATE TABLE IF NOT EXISTS iam_idempotency_record (
  scope_key VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash BINARY(32) NOT NULL,
  state VARCHAR(16) NOT NULL,
  response_status SMALLINT NULL,
  result_reference VARCHAR(512) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  completed_at DATETIME(6) NULL,
  PRIMARY KEY (scope_key, idempotency_key),
  KEY idx_iam_idempotency_created (created_at),
  CONSTRAINT chk_iam_idempotency_state CHECK (state IN ('IN_PROGRESS', 'COMPLETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
