-- Align the repository-level compatibility projections with the frozen Phase 1
-- daily quota choices. V0017/V0023 are published and remain immutable.
UPDATE lrn_b9_goal
   SET daily_quota_minutes = 45
 WHERE daily_quota_minutes = 60;

ALTER TABLE lrn_b9_goal
    DROP CHECK chk_lrn_b9_goal_minutes,
    ADD CONSTRAINT chk_lrn_b9_goal_minutes CHECK (daily_quota_minutes IN (5, 15, 30, 45));

UPDATE lrn_b25_goal
   SET daily_quota_minutes = 45
 WHERE daily_quota_minutes = 60;

ALTER TABLE lrn_b25_goal
    DROP CHECK chk_lrn_b25_goal_minutes,
    ADD CONSTRAINT chk_lrn_b25_goal_minutes CHECK (daily_quota_minutes IN (5, 15, 30, 45));

UPDATE lrn_b25_plan
   SET target_minutes = 45
 WHERE target_minutes = 60;

ALTER TABLE lrn_b25_plan
    ADD CONSTRAINT chk_lrn_b25_plan_target_minutes CHECK (target_minutes IN (5, 15, 30, 45));
