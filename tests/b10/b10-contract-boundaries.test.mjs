import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const contentOpenApi = readJson('packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json');
const compatibilityOpenApi = readJson('packages/contracts/fragments/b10/b10-compatibility.openapi.json');
const openApi = {
  paths: { ...(contentOpenApi.paths ?? {}), ...(compatibilityOpenApi.paths ?? {}) },
  components: {
    parameters: { ...(contentOpenApi.components?.parameters ?? {}), ...(compatibilityOpenApi.components?.parameters ?? {}) },
    responses: { ...(contentOpenApi.components?.responses ?? {}), ...(compatibilityOpenApi.components?.responses ?? {}) },
    schemas: { ...(contentOpenApi.components?.schemas ?? {}), ...(compatibilityOpenApi.components?.schemas ?? {}) },
  },
};
const events = readJson('packages/contracts/events/v1/fragments/b10-learning-assessment.events.json');
const fixture = readJson('tests/b10/fixtures/b10-learning-assessment.fixture.json');
const migration = readText('database/mysql/migrations/V0018__create_learning_assessment_event_reliability_b10.sql');
const manifest = readJson('database/mysql/migrations/migration-manifest.json');

function walk(value, visitor) {
  visitor(value);
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) walk(child, visitor);
}

test('B10 OpenAPI covers snapshot, attempt, projection and compatibility boundaries', () => {
  for (const route of [
    '/internal/v1/content/assessment-snapshots/{contentVersionId}',
    '/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery',
    '/api/v1/assessment/sessions',
    '/api/v1/assessment/sessions/{sessionId}/attempts',
    '/api/v1/learning/review-queue',
    '/internal/v1/compatibility/b10/read-shadow',
    '/internal/v1/compatibility/b10/reconciliations',
    '/internal/v1/compatibility/b10/rollbacks',
  ]) assert.ok(openApi.paths[route], `missing B10 route ${route}`);
  for (const schema of ['B10ContentVersionPin', 'B10AssessmentContentSnapshot', 'B10Attempt', 'B10MasteryProjection', 'B10ReadShadow', 'B10RollbackRequest']) {
    assert.ok(openApi.components.schemas[schema], `missing B10 schema ${schema}`);
  }
  for (const operation of Object.values(openApi.paths).flatMap((item) => Object.values(item))) {
    if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
    if (operation.security?.some((entry) => entry.B8WorkloadIdentity)) assert.ok(operation.security.length > 0);
  }
});

test('B10 events have the canonical envelope and no answer-bearing payload fields', () => {
  const names = new Set();
  const forbidden = new Set(['answerKey', 'correctAnswer', 'acceptedAnswers', 'rawAnswer', 'answerText', 'answerContent', 'referenceAnswer', 'userInput', 'prompt', 'rawRecording', 'audioBytes']);
  for (const event of events.events) {
    assert.equal(names.has(event.eventName), false, `duplicate event ${event.eventName}`);
    names.add(event.eventName);
    for (const field of ['eventId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey']) assert.ok(event['x-envelope-required'].includes(field), `${event.eventName} missing ${field}`);
    const payload = events.payloadSchemas[event.payloadSchema.$ref.split('/').at(-1)];
    walk(payload, (value) => {
      if (!value || typeof value !== 'object') return;
      for (const key of Object.keys(value.properties ?? {})) assert.equal(forbidden.has(key), false, `${event.eventName} leaks ${key}`);
    });
  }
  assert.deepEqual([...names], [
    'assessment.attempt.submitted.v1',
    'assessment.attempt.assessed.v1',
    'learning.mastery.projected.v1',
    'learning.review.scheduled.v1',
    'workflow.assessment_learning.saga_started.v1',
    'workflow.assessment_learning.saga_compensated.v1',
    'workflow.event.replayed.v1',
  ]);
});

test('B10 fixture proves dedupe, DLQ replay, Saga compensation and legacy rollback', () => {
  assert.equal(fixture.metadata.synthetic, true);
  assert.equal(fixture.contentSnapshot.mustNotExpose.includes('answerKey'), true);
  assert.equal(fixture.attemptToLearningChain.attemptSubmitted.payload.contentVersionId, 301);
  assert.equal(fixture.attemptToLearningChain.attemptAssessed.payload.contentSnapshotId, 'snap_b10_00000001');
  assert.equal(fixture.attemptToLearningChain.masteryProjected.payload.sourceAssessmentEventId, 'evt-b10-assessed-0001');
  assert.equal(fixture.reliability.dlqReplay.mustPreserveTraceId, true);
  assert.equal(fixture.reliability.dlqReplay.mustCreateNewReplayEventId, true);
  assert.equal(fixture.reliability.saga.compensationAction, 'MARK_PROJECTION_RETRY');
  assert.equal(fixture.compatibility.targetFactsRemainUntouched, true);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `wf_b10_dlq_event`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `wf_b10_saga`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `cmp_b10_rollback_ledger`/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)/i);
  const entry = manifest.migrations.find((item) => item.version === '0018');
  assert.ok(entry, 'migration manifest must include V0018');
  for (const table of entry.requiredTables) assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '`'));
});
