-- IAM account/identifier request windows. Only a SHA-256 key digest is persisted.
CREATE TABLE IF NOT EXISTS iam_rate_limit (
  scope_key VARCHAR(64) NOT NULL,
  key_digest BINARY(32) NOT NULL,
  window_started_at DATETIME(6) NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (scope_key, key_digest),
  KEY idx_iam_rate_limit_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
