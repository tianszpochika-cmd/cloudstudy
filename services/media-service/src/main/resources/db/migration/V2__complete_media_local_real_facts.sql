-- Complete the media owner's metadata projection for the local-real profile.
-- Object bytes remain in the configured object store; this schema stores only
-- metadata, rights and delivery references.

ALTER TABLE media_asset
    ADD COLUMN asset_key VARCHAR(160) NOT NULL DEFAULT 'local-media',
    ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'AUDIO',
    ADD COLUMN mime_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
    ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'LOCAL_OBJECT_STORE',
    ADD COLUMN bucket_name VARCHAR(128) NOT NULL DEFAULT 'yuxuexing-local',
    ADD COLUMN object_key VARCHAR(512) NOT NULL DEFAULT 'local-media',
    ADD COLUMN object_version VARCHAR(128) NULL,
    ADD COLUMN supports_range BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN chunk_size_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN part_count INT NOT NULL DEFAULT 0,
    ADD COLUMN transcoding_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN content_role VARCHAR(64) NOT NULL DEFAULT 'LEARNING_AUDIO',
    ADD COLUMN segment_id VARCHAR(160) NULL,
    ADD COLUMN rights_id VARCHAR(128) NOT NULL DEFAULT 'local-rights',
    ADD COLUMN license_code VARCHAR(96) NOT NULL DEFAULT 'LOCAL_FIXTURE',
    ADD COLUMN permitted_channels VARCHAR(256) NOT NULL DEFAULT 'STREAM,DOWNLOAD,OFFLINE',
    ADD COLUMN rights_starts_at DATETIME(6) NULL,
    ADD COLUMN rights_expires_at DATETIME(6) NULL,
    ADD COLUMN allow_offline BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN authorization_evidence_ref VARCHAR(256) NULL;

ALTER TABLE media_rendition
    ADD COLUMN mime_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
    ADD COLUMN checksum_sha256 CHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    ADD COLUMN size_bytes BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN supports_range BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN failure_code VARCHAR(96) NULL;

CREATE TABLE media_idempotency_record (
    tenant_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    asset_id CHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, subject_id, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_media_asset_lookup
    ON media_asset (tenant_id, asset_status, rights_status, content_version_id);
