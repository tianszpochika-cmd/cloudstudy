CREATE TABLE IF NOT EXISTS learner_first_day_projection (
    profile_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(63) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    today_new_items INT NOT NULL DEFAULT 0,
    due_review_items INT NOT NULL DEFAULT 0,
    weak_items INT NOT NULL DEFAULT 0,
    completion_percent SMALLINT NOT NULL DEFAULT 0,
    next_action VARCHAR(128) NOT NULL,
    resume_target VARCHAR(256) NULL,
    profile_version BIGINT NOT NULL,
    generated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (profile_id),
    UNIQUE KEY uk_learner_first_day_scope (tenant_id, owner_id)
);

ALTER TABLE learner_goal
    ADD COLUMN target_id BIGINT NULL AFTER owner_id;
