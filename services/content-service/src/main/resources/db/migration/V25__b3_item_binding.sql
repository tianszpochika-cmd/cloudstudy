-- V25: B3-to-gradable-content bindings (B3 interaction loop).
-- A B3 legacy row becomes servable only through an ACTIVE binding that pins
-- the exact gradable coordinates (content_code, content_version_id,
-- question_item_id). Content versions are immutable facts, so the pinned
-- triple is a complete pin without any hash column: a new bank needs new
-- bindings. No binding is seeded for legacy rows without provenance; those
-- stay honestly empty. Revocation is a status flip, never a delete.
CREATE TABLE IF NOT EXISTS content_b3_item_binding (
    binding_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'platform',
    b3_domain VARCHAR(32) NOT NULL,
    b3_resource_type VARCHAR(64) NOT NULL,
    b3_resource_key VARCHAR(96) NOT NULL,
    b3_experience_id VARCHAR(96) NOT NULL,
    content_code VARCHAR(128) NOT NULL,
    content_version_id BIGINT NOT NULL,
    question_item_id VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_b3_binding_b3 (tenant_id, b3_domain, b3_resource_type, b3_resource_key),
    KEY idx_b3_binding_target (tenant_id, content_code, content_version_id),
    CONSTRAINT chk_b3_binding_tenant CHECK (tenant_id = 'platform'),
    CONSTRAINT chk_b3_binding_status CHECK (status IN ('ACTIVE', 'REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
