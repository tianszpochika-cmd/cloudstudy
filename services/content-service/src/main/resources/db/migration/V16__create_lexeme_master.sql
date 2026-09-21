-- B1 single-tenant word master: row-level lexeme facts owned by content-service.
-- Fixed columns carry identity, lifecycle and query dimensions; fields_json carries
-- the extensible rich configuration (senses, examples, collocations, morphology,
-- mnemonics, tags) so new fields never require DDL. Audio bytes are never stored
-- here; pronunciations reference media-service assets by id only.
CREATE TABLE IF NOT EXISTS lexeme (
    lexeme_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL DEFAULT 'platform',
    pack_code VARCHAR(128) NOT NULL,
    headword VARCHAR(128) NOT NULL,
    cefr VARCHAR(8) NULL,
    availability VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    state_version BIGINT NOT NULL DEFAULT 1,
    content_version INT NOT NULL DEFAULT 1,
    created_by VARCHAR(128) NOT NULL,
    updated_by VARCHAR(128) NULL,
    first_reviewer VARCHAR(128) NULL,
    final_reviewer VARCHAR(128) NULL,
    publisher VARCHAR(128) NULL,
    fields_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (lexeme_id),
    UNIQUE KEY uk_lexeme_pack_headword (tenant_id, pack_code, headword),
    KEY idx_lexeme_pack_availability (tenant_id, pack_code, availability, headword),
    KEY idx_lexeme_cefr_availability (tenant_id, cefr, availability),
    CONSTRAINT chk_lexeme_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_lexeme_availability CHECK (availability IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lexeme_pronunciation (
    pronunciation_id VARCHAR(128) NOT NULL,
    lexeme_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL DEFAULT 'platform',
    accent VARCHAR(8) NOT NULL,
    ipa VARCHAR(128) NOT NULL,
    audio_asset_id VARCHAR(128) NOT NULL,
    source_type VARCHAR(8) NOT NULL,
    voice_name VARCHAR(128) NULL,
    duration_ms INT NULL,
    sample_rate INT NULL,
    bitrate_kbps INT NULL,
    qc_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    qc_by VARCHAR(128) NULL,
    qc_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (pronunciation_id),
    KEY idx_lexeme_pronunciation_lexeme (lexeme_id, accent, qc_status),
    CONSTRAINT chk_lexeme_pron_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_lexeme_pron_accent CHECK (accent IN ('US', 'UK', 'SLOW')),
    CONSTRAINT chk_lexeme_pron_source CHECK (source_type IN ('HUMAN', 'TTS')),
    CONSTRAINT chk_lexeme_pron_qc CHECK (qc_status IN ('PENDING', 'READY', 'CLEAN', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
