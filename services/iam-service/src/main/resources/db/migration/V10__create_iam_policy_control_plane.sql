-- P1 IAM policy/PDP control plane. This supplements the historical iam_policy_version seed;
-- it neither rewrites that seed nor reaches another service schema.
CREATE TABLE IF NOT EXISTS iam_policy_control_version (
  policy_version_id CHAR(36) NOT NULL,
  version_label VARCHAR(128) NOT NULL,
  lifecycle_status VARCHAR(16) NOT NULL,
  revision INT NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  document_json JSON NOT NULL,
  artifact_digest CHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by CHAR(36) NOT NULL,
  submitted_by CHAR(36) NULL,
  approved_by CHAR(36) NULL,
  activated_by CHAR(36) NULL,
  revoked_by CHAR(36) NULL,
  activated_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  cache_invalidation_id CHAR(36) NOT NULL,
  cache_invalidation_required BOOLEAN NOT NULL,
  cache_invalidation_status VARCHAR(16) NOT NULL,
  cache_invalidation_scope VARCHAR(64) NOT NULL,
  cache_invalidation_issued_at DATETIME(6) NOT NULL,
  cache_invalidation_completed_at DATETIME(6) NULL,
  deny_until_current_version_proven BOOLEAN NOT NULL,
  PRIMARY KEY (policy_version_id),
  UNIQUE KEY uk_iam_policy_control_version_label (tenant_id, version_label),
  KEY idx_iam_policy_control_tenant_status (tenant_id, lifecycle_status, updated_at),
  CONSTRAINT chk_iam_policy_control_lifecycle CHECK (lifecycle_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'REVOKED')),
  CONSTRAINT chk_iam_policy_control_revision CHECK (revision >= 1),
  CONSTRAINT chk_iam_policy_control_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_iam_policy_control_fail_closed CHECK (deny_until_current_version_proven = TRUE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_policy_control_contributor (
  policy_version_id CHAR(36) NOT NULL,
  principal_id CHAR(36) NOT NULL,
  added_at DATETIME(6) NOT NULL,
  PRIMARY KEY (policy_version_id, principal_id),
  KEY idx_iam_policy_control_contributor_principal (principal_id, policy_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iam_policy_control_audit (
  audit_id CHAR(36) NOT NULL,
  policy_version_id CHAR(36) NOT NULL,
  revision INT NOT NULL,
  event_type VARCHAR(96) NOT NULL,
  actor_principal_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  trace_id VARCHAR(128) NOT NULL,
  reason_digest CHAR(64) NOT NULL,
  recorded_at DATETIME(6) NOT NULL,
  PRIMARY KEY (audit_id),
  KEY idx_iam_policy_control_audit_version (policy_version_id, recorded_at),
  CONSTRAINT chk_iam_policy_control_audit_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_iam_policy_control_audit_revision CHECK (revision >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A row is seeded once so SELECT ... FOR UPDATE serializes competing ACTIVE-policy switches.
CREATE TABLE IF NOT EXISTS iam_policy_active_slot (
  tenant_id VARCHAR(64) NOT NULL,
  policy_version_id CHAR(36) NULL,
  PRIMARY KEY (tenant_id),
  CONSTRAINT chk_iam_policy_active_slot_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO iam_policy_active_slot (tenant_id, policy_version_id) VALUES ('platform', NULL);
