/**
 * Local-only repair for the old learning-world fixture's all-principal fan-out.
 *
 * Dry-run is the default. Applying requires the exact plan hash printed by a
 * fresh dry-run. Every deleted row is first copied to a root-only MySQL backup
 * schema; --rollback restores that snapshot without printing account data.
 * This tool deliberately leaves rows without unambiguous seed markers alone.
 */
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMysql, mysqlRuntimeMode } from './lib/mysql-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERSION = 'learning-world-seed-repair-v1';
const UNAPPROVED = "p.tenant_id = 'platform' AND (p.adult_gate_status <> 'APPROVED' OR p.adult_verified_at IS NULL)";
const APPROVED = "p.tenant_id = 'platform' AND p.adult_gate_status = 'APPROVED' AND p.adult_verified_at IS NOT NULL";
const BACKUP_NAME = /^uat_seed_repair_[0-9]{14}_[a-f0-9]{6}$/;
const OWNER_SCHEMAS = new Set(['learner_service', 'learning_service', 'assessment_service',
  'commerce_service', 'gamification_service', 'notification_service', 'social_service']);

// The predicates require both the deterministic marker and unchanged seed
// values. A learner action that changed a row makes it ineligible for deletion.
export const REPAIRABLE = [
  {
    owner: 'learner_service', table: 'b25_learner_goal', key: 'principal_id', principal: 'principal_id',
    exact: "t.idempotency_key = CONCAT('seed-goal-', p.principal_id) AND t.goal_code = 'DAILY_ENGLISH_FOUNDATION' AND t.target_level = 'A1' AND t.daily_quota_minutes = 15 AND t.status = 'ACTIVE'",
  },
  {
    owner: 'learner_service', table: 'b25_learner_preferences', key: 'principal_id', principal: 'principal_id',
    exact: "t.idempotency_key = CONCAT('seed-preferences-', p.principal_id) AND t.ui_locale = 'zh-CN' AND t.content_locale = 'en-US' AND t.timezone = 'Asia/Shanghai' AND t.theme_mode = 'SYSTEM' AND t.high_contrast = FALSE AND t.motion_mode = 'FULL'",
  },
  {
    owner: 'learner_service', table: 'b25_learner_daily_task', key: 'task_id', principal: 'principal_id',
    exact: "t.task_id = LEFT(SHA2(CONCAT('seed-task-', p.principal_id), 256), 36) AND t.idempotency_key = CONCAT('seed-task-', p.principal_id) AND t.content_code = 'course-b25-basics' AND t.title = 'English Foundations · 今日学习' AND t.task_type = 'LESSON' AND t.minutes = 15 AND t.task_status = 'AVAILABLE' AND t.completed_at IS NULL",
  },
  {
    owner: 'learning_service', table: 'b25_learning_plan', key: 'plan_id', principal: 'principal_id',
    exact: "t.plan_id = LEFT(SHA2(CONCAT('seed-plan-', p.principal_id), 256), 36) AND t.status = 'ACTIVE' AND t.target_minutes = 15 AND t.plan_version = 1",
  },
  {
    owner: 'learning_service', table: 'b25_learning_library_entry', key: 'entry_id', principal: 'principal_id',
    exact: "t.idempotency_key = CONCAT('seed-library-', p.principal_id) AND t.item_type = 'VOCAB' AND t.item_id = 'b25-item-001' AND t.source_type = 'DAILY_TASK' AND t.collection_status = 'SAVED'",
  },
  {
    owner: 'learning_service', table: 'b25_learning_review', key: 'review_id', principal: 'principal_id',
    exact: "t.review_id = LEFT(SHA2(CONCAT('seed-review-', p.principal_id), 256), 36) AND t.idempotency_key = CONCAT('seed-review-', p.principal_id) AND t.item_id = 'b25-item-001' AND t.quality = 4",
  },
  {
    owner: 'learning_service', table: 'b2_learner_expression', key: 'expression_id', principal: 'principal_id',
    exact: "t.create_idempotency_key = CONCAT('seed-expression-', p.principal_id) AND t.last_idempotency_key = t.create_idempotency_key AND t.source_type = 'READING' AND t.source_ref = 'course-b25-basics' AND t.sentence_text = 'It takes time to build a habit.' AND t.selected_text = 'build a habit' AND t.private_note = '本地真实数据 fixture：用于表达复习联调。' AND t.status = 'ACTIVE'",
  },
  {
    owner: 'learning_service', table: 'b25_learning_continue_context', key: 'principal_id', principal: 'principal_id',
    exact: "t.last_idempotency_key = CONCAT('seed-continue-', p.principal_id) AND t.module_id = 'course-b25-basics' AND t.lesson_id = 'unit-b25-foundations' AND t.step_index = 1 AND t.total_steps = 3 AND t.elapsed_time_ms = 0 AND t.status = 'ACTIVE'",
  },
  {
    owner: 'learning_service', table: 'b3_learning_interaction', key: 'interaction_id', principal: 'principal_id',
    exact: "t.idempotency_key IN (CONCAT('seed-b3-grammar-mistake-', p.principal_id), CONCAT('seed-b3-writing-history-', p.principal_id), CONCAT('seed-b3-offline-change-', p.principal_id)) AND JSON_UNQUOTE(JSON_EXTRACT(t.payload_json, '$.fixture')) = 'LOCAL_FIXTURE' AND JSON_UNQUOTE(JSON_EXTRACT(t.result_json, '$.fixture')) = 'LOCAL_FIXTURE' AND t.status = 'ACCEPTED'",
  },
  {
    owner: 'assessment_service', table: 'b25_assessment_report', key: 'report_id', principal: 'principal_id',
    exact: "t.report_id = LEFT(SHA2(CONCAT('seed-assessment-report-', p.principal_id), 256), 36) AND t.session_id = LEFT(SHA2(CONCAT('seed-assessment-session-', p.principal_id), 256), 36) AND t.cefr_level = 'A1' AND t.score = 1.000 AND JSON_LENGTH(t.mistakes_json) = 0 AND EXISTS (SELECT 1 FROM assessment_service.b25_assessment_session s WHERE s.session_id = t.session_id AND s.principal_id = t.principal_id AND s.idempotency_key = CONCAT('seed-assessment-', p.principal_id) AND s.status = 'COMPLETED' AND s.score = 1.000)",
  },
  {
    owner: 'assessment_service', table: 'b25_assessment_session', key: 'session_id', principal: 'principal_id',
    exact: "t.session_id = LEFT(SHA2(CONCAT('seed-assessment-session-', p.principal_id), 256), 36) AND t.idempotency_key = CONCAT('seed-assessment-', p.principal_id) AND t.report_id = LEFT(SHA2(CONCAT('seed-assessment-report-', p.principal_id), 256), 36) AND t.content_code = 'course-b25-basics' AND t.status = 'COMPLETED' AND t.score = 1.000 AND JSON_LENGTH(t.answers_json) = 1 AND JSON_UNQUOTE(JSON_EXTRACT(t.answers_json, '$.\"b25-item-001\"')) = 'A'",
  },
  {
    owner: 'commerce_service', table: 'commerce_entitlement', key: 'entitlement_id', principal: 'subject_id',
    exact: "t.entitlement_id = LEFT(SHA2(CONCAT('seed-entitlement-', p.principal_id), 256), 36) AND t.sku_id = 'phase1-foundations' AND t.entitlement_code = 'LEARNER_PHASE1' AND t.source_type = 'LOCAL_FIXTURE' AND t.source_ref = 'local-real-learning-fixture' AND t.reason_code = 'LOCAL_TEST_FIXTURE' AND t.amount_minor = 9900 AND t.status = 'ACTIVE'",
  },
  {
    owner: 'notification_service', table: 'notification_message', key: 'notification_id', principal: 'subject_id',
    exact: "t.notification_id = LEFT(SHA2(CONCAT('seed-notification-', p.principal_id), 256), 36) AND t.idempotency_key = CONCAT('seed-notification:', p.principal_id) AND t.template_key = 'local.learning.progress' AND t.title = '本地学习数据已就绪' AND t.notification_status = 'UNREAD'",
  },
];

