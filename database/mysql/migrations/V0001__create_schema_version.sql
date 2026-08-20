-- Foundation migration 0001.
-- This file is intentionally additive and safe to replay on a development database.
CREATE TABLE IF NOT EXISTS schema_version (
  schema_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  migration_version VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  installed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  execution_ms INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'APPLIED',
  installed_by VARCHAR(128) NULL,
  PRIMARY KEY (schema_version_id),
  UNIQUE KEY uk_schema_version (migration_version),
  KEY idx_schema_version_status (status, migration_version),
  CONSTRAINT chk_schema_version_status CHECK (status IN ('APPLIED', 'FAILED')),
  CONSTRAINT chk_schema_version_checksum CHECK (checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='可排序、可校验的数据库迁移账本';
