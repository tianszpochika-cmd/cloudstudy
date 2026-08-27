-- B25 Phase 1 synthetic fixture.
--
-- This seed is deterministic, credential-free and upsert-only. It is intended for the
-- repository compatibility schema created by V0023. In a deployed topology the same
-- facts are replayed by the owning service schema and service-only database account.
-- Redis rows below are rebuild recipes; MySQL owner rows remain the source of truth.

SET collation_connection = 'utf8mb4_unicode_ci';
SET @seed_run_id = 'seed-b25-phase1-v1';
SET @seed_version = 'b25-phase1-v1';
SET @seed_manifest_version = 'b25-phase1-v1';
SET @seed_created_at = '2026-01-01 00:00:00.000000';

START TRANSACTION;

INSERT INTO b25_fixture_run (
  fixture_run_id,
  seed_version,
  manifest_version,
  synthetic,
  status,
  source_hash,
  expected_counts_json,
  owner_digest,
  redis_rebuild_status,
  last_replayed_at,
  created_at
)
VALUES (
  @seed_run_id,
  @seed_version,
  @seed_manifest_version,
  1,
  'READY',
  SHA2(@seed_run_id, 256),
  JSON_OBJECT(
    'b25_fixture_run', 1,
    'b25_fixture_owner_binding', 22,
    'b25_fixture_row', 20,
    'b25_fixture_redis_projection', 3,
    'lrn_b25_profile', 1,
    'lrn_b25_goal', 1,
    'lrn_b25_preferences', 1,
    'lrn_b25_daily_task', 1,
    'cnt_b25_course', 1,
    'cnt_b25_unit', 1,
    'cnt_b25_vocabulary', 2,
    'cnt_b25_item', 1,
    'cnt_b25_answer_rule', 1,
    'lrn_b25_plan', 1,
    'lrn_b25_srs_state', 1,
    'asm_b25_session', 1,
    'asm_b25_report', 1,
    'med_b25_media_reference', 2,
    'com_b25_product', 1,
    'com_b25_entitlement', 1,
    'ntf_b25_preference', 1,
    'ntf_b25_message', 1
  ),
  SHA2(CONCAT(@seed_run_id, '|owners'), 256),
  'REBUILDABLE',
  @seed_created_at,
  @seed_created_at
)
ON DUPLICATE KEY UPDATE
  seed_version = VALUES(seed_version),
  manifest_version = VALUES(manifest_version),
  synthetic = VALUES(synthetic),
  status = VALUES(status),
  source_hash = VALUES(source_hash),
  expected_counts_json = VALUES(expected_counts_json),
  owner_digest = VALUES(owner_digest),
  redis_rebuild_status = VALUES(redis_rebuild_status),
  last_replayed_at = VALUES(last_replayed_at);

