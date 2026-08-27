CREATE TABLE IF NOT EXISTS content_version (
    content_version_id BIGINT NOT NULL,
    content_id VARCHAR(128) NOT NULL,
    version_no BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    copyright_status VARCHAR(32) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (content_version_id),
    UNIQUE KEY uk_content_version (content_id, version_no),
    KEY idx_content_status (content_id, status, version_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS content_outbox_event (
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
    UNIQUE KEY uk_content_outbox_dedupe (dedupe_key),
    KEY idx_content_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
