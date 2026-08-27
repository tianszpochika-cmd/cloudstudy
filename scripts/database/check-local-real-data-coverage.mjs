import { runMysql } from './lib/mysql-client.mjs';

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '13306';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const args = [
  '--protocol=TCP', '--host', host, '--port', String(port), '--user', 'root',
  '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
];

const subject = (process.env.LOCAL_TEST_SUBJECT ?? '').trim();
if (subject && !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(subject)) {
  throw new Error('LOCAL_TEST_SUBJECT contains unsupported characters');
}

const checks = [
  ['content.course', 'content_service.b25_content_course', " WHERE availability = 'PUBLISHED' AND rights_status = 'VALID'", 1],
  ['content.vocabulary', 'content_service.b25_content_vocabulary', " WHERE availability = 'PUBLISHED'", 1],
  ['content.multimodal-experiences', 'content_service.b3_content_experience', " WHERE availability = 'PUBLISHED'", 12],
  ['content.phonemes', 'content_service.b3_content_experience', " WHERE availability = 'PUBLISHED' AND resource_type = 'PHONEME'", 48],
  ['content.public-site-facets', 'content_service.content_public_site_facet', " WHERE status = 'PUBLISHED'", 6],
  ['learner.profile', 'learner_service.b25_learner_profile', " WHERE status = 'ACTIVE'", 1],
  ['learner.goal', 'learner_service.b25_learner_goal', " WHERE status = 'ACTIVE'", 1],
  ['learner.preferences', 'learner_service.b25_learner_preferences', '', 1],
  ['learner.daily-task', 'learner_service.b25_learner_daily_task', " WHERE task_status IN ('AVAILABLE', 'COMPLETED')", 1],
  ['learning.plan', 'learning_service.b25_learning_plan', " WHERE status = 'ACTIVE'", 1],
  ['learning.srs', 'learning_service.b25_learning_srs_state', '', 1],
  ['learning.review', 'learning_service.b25_learning_review', '', 1],
  ['learning.interaction', 'learning_service.b3_learning_interaction', " WHERE status = 'ACCEPTED'", 1],
  ['learning.expression', 'learning_service.b2_learner_expression', " WHERE status = 'ACTIVE'", 1],
  ['assessment.session', 'assessment_service.b25_assessment_session', " WHERE status = 'COMPLETED'", 1],
  ['assessment.report', 'assessment_service.b25_assessment_report', '', 1],
  ['assessment.item-rule', 'assessment_service.b25_assessment_item_rule', ' WHERE active = TRUE', 1],
  ['media.asset', 'media_service.media_asset', " WHERE asset_status = 'ACTIVE' AND rights_status = 'ACTIVE'", 1],
  ['media.ready-rendition', 'media_service.media_rendition', " WHERE rendition_status = 'READY'", 1],
  ['commerce.sku', 'commerce_service.commerce_sku', " WHERE status = 'ACTIVE'", 1],
  ['commerce.entitlement', 'commerce_service.commerce_entitlement', " WHERE status = 'ACTIVE'", 1],
  ['gamification.feature-state', 'gamification_service.gamification_feature_state', '', 1],
  ['gamification.reward', 'gamification_service.reward_grant', " WHERE claim_status = 'GRANTED'", 1],
  ['social.room', 'social_service.soc_study_room', " WHERE state = 'OPEN'", 1],
  ['social.seat', 'social_service.soc_seat_lease', " WHERE state = 'AVAILABLE'", 1],
  ['social.report', 'social_service.soc_report', " WHERE state IN ('RECEIVED', 'TRIAGED', 'APPEALED')", 1],
  ['social.leaderboard', 'social_service.soc_leaderboard_projection', " WHERE projection_state = 'PUBLISHED'", 1],
  ['notification.message', 'notification_service.notification_message', '', 1],
  ['notification.offline-package', 'notification_service.notification_offline_package', " WHERE state = 'PUBLISHED'", 1],
  ['notification.recovery-task', 'notification_service.notification_workflow_task', " WHERE state IN ('QUEUED', 'RETRY_SCHEDULED', 'DEAD_LETTER', 'MANUAL_RECOVERY')", 1],
  ['admin.projection', 'admin_ops_service.admin_projection', '', 1],
  ['admin.ticket', 'admin_ops_service.support_ticket', '', 1],
  ['analytics.metric', 'analytics_service.analytics_metric_projection', " WHERE projection_state = 'READY'", 1],
];

