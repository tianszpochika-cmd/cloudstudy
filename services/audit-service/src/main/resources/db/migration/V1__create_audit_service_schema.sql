-- Append-only audit facts. Rows are never updated or deleted by the service; retention changes go
-- through legal hold and a future workflow-owned receipt. tenant_id is Phase 1 platform only.
CREATE TABLE IF NOT EXISTS audit_ingest_receipt (
  event_id CHAR(36) NOT NULL,
  source_service VARCHAR(64) NOT NULL,
  schema_version VARCHAR(32) NOT NULL,
  payload_digest CHAR(64) NOT NULL,
  request_id VARCHAR(64) NULL,
  trace_id VARCHAR(64) NULL,
  received_at DATETIME(6) NOT NULL,
  PRIMARY KEY (event_id),
  KEY idx_audit_receipt_source (source_service, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_fact (
  audit_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  actor_subject_hash CHAR(64) NOT NULL,
  action VARCHAR(96) NOT NULL,
  decision VARCHAR(16) NOT NULL,
  reason_code VARCHAR(64) NULL,
  occurred_at DATETIME(6) NOT NULL,
  request_id VARCHAR(64) NULL,
  trace_id VARCHAR(64) NULL,
  schema_version VARCHAR(32) NOT NULL,
  redacted_payload JSON NOT NULL,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (audit_id),
  UNIQUE KEY uk_audit_fact_event (event_id),
  KEY idx_audit_fact_tenant_time (tenant_id, occurred_at),
  CONSTRAINT fk_audit_fact_receipt FOREIGN KEY (event_id) REFERENCES audit_ingest_receipt (event_id),
  CONSTRAINT chk_audit_fact_tenant CHECK (tenant_id = 'platform'),
  CONSTRAINT chk_audit_fact_decision CHECK (decision IN ('ALLOW', 'DENY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_legal_hold (
  hold_id CHAR(36) NOT NULL,
  audit_id CHAR(36) NOT NULL,
  reason VARCHAR(192) NOT NULL,
  placed_at DATETIME(6) NOT NULL,
  released_at DATETIME(6) NULL,
  PRIMARY KEY (hold_id),
  UNIQUE KEY uk_audit_legal_hold (audit_id, placed_at),
  CONSTRAINT fk_audit_legal_hold_fact FOREIGN KEY (audit_id) REFERENCES audit_fact (audit_id),
  CONSTRAINT chk_audit_legal_hold_release CHECK (released_at IS NULL OR released_at >= placed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
