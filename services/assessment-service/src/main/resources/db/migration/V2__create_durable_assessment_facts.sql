CREATE TABLE IF NOT EXISTS assessment_session (
    session_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    session_type VARCHAR(32) NOT NULL,
    session_status VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deadline_at DATETIME(6) NULL,
    started_at DATETIME(6) NULL,
    closed_at DATETIME(6) NULL,
    PRIMARY KEY (session_id),
    KEY idx_assessment_session_owner (tenant_id, subject_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_session_exercise (
    session_id CHAR(36) NOT NULL,
    exercise_id BIGINT NOT NULL,
    position_no INT NOT NULL,
    source_bucket VARCHAR(32) NOT NULL,
    verification_stage VARCHAR(64) NULL,
    snapshot_json JSON NOT NULL,
    PRIMARY KEY (session_id, exercise_id),
    UNIQUE KEY uk_assessment_exercise_position (session_id, position_no),
    KEY idx_assessment_exercise_id (exercise_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_attempt_fact (
    attempt_id CHAR(36) NOT NULL,
    session_id CHAR(36) NOT NULL,
    exercise_id BIGINT NOT NULL,
    submission_id BIGINT NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    client_submission_id VARCHAR(128) NOT NULL,
    revision INT NOT NULL,
    answer_hash CHAR(64) NOT NULL,
    submitted_at DATETIME(6) NOT NULL,
    PRIMARY KEY (attempt_id),
    UNIQUE KEY uk_assessment_attempt_client (session_id, client_submission_id),
    UNIQUE KEY uk_assessment_attempt_revision (session_id, exercise_id, revision),
    KEY idx_assessment_attempt_owner (tenant_id, subject_id, submitted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_answer (
    attempt_id CHAR(36) NOT NULL,
    answer_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (attempt_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_score_fact (
    attempt_id CHAR(36) NOT NULL,
    scoring_status VARCHAR(32) NOT NULL,
    earned_score DECIMAL(12, 4) NOT NULL,
    max_score DECIMAL(12, 4) NOT NULL,
    correct BOOLEAN NULL,
    error_causes_json JSON NOT NULL,
    rule_version VARCHAR(128) NOT NULL,
    score_breakdown_json JSON NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (attempt_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_checkpoint_fact (
    checkpoint_id CHAR(36) NOT NULL,
    session_id CHAR(36) NOT NULL,
    checkpoint_seq BIGINT NOT NULL,
    current_exercise_id BIGINT NULL,
    client_state_hash CHAR(64) NOT NULL,
    monotonic_elapsed_ms BIGINT NOT NULL,
    saved_at DATETIME(6) NOT NULL,
    PRIMARY KEY (checkpoint_id),
    UNIQUE KEY uk_assessment_checkpoint_session_seq (session_id, checkpoint_seq)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_report (
    report_id BIGINT NOT NULL,
    session_id CHAR(36) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    report_type VARCHAR(64) NOT NULL,
    report_status VARCHAR(32) NOT NULL,
    score DECIMAL(12, 4) NOT NULL,
    max_score DECIMAL(12, 4) NOT NULL,
    completed_count INT NOT NULL,
    total_count INT NOT NULL,
    calculation_version VARCHAR(128) NOT NULL,
    score_policy_version VARCHAR(128) NOT NULL,
    generated_at DATETIME(6) NOT NULL,
    metrics_json JSON NOT NULL,
    evidence_json JSON NOT NULL,
    mistakes_json JSON NOT NULL,
    PRIMARY KEY (report_id),
    UNIQUE KEY uk_assessment_report_session (session_id),
    KEY idx_assessment_report_owner (tenant_id, subject_id, generated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_mistake (
    mistake_id BIGINT NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    item_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    error_category VARCHAR(128) NOT NULL,
    rule_version VARCHAR(128) NOT NULL,
    answer_hash CHAR(64) NOT NULL,
    wrong_count INT NOT NULL,
    mistake_status VARCHAR(32) NOT NULL,
    mastery_status VARCHAR(32) NOT NULL,
    first_error_at DATETIME(6) NOT NULL,
    last_error_at DATETIME(6) NOT NULL,
    next_action_at DATETIME(6) NOT NULL,
    reason_trace_json JSON NOT NULL,
    PRIMARY KEY (mistake_id),
    UNIQUE KEY uk_assessment_mistake_owner_item_category (tenant_id, subject_id, item_id, error_category),
    KEY idx_assessment_mistake_due (tenant_id, subject_id, next_action_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_idempotency (
    tenant_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    operation VARCHAR(256) NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    request_digest CHAR(64) NOT NULL,
    response_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, subject_id, operation, idempotency_key)
) ENGINE=InnoDB;
