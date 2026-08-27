-- Development-only fixture for the independent service schemas.
-- Run service Flyway migrations first, then run this file with a database account that owns the
-- five local schemas. CREATE DATABASE is additive and this script contains no destructive SQL.

CREATE DATABASE IF NOT EXISTS learner_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS content_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS learning_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS assessment_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS notification_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE learner_service;
INSERT INTO b25_learner_profile (principal_id, tenant_id, status, birth_year, age_confirmed, privacy_consent, terms_consent, ui_locale, content_locale, timezone, theme_mode, state_version)
VALUES ('fixture-principal-b25', 'platform', 'ACTIVE', 1990, 1, 1, 1, 'zh-CN', 'en-US', 'Asia/Shanghai', 'SYSTEM', 1)
ON DUPLICATE KEY UPDATE status = 'ACTIVE';
INSERT INTO b25_learner_goal (principal_id, tenant_id, goal_code, target_level, daily_quota_minutes, status, idempotency_key)
VALUES ('fixture-principal-b25', 'platform', 'ZERO_BASIS', 'A1', 15, 'ACTIVE', 'seed-b25-goal-001')
ON DUPLICATE KEY UPDATE goal_code = VALUES(goal_code), target_level = VALUES(target_level), daily_quota_minutes = VALUES(daily_quota_minutes);
INSERT INTO b25_learner_preferences (principal_id, tenant_id, ui_locale, content_locale, timezone, theme_mode, high_contrast, motion_mode, idempotency_key)
VALUES ('fixture-principal-b25', 'platform', 'zh-CN', 'en-US', 'Asia/Shanghai', 'SYSTEM', 0, 'FULL', 'seed-b25-preferences-001')
ON DUPLICATE KEY UPDATE theme_mode = VALUES(theme_mode), content_locale = VALUES(content_locale);
INSERT INTO b25_learner_daily_task (task_id, principal_id, tenant_id, content_code, title, task_type, minutes, task_status, task_order, idempotency_key)
VALUES ('b25-task-fixture-001', 'fixture-principal-b25', 'platform', 'course-b25-basics', 'English foundations', 'LESSON', 15, 'AVAILABLE', 1, 'seed-b25-task-001')
ON DUPLICATE KEY UPDATE task_status = 'AVAILABLE';

USE content_service;
INSERT INTO b25_content_course (content_code, tenant_id, content_type, title, summary, content_locale, target_level, content_version_id, availability, rights_status, definition_json, published_at)
VALUES ('course-b25-basics', 'platform', 'COURSE', 'English Foundations', 'Synthetic Phase 1 learning course', 'en-US', 'A1', 25001, 'PUBLISHED', 'VALID', JSON_OBJECT('synthetic', TRUE, 'seedRunId', 'seed-b25-phase1-v1'), CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE availability = 'PUBLISHED', rights_status = 'VALID';
INSERT INTO b25_content_item (item_id, content_code, tenant_id, item_type, display_order, prompt, options_json, answer_rule_json, media_ref)
VALUES ('b25-item-001', 'course-b25-basics', 'platform', 'VOCABULARY', 1, 'Choose the greeting.', JSON_ARRAY(JSON_OBJECT('key','A','text','Hello'), JSON_OBJECT('key','B','text','Goodbye')), JSON_OBJECT('acceptedKeys', JSON_ARRAY('A')), 'fixture/core-foundation/audio-placeholder-v1'),
       ('b25-item-002', 'course-b25-basics', 'platform', 'ASSESSMENT', 2, 'Choose the correct answer.', JSON_ARRAY(JSON_OBJECT('key','A','text','Yes'), JSON_OBJECT('key','B','text','No')), JSON_OBJECT('acceptedKeys', JSON_ARRAY('A')), 'fixture/core-foundation/audio-placeholder-v1')
ON DUPLICATE KEY UPDATE prompt = VALUES(prompt), options_json = VALUES(options_json), answer_rule_json = VALUES(answer_rule_json);

USE learning_service;
INSERT INTO b25_learning_plan (plan_id, principal_id, tenant_id, status, target_minutes, plan_version)
VALUES ('00000000-0000-4000-8000-000000002501', 'fixture-principal-b25', 'platform', 'ACTIVE', 15, 1)
ON DUPLICATE KEY UPDATE status = 'ACTIVE', target_minutes = 15;
INSERT INTO b25_learning_srs_state (principal_id, item_id, tenant_id, stage, due_at, interval_days, ease_factor, review_count)
VALUES ('fixture-principal-b25', 'b25-item-001', 'platform', 'NEW', CURRENT_TIMESTAMP(6), 0, 2.50, 0)
ON DUPLICATE KEY UPDATE stage = 'NEW', due_at = CURRENT_TIMESTAMP(6);

USE assessment_service;
INSERT INTO b25_assessment_item_rule (item_id, content_code, content_version_id, prompt, options_json, dimension, difficulty, answer_rule_json, active)
VALUES ('b25-item-001', 'course-b25-basics', 25001, 'Choose the greeting.', JSON_ARRAY(JSON_OBJECT('key','A','text','Hello'), JSON_OBJECT('key','B','text','Goodbye')), 'VOCABULARY', 1, JSON_OBJECT('acceptedKeys', JSON_ARRAY('A')), TRUE),
       ('b25-item-002', 'course-b25-basics', 25001, 'Choose the correct answer.', JSON_ARRAY(JSON_OBJECT('key','A','text','Yes'), JSON_OBJECT('key','B','text','No')), 'GRAMMAR', 2, JSON_OBJECT('acceptedKeys', JSON_ARRAY('A')), TRUE)
ON DUPLICATE KEY UPDATE prompt = VALUES(prompt), options_json = VALUES(options_json), answer_rule_json = VALUES(answer_rule_json), active = TRUE;

USE notification_service;
INSERT INTO b25_notification_preference (principal_id, tenant_id, in_app_enabled, learning_reminder_enabled, marketing_enabled, ui_locale)
VALUES ('fixture-principal-b25', 'platform', 1, 1, 0, 'zh-CN')
ON DUPLICATE KEY UPDATE in_app_enabled = 1, learning_reminder_enabled = 1, marketing_enabled = 0;
INSERT INTO b25_notification_message (message_id, principal_id, tenant_id, template_code, status)
VALUES ('00000000-0000-4000-8000-000000002502', 'fixture-principal-b25', 'platform', 'B25_WELCOME', 'UNREAD')
ON DUPLICATE KEY UPDATE status = 'UNREAD';
