-- B8: IAM control-plane facts. This schema is owned by iam-service.
-- No raw access/refresh token, provider secret, client role or client tenant is stored.
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
  CONSTRAINT chk_iam_adult_gate CHECK (adult_gate_status IN ('PENDING', 'VERIFIED', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 IAM principal and server-derived Phase 1 platform tenant';

CREATE TABLE IF NOT EXISTS iam_external_identity (
  external_identity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  principal_id CHAR(36) NOT NULL,
  issuer VARCHAR(255) NOT NULL,
  subject_hash BINARY(32) NOT NULL,
  provider_key_id VARCHAR(128) NULL,
  first_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (external_identity_id),
  UNIQUE KEY uk_iam_external_identity (issuer, subject_hash),
  UNIQUE KEY uk_iam_principal_issuer (principal_id, issuer),
  KEY idx_iam_external_principal (principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='immutable OIDC issuer/subject mapping using a non-reversible subject hash';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='IAM device trust and server-side kickout state';

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
  PRIMARY KEY (session_id),
  UNIQUE KEY uk_iam_session_refresh_hash (refresh_token_hash),
  UNIQUE KEY uk_iam_session_family (token_family_id),
  KEY idx_iam_session_principal_status (principal_id, status, expires_at),
  CONSTRAINT chk_iam_session_status CHECK (status IN ('ACTIVE', 'ROTATED', 'REVOKED', 'REPLAY_DETECTED', 'EXPIRED')),
  CONSTRAINT chk_iam_session_window CHECK (expires_at > issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='refresh rotation/replay/revocation facts; never stores token plaintext';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='versioned privacy/product consent facts';

CREATE TABLE IF NOT EXISTS iam_policy_version (
  policy_version VARCHAR(64) NOT NULL,
  policy_type VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  policy_digest CHAR(64) NOT NULL,
  published_at DATETIME(6) NULL,
  retired_at DATETIME(6) NULL,
  PRIMARY KEY (policy_version, policy_type),
  CONSTRAINT chk_iam_policy_status CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='versioned policy package metadata; policy documents remain managed by IAM deployment';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='replayable authorization and adult-gate decision audit';
