-- V12: placement content pin on the learner target + weekly study days preference.
-- The pin (target -> content) is written by learner-service itself through the
-- internal targets/pin owner endpoint after learning-service verifies the
-- placement report ("定级完成自动 pin 定级内容"). NULL means unpinned: plans
-- stay honestly NOT_READY until the first placement completes. Re-pin on a new
-- placement overwrites (last verified pin wins, audited via updated_at).
-- weekly_study_days is owner-stored user preference (JSON array of 1-7);
-- NULL means "no preference stated" and reads back the documented daily
-- default; the planning input always carries the effective (stored or
-- defaulted) value.
ALTER TABLE learner_goal
    ADD COLUMN pinned_content_version_id BIGINT NULL,
    ADD COLUMN pinned_content_epoch BIGINT NULL,
    ADD COLUMN pinned_at TIMESTAMP(6) NULL;
ALTER TABLE learner_preference
    ADD COLUMN weekly_study_days JSON NULL;
