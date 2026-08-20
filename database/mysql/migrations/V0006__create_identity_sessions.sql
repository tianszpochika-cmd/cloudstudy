CREATE TABLE IF NOT EXISTS usr_user (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_uuid CHAR(36) NOT NULL,
  phone_lookup_hash BINARY(32) NULL,
  nickname VARCHAR(50) NOT NULL DEFAULT 'Learner',
  age_group VARCHAR(16) NOT NULL DEFAULT 'ADULT',
  adult_confirmed_at DATETIME(6) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  privacy_settings_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_usr_user_uuid (user_uuid),
  UNIQUE KEY uk_usr_user_phone_hash (phone_lookup_hash),
  CONSTRAINT chk_usr_user_age CHECK (age_group = 'ADULT' AND adult_confirmed_at IS NOT NULL),
  CONSTRAINT chk_usr_user_status CHECK (status IN ('ACTIVE', 'FROZEN', 'DELETION_PENDING', 'ANONYMIZED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成人学习账号主表；只保存不可逆身份查找摘要';

CREATE TABLE IF NOT EXISTS usr_device_session (
  device_session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  device_public_id CHAR(36) NOT NULL,
  device_id_hash BINARY(32) NOT NULL,
  device_type VARCHAR(16) NOT NULL,
  client_version VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  last_active_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  revoke_reason VARCHAR(32) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (device_session_id),
  UNIQUE KEY uk_usr_device_public_id (device_public_id),
  UNIQUE KEY uk_usr_device_user_hash (user_id, device_id_hash),
  KEY idx_usr_device_user_status (user_id, status, last_active_at),
  CONSTRAINT chk_usr_device_status CHECK (status IN ('ACTIVE', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户设备会话和踢出状态';

CREATE TABLE IF NOT EXISTS usr_token_family (
  token_family_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_uuid CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  device_session_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  issued_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  reuse_detected_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  revoke_reason VARCHAR(32) NULL,
  PRIMARY KEY (token_family_id),
  UNIQUE KEY uk_usr_family_uuid (family_uuid),
  KEY idx_usr_family_user_status (user_id, status),
  CONSTRAINT chk_usr_family_status CHECK (status IN ('ACTIVE', 'REVOKED', 'REUSE_DETECTED', 'EXPIRED')),
  CONSTRAINT chk_usr_family_window CHECK (expires_at > issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Refresh Token family 撤销和重放边界';

CREATE TABLE IF NOT EXISTS usr_refresh_token (
  refresh_token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_family_id BIGINT UNSIGNED NOT NULL,
  token_jti CHAR(36) NOT NULL,
  token_hash BINARY(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  issued_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  replaced_by_token_id BIGINT UNSIGNED NULL,
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (refresh_token_id),
  UNIQUE KEY uk_usr_refresh_jti (token_jti),
  UNIQUE KEY uk_usr_refresh_hash (token_hash),
  KEY idx_usr_refresh_family_status (token_family_id, status, expires_at),
  CONSTRAINT chk_usr_refresh_status CHECK (status IN ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT chk_usr_refresh_window CHECK (expires_at > issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Refresh Token 轮换链；不保存令牌原文';

CREATE TABLE IF NOT EXISTS usr_account_deletion (
  account_deletion_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_uuid CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  reason_code VARCHAR(32) NULL,
  requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  completed_at DATETIME(6) NULL,
  PRIMARY KEY (account_deletion_id),
  UNIQUE KEY uk_usr_deletion_request (request_uuid),
  KEY idx_usr_deletion_user_status (user_id, status),
  CONSTRAINT chk_usr_deletion_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账户注销请求与会话失效审计锚点';
