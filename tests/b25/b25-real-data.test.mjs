import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

test('B25 canonical fixture is synthetic, safe and owner-scoped', () => {
  const config = json('config/b25-data.json');
  const fixture = json('database/mysql/fixtures/b25-phase1.json');

  assert.equal(config.batch, 'B25');
  assert.equal(config.phase, 'phase-1');
  assert.equal(config.mode, 'static-and-synthetic');
  assert.equal(config.runtimeStatus, 'pending');
  assert.equal(config.fixture.synthetic, true);
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.seedRunId, config.fixture.seedRunId);
  assert.equal(fixture.entities.length, config.expectedRows.b25_fixture_row);
  assert.equal(fixture.redisProjections.length, config.expectedRows.b25_fixture_redis_projection);
  assert.equal(config.dataOwnerPolicy.ownerMap.length, 8);

  const forbidden = /(?:password|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|private[_-]?key|phone|email)/i;
  assert.doesNotMatch(JSON.stringify(fixture), forbidden);
  assert.equal(fixture.policy.mysqlIsSourceOfTruth, true);
  assert.equal(fixture.policy.redisIsRebuildableProjection, true);
  assert.equal(fixture.policy.paymentProviderCalls, 'disabled');
  assert.ok(fixture.entities.some((entity) => entity.entityType === 'COURSE'));
  assert.ok(fixture.entities.some((entity) => entity.entityType === 'QUESTION'));
  assert.ok(fixture.entities.some((entity) => entity.entityType === 'MEDIA_REFERENCE'));
});

test('B25 root and service migrations are additive and scoped', () => {
  const manifest = json('database/mysql/migrations/migration-manifest.json');
  const entry = manifest.migrations.find((migration) => migration.version === '0023');
  assert.ok(entry);
  assert.equal(entry.file, 'V0023__create_phase1_real_data_b25.sql');
  const rootSql = read('database/mysql/migrations/V0023__create_phase1_real_data_b25.sql');
  assert.doesNotMatch(rootSql, /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE/i);
  assert.match(rootSql, /CREATE TABLE IF NOT EXISTS b25_fixture_run/i);

  const migrations = [
    'services/learner-service/src/main/resources/db/migration/V4__create_b25_learner_runtime.sql',
    'services/content-service/src/main/resources/db/migration/V4__create_b25_content_runtime.sql',
    'services/learning-service/src/main/resources/db/migration/V2__create_b25_learning_runtime.sql',
    'services/assessment-service/src/main/resources/db/migration/V3__create_b25_assessment_runtime.sql',
    'services/notification-service/src/main/resources/db/migration/V2__create_b25_notification_runtime.sql',
  ];
  for (const migration of migrations) {
    const sql = read(migration);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS/);
    assert.doesNotMatch(sql, /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE|INSERT\s+INTO\s+(learner_service|content_service|learning_service|assessment_service|notification_service)\./i);
    assert.doesNotMatch(sql, /core-api|cross-service|shared table/i);
  }
});

test('B25 HTTP seams are durable, JWT-owned and idempotent', () => {
  const controllers = [
    ['services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java', /learner\.persistence.*mode.*jdbc/s],
    ['services/content-service/src/main/java/com/englishflow/content/web/B25ContentJdbcController.java', /content\.persistence.*mode.*jdbc/s],
    ['services/learning-service/src/main/java/com/englishflow/learning/web/B25LearningJdbcController.java', /learning\.persistence.*mode.*jdbc/s],
    ['services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java', /assessment\.persistence.*enabled.*true/s],
  ];
  for (const [controller, condition] of controllers) {
    const source = read(controller);
    assert.match(source, condition);
    assert.match(source, /JdbcTemplate/);
    assert.match(source, /JwtAuthenticationToken/);
    assert.match(source, /tenant_id/);
    if (!controller.includes('B25ContentJdbcController')) assert.match(source, /Idempotency-Key/);
  }

  const content = read(controllers[1][0]);
  assert.doesNotMatch(content, /answer_rule_json/);
  const learning = read(controllers[2][0]);
  assert.match(learning, /INSERT IGNORE INTO b25_learning_review/);
  assert.match(learning, /@GetMapping\("\/mistakes\/queue"\)/);
  assert.match(learning, /FROM b3_learning_interaction/);
  assert.match(read(controllers[3][0]), /answer_rule_json/);

  const notification = read('services/notification-service/src/main/java/com/englishflow/notification/adapter/http/NotificationController.java');
  assert.match(notification, /NotificationPrincipalResolver/);
  assert.match(notification, /Idempotency-Key/);
  assert.match(read('services/notification-service/src/main/java/com/englishflow/notification/config/NotificationPersistenceConfiguration.java'), /JdbcNotificationFactStore/);
});

test('B25 seeds are replayable and do not perform destructive cleanup', () => {
  for (const seed of [
    'database/mysql/seeds/dev/V0023__b25-phase1.sql',
    'database/mysql/seeds/dev/V0023__b25-service-schemas.sql',
  ]) {
    const sql = read(seed);
    assert.match(sql, /seed-b25-phase1-v1/);
    assert.doesNotMatch(sql, /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE|DELETE\s+FROM/i);
    assert.match(sql, /ON DUPLICATE KEY UPDATE|INSERT IGNORE/i);
  }
});

test('B25 gateway preserves public paths while routing to service owners', () => {
  const gateway = read('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java');
  assert.match(gateway, /b25-learner-onboarding-target/);
  assert.match(gateway, /internal\/v1\/learner\/onboarding\/daily-tasks/);
  assert.match(gateway, /removeRequestHeader\("X-Owner-Id"\)/);
  assert.match(gateway, /registerB14TargetRoutes/);
});