// These are counted but never automatically removed: they have no row-level
// seed identity, can affect accumulated balances, or can represent user state.
export const REVIEW_ONLY = [
  { owner: 'learning_service', table: 'b25_learning_srs_state', principal: 'principal_id', exact: "t.item_id = 'b25-item-001' AND t.stage = 'NEW' AND t.review_count = 0" },
  { owner: 'gamification_service', table: 'xp_ledger', principal: 'subject_id', exact: "t.ledger_id = LEFT(SHA2(CONCAT('seed-xp-', p.principal_id), 256), 36) AND t.source_event_id = LEFT(SHA2(CONCAT('seed-event-', p.principal_id), 256), 36) AND t.delta = 45" },
  { owner: 'gamification_service', table: 'coin_ledger', principal: 'subject_id', exact: "t.ledger_id = LEFT(SHA2(CONCAT('seed-coin-', p.principal_id), 256), 36) AND t.source_event_id = LEFT(SHA2(CONCAT('seed-event-', p.principal_id), 256), 36) AND t.delta = 3" },
  { owner: 'gamification_service', table: 'reward_grant', principal: 'subject_id', exact: "t.grant_id = LEFT(SHA2(CONCAT('seed-grant-', p.principal_id), 256), 36) AND t.idempotency_key = CONCAT('grant:seed-grant-', p.principal_id)" },
  { owner: 'gamification_service', table: 'gamification_season_fact', principal: 'subject_id', exact: "t.event_id = CONCAT('seed-season-', p.principal_id) AND t.points = 24" },
  { owner: 'social_service', table: 'soc_leaderboard_projection', principal: 'subject_id', exact: "t.source_watermark = 'local-fixture' AND t.leaderboard_kind = 'FOCUS_MINUTES' AND t.period_type = 'DAY' AND t.score = 20 AND t.qualified_units = 20" },
];

