import { runMysql } from './lib/mysql-client.mjs';

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '13306';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const args = [
  '--protocol=TCP', '--host', host, '--port', String(port), '--user', 'root',
  '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'
];

const localTestSubject = (process.env.LOCAL_TEST_SUBJECT ?? '').trim();
if (!localTestSubject || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(localTestSubject)) {
  throw new Error('LOCAL_TEST_SUBJECT must identify one synthetic local account');
}
if (host !== '127.0.0.1' || String(port) !== '13306') {
  throw new Error('local learning-world fixture requires MySQL on 127.0.0.1:13306');
}
const eligiblePrincipal = `FROM iam_service.iam_principal p
  JOIN iam_service.iam_account a ON a.principal_id = p.principal_id
 WHERE p.principal_id = '${localTestSubject}' AND p.tenant_id = 'platform'
   AND p.status = 'ACTIVE' AND a.status = 'ACTIVE'
   AND a.identifier LIKE '%@local.invalid'`;
const eligibleCount = Number(runMysql({
  mysqlBin, mysqlArgs: args, password, cwd: process.cwd(),
  input: `SELECT COUNT(*) ${eligiblePrincipal};\n`,
}));
if (eligibleCount !== 1) {
  throw new Error('LOCAL_TEST_SUBJECT must be an active @local.invalid fixture account');
}
const scopedPrincipalTable = `USE iam_service;
CREATE TEMPORARY TABLE local_fixture_principal AS
SELECT p.principal_id, p.tenant_id, p.status ${eligiblePrincipal};`;
if (process.argv.includes('--scope-check')) {
  const scopedCount = Number(runMysql({
    mysqlBin, mysqlArgs: args, password, cwd: process.cwd(),
    input: `${scopedPrincipalTable}\nSELECT COUNT(*) FROM local_fixture_principal;\n`,
  }));
  if (scopedCount !== 1) {
    throw new Error('local fixture principal scope must contain exactly one account');
  }
  console.log('local learning-world fixture scope verified: one synthetic account; no seed writes');
  process.exit(0);
}

