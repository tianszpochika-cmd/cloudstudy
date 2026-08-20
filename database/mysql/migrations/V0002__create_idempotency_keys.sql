-- Foundation migration 0002.
-- The scope_subject column is intentionally non-null so anonymous requests do not
-- bypass the unique constraint through MySQL's NULL semantics.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_code VARCHAR(96) NOT NULL,
  scope_subject VARCHAR(128) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  device_session_hash BINARY(32) NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash BINARY(32) NOT NULL,
  http_method VARCHAR(8) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PROCESSING',
  response_status SMALLINT UNSIGNED NULL,
  response_body_json JSON NULL,
  response_headers_json JSON NULL,
  resource_type VARCHAR(64) NULL,
  resource_id VARCHAR(128) NULL,
  first_request_id VARCHAR(80) NOT NULL,
  processing_expires_at DATETIME(6) NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (idempotency_id),
  UNIQUE KEY uk_idempotency_scope_key (scope_code, scope_subject, idempotency_key),
  KEY idx_idempotency_expiry (expires_at, status, idempotency_id),
  KEY idx_idempotency_processing (status, processing_expires_at, idempotency_id),
  KEY idx_idempotency_request (first_request_id),
  CONSTRAINT chk_idempotency_key_length CHECK (CHAR_LENGTH(idempotency_key) BETWEEN 16 AND 128),
  CONSTRAINT chk_idempotency_method CHECK (http_method IN ('POST', 'PUT', 'PATCH', 'DELETE')),
  CONSTRAINT chk_idempotency_status CHECK (status IN ('PROCESSING', 'SUCCEEDED', 'FAILED', 'CONFLICT')),
  CONSTRAINT chk_idempotency_request_hash CHECK (OCTET_LENGTH(request_hash) = 32),
  CONSTRAINT chk_idempotency_response CHECK (
    status <> 'SUCCEEDED' OR (response_status IS NOT NULL AND response_body_json IS NOT NULL)
  ),
  CONSTRAINT chk_idempotency_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='写请求幂等占位与首次响应记录';
