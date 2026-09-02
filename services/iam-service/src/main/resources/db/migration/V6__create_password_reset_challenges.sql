-- Password reset challenges are short-lived one-time credentials. Only the SHA-256 digest is
-- persisted; consumed_at is atomically set by the JDBC adapter and is never cleared.
CREATE TABLE IF NOT EXISTS iam_password_reset_challenge (
  challenge_id CHAR(36) NOT NULL,
  principal_id CHAR(36) NOT NULL,
  token_digest BINARY(32) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  PRIMARY KEY (challenge_id),
  UNIQUE KEY uk_iam_password_reset_digest (token_digest),
  KEY idx_iam_password_reset_principal (principal_id, expires_at),
  KEY idx_iam_password_reset_expiry (expires_at, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
