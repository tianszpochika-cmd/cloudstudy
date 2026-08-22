-- Learner-service owns this schema. The database/schema name is injected by deployment config.
-- No table below is shared with IAM, core-api, learning-service or content-service.

CREATE TABLE IF NOT EXISTS learner_profile (
    profile_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(63) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    onboarding_state VARCHAR(32) NOT NULL,
    assessment_state VARCHAR(32) NOT NULL,
    current_level VARCHAR(8) NULL,
    resume_target VARCHAR(256) NULL,
    profile_version BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (profile_id),
    UNIQUE KEY uk_learner_profile_scope (tenant_id, owner_id)
);

CREATE TABLE IF NOT EXISTS learner_goal (
    profile_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(63) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    goal_type VARCHAR(32) NOT NULL,
    daily_study_minutes SMALLINT NOT NULL,
    target_date DATE NULL,
    starting_level VARCHAR(8) NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (profile_id),
    UNIQUE KEY uk_learner_goal_scope (tenant_id, owner_id)
);

CREATE TABLE IF NOT EXISTS learner_preference (
    profile_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(63) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    ui_locale VARCHAR(16) NOT NULL,
    content_locale VARCHAR(16) NOT NULL,
    theme_mode VARCHAR(32) NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    reduced_motion BOOLEAN NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (profile_id),
    UNIQUE KEY uk_learner_preference_scope (tenant_id, owner_id)
);

CREATE TABLE IF NOT EXISTS learner_idempotency_record (
    idempotency_key VARCHAR(256) NOT NULL,
    tenant_id VARCHAR(63) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    operation VARCHAR(64) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    response_snapshot JSON NOT NULL,
    recorded_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (idempotency_key),
    UNIQUE KEY uk_learner_idempotency_scope (tenant_id, owner_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS learner_outbox_event (
    event_id CHAR(36) NOT NULL,
    tenant_id VARCHAR(63) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    dedupe_key VARCHAR(256) NOT NULL,
    payload JSON NOT NULL,
    request_id VARCHAR(128) NULL,
    trace_id VARCHAR(128) NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    published_at TIMESTAMP(6) NULL,
    PRIMARY KEY (event_id),
    UNIQUE KEY uk_learner_outbox_dedupe (dedupe_key)
);
