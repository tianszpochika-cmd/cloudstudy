-- B5 商业化、权益、教研 CMS 与运营中台基础模型。
-- 金额统一使用最小货币单位；第三方回调只保留 hash/引用，不落原文或密钥。

CREATE TABLE IF NOT EXISTS com_sku (
  sku_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_code VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  entitlement_code VARCHAR(64) NOT NULL,
  billing_period VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sku_id), UNIQUE KEY uk_com_sku_code (sku_code), KEY idx_com_sku_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_sku_price (
  price_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_id BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  channel_code VARCHAR(24) NOT NULL,
  platform_code VARCHAR(32) NOT NULL DEFAULT 'ALL',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  effective_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMP NULL,
  PRIMARY KEY (price_id), UNIQUE KEY uk_com_price_snapshot (sku_id, currency, amount_minor, channel_code, platform_code, effective_from), KEY idx_com_price_active (sku_id, status, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_order (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  total_amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  source_platform VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  snapshot_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id), UNIQUE KEY uk_com_order_no (order_no), UNIQUE KEY uk_com_order_idempotency (user_id, idempotency_key), KEY idx_com_order_user_status (user_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_order_item (
  order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  price_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  amount_minor BIGINT UNSIGNED NOT NULL,
  snapshot_json JSON NOT NULL,
  PRIMARY KEY (order_item_id), UNIQUE KEY uk_com_order_item (order_id, sku_id, price_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_payment_attempt (
  attempt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  channel_code VARCHAR(24) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  provider_trade_no VARCHAR(128) NULL,
  request_hash CHAR(64) NULL,
  requested_at TIMESTAMP NULL,
  verified_at TIMESTAMP NULL,
  failure_code VARCHAR(64) NULL,
  PRIMARY KEY (attempt_id), UNIQUE KEY uk_com_payment_attempt (order_id, channel_code), KEY idx_com_payment_status (status, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_payment_callback (
  callback_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_code VARCHAR(24) NOT NULL,
  callback_event_id VARCHAR(128) NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  channel_trade_no VARCHAR(128) NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  signature_serial VARCHAR(128) NOT NULL,
  verification_status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (callback_id), UNIQUE KEY uk_com_callback_event (provider_code, callback_event_id), KEY idx_com_callback_order (order_id, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_apple_transaction (
  apple_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_ref VARCHAR(128) NOT NULL,
  original_transaction_ref VARCHAR(128) NOT NULL,
  product_id VARCHAR(128) NOT NULL,
  environment VARCHAR(24) NOT NULL,
  bundle_id VARCHAR(128) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'VERIFIED',
  verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (apple_transaction_id), UNIQUE KEY uk_com_apple_transaction (transaction_ref), KEY idx_com_apple_original (original_transaction_ref, environment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_apple_notification (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_ref VARCHAR(128) NOT NULL,
  notification_type VARCHAR(64) NOT NULL,
  original_transaction_ref VARCHAR(128) NULL,
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id), UNIQUE KEY uk_com_apple_notification (notification_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_subscription (
  subscription_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  original_transaction_ref VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  started_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NULL,
  grace_until TIMESTAMP NULL,
  PRIMARY KEY (subscription_id), UNIQUE KEY uk_com_subscription_original (original_transaction_ref), KEY idx_com_subscription_user (user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_entitlement (
  entitlement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  entitlement_code VARCHAR(64) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  source_ref VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  active_from TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  reason_code VARCHAR(64) NULL,
  PRIMARY KEY (entitlement_id), UNIQUE KEY uk_com_entitlement_source (source_type, source_ref), KEY idx_com_entitlement_user (user_id, entitlement_code, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_activation_batch (
  batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_ref VARCHAR(64) NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  code_count INT UNSIGNED NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id), UNIQUE KEY uk_com_activation_batch (batch_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_activation_code (
  activation_code_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
  redeemed_by BIGINT UNSIGNED NULL,
  redeemed_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  PRIMARY KEY (activation_code_id), UNIQUE KEY uk_com_activation_code_hash (code_hash), KEY idx_com_activation_code_status (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_household (
  household_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_ref VARCHAR(64) NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id), UNIQUE KEY uk_com_household_ref (household_ref), UNIQUE KEY uk_com_household_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_household_member (
  household_member_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role_code VARCHAR(24) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMP NULL,
  left_at TIMESTAMP NULL,
  PRIMARY KEY (household_member_id), UNIQUE KEY uk_com_household_member (household_id, user_id), KEY idx_com_household_member_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_refund (
  refund_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  entitlement_action VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  PRIMARY KEY (refund_id), UNIQUE KEY uk_com_refund_order (order_id), KEY idx_com_refund_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_invoice_request (
  invoice_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  invoice_type VARCHAR(24) NOT NULL,
  recipient_ref_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (invoice_request_id), UNIQUE KEY uk_com_invoice_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_reconciliation_batch (
  batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_ref VARCHAR(64) NOT NULL,
  channel_code VARCHAR(24) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'IMPORTED',
  item_count INT UNSIGNED NOT NULL DEFAULT 0,
  discrepancy_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id), UNIQUE KEY uk_com_reconciliation_batch (channel_code, source_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_reconciliation_item (
  item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  channel_trade_no VARCHAR(128) NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  discrepancy_code VARCHAR(64) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at TIMESTAMP NULL,
  PRIMARY KEY (item_id), UNIQUE KEY uk_com_reconciliation_item (batch_id, channel_trade_no), KEY idx_com_reconciliation_item_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS com_idempotency_record (
  record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_code VARCHAR(64) NOT NULL,
  scope_subject VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_json JSON NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  PRIMARY KEY (record_id), UNIQUE KEY uk_com_idempotency (scope_code, scope_subject, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_content (
  content_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_code VARCHAR(128) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  title VARCHAR(256) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  published_version_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (content_id), UNIQUE KEY uk_cms_content_code (content_code), KEY idx_cms_content_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_content_version (
  content_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  content_hash CHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  source_code VARCHAR(128) NOT NULL,
  license_code VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  editor_id BIGINT UNSIGNED NOT NULL,
  first_reviewer_id BIGINT UNSIGNED NULL,
  final_reviewer_id BIGINT UNSIGNED NULL,
  published_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL,
  PRIMARY KEY (content_version_id), UNIQUE KEY uk_cms_content_version (content_id, version_no), KEY idx_cms_version_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_asset (
  asset_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NULL,
  asset_hash CHAR(64) NOT NULL,
  asset_kind VARCHAR(32) NOT NULL,
  rights_ref VARCHAR(128) NOT NULL,
  storage_ref VARCHAR(256) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'READY',
  PRIMARY KEY (asset_id), UNIQUE KEY uk_cms_asset_hash_kind (asset_hash, asset_kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_review_task (
  review_task_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  stage VARCHAR(16) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  assigned_role VARCHAR(32) NOT NULL,
  reviewer_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  PRIMARY KEY (review_task_id), UNIQUE KEY uk_cms_review_stage (content_version_id, stage), KEY idx_cms_review_queue (status, assigned_role, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_review_action (
  review_action_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_task_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  decision_code VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_action_id), KEY idx_cms_review_action_task (review_task_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_publish_log (
  publish_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(24) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  reason_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (publish_log_id), KEY idx_cms_publish_log_content (content_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_import_job (
  import_job_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_ref VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
  total_count INT UNSIGNED NOT NULL DEFAULT 0,
  accepted_count INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (import_job_id), UNIQUE KEY uk_cms_import_source (target_type, source_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_import_row (
  import_row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_job_id BIGINT UNSIGNED NOT NULL,
  row_number INT UNSIGNED NOT NULL,
  normalized_key VARCHAR(256) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACCEPTED',
  issue_code VARCHAR(64) NULL,
  PRIMARY KEY (import_row_id), UNIQUE KEY uk_cms_import_row (import_job_id, row_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_sensitive_rule (
  rule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rule_version VARCHAR(64) NOT NULL,
  rule_code VARCHAR(64) NOT NULL,
  mode VARCHAR(24) NOT NULL DEFAULT 'BLOCK',
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (rule_id), UNIQUE KEY uk_cms_sensitive_rule (rule_version, rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_sensitive_hit (
  hit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NULL,
  rule_id BIGINT UNSIGNED NOT NULL,
  match_hash CHAR(64) NOT NULL,
  decision_code VARCHAR(24) NOT NULL DEFAULT 'BLOCKED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (hit_id), KEY idx_cms_sensitive_hit_version (content_version_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_correction_ticket (
  ticket_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_ref VARCHAR(64) NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  ticket_type VARCHAR(32) NOT NULL,
  resource_ref VARCHAR(128) NOT NULL,
  description_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  assignee_id BIGINT UNSIGNED NULL,
  sla_due_at TIMESTAMP NULL,
  resolution_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  PRIMARY KEY (ticket_id), UNIQUE KEY uk_cms_ticket_ref (ticket_ref), KEY idx_cms_ticket_queue (status, sla_due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cms_correction_message (
  message_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  client_message_ref VARCHAR(128) NOT NULL,
  message_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id), UNIQUE KEY uk_cms_ticket_message (ticket_id, client_message_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_user_risk (
  user_id BIGINT UNSIGNED NOT NULL,
  risk_level VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  login_frozen_until TIMESTAMP NULL,
  payment_frozen_until TIMESTAMP NULL,
  rate_limit_until TIMESTAMP NULL,
  rule_version VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_risk_event (
  risk_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(32) NOT NULL,
  ttl_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  rule_version VARCHAR(64) NOT NULL,
  reason_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (risk_event_id), KEY idx_ops_risk_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_metric_snapshot (
  snapshot_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  metric_date DATE NOT NULL,
  metric_code VARCHAR(64) NOT NULL,
  metric_value DECIMAL(20,6) NULL,
  completeness VARCHAR(24) NOT NULL DEFAULT 'PARTIAL',
  source_watermark TIMESTAMP NULL,
  PRIMARY KEY (snapshot_id), UNIQUE KEY uk_ops_metric_snapshot (metric_date, metric_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_feature_flag (
  flag_key VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  rollout_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  rule_version VARCHAR(64) NOT NULL,
  allowed_platforms_json JSON NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (flag_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_experiment_assignment (
  assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  flag_key VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  bucket INT UNSIGNED NOT NULL,
  rule_version VARCHAR(64) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id), UNIQUE KEY uk_ops_assignment (flag_key, user_id, rule_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_audit_log (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id VARCHAR(128) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  action_code VARCHAR(96) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_ref VARCHAR(128) NOT NULL,
  result_code VARCHAR(64) NOT NULL,
  redacted TINYINT(1) NOT NULL DEFAULT 1,
  retention_until DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id), KEY idx_ops_audit_resource_time (resource_type, resource_ref, created_at), KEY idx_ops_audit_retention (retention_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
