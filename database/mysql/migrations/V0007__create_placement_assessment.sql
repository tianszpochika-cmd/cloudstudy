CREATE TABLE IF NOT EXISTS usr_learning_profile (
  learning_profile_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  target_goal VARCHAR(32) NOT NULL DEFAULT 'ZERO_BASIS',
  daily_quota_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  initial_cefr_level VARCHAR(8) NOT NULL DEFAULT 'A1',
  current_cefr_level VARCHAR(8) NOT NULL DEFAULT 'A1',
  estimated_vocabulary INT UNSIGNED NOT NULL DEFAULT 800,
  placement_skipped TINYINT(1) NOT NULL DEFAULT 0,
  profile_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (learning_profile_id),
  UNIQUE KEY uk_usr_learning_profile_user (user_id),
  CONSTRAINT chk_usr_learning_profile_level CHECK (initial_cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') AND current_cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户学习目标和定级结果快照';

CREATE TABLE IF NOT EXISTS asm_placement_item (
  placement_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assessment_version_id VARCHAR(128) NOT NULL,
  question_code VARCHAR(128) NOT NULL,
  dimension VARCHAR(32) NOT NULL,
  difficulty_level TINYINT UNSIGNED NOT NULL,
  options_json JSON NOT NULL,
  correct_answer_hash BINARY(32) NOT NULL,
  rules_version VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (placement_item_id),
  UNIQUE KEY uk_asm_placement_item_version_code (assessment_version_id, question_code),
  KEY idx_asm_placement_item_selection (assessment_version_id, dimension, difficulty_level),
  CONSTRAINT chk_asm_placement_item_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT chk_asm_placement_item_difficulty CHECK (difficulty_level BETWEEN 1 AND 6),
  CONSTRAINT chk_asm_placement_item_options CHECK (JSON_TYPE(options_json) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不可变规则化定级题目版本';

CREATE TABLE IF NOT EXISTS asm_placement_session (
  placement_session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_uuid CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  assessment_version_id VARCHAR(128) NOT NULL,
  rules_version VARCHAR(64) NOT NULL,
  current_step INT UNSIGNED NOT NULL DEFAULT 0,
  total_questions INT UNSIGNED NOT NULL DEFAULT 10,
  status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS',
  final_level VARCHAR(8) NULL,
  result_json JSON NULL,
  completed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (placement_session_id),
  UNIQUE KEY uk_asm_placement_session_uuid (session_uuid),
  KEY idx_asm_placement_session_user_status (user_id, status, created_at),
  CONSTRAINT chk_asm_placement_session_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='可重放的规则化定级会话';

CREATE TABLE IF NOT EXISTS asm_placement_attempt (
  placement_attempt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  placement_session_id BIGINT UNSIGNED NOT NULL,
  placement_item_id BIGINT UNSIGNED NOT NULL,
  idempotency_scope_key VARCHAR(192) NOT NULL,
  answer_key VARCHAR(8) NOT NULL,
  score_bucket VARCHAR(16) NOT NULL,
  time_spent_sec INT UNSIGNED NOT NULL,
  deduplicated TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (placement_attempt_id),
  UNIQUE KEY uk_asm_placement_attempt_idempotency (idempotency_scope_key),
  UNIQUE KEY uk_asm_placement_attempt_item (placement_session_id, placement_item_id),
  CONSTRAINT chk_asm_placement_attempt_bucket CHECK (score_bucket IN ('ZERO', 'LOW', 'MEDIUM', 'HIGH', 'FULL', 'WITHHELD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='单题作答事实；按会话题目幂等';
