-- Self-owned IAM schema: account credentials, server-derived authority and JWT session facts.
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
  CONSTRAINT chk_iam_principal_adult_gate CHECK (adult_gate_status IN ('PENDING', 'APPROVED', 'VERIFIED', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  KEY idx_iam_device_principal_status (principal_id, status, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  KEY idx_iam_session_principal_status (principal_id, status, expires_at)
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
  KEY idx_iam_consent_current (principal_id, consent_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_policy_version (
  policy_version VARCHAR(64) NOT NULL,
  policy_type VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  policy_digest CHAR(64) NOT NULL,
  published_at DATETIME(6) NULL,
  retired_at DATETIME(6) NULL,
  PRIMARY KEY (policy_version, policy_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  KEY idx_iam_decision_request (request_id, trace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_role (
  role_id CHAR(36) NOT NULL,
  role_key VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (role_id),
  UNIQUE KEY uk_iam_role_key (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_permission (
  permission_id CHAR(36) NOT NULL,
  permission_key VARCHAR(256) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (permission_id),
  UNIQUE KEY uk_iam_permission_key (permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_principal_role (
  principal_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (principal_id, role_id),
  KEY idx_iam_principal_role_active (principal_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_role_permission (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_iam_role_permission_active (role_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO iam_role (role_id, role_key) VALUES ('role-learner', 'learner');
INSERT IGNORE INTO iam_permission (permission_id, permission_key) VALUES
  ('perm-learner-profile-read', 'learner.profile.read'),
  ('perm-learner-profile-write', 'learner.profile.write'),
  ('perm-learning-plan-read', 'learning.plan.read'),
  ('perm-learning-plan-write', 'learning.plan.write'),
  ('perm-assessment-session-read', 'assessment.session.read'),
  ('perm-assessment-session-write', 'assessment.session.write'),
  ('perm-content-read', 'content.read'),
  ('perm-iam-self-read', 'iam.self.read'),
  ('perm-iam-self-write', 'iam.self.write');
INSERT IGNORE INTO iam_role_permission (role_id, permission_id)
  SELECT 'role-learner', permission_id FROM iam_permission WHERE permission_key IN (
    'learner.profile.read', 'learner.profile.write', 'learning.plan.read', 'learning.plan.write',
    'assessment.session.read', 'assessment.session.write', 'content.read', 'iam.self.read', 'iam.self.write');
