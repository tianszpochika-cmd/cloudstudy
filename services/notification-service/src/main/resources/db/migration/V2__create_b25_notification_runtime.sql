-- B25 durable notification read projection. Delivery remains behind the notification owner.

CREATE TABLE IF NOT EXISTS b25_notification_preference (
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    learning_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ui_locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    idempotency_key VARCHAR(192) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (principal_id),
    CONSTRAINT chk_b25_notification_preference_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_notification_message (
    message_id CHAR(36) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    template_code VARCHAR(96) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'UNREAD',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (message_id),
    KEY idx_b25_notification_message_owner (tenant_id, principal_id, status, created_at),
    CONSTRAINT chk_b25_notification_message_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_notification_message_status CHECK (status IN ('UNREAD', 'READ', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
