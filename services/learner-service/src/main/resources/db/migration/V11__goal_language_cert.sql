-- TENANT-B4-03 goal convergence: exam fields for LANGUAGE_CERT goals plus a
-- database leg for the contract + Java enum change.
--
-- Pre-B4 goal rows keep working: fields_json is nullable (reads as empty) and
-- the goal_type CHECK admits every historical value plus LANGUAGE_CERT.
ALTER TABLE learner_goal
    ADD COLUMN fields_json JSON NULL,
    ADD CONSTRAINT chk_learner_goal_type CHECK (goal_type IN (
        'FOUNDATION', 'CET_4_6', 'POSTGRADUATE', 'WORKPLACE', 'LANGUAGE_CERT'));
