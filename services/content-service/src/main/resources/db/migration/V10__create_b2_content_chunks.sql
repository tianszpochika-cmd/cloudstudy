-- B2 vocabulary chunks are content-owned published facts.  The learner-facing
-- detail projection is read-only and never accepts answer or mastery writes.
CREATE TABLE IF NOT EXISTS b2_content_chunk (
    chunk_id BIGINT UNSIGNED NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    canonical_text VARCHAR(512) NOT NULL,
    chunk_type VARCHAR(64) NOT NULL,
    meaning_cn VARCHAR(512) NOT NULL,
    usage_note VARCHAR(1024) NULL,
    scenario_code VARCHAR(128) NULL,
    examples_json JSON NULL,
    content_version VARCHAR(64) NOT NULL,
    availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    PRIMARY KEY (chunk_id),
    KEY idx_b2_content_chunk_available (tenant_id, availability, chunk_id),
    CONSTRAINT chk_b2_content_chunk_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b2_content_chunk_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO b2_content_chunk (
    chunk_id, tenant_id, canonical_text, chunk_type, meaning_cn, usage_note,
    scenario_code, examples_json, content_version, availability
) VALUES (
    32001, 'platform', 'build a habit', 'COLLOCATION', '养成一个习惯',
    'Use build a habit when describing a repeated action that becomes part of daily life.',
    'DAILY_ROUTINE',
    JSON_ARRAY(JSON_OBJECT('sentence', 'It takes time to build a habit.', 'translation', '养成一个习惯需要时间。')),
    '25001', 'PUBLISHED'
)
ON DUPLICATE KEY UPDATE
    canonical_text = VALUES(canonical_text), chunk_type = VALUES(chunk_type),
    meaning_cn = VALUES(meaning_cn), usage_note = VALUES(usage_note),
    scenario_code = VALUES(scenario_code), examples_json = VALUES(examples_json),
    content_version = VALUES(content_version), availability = VALUES(availability);
