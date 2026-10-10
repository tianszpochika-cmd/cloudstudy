-- R1-024 records retest as its own idempotent command.
-- A retest inserts a new session. It does not update the completed report or its answers.
ALTER TABLE p1_placement_idempotency
    DROP CHECK chk_p1_placement_idempotency_operation,
    ADD CONSTRAINT chk_p1_placement_idempotency_operation
        CHECK (operation IN ('CREATE', 'RESPONSE', 'SKIP', 'RETEST'));
