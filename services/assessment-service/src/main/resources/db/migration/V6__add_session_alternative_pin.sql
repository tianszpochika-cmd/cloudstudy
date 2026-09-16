-- P1R decision 7B: assessment assembles the session pin. The session keeps the
-- requested pin in content_code/content_version_id; when it is unavailable the
-- fulfilled substitute lands in alternative_* so grading/reporting follow what
-- was actually used without inventing content.
ALTER TABLE b10_assessment_session
    ADD COLUMN alternative_content_version_id BIGINT UNSIGNED NULL AFTER content_version_id,
    ADD COLUMN alternative_content_code VARCHAR(128) NULL AFTER alternative_content_version_id,
    ADD COLUMN alternative_reason_code VARCHAR(64) NULL AFTER alternative_content_code;
