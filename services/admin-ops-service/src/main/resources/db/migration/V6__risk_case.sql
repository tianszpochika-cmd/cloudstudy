-- V6: ops-owned risk cases merged into the governance surface.
-- Cases are coordination facts (analyst-filed or rule-hit); containment and
-- escalation are recorded against owner-flow receipts, never executed here.
CREATE TABLE IF NOT EXISTS risk_case (
    case_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    source VARCHAR(16) NOT NULL,
    rule_id VARCHAR(64) NULL,
    rule_version VARCHAR(64) NULL,
    title VARCHAR(255) NOT NULL,
    subject_ref VARCHAR(128) NULL,
    evidence_refs_json JSON NOT NULL,
    assignee_note VARCHAR(512) NULL,
    containment_ref VARCHAR(256) NULL,
    escalation_target VARCHAR(16) NULL,
    escalation_ref VARCHAR(256) NULL,
    closed_reason VARCHAR(512) NULL,
    decisions_json JSON NOT NULL,
    last_audit_id VARCHAR(128) NULL,
    case_version BIGINT NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (case_id),
    KEY idx_risk_case_tenant_status (tenant_id, status, updated_at),
    KEY idx_risk_case_rule_subject (tenant_id, rule_id, subject_ref, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
