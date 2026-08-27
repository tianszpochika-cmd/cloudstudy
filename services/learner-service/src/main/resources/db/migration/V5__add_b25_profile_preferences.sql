-- B25 learner-owned account preferences used by the learner-web settings page.
-- These fields stay in learner-service; IAM remains the owner of identity/session facts.

ALTER TABLE b25_learner_profile
    ADD COLUMN nickname VARCHAR(96) NOT NULL DEFAULT '学习者' AFTER status,
    ADD COLUMN accent_pref VARCHAR(8) NOT NULL DEFAULT 'US' AFTER nickname;

ALTER TABLE b25_learner_profile
    ADD CONSTRAINT chk_b25_learner_profile_accent CHECK (accent_pref IN ('US', 'UK'));