INSERT INTO b25_fixture_owner_binding (
  fixture_run_id,
  owner_service,
  logical_schema,
  source_table,
  migration_version,
  redis_namespace,
  write_authority,
  expected_row_count,
  expected_digest,
  created_at
)
VALUES
  (@seed_run_id, 'workflow-service', 'workflow_service', 'b25_fixture_run', 'V0023', 'workflow', 'workflow-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|workflow-service|b25_fixture_run|1'), 256), @seed_created_at),
  (@seed_run_id, 'workflow-service', 'workflow_service', 'b25_fixture_owner_binding', 'V0023', 'workflow', 'workflow-service-only', 22, SHA2(CONCAT(@seed_run_id, '|owners|workflow-service|b25_fixture_owner_binding|22'), 256), @seed_created_at),
  (@seed_run_id, 'workflow-service', 'workflow_service', 'b25_fixture_row', 'V0023', 'workflow', 'workflow-service-only', 20, SHA2(CONCAT(@seed_run_id, '|owners|workflow-service|b25_fixture_row|20'), 256), @seed_created_at),
  (@seed_run_id, 'workflow-service', 'workflow_service', 'b25_fixture_redis_projection', 'V0023', 'workflow', 'workflow-service-only', 3, SHA2(CONCAT(@seed_run_id, '|owners|workflow-service|b25_fixture_redis_projection|3'), 256), @seed_created_at),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_profile', 'V1', 'learner', 'learner-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|learner-service|lrn_b25_profile|1'), 256), @seed_created_at),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_goal', 'V1', 'learner', 'learner-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|learner-service|lrn_b25_goal|1'), 256), @seed_created_at),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_preferences', 'V1', 'learner', 'learner-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|learner-service|lrn_b25_preferences|1'), 256), @seed_created_at),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_daily_task', 'V1', 'learner', 'learner-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|learner-service|lrn_b25_daily_task|1'), 256), @seed_created_at),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_course', 'V1', 'content', 'content-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|content-service|cnt_b25_course|1'), 256), @seed_created_at),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_unit', 'V1', 'content', 'content-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|content-service|cnt_b25_unit|1'), 256), @seed_created_at),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_vocabulary', 'V1', 'content', 'content-service-only', 2, SHA2(CONCAT(@seed_run_id, '|owners|content-service|cnt_b25_vocabulary|2'), 256), @seed_created_at),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_item', 'V1', 'content', 'content-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|content-service|cnt_b25_item|1'), 256), @seed_created_at),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_answer_rule', 'V1', 'content', 'content-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|content-service|cnt_b25_answer_rule|1'), 256), @seed_created_at),
  (@seed_run_id, 'learning-service', 'learning_service', 'lrn_b25_plan', 'V1', 'learning', 'learning-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|learning-service|lrn_b25_plan|1'), 256), @seed_created_at),
  (@seed_run_id, 'learning-service', 'learning_service', 'lrn_b25_srs_state', 'V1', 'learning', 'learning-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|learning-service|lrn_b25_srs_state|1'), 256), @seed_created_at),
  (@seed_run_id, 'assessment-service', 'assessment_service', 'asm_b25_session', 'V1', 'assessment', 'assessment-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|assessment-service|asm_b25_session|1'), 256), @seed_created_at),
  (@seed_run_id, 'assessment-service', 'assessment_service', 'asm_b25_report', 'V1', 'assessment', 'assessment-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|assessment-service|asm_b25_report|1'), 256), @seed_created_at),
  (@seed_run_id, 'media-service', 'media_service', 'med_b25_media_reference', 'V1', 'media', 'media-service-only', 2, SHA2(CONCAT(@seed_run_id, '|owners|media-service|med_b25_media_reference|2'), 256), @seed_created_at),
  (@seed_run_id, 'commerce-service', 'commerce_service', 'com_b25_product', 'V1', 'commerce', 'commerce-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|commerce-service|com_b25_product|1'), 256), @seed_created_at),
  (@seed_run_id, 'commerce-service', 'commerce_service', 'com_b25_entitlement', 'V1', 'commerce', 'commerce-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|commerce-service|com_b25_entitlement|1'), 256), @seed_created_at),
  (@seed_run_id, 'notification-service', 'notification_service', 'ntf_b25_preference', 'V1', 'notification', 'notification-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|notification-service|ntf_b25_preference|1'), 256), @seed_created_at),
  (@seed_run_id, 'notification-service', 'notification_service', 'ntf_b25_message', 'V1', 'notification', 'notification-service-only', 1, SHA2(CONCAT(@seed_run_id, '|owners|notification-service|ntf_b25_message|1'), 256), @seed_created_at)
ON DUPLICATE KEY UPDATE
  logical_schema = VALUES(logical_schema),
  migration_version = VALUES(migration_version),
  redis_namespace = VALUES(redis_namespace),
  write_authority = VALUES(write_authority),
  expected_row_count = VALUES(expected_row_count),
  expected_digest = VALUES(expected_digest);

INSERT INTO lrn_b25_profile (
  principal_id, fixture_run_id, tenant_id, status, birth_year, age_confirmed,
  privacy_consent, terms_consent, ui_locale, content_locale, timezone, theme_mode,
  state_version, created_at, updated_at
)
VALUES (
  'fixture-principal-0001', @seed_run_id, 'platform', 'ACTIVE', 1995, 1,
  1, 1, 'zh-CN', 'en-US', 'Asia/Shanghai', 'SYSTEM', 1,
  @seed_created_at, @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), status = VALUES(status), state_version = VALUES(state_version),
  age_confirmed = VALUES(age_confirmed), privacy_consent = VALUES(privacy_consent), terms_consent = VALUES(terms_consent);

INSERT INTO lrn_b25_goal (
  principal_id, fixture_run_id, tenant_id, goal_code, target_level,
  daily_quota_minutes, status, idempotency_key, updated_at
)
VALUES (
  'fixture-principal-0001', @seed_run_id, 'platform', 'DAILY_ENGLISH_FOUNDATION', 'B1',
  15, 'ACTIVE', 'b25-goal-fixture-principal-0001', @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), goal_code = VALUES(goal_code), target_level = VALUES(target_level),
  daily_quota_minutes = VALUES(daily_quota_minutes), status = VALUES(status);

