-- P1R-M2-006: the workflow-service schema.
--
-- This service owns saga state, job leases, manual recovery requests and their receipts. It owns no
-- domain facts: a saga records how far a cross-domain operation got and which compensation closes each
-- completed step, and the domains remain the owners of what those steps changed. Nothing here is written
-- by another service and nothing here writes another owner's tables.
--
-- workflow_outbox_event is created in the standard event-runtime shape that P1R-M2-005 brought the ten
-- owner outboxes to, so this service starts conformant rather than needing the standardisation migration
-- the others went through.

CREATE TABLE IF NOT EXISTS saga_instance (
    saga_id CHAR(36) NOT NULL,
    saga_name VARCHAR(120) NOT NULL,
    -- The correlation the caller used, so a saga can be found from the request that started it.
    correlation_id VARCHAR(128) NOT NULL,
    request_id VARCHAR(128) NULL,
    trace_id VARCHAR(128) NULL,
    status VARCHAR(24) NOT NULL,
    current_step VARCHAR(120) NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error_code VARCHAR(64) NULL,
    last_error_message VARCHAR(255) NULL,
    started_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    finished_at DATETIME(6) NULL,
    PRIMARY KEY (saga_id),
    UNIQUE KEY uk_saga_correlation (saga_name, correlation_id),
    KEY idx_saga_status (status, updated_at)
) ENGINE=InnoDB;

-- One row per step of a saga. The compensation is recorded before the step is attempted, so a crash
-- between doing the work and recording how to undo it cannot leave an uncompensatable step.
CREATE TABLE IF NOT EXISTS saga_step (
    saga_id CHAR(36) NOT NULL,
    step_name VARCHAR(120) NOT NULL,
    step_order INT NOT NULL,
    status VARCHAR(24) NOT NULL,
    compensation_name VARCHAR(120) NULL,
    compensation_state VARCHAR(24) NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error_code VARCHAR(64) NULL,
    last_error_message VARCHAR(255) NULL,
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (saga_id, step_name),
    KEY idx_saga_step_order (saga_id, step_order)
) ENGINE=InnoDB;

-- Scheduled jobs and their leases. A lease is held by named owner until a deadline, so a second instance
-- cannot run the same job simply because it started; an expired lease is reclaimable rather than stuck.
CREATE TABLE IF NOT EXISTS scheduled_job (
    job_name VARCHAR(120) NOT NULL,
    cron_expression VARCHAR(80) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    next_run_at DATETIME(6) NULL,
    lease_owner VARCHAR(128) NULL,
    lease_expires_at DATETIME(6) NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    last_outcome VARCHAR(24) NULL,
    last_error_message VARCHAR(255) NULL,
    last_run_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (job_name),
    KEY idx_scheduled_job_due (enabled, next_run_at),
    KEY idx_scheduled_job_lease (lease_expires_at)
) ENGINE=InnoDB;

-- A manual recovery is a two-person operation: the requester and the approver are recorded separately and
-- the service refuses an approval from the same principal that asked. Nothing is deleted, so the trail of
-- who asked, who approved and what was done survives the operation.
CREATE TABLE IF NOT EXISTS manual_recovery_request (
    recovery_id CHAR(36) NOT NULL,
    subject_type VARCHAR(60) NOT NULL,
    subject_id VARCHAR(160) NOT NULL,
    action VARCHAR(60) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(24) NOT NULL,
    requested_by VARCHAR(128) NOT NULL,
    requested_at DATETIME(6) NOT NULL,
    approved_by VARCHAR(128) NULL,
    approved_at DATETIME(6) NULL,
    executed_at DATETIME(6) NULL,
    request_id VARCHAR(128) NULL,
    trace_id VARCHAR(128) NULL,
    PRIMARY KEY (recovery_id),
    KEY idx_recovery_status (status, requested_at),
    KEY idx_recovery_subject (subject_type, subject_id)
) ENGINE=InnoDB;

-- The receipt for what a recovery or a compensation actually did. Immutable in practice: the service
-- inserts and never updates, and the columns carry the outcome rather than a mutable status.
CREATE TABLE IF NOT EXISTS workflow_receipt (
    receipt_id CHAR(36) NOT NULL,
    subject_type VARCHAR(60) NOT NULL,
    subject_id VARCHAR(160) NOT NULL,
    operation VARCHAR(60) NOT NULL,
    outcome VARCHAR(24) NOT NULL,
    detail_json JSON NULL,
    actor VARCHAR(128) NOT NULL,
    request_id VARCHAR(128) NULL,
    trace_id VARCHAR(128) NULL,
    occurred_at DATETIME(6) NOT NULL,
    PRIMARY KEY (receipt_id),
    KEY idx_receipt_subject (subject_type, subject_id, occurred_at)
) ENGINE=InnoDB;

-- Standard event-runtime outbox shape (P1R-M2-005 / ADR-0015), including the claim index and the
-- request/trace correlation columns the relay and the consumer both rely on.
CREATE TABLE IF NOT EXISTS workflow_outbox_event (
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
    request_id VARCHAR(128) NULL,
    trace_id VARCHAR(128) NULL,
    locked_by VARCHAR(128) NULL,
    locked_until DATETIME(6) NULL,
    published_at DATETIME(6) NULL,
    last_error_code VARCHAR(64) NULL,
    last_error_message VARCHAR(255) NULL,
    occurred_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_workflow_outbox_dedupe (dedupe_key),
    KEY idx_workflow_outbox_claim (status, available_at)
) ENGINE=InnoDB;

-- Dead letters this service has taken responsibility for, mirroring what the other owners record when a
-- consumer cannot process a record.
CREATE TABLE IF NOT EXISTS workflow_dead_letter (
    dead_letter_id CHAR(36) NOT NULL,
    topic VARCHAR(160) NOT NULL,
    partition_id INT NULL,
    offset_value BIGINT NULL,
    event_name VARCHAR(160) NULL,
    payload_json JSON NULL,
    failure_code VARCHAR(64) NOT NULL,
    failure_message VARCHAR(500) NULL,
    replay_count INT NOT NULL DEFAULT 0,
    received_at DATETIME(6) NOT NULL,
    last_replay_at DATETIME(6) NULL,
    PRIMARY KEY (dead_letter_id),
    UNIQUE KEY uk_workflow_dead_letter_source (topic, partition_id, offset_value)
) ENGINE=InnoDB;
