-- Foundation migration 0004.
-- This table is append-only by application policy. Retention jobs may anonymize
-- permitted hashes, but must not rewrite the business meaning of an audit row.
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_uuid CHAR(36) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  actor_type VARCHAR(24) NOT NULL,
  actor_subject VARCHAR(128) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(64) NULL,
  action_code VARCHAR(96) NOT NULL,
  resource_type VARCHAR(64) NULL,
  resource_id VARCHAR(128) NULL,
  result_code VARCHAR(64) NOT NULL,
  reason_code VARCHAR(64) NULL,
  before_hash BINARY(32) NULL,
  after_hash BINARY(32) NULL,
  ip_hash BINARY(32) NULL,
  user_agent_hash BINARY(32) NULL,
  metadata_json JSON NULL,
  occurred_at DATETIME(6) NOT NULL,
  retention_until DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (audit_log_id),
  UNIQUE KEY uk_audit_uuid (audit_uuid),
  KEY idx_audit_resource_time (resource_type, resource_id, occurred_at),
  KEY idx_audit_actor_time (actor_subject, occurred_at),
  KEY idx_audit_request (request_id),
  KEY idx_audit_retention (retention_until, audit_log_id),
  CONSTRAINT chk_audit_uuid CHECK (audit_uuid REGEXP '^[0-9a-fA-F-]{36}$'),
  CONSTRAINT chk_audit_hash_size CHECK (
    (before_hash IS NULL OR OCTET_LENGTH(before_hash) = 32) AND
    (after_hash IS NULL OR OCTET_LENGTH(after_hash) = 32) AND
    (ip_hash IS NULL OR OCTET_LENGTH(ip_hash) = 32) AND
    (user_agent_hash IS NULL OR OCTET_LENGTH(user_agent_hash) = 32)
  ),
  CONSTRAINT chk_audit_retention CHECK (retention_until IS NULL OR retention_until >= occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不可变安全、内容、后台和数据访问审计日志';