INSERT INTO lrn_b25_preferences (
  principal_id, fixture_run_id, tenant_id, ui_locale, content_locale, timezone,
  theme_mode, high_contrast, motion_mode, idempotency_key, updated_at
)
VALUES (
  'fixture-principal-0001', @seed_run_id, 'platform', 'zh-CN', 'en-US', 'Asia/Shanghai',
  'SYSTEM', 0, 'FULL', 'b25-preferences-fixture-principal-0001', @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), ui_locale = VALUES(ui_locale), content_locale = VALUES(content_locale),
  timezone = VALUES(timezone), theme_mode = VALUES(theme_mode), high_contrast = VALUES(high_contrast), motion_mode = VALUES(motion_mode);

INSERT INTO lrn_b25_daily_task (
  task_id, fixture_run_id, principal_id, tenant_id, content_code, title,
  task_type, minutes, task_status, task_order, idempotency_key, updated_at
)
VALUES (
  'daily-task-fixture-principal-0001-b25', @seed_run_id, 'fixture-principal-0001', 'platform',
  'B25-ENGLISH-FOUNDATION', 'fixture.learning.b25.unit01', 'LESSON', 15, 'AVAILABLE', 1,
  'b25-task-fixture-principal-0001', @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), content_code = VALUES(content_code), title = VALUES(title),
  task_status = VALUES(task_status), minutes = VALUES(minutes), task_order = VALUES(task_order);

INSERT INTO cnt_b25_course (
  content_code, fixture_run_id, tenant_id, content_type, title, summary, content_locale,
  target_level, content_version_id, availability, rights_status, definition_json, published_at, updated_at
)
VALUES (
  'B25-ENGLISH-FOUNDATION', @seed_run_id, 'platform', 'COURSE', 'English Foundations',
  'Synthetic Phase 1 foundation course', 'en-US', 'A2', 1, 'PUBLISHED', 'VALID',
  JSON_OBJECT('synthetic', TRUE, 'courseCode', 'B25-ENGLISH-FOUNDATION', 'unitCount', 1, 'licenseCode', 'LIC-B25-SYNTHETIC'),
  @seed_created_at, @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), title = VALUES(title), summary = VALUES(summary),
  availability = VALUES(availability), rights_status = VALUES(rights_status), content_version_id = VALUES(content_version_id),
  definition_json = VALUES(definition_json), published_at = VALUES(published_at);

INSERT INTO cnt_b25_unit (
  unit_id, fixture_run_id, course_code, unit_code, unit_order, title_key,
  content_version, availability, rights_status, published_at, row_digest
)
VALUES (
  'unit-b25-english-foundation-01', @seed_run_id, 'B25-ENGLISH-FOUNDATION', 'B25-UNIT-01', 1,
  'course.b25.unit01.title', 1, 'PUBLISHED', 'VALID', @seed_created_at,
  SHA2(CONCAT(@seed_run_id, '|content-service|UNIT|unit:B25-ENGLISH-FOUNDATION:01'), 256)
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), course_code = VALUES(course_code), unit_order = VALUES(unit_order),
  title_key = VALUES(title_key), availability = VALUES(availability), rights_status = VALUES(rights_status),
  published_at = VALUES(published_at), row_digest = VALUES(row_digest);

INSERT INTO cnt_b25_vocabulary (
  vocabulary_id, fixture_run_id, unit_code, word_normalized, meaning_key, cefr_level,
  content_version, availability, audio_ref, row_digest
)
VALUES
  ('vocab-b25-habit', @seed_run_id, 'B25-UNIT-01', 'habit', 'vocab.habit.meaning', 'A2', 1, 'PUBLISHED',
   'media:b25-habit-us', SHA2(CONCAT(@seed_run_id, '|content-service|VOCABULARY|vocab:habit'), 256)),
  ('vocab-b25-review', @seed_run_id, 'B25-UNIT-01', 'review', 'vocab.review.meaning', 'A2', 1, 'PUBLISHED',
   'media:b25-review-us', SHA2(CONCAT(@seed_run_id, '|content-service|VOCABULARY|vocab:review'), 256))
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), unit_code = VALUES(unit_code), meaning_key = VALUES(meaning_key),
  cefr_level = VALUES(cefr_level), availability = VALUES(availability), audio_ref = VALUES(audio_ref), row_digest = VALUES(row_digest);

