-- B25 Phase 1 local real-data boundary.
--
-- These repository-level tables are a deterministic compatibility fixture. In a deployed
-- topology the equivalent facts live in the owning service schema and are migrated by that
-- service's Flyway runner. No table below is a cross-service write target. Cross-service
-- identifiers remain scalar references; the owner binding and Redis recipe tables are
-- reconciliation metadata, not a replacement for any domain service schema.

CREATE TABLE IF NOT EXISTS b25_fixture_run (
  fixture_run_id VARCHAR(96) NOT NULL,
  seed_version VARCHAR(64) NOT NULL,
  manifest_version VARCHAR(32) NOT NULL DEFAULT 'b25-phase1-v1',
  synthetic TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'READY',
  source_hash CHAR(64) NOT NULL,
  expected_counts_json JSON NOT NULL,
  actual_counts_json JSON NULL,
  owner_digest CHAR(64) NULL,
  redis_rebuild_status VARCHAR(24) NOT NULL DEFAULT 'NOT_RUN',
  last_replayed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (fixture_run_id),
  UNIQUE KEY uk_b25_fixture_seed (seed_version),
  CONSTRAINT chk_b25_fixture_synthetic CHECK (synthetic = 1),
  CONSTRAINT chk_b25_fixture_status CHECK (status IN ('READY', 'CLEARED')),
  CONSTRAINT chk_b25_fixture_hash CHECK (source_hash REGEXP '^[A-Fa-f0-9]{64}$'),
  CONSTRAINT chk_b25_fixture_counts CHECK (JSON_TYPE(expected_counts_json) = 'OBJECT'),
  CONSTRAINT chk_b25_fixture_actual_counts CHECK (actual_counts_json IS NULL OR JSON_TYPE(actual_counts_json) = 'OBJECT'),
  CONSTRAINT chk_b25_fixture_run_owner_digest CHECK (owner_digest IS NULL OR owner_digest REGEXP '^[A-Fa-f0-9]{64}$'),
  CONSTRAINT chk_b25_fixture_redis CHECK (redis_rebuild_status IN ('NOT_RUN', 'REBUILDABLE', 'FAILED', 'NOT_APPLICABLE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 synthetic fixture ledger';

CREATE TABLE IF NOT EXISTS lrn_b25_profile (
  principal_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  status VARCHAR(24) NOT NULL DEFAULT 'ONBOARDING',
  birth_year SMALLINT UNSIGNED NULL,
  age_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  privacy_consent TINYINT(1) NOT NULL DEFAULT 0,
  terms_consent TINYINT(1) NOT NULL DEFAULT 0,
  ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
  content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  theme_mode VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id),
  KEY idx_lrn_b25_profile_scope (tenant_id, status, updated_at),
  CONSTRAINT chk_lrn_b25_profile_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b25_profile_status CHECK (status IN ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  CONSTRAINT chk_lrn_b25_profile_age CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 learner onboarding/profile owner';

CREATE TABLE IF NOT EXISTS lrn_b25_goal (
  principal_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  goal_code VARCHAR(96) NOT NULL,
  target_level VARCHAR(8) NOT NULL,
  daily_quota_minutes SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  idempotency_key VARCHAR(192) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id),
  UNIQUE KEY uk_lrn_b25_goal_idempotency (tenant_id, idempotency_key),
  CONSTRAINT chk_lrn_b25_goal_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b25_goal_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT chk_lrn_b25_goal_minutes CHECK (daily_quota_minutes IN (5, 15, 30, 45, 60))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 learner goal owner';

CREATE TABLE IF NOT EXISTS lrn_b25_preferences (
  principal_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
  content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  theme_mode VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
  high_contrast TINYINT(1) NOT NULL DEFAULT 0,
  motion_mode VARCHAR(16) NOT NULL DEFAULT 'FULL',
  idempotency_key VARCHAR(192) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id),
  UNIQUE KEY uk_lrn_b25_preferences_idempotency (tenant_id, idempotency_key),
  CONSTRAINT chk_lrn_b25_preferences_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b25_preferences_theme CHECK (theme_mode IN ('LIGHT', 'DARK', 'SYSTEM', 'HIGH_CONTRAST')),
  CONSTRAINT chk_lrn_b25_preferences_motion CHECK (motion_mode IN ('FULL', 'REDUCED', 'OFF'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 learner preferences owner';

CREATE TABLE IF NOT EXISTS lrn_b25_daily_task (
  task_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  principal_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  content_code VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  task_type VARCHAR(24) NOT NULL DEFAULT 'LESSON',
  minutes SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  task_status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
  task_order INT UNSIGNED NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(192) NOT NULL,
  completed_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (task_id),
  UNIQUE KEY uk_lrn_b25_task_owner_content (principal_id, content_code),
  UNIQUE KEY uk_lrn_b25_task_idempotency (tenant_id, idempotency_key),
  KEY idx_lrn_b25_task_owner (tenant_id, principal_id, task_status, task_order),
  CONSTRAINT chk_lrn_b25_task_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b25_task_status CHECK (task_status IN ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 learner-owned daily task projection';

CREATE TABLE IF NOT EXISTS cnt_b25_course (
  content_code VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  content_type VARCHAR(32) NOT NULL DEFAULT 'COURSE',
  title VARCHAR(255) NOT NULL,
  summary VARCHAR(2048) NULL,
  content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  target_level VARCHAR(8) NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
  rights_status VARCHAR(24) NOT NULL DEFAULT 'VALID',
  definition_json JSON NOT NULL,
  published_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_code),
  KEY idx_cnt_b25_catalog (tenant_id, availability, rights_status, content_locale, target_level),
  CONSTRAINT chk_cnt_b25_course_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_cnt_b25_course_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT chk_cnt_b25_course_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY')),
  CONSTRAINT chk_cnt_b25_course_rights CHECK (rights_status IN ('VALID', 'PENDING', 'EXPIRED', 'REVOKED')),
  CONSTRAINT chk_cnt_b25_course_payload CHECK (JSON_TYPE(definition_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 content-service published course owner';

CREATE TABLE IF NOT EXISTS cnt_b25_item (
  item_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  content_code VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  item_type VARCHAR(32) NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  prompt VARCHAR(2048) NOT NULL,
  options_json JSON NOT NULL,
  answer_rule_json JSON NOT NULL,
  media_ref VARCHAR(512) NULL,
  PRIMARY KEY (item_id),
  UNIQUE KEY uk_cnt_b25_item_order (content_code, display_order),
  KEY idx_cnt_b25_item_content (tenant_id, content_code),
  CONSTRAINT chk_cnt_b25_item_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_cnt_b25_item_options CHECK (JSON_TYPE(options_json) = 'ARRAY'),
  CONSTRAINT chk_cnt_b25_item_rule CHECK (JSON_TYPE(answer_rule_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 content item and private answer rule owner';

CREATE TABLE IF NOT EXISTS lrn_b25_plan (
  plan_id CHAR(36) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  principal_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  target_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  plan_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (plan_id),
  UNIQUE KEY uk_lrn_b25_plan_owner (tenant_id, principal_id),
  CONSTRAINT chk_lrn_b25_plan_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 learning plan owner';

CREATE TABLE IF NOT EXISTS lrn_b25_srs_state (
  principal_id VARCHAR(128) NOT NULL,
  item_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  stage VARCHAR(24) NOT NULL DEFAULT 'NEW',
  due_at DATETIME(6) NOT NULL,
  interval_days INT UNSIGNED NOT NULL DEFAULT 0,
  ease_factor DECIMAL(5,2) NOT NULL DEFAULT 2.50,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id, item_id),
  KEY idx_lrn_b25_srs_due (tenant_id, principal_id, due_at),
  CONSTRAINT chk_lrn_b25_srs_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b25_srs_stage CHECK (stage IN ('NEW', 'LEARNING', 'REVIEW', 'MASTERED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 learning SRS owner';

CREATE TABLE IF NOT EXISTS asm_b25_session (
  session_id CHAR(36) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  principal_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  content_code VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
  answers_json JSON NOT NULL,
  score DECIMAL(6,3) NULL,
  report_id CHAR(36) NULL,
  idempotency_key VARCHAR(192) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (session_id),
  UNIQUE KEY uk_asm_b25_session_idempotency (tenant_id, principal_id, idempotency_key),
  KEY idx_asm_b25_session_owner (tenant_id, principal_id, status, updated_at),
  CONSTRAINT chk_asm_b25_session_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_asm_b25_session_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'EXPIRED')),
  CONSTRAINT chk_asm_b25_session_answers CHECK (JSON_TYPE(answers_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 assessment session owner';

CREATE TABLE IF NOT EXISTS asm_b25_report (
  report_id CHAR(36) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  session_id CHAR(36) NOT NULL,
  principal_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  cefr_level VARCHAR(8) NOT NULL,
  score DECIMAL(6,3) NOT NULL,
  radar_json JSON NOT NULL,
  mistakes_json JSON NOT NULL,
  report_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (report_id),
  UNIQUE KEY uk_asm_b25_report_session (session_id),
  KEY idx_asm_b25_report_owner (tenant_id, principal_id, created_at),
  CONSTRAINT chk_asm_b25_report_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_asm_b25_report_level CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT chk_asm_b25_report_json CHECK (JSON_TYPE(radar_json) = 'OBJECT' AND JSON_TYPE(mistakes_json) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 assessment report snapshot owner';

CREATE TABLE IF NOT EXISTS ntf_b25_preference (
  principal_id VARCHAR(128) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  learning_reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
  marketing_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (principal_id),
  CONSTRAINT chk_ntf_b25_preference_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 notification preference owner';

CREATE TABLE IF NOT EXISTS ntf_b25_message (
  message_id CHAR(36) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  principal_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  template_code VARCHAR(96) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'UNREAD',
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (message_id),
  KEY idx_ntf_b25_message_owner (tenant_id, principal_id, status, created_at),
  CONSTRAINT chk_ntf_b25_message_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_ntf_b25_message_status CHECK (status IN ('UNREAD', 'READ', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 notification read projection owner';

-- Fixture control-plane metadata. These rows bind a fixture to exactly one
-- logical service owner and make row-count/digest reconciliation deterministic.
CREATE TABLE IF NOT EXISTS b25_fixture_owner_binding (
  binding_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fixture_run_id VARCHAR(96) NOT NULL,
  owner_service VARCHAR(64) NOT NULL,
  logical_schema VARCHAR(128) NOT NULL,
  source_table VARCHAR(128) NOT NULL,
  migration_version VARCHAR(32) NOT NULL,
  redis_namespace VARCHAR(96) NOT NULL,
  write_authority VARCHAR(96) NOT NULL,
  expected_row_count INT UNSIGNED NOT NULL,
  expected_digest CHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (binding_id),
  UNIQUE KEY uk_b25_fixture_owner_table (fixture_run_id, owner_service, source_table),
  KEY idx_b25_fixture_owner_schema (owner_service, logical_schema, migration_version),
  CONSTRAINT chk_b25_fixture_owner_count CHECK (expected_row_count > 0),
  CONSTRAINT chk_b25_owner_binding_digest CHECK (expected_digest REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_b25_fixture_owner_authority CHECK (write_authority REGEXP '^[a-z][a-z0-9-]+-only$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 owner/schema reconciliation binding';

CREATE TABLE IF NOT EXISTS b25_fixture_row (
  fixture_row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fixture_run_id VARCHAR(96) NOT NULL,
  owner_service VARCHAR(64) NOT NULL,
  logical_schema VARCHAR(128) NOT NULL,
  source_table VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_key VARCHAR(192) NOT NULL,
  canonical_payload_json JSON NOT NULL,
  row_digest CHAR(64) NOT NULL,
  source_of_truth VARCHAR(16) NOT NULL DEFAULT 'MYSQL',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (fixture_row_id),
  UNIQUE KEY uk_b25_fixture_row_key (fixture_run_id, owner_service, entity_type, entity_key),
  KEY idx_b25_fixture_row_owner_table (owner_service, logical_schema, source_table),
  CONSTRAINT chk_b25_fixture_row_payload CHECK (JSON_TYPE(canonical_payload_json) = 'OBJECT'),
  CONSTRAINT chk_b25_fixture_row_digest CHECK (row_digest REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_b25_fixture_row_source CHECK (source_of_truth = 'MYSQL')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 canonical fixture row and digest ledger';

CREATE TABLE IF NOT EXISTS b25_fixture_redis_projection (
  projection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fixture_run_id VARCHAR(96) NOT NULL,
  owner_service VARCHAR(64) NOT NULL,
  redis_namespace VARCHAR(96) NOT NULL,
  key_template VARCHAR(256) NOT NULL,
  source_table VARCHAR(128) NOT NULL,
  source_entity_key VARCHAR(192) NOT NULL,
  ttl_seconds INT UNSIGNED NOT NULL,
  rebuild_version VARCHAR(32) NOT NULL,
  rebuild_strategy VARCHAR(128) NOT NULL,
  projection_state VARCHAR(24) NOT NULL DEFAULT 'REBUILDABLE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (projection_id),
  UNIQUE KEY uk_b25_fixture_redis_projection (fixture_run_id, redis_namespace, key_template, source_entity_key),
  KEY idx_b25_fixture_redis_source (owner_service, source_table, source_entity_key),
  CONSTRAINT chk_b25_fixture_redis_ttl CHECK (ttl_seconds > 0),
  CONSTRAINT chk_b25_fixture_redis_state CHECK (projection_state IN ('REBUILDABLE', 'REBUILT', 'STALE')),
  CONSTRAINT chk_b25_fixture_redis_strategy CHECK (rebuild_strategy = 'MYSQL_OWNER_ROWS')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 Redis projection recipe; MySQL remains source of truth';

-- Additional content-service compatibility facts. These contain explicit unit,
-- vocabulary and protected rule rows while keeping all cross-service references scalar.
CREATE TABLE IF NOT EXISTS cnt_b25_unit (
  unit_id VARCHAR(96) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  course_code VARCHAR(128) NOT NULL,
  unit_code VARCHAR(128) NOT NULL,
  unit_order INT UNSIGNED NOT NULL,
  title_key VARCHAR(192) NOT NULL,
  content_version INT UNSIGNED NOT NULL,
  availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
  rights_status VARCHAR(24) NOT NULL DEFAULT 'VALID',
  published_at DATETIME(6) NOT NULL,
  row_digest CHAR(64) NOT NULL,
  PRIMARY KEY (unit_id),
  UNIQUE KEY uk_cnt_b25_unit_code (unit_code),
  UNIQUE KEY uk_cnt_b25_unit_course_order (course_code, unit_order),
  KEY idx_cnt_b25_unit_catalog (course_code, availability, unit_order),
  CONSTRAINT chk_cnt_b25_unit_order CHECK (unit_order > 0),
  CONSTRAINT chk_cnt_b25_unit_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY')),
  CONSTRAINT chk_cnt_b25_unit_rights CHECK (rights_status IN ('VALID', 'PENDING', 'EXPIRED', 'REVOKED')),
  CONSTRAINT chk_cnt_b25_unit_digest CHECK (row_digest REGEXP '^[0-9a-fA-F]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 content-service published unit fixture';

CREATE TABLE IF NOT EXISTS cnt_b25_vocabulary (
  vocabulary_id VARCHAR(96) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  unit_code VARCHAR(128) NOT NULL,
  word_normalized VARCHAR(128) NOT NULL,
  meaning_key VARCHAR(192) NOT NULL,
  cefr_level VARCHAR(8) NOT NULL,
  content_version INT UNSIGNED NOT NULL,
  availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
  audio_ref VARCHAR(192) NULL,
  row_digest CHAR(64) NOT NULL,
  PRIMARY KEY (vocabulary_id),
  UNIQUE KEY uk_cnt_b25_vocabulary_word (word_normalized),
  KEY idx_cnt_b25_vocabulary_unit (unit_code, availability),
  CONSTRAINT chk_cnt_b25_vocabulary_level CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT chk_cnt_b25_vocabulary_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED')),
  CONSTRAINT chk_cnt_b25_vocabulary_digest CHECK (row_digest REGEXP '^[0-9a-fA-F]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 content-service published vocabulary fixture';

CREATE TABLE IF NOT EXISTS cnt_b25_answer_rule (
  rule_id VARCHAR(96) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  rule_ref VARCHAR(192) NOT NULL,
  rule_version VARCHAR(32) NOT NULL,
  algorithm_code VARCHAR(64) NOT NULL,
  rule_definition_json JSON NOT NULL,
  rule_digest CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (rule_id),
  UNIQUE KEY uk_cnt_b25_answer_rule_ref (rule_ref, rule_version),
  CONSTRAINT chk_cnt_b25_answer_rule_definition CHECK (JSON_TYPE(rule_definition_json) = 'OBJECT'),
  CONSTRAINT chk_cnt_b25_answer_rule_digest CHECK (rule_digest REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_cnt_b25_answer_rule_status CHECK (status IN ('ACTIVE', 'RETIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 content-service protected answer-rule fixture';

-- media-service compatibility fixture. No object bytes, permanent signed URL or
-- provider credential is stored; resource_ref is a local synthetic locator only.
CREATE TABLE IF NOT EXISTS med_b25_media_reference (
  media_id VARCHAR(96) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  content_item_ref VARCHAR(192) NOT NULL,
  media_ref VARCHAR(192) NOT NULL,
  media_kind VARCHAR(32) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  resource_ref VARCHAR(256) NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  rights_ref_hash CHAR(64) NOT NULL,
  rights_status VARCHAR(24) NOT NULL,
  asset_status VARCHAR(24) NOT NULL,
  storage_provider VARCHAR(32) NOT NULL DEFAULT 'LOCAL_FIXTURE',
  row_digest CHAR(64) NOT NULL,
  PRIMARY KEY (media_id),
  UNIQUE KEY uk_med_b25_media_ref (media_ref),
  KEY idx_med_b25_media_item (content_item_ref, rights_status, asset_status),
  CONSTRAINT chk_med_b25_media_kind CHECK (media_kind IN ('AUDIO', 'IMAGE', 'VIDEO')),
  CONSTRAINT chk_med_b25_media_checksum CHECK (checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_med_b25_media_rights_hash CHECK (rights_ref_hash REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_med_b25_media_rights CHECK (rights_status IN ('AUTHORIZED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT chk_med_b25_media_status CHECK (asset_status IN ('READY', 'REVOKED')),
  CONSTRAINT chk_med_b25_media_provider CHECK (storage_provider = 'LOCAL_FIXTURE'),
  CONSTRAINT chk_med_b25_media_digest CHECK (row_digest REGEXP '^[0-9a-fA-F]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 media reference fixture; no raw media bytes';

-- commerce-service compatibility fixtures. Payment remains explicitly disabled.
CREATE TABLE IF NOT EXISTS com_b25_product (
  product_id VARCHAR(96) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  sku_code VARCHAR(128) NOT NULL,
  title_key VARCHAR(192) NOT NULL,
  entitlement_code VARCHAR(128) NOT NULL,
  billing_period VARCHAR(32) NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  publication_state VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
  payment_state VARCHAR(24) NOT NULL DEFAULT 'DISABLED',
  row_digest CHAR(64) NOT NULL,
  PRIMARY KEY (product_id),
  UNIQUE KEY uk_com_b25_product_sku (sku_code),
  KEY idx_com_b25_product_catalog (publication_state, payment_state),
  CONSTRAINT chk_com_b25_product_publication CHECK (publication_state IN ('PUBLISHED', 'UNPUBLISHED')),
  CONSTRAINT chk_com_b25_product_payment CHECK (payment_state = 'DISABLED'),
  CONSTRAINT chk_com_b25_product_digest CHECK (row_digest REGEXP '^[0-9a-fA-F]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 commerce product fixture; real payment disabled';

CREATE TABLE IF NOT EXISTS com_b25_entitlement (
  entitlement_id VARCHAR(96) NOT NULL,
  fixture_run_id VARCHAR(96) NULL,
  subject_ref VARCHAR(128) NOT NULL,
  sku_code VARCHAR(128) NOT NULL,
  entitlement_code VARCHAR(128) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'DEV_FIXTURE',
  source_ref VARCHAR(128) NOT NULL,
  state VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  payment_state VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED',
  starts_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  row_digest CHAR(64) NOT NULL,
  PRIMARY KEY (entitlement_id),
  UNIQUE KEY uk_com_b25_entitlement_source (source_type, source_ref),
  KEY idx_com_b25_entitlement_subject (subject_ref, state, expires_at),
  CONSTRAINT chk_com_b25_entitlement_source CHECK (source_type = 'DEV_FIXTURE'),
  CONSTRAINT chk_com_b25_entitlement_state CHECK (state IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  CONSTRAINT chk_com_b25_entitlement_payment CHECK (payment_state = 'NOT_REQUIRED'),
  CONSTRAINT chk_com_b25_entitlement_window CHECK (expires_at > starts_at),
  CONSTRAINT chk_com_b25_entitlement_digest CHECK (row_digest REGEXP '^[0-9a-fA-F]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B25 synthetic commerce entitlement fixture';
