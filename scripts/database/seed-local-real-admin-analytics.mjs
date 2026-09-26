import { runMysql } from './lib/mysql-client.mjs';
import { assertLocalDatabaseTarget } from './local-real-10x-fixture.mjs';

const mysqlBin = process.env.MYSQL_BIN || 'mysql';
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '13306';
const password = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only';
const args = [
  '--protocol=TCP', '--host', host, '--port', String(port), '--user', 'root',
  '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw',
];

// This fixture is intentionally limited to opaque references, redacted metadata and aggregate
// analytics values. It never copies learner text, media bytes, payment credentials or tokens.
const sql = `
SET NAMES utf8mb4;

INSERT INTO admin_ops_service.admin_projection
  (projection_id, domain_name, resource_ref, projection_version, redacted_payload, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'CONTENT', 'content-local-foundations', 1,
   JSON_OBJECT('tenantId', 'local-admin-fixture', 'ownerSubjectId', 'local-fixture',
     'authorSubjectId', 'local-author', 'version', '25001', 'status', 'PUBLISHED',
     'safeFields', JSON_OBJECT('contentCode', 'course-b25-basics', 'contentType', 'LESSON', 'locale', 'en-US')),
   UTC_TIMESTAMP(6)),
  ('22222222-2222-4222-8222-222222222222', 'COMMERCE', 'phase1-foundations', 1,
   JSON_OBJECT('tenantId', 'local-admin-fixture', 'ownerSubjectId', 'local-fixture',
     'version', '1', 'status', 'ACTIVE',
     'safeFields', JSON_OBJECT('skuCode', 'phase1-foundations', 'currency', 'CNY',
       'catalogState', 'ACTIVE', 'orderState', 'PAID', 'amountMinor', '19900',
       'createdAt', '2026-08-26T08:00:00Z', 'redactionVersion', 'commerce.redacted.v1')),
   UTC_TIMESTAMP(6)),
  ('33333333-3333-4333-8333-333333333333', 'LEARNER', 'learner-local-profile', 1,
   JSON_OBJECT('tenantId', 'local-admin-fixture', 'ownerSubjectId', 'local-fixture',
     'version', '1', 'status', 'ACTIVE',
     'safeFields', JSON_OBJECT('uiLocale', 'zh-CN', 'contentLocale', 'en-US', 'profileState', 'ACTIVE')),
   UTC_TIMESTAMP(6)),
  ('44444444-4444-4444-8444-444444444444', 'NOTIFICATION', 'notification-local-fixture', 1,
   JSON_OBJECT('tenantId', 'local-admin-fixture', 'ownerSubjectId', 'local-fixture',
     'version', '1', 'status', 'READY',
     'safeFields', JSON_OBJECT('channel', 'IN_APP', 'deliveryState', 'READY', 'locale', 'zh-CN')),
   UTC_TIMESTAMP(6)),
  ('55555555-5555-4555-8555-555555555555', 'MEDIA', 'b3-audio-3401', 1,
   JSON_OBJECT('tenantId', 'local-admin-fixture', 'ownerSubjectId', 'local-fixture',
     'version', '1', 'status', 'ACTIVE',
     'safeFields', JSON_OBJECT('kind', 'AUDIO', 'rightsState', 'ACTIVE', 'rendition', 'LOW')),
   UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  projection_version = VALUES(projection_version), redacted_payload = VALUES(redacted_payload),
  updated_at = VALUES(updated_at);

INSERT INTO admin_ops_service.support_ticket
  (ticket_id, tenant_id, requester_subject, ticket_status, priority, redacted_summary,
   created_at, updated_at, category, resource_ref, description_fingerprint, sla_due_at,
   assignee_subject, last_audit_id, ticket_version, attachments_json)
VALUES
  ('ticket-local-001', 'local-support-fixture', 'local-fixture', 'OPEN', 'HIGH',
   'Local fixture support ticket metadata', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'TECHNICAL',
   'learner-local-profile', SHA2('local-support-ticket-001', 256),
   DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 48 HOUR), NULL, NULL, 1, JSON_ARRAY())
ON DUPLICATE KEY UPDATE
  redacted_summary = VALUES(redacted_summary), category = VALUES(category),
  resource_ref = VALUES(resource_ref), description_fingerprint = VALUES(description_fingerprint),
  sla_due_at = VALUES(sla_due_at), attachments_json = VALUES(attachments_json);

-- Synthetic analytics belong to a separate tenant and must never appear as platform KPIs.
INSERT INTO analytics_service.analytics_event_receipt
  (tenant_id, event_id, event_name, schema_version, dedupe_key, payload_hash, metric_version,
   receipt_state, reason_code, received_at)
VALUES
  ('local-analytics-fixture', 'analytics-fixture-assessed-001', 'assessment.attempt.assessed.v1', '1',
   'analytics-fixture-dedupe-001', SHA2('analytics-fixture-assessed-001', 256), 'learning.v1',
   'ACCEPTED', NULL, UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  payload_hash = VALUES(payload_hash), receipt_state = VALUES(receipt_state), received_at = VALUES(received_at);

INSERT INTO analytics_service.analytics_event_journal
  (tenant_id, event_id, event_name, schema_version, dedupe_key, payload_hash, occurred_at,
   sanitized_payload_json)
VALUES
  ('local-analytics-fixture', 'analytics-fixture-assessed-001', 'assessment.attempt.assessed.v1', '1',
   'analytics-fixture-dedupe-001', SHA2('analytics-fixture-assessed-001', 256), UTC_TIMESTAMP(6),
   JSON_OBJECT('tenantId', 'local-analytics-fixture', 'principalId', 'local-fixture',
     'attemptId', 'local-attempt-001', 'sessionId', 'local-session-001',
     'contentVersionId', 25001, 'contentSnapshotId', 25001, 'attemptVersion', 1,
     'assessmentVersion', 1, 'scoreBucket', 'FULL', 'masterySignal', 'STABLE',
     'mistakeCodes', JSON_ARRAY('NONE'),
     'assessedAt', DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.000Z')))
ON DUPLICATE KEY UPDATE
  payload_hash = VALUES(payload_hash), occurred_at = VALUES(occurred_at),
  sanitized_payload_json = VALUES(sanitized_payload_json);

INSERT INTO analytics_service.analytics_metric_projection
  (tenant_id, metric_id, metric_version, period_start, dimension_key, projection_state,
   event_count, total_value, last_occurred_at, source_watermark, projection_version,
   error_code, updated_at)
VALUES
  ('local-analytics-fixture', 'assessment_attempt', 'learning.v1', UTC_DATE(), 'scoreBucket:FULL', 'READY', 3, 3,
   UTC_TIMESTAMP(6), SHA2('analytics-assessment-watermark', 256), 1, NULL, UTC_TIMESTAMP(6)),
  ('local-analytics-fixture', 'learning_mastery_projection', 'learning.v1', UTC_DATE(), 'projectionStatus:APPLIED', 'READY', 2, 0,
   UTC_TIMESTAMP(6), SHA2('analytics-mastery-watermark', 256), 1, NULL, UTC_TIMESTAMP(6)),
  ('local-analytics-fixture', 'learning_review_queue', 'learning.v1', UTC_DATE(), 'state:REVIEW_QUEUE', 'READY', 1, 0,
   UTC_TIMESTAMP(6), SHA2('analytics-review-watermark', 256), 1, NULL, UTC_TIMESTAMP(6)),
  ('local-analytics-fixture', 'workflow.saga.started', 'workflow.v1', UTC_DATE(), 'currentStep:LEARNING_PROJECT', 'READY', 1, 0,
   UTC_TIMESTAMP(6), SHA2('analytics-workflow-watermark', 256), 1, NULL, UTC_TIMESTAMP(6)),
  ('local-analytics-fixture', 'growth_ledger', 'growth.v1', UTC_DATE(), 'ledgerKind:SCORE', 'READY', 1, 45,
   UTC_TIMESTAMP(6), SHA2('analytics-growth-watermark', 256), 1, NULL, UTC_TIMESTAMP(6)),
  ('local-analytics-fixture', 'leaderboard_projection', 'social.v1', UTC_DATE(), 'kind:FOCUS_MINUTES', 'READY', 1, 20,
   UTC_TIMESTAMP(6), SHA2('analytics-social-watermark', 256), 1, NULL, UTC_TIMESTAMP(6)),
  ('local-analytics-fixture', 'notification', 'notification.v1', UTC_DATE(), 'channel:IN_APP', 'READY', 1, 0,
   UTC_TIMESTAMP(6), SHA2('analytics-notification-watermark', 256), 1, NULL, UTC_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  projection_state = VALUES(projection_state), event_count = VALUES(event_count),
  total_value = VALUES(total_value), last_occurred_at = VALUES(last_occurred_at),
  source_watermark = VALUES(source_watermark), projection_version = VALUES(projection_version),
  error_code = VALUES(error_code), updated_at = VALUES(updated_at);

SELECT
  (SELECT COUNT(*) FROM admin_ops_service.admin_projection),
  (SELECT COUNT(*) FROM admin_ops_service.support_ticket),
  (SELECT COUNT(*) FROM analytics_service.analytics_event_receipt),
  (SELECT COUNT(*) FROM analytics_service.analytics_event_journal),
  (SELECT COUNT(*) FROM analytics_service.analytics_metric_projection);
`;