INSERT INTO cnt_b25_item (
  item_id, fixture_run_id, content_code, tenant_id, item_type, display_order, prompt,
  options_json, answer_rule_json, media_ref
)
VALUES (
  'question-b25-unit-01-001', @seed_run_id, 'B25-ENGLISH-FOUNDATION', 'platform', 'CHOICE', 1,
  'question.b25.unit01.001.prompt', JSON_ARRAY('A', 'B', 'C'),
  JSON_OBJECT('ruleRef', 'rule:b25.choice.exact.v1', 'ruleVersion', 'v1'), 'media:b25-habit-us'
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), content_code = VALUES(content_code), item_type = VALUES(item_type),
  display_order = VALUES(display_order), prompt = VALUES(prompt), options_json = VALUES(options_json),
  answer_rule_json = VALUES(answer_rule_json), media_ref = VALUES(media_ref);

INSERT INTO cnt_b25_answer_rule (
  rule_id, fixture_run_id, rule_ref, rule_version, algorithm_code,
  rule_definition_json, rule_digest, status
)
VALUES (
  'answer-rule-b25-choice-exact-v1', @seed_run_id, 'rule:b25.choice.exact.v1', 'v1',
  'EXACT_NORMALIZED_OPTION', JSON_OBJECT('operator', 'EQUALS', 'expectedOption', 'B'),
  SHA2(CONCAT(@seed_run_id, '|content-service|ANSWER_RULE|rule:b25.choice.exact.v1'), 256), 'ACTIVE'
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), algorithm_code = VALUES(algorithm_code),
  rule_definition_json = VALUES(rule_definition_json), rule_digest = VALUES(rule_digest), status = VALUES(status);

INSERT INTO lrn_b25_plan (
  plan_id, fixture_run_id, principal_id, tenant_id, status, target_minutes, plan_version, updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000025', @seed_run_id, 'fixture-principal-0001', 'platform',
  'ACTIVE', 15, 1, @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), status = VALUES(status), target_minutes = VALUES(target_minutes),
  plan_version = VALUES(plan_version);

INSERT INTO lrn_b25_srs_state (
  principal_id, item_id, fixture_run_id, tenant_id, stage, due_at, interval_days,
  ease_factor, review_count, updated_at
)
VALUES (
  'fixture-principal-0001', 'question-b25-unit-01-001', @seed_run_id, 'platform', 'NEW',
  @seed_created_at, 0, 2.50, 0, @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), stage = VALUES(stage), due_at = VALUES(due_at),
  interval_days = VALUES(interval_days), ease_factor = VALUES(ease_factor), review_count = VALUES(review_count);

INSERT INTO asm_b25_session (
  session_id, fixture_run_id, principal_id, tenant_id, content_code, status,
  answers_json, score, report_id, idempotency_key, created_at, updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000026', @seed_run_id, 'fixture-principal-0001', 'platform',
  'B25-ENGLISH-FOUNDATION', 'COMPLETED', JSON_OBJECT('question-b25-unit-01-001', 'B'), 1.000,
  '00000000-0000-4000-8000-000000000027', 'b25-assessment-session-fixture-principal-0001', @seed_created_at, @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), status = VALUES(status), answers_json = VALUES(answers_json),
  score = VALUES(score), report_id = VALUES(report_id), updated_at = VALUES(updated_at);

INSERT INTO asm_b25_report (
  report_id, fixture_run_id, session_id, principal_id, tenant_id, cefr_level,
  score, radar_json, mistakes_json, report_version, created_at
)
VALUES (
  '00000000-0000-4000-8000-000000000027', @seed_run_id, '00000000-0000-4000-8000-000000000026',
  'fixture-principal-0001', 'platform', 'A2', 1.000,
  JSON_OBJECT('vocabulary', 1.000, 'grammar', 1.000), JSON_ARRAY(), 1, @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), score = VALUES(score), radar_json = VALUES(radar_json),
  mistakes_json = VALUES(mistakes_json), report_version = VALUES(report_version);

INSERT INTO med_b25_media_reference (
  media_id, fixture_run_id, content_item_ref, media_ref, media_kind, mime_type,
  resource_ref, checksum_sha256, rights_ref_hash, rights_status, asset_status,
  storage_provider, row_digest
)
VALUES
  ('media-b25-habit-us', @seed_run_id, 'vocab:habit', 'media:b25-habit-us', 'AUDIO', 'audio/mpeg',
   'fixture://b25/english-foundation/habit-us-v1.mp3',
   'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
   'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'AUTHORIZED', 'READY', 'LOCAL_FIXTURE',
   SHA2(CONCAT(@seed_run_id, '|media-service|MEDIA_REFERENCE|media:b25-habit-us'), 256)),
  ('media-b25-review-us', @seed_run_id, 'vocab:review', 'media:b25-review-us', 'AUDIO', 'audio/mpeg',
   'fixture://b25/english-foundation/review-us-v1.mp3',
   'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
   'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'AUTHORIZED', 'READY', 'LOCAL_FIXTURE',
   SHA2(CONCAT(@seed_run_id, '|media-service|MEDIA_REFERENCE|media:b25-review-us'), 256))
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), content_item_ref = VALUES(content_item_ref),
  resource_ref = VALUES(resource_ref), rights_status = VALUES(rights_status), asset_status = VALUES(asset_status),
  storage_provider = VALUES(storage_provider), row_digest = VALUES(row_digest);

