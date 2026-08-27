-- B36 local real-data gate: consent records are append-only. A repeated grant is
-- handled idempotently by ConsentService, while withdrawal/re-grant must retain history.
-- The local reconcile runner may execute this migration more than once, so both
-- schema changes are guarded by information_schema checks.
SET @drop_consent_unique = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE iam_consent DROP INDEX uk_iam_consent_version',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'iam_consent'
      AND index_name = 'uk_iam_consent_version'
);
PREPARE drop_consent_unique_stmt FROM @drop_consent_unique;
EXECUTE drop_consent_unique_stmt;
DEALLOCATE PREPARE drop_consent_unique_stmt;

SET @create_consent_version_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_iam_consent_version ON iam_consent (principal_id, consent_type, policy_version)',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'iam_consent'
      AND index_name = 'idx_iam_consent_version'
);
PREPARE create_consent_version_index_stmt FROM @create_consent_version_index;
EXECUTE create_consent_version_index_stmt;
DEALLOCATE PREPARE create_consent_version_index_stmt;
