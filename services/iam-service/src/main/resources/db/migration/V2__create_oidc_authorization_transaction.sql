-- B30: durable one-time authorization state for the provider-neutral OIDC client.
-- State, nonce and PKCE verifier are server-side facts; the browser only carries
-- the opaque state value and never becomes the source of truth for this record.
CREATE TABLE IF NOT EXISTS iam_oidc_authorization_transaction (
  state VARCHAR(256) NOT NULL,
  provider_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  redirect_uri VARCHAR(512) NOT NULL,
  nonce VARCHAR(256) NOT NULL,
  code_verifier VARCHAR(256) NOT NULL,
  code_challenge VARCHAR(256) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  PRIMARY KEY (state),
  KEY idx_iam_oidc_transaction_expiry (expires_at, consumed_at),
  KEY idx_iam_oidc_transaction_client (client_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
