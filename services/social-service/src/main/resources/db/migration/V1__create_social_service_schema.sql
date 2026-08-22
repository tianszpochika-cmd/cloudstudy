CREATE TABLE IF NOT EXISTS soc_study_room (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  owner_subject VARCHAR(160) NOT NULL,
  theme_code VARCHAR(32) NOT NULL,
  display_name_key VARCHAR(128) NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  room_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_room_id_tenant (tenant_id, room_id),
  CONSTRAINT ck_soc_room_capacity CHECK (capacity BETWEEN 20 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_room_member (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  membership_id VARCHAR(160) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  subject_id VARCHAR(160) NOT NULL,
  state VARCHAR(16) NOT NULL,
  presence_state VARCHAR(16) NOT NULL,
  room_visibility VARCHAR(16) NOT NULL DEFAULT 'PUBLIC',
  privacy_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  joined_at DATETIME(3) NULL,
  left_at DATETIME(3) NULL,
  last_activity_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_member_id (membership_id),
  UNIQUE KEY uk_soc_member_subject (tenant_id, room_id, subject_id),
  KEY idx_soc_member_subject_state (tenant_id, subject_id, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_seat_lease (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  seat_index SMALLINT UNSIGNED NOT NULL,
  subject_id VARCHAR(160) NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  lease_id CHAR(64) NULL,
  lease_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  lease_expires_at DATETIME(3) NULL,
  disconnected_at DATETIME(3) NULL,
  last_activity_at DATETIME(3) NULL,
  release_reason VARCHAR(64) NULL,
  released_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_seat_index (tenant_id, room_id, seat_index),
  UNIQUE KEY uk_soc_lease_id (lease_id),
  KEY idx_soc_seat_expiry (lease_expires_at),
  KEY idx_soc_seat_subject (tenant_id, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_focus_state (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  focus_id VARCHAR(160) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  subject_id VARCHAR(160) NOT NULL,
  seat_index SMALLINT UNSIGNED NOT NULL,
  lease_id VARCHAR(160) NOT NULL,
  duration_minutes TINYINT UNSIGNED NOT NULL,
  focus_tag_code VARCHAR(32) NOT NULL,
  state VARCHAR(20) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  server_elapsed_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  qualified_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_focus_id (focus_id),
  KEY idx_soc_focus_subject_state (tenant_id, subject_id, state),
  CONSTRAINT ck_soc_focus_duration CHECK (duration_minutes IN (25,45))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_interaction (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(160) NOT NULL,
  client_event_id VARCHAR(160) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  sender_subject_id VARCHAR(160) NOT NULL,
  target_subject_id VARCHAR(160) NULL,
  target_seat_index SMALLINT UNSIGNED NULL,
  preset_code VARCHAR(32) NOT NULL,
  state VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  delivered_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_interaction_event (event_id),
  UNIQUE KEY uk_soc_interaction_client_event (tenant_id, sender_subject_id, client_event_id),
  CONSTRAINT ck_soc_interaction_preset CHECK (preset_code IN ('CHEER_UP','STUDY_TOGETHER','CONGRATS','TRY_AGAIN','TONIGHT_20_MIN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_leaderboard_projection (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(128) NOT NULL,
  leaderboard_kind VARCHAR(32) NOT NULL,
  period_type VARCHAR(16) NOT NULL,
  period_start DATE NOT NULL,
  subject_id VARCHAR(160) NOT NULL,
  score BIGINT NOT NULL,
  qualified_units BIGINT NOT NULL,
  source_watermark VARCHAR(160) NULL,
  projection_state VARCHAR(16) NOT NULL DEFAULT 'DELAYED',
  snapshot_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_projected_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_lb_entry (tenant_id, leaderboard_kind, period_type, period_start, subject_id),
  KEY idx_soc_lb_period (tenant_id, leaderboard_kind, period_type, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_report (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id VARCHAR(160) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  reporter_subject_id VARCHAR(160) NOT NULL,
  target_subject_id VARCHAR(160) NOT NULL,
  target_seat_index SMALLINT UNSIGNED NOT NULL,
  reason_code VARCHAR(32) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  client_event_id VARCHAR(160) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_report_id (report_id),
  UNIQUE KEY uk_soc_report_dedupe (tenant_id, room_id, reporter_subject_id, target_subject_id, reason_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_trusted_event_dedupe (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(160) NOT NULL,
  event_fingerprint CHAR(64) NOT NULL,
  source_service VARCHAR(96) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  trace_id VARCHAR(160) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soc_idempotency_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(128) NOT NULL,
  subject_id VARCHAR(160) NOT NULL,
  operation_scope VARCHAR(160) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  response_status SMALLINT UNSIGNED NOT NULL,
  response_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_soc_idempotency (tenant_id, subject_id, operation_scope, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
