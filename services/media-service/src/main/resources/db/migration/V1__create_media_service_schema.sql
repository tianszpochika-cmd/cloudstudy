CREATE TABLE IF NOT EXISTS media_asset (
    asset_id CHAR(36) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    owner_subject VARCHAR(128) NOT NULL,
    content_version_id BIGINT NULL,
    asset_version BIGINT NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    rights_status VARCHAR(32) NOT NULL,
    asset_status VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (asset_id),
    UNIQUE KEY uk_media_asset_version (asset_id, asset_version),
    KEY idx_media_rights (tenant_id, rights_status, asset_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media_rendition (
    rendition_id CHAR(36) NOT NULL,
    asset_id CHAR(36) NOT NULL,
    rendition_key VARCHAR(128) NOT NULL,
    rendition_version BIGINT NOT NULL,
    rendition_status VARCHAR(32) NOT NULL,
    object_reference VARCHAR(512) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (rendition_id),
    UNIQUE KEY uk_media_rendition (asset_id, rendition_key, rendition_version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media_outbox_event (
    event_id CHAR(36) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(160) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    dedupe_key VARCHAR(256) NOT NULL,
    payload_json JSON NOT NULL,
    status VARCHAR(24) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    available_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_media_outbox_dedupe (dedupe_key),
    KEY idx_media_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
