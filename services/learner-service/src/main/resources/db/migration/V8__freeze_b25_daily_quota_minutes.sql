-- Freeze the Phase 1 daily quota choices at 5, 15, 30, or 45 minutes.
-- V4 is already published and must not be edited. Existing rows that used its
-- retired 60-minute choice are explicitly mapped to the nearest frozen upper
-- bucket (45) before the stricter check is installed.
UPDATE b25_learner_goal
   SET daily_quota_minutes = 45
 WHERE daily_quota_minutes = 60;

ALTER TABLE b25_learner_goal
    DROP CHECK chk_b25_learner_goal_minutes,
    ADD CONSTRAINT chk_b25_learner_goal_minutes CHECK (daily_quota_minutes IN (5, 15, 30, 45));
