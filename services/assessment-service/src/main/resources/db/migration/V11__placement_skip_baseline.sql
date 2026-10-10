-- R1-023: a user skip is session status SKIPPED, not an assessed report.
-- baseline_json holds the explicit USER_SKIP source. It is not a report body.
ALTER TABLE p1_placement_session
    DROP CHECK chk_p1_placement_session_status,
    ADD CONSTRAINT chk_p1_placement_session_status
        CHECK (status IN ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    ADD COLUMN baseline_json JSON NULL;
