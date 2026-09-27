-- V24: canonical P1 placement item bank (M4-005 follow-up, D5A).
-- Ten sealed items (3 VOCABULARY / 3 BASIC_GRAMMAR / 2 READING / 2 LISTENING),
-- owned by content-service with ACTIVE rights. Assessment consumes them only
-- through the placement-bank internal endpoint (never by direct table reads).

CREATE TABLE IF NOT EXISTS content_placement_item (
    placement_item_id BIGINT NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    bank_code VARCHAR(64) NOT NULL DEFAULT 'P1_PLACEMENT_V1',
    dimension VARCHAR(24) NOT NULL,
    display_order INT NOT NULL,
    item_code VARCHAR(128) NOT NULL,
    item_type VARCHAR(24) NOT NULL,
    stem TEXT NOT NULL,
    options_json JSON NOT NULL,
    answer_rule_json JSON NOT NULL,
    question_type VARCHAR(24) NOT NULL DEFAULT 'CHOICE',
    scoring_version VARCHAR(96) NOT NULL DEFAULT 'p1-choice-v1',
    max_score INT NOT NULL DEFAULT 10,
    content_version_id BIGINT NOT NULL,
    content_code VARCHAR(128) NOT NULL,
    copyright_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    rights_allows_learning BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_placement_item_code (tenant_id, bank_code, item_code),
    KEY idx_placement_bank_order (tenant_id, bank_code, display_order),
    CONSTRAINT chk_placement_item_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_placement_item_bank CHECK (bank_code = 'P1_PLACEMENT_V1'),
    CONSTRAINT chk_placement_item_dimension CHECK (dimension IN ('VOCABULARY', 'BASIC_GRAMMAR', 'READING', 'LISTENING')),
    CONSTRAINT chk_placement_item_type CHECK (item_type IN ('VOCABULARY', 'GRAMMAR', 'READING', 'LISTENING')),
    CONSTRAINT chk_placement_item_status CHECK (status = 'PUBLISHED'),
    CONSTRAINT chk_placement_item_rights CHECK (copyright_status = 'ACTIVE' AND rights_allows_learning = TRUE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
