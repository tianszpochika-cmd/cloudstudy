import { writeFileSync } from 'node:fs';
import { runMysql } from './lib/mysql-client.mjs';
import { assertLocalDatabaseTarget } from './local-real-10x-fixture.mjs';

// Read-only, local-only UAT audit. Projection rows contain aggregate values and opaque hashes.
assertLocalDatabaseTarget();
const mysqlArgs = [
  '--protocol=TCP', '--host', process.env.MYSQL_HOST || '127.0.0.1',
  '--port', String(process.env.MYSQL_PORT || '13306'),
  '--user', process.env.MYSQL_ADMIN_USER || 'root',
  '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
];
const query = (sql) => runMysql({
  mysqlBin: process.env.MYSQL_BIN || 'mysql', mysqlArgs,
  password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only',
  cwd: process.cwd(), input: `${sql.trim()}\n`,
});
const lines = (sql) => query(sql).split(/\r?\n/).filter(Boolean);
const projectionRows = lines(`
SELECT JSON_OBJECT(
  'tenantId', tenant_id, 'metricId', metric_id, 'metricVersion', metric_version,
  'periodStart', DATE_FORMAT(period_start, '%Y-%m-%d'), 'dimensionKey', dimension_key,
  'state', projection_state, 'eventCount', event_count, 'totalValue', total_value,
  'lastOccurredAt', IFNULL(DATE_FORMAT(last_occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ'), ''),
  'sourceWatermark', IFNULL(source_watermark, ''), 'projectionVersion', projection_version,
  'errorCode', IFNULL(error_code, ''),
  'updatedAt', DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.%fZ'))
FROM analytics_service.analytics_metric_projection ORDER BY tenant_id, metric_id, metric_version,
  period_start, dimension_key;
`).map(JSON.parse);

