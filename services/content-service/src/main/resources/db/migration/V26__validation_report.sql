-- V26: version-bound validation reports for the submission gate.
-- A report is an immutable server fact bound to (content_version_id, payload_hash):
-- SUBMIT_REVIEW / PUBLISH / L2 auto-activation re-query by that key, so an old
-- PASS can never endorse edited content. Media refs declared by the payload are
-- stored for audit; Phase 1 has no media-eligibility fact pipeline, so any
-- non-empty media set fails the gate closed (MEDIA_ELIGIBILITY_UNAVAILABLE).
CREATE TABLE IF NOT EXISTS content_validation_report (
    report_id VARCHAR(128) NOT NULL,
    report_version BIGINT UNSIGNED NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    passed TINYINT(1) NOT NULL,
    finding_count INT UNSIGNED NOT NULL DEFAULT 0,
    blocker_count INT UNSIGNED NOT NULL DEFAULT 0,
    findings_json JSON NOT NULL,
    media_refs_json JSON NOT NULL,
    checked_by VARCHAR(128) NOT NULL,
    checked_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (report_id),
    UNIQUE KEY uk_validation_report_binding (content_version_id, payload_hash, rule_version),
    KEY idx_validation_report_version (content_version_id, payload_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
