-- B23: durable self-owned JWT session rotation facts.
-- Registration/login are handled by iam-service; this migration only keeps
-- server-side refresh digests and rotation history for replay detection.
CREATE TABLE IF NOT EXISTS iam_refresh_token_history (
  session_id CHAR(36) NOT NULL,
  token_family_id CHAR(36) NOT NULL,
  refresh_token_hash BINARY(32) NOT NULL,
  rotation BIGINT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (session_id, rotation),
  UNIQUE KEY uk_iam_refresh_history_hash (refresh_token_hash),
  KEY idx_iam_refresh_history_family (token_family_id, rotation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='opaque refresh credential digests for rotation and replay detection';

SET @add_rotation = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE iam_session ADD COLUMN rotation BIGINT NOT NULL DEFAULT 0', 'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'iam_session' AND column_name = 'rotation'
);
PREPARE add_rotation_statement FROM @add_rotation;
EXECUTE add_rotation_statement;
DEALLOCATE PREPARE add_rotation_statement;