for (const target of [...REPAIRABLE, ...REVIEW_ONLY]) {
  if (!OWNER_SCHEMAS.has(target.owner) || !/^[a-z0-9_]+$/.test(target.table)) {
    throw new Error('repair target must belong to an approved owner schema');
  }
}

export function targetName(target) { return `${target.owner}.${target.table}`; }
function queryFor(target, scope = 'unapproved') {
  // Some review-only legacy tables have no tenant_id. IAM supplies the scope.
  const tenant = (REPAIRABLE.includes(target) || ['xp_ledger', 'coin_ledger', 'reward_grant', 'b25_learning_srs_state', 'soc_leaderboard_projection'].includes(target.table))
    ? "t.tenant_id = 'platform' AND " : '';
  const gate = scope === 'approved' ? APPROVED : UNAPPROVED;
  return `${tenant}${gate} AND ${target.exact}`;
}
export function countSql(target, scope = 'unapproved') {
  if (!['unapproved', 'approved'].includes(scope)) throw new Error('unsupported repair scope');
  return `SELECT '${targetName(target)}', COUNT(*), COUNT(DISTINCT p.principal_id) FROM ${targetName(target)} t JOIN iam_service.iam_principal p ON p.principal_id = t.${target.principal} WHERE ${queryFor(target, scope)};`;
}
function mysql(input) {
  try {
    return runMysql({
      mysqlBin: process.env.MYSQL_BIN || 'mysql',
      mysqlArgs: ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user', 'root',
        '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw'],
      password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only', cwd: ROOT, input,
    });
  } catch {
    // mysql can echo a failed row's key or value, including an account ID.
    throw new Error('local MySQL repair query failed; database details withheld');
  }
}
export function assertLocalConnection() {
  if ((process.env.MYSQL_HOST || '127.0.0.1') !== '127.0.0.1' ||
      String(process.env.MYSQL_PORT || '13306') !== '13306') {
    throw new Error('repair is restricted to local MySQL 127.0.0.1:13306');
  }
  if (mysqlRuntimeMode(process.env.MYSQL_BIN || 'mysql') === 'docker') {
    const compose = path.resolve(ROOT, process.env.MYSQL_COMPOSE_FILE || 'infra/docker/docker-compose.dev.yml');
    if (compose !== path.resolve(ROOT, 'infra/docker/docker-compose.dev.yml') ||
        (process.env.MYSQL_COMPOSE_SERVICE || 'mysql') !== 'mysql') {
      throw new Error('repair refuses custom Docker MySQL targets');
    }
  }
}
function parseCounts(output, targets) {
  const rows = output.split(/\r?\n/).filter(Boolean).map(line => line.split('\t'));
  if (rows.length !== targets.length) throw new Error('repair count query returned an unexpected shape');
  return rows.map(([name, rowsAffected, principals], index) => {
    if (name !== targetName(targets[index]) || !/^\d+$/.test(rowsAffected) || !/^\d+$/.test(principals)) {
      throw new Error('repair count query returned an unexpected target');
    }
    return { table: name, rows: Number(rowsAffected), principals: Number(principals) };
  });
}
export function planHash(repairable, reviewOnly, approvedRepairable = [], approvedReviewOnly = []) {
  return createHash('sha256').update(JSON.stringify({ version: VERSION, scope: 'unapproved', repairable, reviewOnly, approvedRepairable, approvedReviewOnly })).digest('hex');
}
function dependencyCount() {
  const selected = REPAIRABLE.map(t => `(k.REFERENCED_TABLE_SCHEMA = '${t.owner}' AND k.REFERENCED_TABLE_NAME = '${t.table}')`).join(' OR ');
  const output = mysql(`SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE k WHERE k.REFERENCED_TABLE_NAME IS NOT NULL AND (${selected});`);
  if (!/^\d+$/.test(output)) throw new Error('foreign-key inspection failed');
  return Number(output);
}
function activityRisk(scope) {
  const gate = scope === 'approved' ? APPROVED : UNAPPROVED;
  const fields = ['seededSubjects', 'otherReview', 'otherAssessment', 'otherXp',
    'otherCoin', 'otherEntitlement', 'liveSession'];
  const output = mysql(`SELECT COUNT(*),
    COALESCE(SUM(EXISTS(SELECT 1 FROM learning_service.b25_learning_review x WHERE x.principal_id = p.principal_id AND x.review_id <> r.review_id)), 0),
    COALESCE(SUM(EXISTS(SELECT 1 FROM assessment_service.b25_assessment_session x WHERE x.principal_id = p.principal_id AND x.session_id <> LEFT(SHA2(CONCAT('seed-assessment-session-', p.principal_id), 256), 36))), 0),
    COALESCE(SUM(EXISTS(SELECT 1 FROM gamification_service.xp_ledger x WHERE x.subject_id = p.principal_id AND x.ledger_id <> LEFT(SHA2(CONCAT('seed-xp-', p.principal_id), 256), 36))), 0),
    COALESCE(SUM(EXISTS(SELECT 1 FROM gamification_service.coin_ledger x WHERE x.subject_id = p.principal_id AND x.ledger_id <> LEFT(SHA2(CONCAT('seed-coin-', p.principal_id), 256), 36))), 0),
    COALESCE(SUM(EXISTS(SELECT 1 FROM commerce_service.commerce_entitlement x WHERE x.subject_id = p.principal_id AND x.entitlement_id <> LEFT(SHA2(CONCAT('seed-entitlement-', p.principal_id), 256), 36))), 0),
    COALESCE(SUM(EXISTS(SELECT 1 FROM iam_service.iam_session x WHERE x.principal_id = p.principal_id AND x.status = 'ACTIVE' AND x.expires_at > UTC_TIMESTAMP(6))), 0)
    FROM iam_service.iam_principal p
    JOIN learning_service.b25_learning_review r ON r.principal_id = p.principal_id
      AND r.review_id = LEFT(SHA2(CONCAT('seed-review-', p.principal_id), 256), 36)
    WHERE ${gate};`).split('\t');
  if (output.length !== fields.length || output.some(value => !/^\d+$/.test(value))) {
    throw new Error('activity dependency query returned an unexpected shape');
  }
  return Object.fromEntries(fields.map((field, index) => [field, Number(output[index])]));
}
export function dryRun() {
  assertLocalConnection();
  const repairable = parseCounts(mysql(REPAIRABLE.map(t => countSql(t)).join('\n')), REPAIRABLE);
  const reviewOnly = parseCounts(mysql(REVIEW_ONLY.map(t => countSql(t)).join('\n')), REVIEW_ONLY);
  const approvedRepairable = parseCounts(mysql(REPAIRABLE.map(t => countSql(t, 'approved')).join('\n')), REPAIRABLE);
  const approvedReviewOnly = parseCounts(mysql(REVIEW_ONLY.map(t => countSql(t, 'approved')).join('\n')), REVIEW_ONLY);
  const foreignKeyReferences = dependencyCount();
  const plan = { version: VERSION, applyScope: 'IAM adult gate not approved', repairable, reviewOnly,
    activityRisk: activityRisk('unapproved'),
    approvedReportOnly: { repairable: approvedRepairable, reviewOnly: approvedReviewOnly,
      activityRisk: activityRisk('approved') },
    foreignKeyReferences, planHash: planHash(repairable, reviewOnly, approvedRepairable, approvedReviewOnly) };
  return plan;
}

