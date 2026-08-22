-- analytics-service owns every table in this migration.
-- This is an additive projection/journal schema: it never joins or writes a domain fact table.
-- No raw PII, answer text, audio, order/payment credential or token is stored here.

CREATE TABLE analytics_event_receipt (
    tenant_id VARCHAR(64) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(128) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    dedupe_key VARCHAR(256) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    metric_version VARCHAR(64) NOT NULL,
    receipt_state VARCHAR(24) NOT NULL,
    reason_code VARCHAR(96) NULL,
    received_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, dedupe_key),
    UNIQUE KEY uk_analytics_event_receipt_event (tenant_id, event_id),
    KEY idx_analytics_event_receipt_received (tenant_id, received_at)
) ENGINE = InnoDB;

CREATE TABLE analytics_event_journal (
    tenant_id VARCHAR(64) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(128) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    dedupe_key VARCHAR(256) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    sanitized_payload_json JSON NOT NULL,
    PRIMARY KEY (tenant_id, event_id),
    KEY idx_analytics_event_journal_window (tenant_id, occurred_at)
) ENGINE = InnoDB;

CREATE TABLE analytics_metric_projection (
    tenant_id VARCHAR(64) NOT NULL,
    metric_id VARCHAR(128) NOT NULL,
    metric_version VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    dimension_key VARCHAR(128) NOT NULL,
    projection_state VARCHAR(24) NOT NULL,
    event_count BIGINT NOT NULL,
    total_value BIGINT NOT NULL,
    last_occurred_at TIMESTAMP(6) NULL,
    source_watermark CHAR(64) NULL,
    projection_version BIGINT NOT NULL,
    error_code VARCHAR(96) NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, metric_id, metric_version, period_start, dimension_key),
    KEY idx_analytics_metric_projection_query (tenant_id, period_start, metric_id)
) ENGINE = InnoDB;

CREATE TABLE analytics_recompute_job (
    job_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    metric_version VARCHAR(64) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    job_state VARCHAR(24) NOT NULL,
    replayed_event_count BIGINT NOT NULL,
    projection_count BIGINT NOT NULL,
    reason_code VARCHAR(96) NULL,
    started_at TIMESTAMP(6) NOT NULL,
    completed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (job_id),
    KEY idx_analytics_recompute_tenant (tenant_id, started_at)
) ENGINE = InnoDB;
