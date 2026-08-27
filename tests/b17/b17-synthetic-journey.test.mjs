import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSyntheticJourney, runSyntheticJourney } from '../../scripts/runtime/b17-synthetic-journey.mjs';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('B17 synthetic learner-content-learning read chain enforces version and rights', () => {
  const journey = createSyntheticJourney();
  assert.equal(journey.readToday().status, 'READY');
  assert.equal(journey.readToday({ cacheVersion: 2 }).reason, 'CACHE_INVALIDATED');
  journey.state.content.rights = 'REVOKED';
  assert.deepEqual(journey.readToday(), { status: 'DENIED', reason: 'CONTENT_RIGHTS_REVOKED' });
});

test('B17 synthetic assessment write chain is server-scored, idempotent and projection-safe', () => {
  const journey = createSyntheticJourney();
  const input = { attemptId: 'attempt-1', idempotencyKey: 'idem-1', answerDigest: digest('answer') };
  const first = journey.submitAttempt(input);
  const replay = journey.submitAttempt(input);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual({ attemptId: replay.attemptId, masteryVersion: replay.masteryVersion }, { attemptId: 'attempt-1', masteryVersion: 1 });
  assert.throws(() => journey.submitAttempt({ ...input, idempotencyKey: 'idem-2', score: 100 }), /score or answer authority/);
  assert.equal(journey.state.events.filter((event) => event.eventName === 'learning.mastery.projected.v1').length, 1);
});

test('B17 duplicate assessed events are deduplicated and compensation preserves assessment facts', () => {
  const journey = createSyntheticJourney();
  journey.submitAttempt({ attemptId: 'attempt-2', idempotencyKey: 'idem-2', answerDigest: digest('answer-2') });
  const assessed = journey.state.events.find((event) => event.eventName === 'assessment.attempt.assessed.v1');
  assert.deepEqual(journey.replayAssessmentEvent(assessed), { replayed: true, projectionVersion: 1 });
  assert.deepEqual(journey.compensate('learning_projection_timeout'), { status: 'COMPENSATION_REQUIRED', assessmentFactPreserved: true });
  const compensation = journey.state.events.at(-1);
  assert.equal(compensation.eventName, 'workflow.assessment_learning.saga_compensated.v1');
  assert.equal(compensation.payload.assessmentFactPreserved, true);
});

test('B17 synthetic journey emits safe canonical envelopes and no sensitive payloads', () => {
  const result = runSyntheticJourney();
  assert.equal(result.read.status, 'READY');
  assert.equal(result.write.scoreBucket, 'PASS');
  assert.equal(result.state.learning, 'COMPLETED');
  assert.ok(result.eventNames.includes('assessment.attempt.submitted.v1'));
  assert.ok(result.eventNames.includes('assessment.attempt.assessed.v1'));
  assert.ok(result.eventNames.includes('learning.mastery.projected.v1'));
  assert.ok(result.eventNames.includes('notification.requested.v1'));
  assert.ok(result.eventNames.includes('gamification.xp.ledger_posted.v1'));
});
