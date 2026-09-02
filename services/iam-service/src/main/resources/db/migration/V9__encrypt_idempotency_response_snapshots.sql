-- Existing deployments created V7 before exact encrypted response replay was required.
-- The only credential-bearing columns are ciphertext and nonce; no response body/header or
-- access/refresh token plaintext is ever added to this table.
ALTER TABLE iam_idempotency_record
  ADD COLUMN response_ciphertext MEDIUMBLOB NULL,
  ADD COLUMN response_nonce BINARY(12) NULL,
  ADD COLUMN response_key_version VARCHAR(16) NULL,
  ADD COLUMN error_code VARCHAR(64) NULL,
  ADD COLUMN error_message_key VARCHAR(160) NULL;

ALTER TABLE iam_idempotency_record
  DROP CHECK chk_iam_idempotency_state,
  ADD CONSTRAINT chk_iam_idempotency_state CHECK (state IN ('IN_PROGRESS', 'COMPLETED', 'REJECTED'));