const ownerCounts = lines(`
SELECT 'receipt', COUNT(*) FROM analytics_service.analytics_event_receipt
UNION ALL SELECT 'journal', COUNT(*) FROM analytics_service.analytics_event_journal
UNION ALL SELECT 'recompute_job', COUNT(*) FROM analytics_service.analytics_recompute_job;
`).map((line) => line.split('\t'));
const ownerTenantCounts = lines(`
SELECT 'receipt', tenant_id, COUNT(*) FROM analytics_service.analytics_event_receipt GROUP BY tenant_id
UNION ALL SELECT 'journal', tenant_id, COUNT(*) FROM analytics_service.analytics_event_journal GROUP BY tenant_id
UNION ALL SELECT 'projection', tenant_id, COUNT(*) FROM analytics_service.analytics_metric_projection GROUP BY tenant_id
UNION ALL SELECT 'recompute_job', tenant_id, COUNT(*) FROM analytics_service.analytics_recompute_job GROUP BY tenant_id
ORDER BY 1, 2;
`).map((line) => line.split('\t'));
const platformFixtureCounts = Object.fromEntries(lines(`
SELECT 'receipt', COUNT(*) FROM analytics_service.analytics_event_receipt
 WHERE tenant_id='platform' AND (event_id LIKE 'bulk-100x-%' OR event_id LIKE 'local-10x-%'
   OR event_id='analytics-fixture-assessed-001')
UNION ALL SELECT 'journal', COUNT(*) FROM analytics_service.analytics_event_journal
 WHERE tenant_id='platform' AND (event_id LIKE 'bulk-100x-%' OR event_id LIKE 'local-10x-%'
   OR event_id='analytics-fixture-assessed-001')
UNION ALL SELECT 'projection', COUNT(*) FROM analytics_service.analytics_metric_projection
 WHERE tenant_id='platform' AND (metric_id LIKE 'bulk-100x-%' OR metric_id LIKE 'local-10x-%'
   OR source_watermark IN (SHA2('analytics-assessment-watermark',256),
     SHA2('analytics-mastery-watermark',256), SHA2('analytics-review-watermark',256),
     SHA2('analytics-workflow-watermark',256), SHA2('analytics-growth-watermark',256),
     SHA2('analytics-social-watermark',256), SHA2('analytics-notification-watermark',256)))
UNION ALL SELECT 'recompute_job', COUNT(*) FROM analytics_service.analytics_recompute_job
 WHERE tenant_id='platform' AND (job_id LIKE 'bulk-100x-%' OR job_id LIKE 'local-10x-%');
`).map((line) => { const [key, value] = line.split('\t'); return [key, Number(value)]; }));
const journalFamilies = lines(`
SELECT CASE WHEN event_id LIKE 'bulk-100x-%' THEN 'bulk-100x'
  WHEN event_id LIKE 'local-10x-%' THEN 'local-10x'
  WHEN event_id LIKE 'analytics-fixture-%' THEN 'admin-analytics-fixture'
  ELSE 'other' END, COUNT(*),
  MIN(DATE_FORMAT(occurred_at, '%Y-%m-%d')), MAX(DATE_FORMAT(occurred_at, '%Y-%m-%d'))
FROM analytics_service.analytics_event_journal GROUP BY 1 ORDER BY 1;
`).map((line) => line.split('\t'));
const receiptFamilies = lines(`
SELECT CASE WHEN event_id LIKE 'bulk-100x-%' THEN 'bulk-100x'
  WHEN event_id LIKE 'local-10x-%' THEN 'local-10x'
  WHEN event_id LIKE 'analytics-fixture-%' THEN 'admin-analytics-fixture'
  ELSE 'other' END, receipt_state, COUNT(*)
FROM analytics_service.analytics_event_receipt GROUP BY 1, 2 ORDER BY 1, 2;
`).map((line) => line.split('\t'));
const jobFamilies = lines(`
SELECT CASE WHEN job_id LIKE 'bulk-100x-%' THEN 'bulk-100x'
  WHEN job_id LIKE 'local-10x-%' THEN 'local-10x' ELSE 'other' END,
  job_state, COUNT(*)
FROM analytics_service.analytics_recompute_job GROUP BY 1, 2 ORDER BY 1, 2;
`).map((line) => line.split('\t'));
const foreignKeysIntoAnalytics = lines(`
SELECT CONCAT(TABLE_SCHEMA, '.', TABLE_NAME, '.', COLUMN_NAME)
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA='analytics_service'
  AND REFERENCED_TABLE_NAME IN ('analytics_metric_projection', 'analytics_event_receipt',
    'analytics_event_journal', 'analytics_recompute_job') ORDER BY 1;
`);
const syntheticTenantPrincipalCount = Number(lines(`
SELECT COUNT(*) FROM iam_service.iam_principal WHERE tenant_id='local-analytics-fixture';
`)[0]);
const journalTenantPayloads = lines(`
SELECT CASE WHEN event_id LIKE 'bulk-100x-%' THEN 'bulk-100x'
  WHEN event_id LIKE 'local-10x-%' THEN 'local-10x'
  WHEN event_id LIKE 'analytics-fixture-%' THEN 'admin-analytics-fixture'
  ELSE 'other' END,
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sanitized_payload_json, '$.tenantId')), '(absent)'), COUNT(*)
FROM analytics_service.analytics_event_journal GROUP BY 1, 2 ORDER BY 1, 2;
`).map((line) => line.split('\t'));
const ownerIdSamples = Object.fromEntries([
  ['receipt', 'analytics_event_receipt', 'event_id'],
  ['journal', 'analytics_event_journal', 'event_id'],
  ['recompute_job', 'analytics_recompute_job', 'job_id'],
].map(([name, table, id]) => [name, lines(`
  SELECT ${id} FROM analytics_service.${table} WHERE tenant_id='platform' ORDER BY ${id} LIMIT 3;
`)]));

const family = (id) => id.startsWith('bulk-100x-') ? 'bulk-100x'
  : id.startsWith('local-10x-') ? 'local-10x'
  : ['assessment_attempt', 'learning_mastery_projection', 'learning_review_queue',
    'workflow.saga.started', 'growth_ledger', 'leaderboard_projection', 'notification'].includes(id)
    ? 'admin-analytics-fixture' : 'other';
const groups = new Map();
for (const row of projectionRows) {
  const key = [family(row.metricId), row.state, row.errorCode ? 'has-error-code' : 'no-error-code'].join('|');
  groups.set(key, (groups.get(key) || 0) + 1);
}
const result = {
  generatedAt: new Date().toISOString(),
  scope: 'local analytics_service only; read-only',
  status: Object.values(platformFixtureCounts).every((value) => value === 0) ? 'PASS' : 'FAIL',
  projectionCount: projectionRows.length,
  projectionGroups: [...groups].map(([key, count]) => ({ key, count })),
  ownerCounts: Object.fromEntries(ownerCounts.map(([key, value]) => [key, Number(value)])),
  ownerTenantCounts,
  platformFixtureCounts,
  journalFamilies, receiptFamilies, jobFamilies,
  foreignKeysIntoAnalytics, syntheticTenantPrincipalCount, journalTenantPayloads,
  ownerIdSamples,
  projections: projectionRows,
};
const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ ...result, projections: undefined }, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
