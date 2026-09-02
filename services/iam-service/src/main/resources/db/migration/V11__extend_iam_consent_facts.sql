-- M2-002 consent fact expansion.  V1/V4 are already applied and remain immutable.
-- Existing rows with no published document digest are intentionally not promoted: the JDBC
-- adapter fails closed until they are re-consented against a server-published document.
ALTER TABLE iam_consent
    ADD COLUMN purpose VARCHAR(128) NULL AFTER consent_type,
    ADD COLUMN required_scope VARCHAR(32) NULL AFTER purpose,
    ADD COLUMN document_version VARCHAR(64) NULL AFTER required_scope,
    ADD COLUMN document_digest CHAR(64) NULL AFTER document_version,
    ADD COLUMN policy_digest CHAR(64) NULL AFTER policy_version,
    ADD COLUMN effective_at DATETIME(6) NULL AFTER granted_at,
    ADD COLUMN withdrawal_effect VARCHAR(48) NOT NULL DEFAULT 'RESTRICT_ALL_LEARNING_ACCESS' AFTER revoked_at,
    ADD COLUMN revoke_sessions BOOLEAN NOT NULL DEFAULT TRUE AFTER withdrawal_effect;

UPDATE iam_consent
SET purpose = CASE consent_type
        WHEN 'TERMS_OF_SERVICE' THEN 'ACCOUNT_TERMS'
        WHEN 'PRIVACY_NOTICE' THEN 'PRIVACY_NOTICE'
        WHEN 'ADULT_LEARNING' THEN 'ADULT_LEARNING_ELIGIBILITY'
        WHEN 'PRODUCT_ANALYTICS' THEN 'PRODUCT_ANALYTICS'
        WHEN 'VOICE_RECORDING' THEN 'ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY'
        ELSE NULL END,
    required_scope = CASE consent_type
        WHEN 'TERMS_OF_SERVICE' THEN 'BASE_REQUIRED'
        WHEN 'PRIVACY_NOTICE' THEN 'BASE_REQUIRED'
        WHEN 'ADULT_LEARNING' THEN 'LEARNING_REQUIRED'
        WHEN 'PRODUCT_ANALYTICS' THEN 'OPTIONAL'
        WHEN 'VOICE_RECORDING' THEN 'CAPABILITY_REQUIRED'
        ELSE NULL END,
    document_version = policy_version,
    effective_at = granted_at;

ALTER TABLE iam_consent
    MODIFY COLUMN purpose VARCHAR(128) NOT NULL,
    MODIFY COLUMN required_scope VARCHAR(32) NOT NULL,
    MODIFY COLUMN document_version VARCHAR(64) NOT NULL,
    MODIFY COLUMN effective_at DATETIME(6) NOT NULL;

-- A stable key row serializes the first grant/withdrawal for a principal/type even when there is
-- no history row to lock.  The projection points at the immutable consent_id in iam_consent.
CREATE TABLE iam_consent_lock (
  principal_id CHAR(36) NOT NULL,
  consent_type VARCHAR(64) NOT NULL,
  lock_id CHAR(36) NOT NULL,
  PRIMARY KEY (principal_id, consent_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE iam_consent_current (
  principal_id CHAR(36) NOT NULL,
  consent_type VARCHAR(64) NOT NULL,
  consent_id CHAR(36) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (principal_id, consent_type),
  UNIQUE KEY uk_iam_consent_current_id (consent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO iam_consent_lock (principal_id, consent_type, lock_id)
SELECT DISTINCT principal_id, consent_type, '00000000-0000-0000-0000-000000000000'
FROM iam_consent;

INSERT INTO iam_consent_current (principal_id, consent_type, consent_id, updated_at)
SELECT principal_id, consent_type, consent_id, granted_at
FROM (
    SELECT c.principal_id, c.consent_type, c.consent_id, c.granted_at,
           ROW_NUMBER() OVER (
               PARTITION BY c.principal_id, c.consent_type
               ORDER BY c.granted_at DESC, c.consent_id DESC
           ) AS row_rank
    FROM iam_consent c
) ranked
WHERE row_rank = 1;
