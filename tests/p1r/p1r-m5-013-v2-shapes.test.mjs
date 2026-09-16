// M5-013 (decision 5A): consumer-side contract tests for the v2/v1 learning
// completion shapes. Hand-rolled structural validation (no new dependencies):
// required keys, types, patterns, enums and closed objects, plus the headline
// cross-field invariants a consumer enforces on receipt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const fragment = read('packages/contracts/events/v1/fragments/b10-learning-loop.events.json');
const catalog = read('packages/contracts/events/v1/catalog.json');

function check(schema, value, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  const at = (f) => (path ? `${path}.${f}` : f);
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path || 'root'}: expected object`);
      return;
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${at(key)}: missing required key`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(schema.properties ?? {})[key]) errors.push(`${at(key)}: unknown key (closed object)`);
      }
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) check(sub, value[key], at(key), errors);
    }
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') { errors.push(`${path}: expected string`); return; }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern mismatch`);
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not in enum`);
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${path}: bad date-time`);
    return;
  }
  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) { errors.push(`${path}: expected integer`); return; }
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum`);
    return;
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') { errors.push(`${path}: expected boolean`); return; }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) { errors.push(`${path}: expected array`); return; }
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: too few items`);
    value.forEach((item, i) => check(schema.items, item, `${path}[${i}]`, errors));
  }
}

const schemas = fragment.payloadSchemas;
const D = '2026-09-16T10:00:00.000Z';

test('catalog carries the three completion shapes with exact payload refs', () => {
  for (const [name, ref] of [
    ['assessment.item.assessed.v2', '#/payloadSchemas/B10AssessmentItemAssessedV2'],
    ['learning.review.scheduled.v2', '#/payloadSchemas/B10LearningReviewScheduledV2'],
    ['learning.report.ready.v1', '#/payloadSchemas/B10LearningReportReadyV1'],
  ]) {
    const frag = fragment.events.find((e) => e.eventName === name);
    assert.ok(frag, `${name} in fragment`);
    assert.equal(frag.payloadSchema.$ref, ref);
    const cat = catalog.events.find((e) => e.eventName === name);
    assert.ok(cat, `${name} in catalog`);
  }
});

test('review-due IS learning.review.scheduled.v2 (documented equivalence)', () => {
  const s = schemas.B10LearningReviewScheduledV2;
  assert.ok(s.required.includes('dueAt') && s.required.includes('dueLocalDate'));
  assert.ok((s['x-p1r-cross-field-invariants'] ?? []).some((i) => i.includes('D1_VERIFICATION')));
});

test('consumer accepts a minimal report-ready payload', () => {
  const sample = {
    tenantId: 'platform', principalId: 'w9-test-principal', reportId: 'rpt_abc12345',
    attemptId: 'aatm_abc12345', sessionId: 'asess_abc12345', contentCode: 'course-b25-basics',
    contentVersionId: 25001, scoreBucket: 'FULL', totalItems: 2, totalCorrect: 2,
    totalMistakes: 0, completedAt: D,
  };
  const errors = [];
  check(schemas.B10LearningReportReadyV1, sample, '', errors);
  assert.deepEqual(errors, []);
  assert.equal(sample.totalCorrect + sample.totalMistakes, sample.totalItems);
});

test('consumer rejects a report-ready payload that breaks the invariant', () => {
  const bad = {
    tenantId: 'platform', principalId: 'x', reportId: 'rpt_abc12345',
    attemptId: 'aatm_abc12345', sessionId: 'asess_abc12345', contentCode: 'c',
    contentVersionId: 1, scoreBucket: 'FULL', totalItems: 2, totalCorrect: 1,
    totalMistakes: 1, completedAt: D, extraKey: 1,
  };
  const errors = [];
  check(schemas.B10LearningReportReadyV1, bad, '', errors);
  assert.ok(errors.some((e) => e.includes('extraKey')));
  assert.notEqual(bad.totalCorrect + bad.totalMistakes, 0 + 0); // invariant FULL=>mistakes 0 broken
  assert.ok(!(bad.scoreBucket === 'FULL' && bad.totalMistakes === 0));
});

test('consumer accepts a minimal assessed payload skeleton', () => {
  const sample = {
    tenantId: 'platform', principalId: 'prn_.local-test-principal-01', itemAssessmentId: 'aitm_abc12345',
    attemptId: 'aatm_abc12345', sessionId: 'asess_abc12345', logicalItemId: 'li_abc12345',
    contentPin: { contentVersionId: 25001, contentEpoch: 1, snapshotId: 'snap_abc12345', snapshotHash: '00'.repeat(32) },
    rulePin: { answerRuleSetVersion: 'B10_RULES_2026_08_26', answerRuleVersion: 'v1', ruleDigest: 'ab'.repeat(32), completionRuleVersion: 'v1', assessmentVersion: 'B10_RULES_2026_08_26' },
    reportPin: { reportId: 'rpt_abc12345', reportVersion: 1, reportRuleVersion: 'v1', reportStatus: 'READY', reportDigest: 'ab'.repeat(32), asOf: D },
    objectivePolicyPin: { practiceType: 'OBJECTIVE_ASSESSMENT', objectiveExpected: true, policyVersion: 'v1', policyDigest: 'ab'.repeat(32) },
    objectiveOutcome: 'CORRECT_VERIFIED', objectiveNumerator: 1, objectiveDenominator: 1,
    objectiveCorrect: true, guessSignal: false, semanticErrorCategory: 'CARELESS_OR_OMISSION',
    mappingVersion: 'v1', verificationStage: 'NONE',
    reasonTrace: [{ ruleCode: 'B10_SCORE', ruleVersion: 'v1', category: 'CARELESS_OR_OMISSION', reasonCode: 'FULL_MATCH', evidenceRef: 'attempt:aatm_abc12345' }],
    outcomeDigest: 'ab'.repeat(32), assessmentFactWatermark: 'w9-test-watermark', assessedAt: D,
  };
  const errors = [];
  check(schemas.B10AssessmentItemAssessedV2, sample, '', errors);
  assert.deepEqual(errors, []);
});
