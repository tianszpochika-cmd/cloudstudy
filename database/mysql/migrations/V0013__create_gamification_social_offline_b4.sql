-- B4: gamification, study rooms, notifications and offline sync.
-- MySQL remains the fact source; Redis may project these facts but never owns them.
CREATE TABLE IF NOT EXISTS gam_rule_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, rule_version VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL, config_json JSON NOT NULL, effective_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gam_idempotency_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, scope_code VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(96) NOT NULL, request_fingerprint CHAR(64) NOT NULL, response_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uk_gam_idem (user_id, scope_code, idempotency_key)
);
CREATE TABLE IF NOT EXISTS gam_account_summary (
    user_id BIGINT PRIMARY KEY, total_xp BIGINT NOT NULL DEFAULT 0, level_no INT NOT NULL DEFAULT 1,
    rank_code VARCHAR(64) NOT NULL, coin_balance BIGINT NOT NULL DEFAULT 0, version_no BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, CHECK (total_xp >= 0), CHECK (coin_balance >= 0)
);
CREATE TABLE IF NOT EXISTS gam_xp_ledger (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, source_event_id VARCHAR(128) NOT NULL,
    reason_code VARCHAR(64) NOT NULL, rule_version VARCHAR(64) NOT NULL, delta_xp INT NOT NULL,
    request_id VARCHAR(128) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gam_xp_event (user_id, source_event_id, reason_code, rule_version, request_id)
);
CREATE TABLE IF NOT EXISTS gam_currency_ledger (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, currency_code VARCHAR(32) NOT NULL,
    source_event_id VARCHAR(128) NOT NULL, reason_code VARCHAR(64) NOT NULL, delta_amount BIGINT NOT NULL,
    rule_version VARCHAR(64) NOT NULL, request_id VARCHAR(128) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gam_currency_event (user_id, currency_code, source_event_id, reason_code, request_id)
);
CREATE TABLE IF NOT EXISTS gam_daily_reward_counter (
    user_id BIGINT NOT NULL, valid_date DATE NOT NULL, counter_code VARCHAR(64) NOT NULL,
    counter_value INT NOT NULL DEFAULT 0, version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, valid_date, counter_code)
);
CREATE TABLE IF NOT EXISTS gam_reward_grant (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, grant_id VARCHAR(128) NOT NULL UNIQUE,
    source_event_id VARCHAR(128) NOT NULL, grant_type VARCHAR(64) NOT NULL, status VARCHAR(32) NOT NULL,
    payload_json JSON NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gam_streak_profile (
    user_id BIGINT PRIMARY KEY, current_streak INT NOT NULL DEFAULT 0, longest_streak INT NOT NULL DEFAULT 0,
    time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai', weekend_protection_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_valid_date DATE NULL, status VARCHAR(32) NOT NULL DEFAULT 'NEW', version_no BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gam_streak_day (
    user_id BIGINT NOT NULL, valid_date DATE NOT NULL, qualification_code VARCHAR(64) NOT NULL,
    source_event_id VARCHAR(128) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, valid_date), UNIQUE KEY uk_gam_streak_source (user_id, source_event_id)
);
CREATE TABLE IF NOT EXISTS gam_streak_rescue (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, missing_date DATE NOT NULL,
    rescue_method VARCHAR(32) NOT NULL, status VARCHAR(32) NOT NULL, request_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gam_quest_definition (
    quest_id VARCHAR(96) PRIMARY KEY, period_code VARCHAR(16) NOT NULL, title VARCHAR(160) NOT NULL,
    target_value INT NOT NULL, xp_reward INT NOT NULL, coin_reward INT NOT NULL, rule_version VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED', definition_json JSON NOT NULL
);
CREATE TABLE IF NOT EXISTS gam_user_quest (
    user_id BIGINT NOT NULL, quest_id VARCHAR(96) NOT NULL, period_start DATE NOT NULL, progress_value INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL, claimed_at TIMESTAMP NULL, version_no BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, quest_id, period_start)
);
CREATE TABLE IF NOT EXISTS gam_quest_progress_event (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, quest_id VARCHAR(96) NOT NULL,
    source_event_id VARCHAR(128) NOT NULL, progress_delta INT NOT NULL, occurred_at TIMESTAMP NOT NULL,
    UNIQUE KEY uk_gam_quest_progress (user_id, quest_id, source_event_id)
);
CREATE TABLE IF NOT EXISTS gam_achievement_definition (
    achievement_code VARCHAR(96) PRIMARY KEY, title VARCHAR(160) NOT NULL, target_value INT NOT NULL,
    xp_reward INT NOT NULL, coin_reward INT NOT NULL, definition_json JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
);
CREATE TABLE IF NOT EXISTS gam_user_achievement (
    user_id BIGINT NOT NULL, achievement_code VARCHAR(96) NOT NULL, progress_value INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL, unlocked_at TIMESTAMP NULL, showcased BOOLEAN NOT NULL DEFAULT FALSE,
    version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, achievement_code)
);
CREATE TABLE IF NOT EXISTS gam_achievement_progress_event (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, achievement_code VARCHAR(96) NOT NULL,
    source_event_id VARCHAR(128) NOT NULL, progress_delta INT NOT NULL, occurred_at TIMESTAMP NOT NULL,
    UNIQUE KEY uk_gam_achievement_progress (user_id, achievement_code, source_event_id)
);
CREATE TABLE IF NOT EXISTS gam_game_definition (
    game_code VARCHAR(64) PRIMARY KEY, title VARCHAR(160) NOT NULL, max_minutes INT NOT NULL DEFAULT 15,
    pause_limit_minutes INT NOT NULL DEFAULT 10, definition_json JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
);
CREATE TABLE IF NOT EXISTS gam_game_session (
    session_id VARCHAR(128) PRIMARY KEY, user_id BIGINT NOT NULL, game_code VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL, content_version_id BIGINT NOT NULL, server_nonce_hash CHAR(64) NOT NULL,
    event_seq BIGINT NOT NULL DEFAULT 0, started_at TIMESTAMP NOT NULL, completed_at TIMESTAMP NULL,
    result_json JSON NULL, version_no BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gam_game_session_event (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, session_id VARCHAR(128) NOT NULL, event_id VARCHAR(128) NOT NULL,
    seq_no BIGINT NOT NULL, event_type VARCHAR(64) NOT NULL, response_hash CHAR(64) NULL,
    occurred_at TIMESTAMP NOT NULL, UNIQUE KEY uk_gam_game_event (session_id, event_id), UNIQUE KEY uk_gam_game_seq (session_id, seq_no)
);
CREATE TABLE IF NOT EXISTS gam_game_item_attempt (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, session_id VARCHAR(128) NOT NULL, item_code VARCHAR(128) NOT NULL,
    attempt_no INT NOT NULL, accepted BOOLEAN NOT NULL, response_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gam_avatar_asset_manifest (
    resource_version VARCHAR(64) PRIMARY KEY, manifest_hash CHAR(64) NOT NULL, fallback_mode VARCHAR(32) NOT NULL,
    manifest_json JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED', published_at TIMESTAMP NULL
);
CREATE TABLE IF NOT EXISTS gam_avatar_item_definition (
    item_code VARCHAR(96) PRIMARY KEY, slot_code VARCHAR(32) NOT NULL, quality_code VARCHAR(32) NOT NULL,
    resource_version VARCHAR(64) NOT NULL, item_json JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
);
CREATE TABLE IF NOT EXISTS gam_avatar_inventory (
    user_id BIGINT NOT NULL, item_code VARCHAR(96) NOT NULL, quantity INT NOT NULL DEFAULT 1,
    first_obtained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, item_code)
);
CREATE TABLE IF NOT EXISTS gam_avatar_profile (
    user_id BIGINT PRIMARY KEY, avatar_code VARCHAR(96) NOT NULL, resource_version VARCHAR(64) NOT NULL,
    render_mode VARCHAR(32) NOT NULL DEFAULT '2D_FALLBACK', loadout_id VARCHAR(96) NULL, version_no BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gam_avatar_loadout (
    loadout_id VARCHAR(96) PRIMARY KEY, user_id BIGINT NOT NULL, name VARCHAR(120) NOT NULL,
    resource_version VARCHAR(64) NOT NULL, equipped BOOLEAN NOT NULL DEFAULT FALSE, version_no BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gam_avatar_loadout_item (
    loadout_id VARCHAR(96) NOT NULL, slot_code VARCHAR(32) NOT NULL, item_code VARCHAR(96) NOT NULL,
    PRIMARY KEY (loadout_id, slot_code)
);
CREATE TABLE IF NOT EXISTS gam_study_space (
    user_id BIGINT PRIMARY KEY, space_id VARCHAR(96) NOT NULL UNIQUE, render_mode VARCHAR(32) NOT NULL DEFAULT '2D_FALLBACK',
    resource_version VARCHAR(64) NOT NULL, version_no BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gam_study_space_placement (
    space_id VARCHAR(96) NOT NULL, placement_id VARCHAR(96) NOT NULL, item_code VARCHAR(96) NOT NULL,
    position_json JSON NOT NULL, version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (space_id, placement_id)
);
CREATE TABLE IF NOT EXISTS gam_chest_definition (
    chest_type_code VARCHAR(64) PRIMARY KEY, free_only BOOLEAN NOT NULL DEFAULT TRUE, cooldown_seconds INT NOT NULL DEFAULT 0,
    definition_json JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
);
CREATE TABLE IF NOT EXISTS gam_chest_probability_version (
    probability_version VARCHAR(64) PRIMARY KEY, total_weight_bps INT NOT NULL, hmac_key_version VARCHAR(64) NOT NULL,
    effective_at TIMESTAMP NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS gam_chest_probability_tier (
    probability_version VARCHAR(64) NOT NULL, tier_code VARCHAR(32) NOT NULL, weight_bps INT NOT NULL,
    PRIMARY KEY (probability_version, tier_code)
);
CREATE TABLE IF NOT EXISTS gam_chest_drop_definition (
    probability_version VARCHAR(64) NOT NULL, tier_code VARCHAR(32) NOT NULL, item_code VARCHAR(96) NOT NULL,
    weight_bps INT NOT NULL, PRIMARY KEY (probability_version, tier_code, item_code)
);
CREATE TABLE IF NOT EXISTS gam_chest_grant (
    chest_grant_id VARCHAR(128) PRIMARY KEY, user_id BIGINT NOT NULL, chest_type_code VARCHAR(64) NOT NULL,
    probability_version VARCHAR(64) NOT NULL, status VARCHAR(32) NOT NULL, source_event_id VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gam_chest_open_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, chest_grant_id VARCHAR(128) NOT NULL, user_id BIGINT NOT NULL,
    probability_version VARCHAR(64) NOT NULL, hmac_commitment CHAR(64) NOT NULL, tier_code VARCHAR(32) NOT NULL,
    item_code VARCHAR(96) NOT NULL, duplicate_converted BOOLEAN NOT NULL DEFAULT FALSE, opened_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS gam_fixed_catalog_item (
    catalog_item_id VARCHAR(96) PRIMARY KEY, price_coins BIGINT NOT NULL, item_code VARCHAR(96) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED', catalog_json JSON NOT NULL
);
CREATE TABLE IF NOT EXISTS gam_collection_set (
    set_code VARCHAR(96) PRIMARY KEY, title VARCHAR(160) NOT NULL, total_items INT NOT NULL, definition_json JSON NOT NULL
);
CREATE TABLE IF NOT EXISTS gam_season_definition (
    season_id VARCHAR(96) PRIMARY KEY, title VARCHAR(160) NOT NULL, starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL, status VARCHAR(20) NOT NULL, definition_json JSON NOT NULL
);
CREATE TABLE IF NOT EXISTS gam_season_tier (
    season_id VARCHAR(96) NOT NULL, tier_no INT NOT NULL, required_points BIGINT NOT NULL,
    reward_json JSON NOT NULL, PRIMARY KEY (season_id, tier_no)
);
CREATE TABLE IF NOT EXISTS gam_user_season (
    user_id BIGINT NOT NULL, season_id VARCHAR(96) NOT NULL, points BIGINT NOT NULL DEFAULT 0,
    claimed_tier_no INT NOT NULL DEFAULT 0, version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, season_id)
);
CREATE TABLE IF NOT EXISTS gam_season_point_ledger (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, season_id VARCHAR(96) NOT NULL,
    source_event_id VARCHAR(128) NOT NULL, delta_points INT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_gam_season_event (user_id, season_id, source_event_id)
);
CREATE TABLE IF NOT EXISTS gam_admin_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, actor_id BIGINT NULL, action_code VARCHAR(96) NOT NULL,
    target_type VARCHAR(96) NOT NULL, target_id VARCHAR(128) NOT NULL, before_json JSON NULL, after_json JSON NULL,
    request_id VARCHAR(128) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS soc_room (
    room_id VARCHAR(96) PRIMARY KEY, room_name VARCHAR(160) NOT NULL, template_code VARCHAR(64) NOT NULL,
    capacity INT NOT NULL DEFAULT 25, visibility_code VARCHAR(32) NOT NULL DEFAULT 'PUBLIC', status VARCHAR(20) NOT NULL DEFAULT 'OPEN', version_no BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS soc_room_member (
    room_id VARCHAR(96) NOT NULL, user_id BIGINT NOT NULL, role_code VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', version_no BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS soc_room_seat (
    room_id VARCHAR(96) NOT NULL, seat_no INT NOT NULL, user_id BIGINT NULL, seat_state VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
    lease_until TIMESTAMP NULL, version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (room_id, seat_no), UNIQUE KEY uk_soc_room_user (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS soc_focus_session (
    session_id VARCHAR(128) PRIMARY KEY, room_id VARCHAR(96) NOT NULL, user_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL, started_at TIMESTAMP NOT NULL, ended_at TIMESTAMP NULL,
    server_duration_seconds BIGINT NOT NULL DEFAULT 0, validity_code VARCHAR(32) NOT NULL DEFAULT 'VALID', version_no BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS soc_interaction_event (
    event_id VARCHAR(128) PRIMARY KEY, room_id VARCHAR(96) NOT NULL, sender_user_id BIGINT NOT NULL,
    target_user_id BIGINT NULL, interaction_code VARCHAR(64) NOT NULL, occurred_at TIMESTAMP NOT NULL,
    visibility_code VARCHAR(32) NOT NULL DEFAULT 'ROOM_MEMBERS'
);
CREATE TABLE IF NOT EXISTS soc_leaderboard_snapshot (
    snapshot_id VARCHAR(128) PRIMARY KEY, room_id VARCHAR(96) NOT NULL, period_code VARCHAR(32) NOT NULL,
    generated_at TIMESTAMP NOT NULL, source_version BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS soc_leaderboard_entry (
    snapshot_id VARCHAR(128) NOT NULL, user_id BIGINT NOT NULL, rank_no INT NOT NULL,
    completed_focus_seconds BIGINT NOT NULL DEFAULT 0, validity_code VARCHAR(32) NOT NULL DEFAULT 'VALID', PRIMARY KEY (snapshot_id, user_id)
);
CREATE TABLE IF NOT EXISTS inf_notification_preference (
    user_id BIGINT PRIMARY KEY, preference_json JSON NOT NULL, version_no BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inf_notification_message (
    message_id VARCHAR(128) PRIMARY KEY, user_id BIGINT NOT NULL, event_type VARCHAR(96) NOT NULL,
    safe_payload_json JSON NOT NULL, read_at TIMESTAMP NULL, dedupe_key VARCHAR(160) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inf_notification_delivery (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, message_id VARCHAR(128) NOT NULL, channel_code VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL, attempt_count INT NOT NULL DEFAULT 0, last_attempt_at TIMESTAMP NULL
);
CREATE TABLE IF NOT EXISTS inf_offline_package (
    package_id VARCHAR(128) PRIMARY KEY, package_code VARCHAR(96) NOT NULL, version_code VARCHAR(64) NOT NULL,
    package_state VARCHAR(32) NOT NULL, size_bytes BIGINT NOT NULL, part_count INT NOT NULL,
    sha256 CHAR(64) NOT NULL, signature_value VARCHAR(512) NOT NULL, min_client_version VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NULL, manifest_json JSON NOT NULL
);
CREATE TABLE IF NOT EXISTS inf_offline_download (
    package_id VARCHAR(128) NOT NULL, user_id BIGINT NOT NULL, device_id VARCHAR(128) NOT NULL,
    download_state VARCHAR(32) NOT NULL, completed_bitmap BLOB NULL, part_etag_json JSON NULL,
    downloaded_bytes BIGINT NOT NULL DEFAULT 0, version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (package_id, user_id, device_id)
);
CREATE TABLE IF NOT EXISTS inf_sync_cursor (
    user_id BIGINT NOT NULL, device_id VARCHAR(128) NOT NULL, stream_code VARCHAR(64) NOT NULL,
    cursor_value VARCHAR(160) NOT NULL, version_no BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, device_id, stream_code)
);
CREATE TABLE IF NOT EXISTS inf_client_event (
    event_id VARCHAR(128) PRIMARY KEY, user_id BIGINT NOT NULL, device_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(96) NOT NULL, payload_hash CHAR(64) NOT NULL, status VARCHAR(32) NOT NULL,
    occurred_at TIMESTAMP NOT NULL, received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inf_sync_change_log (
    change_id BIGINT PRIMARY KEY AUTO_INCREMENT, entity_type VARCHAR(96) NOT NULL, entity_id VARCHAR(128) NOT NULL,
    entity_version BIGINT NOT NULL, operation_code VARCHAR(32) NOT NULL, safe_payload_json JSON NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS b4_durable_fact (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, aggregate_type VARCHAR(96) NOT NULL, aggregate_id VARCHAR(128) NOT NULL,
    user_id BIGINT NOT NULL, request_id VARCHAR(128) NOT NULL, idempotency_key VARCHAR(96) NOT NULL,
    occurred_at TIMESTAMP NOT NULL, payload_json JSON NOT NULL, KEY ix_b4_fact_user (aggregate_type, user_id, id)
);
