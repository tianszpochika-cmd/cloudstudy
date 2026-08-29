-- Freeze learning-service plan quotas at the Phase 1 choices: 5, 15, 30, or 45.
-- V2 is already published; any retired 60-minute rows are migrated before the
-- stricter checks are installed.
UPDATE b25_learning_plan
   SET target_minutes = 45
 WHERE target_minutes = 60;

ALTER TABLE b25_learning_plan
    ADD CONSTRAINT chk_b25_learning_plan_target_minutes
        CHECK (target_minutes IN (5, 15, 30, 45));

UPDATE learning_runtime_plan
   SET daily_quota_minutes = 45
 WHERE daily_quota_minutes = 60;

ALTER TABLE learning_runtime_plan
    ADD CONSTRAINT chk_learning_runtime_plan_daily_quota_minutes
        CHECK (daily_quota_minutes IN (5, 15, 30, 45));
