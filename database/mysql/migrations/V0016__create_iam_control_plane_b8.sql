-- B8: IAM-owned account, authority, session, policy and audit facts.
-- The authentication center is the only writer of these tables.
CREATE TABLE IF NOT EXISTS iam_principal (
  principal_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  adult_gate_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  adult_gate_version VARCHAR(64) NULL,
  adult_verified_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id),
  UNIQUE KEY uk_iam_principal_tenant (tenant_id, principal_id),
  CONSTRAINT chk_iam_principal_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_iam_principal_status CHECK (status IN ('ACTIVE', 'FROZEN', 'REVOKED', 'DELETION_PENDING', 'ANONYMIZED')),
  CONSTRAINT chk_iam_adult_gate CHECK (adult_gate_status IN ('PENDING', 'APPROVED', 'VERIFIED', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='IAM principal and server-derived Phase 1 platform tenant';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='hashed account credentials and IAM-owned authority facts';

CREATE TABLE IF NOT EXISTS iam_device (
  device_id CHAR(36) NOT NULL,
  principal_id CHAR(36) NOT NULL,
  device_public_id CHAR(36) NOT NULL,
  device_id_hash BINARY(32) NOT NULL,
  device_type VARCHAR(24) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  revoke_reason VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (device_id),
  UNIQUE KEY uk_iam_device_public_id (device_public_id),
  UNIQUE KEY uk_iam_device_principal_hash (principal_id, device_id_hash),
  KEY idx_iam_device_principal_status (principal_id, status, last_seen_at),
  CONSTRAINT chk_iam_device_status CHECK (status IN ('ACTIVE', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='device registration and server-side revocation facts';

CREATE TABLE IF NOT EXISTS iam_session (
  session_id CHAR(36) NOT NULL,
  principal_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  token_family_id CHAR(36) NOT NULL,
  refresh_token_hash BINARY(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  issued_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  rotated_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  revoke_reason VARCHAR(64) NULL,
  rotation BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  UNIQUE KEY uk_iam_session_refresh_hash (refresh_token_hash),
  UNIQUE KEY uk_iam_session_family (token_family_id),
  KEY idx_iam_session_principal_status (principal_id, status, expires_at),
  CONSTRAINT chk_iam_session_status CHECK (status IN ('ACTIVE', 'ROTATED', 'REVOKED', 'REPLAY_DETECTED', 'EXPIRED')),
  CONSTRAINT chk_iam_session_window CHECK (expires_at > issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='rotating opaque refresh session; plaintext credentials are never stored';

CREATE TABLE IF NOT EXISTS iam_refresh_token_history (
  session_id CHAR(36) NOT NULL,
  token_family_id CHAR(36) NOT NULL,
  refresh_token_hash BINARY(32) NOT NULL,
  rotation BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (session_id, rotation),
  UNIQUE KEY uk_iam_refresh_history_hash (refresh_token_hash),
  KEY idx_iam_refresh_history_family (token_family_id, rotation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='replay detection history containing digests only';

CREATE TABLE IF NOT EXISTS iam_consent (
  consent_id CHAR(36) NOT NULL,
  principal_id CHAR(36) NOT NULL,
  consent_type VARCHAR(64) NOT NULL,
  policy_version VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'GRANTED',
  granted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (consent_id),
  UNIQUE KEY uk_iam_consent_version (principal_id, consent_type, policy_version),
  KEY idx_iam_consent_current (principal_id, consent_type, status),
  CONSTRAINT chk_iam_consent_status CHECK (status IN ('GRANTED', 'REVOKED', 'EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='versioned consent facts';

CREATE TABLE IF NOT EXISTS iam_policy_version (
  policy_version VARCHAR(64) NOT NULL,
  policy_type VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  policy_digest CHAR(64) NOT NULL,
  published_at DATETIME(6) NULL,
  retired_at DATETIME(6) NULL,
  PRIMARY KEY (policy_version, policy_type),
  CONSTRAINT chk_iam_policy_status CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='versioned IAM policy package metadata';

CREATE TABLE IF NOT EXISTS iam_decision_audit (
  decision_id CHAR(36) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  trace_id VARCHAR(128) NOT NULL,
  principal_id CHAR(36) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  action_code VARCHAR(128) NOT NULL,
  resource_type VARCHAR(128) NOT NULL,
  resource_id_hash BINARY(32) NULL,
  policy_version VARCHAR(64) NOT NULL,
  decision VARCHAR(16) NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (decision_id),
  KEY idx_iam_decision_principal_time (principal_id, created_at),
  KEY idx_iam_decision_request (request_id, trace_id),
  CONSTRAINT chk_iam_decision_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_iam_decision_value CHECK (decision IN ('ALLOW', 'DENY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='replayable authorization and adult-gate decision audit';
