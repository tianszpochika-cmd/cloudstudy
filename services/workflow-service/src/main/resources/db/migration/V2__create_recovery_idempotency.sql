-- One durable claim per verified actor, operation and client key. The claim,
-- recovery transition and response snapshot are committed in one local transaction.
CREATE TABLE IF NOT EXISTS workflow_request_idempotency (
    tenant_id VARCHAR(64) NOT NULL,
    actor_subject VARCHAR(128) NOT NULL,
    operation VARCHAR(48) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    response_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, actor_subject, operation, idempotency_key)
) ENGINE=InnoDB;
