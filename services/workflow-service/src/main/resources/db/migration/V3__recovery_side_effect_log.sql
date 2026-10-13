-- Content-ops group 2: durable log of what manual recovery actually did (or failed to do).
-- Additive only. EXECUTED/FAILED status on manual_recovery_request already exists; this table
-- records the concrete subject mutation so audit can prove the side effect ran.
CREATE TABLE IF NOT EXISTS recovery_side_effect_log (
    effect_id CHAR(36) NOT NULL,
    recovery_id CHAR(36) NOT NULL,
    subject_type VARCHAR(60) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    action VARCHAR(60) NOT NULL,
    executor VARCHAR(128) NOT NULL,
    outcome VARCHAR(24) NOT NULL,
    detail VARCHAR(512) NULL,
    occurred_at DATETIME(6) NOT NULL,
    PRIMARY KEY (effect_id),
    KEY idx_recovery_effect_recovery (recovery_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
