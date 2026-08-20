-- B3 multimodal learning baseline. Content is versioned; learner answer/audio bytes
-- never appear in events or logs. Raw user media remains in S3-compatible storage.

CREATE TABLE IF NOT EXISTS `cnt_grammar_point` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grammar_code` VARCHAR(64) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `rule_formula` VARCHAR(500) NOT NULL,
  `meaning_cn` VARCHAR(500) NOT NULL,
  `cefr_level` VARCHAR(8) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grammar_code_version` (`grammar_code`, `content_version_id`),
  KEY `idx_grammar_level_status` (`cefr_level`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_grammar_sentence` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grammar_point_id` BIGINT UNSIGNED NOT NULL,
  `sentence_text` TEXT NOT NULL,
  `translation_cn` TEXT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_grammar_sentence_point` (`grammar_point_id`, `content_version_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_grammar_sentence_node` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sentence_id` BIGINT UNSIGNED NOT NULL,
  `node_code` VARCHAR(64) NOT NULL,
  `role_code` VARCHAR(32) NOT NULL,
  `text_start_token` INT UNSIGNED NOT NULL,
  `text_end_token` INT UNSIGNED NOT NULL,
  `parent_node_id` BIGINT UNSIGNED NULL,
  `node_order` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_node_code` (`sentence_id`, `node_code`),
  KEY `idx_sentence_node_parent` (`sentence_id`, `parent_node_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_grammar_sentence_edge` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sentence_id` BIGINT UNSIGNED NOT NULL,
  `from_node_id` BIGINT UNSIGNED NOT NULL,
  `to_node_id` BIGINT UNSIGNED NOT NULL,
  `relation_code` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_edge` (`sentence_id`, `from_node_id`, `to_node_id`, `relation_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_writing_prompt` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `prompt_type` VARCHAR(24) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `task_text` TEXT NOT NULL,
  `target_structure_json` JSON NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_writing_prompt_status_type` (`status`, `prompt_type`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_writing_rubric` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `prompt_id` BIGINT UNSIGNED NOT NULL,
  `point_code` VARCHAR(64) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `weight` DECIMAL(6,4) NOT NULL,
  `rule_config_json` JSON NOT NULL,
  `rule_version` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_writing_rubric_point` (`prompt_id`, `point_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_media_material` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_code` VARCHAR(96) NOT NULL,
  `title` VARCHAR(240) NOT NULL,
  `media_asset_id` BIGINT UNSIGNED NOT NULL,
  `duration_ms` INT UNSIGNED NOT NULL,
  `cefr_level` VARCHAR(8) NULL,
  `dialect_code` VARCHAR(32) NOT NULL DEFAULT 'EN_GENERAL',
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `rights_status` VARCHAR(16) NOT NULL DEFAULT 'AUTHORIZED',
  `manifest_hash` CHAR(64) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_material_version` (`material_code`, `content_version_id`),
  KEY `idx_media_material_publish` (`status`, `rights_status`, `cefr_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_media_segment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_id` BIGINT UNSIGNED NOT NULL,
  `segment_code` VARCHAR(96) NOT NULL,
  `start_ms` INT UNSIGNED NOT NULL,
  `end_ms` INT UNSIGNED NOT NULL,
  `text_content` TEXT NOT NULL,
  `translation_cn` TEXT NULL,
  `segment_order` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_segment_code` (`material_id`, `segment_code`),
  KEY `idx_media_segment_time` (`material_id`, `start_ms`, `end_ms`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_media_token` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `segment_id` BIGINT UNSIGNED NOT NULL,
  `token_code` VARCHAR(96) NOT NULL,
  `token_text` VARCHAR(160) NOT NULL,
  `ipa_text` VARCHAR(160) NULL,
  `part_of_speech` VARCHAR(32) NULL,
  `stress_code` VARCHAR(16) NULL,
  `start_ms` INT UNSIGNED NOT NULL,
  `end_ms` INT UNSIGNED NOT NULL,
  `token_order` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_token_code` (`segment_id`, `token_code`),
  KEY `idx_media_token_time` (`segment_id`, `start_ms`, `end_ms`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_sound_change_annotation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `segment_id` BIGINT UNSIGNED NOT NULL,
  `rule_code` VARCHAR(48) NOT NULL,
  `from_token_id` BIGINT UNSIGNED NOT NULL,
  `to_token_id` BIGINT UNSIGNED NOT NULL,
  `start_ms` INT UNSIGNED NOT NULL,
  `end_ms` INT UNSIGNED NOT NULL,
  `explanation_code` VARCHAR(96) NOT NULL,
  `rule_set_version` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sound_change_annotation` (`segment_id`, `rule_code`, `from_token_id`, `to_token_id`, `rule_set_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_reading_article` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_code` VARCHAR(96) NOT NULL,
  `title` VARCHAR(240) NOT NULL,
  `cefr_level` VARCHAR(8) NOT NULL,
  `word_count` INT UNSIGNED NOT NULL,
  `estimated_minutes` INT UNSIGNED NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `rights_status` VARCHAR(16) NOT NULL DEFAULT 'AUTHORIZED',
  `branching` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reading_article_version` (`article_code`, `content_version_id`),
  KEY `idx_reading_article_publish` (`status`, `rights_status`, `cefr_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_reading_block` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `block_code` VARCHAR(96) NOT NULL,
  `block_order` INT UNSIGNED NOT NULL,
  `text_content` TEXT NOT NULL,
  `translation_cn` TEXT NULL,
  `branch_choices_json` JSON NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reading_block_code` (`article_id`, `block_code`),
  KEY `idx_reading_block_order` (`article_id`, `block_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_phoneme_symbol` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `set_code` VARCHAR(48) NOT NULL,
  `symbol` VARCHAR(32) NOT NULL,
  `group_code` VARCHAR(32) NOT NULL,
  `example_word` VARCHAR(96) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `demo_asset_id` BIGINT UNSIGNED NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phoneme_set_symbol_version` (`set_code`, `symbol`, `content_version_id`),
  KEY `idx_phoneme_set_status` (`set_code`, `status`, `group_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_mouth_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phoneme_id` BIGINT UNSIGNED NOT NULL,
  `profile_version` VARCHAR(64) NOT NULL,
  `parameters_json` JSON NOT NULL,
  `keyframes_json` JSON NOT NULL,
  `fallback_2d_ref` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mouth_profile_version` (`phoneme_id`, `profile_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_b3_practice_session` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_uuid` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `domain_code` VARCHAR(24) NOT NULL,
  `content_id` BIGINT UNSIGNED NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `rule_version` VARCHAR(64) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
  `current_index` INT UNSIGNED NOT NULL DEFAULT 0,
  `position_version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_b3_session_uuid` (`session_uuid`),
  KEY `idx_b3_session_user_status` (`user_id`, `domain_code`, `status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_b3_attempt` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `item_code` VARCHAR(96) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `answer_hash` CHAR(64) NOT NULL,
  `answer_ciphertext` VARBINARY(8192) NULL COMMENT '受保护用户输入；禁止日志、事件和普通查询返回',
  `score` DECIMAL(7,4) NOT NULL,
  `is_correct` TINYINT(1) NULL,
  `feedback_code` VARCHAR(96) NULL,
  `client_event_id` VARCHAR(96) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_b3_attempt_event` (`user_id`, `client_event_id`),
  KEY `idx_b3_attempt_session_item` (`session_id`, `item_code`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_reading_progress` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `block_code` VARCHAR(96) NULL,
  `token_code` VARCHAR(96) NULL,
  `character_offset` INT UNSIGNED NOT NULL DEFAULT 0,
  `progress_percent` DECIMAL(6,3) NOT NULL DEFAULT 0,
  `position_version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `client_event_id` VARCHAR(96) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reading_progress_user_article_version` (`user_id`, `article_id`, `content_version_id`),
  UNIQUE KEY `uk_reading_progress_event` (`user_id`, `client_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_speaking_recording` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recording_uuid` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `source_segment_code` VARCHAR(96) NOT NULL,
  `media_asset_id` BIGINT UNSIGNED NULL,
  `content_hash` CHAR(64) NOT NULL,
  `duration_ms` INT UNSIGNED NOT NULL,
  `storage_mode` VARCHAR(24) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'LOCAL_ONLY',
  `retention_until` DATETIME(3) NULL,
  `ai_scoring_available` TINYINT(1) NOT NULL DEFAULT 0,
  `client_event_id` VARCHAR(96) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recording_uuid` (`recording_uuid`),
  UNIQUE KEY `uk_recording_event` (`user_id`, `client_event_id`),
  KEY `idx_recording_lifecycle` (`user_id`, `status`, `retention_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_speaking_self_rating` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recording_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `rating_code` VARCHAR(24) NOT NULL,
  `tags_json` JSON NULL,
  `client_event_id` VARCHAR(96) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_self_rating_event` (`user_id`, `client_event_id`),
  KEY `idx_self_rating_recording` (`recording_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_offline_change` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `device_id` VARCHAR(96) NOT NULL,
  `change_id` VARCHAR(96) NOT NULL,
  `client_batch_id` VARCHAR(96) NOT NULL,
  `entity_type` VARCHAR(32) NOT NULL,
  `entity_id` VARCHAR(128) NOT NULL,
  `entity_version` BIGINT UNSIGNED NOT NULL,
  `operation` VARCHAR(16) NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `applied_at` DATETIME(3) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_offline_change_id` (`user_id`, `change_id`),
  KEY `idx_offline_change_cursor` (`user_id`, `id`),
  KEY `idx_offline_change_entity` (`user_id`, `entity_type`, `entity_id`, `entity_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_offline_cursor` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `device_id` VARCHAR(96) NOT NULL,
  `cursor_value` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `schema_version` VARCHAR(32) NOT NULL DEFAULT 'b3-sync-v2',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_offline_cursor_device` (`user_id`, `device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_offline_conflict` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `change_id` VARCHAR(96) NOT NULL,
  `entity_type` VARCHAR(32) NOT NULL,
  `entity_id` VARCHAR(128) NOT NULL,
  `local_version` BIGINT UNSIGNED NOT NULL,
  `server_version` BIGINT UNSIGNED NOT NULL,
  `resolution_code` VARCHAR(24) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_offline_conflict_change` (`user_id`, `change_id`),
  KEY `idx_offline_conflict_entity` (`user_id`, `entity_type`, `entity_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- B3 detailed-design extensions. These tables keep authored content versioned
-- and keep learner answers/media metadata separate from public content.
CREATE TABLE IF NOT EXISTS `cnt_grammar_trap` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grammar_point_id` BIGINT UNSIGNED NOT NULL,
  `trap_code` VARCHAR(96) NOT NULL,
  `wrong_pattern` VARCHAR(255) NOT NULL,
  `correct_rule` VARCHAR(500) NOT NULL,
  `explanation_cn` VARCHAR(1000) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grammar_trap_version` (`grammar_point_id`, `trap_code`, `content_version_id`),
  KEY `idx_grammar_trap_status` (`grammar_point_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_grammar_exercise` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exercise_code` VARCHAR(96) NOT NULL,
  `grammar_point_id` BIGINT UNSIGNED NOT NULL,
  `exercise_type` VARCHAR(32) NOT NULL,
  `prompt_text` TEXT NOT NULL,
  `rule_key_json` JSON NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grammar_exercise_version` (`exercise_code`, `content_version_id`),
  KEY `idx_grammar_exercise_point_status` (`grammar_point_id`, `status`, `exercise_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_grammar_exercise_option` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `exercise_id` BIGINT UNSIGNED NOT NULL,
  `option_code` VARCHAR(48) NOT NULL,
  `label_text` VARCHAR(500) NOT NULL,
  `option_order` INT UNSIGNED NOT NULL,
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grammar_exercise_option` (`exercise_id`, `option_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_grammar_mastery_dimension` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grammar_point_id` BIGINT UNSIGNED NOT NULL,
  `dimension_code` VARCHAR(32) NOT NULL,
  `weight` DECIMAL(8,5) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grammar_mastery_dimension` (`grammar_point_id`, `dimension_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_grammar_mastery` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `grammar_point_id` BIGINT UNSIGNED NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `dimension_scores_json` JSON NOT NULL,
  `overall_score` DECIMAL(7,4) NOT NULL DEFAULT 0,
  `mastery_level` VARCHAR(24) NOT NULL DEFAULT 'REVIEW',
  `position_version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `client_event_id` VARCHAR(96) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grammar_mastery_user_point_version` (`user_id`, `grammar_point_id`, `content_version_id`),
  UNIQUE KEY `uk_grammar_mastery_event` (`user_id`, `client_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_sentence_token` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sentence_id` BIGINT UNSIGNED NOT NULL,
  `token_code` VARCHAR(96) NOT NULL,
  `token_text` VARCHAR(160) NOT NULL,
  `token_order` INT UNSIGNED NOT NULL,
  `start_ms` INT UNSIGNED NULL,
  `end_ms` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_token_order` (`sentence_id`, `token_code`),
  KEY `idx_sentence_token_position` (`sentence_id`, `token_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_sentence_slice` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sentence_id` BIGINT UNSIGNED NOT NULL,
  `slice_code` VARCHAR(96) NOT NULL,
  `slice_order` INT UNSIGNED NOT NULL,
  `role_code` VARCHAR(32) NOT NULL,
  `text_content` VARCHAR(500) NOT NULL,
  `color_token` VARCHAR(32) NOT NULL,
  `start_token` INT UNSIGNED NOT NULL,
  `end_token` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_slice_code` (`sentence_id`, `slice_code`),
  KEY `idx_sentence_slice_order` (`sentence_id`, `slice_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_sentence_audio_track` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sentence_id` BIGINT UNSIGNED NOT NULL,
  `track_code` VARCHAR(48) NOT NULL,
  `media_asset_id` BIGINT UNSIGNED NOT NULL,
  `speed_code` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  `duration_ms` INT UNSIGNED NOT NULL,
  `rights_status` VARCHAR(16) NOT NULL DEFAULT 'AUTHORIZED',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_audio_track` (`sentence_id`, `track_code`, `speed_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_sentence_audio_segment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `track_id` BIGINT UNSIGNED NOT NULL,
  `slice_code` VARCHAR(96) NOT NULL,
  `start_ms` INT UNSIGNED NOT NULL,
  `end_ms` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_audio_segment` (`track_id`, `slice_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_writing_template` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `template_code` VARCHAR(96) NOT NULL,
  `template_type` VARCHAR(24) NOT NULL,
  `title` VARCHAR(240) NOT NULL,
  `structure_json` JSON NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_writing_template_version` (`template_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_writing_material` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_code` VARCHAR(96) NOT NULL,
  `topic_code` VARCHAR(96) NOT NULL,
  `title` VARCHAR(240) NOT NULL,
  `body_text` TEXT NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_writing_material_version` (`material_code`, `content_version_id`),
  KEY `idx_writing_material_topic` (`topic_code`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_writing_proofreading_issue` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `prompt_id` BIGINT UNSIGNED NOT NULL,
  `issue_code` VARCHAR(96) NOT NULL,
  `error_type` VARCHAR(32) NOT NULL,
  `wrong_text_hash` CHAR(64) NOT NULL,
  `correct_text` VARCHAR(500) NOT NULL,
  `explanation` VARCHAR(1000) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_writing_issue_version` (`prompt_id`, `issue_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_media_clip` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_id` BIGINT UNSIGNED NOT NULL,
  `clip_code` VARCHAR(96) NOT NULL,
  `title` VARCHAR(240) NOT NULL,
  `start_ms` INT UNSIGNED NOT NULL,
  `end_ms` INT UNSIGNED NOT NULL,
  `media_asset_id` BIGINT UNSIGNED NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `rights_status` VARCHAR(16) NOT NULL DEFAULT 'AUTHORIZED',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_media_clip_version` (`material_id`, `clip_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_media_offline_package` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `package_code` VARCHAR(96) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `manifest_hash` CHAR(64) NOT NULL,
  `total_bytes` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'READY',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_offline_package_version` (`package_code`, `content_version_id`),
  KEY `idx_offline_package_status` (`status`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_media_offline_package_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `package_id` BIGINT UNSIGNED NOT NULL,
  `asset_id` VARCHAR(128) NOT NULL,
  `asset_kind` VARCHAR(32) NOT NULL,
  `byte_size` BIGINT UNSIGNED NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_offline_package_item` (`package_id`, `asset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_reading_dictionary_entry` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `token_code` VARCHAR(96) NOT NULL,
  `lemma` VARCHAR(160) NOT NULL,
  `part_of_speech` VARCHAR(48) NULL,
  `meaning_cn` VARCHAR(1000) NOT NULL,
  `example_text` VARCHAR(500) NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reading_dictionary_token` (`article_id`, `token_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_reading_story_node` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `node_code` VARCHAR(96) NOT NULL,
  `block_id` BIGINT UNSIGNED NOT NULL,
  `choice_schema_json` JSON NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reading_story_node` (`article_id`, `node_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_reading_question` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `question_code` VARCHAR(96) NOT NULL,
  `question_type` VARCHAR(24) NOT NULL,
  `stem_text` TEXT NOT NULL,
  `option_schema_json` JSON NOT NULL,
  `answer_rule_json` JSON NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reading_question_version` (`article_id`, `question_code`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cnt_phoneme_minimal_pair` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `left_phoneme_id` BIGINT UNSIGNED NOT NULL,
  `right_phoneme_id` BIGINT UNSIGNED NOT NULL,
  `left_word` VARCHAR(96) NOT NULL,
  `right_word` VARCHAR(96) NOT NULL,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phoneme_minimal_pair_version` (`left_phoneme_id`, `right_phoneme_id`, `content_version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_shadowing_session` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_uuid` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `source_segment_code` VARCHAR(96) NOT NULL,
  `target_gap_ms` INT UNSIGNED NOT NULL DEFAULT 500,
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_position_ms` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `client_event_id` VARCHAR(96) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shadowing_session_uuid` (`session_uuid`),
  UNIQUE KEY `uk_shadowing_session_event` (`user_id`, `client_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_speaking_recording_segment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recording_id` BIGINT UNSIGNED NOT NULL,
  `segment_code` VARCHAR(96) NOT NULL,
  `start_ms` INT UNSIGNED NOT NULL,
  `end_ms` INT UNSIGNED NOT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'LOCAL_ONLY',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recording_segment` (`recording_id`, `segment_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lrn_speaking_roleplay_session` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_uuid` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `roleplay_code` VARCHAR(96) NOT NULL,
  `turn_index` INT UNSIGNED NOT NULL DEFAULT 0,
  `content_version_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
  `client_event_id` VARCHAR(96) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roleplay_session_uuid` (`session_uuid`),
  UNIQUE KEY `uk_roleplay_session_event` (`user_id`, `client_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
