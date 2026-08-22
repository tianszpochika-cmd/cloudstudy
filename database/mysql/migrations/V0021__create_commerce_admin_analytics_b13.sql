-- B13 is additive. Domain facts remain owned by their extracted service; admin and analytics
-- tables are commands/projections/receipts and must not become a second commerce source of truth.

CREATE TABLE IF NOT EXISTS `com_b13_sku` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `sku_id` VARCHAR(128) NOT NULL,
    `entitlement_code` VARCHAR(96) NOT NULL,
    `title_key` VARCHAR(160) NOT NULL,
    `description_key` VARCHAR(240) NOT NULL,
    `billing_period` VARCHAR(32) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `published_state` VARCHAR(32) NOT NULL,
    `version` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_sku` (`tenant_id`, `sku_id`, `version`),
    KEY `idx_com_b13_sku_state` (`tenant_id`, `published_state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_price_snapshot` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `price_snapshot_id` VARCHAR(128) NOT NULL,
    `sku_id` VARCHAR(128) NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `region_code` VARCHAR(32) NULL,
    `valid_from` DATETIME(6) NOT NULL,
    `valid_until` DATETIME(6) NULL,
    `published_state` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_price_snapshot` (`tenant_id`, `price_snapshot_id`),
    KEY `idx_com_b13_price_sku` (`tenant_id`, `sku_id`, `valid_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_order` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `order_id` VARCHAR(128) NOT NULL,
    `subject_ref` VARCHAR(128) NOT NULL,
    `sku_id` VARCHAR(128) NOT NULL,
    `price_snapshot_id` VARCHAR(128) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `channel` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_order` (`tenant_id`, `order_id`),
    KEY `idx_com_b13_order_subject` (`tenant_id`, `subject_ref`, `created_at`),
    KEY `idx_com_b13_order_state` (`tenant_id`, `state`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_order_item` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `order_id` VARCHAR(128) NOT NULL,
    `sku_id` VARCHAR(128) NOT NULL,
    `entitlement_code` VARCHAR(96) NOT NULL,
    `quantity` INT UNSIGNED NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_order_item` (`tenant_id`, `order_id`, `sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_entitlement` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `entitlement_id` VARCHAR(128) NOT NULL,
    `subject_ref` VARCHAR(128) NOT NULL,
    `entitlement_code` VARCHAR(96) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `source_ref` VARCHAR(128) NOT NULL,
    `activation_reason` VARCHAR(32) NOT NULL,
    `starts_at` DATETIME(6) NOT NULL,
    `expires_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_entitlement` (`tenant_id`, `entitlement_id`),
    KEY `idx_com_b13_entitlement_subject` (`tenant_id`, `subject_ref`, `state`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_activation_batch` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `batch_ref` VARCHAR(128) NOT NULL,
    `entitlement_code` VARCHAR(96) NOT NULL,
    `quantity` INT UNSIGNED NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_activation_batch` (`tenant_id`, `batch_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_activation_code` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `batch_ref` VARCHAR(128) NOT NULL,
    `code_digest` CHAR(64) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `redeemed_at` DATETIME(6) NULL,
    `redemption_ref` VARCHAR(128) NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_activation_code` (`tenant_id`, `code_digest`),
    KEY `idx_com_b13_activation_code_batch` (`tenant_id`, `batch_ref`, `state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_payment_callback` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `provider_event_ref` VARCHAR(160) NOT NULL,
    `order_ref` VARCHAR(128) NOT NULL,
    `callback_state` VARCHAR(32) NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `verification_ref` VARCHAR(128) NOT NULL,
    `payload_digest` CHAR(64) NOT NULL,
    `received_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_payment_callback` (`tenant_id`, `provider_event_ref`),
    KEY `idx_com_b13_payment_order` (`tenant_id`, `order_ref`, `received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_refund` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `refund_id` VARCHAR(128) NOT NULL,
    `order_id` VARCHAR(128) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `reason_code` VARCHAR(96) NOT NULL,
    `amount_minor` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_refund` (`tenant_id`, `refund_id`),
    KEY `idx_com_b13_refund_order` (`tenant_id`, `order_id`, `state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_reconciliation_batch` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `batch_ref` VARCHAR(128) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `window_start` DATETIME(6) NOT NULL,
    `window_end` DATETIME(6) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `difference_count` INT UNSIGNED NOT NULL,
    `domain_facts_untouched` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_reconciliation_batch` (`tenant_id`, `batch_ref`),
    CONSTRAINT `chk_com_b13_reconciliation_untouched` CHECK (`domain_facts_untouched` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_reconciliation_item` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `batch_ref` VARCHAR(128) NOT NULL,
    `order_ref` VARCHAR(128) NOT NULL,
    `difference_code` VARCHAR(96) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_com_b13_reconciliation_item` (`tenant_id`, `batch_ref`, `state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_idempotency` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `subject_ref` VARCHAR(128) NOT NULL,
    `idempotency_key` VARCHAR(200) NOT NULL,
    `command_fingerprint` CHAR(64) NOT NULL,
    `response_ref` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_idempotency` (`tenant_id`, `subject_ref`, `idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `com_b13_outbox_event` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `event_id` VARCHAR(128) NOT NULL,
    `event_name` VARCHAR(128) NOT NULL,
    `aggregate_id` VARCHAR(128) NOT NULL,
    `dedupe_key` VARCHAR(200) NOT NULL,
    `payload_digest` CHAR(64) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `dlq_state` VARCHAR(32) NOT NULL DEFAULT 'NONE',
    `occurred_at` DATETIME(6) NOT NULL,
    `published_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_com_b13_outbox_event` (`tenant_id`, `event_id`),
    KEY `idx_com_b13_outbox_state` (`tenant_id`, `state`, `occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `adm_b13_command` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `command_id` VARCHAR(128) NOT NULL,
    `aggregate_type` VARCHAR(64) NOT NULL,
    `aggregate_ref` VARCHAR(128) NOT NULL,
    `action_code` VARCHAR(64) NOT NULL,
    `route_mode` VARCHAR(32) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `reason_code` VARCHAR(96) NOT NULL,
    `read_only` TINYINT(1) NOT NULL DEFAULT 0,
    `domain_facts_untouched` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_adm_b13_command` (`tenant_id`, `command_id`),
    KEY `idx_adm_b13_command_state` (`tenant_id`, `state`, `updated_at`),
    CONSTRAINT `chk_adm_b13_command_untouched` CHECK (`domain_facts_untouched` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `adm_b13_approval` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `command_id` VARCHAR(128) NOT NULL,
    `approval_stage` VARCHAR(32) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `approver_ref` VARCHAR(128) NULL,
    `decision_reason_code` VARCHAR(96) NULL,
    `created_at` DATETIME(6) NOT NULL,
    `decided_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_adm_b13_approval` (`tenant_id`, `command_id`, `approval_stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `adm_b13_ticket` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `ticket_id` VARCHAR(128) NOT NULL,
    `category_code` VARCHAR(64) NOT NULL,
    `subject_code` VARCHAR(128) NOT NULL,
    `priority` VARCHAR(32) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `sla_due_at` DATETIME(6) NOT NULL,
    `redaction_version` VARCHAR(32) NOT NULL,
    `read_only` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_adm_b13_ticket` (`tenant_id`, `ticket_id`),
    KEY `idx_adm_b13_ticket_queue` (`tenant_id`, `state`, `priority`, `sla_due_at`),
    CONSTRAINT `chk_adm_b13_ticket_read_only` CHECK (`read_only` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `adm_b13_ticket_attachment_ref` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `ticket_id` VARCHAR(128) NOT NULL,
    `attachment_ref` VARCHAR(128) NOT NULL,
    `content_class` VARCHAR(64) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_adm_b13_ticket_attachment` (`tenant_id`, `ticket_id`, `attachment_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `adm_b13_audit_link` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `audit_ref` VARCHAR(128) NOT NULL,
    `aggregate_type` VARCHAR(64) NOT NULL,
    `aggregate_ref` VARCHAR(128) NOT NULL,
    `command_id` VARCHAR(128) NULL,
    `route_mode` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_adm_b13_audit_link` (`tenant_id`, `audit_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `anl_b13_event_receipt` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `event_id` VARCHAR(128) NOT NULL,
    `event_name` VARCHAR(96) NOT NULL,
    `dedupe_key` VARCHAR(200) NOT NULL,
    `redaction_version` VARCHAR(32) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `dlq_state` VARCHAR(32) NOT NULL DEFAULT 'NONE',
    `occurred_at` DATETIME(6) NOT NULL,
    `received_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_anl_b13_event_receipt` (`tenant_id`, `event_id`),
    UNIQUE KEY `uk_anl_b13_event_dedupe` (`tenant_id`, `dedupe_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `anl_b13_metric_definition` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `metric_code` VARCHAR(96) NOT NULL,
    `metric_version` VARCHAR(32) NOT NULL,
    `event_allowlist_version` VARCHAR(32) NOT NULL,
    `redaction_version` VARCHAR(32) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_anl_b13_metric_definition` (`tenant_id`, `metric_code`, `metric_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `anl_b13_metric_projection` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `projection_ref` VARCHAR(128) NOT NULL,
    `metric_code` VARCHAR(96) NOT NULL,
    `metric_version` VARCHAR(32) NOT NULL,
    `window_start` DATETIME(6) NOT NULL,
    `window_end` DATETIME(6) NOT NULL,
    `value_decimal` DECIMAL(20,6) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `generated_at` DATETIME(6) NOT NULL,
    `read_only` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_anl_b13_projection` (`tenant_id`, `projection_ref`),
    KEY `idx_anl_b13_projection_metric` (`tenant_id`, `metric_code`, `window_start`, `window_end`),
    CONSTRAINT `chk_anl_b13_projection_read_only` CHECK (`read_only` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `anl_b13_recompute_job` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` VARCHAR(64) NOT NULL,
    `job_id` VARCHAR(128) NOT NULL,
    `metric_code` VARCHAR(96) NOT NULL,
    `metric_version` VARCHAR(32) NOT NULL,
    `window_start` DATETIME(6) NOT NULL,
    `window_end` DATETIME(6) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `reason_code` VARCHAR(96) NOT NULL,
    `idempotency_key` VARCHAR(200) NOT NULL,
    `created_at` DATETIME(6) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_anl_b13_recompute_job` (`tenant_id`, `job_id`),
    UNIQUE KEY `uk_anl_b13_recompute_idempotency` (`tenant_id`, `idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
