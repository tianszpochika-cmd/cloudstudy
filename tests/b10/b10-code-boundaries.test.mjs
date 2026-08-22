import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function filesUnder(relativeDirectory, predicate = () => true) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  const result = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name === '.nuxt' || entry.name === '.output' || entry.name.startsWith('.compile-check')) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (predicate(absolute)) result.push(absolute);
    }
  };
  visit(directory);
  return result;
}

function textUnder(relativeDirectory) {
  return filesUnder(relativeDirectory, (file) => /\.(java|json|sql|ts|vue|mjs|yaml|yml|md)$/.test(file))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

test('B10 learning and assessment are independent Java 25 owner services', () => {
  for (const service of ['services/learning-service', 'services/assessment-service']) {
    const pomPath = path.join(root, service, 'pom.xml');
    assert.ok(fs.existsSync(pomPath), `${service} must have an independent Maven build`);
    const pom = fs.readFileSync(pomPath, 'utf8');
    assert.match(pom, /<java\.version>25<\/java\.version>/);
    assert.match(pom, /spring-boot-starter-actuator/);
    assert.match(pom, /spring-boot-starter-validation/);
  }
  const learning = textUnder('services/learning-service');
  const assessment = textUnder('services/assessment-service');
  for (const marker of ['learning plan', 'SRS', 'mastery', 'review', 'timezone', 'idempot']) {
    assert.match(learning, new RegExp(marker, 'i'), `learning-service must expose ${marker}`);
  }
  for (const marker of ['session', 'attempt', 'checkpoint', 'score', 'mistake', 'report', 'ContentSnapshotPort']) {
    assert.match(assessment, new RegExp(marker, 'i'), `assessment-service must expose ${marker}`);
  }
  assert.match(assessment, /answer.?rule|raw answer|SafePayload/i);
});

test('B10 assessment-to-learning source boundary is event/port based', () => {
  const learning = textUnder('services/learning-service');
  const assessment = textUnder('services/assessment-service');
  assert.match(assessment, /ContentSnapshotPort/);
  assert.match(assessment, /AssessmentOutboxPort|OutboxPort/);
  assert.match(learning, /AssessmentLearningEvent|applyAssessment|mastery/i);
  assert.match(learning, /LearningOutboxEvent|appendOutbox|outbox/i);
  assert.doesNotMatch(learning, /assessment[_-]service.*(?:SELECT|UPDATE|INSERT)/is);
  assert.doesNotMatch(assessment, /learning[_-]service.*(?:SELECT|UPDATE|INSERT)/is);
});

test('B10 learning clients use Gateway paths, safe feedback and shared locale/theme seams', () => {
  for (const app of ['apps/learner-web', 'apps/mobile']) {
    const source = textUnder(app);
    assert.match(source, /b10|learning\/review|assessment\/sessions/i, `${app} must use B10 entry seams`);
    assert.match(source, /Idempotency-Key|idempotency/i, `${app} must make writes replay-safe`);
    assert.match(source, /uiLocale/i, `${app} must send UI locale separately`);
    assert.match(source, /contentLocale/i, `${app} must send content locale separately`);
    assert.match(source, /offline|stale|recover|forbidden/i, `${app} must represent recoverable states`);
    assert.match(source, /theme|performance|degrad/i, `${app} must keep theme/performance boundaries`);
    assert.doesNotMatch(source, /answerRule(?:s)?\s*[:=]\s*[{\[]/i, `${app} must not hold answer rules`);
  }
});

test('B10 migration and compatibility fixture are additive and replay-safe', () => {
  const adapter = path.join(root, 'services/core-api/src/main/java/com/englishflow/modules/learning/b10/B10CompatibilityAdapter.java');
  const smoke = path.join(root, 'services/core-api/src/test/java/com/englishflow/modules/learning/b10/B10CompatibilityAdapterSmoke.java');
  assert.ok(fs.existsSync(adapter));
  assert.ok(fs.existsSync(smoke));
  const adapterSource = fs.readFileSync(adapter, 'utf8');
  assert.match(adapterSource, /LEGACY_READ|SHADOW_READ|TARGET_READ|FALLBACK_READ/);
  assert.match(adapterSource, /B10_ROUTE_CONFIG_VERSION_CONFLICT|B10_TARGET_CUTOVER_NOT_SAFE/);
  assert.match(adapterSource, /domainFactsMutated/);

  const migration = path.join(root, 'database/mysql/migrations/V0018__create_learning_assessment_event_reliability_b10.sql');
  assert.ok(fs.existsSync(migration));
  const sql = fs.readFileSync(migration, 'utf8');
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/gi);
  assert.match(sql, /outbox|dlq|saga|dedupe|replay/i);
  assert.match(sql, /tenant_id/i);
  assert.doesNotMatch(sql, /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE/i);
  const fixture = path.join(root, 'tests/b10/fixtures/b10-learning-assessment.fixture.json');
  const value = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  assert.ok(value.events || value.eventFlow || value.scenarios || value.attemptToLearningChain);
  assert.match(JSON.stringify(value), /dedupe|DLQ|replay|compens|rollback/i);
});
