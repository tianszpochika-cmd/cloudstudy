-- ONE-WAY CUTOVER: stop the IAM write entrance, drain every old writer/in-flight request, then
-- start the new binary. This is deliberately not a rolling-compatible migration and the runtime
-- refuses to execute pending V13 without the explicit drained-writers confirmation.
--
-- V7 stored an unkeyed request digest and V9 stored snapshots bound to that digest. Renaming by
-- drop/add (rather than CHANGE) atomically destroys both legacy values and their old column API.
-- An old binary therefore fails closed on the removed request_hash/response_* columns. Existing
-- keys remain as fixed, non-reversible tombstones until retention purges them.
--
-- MySQL 8.4 InnoDB executes this single ALTER as atomic DDL: every clause commits together or the
-- entire statement rolls back. Do not split this statement or add a preceding UPDATE.
ALTER TABLE iam_idempotency_record
  DROP COLUMN request_hash,
  DROP COLUMN response_ciphertext,
  DROP COLUMN response_nonce,
  DROP COLUMN response_key_version,
  ADD COLUMN request_fingerprint BINARY(32) NOT NULL
    DEFAULT 0x0000000000000000000000000000000000000000000000000000000000000000
    AFTER idempotency_key,
  ADD COLUMN request_fingerprint_version VARCHAR(32) NOT NULL
    DEFAULT 'legacy-invalidated-v0' AFTER request_fingerprint,
  ADD COLUMN replay_ciphertext MEDIUMBLOB NULL AFTER completed_at,
  ADD COLUMN replay_nonce BINARY(12) NULL AFTER replay_ciphertext,
  ADD COLUMN replay_key_version VARCHAR(16) NULL AFTER replay_nonce,
  ADD CONSTRAINT chk_iam_idempotency_request_fingerprint
    CHECK (
      (request_fingerprint_version = 'legacy-invalidated-v0'
        AND request_fingerprint = 0x0000000000000000000000000000000000000000000000000000000000000000
        AND replay_ciphertext IS NULL AND replay_nonce IS NULL AND replay_key_version IS NULL)
      OR
      (request_fingerprint_version = 'hmac-sha256-v1'
        AND request_fingerprint <> 0x0000000000000000000000000000000000000000000000000000000000000000
        AND ((replay_ciphertext IS NULL AND replay_nonce IS NULL AND replay_key_version IS NULL)
          OR (replay_ciphertext IS NOT NULL AND replay_nonce IS NOT NULL
            AND replay_key_version IS NOT NULL)))
    );
