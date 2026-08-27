-- B25 published learner content facts owned by content-service.
-- Answer rules remain private to assessment and are never returned by the learner API.

CREATE TABLE IF NOT EXISTS b25_content_course (
    content_code VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    content_type VARCHAR(32) NOT NULL DEFAULT 'COURSE',
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(2048) NULL,
    content_locale VARCHAR(16) NOT NULL DEFAULT 'en-US',
    target_level VARCHAR(8) NOT NULL,
    content_version_id BIGINT UNSIGNED NOT NULL,
    availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    rights_status VARCHAR(24) NOT NULL DEFAULT 'VALID',
    definition_json JSON NOT NULL,
    published_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (content_code),
    KEY idx_b25_content_catalog (tenant_id, availability, rights_status, content_locale, target_level),
    CONSTRAINT chk_b25_content_course_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b25_content_course_level CHECK (target_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    CONSTRAINT chk_b25_content_course_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY')),
    CONSTRAINT chk_b25_content_course_rights CHECK (rights_status IN ('VALID', 'PENDING', 'EXPIRED', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_content_unit (
    unit_id VARCHAR(96) NOT NULL,
    course_code VARCHAR(128) NOT NULL,
    unit_code VARCHAR(128) NOT NULL,
    unit_order INT UNSIGNED NOT NULL,
    title_key VARCHAR(192) NOT NULL,
    content_version INT UNSIGNED NOT NULL,
    availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    rights_status VARCHAR(24) NOT NULL DEFAULT 'VALID',
    published_at DATETIME(6) NOT NULL,
    PRIMARY KEY (unit_id),
    UNIQUE KEY uk_b25_content_unit_code (unit_code),
    UNIQUE KEY uk_b25_content_unit_course_order (course_code, unit_order),
    CONSTRAINT chk_b25_content_unit_order CHECK (unit_order > 0),
    CONSTRAINT chk_b25_content_unit_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY')),
    CONSTRAINT chk_b25_content_unit_rights CHECK (rights_status IN ('VALID', 'PENDING', 'EXPIRED', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_content_vocabulary (
    vocabulary_id VARCHAR(96) NOT NULL,
    unit_code VARCHAR(128) NOT NULL,
    word_normalized VARCHAR(128) NOT NULL,
    meaning_key VARCHAR(192) NOT NULL,
    cefr_level VARCHAR(8) NOT NULL,
    content_version INT UNSIGNED NOT NULL,
    availability VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    audio_ref VARCHAR(192) NULL,
    PRIMARY KEY (vocabulary_id),
    UNIQUE KEY uk_b25_content_vocabulary_word (word_normalized),
    KEY idx_b25_content_vocabulary_unit (unit_code, availability),
    CONSTRAINT chk_b25_content_vocabulary_level CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    CONSTRAINT chk_b25_content_vocabulary_availability CHECK (availability IN ('PUBLISHED', 'UNPUBLISHED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_content_item (
    item_id VARCHAR(128) NOT NULL,
    content_code VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    item_type VARCHAR(32) NOT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    prompt VARCHAR(2048) NOT NULL,
    options_json JSON NOT NULL,
    answer_rule_json JSON NOT NULL,
    media_ref VARCHAR(512) NULL,
    PRIMARY KEY (item_id),
    UNIQUE KEY uk_b25_content_item_order (content_code, display_order),
    KEY idx_b25_content_item_content (tenant_id, content_code),
    CONSTRAINT chk_b25_content_item_tenant CHECK (tenant_id = 'platform')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b25_content_answer_rule (
    rule_id VARCHAR(96) NOT NULL,
    rule_ref VARCHAR(192) NOT NULL,
    rule_version VARCHAR(32) NOT NULL,
    algorithm_code VARCHAR(64) NOT NULL,
    rule_definition_json JSON NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (rule_id),
    UNIQUE KEY uk_b25_content_answer_rule_ref (rule_ref, rule_version),
    CONSTRAINT chk_b25_content_answer_rule_status CHECK (status IN ('ACTIVE', 'RETIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
