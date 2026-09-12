-- The Gateway emits the contract schema identifier "m2.gateway.security-audit.evidence.v1", which is
-- 37 characters, but both schema_version columns were VARCHAR(32). Because the receipt insert uses
-- INSERT IGNORE, MySQL truncated that value into a warning instead of failing, so the receipt row
-- was persisted with a corrupted schema_version while the audit_fact insert then failed outright
-- ("Data too long for column 'schema_version'"). The result was orphan receipts, no durable fact,
-- and a replay that raised EmptyResultDataAccessException instead of reporting a duplicate.
-- Widen both columns to the same length used for the other free-form audit identifiers.
ALTER TABLE audit_ingest_receipt MODIFY COLUMN schema_version VARCHAR(64) NOT NULL;
ALTER TABLE audit_fact MODIFY COLUMN schema_version VARCHAR(64) NOT NULL;