// This fixture is intentionally written into each service's own schema. The
// runtime services never perform the cross-schema SELECT used here to select
// the one explicitly named local fixture principal.
const sql = `
SET NAMES utf8mb4;

-- Learner-owned onboarding reference data.  Keeping this in the same local
-- fixture makes the onboarding screen testable without a core-api fallback.
INSERT INTO learner_service.b25_onboarding_option
  (option_type, option_code, label, description, numeric_value, display_order, enabled)
VALUES
  ('LANGUAGE', 'ENGLISH', '英语', 'Phase 1 英语学习目标语言', NULL, 1, TRUE),
  ('GOAL', 'ZERO_BASIS', '成人零基础', '从发音、核心词和短句开始建立基础。', NULL, 1, TRUE),
  ('GOAL', 'CET_4_6', '四六级备考', '围绕词汇、听力与真题节奏推进。', NULL, 2, TRUE),
  ('GOAL', 'POSTGRADUATE', '考研英语', '强化长难句、阅读和高频表达。', NULL, 3, TRUE),
  ('GOAL', 'WORKPLACE_DAILY', '职场与日常', '优先处理会话、场景和邮件表达。', NULL, 4, TRUE),
  ('EXAM', 'NONE', '不参加考试', '按通用英语学习闭环推进。', NULL, 1, TRUE),
  ('EXAM', 'CET4', '大学英语四级', NULL, NULL, 2, TRUE),
  ('EXAM', 'CET6', '大学英语六级', NULL, NULL, 3, TRUE),
  ('EXAM', 'POSTGRADUATE', '考研英语', NULL, NULL, 4, TRUE),
  ('EXAM', 'IELTS', '雅思', NULL, NULL, 5, TRUE),
  ('EXAM', 'TOEFL', '托福', NULL, NULL, 6, TRUE),
  ('QUOTA', '5', '5 分钟', '低负担起步', 5, 1, TRUE),
  ('QUOTA', '15', '15 分钟', '稳定日常节奏', 15, 2, TRUE),
  ('QUOTA', '30', '30 分钟', '完整学习闭环', 30, 3, TRUE),
  ('QUOTA', '45', '45 分钟', '强化学习节奏', 45, 4, TRUE),
  ('ACCENT', 'US', '美式', '优先美式发音资源', NULL, 1, TRUE),
  ('ACCENT', 'UK', '英式', '优先英式发音资源', NULL, 2, TRUE),
  ('ACCENT', 'NEUTRAL', '中性', '按内容默认音频', NULL, 3, TRUE)
ON DUPLICATE KEY UPDATE
  label = VALUES(label), description = VALUES(description), numeric_value = VALUES(numeric_value),
  display_order = VALUES(display_order), enabled = VALUES(enabled);

-- Core learner, learning and assessment reads are scoped to the selected
-- synthetic principal. These rows belong to the corresponding owner schemas.
INSERT INTO learner_service.b25_learner_profile
  (principal_id, tenant_id, status, nickname, accent_pref, birth_year, age_confirmed,
   privacy_consent, terms_consent, ui_locale, content_locale, timezone, theme_mode, state_version)
SELECT principal_id, 'platform', 'ACTIVE', '本地学习者', 'US', 1995, TRUE, TRUE, TRUE,
  'zh-CN', 'en-US', 'Asia/Shanghai', 'SYSTEM', 1
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  status = VALUES(status), age_confirmed = VALUES(age_confirmed),
  privacy_consent = VALUES(privacy_consent), terms_consent = VALUES(terms_consent),
  ui_locale = VALUES(ui_locale), content_locale = VALUES(content_locale),
  timezone = VALUES(timezone), theme_mode = VALUES(theme_mode);

INSERT INTO learner_service.b25_learner_goal
  (principal_id, tenant_id, goal_code, target_level, daily_quota_minutes, status, idempotency_key)
SELECT principal_id, 'platform', 'DAILY_ENGLISH_FOUNDATION', 'A1', 15, 'ACTIVE',
  CONCAT('seed-goal-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  goal_code = VALUES(goal_code), target_level = VALUES(target_level),
  daily_quota_minutes = VALUES(daily_quota_minutes), status = VALUES(status);

INSERT INTO learner_service.b25_learner_preferences
  (principal_id, tenant_id, ui_locale, content_locale, timezone, theme_mode,
   high_contrast, motion_mode, idempotency_key)
SELECT principal_id, 'platform', 'zh-CN', 'en-US', 'Asia/Shanghai', 'SYSTEM', FALSE, 'FULL',
  CONCAT('seed-preferences-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  ui_locale = VALUES(ui_locale), content_locale = VALUES(content_locale),
  timezone = VALUES(timezone), theme_mode = VALUES(theme_mode),
  high_contrast = VALUES(high_contrast), motion_mode = VALUES(motion_mode);

INSERT INTO learner_service.b25_learner_daily_task
  (task_id, principal_id, tenant_id, content_code, title, task_type, minutes,
   task_status, task_order, idempotency_key)
SELECT LEFT(SHA2(CONCAT('seed-task-', principal_id), 256), 36), principal_id, 'platform',
  'course-b25-basics', 'English Foundations · 今日学习', 'LESSON', 15, 'AVAILABLE', 1,
  CONCAT('seed-task-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  title = VALUES(title), minutes = VALUES(minutes),
  task_status = IF(task_status = 'COMPLETED', 'COMPLETED', 'AVAILABLE'),
  task_order = VALUES(task_order);

INSERT INTO learning_service.b25_learning_plan
  (plan_id, principal_id, tenant_id, status, target_minutes, plan_version)
SELECT LEFT(SHA2(CONCAT('seed-plan-', principal_id), 256), 36), principal_id, 'platform',
  'ACTIVE', 15, 1
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  status = VALUES(status), target_minutes = VALUES(target_minutes), plan_version = VALUES(plan_version);

INSERT IGNORE INTO learning_service.b25_learning_srs_state
  (principal_id, item_id, tenant_id, stage, due_at, interval_days, ease_factor, review_count)
SELECT principal_id, 'b25-item-001', 'platform', 'NEW', UTC_TIMESTAMP(6), 0, 2.50, 0
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE';

-- The library is a learner-owned collection fact, separate from the published
-- vocabulary body in content-service.
INSERT INTO learning_service.b25_learning_library_entry
  (principal_id, tenant_id, item_type, item_id, source_type, collection_status, idempotency_key)
SELECT principal_id, 'platform', 'VOCAB', 'b25-item-001', 'DAILY_TASK', 'SAVED',
  CONCAT('seed-library-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE collection_status = VALUES(collection_status),
  source_type = VALUES(source_type), updated_at = CURRENT_TIMESTAMP(6);

-- Seed one durable SRS review fact so daily/weekly reports and the review
-- queue have a real owner row before the browser submits its first mutation.
INSERT INTO learning_service.b25_learning_review
  (review_id, principal_id, tenant_id, item_id, quality, idempotency_key)
SELECT LEFT(SHA2(CONCAT('seed-review-', principal_id), 256), 36), principal_id,
  'platform', 'b25-item-001', 4, CONCAT('seed-review-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE quality = VALUES(quality), item_id = VALUES(item_id);

-- B2 learner-owned mined expression.  The sentence is real persisted learner
-- data; the content source remains a reference and is not copied as a domain
-- write into content-service.
INSERT INTO learning_service.b2_learner_expression
  (tenant_id, principal_id, source_type, source_ref, source_content_version,
   sentence_text, translation_cn, selected_text, range_start, range_end,
   want_to_say, private_note, tag_ids_json, status, create_idempotency_key,
   last_idempotency_key)
SELECT 'platform', principal_id, 'READING', 'course-b25-basics', '25001',
  'It takes time to build a habit.', '养成一个习惯需要时间。', 'build a habit', 18, 30,
  TRUE, '本地真实数据 fixture：用于表达复习联调。', JSON_ARRAY(), 'ACTIVE',
  CONCAT('seed-expression-', principal_id), CONCAT('seed-expression-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  sentence_text = VALUES(sentence_text), translation_cn = VALUES(translation_cn),
  selected_text = VALUES(selected_text), want_to_say = VALUES(want_to_say),
  private_note = VALUES(private_note), status = VALUES(status),
  last_idempotency_key = VALUES(last_idempotency_key);

INSERT INTO learning_service.b25_learning_continue_context
  (tenant_id, principal_id, module_id, module_label, lesson_id, lesson_title,
   step_index, total_steps, elapsed_time_ms, status, last_idempotency_key)
SELECT 'platform', principal_id, 'course-b25-basics', 'English Foundations',
  'unit-b25-foundations', 'Welcome and daily habits', 1, 3, 0, 'ACTIVE',
  CONCAT('seed-continue-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  module_label = VALUES(module_label), lesson_title = VALUES(lesson_title),
  step_index = VALUES(step_index), total_steps = VALUES(total_steps),
  status = VALUES(status), last_idempotency_key = VALUES(last_idempotency_key);

INSERT IGNORE INTO assessment_service.b25_assessment_session
  (session_id, principal_id, tenant_id, content_code, status, answers_json, score,
   report_id, idempotency_key)
SELECT LEFT(SHA2(CONCAT('seed-assessment-session-', principal_id), 256), 36), principal_id,
  'platform', 'course-b25-basics', 'COMPLETED', JSON_OBJECT('b25-item-001', 'A'), 1.000,
  LEFT(SHA2(CONCAT('seed-assessment-report-', principal_id), 256), 36),
  CONCAT('seed-assessment-', principal_id)
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE';

INSERT IGNORE INTO assessment_service.b25_assessment_report
  (report_id, session_id, principal_id, tenant_id, cefr_level, score, radar_json, mistakes_json)
SELECT LEFT(SHA2(CONCAT('seed-assessment-report-', principal_id), 256), 36),
  LEFT(SHA2(CONCAT('seed-assessment-session-', principal_id), 256), 36), principal_id,
  'platform', 'A1', 1.000,
  JSON_OBJECT('vocabulary', 1.000, 'grammar', 0.800), JSON_ARRAY()
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE';

-- Seed a small, replay-safe interaction trail for the local browser journey.
-- These are learner-owned facts in learning-service, not content or assessment
-- answers; the browser can append new rows and verify the owner write-back.
INSERT INTO learning_service.b3_learning_interaction
  (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key,
   idempotency_key, payload_json, result_json, status)
SELECT UUID(), 'platform', principal_id, 'GRAMMAR', 'ATTEMPT', '3701',
  CONCAT('seed-b3-grammar-mistake-', principal_id),
  JSON_OBJECT('exerciseId', 3701, 'answer', 'have', 'fixture', 'LOCAL_FIXTURE'),
  JSON_OBJECT('correct', FALSE, 'score', 0, 'grammarPointId', 3103, 'feedbackCode', 'RULE_RETRY',
    'reviewSignal', 'REVIEW_GRAMMAR_POINT', 'source', 'mysql', 'fixture', 'LOCAL_FIXTURE'),
  'ACCEPTED'
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  payload_json = VALUES(payload_json), result_json = VALUES(result_json), status = VALUES(status);

INSERT IGNORE INTO learning_service.b3_learning_interaction
  (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key,
   idempotency_key, payload_json, result_json, status)
SELECT UUID(), 'platform', principal_id, 'WRITING', 'SUBMISSION', '3301',
  CONCAT('seed-b3-writing-history-', principal_id),
  JSON_OBJECT('promptId', 3301, 'answer', 'Good habits help long-term progress.', 'fixture', 'LOCAL_FIXTURE'),
  JSON_OBJECT('correct', TRUE, 'score', 80, 'band', 'FOUNDATION',
    'feedbackCode', 'RULE_PASS', 'source', 'mysql', 'fixture', 'LOCAL_FIXTURE'),
  'ACCEPTED'
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE';

INSERT IGNORE INTO learning_service.b3_learning_interaction
  (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key,
   idempotency_key, payload_json, result_json, status)
SELECT UUID(), 'platform', principal_id, 'OFFLINE', 'CHANGE', 'local-fixture-change-001',
  CONCAT('seed-b3-offline-change-', principal_id),
  JSON_OBJECT('changeId', 'local-fixture-change-001', 'entityType', 'READING_PROGRESS',
    'entityVersion', 1, 'fixture', 'LOCAL_FIXTURE'),
  JSON_OBJECT('changeId', 'local-fixture-change-001', 'status', 'ACCEPTED', 'source', 'mysql',
    'fixture', 'LOCAL_FIXTURE'),
  'ACCEPTED'
FROM iam_service.iam_principal
WHERE tenant_id = 'platform' AND status = 'ACTIVE';

-- Media remains metadata-only, but the local listening journey needs a durable
-- owner row and rendition so the media-service manifest/signed-url reads are
-- backed by the media schema rather than a fail-closed placeholder.
INSERT INTO media_service.media_asset
  (asset_id, tenant_id, owner_subject, content_version_id, asset_version, checksum_sha256,
   size_bytes, rights_status, asset_status, created_at, updated_at, asset_key, kind, mime_type,
   storage_provider, bucket_name, object_key, object_version, supports_range, chunk_size_bytes,
   part_count, transcoding_status, content_role, segment_id, rights_id, license_code,
   permitted_channels, rights_starts_at, rights_expires_at, allow_offline, authorization_evidence_ref)
VALUES
  ('b3-audio-3401', 'platform', 'local-fixture', 301, 1,
   '03bdffca899373ff48458ba2c658718abf3e83544a9989e873e05cb990e230b9', 16044, 'ACTIVE', 'ACTIVE',
   UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'fixture/b3/audio-3401', 'AUDIO', 'audio/wav',
   'LOCAL_OBJECT_STORE', 'yuxuexing-local', 'b3-audio-3401', 'local-fixture-v1',
   FALSE, 0, 0, 'NOT_REQUIRED', 'LEARNING_AUDIO', 'seg-1', 'B3_AUDIO_RIGHTS',
   'LOCAL_FIXTURE_AUDIO', 'STREAM,DOWNLOAD,OFFLINE', UTC_TIMESTAMP(6),
   DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 365 DAY), TRUE, 'local-real-learning-fixture')
ON DUPLICATE KEY UPDATE
  checksum_sha256 = VALUES(checksum_sha256), size_bytes = VALUES(size_bytes),
  rights_status = VALUES(rights_status), asset_status = VALUES(asset_status),
  updated_at = VALUES(updated_at), mime_type = VALUES(mime_type), object_key = VALUES(object_key),
  object_version = VALUES(object_version), storage_provider = VALUES(storage_provider),
  rights_expires_at = VALUES(rights_expires_at);

INSERT INTO media_service.media_rendition
  (rendition_id, asset_id, rendition_key, rendition_version, rendition_status, object_reference,
   created_at, mime_type, checksum_sha256, size_bytes, supports_range, failure_code, object_version)
VALUES
  ('b3-audio-3401:LOW', 'b3-audio-3401', 'LOW', 1, 'READY', 'b3-audio-3401',
   UTC_TIMESTAMP(6), 'audio/wav',
   '03bdffca899373ff48458ba2c658718abf3e83544a9989e873e05cb990e230b9', 16044, FALSE, NULL, 'local-fixture-v1')
ON DUPLICATE KEY UPDATE
  rendition_status = VALUES(rendition_status), object_reference = VALUES(object_reference),
  mime_type = VALUES(mime_type), checksum_sha256 = VALUES(checksum_sha256),
  size_bytes = VALUES(size_bytes), failure_code = VALUES(failure_code),
  object_version = VALUES(object_version);

-- The official site consumes published platform facets from the content
-- service's read projection. Pricing remains commerce-owned. The local
-- runtime announcement and unapproved compliance notices are never publicly
-- published. Web remains unavailable until an approved public HTTPS URL exists.
INSERT INTO content_service.content_public_site_facet
  (facet_id, ui_locale, facet_type, status, payload_json, projection_version, published_at, expires_at)
VALUES
  ('download-learner-web', 'zh-CN', 'DOWNLOAD', 'PUBLISHED',
   JSON_OBJECT('platform', 'WEB', 'channel', '学习 Web', 'status', 'UNAVAILABLE'),
   1, UTC_TIMESTAMP(6), NULL),
  ('download-mobile-app', 'zh-CN', 'DOWNLOAD', 'PUBLISHED',
   JSON_OBJECT('platform', 'IOS', 'channel', '移动 App（iOS / Android / iPad）', 'status', 'COMING_SOON'),
   1, UTC_TIMESTAMP(6), NULL),
  ('download-wechat-mini-program', 'zh-CN', 'DOWNLOAD', 'PUBLISHED',
   JSON_OBJECT('platform', 'WECHAT_MINI_PROGRAM', 'channel', '微信小程序（条件编译目标）', 'status', 'COMING_SOON'),
   1, UTC_TIMESTAMP(6), NULL),
  ('announcement-local-phase1-runtime', 'zh-CN', 'ANNOUNCEMENT', 'UNPUBLISHED',
   JSON_OBJECT('announcementCode', 'announcement-local-phase1-runtime', 'title', '本地 Phase 1 真实运行态已就绪',
     'summary', '学习端、内容、评测、成长、社群和商业服务使用本地数据库进行联调。',
     'publishedAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z'), 'href', '/announcements'),
   1, UTC_TIMESTAMP(6), NULL),
  ('compliance-privacy-data', 'zh-CN', 'COMPLIANCE', 'UNPUBLISHED',
   JSON_OBJECT('noticeCode', 'compliance-privacy-data', 'title', '隐私与数据处理', 'version', '公开说明',
     'body', '官网仅展示公开信息，不收集登录后学习数据，不在公开页面提交密码、Token、录音或支付凭证。',
     'effectiveAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z')),
   1, UTC_TIMESTAMP(6), NULL),
  ('compliance-adult-phase-boundary', 'zh-CN', 'COMPLIANCE', 'UNPUBLISHED',
   JSON_OBJECT('noticeCode', 'compliance-adult-phase-boundary', 'title', '成人阶段边界', 'version', 'Phase 1',
     'body', '当前产品面向成年用户与大学生；K12、儿童账号、监护绑定及未成年人支付能力在专项合规 Gate 前不会开放。',
     'effectiveAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z')),
   1, UTC_TIMESTAMP(6), NULL),
  ('download-learner-web', 'en-US', 'DOWNLOAD', 'PUBLISHED',
   JSON_OBJECT('platform', 'WEB', 'channel', 'Learner Web', 'status', 'UNAVAILABLE'),
   1, UTC_TIMESTAMP(6), NULL),
  ('download-mobile-app', 'en-US', 'DOWNLOAD', 'PUBLISHED',
   JSON_OBJECT('platform', 'IOS', 'channel', 'Mobile app (iOS / Android / iPad)', 'status', 'COMING_SOON'),
   1, UTC_TIMESTAMP(6), NULL),
  ('download-wechat-mini-program', 'en-US', 'DOWNLOAD', 'PUBLISHED',
   JSON_OBJECT('platform', 'WECHAT_MINI_PROGRAM', 'channel', 'WeChat mini program (conditional target)', 'status', 'COMING_SOON'),
   1, UTC_TIMESTAMP(6), NULL),
  ('announcement-local-phase1-runtime', 'en-US', 'ANNOUNCEMENT', 'UNPUBLISHED',
   JSON_OBJECT('announcementCode', 'announcement-local-phase1-runtime', 'title', 'Local Phase 1 runtime is ready',
     'summary', 'The learning, content, assessment, growth, social and commerce services are connected to local database fixtures for integration testing.',
     'publishedAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z'), 'href', '/announcements'),
   1, UTC_TIMESTAMP(6), NULL),
  ('compliance-privacy-data', 'en-US', 'COMPLIANCE', 'UNPUBLISHED',
   JSON_OBJECT('noticeCode', 'compliance-privacy-data', 'title', 'Privacy and data processing', 'version', 'Public notice',
     'body', 'The official site exposes public information only. It does not submit learning data, passwords, tokens, recordings or payment credentials.',
     'effectiveAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z')),
   1, UTC_TIMESTAMP(6), NULL),
  ('compliance-adult-phase-boundary', 'en-US', 'COMPLIANCE', 'UNPUBLISHED',
   JSON_OBJECT('noticeCode', 'compliance-adult-phase-boundary', 'title', 'Adult Phase 1 boundary', 'version', 'Phase 1',
     'body', 'The current product targets adults and university students. K12, child accounts, guardian binding and minor payments remain closed until a dedicated compliance gate passes.',
     'effectiveAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z')),
   1, UTC_TIMESTAMP(6), NULL)
ON DUPLICATE KEY UPDATE
  status = VALUES(status), payload_json = VALUES(payload_json),
  projection_version = VALUES(projection_version), published_at = VALUES(published_at),
  expires_at = VALUES(expires_at);

-- Canonical B10 learner item and its private server-side grading rule. The
-- public content projection exposes only the prompt/options; assessment owns
-- the answer rule and scores submissions inside its own schema.
INSERT INTO content_service.b25_content_item
  (item_id, content_code, tenant_id, item_type, display_order, prompt,
   options_json, answer_rule_json, media_ref)
VALUES
  ('b25-item-001', 'course-b25-basics', 'platform', 'VOCABULARY', 1,
   'Choose the greeting.',
   JSON_ARRAY(JSON_OBJECT('key', 'A', 'text', 'Hello'), JSON_OBJECT('key', 'B', 'text', 'Goodbye')),
   JSON_OBJECT('answer', 'A'), NULL)
ON DUPLICATE KEY UPDATE
  prompt = VALUES(prompt), options_json = VALUES(options_json),
  media_ref = VALUES(media_ref);

INSERT INTO assessment_service.b25_assessment_item_rule
  (item_id, content_code, content_version_id, prompt, options_json,
   dimension, difficulty, answer_rule_json, active)
VALUES
  ('b25-item-001', 'course-b25-basics', 25001, 'Choose the greeting.',
   JSON_ARRAY(JSON_OBJECT('key', 'A', 'text', 'Hello'), JSON_OBJECT('key', 'B', 'text', 'Goodbye')),
   'VOCABULARY', 1, JSON_OBJECT('acceptedKeys', JSON_ARRAY('A')), TRUE)
ON DUPLICATE KEY UPDATE
  prompt = VALUES(prompt), options_json = VALUES(options_json),
  dimension = VALUES(dimension), difficulty = VALUES(difficulty),
  answer_rule_json = VALUES(answer_rule_json), active = VALUES(active);

-- Commerce owns its own catalog and entitlement facts.  The local fixture is
-- intentionally free so the browser can exercise catalog/order reads without
-- enabling a real payment provider in Phase 1.
INSERT INTO commerce_service.commerce_sku
  (tenant_id, sku_id, version, title, entitlement_code, currency, amount_minor,
   status, effective_from, created_at)
VALUES
  ('platform', 'phase1-foundations', 1, 'Phase 1 Foundations',
   'LEARNER_PHASE1', 'CNY', 9900, 'ACTIVE', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  title = VALUES(title), entitlement_code = VALUES(entitlement_code),
  currency = VALUES(currency), amount_minor = VALUES(amount_minor), status = VALUES(status);

INSERT INTO commerce_service.commerce_price_snapshot
  (tenant_id, sku_id, sku_version, title, entitlement_code, currency, amount_minor, captured_at)
VALUES
  ('platform', 'phase1-foundations', 1, 'Phase 1 Foundations',
   'LEARNER_PHASE1', 'CNY', 9900, UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  title = VALUES(title), entitlement_code = VALUES(entitlement_code),
  currency = VALUES(currency), amount_minor = VALUES(amount_minor), captured_at = VALUES(captured_at);

INSERT INTO commerce_service.commerce_entitlement
  (tenant_id, entitlement_id, subject_id, sku_id, sku_version, sku_title,
   entitlement_code, source_type, source_ref, currency, amount_minor, status,
   active_from, expires_at, reason_code)
SELECT 'platform', LEFT(SHA2(CONCAT('seed-entitlement-', principal_id), 256), 36),
  principal_id, 'phase1-foundations', 1, 'Phase 1 Foundations',
  'LEARNER_PHASE1', 'LOCAL_FIXTURE', 'local-real-learning-fixture',
  'CNY', 9900, 'ACTIVE', UTC_TIMESTAMP(6), NULL, 'LOCAL_TEST_FIXTURE'
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE
  status = VALUES(status), active_from = VALUES(active_from),
  expires_at = VALUES(expires_at), reason_code = VALUES(reason_code);

INSERT INTO gamification_service.gamification_user_timezone(subject_id, time_zone, updated_at)
SELECT principal_id, 'Asia/Shanghai', UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE time_zone = VALUES(time_zone), updated_at = VALUES(updated_at);

INSERT IGNORE INTO gamification_service.xp_ledger
  (ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at)
SELECT LEFT(SHA2(CONCAT('seed-xp-', principal_id), 256), 36), principal_id, 'platform',
  LEFT(SHA2(CONCAT('seed-event-', principal_id), 256), 36), 45, 45, UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE';

INSERT IGNORE INTO gamification_service.coin_ledger
  (ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at)
SELECT LEFT(SHA2(CONCAT('seed-coin-', principal_id), 256), 36), principal_id, 'platform',
  LEFT(SHA2(CONCAT('seed-event-', principal_id), 256), 36), 3, 3, UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE';

INSERT IGNORE INTO gamification_service.gamification_active_date(subject_id, active_date, created_at)
SELECT principal_id, CURRENT_DATE(), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE';
INSERT IGNORE INTO gamification_service.gamification_active_date(subject_id, active_date, created_at)
SELECT principal_id, DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE';

INSERT IGNORE INTO gamification_service.gamification_season_fact
  (season_id, event_id, subject_id, points, rule_version, occurred_at, recorded_at)
SELECT CONCAT('SEASON-', DATE_FORMAT(CURRENT_DATE(), '%Y-%m')), CONCAT('seed-season-', principal_id), principal_id, 24,
  'GAMIFICATION_RULES_2026_08_20_01', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE';

INSERT INTO gamification_service.reward_grant
  (grant_id, subject_id, tenant_id, reward_key, probability_version, claim_status, idempotency_key, created_at, source_event_id, outcome_code, claimed_at)
SELECT LEFT(SHA2(CONCAT('seed-grant-', principal_id), 256), 36), principal_id, 'platform', 'LEARNING_REWARD_BOX', 'GAM_REWARD_PROB_2026_08_20_01', 'GRANTED',
  CONCAT('grant:seed-grant-', principal_id), UTC_TIMESTAMP(6), LEFT(SHA2(CONCAT('seed-event-', principal_id), 256), 36), NULL, NULL
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE reward_key = VALUES(reward_key), claim_status = VALUES(claim_status), source_event_id = VALUES(source_event_id);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'quests', 1, JSON_OBJECT('items', JSON_ARRAY(
  JSON_OBJECT('questId','daily-practice','period','DAILY','title','完成一次今日练习','target',1,'progress',1,'completed',true,'claimed',false,'xpReward',15,'coinReward',1),
  JSON_OBJECT('questId','daily-vocabulary','period','DAILY','title','复习十个词汇','target',10,'progress',6,'completed',false,'claimed',false,'xpReward',20,'coinReward',2))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'achievements', 1, JSON_OBJECT('items', JSON_ARRAY(
  JSON_OBJECT('achievementCode','FIRST_REVIEW','title','第一次复习','unlocked',true),
  JSON_OBJECT('achievementCode','SEVEN_DAY_STREAK','title','连续七天','unlocked',false)), 'showcase','FIRST_REVIEW'), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'collection', 1, JSON_OBJECT('items', JSON_ARRAY(JSON_OBJECT('itemCode','ITEM_STARTER','quality','COMMON','owned',true))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'catalog', 1, JSON_OBJECT('items', JSON_ARRAY(JSON_OBJECT('catalogItemId','ITEM_FOCUS_AURA','title','专注光环','priceCoins',20,'available',true))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'season-rewards', 1, JSON_OBJECT('items', JSON_ARRAY(
  JSON_OBJECT('tier',1,'requiredPoints',0,'rewardCode','ITEM_STARTER'), JSON_OBJECT('tier',2,'requiredPoints',100,'rewardCode','ITEM_FOCUS_AURA'))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'avatar-profile', 1, JSON_OBJECT('profile', JSON_OBJECT('avatarId','learner-01','resourceVersion','avatar-2026.08.1','loadoutId','starter-loadout','renderMode','2D_FALLBACK')), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'avatar-items', 1, JSON_OBJECT('items', JSON_ARRAY(
  JSON_OBJECT('itemCode','ITEM_STARTER','quality','COMMON','slot','HEAD','resourceVersion','avatar-2026.08.1','owned',true),
  JSON_OBJECT('itemCode','ITEM_FOCUS_AURA','quality','RARE','slot','AURA','resourceVersion','avatar-2026.08.1','owned',false))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'avatar-loadouts', 1, JSON_OBJECT('items', JSON_ARRAY(JSON_OBJECT('loadoutId','starter-loadout','name','晨间学习','equipped',true,'items',JSON_ARRAY('ITEM_STARTER')))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'avatar-resources', 1, JSON_OBJECT('resourceVersion','avatar-2026.08.1','manifestHash','local-real-avatar-manifest','fallbackMode','2D_FALLBACK','performanceTiers',JSON_ARRAY('Ultra','High','Medium','Performance')), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'study-space', 1, JSON_OBJECT('spaceId','study-space-default','themeCode','CALM_BLUE','version',1,'items',JSON_ARRAY('DESK_STARTER','LAMP_WARM')), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO gamification_service.gamification_feature_state(subject_id, feature_key, version, state_json, updated_at)
SELECT principal_id, 'game-catalog', 1, JSON_OBJECT('items', JSON_ARRAY(
  JSON_OBJECT('gameCode','SENTENCE_TRAIN','maxMinutes',10,'pauseLimitMinutes',2,'passAccuracyPercent',60,'passCompletionPercent',60),
  JSON_OBJECT('gameCode','WORD_MATCH','maxMinutes',10,'pauseLimitMinutes',2,'passAccuracyPercent',60,'passCompletionPercent',60),
  JSON_OBJECT('gameCode','WORD_DEFENSE','maxMinutes',10,'pauseLimitMinutes',2,'passAccuracyPercent',60,'passCompletionPercent',60),
  JSON_OBJECT('gameCode','WORD_PUZZLE','maxMinutes',10,'pauseLimitMinutes',2,'passAccuracyPercent',60,'passCompletionPercent',60),
  JSON_OBJECT('gameCode','GRAMMAR_BLASTER','maxMinutes',10,'pauseLimitMinutes',2,'passAccuracyPercent',60,'passCompletionPercent',60),
  JSON_OBJECT('gameCode','CATCH_MEANING','maxMinutes',10,'pauseLimitMinutes',2,'passAccuracyPercent',60,'passCompletionPercent',60))), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at);

INSERT INTO notification_service.notification_message
  (notification_id, subject_id, tenant_id, notification_type, channel, template_key, template_version,
   title, safe_body, content_version, locale, structured_attributes_json, not_before, template_only,
   message_version, notification_status, idempotency_key, created_at)
SELECT LEFT(SHA2(CONCAT('seed-notification-', principal_id), 256), 36), principal_id, 'platform',
  'LEARNING_PROGRESS', 'IN_APP', 'local.learning.progress', 'v1', '本地学习数据已就绪',
  '这是来自本地 notification_service 的真实测试通知。', 'local-real-2026-08', 'zh-CN', JSON_OBJECT(),
  UTC_TIMESTAMP(6), FALSE, 1, 'UNREAD', CONCAT('seed-notification:', principal_id), UTC_TIMESTAMP(6)
FROM iam_service.iam_principal WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE safe_body = VALUES(safe_body), notification_status = IF(notification_status = 'READ', 'READ', 'UNREAD');

INSERT INTO notification_service.notification_preference
  (tenant_id, principal_id, notification_type, channel, enabled, locale, version_no, updated_at)
SELECT 'platform', principal_id, preference.notification_type, 'IN_APP', preference.enabled, 'zh-CN', 1, UTC_TIMESTAMP(6)
FROM iam_service.iam_principal
JOIN (SELECT 'ROOM_INTERACTIONS' AS notification_type, TRUE AS enabled
      UNION ALL SELECT 'FOCUS_REMINDERS', TRUE
      UNION ALL SELECT 'SYSTEM', TRUE
      UNION ALL SELECT 'DO_NOT_DISTURB', FALSE) preference
WHERE tenant_id = 'platform' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), locale = VALUES(locale), version_no = VALUES(version_no), updated_at = VALUES(updated_at);

INSERT INTO notification_service.notification_offline_package
  (package_id, package_code, version_code, state, size_bytes, part_count, sha256, signature,
   min_client_version, expires_at, signed_part_urls_json, created_at)
VALUES ('OFFLINE-B4-FOUNDATION', 'FOUNDATION', '1.0.0', 'DELETED', 4096, 4,
  'b4-offline-foundation-sha256', 'b4-offline-signature-v1', '0.1.0',
  DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY), JSON_ARRAY(), UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE state = VALUES(state), expires_at = VALUES(expires_at),
  signed_part_urls_json = VALUES(signed_part_urls_json);

INSERT INTO notification_service.notification_workflow_task
  (task_id, tenant_id, principal_id, action, aggregate_type, aggregate_id, state,
   attempt, max_attempts, reason_code, next_run_at, updated_at)
VALUES ('workflow-local-fixture', 'platform', 'local-fixture-reporter', 'DELIVER_NOTIFICATION',
        'NOTIFICATION', 'notification-local-fixture', 'DEAD_LETTER', 3, 3,
        'LOCAL_FIXTURE_DLQ', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE state = VALUES(state), attempt = VALUES(attempt),
  max_attempts = VALUES(max_attempts), reason_code = VALUES(reason_code),
  next_run_at = VALUES(next_run_at), updated_at = VALUES(updated_at);

 -- Social fixtures are excluded from the shared platform seed. Their room,
 -- seat, report and all-active-principal leaderboard rows caused live data
 -- to appear in the learner community view.

SELECT (SELECT COUNT(*) FROM gamification_service.xp_ledger x
        JOIN iam_service.iam_principal p ON p.principal_id = x.subject_id
        WHERE p.tenant_id = 'platform' AND p.status = 'ACTIVE' AND x.delta = 45),
       (SELECT COUNT(*) FROM gamification_service.gamification_feature_state),
       (SELECT COUNT(*) FROM social_service.soc_study_room
        WHERE tenant_id = 'platform' AND room_id = 'room-local-foundations'),
       (SELECT COUNT(*) FROM social_service.soc_seat_lease
        WHERE tenant_id = 'platform' AND room_id = 'room-local-foundations'),
       (SELECT COUNT(*) FROM notification_service.notification_offline_package WHERE state = 'PUBLISHED'),
       (SELECT COUNT(*) FROM notification_service.notification_message n
        JOIN iam_service.iam_principal p ON p.principal_id = n.subject_id
        WHERE p.tenant_id = 'platform' AND p.status = 'ACTIVE'),
       (SELECT COUNT(*) FROM learner_service.b25_learner_profile WHERE status = 'ACTIVE'),
       (SELECT COUNT(*) FROM learning_service.b25_learning_plan WHERE status = 'ACTIVE'),
       (SELECT COUNT(*) FROM learning_service.b25_learning_review),
       (SELECT COUNT(*) FROM assessment_service.b25_assessment_session WHERE status = 'COMPLETED'),
       (SELECT COUNT(*) FROM media_service.media_asset WHERE asset_status = 'ACTIVE'
        AND rights_status = 'ACTIVE'),
       (SELECT COUNT(*) FROM learning_service.b3_learning_interaction i
        JOIN iam_service.iam_principal p ON p.principal_id = i.principal_id
        WHERE p.tenant_id = 'platform' AND p.status = 'ACTIVE'
          AND JSON_UNQUOTE(JSON_EXTRACT(i.result_json, '$.fixture')) = 'LOCAL_FIXTURE'),
       (SELECT COUNT(*) FROM learning_service.b2_learner_expression e
        JOIN iam_service.iam_principal p ON p.principal_id = e.principal_id
        WHERE p.tenant_id = 'platform' AND p.status = 'ACTIVE' AND e.status = 'ACTIVE'),
       (SELECT COUNT(*) FROM content_service.content_public_site_facet
        WHERE status = 'PUBLISHED');
`;

