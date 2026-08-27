-- Public-site facet read model owned by content-service.
-- These rows are a published, field-filtered projection only; domain facts
-- such as commerce SKUs remain in their owning service.
CREATE TABLE IF NOT EXISTS content_public_site_facet (
    facet_id VARCHAR(128) NOT NULL,
    ui_locale VARCHAR(16) NOT NULL,
    facet_type VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    payload_json JSON NOT NULL,
    projection_version BIGINT NOT NULL DEFAULT 1,
    published_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (facet_id, ui_locale),
    KEY idx_content_public_site_facet_read (facet_type, status, ui_locale, published_at),
    CONSTRAINT chk_content_public_site_facet_type CHECK (facet_type IN ('DOWNLOAD', 'ANNOUNCEMENT', 'COMPLIANCE', 'CAMPAIGN')),
    CONSTRAINT chk_content_public_site_facet_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
