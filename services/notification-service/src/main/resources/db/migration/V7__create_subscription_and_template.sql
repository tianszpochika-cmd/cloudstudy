-- M6-001: managed subscription and template entities. Templates are versioned facts;
-- subscriptions are per-owner rows guarded by version_no. Consent remains the
-- send-time gate; these tables never replace it.

CREATE TABLE IF NOT EXISTS notification_subscription (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    notification_type VARCHAR(128) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    subscribed BOOLEAN NOT NULL,
    version_no BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, notification_type, channel),
    KEY idx_notification_subscription_owner (tenant_id, principal_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_template (
    template_key VARCHAR(128) NOT NULL,
    template_version VARCHAR(40) NOT NULL,
    locale VARCHAR(20) NOT NULL,
    title_template VARCHAR(160) NOT NULL,
    body_template VARCHAR(4000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (template_key, template_version, locale),
    KEY idx_notification_template_key (template_key, locale, status),
    CONSTRAINT chk_notification_template_status CHECK (status IN ('ACTIVE', 'RETIRED'))
) ENGINE=InnoDB;