INSERT INTO com_b25_product (
  product_id, fixture_run_id, sku_code, title_key, entitlement_code, billing_period,
  currency, amount_minor, publication_state, payment_state, row_digest
)
VALUES (
  'product-b25-english-foundation-dev', @seed_run_id, 'B25-ENGLISH-FOUNDATION-DEV',
  'product.b25.englishFoundation.title', 'COURSE_B25_ENGLISH_FOUNDATION', 'ONE_TIME',
  'CNY', 0, 'PUBLISHED', 'DISABLED',
  SHA2(CONCAT(@seed_run_id, '|commerce-service|PRODUCT|product:B25-ENGLISH-FOUNDATION-DEV'), 256)
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), title_key = VALUES(title_key), entitlement_code = VALUES(entitlement_code),
  publication_state = VALUES(publication_state), payment_state = VALUES(payment_state), row_digest = VALUES(row_digest);

INSERT INTO com_b25_entitlement (
  entitlement_id, fixture_run_id, subject_ref, sku_code, entitlement_code, source_type,
  source_ref, state, payment_state, starts_at, expires_at, row_digest
)
VALUES (
  'entitlement-b25-fixture-principal-0001', @seed_run_id, 'fixture-principal-0001',
  'B25-ENGLISH-FOUNDATION-DEV', 'COURSE_B25_ENGLISH_FOUNDATION', 'DEV_FIXTURE',
  'fixture-entitlement-b25-0001', 'ACTIVE', 'NOT_REQUIRED', '2026-01-01 00:00:00.000000',
  '2099-12-31 23:59:59.000000',
  SHA2(CONCAT(@seed_run_id, '|commerce-service|ENTITLEMENT|entitlement:fixture-principal-0001:B25-ENGLISH-FOUNDATION'), 256)
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), subject_ref = VALUES(subject_ref), sku_code = VALUES(sku_code),
  entitlement_code = VALUES(entitlement_code), state = VALUES(state), payment_state = VALUES(payment_state),
  starts_at = VALUES(starts_at), expires_at = VALUES(expires_at), row_digest = VALUES(row_digest);

INSERT INTO ntf_b25_preference (
  principal_id, fixture_run_id, tenant_id, in_app_enabled, learning_reminder_enabled,
  marketing_enabled, ui_locale, updated_at
)
VALUES (
  'fixture-principal-0001', @seed_run_id, 'platform', 1, 1, 0, 'zh-CN', @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), in_app_enabled = VALUES(in_app_enabled),
  learning_reminder_enabled = VALUES(learning_reminder_enabled), marketing_enabled = VALUES(marketing_enabled),
  ui_locale = VALUES(ui_locale);

INSERT INTO ntf_b25_message (
  message_id, fixture_run_id, principal_id, tenant_id, template_code, status, created_at
)
VALUES (
  '00000000-0000-4000-8000-000000000028', @seed_run_id, 'fixture-principal-0001', 'platform',
  'learning.fixture.welcome.v1', 'UNREAD', @seed_created_at
)
ON DUPLICATE KEY UPDATE
  fixture_run_id = VALUES(fixture_run_id), template_code = VALUES(template_code), status = VALUES(status),
  created_at = VALUES(created_at);

