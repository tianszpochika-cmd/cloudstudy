-- B23: durable OIDC authorization transactions and provider-backed IAM session facts.
-- The external IdP remains the only token issuer. Authorization state is short-lived and
-- server-owned; session persistence stores only a refresh-token digest, never token plaintext.

ALTER TABLE iam_session
  ADD COLUMN provider_issuer VARCHAR(512) NULL AFTER revoked_at,
  ADD COLUMN provider_session_reference VARCHAR(256) NULL AFTER provider_issuer,
  ADD COLUMN rotation BIGINT NOT NULL DEFAULT 0 AFTER provider_session_reference;

CREATE TABLE IF NOT EXISTS iam_oidc_authorization_transaction (
  state VARCHAR(256) NOT NULL,
  provider_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(256) NOT NULL,
  redirect_uri VARCHAR(2048) NOT NULL,
  nonce VARCHAR(256) NOT NULL,
  code_verifier VARCHAR(256) NOT NULL,
  code_challenge VARCHAR(256) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  PRIMARY KEY (state),
  KEY idx_iam_oidc_tx_expiry (expires_at, consumed_at),
  CONSTRAINT chk_iam_oidc_tx_window CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='one-time server-owned OIDC state nonce and PKCE transaction';