// A temporary one-row source makes every owner write and final check operate
// on the same explicitly chosen fixture principal. Never fan out to all active
// accounts or invent a principal missing from IAM.
const renderedSql = `${scopedPrincipalTable}
${sql.replaceAll('iam_service.iam_principal', 'local_fixture_principal')}`;
const output = runMysql({ mysqlBin, mysqlArgs: args, password, cwd: process.cwd(), input: `${renderedSql.trim()}\n` });
const last = output.split(/\r?\n/).filter(Boolean).at(-1)?.split('\t').map(Number) ?? [];
if (last.length !== 14 || last.some((value, index) =>
  !Number.isFinite(value) || ((index === 2 || index === 3) ? value !== 0 : value < 1))) {
  throw new Error(`local learning-world fixture was not persisted: ${last.join(',')}`);
}
console.log(`local learning-world fixture ready: ${last[0]} gamification ledger(s), ${last[1]} feature-state row(s), ${last[2]} room(s), ${last[3]} seat(s), ${last[4]} offline package(s), ${last[5]} notification(s), ${last[6]} learner profile(s), ${last[7]} learning plan(s), ${last[8]} review fact(s), ${last[9]} assessment session(s), ${last[10]} media asset(s), ${last[11]} learning interaction(s), ${last[12]} expression(s), ${last[13]} public-site facet(s)`);
if (localTestSubject) {
  const subjectOutput = runMysql({
    mysqlBin,
    mysqlArgs: args,
    password,
    cwd: process.cwd(),
    input: `SELECT
      (SELECT COUNT(*) FROM learner_service.b25_learner_profile WHERE principal_id = '${localTestSubject}' AND status = 'ACTIVE'),
      (SELECT COUNT(*) FROM learning_service.b25_learning_plan WHERE principal_id = '${localTestSubject}' AND status = 'ACTIVE'),
      (SELECT COUNT(*) FROM learning_service.b25_learning_review WHERE principal_id = '${localTestSubject}'),
      (SELECT COUNT(*) FROM assessment_service.b25_assessment_session WHERE principal_id = '${localTestSubject}' AND status = 'COMPLETED'),
      (SELECT COUNT(*) FROM gamification_service.gamification_feature_state WHERE subject_id = '${localTestSubject}'),
      (SELECT COUNT(*) FROM notification_service.notification_message WHERE subject_id = '${localTestSubject}'),
      (SELECT COUNT(*) FROM social_service.soc_leaderboard_projection WHERE subject_id = '${localTestSubject}'),
      (SELECT COUNT(*) FROM learning_service.b3_learning_interaction
        WHERE principal_id = '${localTestSubject}'
          AND JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.fixture')) = 'LOCAL_FIXTURE'),
      (SELECT COUNT(*) FROM learning_service.b2_learner_expression
        WHERE principal_id = '${localTestSubject}' AND status = 'ACTIVE');\n`,
  });
  const subjectLast = subjectOutput.split(/\r?\n/).filter(Boolean).at(-1)?.split('\t').map(Number) ?? [];
  if (subjectLast.length !== 9 || subjectLast.some((value, index) =>
    !Number.isFinite(value) || value < (index === 6 ? 0 : 1))) {
    throw new Error(`local IAM JWT subject fixture was not persisted for ${localTestSubject}: ${subjectLast.join(',')}`);
  }
  console.log(`local IAM JWT subject fixture ready: ${subjectLast[0]} learner profile, ${subjectLast[1]} learning plan, ${subjectLast[2]} review fact(s), ${subjectLast[3]} assessment session, ${subjectLast[4]} feature-state row(s), ${subjectLast[5]} notification(s), ${subjectLast[6]} leaderboard row(s), ${subjectLast[7]} learning interaction(s), ${subjectLast[8]} expression(s)`);
}