INSERT INTO b25_fixture_row (
  fixture_run_id, owner_service, logical_schema, source_table, entity_type, entity_key,
  canonical_payload_json, row_digest, source_of_truth
)
VALUES
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_course', 'COURSE', 'course:B25-ENGLISH-FOUNDATION', JSON_OBJECT('contentCode', 'B25-ENGLISH-FOUNDATION', 'availability', 'PUBLISHED', 'rightsStatus', 'VALID'), SHA2(CONCAT(@seed_run_id, '|content-service|COURSE|course:B25-ENGLISH-FOUNDATION'), 256), 'MYSQL'),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_unit', 'UNIT', 'unit:B25-ENGLISH-FOUNDATION:01', JSON_OBJECT('courseCode', 'B25-ENGLISH-FOUNDATION', 'unitCode', 'B25-UNIT-01', 'availability', 'PUBLISHED'), SHA2(CONCAT(@seed_run_id, '|content-service|UNIT|unit:B25-ENGLISH-FOUNDATION:01'), 256), 'MYSQL'),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_vocabulary', 'VOCABULARY', 'vocab:habit', JSON_OBJECT('wordNormalized', 'habit', 'unitCode', 'B25-UNIT-01', 'audioRef', 'media:b25-habit-us'), SHA2(CONCAT(@seed_run_id, '|content-service|VOCABULARY|vocab:habit'), 256), 'MYSQL'),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_vocabulary', 'VOCABULARY', 'vocab:review', JSON_OBJECT('wordNormalized', 'review', 'unitCode', 'B25-UNIT-01', 'audioRef', 'media:b25-review-us'), SHA2(CONCAT(@seed_run_id, '|content-service|VOCABULARY|vocab:review'), 256), 'MYSQL'),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_item', 'QUESTION', 'question:B25-UNIT-01-001', JSON_OBJECT('itemId', 'question-b25-unit-01-001', 'answerRuleRef', 'rule:b25.choice.exact.v1', 'mediaRef', 'media:b25-habit-us'), SHA2(CONCAT(@seed_run_id, '|content-service|QUESTION|question:B25-UNIT-01-001'), 256), 'MYSQL'),
  (@seed_run_id, 'content-service', 'content_service', 'cnt_b25_answer_rule', 'ANSWER_RULE', 'rule:b25.choice.exact.v1', JSON_OBJECT('ruleRef', 'rule:b25.choice.exact.v1', 'ruleVersion', 'v1', 'algorithmCode', 'EXACT_NORMALIZED_OPTION'), SHA2(CONCAT(@seed_run_id, '|content-service|ANSWER_RULE|rule:b25.choice.exact.v1'), 256), 'MYSQL'),
  (@seed_run_id, 'media-service', 'media_service', 'med_b25_media_reference', 'MEDIA_REFERENCE', 'media:b25-habit-us', JSON_OBJECT('contentItemRef', 'vocab:habit', 'resourceRef', 'fixture://b25/english-foundation/habit-us-v1.mp3', 'storageProvider', 'LOCAL_FIXTURE'), SHA2(CONCAT(@seed_run_id, '|media-service|MEDIA_REFERENCE|media:b25-habit-us'), 256), 'MYSQL'),
  (@seed_run_id, 'media-service', 'media_service', 'med_b25_media_reference', 'MEDIA_REFERENCE', 'media:b25-review-us', JSON_OBJECT('contentItemRef', 'vocab:review', 'resourceRef', 'fixture://b25/english-foundation/review-us-v1.mp3', 'storageProvider', 'LOCAL_FIXTURE'), SHA2(CONCAT(@seed_run_id, '|media-service|MEDIA_REFERENCE|media:b25-review-us'), 256), 'MYSQL'),
  (@seed_run_id, 'commerce-service', 'commerce_service', 'com_b25_product', 'PRODUCT', 'product:B25-ENGLISH-FOUNDATION-DEV', JSON_OBJECT('skuCode', 'B25-ENGLISH-FOUNDATION-DEV', 'publicationState', 'PUBLISHED', 'paymentState', 'DISABLED'), SHA2(CONCAT(@seed_run_id, '|commerce-service|PRODUCT|product:B25-ENGLISH-FOUNDATION-DEV'), 256), 'MYSQL'),
  (@seed_run_id, 'commerce-service', 'commerce_service', 'com_b25_entitlement', 'ENTITLEMENT', 'entitlement:fixture-principal-0001:B25-ENGLISH-FOUNDATION', JSON_OBJECT('subjectRef', 'fixture-principal-0001', 'skuCode', 'B25-ENGLISH-FOUNDATION-DEV', 'state', 'ACTIVE', 'paymentState', 'NOT_REQUIRED'), SHA2(CONCAT(@seed_run_id, '|commerce-service|ENTITLEMENT|entitlement:fixture-principal-0001:B25-ENGLISH-FOUNDATION'), 256), 'MYSQL'),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_profile', 'LEARNER_PROFILE', 'principal:fixture-principal-0001', JSON_OBJECT('principalId', 'fixture-principal-0001', 'status', 'ACTIVE', 'ageConfirmed', TRUE, 'uiLocale', 'zh-CN', 'contentLocale', 'en-US'), SHA2(CONCAT(@seed_run_id, '|learner-service|LEARNER_PROFILE|principal:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_goal', 'LEARNER_GOAL', 'goal:fixture-principal-0001', JSON_OBJECT('principalId', 'fixture-principal-0001', 'goalCode', 'DAILY_ENGLISH_FOUNDATION', 'targetLevel', 'B1', 'dailyQuotaMinutes', 15), SHA2(CONCAT(@seed_run_id, '|learner-service|LEARNER_GOAL|goal:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_preferences', 'LEARNER_PREFERENCE', 'preference:fixture-principal-0001', JSON_OBJECT('principalId', 'fixture-principal-0001', 'uiLocale', 'zh-CN', 'contentLocale', 'en-US', 'themeMode', 'SYSTEM'), SHA2(CONCAT(@seed_run_id, '|learner-service|LEARNER_PREFERENCE|preference:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'learner-service', 'learner_service', 'lrn_b25_daily_task', 'DAILY_TASK', 'daily-task:fixture-principal-0001:B25-ENGLISH-FOUNDATION', JSON_OBJECT('principalId', 'fixture-principal-0001', 'contentCode', 'B25-ENGLISH-FOUNDATION', 'taskStatus', 'AVAILABLE', 'minutes', 15), SHA2(CONCAT(@seed_run_id, '|learner-service|DAILY_TASK|daily-task:fixture-principal-0001:B25-ENGLISH-FOUNDATION'), 256), 'MYSQL'),
  (@seed_run_id, 'learning-service', 'learning_service', 'lrn_b25_plan', 'LEARNING_PLAN', 'plan:fixture-principal-0001', JSON_OBJECT('planId', '00000000-0000-4000-8000-000000000025', 'principalId', 'fixture-principal-0001', 'status', 'ACTIVE'), SHA2(CONCAT(@seed_run_id, '|learning-service|LEARNING_PLAN|plan:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'learning-service', 'learning_service', 'lrn_b25_srs_state', 'SRS_STATE', 'srs:fixture-principal-0001:question-b25-unit-01-001', JSON_OBJECT('principalId', 'fixture-principal-0001', 'itemId', 'question-b25-unit-01-001', 'stage', 'NEW', 'reviewCount', 0), SHA2(CONCAT(@seed_run_id, '|learning-service|SRS_STATE|srs:fixture-principal-0001:question-b25-unit-01-001'), 256), 'MYSQL'),
  (@seed_run_id, 'assessment-service', 'assessment_service', 'asm_b25_session', 'ASSESSMENT_SESSION', 'assessment-session:fixture-principal-0001', JSON_OBJECT('sessionId', '00000000-0000-4000-8000-000000000026', 'principalId', 'fixture-principal-0001', 'status', 'COMPLETED', 'score', 1), SHA2(CONCAT(@seed_run_id, '|assessment-service|ASSESSMENT_SESSION|assessment-session:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'assessment-service', 'assessment_service', 'asm_b25_report', 'ASSESSMENT_REPORT', 'assessment-report:fixture-principal-0001', JSON_OBJECT('reportId', '00000000-0000-4000-8000-000000000027', 'principalId', 'fixture-principal-0001', 'cefrLevel', 'A2', 'score', 1), SHA2(CONCAT(@seed_run_id, '|assessment-service|ASSESSMENT_REPORT|assessment-report:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'notification-service', 'notification_service', 'ntf_b25_preference', 'NOTIFICATION_PREFERENCE', 'notification-preference:fixture-principal-0001', JSON_OBJECT('principalId', 'fixture-principal-0001', 'inAppEnabled', TRUE, 'learningReminderEnabled', TRUE, 'marketingEnabled', FALSE), SHA2(CONCAT(@seed_run_id, '|notification-service|NOTIFICATION_PREFERENCE|notification-preference:fixture-principal-0001'), 256), 'MYSQL'),
  (@seed_run_id, 'notification-service', 'notification_service', 'ntf_b25_message', 'NOTIFICATION_MESSAGE', 'notification-message:fixture-principal-0001:welcome', JSON_OBJECT('messageId', '00000000-0000-4000-8000-000000000028', 'principalId', 'fixture-principal-0001', 'templateCode', 'learning.fixture.welcome.v1', 'status', 'UNREAD'), SHA2(CONCAT(@seed_run_id, '|notification-service|NOTIFICATION_MESSAGE|notification-message:fixture-principal-0001:welcome'), 256), 'MYSQL')
ON DUPLICATE KEY UPDATE
  logical_schema = VALUES(logical_schema), source_table = VALUES(source_table),
  canonical_payload_json = VALUES(canonical_payload_json), row_digest = VALUES(row_digest), source_of_truth = VALUES(source_of_truth);

INSERT INTO b25_fixture_redis_projection (
  fixture_run_id, owner_service, redis_namespace, key_template, source_table,
  source_entity_key, ttl_seconds, rebuild_version, rebuild_strategy, projection_state
)
VALUES
  (@seed_run_id, 'content-service', 'content', 'content:catalog:{contentEpoch}', 'cnt_b25_course', 'course:B25-ENGLISH-FOUNDATION', 300, 'b25-v1', 'MYSQL_OWNER_ROWS', 'REBUILDABLE'),
  (@seed_run_id, 'commerce-service', 'commerce', 'commerce:catalog:{contentEpoch}', 'com_b25_product', 'product:B25-ENGLISH-FOUNDATION-DEV', 300, 'b25-v1', 'MYSQL_OWNER_ROWS', 'REBUILDABLE'),
  (@seed_run_id, 'notification-service', 'notification', 'notification:preference:{principalId}', 'ntf_b25_preference', 'notification-preference:fixture-principal-0001', 900, 'b25-v1', 'MYSQL_OWNER_ROWS', 'REBUILDABLE')
ON DUPLICATE KEY UPDATE
  owner_service = VALUES(owner_service), source_table = VALUES(source_table), source_entity_key = VALUES(source_entity_key),
  ttl_seconds = VALUES(ttl_seconds), rebuild_version = VALUES(rebuild_version), rebuild_strategy = VALUES(rebuild_strategy),
  projection_state = VALUES(projection_state);

SELECT COUNT(*) INTO @actual_b25_fixture_run FROM b25_fixture_run WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_b25_fixture_owner_binding FROM b25_fixture_owner_binding WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_b25_fixture_row FROM b25_fixture_row WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_b25_fixture_redis_projection FROM b25_fixture_redis_projection WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_lrn_b25_profile FROM lrn_b25_profile WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_lrn_b25_goal FROM lrn_b25_goal WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_lrn_b25_preferences FROM lrn_b25_preferences WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_lrn_b25_daily_task FROM lrn_b25_daily_task WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_cnt_b25_course FROM cnt_b25_course WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_cnt_b25_unit FROM cnt_b25_unit WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_cnt_b25_vocabulary FROM cnt_b25_vocabulary WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_cnt_b25_item FROM cnt_b25_item WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_cnt_b25_answer_rule FROM cnt_b25_answer_rule WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_lrn_b25_plan FROM lrn_b25_plan WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_lrn_b25_srs_state FROM lrn_b25_srs_state WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_asm_b25_session FROM asm_b25_session WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_asm_b25_report FROM asm_b25_report WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_med_b25_media_reference FROM med_b25_media_reference WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_com_b25_product FROM com_b25_product WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_com_b25_entitlement FROM com_b25_entitlement WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_ntf_b25_preference FROM ntf_b25_preference WHERE fixture_run_id = @seed_run_id;
SELECT COUNT(*) INTO @actual_ntf_b25_message FROM ntf_b25_message WHERE fixture_run_id = @seed_run_id;

UPDATE b25_fixture_run
SET actual_counts_json = JSON_OBJECT(
      'b25_fixture_run', @actual_b25_fixture_run,
      'b25_fixture_owner_binding', @actual_b25_fixture_owner_binding,
      'b25_fixture_row', @actual_b25_fixture_row,
      'b25_fixture_redis_projection', @actual_b25_fixture_redis_projection,
      'lrn_b25_profile', @actual_lrn_b25_profile,
      'lrn_b25_goal', @actual_lrn_b25_goal,
      'lrn_b25_preferences', @actual_lrn_b25_preferences,
      'lrn_b25_daily_task', @actual_lrn_b25_daily_task,
      'cnt_b25_course', @actual_cnt_b25_course,
      'cnt_b25_unit', @actual_cnt_b25_unit,
      'cnt_b25_vocabulary', @actual_cnt_b25_vocabulary,
      'cnt_b25_item', @actual_cnt_b25_item,
      'cnt_b25_answer_rule', @actual_cnt_b25_answer_rule,
      'lrn_b25_plan', @actual_lrn_b25_plan,
      'lrn_b25_srs_state', @actual_lrn_b25_srs_state,
      'asm_b25_session', @actual_asm_b25_session,
      'asm_b25_report', @actual_asm_b25_report,
      'med_b25_media_reference', @actual_med_b25_media_reference,
      'com_b25_product', @actual_com_b25_product,
      'com_b25_entitlement', @actual_com_b25_entitlement,
      'ntf_b25_preference', @actual_ntf_b25_preference,
      'ntf_b25_message', @actual_ntf_b25_message
    ),
    redis_rebuild_status = 'REBUILDABLE',
    last_replayed_at = @seed_created_at
WHERE fixture_run_id = @seed_run_id;

COMMIT;
