-- B1 content supply chain migration.
-- Content versions are immutable snapshots. Application code may transition their
-- lifecycle status, but published payloads are never edited in place.

CREATE TABLE IF NOT EXISTS content_sources (
  source_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_code VARCHAR(96) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_kind VARCHAR(32) NOT NULL,
  source_locator VARCHAR(512) NULL,
  copyright_owner VARCHAR(255) NULL,
  is_synthetic TINYINT(1) NOT NULL DEFAULT 0,
  metadata_json JSON NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (source_id),
  UNIQUE KEY uk_content_source_code (source_code),
  KEY idx_content_source_kind (source_kind, is_synthetic),
  CONSTRAINT chk_content_source_kind CHECK (source_kind IN ('INTERNAL', 'LICENSED', 'OPEN_LICENSE', 'PUBLIC_DOMAIN', 'USER_PROVIDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容来源与版权追溯入口';

CREATE TABLE IF NOT EXISTS content_licenses (
  license_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  license_code VARCHAR(96) NOT NULL,
  license_name VARCHAR(255) NOT NULL,
  license_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  copyright_owner VARCHAR(255) NOT NULL,
  authorization_evidence_ref VARCHAR(512) NULL,
  license_url VARCHAR(512) NULL,
  permitted_platforms_json JSON NOT NULL,
  allows_learning TINYINT(1) NOT NULL DEFAULT 0,
  allows_offline TINYINT(1) NOT NULL DEFAULT 0,
  attribution_required TINYINT(1) NOT NULL DEFAULT 0,
  starts_at DATETIME(6) NULL,
  expires_at DATETIME(6) NULL,
  metadata_json JSON NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (license_id),
  UNIQUE KEY uk_content_license_code (license_code),
  KEY idx_content_license_status_window (license_status, starts_at, expires_at),
  CONSTRAINT chk_content_license_status CHECK (license_status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED')),
  CONSTRAINT chk_content_license_platforms CHECK (JSON_TYPE(permitted_platforms_json) = 'ARRAY'),
  CONSTRAINT chk_content_license_window CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
  CONSTRAINT chk_content_license_learning CHECK (allows_learning = 0 OR authorization_evidence_ref IS NOT NULL OR license_url IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容授权凭证与开放许可台账';

CREATE TABLE IF NOT EXISTS content_entities (
  content_entity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_code VARCHAR(128) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
  target_level VARCHAR(8) NOT NULL,
  goal_code VARCHAR(96) NOT NULL,
  parent_entity_id BIGINT UNSIGNED NULL,
  current_published_version_id BIGINT UNSIGNED NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_entity_id),
  UNIQUE KEY uk_content_entity_code (content_code),
  KEY idx_content_entity_type_level (content_type, target_level, content_entity_id),
  KEY idx_content_entity_parent (parent_entity_id, content_entity_id),
  CONSTRAINT fk_content_entity_parent FOREIGN KEY (parent_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT chk_content_entity_type CHECK (content_type IN ('COURSE', 'COURSE_UNIT', 'VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'MEDIA', 'QUESTION')),
  CONSTRAINT chk_content_entity_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='稳定内容身份，不承载可变正文';

CREATE TABLE IF NOT EXISTS content_versions (
  content_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_entity_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  payload_json JSON NOT NULL,
  content_hash CHAR(64) NOT NULL,
  source_code VARCHAR(96) NOT NULL,
  license_code VARCHAR(96) NOT NULL,
  editor_actor VARCHAR(128) NOT NULL,
  first_reviewer_actor VARCHAR(128) NULL,
  final_reviewer_actor VARCHAR(128) NULL,
  publisher_actor VARCHAR(128) NULL,
  rollback_of_version_id BIGINT UNSIGNED NULL,
  release_note VARCHAR(512) NULL,
  published_at DATETIME(6) NULL,
  archived_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_version_id),
  UNIQUE KEY uk_content_version_number (content_entity_id, version_number),
  KEY idx_content_version_status (status, content_entity_id, content_version_id),
  KEY idx_content_version_source_license (source_code, license_code),
  KEY idx_content_version_published (content_entity_id, status, published_at),
  CONSTRAINT fk_content_version_entity FOREIGN KEY (content_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_version_source FOREIGN KEY (source_code) REFERENCES content_sources (source_code),
  CONSTRAINT fk_content_version_license FOREIGN KEY (license_code) REFERENCES content_licenses (license_code),
  CONSTRAINT fk_content_version_rollback FOREIGN KEY (rollback_of_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_version_status CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT chk_content_version_number CHECK (version_number > 0),
  CONSTRAINT chk_content_version_payload CHECK (JSON_TYPE(payload_json) = 'OBJECT'),
  CONSTRAINT chk_content_version_hash CHECK (content_hash REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_content_version_publish_fields CHECK (
    status <> 'PUBLISHED' OR (
      first_reviewer_actor IS NOT NULL AND
      final_reviewer_actor IS NOT NULL AND
      publisher_actor IS NOT NULL AND
      published_at IS NOT NULL
    )
  ),
  CONSTRAINT chk_content_version_reviewers_distinct CHECK (
    first_reviewer_actor IS NULL OR first_reviewer_actor <> editor_actor
  ),
  CONSTRAINT chk_content_version_final_reviewer_distinct CHECK (
    final_reviewer_actor IS NULL OR final_reviewer_actor <> editor_actor
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不可变内容快照与双审发布状态';

CREATE TABLE IF NOT EXISTS content_course_units (
  course_unit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_entity_id BIGINT UNSIGNED NOT NULL,
  unit_entity_id BIGINT UNSIGNED NOT NULL,
  unit_version_id BIGINT UNSIGNED NOT NULL,
  unit_order INT UNSIGNED NOT NULL,
  completion_rule_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (course_unit_id),
  UNIQUE KEY uk_content_course_unit_order (course_entity_id, unit_order),
  UNIQUE KEY uk_content_course_unit_version (unit_entity_id, unit_version_id),
  KEY idx_content_course_unit_course (course_entity_id, unit_order),
  CONSTRAINT fk_content_course_unit_course FOREIGN KEY (course_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_course_unit_entity FOREIGN KEY (unit_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_course_unit_version FOREIGN KEY (unit_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_course_unit_order CHECK (unit_order > 0),
  CONSTRAINT chk_content_course_unit_completion CHECK (JSON_TYPE(completion_rule_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程与课程单元的版本化编排';

CREATE TABLE IF NOT EXISTS content_items (
  content_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_entity_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  item_type VARCHAR(32) NOT NULL,
  item_code VARCHAR(128) NOT NULL,
  normalized_key VARCHAR(255) NOT NULL,
  item_payload_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_item_id),
  UNIQUE KEY uk_content_item_version_code (content_version_id, item_code),
  UNIQUE KEY uk_content_item_dedupe (item_type, normalized_key, content_version_id),
  KEY idx_content_item_entity_type (content_entity_id, item_type, content_item_id),
  CONSTRAINT fk_content_item_entity FOREIGN KEY (content_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_item_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_item_type CHECK (item_type IN ('VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'MEDIA', 'QUESTION')),
  CONSTRAINT chk_content_item_payload CHECK (JSON_TYPE(item_payload_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='词汇、短语、语法、句子、媒体、题目的统一版本模型';

CREATE TABLE IF NOT EXISTS content_version_references (
  reference_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_version_id BIGINT UNSIGNED NOT NULL,
  to_version_id BIGINT UNSIGNED NOT NULL,
  reference_type VARCHAR(32) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (reference_id),
  UNIQUE KEY uk_content_version_reference (from_version_id, to_version_id, reference_type),
  KEY idx_content_version_reference_target (to_version_id, reference_type),
  CONSTRAINT fk_content_version_reference_from FOREIGN KEY (from_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT fk_content_version_reference_to FOREIGN KEY (to_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_version_reference_self CHECK (from_version_id <> to_version_id),
  CONSTRAINT chk_content_version_reference_type CHECK (reference_type IN ('CONTAINS', 'PREREQUISITE', 'RELATED', 'MEDIA'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='跨内容版本引用与一致性边界';

CREATE TABLE IF NOT EXISTS content_version_reviews (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  review_stage VARCHAR(24) NOT NULL,
  review_version INT UNSIGNED NOT NULL,
  reviewer_actor VARCHAR(128) NOT NULL,
  decision VARCHAR(32) NOT NULL,
  reason_code VARCHAR(96) NULL,
  note TEXT NULL,
  decided_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (review_id),
  UNIQUE KEY uk_content_version_review_stage (content_version_id, review_stage, review_version),
  KEY idx_content_version_review_actor (reviewer_actor, decided_at),
  CONSTRAINT fk_content_version_review_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_version_review_stage CHECK (review_stage IN ('FIRST_REVIEW', 'FINAL_REVIEW')),
  CONSTRAINT chk_content_version_review_decision CHECK (decision IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')),
  CONSTRAINT chk_content_version_review_version CHECK (review_version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容双审决定与审计证据';

CREATE TABLE IF NOT EXISTS content_import_batches (
  import_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_code VARCHAR(128) NOT NULL,
  source_format VARCHAR(16) NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  actor_subject VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'VALIDATING',
  accepted_count INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_count INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_count INT UNSIGNED NOT NULL DEFAULT 0,
  report_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  completed_at DATETIME(6) NULL,
  PRIMARY KEY (import_batch_id),
  UNIQUE KEY uk_content_import_batch_code (batch_code),
  KEY idx_content_import_status_time (status, created_at),
  CONSTRAINT chk_content_import_format CHECK (source_format IN ('CSV', 'JSON')),
  CONSTRAINT chk_content_import_status CHECK (status IN ('VALIDATING', 'READY', 'APPLIED', 'REJECTED')),
  CONSTRAINT chk_content_import_hash CHECK (source_sha256 REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_content_import_report CHECK (JSON_TYPE(report_json) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='CSV/JSON 导入批次与可重放校验报告';

CREATE TABLE IF NOT EXISTS content_import_rows (
  import_row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_batch_id BIGINT UNSIGNED NOT NULL,
  row_number INT UNSIGNED NOT NULL,
  normalized_key VARCHAR(255) NULL,
  row_sha256 CHAR(64) NOT NULL,
  row_status VARCHAR(24) NOT NULL,
  error_code VARCHAR(96) NULL,
  error_message VARCHAR(512) NULL,
  content_entity_id BIGINT UNSIGNED NULL,
  content_version_id BIGINT UNSIGNED NULL,
  row_metadata_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (import_row_id),
  UNIQUE KEY uk_content_import_row (import_batch_id, row_number),
  KEY idx_content_import_row_status (import_batch_id, row_status),
  CONSTRAINT fk_content_import_row_batch FOREIGN KEY (import_batch_id) REFERENCES content_import_batches (import_batch_id),
  CONSTRAINT fk_content_import_row_entity FOREIGN KEY (content_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_import_row_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_import_row_hash CHECK (row_sha256 REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_content_import_row_status CHECK (row_status IN ('ACCEPTED', 'REJECTED', 'DUPLICATE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='导入逐行结果、错误与去重证据';

CREATE TABLE IF NOT EXISTS content_media_bindings (
  content_media_binding_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  media_asset_id BIGINT UNSIGNED NOT NULL,
  media_role VARCHAR(32) NOT NULL,
  access_policy VARCHAR(24) NOT NULL DEFAULT 'SIGNED',
  allow_offline TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (content_media_binding_id),
  UNIQUE KEY uk_content_media_binding (content_version_id, media_asset_id, media_role),
  KEY idx_content_media_binding_asset (media_asset_id, content_version_id),
  CONSTRAINT fk_content_media_binding_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT fk_content_media_binding_asset FOREIGN KEY (media_asset_id) REFERENCES media_assets (media_asset_id),
  CONSTRAINT chk_content_media_binding_policy CHECK (access_policy IN ('SIGNED', 'PRIVATE')),
  CONSTRAINT chk_content_media_binding_role CHECK (media_role IN ('AUDIO', 'IMAGE', 'VIDEO', 'MODEL_3D', 'WAVEFORM', 'OFFLINE_BUNDLE', 'OTHER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容媒体关联与签名访问策略，禁止永久公开 URL';

CREATE TABLE IF NOT EXISTS content_media_signatures (
  media_signature_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  media_asset_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL,
  requester_subject VARCHAR(128) NOT NULL,
  access_scope VARCHAR(32) NOT NULL DEFAULT 'STREAM',
  expires_at DATETIME(6) NOT NULL,
  range_start_bytes BIGINT UNSIGNED NULL,
  range_end_bytes BIGINT UNSIGNED NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (media_signature_id),
  UNIQUE KEY uk_content_media_signature_token (token_hash),
  KEY idx_content_media_signature_expiry (expires_at, revoked_at),
  KEY idx_content_media_signature_owner (requester_subject, created_at),
  CONSTRAINT fk_content_media_signature_asset FOREIGN KEY (media_asset_id) REFERENCES media_assets (media_asset_id),
  CONSTRAINT fk_content_media_signature_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_media_signature_scope CHECK (access_scope IN ('STREAM', 'DOWNLOAD', 'OFFLINE')),
  CONSTRAINT chk_content_media_signature_window CHECK (expires_at > created_at),
  CONSTRAINT chk_content_media_signature_range CHECK (range_end_bytes IS NULL OR range_start_bytes IS NULL OR range_end_bytes >= range_start_bytes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短期签名媒体访问记录，不保存永久公开地址';

CREATE TABLE IF NOT EXISTS content_cache_invalidations (
  cache_invalidation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cache_epoch BIGINT UNSIGNED NOT NULL,
  content_entity_id BIGINT UNSIGNED NULL,
  content_version_id BIGINT UNSIGNED NULL,
  invalidation_scope VARCHAR(32) NOT NULL,
  reason_code VARCHAR(96) NOT NULL,
  dedupe_key VARCHAR(192) NOT NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (cache_invalidation_id),
  UNIQUE KEY uk_content_cache_invalidation_dedupe (dedupe_key),
  KEY idx_content_cache_invalidation_epoch (cache_epoch, occurred_at),
  KEY idx_content_cache_invalidation_version (content_version_id, occurred_at),
  CONSTRAINT fk_content_cache_invalidation_entity FOREIGN KEY (content_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_cache_invalidation_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_cache_invalidation_scope CHECK (invalidation_scope IN ('CONTENT', 'VERSION', 'MEDIA', 'MANIFEST', 'GLOBAL'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发布/下线/版权变更后的缓存失效游标';

CREATE TABLE IF NOT EXISTS content_offline_manifests (
  offline_manifest_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  manifest_code VARCHAR(128) NOT NULL,
  manifest_version INT UNSIGNED NOT NULL,
  content_epoch BIGINT UNSIGNED NOT NULL,
  manifest_sha256 CHAR(64) NOT NULL,
  platform VARCHAR(24) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  expires_at DATETIME(6) NULL,
  generated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by VARCHAR(128) NOT NULL,
  PRIMARY KEY (offline_manifest_id),
  UNIQUE KEY uk_content_offline_manifest (manifest_code, manifest_version, platform),
  KEY idx_content_offline_manifest_active (manifest_code, platform, status, generated_at),
  CONSTRAINT chk_content_offline_manifest_version CHECK (manifest_version > 0),
  CONSTRAINT chk_content_offline_manifest_hash CHECK (manifest_sha256 REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_content_offline_manifest_platform CHECK (platform IN ('WEB', 'H5', 'IOS', 'ANDROID', 'IPAD', 'WECHAT_MINI_PROGRAM', 'ALL')),
  CONSTRAINT chk_content_offline_manifest_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  CONSTRAINT chk_content_offline_manifest_window CHECK (expires_at IS NULL OR expires_at > generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户端离线内容版本清单';

CREATE TABLE IF NOT EXISTS content_offline_manifest_items (
  offline_manifest_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  offline_manifest_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  media_asset_id BIGINT UNSIGNED NULL,
  resource_kind VARCHAR(24) NOT NULL,
  resource_key VARCHAR(512) NOT NULL,
  resource_sha256 CHAR(64) NOT NULL,
  content_length_bytes BIGINT UNSIGNED NOT NULL,
  allow_offline TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (offline_manifest_item_id),
  UNIQUE KEY uk_content_offline_manifest_resource (offline_manifest_id, resource_key),
  KEY idx_content_offline_manifest_version (content_version_id, offline_manifest_id),
  CONSTRAINT fk_content_offline_manifest_item_manifest FOREIGN KEY (offline_manifest_id) REFERENCES content_offline_manifests (offline_manifest_id),
  CONSTRAINT fk_content_offline_manifest_item_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT fk_content_offline_manifest_item_media FOREIGN KEY (media_asset_id) REFERENCES media_assets (media_asset_id),
  CONSTRAINT chk_content_offline_manifest_item_kind CHECK (resource_kind IN ('CONTENT_JSON', 'MEDIA', 'INDEX')),
  CONSTRAINT chk_content_offline_manifest_item_hash CHECK (resource_sha256 REGEXP '^[0-9a-fA-F]{64}$'),
  CONSTRAINT chk_content_offline_manifest_item_size CHECK (content_length_bytes > 0),
  CONSTRAINT chk_content_offline_manifest_item_rights CHECK (allow_offline = 0 OR media_asset_id IS NULL OR resource_kind = 'MEDIA')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='离线清单资源哈希与版权边界';

CREATE TABLE IF NOT EXISTS content_release_audits (
  content_release_audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_entity_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(32) NOT NULL,
  actor_subject VARCHAR(128) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  reason_code VARCHAR(96) NULL,
  before_status VARCHAR(24) NULL,
  after_status VARCHAR(24) NOT NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  metadata_json JSON NULL,
  PRIMARY KEY (content_release_audit_id),
  KEY idx_content_release_audit_entity_time (content_entity_id, occurred_at),
  KEY idx_content_release_audit_version_time (content_version_id, occurred_at),
  CONSTRAINT fk_content_release_audit_entity FOREIGN KEY (content_entity_id) REFERENCES content_entities (content_entity_id),
  CONSTRAINT fk_content_release_audit_version FOREIGN KEY (content_version_id) REFERENCES content_versions (content_version_id),
  CONSTRAINT chk_content_release_audit_action CHECK (action_code IN ('CREATE', 'SUBMIT', 'REVIEW', 'PUBLISH', 'ARCHIVE', 'RESTORE', 'IMPORT')),
  CONSTRAINT chk_content_release_audit_status CHECK (after_status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容发布、下线、恢复与批量变更审计';
