-- B9 learner/content migration fixture.
--
-- The production services run these tables in their own Flyway schemas. The repository-level
-- migration keeps a deterministic local compatibility fixture with service-prefixed tables;
-- no service may write another service's tables. Public projection tables intentionally contain
-- only allow-listed fields and never persist answer rules.

CREATE TABLE IF NOT EXISTS lrn_b9_profile (
  profile_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  principal_id VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ONBOARDING',
  ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
  content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  source_code VARCHAR(24) NOT NULL DEFAULT 'OWNED',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (profile_id),
  UNIQUE KEY uk_lrn_b9_profile_principal (tenant_id, principal_id),
  KEY idx_lrn_b9_profile_status (tenant_id, status, updated_at),
  CONSTRAINT chk_lrn_b9_profile_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b9_profile_status CHECK (status IN ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  CONSTRAINT chk_lrn_b9_profile_source CHECK (source_code IN ('OWNED', 'LEGACY_SHADOW'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 learner-service profile owner';

CREATE TABLE IF NOT EXISTS lrn_b9_goal (
  goal_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  goal_code VARCHAR(96) NOT NULL,
  target_level VARCHAR(8) NOT NULL,
  daily_quota_minutes SMALLINT UNSIGNED NOT NULL,
  target_date DATE NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(192) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (goal_id),
  UNIQUE KEY uk_lrn_b9_goal_profile (profile_id),
  UNIQUE KEY uk_lrn_b9_goal_idempotency (tenant_id, idempotency_key),
  KEY idx_lrn_b9_goal_status (tenant_id, status, target_date),
  CONSTRAINT fk_lrn_b9_goal_profile FOREIGN KEY (profile_id) REFERENCES lrn_b9_profile (profile_id),
  CONSTRAINT chk_lrn_b9_goal_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b9_goal_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT chk_lrn_b9_goal_minutes CHECK (daily_quota_minutes IN (5, 15, 30, 45, 60)),
  CONSTRAINT chk_lrn_b9_goal_status CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 learner target and goal fact';

CREATE TABLE IF NOT EXISTS lrn_b9_preferences (
  preferences_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
  content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  theme_mode VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
  high_contrast TINYINT(1) NOT NULL DEFAULT 0,
  motion_mode VARCHAR(16) NOT NULL DEFAULT 'FULL',
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(192) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (preferences_id),
  UNIQUE KEY uk_lrn_b9_preferences_profile (profile_id),
  UNIQUE KEY uk_lrn_b9_preferences_idempotency (tenant_id, idempotency_key),
  CONSTRAINT fk_lrn_b9_preferences_profile FOREIGN KEY (profile_id) REFERENCES lrn_b9_profile (profile_id),
  CONSTRAINT chk_lrn_b9_preferences_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b9_preferences_theme CHECK (theme_mode IN ('LIGHT', 'DARK', 'SYSTEM')),
  CONSTRAINT chk_lrn_b9_preferences_motion CHECK (motion_mode IN ('FULL', 'REDUCED', 'OFF'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 learner UI/content preference fact';

CREATE TABLE IF NOT EXISTS lrn_b9_first_day_projection (
  projection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  projection_state VARCHAR(16) NOT NULL DEFAULT 'NOT_READY',
  placement_status VARCHAR(24) NOT NULL DEFAULT 'NOT_STARTED',
  task_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  task_refs_json JSON NOT NULL,
  content_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0,
  projection_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  generated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (projection_id),
  UNIQUE KEY uk_lrn_b9_first_day_profile (profile_id),
  KEY idx_lrn_b9_first_day_state (tenant_id, projection_state, generated_at),
  CONSTRAINT fk_lrn_b9_first_day_profile FOREIGN KEY (profile_id) REFERENCES lrn_b9_profile (profile_id),
  CONSTRAINT chk_lrn_b9_first_day_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b9_first_day_state CHECK (projection_state IN ('NOT_READY', 'READY', 'DEGRADED')),
  CONSTRAINT chk_lrn_b9_first_day_placement CHECK (placement_status IN ('NOT_STARTED', 'IN_PROGRESS', 'SKIPPED', 'COMPLETED', 'UNAVAILABLE')),
  CONSTRAINT chk_lrn_b9_first_day_tasks CHECK (JSON_TYPE(task_refs_json) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 learner first-day/home read projection';

CREATE TABLE IF NOT EXISTS lrn_b9_idempotency_key (
  idempotency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  principal_id VARCHAR(128) NOT NULL,
  scope_code VARCHAR(96) NOT NULL,
  idempotency_key VARCHAR(192) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_json JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'COMPLETED',
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (idempotency_id),
  UNIQUE KEY uk_lrn_b9_idempotency (tenant_id, principal_id, scope_code, idempotency_key),
  KEY idx_lrn_b9_idempotency_expiry (expires_at, status),
  CONSTRAINT chk_lrn_b9_idempotency_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b9_idempotency_hash CHECK (request_hash REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_lrn_b9_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 learner command idempotency ledger';

CREATE TABLE IF NOT EXISTS lrn_b9_outbox_event (
  outbox_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  event_name VARCHAR(128) NOT NULL,
  schema_version VARCHAR(64) NOT NULL DEFAULT 'learner.event.v1',
  event_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
  actor_id VARCHAR(128) NOT NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  payload_json JSON NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  trace_id VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (outbox_id),
  UNIQUE KEY uk_lrn_b9_outbox_event (event_id),
  UNIQUE KEY uk_lrn_b9_outbox_dedupe (dedupe_key),
  KEY idx_lrn_b9_outbox_dispatch (status, occurred_at),
  CONSTRAINT chk_lrn_b9_outbox_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_lrn_b9_outbox_schema CHECK (schema_version REGEXP '^[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+$'),
  CONSTRAINT chk_lrn_b9_outbox_version CHECK (event_version >= 1),
  CONSTRAINT chk_lrn_b9_outbox_actor CHECK (CHAR_LENGTH(actor_id) BETWEEN 1 AND 64),
  CONSTRAINT chk_lrn_b9_outbox_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED', 'DLQ')),
  CONSTRAINT chk_lrn_b9_outbox_payload CHECK (JSON_TYPE(payload_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 learner-service transactional outbox';

CREATE TABLE IF NOT EXISTS cnt_b9_content_definition (
  content_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  content_code VARCHAR(128) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  target_level VARCHAR(8) NOT NULL,
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  current_published_version_id BIGINT UNSIGNED NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_id),
  UNIQUE KEY uk_cnt_b9_content_code (tenant_id, content_code),
  KEY idx_cnt_b9_content_type_level (tenant_id, content_type, target_level),
  CONSTRAINT chk_cnt_b9_content_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_cnt_b9_content_type CHECK (content_type IN ('COURSE', 'COURSE_UNIT', 'VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'QUESTION')),
  CONSTRAINT chk_cnt_b9_content_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 content-service definition owner';

CREATE TABLE IF NOT EXISTS cnt_b9_content_version (
  content_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  version_number INT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  definition_json JSON NOT NULL,
  content_hash CHAR(64) NOT NULL,
  source_code VARCHAR(96) NOT NULL,
  license_code VARCHAR(96) NOT NULL,
  editor_actor VARCHAR(128) NOT NULL,
  first_reviewer_actor VARCHAR(128) NULL,
  final_reviewer_actor VARCHAR(128) NULL,
  publisher_actor VARCHAR(128) NULL,
  rollback_of_version_id BIGINT UNSIGNED NULL,
  published_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_version_id),
  UNIQUE KEY uk_cnt_b9_version_number (content_id, version_number),
  KEY idx_cnt_b9_version_status (tenant_id, status, content_id),
  CONSTRAINT fk_cnt_b9_version_content FOREIGN KEY (content_id) REFERENCES cnt_b9_content_definition (content_id),
  CONSTRAINT fk_cnt_b9_version_rollback FOREIGN KEY (rollback_of_version_id) REFERENCES cnt_b9_content_version (content_version_id),
  CONSTRAINT chk_cnt_b9_version_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_cnt_b9_version_status CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'ROLLED_BACK', 'ARCHIVED')),
  CONSTRAINT chk_cnt_b9_version_hash CHECK (content_hash REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_cnt_b9_version_payload CHECK (JSON_TYPE(definition_json) = 'OBJECT'),
  CONSTRAINT chk_cnt_b9_version_reviewers CHECK (
    (first_reviewer_actor IS NULL OR first_reviewer_actor <> editor_actor) AND
    (final_reviewer_actor IS NULL OR final_reviewer_actor <> editor_actor)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 immutable content version and review state';

CREATE TABLE IF NOT EXISTS cnt_b9_content_item (
  item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(128) NOT NULL,
  item_type VARCHAR(32) NOT NULL,
  display_order INT UNSIGNED NOT NULL,
  stimulus_ref VARCHAR(512) NOT NULL,
  display_text VARCHAR(1024) NULL,
  definition_json JSON NOT NULL,
  answer_rule_version VARCHAR(96) NULL,
  PRIMARY KEY (item_id),
  UNIQUE KEY uk_cnt_b9_item_code (content_version_id, item_code),
  KEY idx_cnt_b9_item_order (content_version_id, display_order),
  CONSTRAINT fk_cnt_b9_item_version FOREIGN KEY (content_version_id) REFERENCES cnt_b9_content_version (content_version_id),
  CONSTRAINT chk_cnt_b9_item_type CHECK (item_type IN ('VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'QUESTION')),
  CONSTRAINT chk_cnt_b9_item_definition CHECK (JSON_TYPE(definition_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 internal content item; answer rules never enter public projection';

CREATE TABLE IF NOT EXISTS cnt_b9_content_rights (
  rights_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  source_code VARCHAR(96) NOT NULL,
  license_code VARCHAR(96) NOT NULL,
  rights_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  permitted_channels_json JSON NOT NULL,
  evidence_ref VARCHAR(512) NULL,
  starts_at DATETIME(6) NULL,
  expires_at DATETIME(6) NULL,
  PRIMARY KEY (rights_id),
  UNIQUE KEY uk_cnt_b9_rights_version (content_version_id),
  KEY idx_cnt_b9_rights_status_window (rights_status, starts_at, expires_at),
  CONSTRAINT fk_cnt_b9_rights_version FOREIGN KEY (content_version_id) REFERENCES cnt_b9_content_version (content_version_id),
  CONSTRAINT chk_cnt_b9_rights_status CHECK (rights_status IN ('PENDING', 'VALID', 'EXPIRED', 'REVOKED')),
  CONSTRAINT chk_cnt_b9_rights_channels CHECK (JSON_TYPE(permitted_channels_json) = 'ARRAY'),
  CONSTRAINT chk_cnt_b9_rights_window CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
  CONSTRAINT chk_cnt_b9_rights_evidence CHECK (rights_status <> 'VALID' OR evidence_ref IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 content copyright and channel rights';

CREATE TABLE IF NOT EXISTS cnt_b9_review_task (
  review_task_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  review_stage VARCHAR(16) NOT NULL,
  reviewer_actor VARCHAR(128) NULL,
  decision VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  reason_code VARCHAR(96) NULL,
  note TEXT NULL,
  decided_at DATETIME(6) NULL,
  PRIMARY KEY (review_task_id),
  UNIQUE KEY uk_cnt_b9_review_stage (content_version_id, review_stage),
  KEY idx_cnt_b9_review_pending (decision, review_stage, decided_at),
  CONSTRAINT fk_cnt_b9_review_version FOREIGN KEY (content_version_id) REFERENCES cnt_b9_content_version (content_version_id),
  CONSTRAINT chk_cnt_b9_review_stage CHECK (review_stage IN ('FIRST', 'FINAL')),
  CONSTRAINT chk_cnt_b9_review_decision CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED')),
  CONSTRAINT chk_cnt_b9_review_actor CHECK (decision = 'PENDING' OR reviewer_actor IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 content dual-review workflow task';

CREATE TABLE IF NOT EXISTS cnt_b9_public_projection (
  projection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  projection_key VARCHAR(192) NOT NULL,
  content_code VARCHAR(128) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary VARCHAR(2048) NULL,
  content_locale VARCHAR(16) NOT NULL,
  target_level VARCHAR(8) NOT NULL,
  projection_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  content_epoch BIGINT UNSIGNED NOT NULL DEFAULT 1,
  availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
  public_items_json JSON NOT NULL,
  cache_tag VARCHAR(192) NOT NULL,
  published_at DATETIME(6) NOT NULL,
  PRIMARY KEY (projection_id),
  UNIQUE KEY uk_cnt_b9_public_projection_key (projection_key),
  KEY idx_cnt_b9_public_catalog (availability, content_type, target_level, projection_id),
  CONSTRAINT fk_cnt_b9_public_version FOREIGN KEY (content_version_id) REFERENCES cnt_b9_content_version (content_version_id),
  CONSTRAINT chk_cnt_b9_public_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY')),
  CONSTRAINT chk_cnt_b9_public_items CHECK (JSON_TYPE(public_items_json) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 allow-listed public content projection; no answer rules';

CREATE TABLE IF NOT EXISTS cnt_b9_public_cache_epoch (
  cache_epoch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  projection_scope VARCHAR(96) NOT NULL,
  content_epoch BIGINT UNSIGNED NOT NULL,
  invalidation_reason VARCHAR(64) NOT NULL,
  invalidated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (cache_epoch_id),
  UNIQUE KEY uk_cnt_b9_cache_scope (projection_scope),
  KEY idx_cnt_b9_cache_time (invalidated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 public projection cache invalidation epoch';

CREATE TABLE IF NOT EXISTS cnt_b9_idempotency_key (
  idempotency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  actor_subject VARCHAR(128) NOT NULL,
  command_code VARCHAR(96) NOT NULL,
  idempotency_key VARCHAR(192) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_json JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'COMPLETED',
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (idempotency_id),
  UNIQUE KEY uk_cnt_b9_idempotency (tenant_id, actor_subject, command_code, idempotency_key),
  KEY idx_cnt_b9_idempotency_expiry (expires_at, status),
  CONSTRAINT chk_cnt_b9_idempotency_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_cnt_b9_idempotency_hash CHECK (request_hash REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_cnt_b9_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 content command idempotency ledger';

CREATE TABLE IF NOT EXISTS cnt_b9_outbox_event (
  outbox_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  event_name VARCHAR(128) NOT NULL,
  schema_version VARCHAR(64) NOT NULL DEFAULT 'content.event.v1',
  event_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
  actor_id VARCHAR(128) NOT NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  payload_json JSON NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  trace_id VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (outbox_id),
  UNIQUE KEY uk_cnt_b9_outbox_event (event_id),
  UNIQUE KEY uk_cnt_b9_outbox_dedupe (dedupe_key),
  KEY idx_cnt_b9_outbox_dispatch (status, occurred_at),
  CONSTRAINT chk_cnt_b9_outbox_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_cnt_b9_outbox_schema CHECK (schema_version REGEXP '^[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+$'),
  CONSTRAINT chk_cnt_b9_outbox_version CHECK (event_version >= 1),
  CONSTRAINT chk_cnt_b9_outbox_actor CHECK (CHAR_LENGTH(actor_id) BETWEEN 1 AND 64),
  CONSTRAINT chk_cnt_b9_outbox_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED', 'DLQ')),
  CONSTRAINT chk_cnt_b9_outbox_payload CHECK (JSON_TYPE(payload_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B9 content-service transactional outbox';