function backupName() {
  const date = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `uat_seed_repair_${date}_${randomBytes(3).toString('hex')}`;
}
function backupSql(schema, target) {
  const name = targetName(target);
  return `CREATE TABLE ${schema}.${target.table} LIKE ${name};\n` +
    `INSERT INTO ${schema}.${target.table} SELECT t.* FROM ${name} t JOIN iam_service.iam_principal p ON p.principal_id = t.${target.principal} WHERE ${queryFor(target)};`;
}
function backupJoin(target, sourceAlias) {
  return `${sourceAlias}.${target.key} = b.${target.key} AND ${sourceAlias}.tenant_id = b.tenant_id`;
}
function apply(plan, expectedHash) {
  if (expectedHash !== plan.planHash) throw new Error('dry-run plan hash changed; inspect a fresh plan before applying');
  if (plan.foreignKeyReferences !== 0) throw new Error('target tables now have foreign-key dependents; manual review required');
  if (['otherReview', 'otherAssessment', 'otherXp', 'otherCoin', 'otherEntitlement']
    .some(field => plan.activityRisk[field] > 0)) {
    throw new Error('target subjects have non-seed activity; manual repair required');
  }
  const schema = backupName();
  const manifest = JSON.stringify(plan.repairable);
  const snapshot = `CREATE DATABASE ${schema};\n` +
    `CREATE TABLE ${schema}._run (version VARCHAR(64) NOT NULL, plan_hash CHAR(64) NOT NULL, scope_code VARCHAR(32) NOT NULL, manifest_json JSON NOT NULL, created_at DATETIME(6) NOT NULL, applied_at DATETIME(6) NULL, restored_at DATETIME(6) NULL);\n` +
    `INSERT INTO ${schema}._run VALUES ('${VERSION}', '${plan.planHash}', 'UNAPPROVED', '${manifest.replaceAll("'", "''")}', UTC_TIMESTAMP(6), NULL, NULL);\n` +
    REPAIRABLE.map(target => backupSql(schema, target)).join('\n') + '\n';
  mysql(snapshot);
  const copied = mysql(REPAIRABLE.map(t => `SELECT '${targetName(t)}', COUNT(*) FROM ${schema}.${t.table};`).join('\n'))
    .split(/\r?\n/).filter(Boolean).map(line => line.split('\t'));
  if (copied.length !== plan.repairable.length || copied.some(([name, n], i) => name !== plan.repairable[i].table || Number(n) !== plan.repairable[i].rows)) {
    throw new Error(`backup ${schema} differs from reviewed plan; no source rows deleted`);
  }
  const assertions = REPAIRABLE.map(t =>
    `INSERT INTO repair_assert SELECT IF((SELECT COUNT(*) FROM ${targetName(t)} x JOIN ${schema}.${t.table} b ON ${backupJoin(t, 'x')}) = (SELECT COUNT(*) FROM ${schema}.${t.table}), 1, 0);`).join('\n');
  const deletes = REPAIRABLE.map(t =>
    `DELETE t FROM ${targetName(t)} t JOIN ${schema}.${t.table} b ON ${backupJoin(t, 't')} JOIN iam_service.iam_principal p ON p.principal_id = t.${t.principal} WHERE ${queryFor(t)};\n` +
    `INSERT INTO repair_assert SELECT IF((SELECT COUNT(*) FROM ${targetName(t)} x JOIN ${schema}.${t.table} b ON ${backupJoin(t, 'x')}) = 0, 1, 0);`).join('\n');
  mysql(`USE iam_service;\nCREATE TEMPORARY TABLE repair_assert (ok TINYINT NOT NULL, CONSTRAINT chk_repair_assert CHECK (ok = 1));\nSTART TRANSACTION;\n${assertions}\n${deletes}\nUPDATE ${schema}._run SET applied_at = UTC_TIMESTAMP(6);\nCOMMIT;`);
  return { backupSchema: schema, deletedRows: plan.repairable.reduce((n, row) => n + row.rows, 0) };
}
function rollback(schema) {
  if (!BACKUP_NAME.test(schema)) throw new Error('rollback requires an exact repair backup schema name');
  const run = mysql(`SELECT version, plan_hash, scope_code, applied_at IS NOT NULL, restored_at IS NOT NULL FROM ${schema}._run;`).split('\t');
  if (run.length !== 5 || run[0] !== VERSION || run[2] !== 'UNAPPROVED' || run[3] !== '1' || run[4] !== '0') {
    throw new Error('backup was not applied, has already been restored, or has the wrong version');
  }
  const inserts = [...REPAIRABLE].reverse().map(t =>
    `INSERT INTO ${targetName(t)} SELECT * FROM ${schema}.${t.table};\n` +
    `INSERT INTO repair_assert SELECT IF((SELECT COUNT(*) FROM ${targetName(t)} x JOIN ${schema}.${t.table} b ON ${backupJoin(t, 'x')}) = (SELECT COUNT(*) FROM ${schema}.${t.table}), 1, 0);`).join('\n');
  mysql(`USE iam_service;\nCREATE TEMPORARY TABLE repair_assert (ok TINYINT NOT NULL, CONSTRAINT chk_repair_assert CHECK (ok = 1));\nSTART TRANSACTION;\n${inserts}\nUPDATE ${schema}._run SET restored_at = UTC_TIMESTAMP(6);\nCOMMIT;`);
  return { backupSchema: schema, restored: true };
}

function main(argv) {
  assertLocalConnection();
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--dry-run')) {
    console.log(JSON.stringify(dryRun(), null, 2));
    return;
  }
  if (argv[0] === '--apply' && argv.length === 2 && /^[a-f0-9]{64}$/.test(argv[1])) {
    const plan = dryRun();
    console.log(JSON.stringify({ plan, result: apply(plan, argv[1]) }, null, 2));
    return;
  }
  if (argv[0] === '--rollback' && argv.length === 2) {
    console.log(JSON.stringify(rollback(argv[1]), null, 2));
    return;
  }
  throw new Error('usage: node scripts/database/repair-local-learning-world-seed.mjs [--dry-run | --apply <planHash> | --rollback <backupSchema>]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
