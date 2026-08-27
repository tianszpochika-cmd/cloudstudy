CREATE TABLE IF NOT EXISTS admin_projection (
    projection_id CHAR(36) NOT NULL,
    domain_name VARCHAR(64) NOT NULL,
    resource_ref VARCHAR(256) NOT NULL,
    projection_version BIGINT NOT NULL,
    redacted_payload JSON NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (projection_id),
    UNIQUE KEY uk_admin_projection_resource (domain_name, resource_ref),
    KEY idx_admin_projection_version (domain_name, projection_version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS support_ticket (
    ticket_id CHAR(36) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    requester_subject VARCHAR(128) NOT NULL,
    ticket_status VARCHAR(32) NOT NULL,
    priority VARCHAR(32) NOT NULL,
    redacted_summary VARCHAR(512) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (ticket_id),
    KEY idx_support_ticket_sla (tenant_id, ticket_status, priority)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_ops_outbox_event (
    event_id CHAR(36) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_name VARCHAR(160) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    dedupe_key VARCHAR(256) NOT NULL,
    payload_json JSON NOT NULL,
    status VARCHAR(24) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    available_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_admin_ops_outbox_dedupe (dedupe_key),
    KEY idx_admin_ops_outbox_dispatch (status, available_at)
) ENGINE=InnoDB;
