CREATE TABLE IF NOT EXISTS gamification_feature_state (
    subject_id VARCHAR(128) NOT NULL,
    feature_key VARCHAR(96) NOT NULL,
    version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    state_json JSON NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (subject_id, feature_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gamification_game_session (
    session_id VARCHAR(160) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    game_code VARCHAR(64) NOT NULL,
    state VARCHAR(24) NOT NULL,
    session_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (session_id),
    KEY idx_gam_game_subject (subject_id, created_at)
) ENGINE=InnoDB;