function count(table, where = '', ownerColumn = null) {
  const owner = subject && ownerColumn ? `${where ? ' AND ' : ' WHERE '}${ownerColumn} = '${subject}'` : '';
  return Number(runMysql({
    mysqlBin,
    mysqlArgs: args,
    password,
    cwd: process.cwd(),
    input: `SELECT COUNT(*) FROM ${table}${where}${owner};\n`,
  }).trim());
}

function scalar(sql) {
  return Number(runMysql({
    mysqlBin,
    mysqlArgs: args,
    password,
    cwd: process.cwd(),
    input: `${sql}\n`,
  }).trim());
}

const failures = [];
const counts = {};
for (const [name, table, where, minimum] of checks) {
  const value = count(table, where);
  counts[name] = value;
  if (!Number.isFinite(value) || value < minimum) failures.push(`${name}=${value} < ${minimum}`);
}

const customChecks = [
  ['content.b3-resource-types', `SELECT COUNT(DISTINCT resource_type)
    FROM content_service.b3_content_experience
   WHERE availability = 'PUBLISHED'
     AND resource_type IN ('GRAMMAR_POINT', 'GRAMMAR_EXERCISE', 'SENTENCE',
       'LISTENING_MATERIAL', 'LISTENING_CLIP', 'READING_ARTICLE', 'READING_QUESTION',
       'DICTIONARY_ENTRY', 'PHONEME', 'MINIMAL_PAIR', 'WRITING_PROMPT',
       'WRITING_TEMPLATE', 'WRITING_MATERIAL', 'PROOFREADING')`, 14],
  ['learning.failed-interaction', `SELECT COUNT(*)
    FROM learning_service.b3_learning_interaction
   WHERE status = 'ACCEPTED'
     AND JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.correct')) <> 'true'`, 1],
];
for (const [name, sql, minimum] of customChecks) {
  const value = scalar(sql);
  counts[name] = value;
  if (!Number.isFinite(value) || value < minimum) failures.push(`${name}=${value} < ${minimum}`);
}

const subjectChecks = [
  ['learner.profile', 'learner_service.b25_learner_profile', " WHERE status = 'ACTIVE'", 'principal_id'],
  ['learner.goal', 'learner_service.b25_learner_goal', " WHERE status = 'ACTIVE'", 'principal_id'],
  ['learning.plan', 'learning_service.b25_learning_plan', " WHERE status = 'ACTIVE'", 'principal_id'],
  ['learning.srs', 'learning_service.b25_learning_srs_state', '', 'principal_id'],
  ['learning.review', 'learning_service.b25_learning_review', '', 'principal_id'],
  ['learning.expression', 'learning_service.b2_learner_expression', " WHERE status = 'ACTIVE'", 'principal_id'],
  ['assessment.session', 'assessment_service.b25_assessment_session', " WHERE status = 'COMPLETED'", 'principal_id'],
  ['gamification.feature-state', 'gamification_service.gamification_feature_state', '', 'subject_id'],
  ['notification.message', 'notification_service.notification_message', '', 'subject_id'],
];
const subjectCounts = {};
if (subject) {
  for (const [name, table, where, ownerColumn] of subjectChecks) {
    const value = count(table, where, ownerColumn);
    subjectCounts[name] = value;
    if (!Number.isFinite(value) || value < 1) failures.push(`${name}[${subject}]=${value} < 1`);
  }
}

const result = { status: failures.length ? 'FAIL' : 'PASS', checks: checks.length + customChecks.length, counts };
if (subject) {
  result.subject = subject;
  result.subjectCounts = subjectCounts;
}
if (failures.length) {
  result.failures = failures;
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