const analyticsSql = sql.slice(sql.indexOf('INSERT INTO analytics_service.analytics_event_receipt'));
const quarantinedRows = (analyticsSql.match(/\('local-analytics-fixture',/g) || []).length;
if (quarantinedRows !== 9 || analyticsSql.includes("('platform',")) {
  throw new Error('Synthetic analytics would leak into the platform tenant');
}
if (process.argv.includes('--static-only')) {
  console.log(JSON.stringify({ analyticsFixtureTenant: 'local-analytics-fixture',
    quarantinedRows, writesDatabase: false }));
  process.exit(0);
}
assertLocalDatabaseTarget();

const output = runMysql({
  mysqlBin,
  mysqlArgs: args,
  password,
  cwd: process.cwd(),
  input: `${sql.trim()}\n`,
});
const counts = output.split(/\r?\n/).filter(Boolean).at(-1)?.split('\t').map(Number) ?? [];
if (counts.length !== 5 || counts.some((value) => !Number.isFinite(value) || value < 1)) {
  throw new Error(`admin/analytics fixture was not persisted: ${counts.join(',')}`);
}
console.log(`local admin/analytics fixture ready: ${counts[0]} projection(s), ${counts[1]} support ticket(s), ${counts[2]} analytics receipt(s), ${counts[3]} journal event(s), ${counts[4]} metric projection(s)`);
