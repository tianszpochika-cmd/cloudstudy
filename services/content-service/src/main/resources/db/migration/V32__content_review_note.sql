-- Content-ops R2 (2026-10-13): reviewer reasons for content-version rejections.
-- Additive only. One row per reject/changes-requested decision; the admin
-- workbench shows the latest row for the latest version to the author.
CREATE TABLE IF NOT EXISTS content_review_note (
    note_id BIGINT NOT NULL AUTO_INCREMENT,
    tenant_id VARCHAR(128) NOT NULL DEFAULT 'platform',
    content_code VARCHAR(128) NOT NULL,
    content_version_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    review_stage VARCHAR(24) NOT NULL,
    decision VARCHAR(24) NOT NULL,
    note VARCHAR(512) NOT NULL,
    reviewer VARCHAR(128) NOT NULL,
    decided_at DATETIME(6) NOT NULL,
    PRIMARY KEY (note_id),
    KEY idx_content_review_note_code (tenant_id, content_code, decided_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
