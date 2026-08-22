-- B6: cross-platform build evidence, quality runs, observability, recovery and release gates.
-- This migration stores evidence and state transitions; execution against real devices and stores is test/release stage work.
CREATE TABLE IF NOT EXISTS plt_build_artifact (
  build_id VARCHAR(128) PRIMARY KEY,
  platform_code VARCHAR(32) NOT NULL,
  build_version VARCHAR(32) NOT NULL,
  source_revision VARCHAR(64) NOT NULL,
  artifact_ref VARCHAR(255) NOT NULL,
  artifact_sha256 CHAR(64) NOT NULL,
  artifact_size_bytes BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  capabilities_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plt_build_identity (platform_code, build_version, source_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plt_platform_check (
  check_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  build_id VARCHAR(128) NOT NULL,
  platform_code VARCHAR(32) NOT NULL,
  viewport_code VARCHAR(32) NOT NULL,
  orientation VARCHAR(16) NOT NULL,
  overflow_count INT UNSIGNED NOT NULL DEFAULT 0,
  keyboard_reachable TINYINT(1) NOT NULL DEFAULT 0,
  touch_target_failures INT UNSIGNED NOT NULL DEFAULT 0,
  result_code VARCHAR(24) NOT NULL,
  evidence_ref VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plt_check_identity (build_id, platform_code, viewport_code, orientation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plt_performance_budget (
  budget_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level_code VARCHAR(24) NOT NULL,
  motion_scale DECIMAL(4,2) NOT NULL,
  particle_budget INT UNSIGNED NOT NULL,
  texture_budget_mb INT UNSIGNED NOT NULL,
  three_d_enabled TINYINT(1) NOT NULL,
  waveform_enabled TINYINT(1) NOT NULL,
  rive_enabled TINYINT(1) NOT NULL,
  rule_version VARCHAR(64) NOT NULL,
  UNIQUE KEY uk_plt_budget_level (level_code, rule_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plt_accessibility_check (
  check_code VARCHAR(64) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  required_for_release TINYINT(1) NOT NULL DEFAULT 1,
  fallback_rule VARCHAR(255) NOT NULL,
  rule_version VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS qly_e2e_run (
  run_id VARCHAR(128) PRIMARY KEY,
  scenario_code VARCHAR(80) NOT NULL,
  surface_code VARCHAR(32) NOT NULL,
  platform_code VARCHAR(32) NOT NULL,
  source_revision VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  passed_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  evidence_ref VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_qly_e2e_identity (scenario_code, platform_code, source_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS qly_security_scan (
  scan_id VARCHAR(128) PRIMARY KEY,
  scan_type VARCHAR(32) NOT NULL,
  source_revision VARCHAR(64) NOT NULL,
  rule_version VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  critical_count INT UNSIGNED NOT NULL DEFAULT 0,
  high_count INT UNSIGNED NOT NULL DEFAULT 0,
  medium_count INT UNSIGNED NOT NULL DEFAULT 0,
  sensitive_finding_count INT UNSIGNED NOT NULL DEFAULT 0,
  report_ref VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_qly_security_identity (scan_type, source_revision, rule_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS qly_reliability_run (
  run_id VARCHAR(128) PRIMARY KEY,
  run_type VARCHAR(32) NOT NULL,
  source_revision VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  duplicate_write_count INT UNSIGNED NOT NULL DEFAULT 0,
  lost_write_count INT UNSIGNED NOT NULL DEFAULT 0,
  retry_success_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  p95_latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
  report_ref VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_qly_reliability_identity (run_type, source_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS obs_alert (
  alert_id VARCHAR(128) PRIMARY KEY,
  alert_code VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(24) NOT NULL,
  request_ref VARCHAR(128) NOT NULL,
  error_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_obs_alert_status_time (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rel_backup_drill (
  drill_id VARCHAR(128) PRIMARY KEY,
  drill_type VARCHAR(40) NOT NULL,
  source_revision VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  rto_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  rpo_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  restored_resource_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_resource_count INT UNSIGNED NOT NULL DEFAULT 0,
  backup_ref VARCHAR(255) NOT NULL,
  rollback_ref VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rel_drill_identity (drill_type, source_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rel_release_gate (
  gate_id VARCHAR(128) PRIMARY KEY,
  release_version VARCHAR(32) NOT NULL,
  candidate_builds_json JSON NOT NULL,
  required_checks_json JSON NOT NULL,
  privacy_status VARCHAR(24) NOT NULL,
  copyright_status VARCHAR(24) NOT NULL,
  merchant_status VARCHAR(24) NOT NULL,
  platform_review_status VARCHAR(24) NOT NULL,
  rollback_plan_ref VARCHAR(255) NOT NULL,
  decision VARCHAR(24) NOT NULL,
  blockers_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rel_gate_identity (release_version, rollback_plan_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
