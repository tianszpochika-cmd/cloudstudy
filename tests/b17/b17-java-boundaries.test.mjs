import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const integration = read('services/service-template/src/main/java/com/englishflow/platform/template/b17/integration/LearningReadChain.java');
const writeChain = read('services/service-template/src/main/java/com/englishflow/platform/template/b17/integration/AssessmentLearningWriteChain.java');
const reliableEvent = read('services/service-template/src/main/java/com/englishflow/platform/template/b17/reliability/ReliableEvent.java');
const outbox = read('services/service-template/src/main/java/com/englishflow/platform/template/b17/reliability/InMemoryOutboxStore.java');
const ledger = read('services/service-template/src/main/java/com/englishflow/platform/template/b17/reliability/EventDeliveryLedger.java');
const saga = read('services/service-template/src/main/java/com/englishflow/platform/template/b17/reliability/SagaCoordinator.java');
const learnerPort = read('services/learner-service/src/main/java/com/englishflow/learner/integration/LearnerReadProjectionPort.java');
const contentPort = read('services/content-service/src/main/java/com/englishflow/content/integration/PublishedContentReadProjectionPort.java');
const learningPort = read('services/learning-service/src/main/java/com/englishflow/learning/integration/AssessmentMasteryProjectionPort.java');
const assessmentPort = read('services/assessment-service/src/main/java/com/englishflow/assessment/integration/AssessmentChainPort.java');

test('B17 read chain is explicit about ownership, content version and rights', () => {
  assert.match(integration, /LearnerSource/);
  assert.match(integration, /ContentSource/);
  assert.match(integration, /LearningSource/);
  assert.match(integration, /CONTENT_RIGHTS_REVOKED/);
  assert.match(integration, /CONTENT_VERSION_STALE/);
  assert.match(integration, /LEARNING_CONTENT_VERSION_MISMATCH/);
  assert.match(integration, /tenantId\(\)/);
  assert.doesNotMatch(integration, /JdbcTemplate|EntityManager|shared.*table|core-api.*write/i);
});

test('B17 domain services expose ports instead of shared tables or cross-owner repositories', () => {
  assert.match(learnerPort, /findBySubject/);
  assert.match(contentPort, /findPublished/);
  assert.match(learningPort, /only owner allowed to apply assessment evidence/);
  assert.match(assessmentPort, /answerDigest/);
  assert.doesNotMatch(assessmentPort, /score\s*,|correctAnswer|answerKey/i);
  for (const source of [learnerPort, contentPort, learningPort, assessmentPort]) {
    assert.doesNotMatch(source, /JdbcTemplate|EntityManager|shared.*table|core-api.*write/i);
  }
});

test('B17 write chain has server-side scoring and canonical assessment/mastery events', () => {
  assert.match(writeChain, /ServerScorer/);
  assert.match(writeChain, /AssessmentOutcome/);
  assert.match(writeChain, /assessment\.attempt\.submitted\.v1/);
  assert.match(writeChain, /assessment\.attempt\.assessed\.v1/);
  assert.match(writeChain, /learning\.mastery\.projected\.v1/);
  assert.match(writeChain, /idempotencyKey/);
  assert.doesNotMatch(writeChain, /clientScore|correctAnswer|rawAnswer|expectedAnswer/i);
});

test('B17 event envelope and outbox are safe, bounded and retryable', () => {
  for (const field of ['eventId', 'traceId', 'schemaVersion', 'aggregateId', 'idempotencyKey']) {
    assert.match(reliableEvent, new RegExp(field));
  }
  assert.match(reliableEvent, /FORBIDDEN/);
  assert.match(outbox, /maxEntries/);
  assert.match(outbox, /maxAttempts/);
  assert.match(outbox, /retryOrDlq/);
  assert.match(outbox, /replay/);
  assert.doesNotMatch(outbox, /two.phase|2PC|Kafka.*RPC|shared.*table/i);
});

test('B17 consumer and Saga boundaries deduplicate, preserve order and compensate by intent', () => {
  assert.match(ledger, /DUPLICATE/);
  assert.match(ledger, /BUFFERED/);
  assert.match(ledger, /aggregateSequence/);
  assert.match(saga, /CommandPort/);
  assert.match(saga, /CompensationPort/);
  assert.match(saga, /COMPENSATION_REQUIRED/);
  assert.doesNotMatch(saga, /JdbcTemplate|EntityManager|\bRepository\b|DELETE FROM|UPDATE .*_service/i);
});
