ALTER TABLE offline_sync_cursor
    ADD COLUMN vector_json TEXT NULL;

UPDATE offline_sync_cursor
SET vector_json = '{}'
WHERE vector_json IS NULL;

ALTER TABLE offline_sync_cursor
    MODIFY vector_json TEXT NOT NULL;

CREATE TABLE IF NOT EXISTS offline_sync_receipt (
    tenant_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    client_event_id VARCHAR(120) NOT NULL,
    fingerprint VARCHAR(512) NOT NULL,
    client_seq BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL,
    server_version BIGINT NOT NULL,
    accepted_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, subject_id, device_id, client_event_id),
    UNIQUE KEY uk_offline_receipt_sequence (tenant_id, subject_id, device_id, client_seq),
    KEY idx_offline_receipt_owner (tenant_id, subject_id, device_id, accepted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_offline_package (
    package_id VARCHAR(96) NOT NULL,
    package_code VARCHAR(96) NOT NULL,
    version_code VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    size_bytes BIGINT NOT NULL,
    part_count INT NOT NULL,
    sha256 VARCHAR(128) NOT NULL,
    signature VARCHAR(256) NOT NULL,
    min_client_version VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    signed_part_urls_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (package_id),
    UNIQUE KEY uk_offline_package_code_version (package_code, version_code),
    KEY idx_offline_package_state (state, expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_offline_download (
    download_id VARCHAR(96) NOT NULL,
    package_id VARCHAR(96) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    state VARCHAR(32) NOT NULL,
    completed_parts_json JSON NOT NULL,
    downloaded_bytes BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (download_id),
    UNIQUE KEY uk_offline_download_owner (package_id, tenant_id, principal_id, device_id),
    KEY idx_offline_download_owner (tenant_id, principal_id, device_id, updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_offline_event (
    event_seq BIGINT NOT NULL AUTO_INCREMENT,
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    client_batch_id VARCHAR(128) NOT NULL,
    client_event_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(160) NOT NULL,
    entity_id VARCHAR(160) NOT NULL,
    entity_version BIGINT NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    payload_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_seq),
    UNIQUE KEY uk_notification_offline_event (tenant_id, principal_id, device_id, client_event_id),
    KEY idx_notification_offline_event_owner (tenant_id, principal_id, device_id, event_seq)
) ENGINE=InnoDB;
