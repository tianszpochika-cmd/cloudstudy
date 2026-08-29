-- Self-owned JWT authentication center: account facts and replayable refresh-token history.
CREATE TABLE IF NOT EXISTS iam_account (
  principal_id CHAR(36) NOT NULL,
  identifier VARCHAR(128) NOT NULL,
  password_hash VARCHAR(512) NOT NULL,
  roles TEXT NOT NULL,
  permissions TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id),
  UNIQUE KEY uk_iam_account_identifier (identifier),
  KEY idx_iam_account_status (status, locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_refresh_token_history (
  session_id CHAR(36) NOT NULL,
  token_family_id CHAR(36) NOT NULL,
  refresh_token_hash BINARY(32) NOT NULL,
  rotation BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (session_id, rotation),
  UNIQUE KEY uk_iam_refresh_history_hash (refresh_token_hash),
  KEY idx_iam_refresh_history_family (token_family_id, rotation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Retire provider-specific ownership columns from legacy installations. New installations may
-- skip these no-op branches; existing data remains under the IAM migration boundary.
SET @drop_provider_issuer = (
    SELECT IF(COUNT(*) > 0, 'ALTER TABLE iam_session DROP COLUMN provider_issuer', 'SELECT 1')
    FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'iam_session' AND column_name = 'provider_issuer'
);
PREPARE drop_provider_issuer_stmt FROM @drop_provider_issuer;
EXECUTE drop_provider_issuer_stmt;
DEALLOCATE PREPARE drop_provider_issuer_stmt;

SET @drop_provider_client = (
    SELECT IF(COUNT(*) > 0, 'ALTER TABLE iam_session DROP COLUMN provider_client_id', 'SELECT 1')
    FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'iam_session' AND column_name = 'provider_client_id'
);
PREPARE drop_provider_client_stmt FROM @drop_provider_client;
EXECUTE drop_provider_client_stmt;
DEALLOCATE PREPARE drop_provider_client_stmt;

SET @drop_provider_reference = (
    SELECT IF(COUNT(*) > 0, 'ALTER TABLE iam_session DROP COLUMN provider_session_reference', 'SELECT 1')
    FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'iam_session' AND column_name = 'provider_session_reference'
);
PREPARE drop_provider_reference_stmt FROM @drop_provider_reference;
EXECUTE drop_provider_reference_stmt;
DEALLOCATE PREPARE drop_provider_reference_stmt;

DROP TABLE IF EXISTS iam_oidc_authorization_transaction;
DROP TABLE IF EXISTS iam_external_identity;
