-- B3 gray cohort label on scheduled publish tasks. B3 records the label on the
-- task and its execution receipt; learner-side cohort enforcement arrives in B4.
ALTER TABLE scheduled_publish_task
    ADD COLUMN cohort VARCHAR(64) NULL AFTER reason_code;
