-- B12 additive facts for growth, controlled social, notification workflow and migration evidence.
-- Domain services own these tables; the legacy core-api may only write cmp_b12_* compatibility facts.

CREATE TABLE IF NOT EXISTS `gam_b12_event_receipt` (
  `receipt_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `event_id` VARCHAR(128) NOT NULL,
  `event_name` VARCHAR(128) NOT NULL,
  `dedupe_key` VARCHAR(255) NOT NULL,
  `subject_id` VARCHAR(128) NOT NULL,
  `processing_status` VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  `rule_version` VARCHAR(64) NOT NULL,
  `occurred_at` DATETIME(6) NOT NULL,
  `processed_at` DATETIME(6) NULL,
  PRIMARY KEY (`receipt_id`),
  UNIQUE KEY `uk_gam_b12_event_id` (`tenant_id`, `event_id`),
  UNIQUE KEY `uk_gam_b12_dedupe_key` (`tenant_id`, `dedupe_key`),
  KEY `idx_gam_b12_receipt_subject` (`tenant_id`, `subject_id`, `occurred_at`),
  CONSTRAINT `chk_gam_b12_receipt_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_receipt_status` CHECK (`processing_status` IN ('RECEIVED', 'APPLIED', 'DUPLICATE', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 trusted learning event receipt and dedupe fact';

CREATE TABLE IF NOT EXISTS `gam_b12_score_ledger` (
  `ledger_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ledger_entry_id` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `subject_id` VARCHAR(128) NOT NULL,
  `source_event_id` VARCHAR(128) NOT NULL,
  `amount` INT UNSIGNED NOT NULL,
  `rule_version` VARCHAR(64) NOT NULL,
  `balance_after` BIGINT UNSIGNED NOT NULL,
  `occurred_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`ledger_id`),
  UNIQUE KEY `uk_gam_b12_score_entry` (`tenant_id`, `ledger_entry_id`),
  UNIQUE KEY `uk_gam_b12_score_source` (`tenant_id`, `source_event_id`),
  KEY `idx_gam_b12_score_subject` (`tenant_id`, `subject_id`, `occurred_at`),
  CONSTRAINT `chk_gam_b12_score_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_score_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 immutable server score ledger';

CREATE TABLE IF NOT EXISTS `gam_b12_currency_ledger` (
  `ledger_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ledger_entry_id` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `subject_id` VARCHAR(128) NOT NULL,
  `source_event_id` VARCHAR(128) NOT NULL,
  `amount` INT UNSIGNED NOT NULL,
  `rule_version` VARCHAR(64) NOT NULL,
  `balance_after` BIGINT UNSIGNED NOT NULL,
  `occurred_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`ledger_id`),
  UNIQUE KEY `uk_gam_b12_currency_entry` (`tenant_id`, `ledger_entry_id`),
  UNIQUE KEY `uk_gam_b12_currency_source` (`tenant_id`, `source_event_id`),
  KEY `idx_gam_b12_currency_subject` (`tenant_id`, `subject_id`, `occurred_at`),
  CONSTRAINT `chk_gam_b12_currency_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_currency_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 immutable server currency ledger';

CREATE TABLE IF NOT EXISTS `gam_b12_reward_grant` (
  `grant_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grant_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `subject_id` VARCHAR(128) NOT NULL,
  `reward_code` VARCHAR(96) NOT NULL,
  `probability_version` VARCHAR(64) NOT NULL,
  `grant_state` VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
  `issued_at` DATETIME(6) NOT NULL,
  `expires_at` DATETIME(6) NULL,
  PRIMARY KEY (`grant_id`),
  UNIQUE KEY `uk_gam_b12_grant_ref` (`tenant_id`, `grant_ref`),
  KEY `idx_gam_b12_grant_subject` (`tenant_id`, `subject_id`, `grant_state`, `issued_at`),
  CONSTRAINT `chk_gam_b12_grant_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_grant_state` CHECK (`grant_state` IN ('AVAILABLE', 'CLAIMED', 'EXPIRED', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 server-issued reward grant';

CREATE TABLE IF NOT EXISTS `gam_b12_reward_claim` (
  `claim_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `claim_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `grant_ref` VARCHAR(128) NOT NULL,
  `subject_id` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(192) NOT NULL,
  `claim_state` VARCHAR(24) NOT NULL DEFAULT 'CLAIMED',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`claim_id`),
  UNIQUE KEY `uk_gam_b12_claim_ref` (`tenant_id`, `claim_ref`),
  UNIQUE KEY `uk_gam_b12_claim_idempotency` (`tenant_id`, `idempotency_key`),
  UNIQUE KEY `uk_gam_b12_claim_grant` (`tenant_id`, `grant_ref`),
  KEY `idx_gam_b12_claim_subject` (`tenant_id`, `subject_id`, `created_at`),
  CONSTRAINT `chk_gam_b12_claim_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_claim_state` CHECK (`claim_state` IN ('CLAIMED', 'ALREADY_CLAIMED', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 idempotent reward claim fact';

CREATE TABLE IF NOT EXISTS `gam_b12_streak_state` (
  `streak_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `subject_id` VARCHAR(128) NOT NULL,
  `time_zone` VARCHAR(64) NOT NULL,
  `current_days` INT UNSIGNED NOT NULL DEFAULT 0,
  `longest_days` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_activity_day` DATE NULL,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`streak_id`),
  UNIQUE KEY `uk_gam_b12_streak_subject` (`tenant_id`, `subject_id`),
  CONSTRAINT `chk_gam_b12_streak_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_streak_counts` CHECK (`longest_days` >= `current_days`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 timezone-aware streak projection';

CREATE TABLE IF NOT EXISTS `gam_b12_avatar_loadout` (
  `loadout_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loadout_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `subject_id` VARCHAR(128) NOT NULL,
  `asset_version` VARCHAR(64) NOT NULL,
  `item_refs_json` JSON NOT NULL,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`loadout_id`),
  UNIQUE KEY `uk_gam_b12_loadout_ref` (`tenant_id`, `loadout_ref`),
  UNIQUE KEY `uk_gam_b12_loadout_subject` (`tenant_id`, `subject_id`),
  CONSTRAINT `chk_gam_b12_loadout_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_gam_b12_loadout_items` CHECK (JSON_TYPE(`item_refs_json`) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 avatar loadout projection';

CREATE TABLE IF NOT EXISTS `soc_b12_room` (
  `room_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `room_kind` VARCHAR(32) NOT NULL,
  `visibility` VARCHAR(24) NOT NULL DEFAULT 'ROOM_ONLY',
  `room_state` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `seat_limit` SMALLINT UNSIGNED NOT NULL,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`room_id`),
  UNIQUE KEY `uk_soc_b12_room_ref` (`tenant_id`, `room_ref`),
  KEY `idx_soc_b12_room_listing` (`tenant_id`, `room_state`, `visibility`, `created_at`),
  CONSTRAINT `chk_soc_b12_room_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_soc_b12_room_kind` CHECK (`room_kind` IN ('FOCUS', 'STUDY', 'REVIEW')),
  CONSTRAINT `chk_soc_b12_room_visibility` CHECK (`visibility` IN ('PRIVATE', 'ROOM_ONLY', 'PUBLIC')),
  CONSTRAINT `chk_soc_b12_room_state` CHECK (`room_state` IN ('OPEN', 'PAUSED', 'CLOSED')),
  CONSTRAINT `chk_soc_b12_room_limit` CHECK (`seat_limit` BETWEEN 2 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 controlled study room aggregate';

CREATE TABLE IF NOT EXISTS `soc_b12_seat_lease` (
  `lease_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `room_ref` VARCHAR(128) NOT NULL,
  `seat_ref` VARCHAR(128) NOT NULL,
  `subject_id` VARCHAR(128) NOT NULL,
  `lease_version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `seat_state` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  `expires_at` DATETIME(6) NOT NULL,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`lease_id`),
  UNIQUE KEY `uk_soc_b12_seat_subject` (`tenant_id`, `room_ref`, `subject_id`),
  UNIQUE KEY `uk_soc_b12_seat_ref` (`tenant_id`, `room_ref`, `seat_ref`),
  KEY `idx_soc_b12_lease_expiry` (`tenant_id`, `room_ref`, `seat_state`, `expires_at`),
  CONSTRAINT `chk_soc_b12_lease_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_soc_b12_lease_state` CHECK (`seat_state` IN ('ACTIVE', 'DISCONNECTED', 'RECOVERED', 'EXPIRED', 'LEFT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 recoverable study room seat lease';

CREATE TABLE IF NOT EXISTS `soc_b12_interaction` (
  `interaction_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `interaction_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `room_ref` VARCHAR(128) NOT NULL,
  `subject_id` VARCHAR(128) NOT NULL,
  `preset_code` VARCHAR(32) NOT NULL,
  `idempotency_key` VARCHAR(192) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`interaction_id`),
  UNIQUE KEY `uk_soc_b12_interaction_ref` (`tenant_id`, `interaction_ref`),
  UNIQUE KEY `uk_soc_b12_interaction_idempotency` (`tenant_id`, `idempotency_key`),
  KEY `idx_soc_b12_interaction_room` (`tenant_id`, `room_ref`, `created_at`),
  CONSTRAINT `chk_soc_b12_interaction_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_soc_b12_interaction_preset` CHECK (`preset_code` IN ('CHEER', 'FOCUS', 'BREAK', 'THANKS', 'READY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 preset-only room interaction';

CREATE TABLE IF NOT EXISTS `soc_b12_leaderboard` (
  `snapshot_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `snapshot_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `kind` VARCHAR(32) NOT NULL,
  `period_code` VARCHAR(16) NOT NULL,
  `projection_version` VARCHAR(64) NOT NULL,
  `entries_json` JSON NOT NULL,
  `refreshed_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`snapshot_id`),
  UNIQUE KEY `uk_soc_b12_leaderboard_ref` (`tenant_id`, `snapshot_ref`),
  UNIQUE KEY `uk_soc_b12_leaderboard_projection` (`tenant_id`, `kind`, `period_code`, `projection_version`),
  CONSTRAINT `chk_soc_b12_leaderboard_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_soc_b12_leaderboard_kind` CHECK (`kind` IN ('FOCUS_MINUTES', 'STREAK_DAYS', 'COMPLETIONS')),
  CONSTRAINT `chk_soc_b12_leaderboard_period` CHECK (`period_code` IN ('DAY', 'WEEK', 'SEASON')),
  CONSTRAINT `chk_soc_b12_leaderboard_entries` CHECK (JSON_TYPE(`entries_json`) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 visibility-filtered leaderboard projection';

CREATE TABLE IF NOT EXISTS `soc_b12_report` (
  `report_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `report_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `room_ref` VARCHAR(128) NOT NULL,
  `target_ref` VARCHAR(128) NOT NULL,
  `reporter_subject_id` VARCHAR(128) NOT NULL,
  `category_code` VARCHAR(48) NOT NULL,
  `report_state` VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  `idempotency_key` VARCHAR(192) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`report_id`),
  UNIQUE KEY `uk_soc_b12_report_ref` (`tenant_id`, `report_ref`),
  UNIQUE KEY `uk_soc_b12_report_idempotency` (`tenant_id`, `idempotency_key`),
  KEY `idx_soc_b12_report_queue` (`tenant_id`, `report_state`, `created_at`),
  CONSTRAINT `chk_soc_b12_report_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_soc_b12_report_category` CHECK (`category_code` IN ('HARASSMENT', 'SPAM', 'INAPPROPRIATE_BEHAVIOR', 'SAFETY')),
  CONSTRAINT `chk_soc_b12_report_state` CHECK (`report_state` IN ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 controlled social report with no free text';

CREATE TABLE IF NOT EXISTS `ntf_b12_event_receipt` (
  `receipt_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `event_id` VARCHAR(128) NOT NULL,
  `event_name` VARCHAR(128) NOT NULL,
  `dedupe_key` VARCHAR(255) NOT NULL,
  `subject_id` VARCHAR(128) NOT NULL,
  `template_id` VARCHAR(96) NOT NULL,
  `processing_status` VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  `received_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`receipt_id`),
  UNIQUE KEY `uk_ntf_b12_event_id` (`tenant_id`, `event_id`),
  UNIQUE KEY `uk_ntf_b12_dedupe_key` (`tenant_id`, `dedupe_key`),
  KEY `idx_ntf_b12_receipt_subject` (`tenant_id`, `subject_id`, `received_at`),
  CONSTRAINT `chk_ntf_b12_receipt_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_ntf_b12_receipt_status` CHECK (`processing_status` IN ('RECEIVED', 'APPLIED', 'DUPLICATE', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 trusted notification event receipt';

CREATE TABLE IF NOT EXISTS `ntf_b12_delivery_attempt` (
  `attempt_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `task_ref` VARCHAR(128) NOT NULL,
  `notification_ref` VARCHAR(128) NOT NULL,
  `channel` VARCHAR(16) NOT NULL,
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `delivery_state` VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
  `next_attempt_at` DATETIME(6) NULL,
  `failure_code` VARCHAR(96) NULL,
  `idempotency_key` VARCHAR(192) NOT NULL,
  PRIMARY KEY (`attempt_id`),
  UNIQUE KEY `uk_ntf_b12_attempt_task` (`tenant_id`, `task_ref`),
  UNIQUE KEY `uk_ntf_b12_attempt_idempotency` (`tenant_id`, `idempotency_key`),
  KEY `idx_ntf_b12_attempt_dispatch` (`tenant_id`, `delivery_state`, `next_attempt_at`),
  CONSTRAINT `chk_ntf_b12_attempt_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_ntf_b12_attempt_channel` CHECK (`channel` IN ('IN_APP', 'PUSH', 'EMAIL')),
  CONSTRAINT `chk_ntf_b12_attempt_state` CHECK (`delivery_state` IN ('QUEUED', 'RETRY_SCHEDULED', 'DELIVERED', 'CANCELLED', 'DLQ'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 notification delivery retry state';

CREATE TABLE IF NOT EXISTS `ntf_b12_dlq` (
  `dlq_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `task_ref` VARCHAR(128) NOT NULL,
  `event_id` VARCHAR(128) NOT NULL,
  `failure_code` VARCHAR(96) NOT NULL,
  `attempt_count` INT UNSIGNED NOT NULL,
  `state` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`dlq_id`),
  UNIQUE KEY `uk_ntf_b12_dlq_task` (`tenant_id`, `task_ref`),
  KEY `idx_ntf_b12_dlq_state` (`tenant_id`, `state`, `created_at`),
  CONSTRAINT `chk_ntf_b12_dlq_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_ntf_b12_dlq_state` CHECK (`state` IN ('PENDING', 'REPLAYING', 'RESOLVED', 'CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 notification dead-letter boundary';

CREATE TABLE IF NOT EXISTS `wf_b12_recovery_task` (
  `task_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `domain_code` VARCHAR(32) NOT NULL,
  `aggregate_ref` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(192) NOT NULL,
  `command_code` VARCHAR(48) NOT NULL,
  `task_state` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_failure_code` VARCHAR(96) NULL,
  `domain_facts_untouched` TINYINT(1) NOT NULL DEFAULT 1,
  `next_run_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `completed_at` DATETIME(6) NULL,
  PRIMARY KEY (`task_id`),
  UNIQUE KEY `uk_wf_b12_task_ref` (`tenant_id`, `task_ref`),
  UNIQUE KEY `uk_wf_b12_task_idempotency` (`tenant_id`, `idempotency_key`),
  KEY `idx_wf_b12_task_dispatch` (`tenant_id`, `task_state`, `next_run_at`),
  CONSTRAINT `chk_wf_b12_task_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_wf_b12_task_domain` CHECK (`domain_code` IN ('NOTIFICATION', 'SOCIAL', 'GAMIFICATION', 'COMPATIBILITY')),
  CONSTRAINT `chk_wf_b12_task_state` CHECK (`task_state` IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DLQ', 'MANUAL_REVIEW', 'CANCELLED')),
  CONSTRAINT `chk_wf_b12_task_facts` CHECK (`domain_facts_untouched` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 workflow retry compensation and manual recovery task';

CREATE TABLE IF NOT EXISTS `cmp_b12_compatibility` (
  `comparison_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `comparison_ref` VARCHAR(128) NOT NULL,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `domain_code` VARCHAR(32) NOT NULL,
  `legacy_ref_hash` CHAR(64) NOT NULL,
  `target_ref_hash` CHAR(64) NULL,
  `event_id` VARCHAR(128) NULL,
  `read_mode` VARCHAR(24) NOT NULL DEFAULT 'SHADOW_READ',
  `comparison_state` VARCHAR(24) NOT NULL DEFAULT 'NOT_COMPARED',
  `read_only` TINYINT(1) NOT NULL DEFAULT 1,
  `domain_facts_untouched` TINYINT(1) NOT NULL DEFAULT 1,
  `fixture_version` VARCHAR(32) NOT NULL,
  `compared_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`comparison_id`),
  UNIQUE KEY `uk_cmp_b12_comparison_ref` (`tenant_id`, `comparison_ref`),
  KEY `idx_cmp_b12_domain_state` (`tenant_id`, `domain_code`, `comparison_state`, `compared_at`),
  CONSTRAINT `chk_cmp_b12_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_cmp_b12_domain` CHECK (`domain_code` IN ('GAMIFICATION', 'SOCIAL', 'NOTIFICATION')),
  CONSTRAINT `chk_cmp_b12_read_mode` CHECK (`read_mode` IN ('LEGACY_READ', 'SHADOW_READ', 'TARGET_READ', 'FALLBACK_READ')),
  CONSTRAINT `chk_cmp_b12_state` CHECK (`comparison_state` IN ('MATCH', 'MISMATCH', 'LEGACY_ONLY', 'TARGET_ONLY', 'UNAVAILABLE', 'NOT_COMPARED')),
  CONSTRAINT `chk_cmp_b12_read_only` CHECK (`read_only` = 1),
  CONSTRAINT `chk_cmp_b12_facts` CHECK (`domain_facts_untouched` = 1),
  CONSTRAINT `chk_cmp_b12_legacy_hash` CHECK (`legacy_ref_hash` REGEXP '^[A-Fa-f0-9]{64}$'),
  CONSTRAINT `chk_cmp_b12_target_hash` CHECK (`target_ref_hash` IS NULL OR `target_ref_hash` REGEXP '^[A-Fa-f0-9]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 legacy shadow-read and reconciliation evidence';

CREATE TABLE IF NOT EXISTS `cmp_b12_route_control` (
  `route_control_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `domain_code` VARCHAR(32) NOT NULL,
  `route_mode` VARCHAR(24) NOT NULL DEFAULT 'SHADOW',
  `target_version` VARCHAR(64) NOT NULL,
  `rollback_version` VARCHAR(64) NULL,
  `change_reason_code` VARCHAR(96) NOT NULL,
  `idempotency_key` VARCHAR(192) NOT NULL,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`route_control_id`),
  UNIQUE KEY `uk_cmp_b12_route_domain` (`tenant_id`, `domain_code`),
  UNIQUE KEY `uk_cmp_b12_route_idempotency` (`tenant_id`, `idempotency_key`),
  CONSTRAINT `chk_cmp_b12_route_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_cmp_b12_route_domain` CHECK (`domain_code` IN ('GAMIFICATION', 'SOCIAL', 'NOTIFICATION')),
  CONSTRAINT `chk_cmp_b12_route_mode` CHECK (`route_mode` IN ('LEGACY', 'SHADOW', 'TARGET', 'FALLBACK'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 reversible route switch control';

CREATE TABLE IF NOT EXISTS `cmp_b12_replay_ledger` (
  `replay_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL DEFAULT 'platform',
  `event_id` VARCHAR(128) NOT NULL,
  `dedupe_key` VARCHAR(255) NOT NULL,
  `domain_code` VARCHAR(32) NOT NULL,
  `replay_state` VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  `source_hash` CHAR(64) NOT NULL,
  `target_hash` CHAR(64) NULL,
  `read_only` TINYINT(1) NOT NULL DEFAULT 1,
  `domain_facts_untouched` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`replay_id`),
  UNIQUE KEY `uk_cmp_b12_replay_event` (`tenant_id`, `event_id`),
  UNIQUE KEY `uk_cmp_b12_replay_dedupe` (`tenant_id`, `dedupe_key`),
  KEY `idx_cmp_b12_replay_state` (`tenant_id`, `domain_code`, `replay_state`, `created_at`),
  CONSTRAINT `chk_cmp_b12_replay_tenant` CHECK (`tenant_id` = 'platform'),
  CONSTRAINT `chk_cmp_b12_replay_domain` CHECK (`domain_code` IN ('GAMIFICATION', 'SOCIAL', 'NOTIFICATION')),
  CONSTRAINT `chk_cmp_b12_replay_state` CHECK (`replay_state` IN ('RECEIVED', 'APPLIED', 'DUPLICATE', 'MISMATCH', 'REJECTED', 'ROLLED_BACK')),
  CONSTRAINT `chk_cmp_b12_replay_read_only` CHECK (`read_only` = 1),
  CONSTRAINT `chk_cmp_b12_replay_facts` CHECK (`domain_facts_untouched` = 1),
  CONSTRAINT `chk_cmp_b12_replay_source_hash` CHECK (`source_hash` REGEXP '^[A-Fa-f0-9]{64}$'),
  CONSTRAINT `chk_cmp_b12_replay_target_hash` CHECK (`target_hash` IS NULL OR `target_hash` REGEXP '^[A-Fa-f0-9]{64}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='B12 idempotent trusted-event replay evidence';
