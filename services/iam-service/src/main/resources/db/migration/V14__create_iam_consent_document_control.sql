-- Server-published consent document control plane. Rows are immutable published facts; the
-- runtime selects the latest ACTIVE document per type and fails closed when none is published.
-- No fixture rows are seeded here: a deployment without published legal-document facts must keep
-- returning POLICY_UNAVAILABLE instead of silently authorizing consent writes.
CREATE TABLE IF NOT EXISTS iam_consent_document_version (
  consent_document_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  consent_type VARCHAR(64) NOT NULL,
  document_version VARCHAR(64) NOT NULL,
  document_digest CHAR(64) NOT NULL,
  published_at DATETIME(6) NOT NULL,
  policy_version VARCHAR(64) NOT NULL,
  policy_digest CHAR(64) NOT NULL,
  requirement VARCHAR(32) NOT NULL,
  capabilities JSON NOT NULL,
  withdrawal_effect VARCHAR(48) NOT NULL,
  revoke_sessions BOOLEAN NOT NULL,
  policy_ref VARCHAR(192) NOT NULL,
  runtime_status VARCHAR(32) NOT NULL,
  lifecycle_status VARCHAR(16) NOT NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (consent_document_id),
  UNIQUE KEY uk_iam_consent_document_version (tenant_id, consent_type, document_version),
  KEY idx_iam_consent_document_active (tenant_id, consent_type, lifecycle_status, published_at),
  CONSTRAINT chk_iam_consent_document_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_iam_consent_document_lifecycle CHECK (lifecycle_status IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT chk_iam_consent_document_runtime CHECK (runtime_status IN ('NOT_RUNTIME_VERIFIED', 'RUNTIME_VERIFIED')),
  CONSTRAINT chk_iam_consent_document_requirement CHECK (requirement IN ('BASE_REQUIRED', 'LEARNING_REQUIRED', 'OPTIONAL', 'CAPABILITY_REQUIRED')),
  CONSTRAINT chk_iam_consent_document_effect CHECK (withdrawal_effect IN ('NO_ACTION', 'RESTRICT_PROTECTED_CAPABILITY', 'RESTRICT_ALL_LEARNING_ACCESS', 'REVOKE_SENSITIVE_SESSION_SCOPE')),
  CONSTRAINT chk_iam_consent_document_revoked CHECK (
    (lifecycle_status = 'ACTIVE' AND revoked_at IS NULL)
    OR (lifecycle_status = 'REVOKED' AND revoked_at IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
