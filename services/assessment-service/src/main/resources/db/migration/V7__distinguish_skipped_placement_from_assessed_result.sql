-- The B25 compatibility path previously stored a user's chosen starting level as
-- an assessed CEFR level and a zero score. Keep the hint, but remove the false
-- measured facts from skipped rows. Canonical P1 placement uses separate tables.

ALTER TABLE b25_assessment_report
    MODIFY COLUMN cefr_level VARCHAR(8) NULL,
    MODIFY COLUMN score DECIMAL(6,3) NULL,
    ADD COLUMN result_kind VARCHAR(16) NOT NULL DEFAULT 'ASSESSED',
    ADD COLUMN requested_starting_level VARCHAR(8) NULL;

UPDATE b25_assessment_report r
JOIN b25_assessment_session s
  ON s.session_id = r.session_id
 AND s.principal_id = r.principal_id
 AND s.tenant_id = r.tenant_id
   SET r.requested_starting_level = r.cefr_level,
       r.cefr_level = NULL,
       r.score = NULL,
       r.result_kind = 'SKIPPED'
 WHERE s.status = 'SKIPPED';

UPDATE b25_assessment_session SET score = NULL WHERE status = 'SKIPPED';

ALTER TABLE b25_assessment_report
    ADD CONSTRAINT chk_b25_assessment_report_kind
        CHECK (result_kind IN ('ASSESSED', 'SKIPPED')),
    ADD CONSTRAINT chk_b25_assessment_report_requested_level
        CHECK (requested_starting_level IS NULL OR requested_starting_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
