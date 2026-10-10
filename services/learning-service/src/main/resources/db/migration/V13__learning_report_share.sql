-- Owner-issued read-only report shares. The snapshot stores public fields only.
CREATE TABLE IF NOT EXISTS b25_learning_report_share (
    share_ref CHAR(32) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    principal_id VARCHAR(128) NOT NULL,
    report_type VARCHAR(16) NOT NULL,
    snapshot_json JSON NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (share_ref),
    KEY idx_b25_learning_report_share_owner (tenant_id, principal_id, created_at),
    CONSTRAINT chk_b25_learning_report_share_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_learning_report_share_type CHECK (report_type IN ('DAILY', 'WEEKLY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
