-- Durable target ids and idempotency/outbox keys are learner-service facts.
-- Legacy goal rows may have no target id yet; the JDBC adapter preserves that as null/0 and
-- refuses to invent a legacy identity. New target writes allocate a positive sequence value.

ALTER TABLE learner_goal
    ADD UNIQUE KEY uk_learner_goal_target_id (target_id);

ALTER TABLE learner_idempotency_record
    MODIFY COLUMN idempotency_key VARCHAR(512) NOT NULL;

ALTER TABLE learner_outbox_event
    MODIFY COLUMN dedupe_key VARCHAR(512) NOT NULL;

CREATE TABLE IF NOT EXISTS learner_target_sequence (
    sequence_name VARCHAR(64) NOT NULL,
    next_value BIGINT NOT NULL,
    PRIMARY KEY (sequence_name)
);

INSERT INTO learner_target_sequence (sequence_name, next_value)
VALUES ('learner-target', 1001)
ON DUPLICATE KEY UPDATE sequence_name = VALUES(sequence_name);
