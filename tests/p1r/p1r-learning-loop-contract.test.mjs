import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import {
  catchUpDecision,
  compareDailyPlanCandidates,
  dailyPlanBudget,
  effectiveQualityForOutcome,
  readLearningLoopContractInputs,
  roundHalfUp,
  stableJsonDigest,
  transitionSm2Q03,
  validateLearningLoopContract,
  validateLearningLoopContractData,
  validateOfflineCommand,
  validateReportSnapshot,
  validateStateSeparation,
} from '../../scripts/audit/p1r-learning-loop-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const sourceInputs = readLearningLoopContractInputs({ root });
const SHA256 = 'a'.repeat(64);

function objectiveScoredContext() {
  return {
    objectivePolicyPin: {
      practiceType: 'OBJECTIVE_ASSESSMENT',
      objectiveExpected: true,
      policyVersion: 'P1_ASSESSMENT_POLICY_V1',
      policyDigest: SHA256,
    },
  };
}

function noObjectiveExpectedContext(practiceType = 'SPEAKING_SELF_RATING') {
  return {
    authority: 'SERVER_PREDECLARED_LEGAL_PRACTICE_TYPE',
    objectivePolicyPin: {
      practiceType,
      objectiveExpected: false,
      policyVersion: 'P1_ASSESSMENT_POLICY_V1',
      policyDigest: SHA256,
    },
  };
}

function processingMetrics() {
  return sourceInputs.policy.report.metricDefinitions.map(({ code }) => ({
    code, numerator: null, denominator: null, value: null, status: 'PROCESSING',
  }));
}

function readyMetrics() {
  return sourceInputs.policy.report.metricDefinitions.map((definition) => (definition.denominator === null
    ? { code: definition.code, numerator: 1, denominator: null, value: 1, status: 'READY' }
    : { code: definition.code, numerator: 1, denominator: 2, value: 50, status: 'READY' }));
}

function reportSnapshot(status = 'PROCESSING') {
  const processing = status === 'PROCESSING';
  return {
    reportId: 'report-1', reportVersion: 1, reportRuleVersion: 'P1_REPORT_V1', asOf: '2026-10-01T00:00:00Z',
    window: { startInclusive: '2026-10-01T00:00:00Z', endExclusive: '2026-10-02T00:00:00Z' },
    sourceWatermarks: processing ? null : { 'learning-service': '42', 'assessment-service': '17' },
    sourceWatermarkDigest: processing ? null : SHA256,
    inputVersions: {}, metricDefinitionsVersion: 'P1_REPORT_V1', sourceFactDigest: SHA256,
    status, metrics: processing ? processingMetrics() : readyMetrics(),
  };
}

function fixture() {
  return structuredClone(sourceInputs);
}

function validateFixture(input) {
  return validateLearningLoopContractData({
    ...input,
    // Mutation tests intentionally retain all semantic checks while freezing the
    // mutated synthetic candidate; repository validation uses the hard-coded SHA.
    frozenPolicyDigest: stableJsonDigest(input.policy),
  });
}

function firstDayVariant(input, state) {
  const projection = input.b9FirstDayOpenApi.components.schemas.B9FirstDayProjection;
  return projection.allOf.flatMap((part) => part.oneOf ?? []).find((variant) => variant.properties?.state?.const === state);
}

function reject(name, mutate, pattern) {
  test(`learning-loop fail-closed: ${name}`, () => {
    const input = fixture();
    mutate(input);
    const report = validateFixture(input);
    assert.equal(report.result, 'FAIL', `${name} unexpectedly passed`);
    if (pattern) assert.match(report.errors.join('\n'), pattern);
  });
}

test('repository learning-loop policy remains a frozen static D2 boundary', () => {
  const report = validateLearningLoopContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.summary, {
    taskId: 'P1R-M1-013',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    staticContractOnly: true,
    sourceBaseline: 'a07a58a7d245295c54d39487a6669545d077c513',
    promotionScope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
    approvedCanonicalEvents: 3,
    deferredEventCandidates: 6,
    adversarialCases: 50,
  });
});

test('checker CLI emits machine-readable frozen-policy result', () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-learning-loop-contract-check.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'PASS');
  assert.equal(report.summary.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
});

reject('unknown root key is denied', (input) => {
  input.policy.unapprovedRuntimeClaim = true;
}, /policy keys/);

reject('source baseline cannot drift', (input) => {
  input.policy.sourceBaseline = '0000000000000000000000000000000000000000';
}, /source baseline/);

reject('runtime promotion is denied', (input) => {
  input.policy.runtimeStatus = 'RUNTIME_VERIFIED';
}, /runtime status/);

reject('compatibility scope cannot narrow or broaden away from static D2 promotion', (input) => {
  input.policy.compatibilityPromotion.scope = 'RUNTIME_EVENT_EXECUTION';
}, /compatibility promotion/);

reject('B26 static manifest cannot be promoted to runtime', (input) => {
  input.b26Runtime.runtimeStatus = 'ready';
}, /B26 runtime status/);

reject('first-day READY cannot claim readiness with zero taskCount', (input) => {
  firstDayVariant(input, 'READY').properties.taskCount.minimum = 0;
}, /first-day READY taskCount lower bound/);

reject('first-day READY cannot claim readiness with an empty tasks array', (input) => {
  firstDayVariant(input, 'READY').properties.tasks.minItems = 0;
}, /first-day READY tasks minItems lower bound/);

reject('first-day DEGRADED reason field cannot drift', (input) => {
  const degraded = firstDayVariant(input, 'DEGRADED');
  degraded.required = degraded.required.map((field) => field === 'degradedReason' ? 'degradedReasonCode' : field);
  degraded.properties.degradedReasonCode = degraded.properties.degradedReason;
  delete degraded.properties.degradedReason;
}, /frozen degradedReason field/);

reject('first-day policy cannot rename degradedReason', (input) => {
  input.policy.firstDayProjection.degraded.reasonField = 'degradedReasonCode';
}, /first-day projection policy/);

reject('B26 cannot route a future event before exact promotion', (input) => {
  input.b26Runtime.eventRouting.push({
    eventName: 'learning.srs.state.changed.v2',
    topic: 'platform.learning.v1',
    partitionKey: 'aggregateId',
    consumerGroups: ['cg.notification-from-learning.v1'],
  });
}, /must not receive B26 routing/);

reject('catalog cannot silently promote a recommended future event', (input) => {
  input.catalog.events.push({ eventName: 'learning.srs.state.changed.v2', status: 'CANONICAL_D2' });
}, /must not be silently promoted/);

reject('historical assessment event cannot be relabelled canonical in rule-only track', (input) => {
  input.catalog.events.find((event) => event.eventName === 'assessment.attempt.assessed.v1').status = 'CANONICAL_D2';
}, /historical event assessment\.attempt\.assessed\.v1 must not be promoted/);

reject('approved canonical event policy cannot self-authorize an unknown payload', (input) => {
  input.policy.compatibilityPromotion.approvedCanonicalEvents[0].payloadRef = '#/payloadSchemas/UnapprovedPayload';
}, /approved canonical events/);

reject('approved canonical event B26 topic cannot drift', (input) => {
  input.b26Runtime.eventRouting.find((route) => route.eventName === 'learning.review.scheduled.v2').topic = 'platform.unapproved.v1';
}, /learning\.review\.scheduled\.v2 B26 topic/);

reject('approved canonical event catalog aggregate cannot drift', (input) => {
  input.catalog.events.find((event) => event.eventName === 'assessment.item.assessed.v2').aggregateIdField = 'attemptId';
}, /assessment\.item\.assessed\.v2 catalog aggregate id field/);

reject('M1-014 current source cannot self-authorize an extra consumer', (input) => {
  input.m1014CurrentSourcePolicy.compatibilityPromotion.approvedCanonicalEvents
    .find((event) => event.eventName === 'assessment.item.assessed.v2')
    .consumers.push({ service: 'notification-service', consumerGroup: 'cg.notification-from-assessment.v1' });
}, /M1-014 current-source policy digest/);

reject('M1-014 current-source revalidation cannot claim runtime verification', (input) => {
  input.m1014CurrentSourcePolicy.runtimeStatus = 'RUNTIME_VERIFIED';
}, /M1-014 current-source runtime status/);

reject('M1-014 current-source revalidation rejects an extra assessment consumer', (input) => {
  input.catalog.events.find((event) => event.eventName === 'assessment.item.assessed.v2')
    ['x-p1r-governance'].consumers.push({
      service: 'notification-service',
      consumerGroup: 'cg.notification-from-assessment.v1',
    });
}, /assessment\.item\.assessed\.v2 governance consumers must exactly match the source-bound M1-014 consumer revalidation/);

reject('M1-014 current-source revalidation rejects an extra mastery B26 consumer group', (input) => {
  input.b26Runtime.eventRouting.find((route) => route.eventName === 'learning.mastery.projected.v2')
    .consumerGroups.push('cg.notification-from-learning.v1');
}, /learning\.mastery\.projected\.v2 B26 consumer groups must exactly match the source-bound M1-014 consumer revalidation/);

reject('M1-014 current-source revalidation requires the explicit social mastery consumer', (input) => {
  const route = input.b26Runtime.eventRouting.find((entry) => entry.eventName === 'learning.mastery.projected.v2');
  route.consumerGroups = route.consumerGroups.filter((consumerGroup) => consumerGroup !== 'cg.social-from-learning.v1');
}, /learning\.mastery\.projected\.v2 B26 consumer groups must exactly match the source-bound M1-014 consumer revalidation/);

reject('assessment event cannot omit its server-pinned objective policy', (input) => {
  delete input.b10LearningLoopEventFragment.payloadSchemas.B10AssessmentItemAssessedV2.properties.objectivePolicyPin;
}, /assessment\.item\.assessed\.v2 payload properties/);

reject('NO_OBJECTIVE_EXPECTED cannot be rewritten as objective-scored through an event branch', (input) => {
  const branch = input.b10LearningLoopEventFragment.payloadSchemas.B10AssessmentItemAssessedV2.oneOf.at(-1);
  branch.properties.objectivePolicyPin.properties.objectiveExpected.enum = [true];
}, /assessment event objective outcome branches/);

reject('mastery consolidated projection cannot lower its 95-score cross-field gate', (input) => {
  const branch = input.b10LearningLoopEventFragment.payloadSchemas.B10LearningMasteryProjectedV2.oneOf.find((entry) => entry.title === 'CONSOLIDATED_GATE');
  branch.properties.aggregateScore.minimum = 85;
}, /mastery event stage branches/);

reject('mastery evidenceCount cannot decouple from evidence local-date cardinality', (input) => {
  const branches = input.b10LearningLoopEventFragment.payloadSchemas.B10LearningMasteryProjectedV2.allOf[0].oneOf;
  branches.find((entry) => entry.properties.evidenceCount.enum[0] === 3).properties.evidenceLocalDates.maxItems = 2;
}, /mastery event evidence-count\/date branches/);

reject('review reopened state cannot lose its legal D1/D7/catch-up reason branch', (input) => {
  const branch = input.b10LearningLoopEventFragment.payloadSchemas.B10LearningReviewScheduledV2.oneOf.find((entry) => entry.title === 'REOPENED_REPAIR_QUEUE');
  branch.properties.reasonCodes.contains.enum = ['D1_VERIFICATION'];
}, /review event repair-state branches/);

reject('review event reason codes must remain unique', (input) => {
  input.b10LearningLoopEventFragment.payloadSchemas.B10LearningReviewScheduledV2.properties.reasonCodes.uniqueItems = false;
}, /review event reasonCodes uniqueness/);

reject('canonical route policy rejects unknown keys', (input) => {
  input.policy.compatibilityPromotion.canonicalRoutes[0].unsafeSelfAuthorization = true;
}, /canonical route B10-REVIEW-QUEUE-LIST keys/);

reject('canonical route security must stay bearerAuth and source-bound', (input) => {
  input.policy.compatibilityPromotion.canonicalRoutes.find((route) => route.id === 'B10-TASK-COMPLETE').security = 'none';
}, /canonical route B10-TASK-COMPLETE security/);

reject('canonical route inventory cannot omit a B10 learning route', (input) => {
  input.policy.compatibilityPromotion.canonicalRoutes.pop();
}, /B10 canonical learning route projection/);

reject('legacy policy must cover exactly the M1-013 fixed 24 operationIds', (input) => {
  input.policy.compatibilityPromotion.legacyAdapters.pop();
}, /fixed 24 legacy adapters/);

reject('M1-010 daily-stream deprecation exception cannot drift', (input) => {
  const route = input.b2MasteryOpenApi.paths['/api/v1/assessment/daily-stream'].get;
  route['x-p1r-deprecation'].migrationLink = '/api/v1/learning/today';
}, /M1-010 deprecation exception/);

reject('daily report legacy migration must retain its concrete route example', (input) => {
  const route = input.b2MasteryOpenApi.paths['/api/v1/learning/stats/daily-report'].get;
  route['x-contract'].canonicalRouteExample = '/api/v1/learning/reports/{reportType}';
}, /LEGACY-B2-DAILY-REPORT migration link/);

reject('canonical SRS request cannot accept server-derived dueAt', (input) => {
  input.b10OpenApi.components.schemas.B10CompleteReviewRequest.properties.dueAt = { type: 'string' };
}, /canonical SRS write request must reject all server-owned authority fields/);

reject('another public B10 write cannot become a second SRS entrance', (input) => {
  input.b10OpenApi.paths['/api/v1/learning/tasks/{taskId}/complete'].post['x-contract'].command = 'srs-transition';
}, /non-canonical SRS write completeB10LearningTask/);

reject('public learning projection cannot collapse the three state domains', (input) => {
  delete input.b10OpenApi.components.schemas.B10LearningQueueItem.properties.masteryStage;
}, /B10LearningQueueItem must require independent SRS, repair and mastery fields/);

reject('missing generated event TypeScript is not promotion evidence', (input) => {
  input.generatedEvents = '';
}, /generated event TypeScript must exist/);

reject('daily-plan priority order is exact and cannot move recovery behind optional', (input) => {
  input.policy.dailyPlan.priorityClasses.reverse();
}, /priority classes/);

reject('daily-plan quota enumeration rejects arbitrary duration', (input) => {
  input.policy.dailyPlan.dailyQuotaMinutes.push(10);
}, /quota options/);

reject('daily-plan locale ordering is prohibited', (input) => {
  input.policy.dailyPlan.stableSortTuple.at(-1).comparison = 'LOCALE_COMPARE';
}, /stable sort tuple/);

reject('daily-plan uplift cap cannot exceed ten percent', (input) => {
  input.policy.dailyPlan.normalBudgets.find((entry) => entry.dailyQuotaMinutes === 30).totalCapMinutes = 34;
}, /budget baselines/);

reject('CATCH_UP trigger cannot become inclusive at two review lanes', (input) => {
  input.policy.dailyPlan.catchUp.triggerFormula = 'debtMinutes >= 2 * normalReviewRepairMinutes';
}, /catch-up trigger/);

reject('client plan/mastery/due authority remains prohibited', (input) => {
  input.policy.dailyPlan.planningRunForbiddenFields = input.policy.dailyPlan.planningRunForbiddenFields.filter((field) => field !== 'clientMastery');
}, /client authority injection/);

reject('SRS quality domain cannot include an unknown value', (input) => {
  input.policy.srs.rawQualityValues.push(4);
}, /raw quality domain/);

reject('objective-scored outcomes must stay pinned to OBJECTIVE_ASSESSMENT', (input) => {
  input.policy.srs.objectiveOutcomeAuthority.objectiveExpected.requiredPracticeType = 'SELF_RATING';
}, /objective outcome authority/);

reject('NO_OBJECTIVE_EXPECTED cannot accept an arbitrary practice type', (input) => {
  input.policy.srs.objectiveOutcomeAuthority.noObjectiveExpected.allowedPracticeTypes.push('UNDECLARED_CLIENT_TYPE');
}, /objective outcome authority/);

reject('SRS state validation cannot allow ease-factor precision drift', (input) => {
  input.policy.srs.stateValidation.easeFactor.maxDecimalPlaces = 3;
}, /state validation/);

reject('SRS adapter cannot calculate the algorithm', (input) => {
  input.policy.srs.legacyMigration.adapterMayComputeAlgorithm = true;
}, /adapter algorithm authority/);

reject('SRS adapter cannot write the canonical lrn_srs_state', (input) => {
  input.policy.srs.legacyMigration.adapterMayWriteLrnSrsState = true;
}, /adapter lrn_srs_state authority/);

reject('SRS canonical entrance rejects client dueAt authority', (input) => {
  input.policy.srs.writeEntry.canonicalRequestForbiddenFields = input.policy.srs.writeEntry.canonicalRequestForbiddenFields.filter((field) => field !== 'dueAt');
}, /forbidden client authority/);

reject('SRS DST policy cannot change overlap semantics', (input) => {
  input.policy.srs.timePolicy.dstOverlap = 'USE_LATER_OFFSET';
}, /DST overlap/);

reject('SRS timezone migration cannot silently recalculate old dueAt', (input) => {
  input.policy.srs.timePolicy.timezoneChange = 'RECALCULATE_ALL_DUE_AT';
}, /timezone migration/);

reject('repair D7 failure must reopen rather than master directly', (input) => {
  input.policy.repair.transitionTable.find((entry) => entry.from === 'DELAY_VERIFY_D7' && entry.trigger === 'D7_FAIL_OR_MASTERY_GATE_NOT_MET').to = 'MASTERED';
}, /transition table/);

reject('repair must retain a legal variant relationship boundary', (input) => {
  input.policy.repair.variantPolicy.allowedRelationships.push('ANY_SOURCE_QUESTION');
}, /legal variant relationships/);

reject('mastery cannot count same-day repeated evidence as spaced evidence', (input) => {
  input.policy.mastery.qualifyingEvidence.oneEvidencePerLocalDate = 'COUNT_ALL';
}, /daily evidence dedupe/);

reject('mastery promotion cannot lower the D+7 and three-evidence gate', (input) => {
  input.policy.mastery.promotion.mastered = 'aggregateScore >= 85';
}, /85 gate/);

reject('mastery critical error must start a new epoch and downgrade', (input) => {
  input.policy.mastery.criticalError.effect = 'IGNORE';
}, /critical-error effect/);

reject('report missing watermark cannot be normalized to zero', (input) => {
  input.policy.report.missingWatermarkDecision = 'ZERO_METRICS';
}, /missing report watermark policy/);

reject('report snapshot validation cannot admit arbitrary metric precision', (input) => {
  input.policy.report.snapshotValidation.rateDecimalPlaces = 3;
}, /snapshot validation/);

reject('report late event cannot overwrite the existing version', (input) => {
  input.policy.report.lateEvent.immutableSnapshotPolicy = 'MUTATE_IN_PLACE';
}, /immutable snapshot policy/);

reject('offline payload collision must remain a conflict', (input) => {
  input.policy.offlineAndIdempotency.sameEventDifferentPayload = 'LAST_WRITE_WINS';
}, /payload collision policy/);

reject('offline commands must retain exact typed replay constraints', (input) => {
  input.policy.offlineAndIdempotency.commandFieldConstraints.payloadHashPattern = '^.*$';
}, /command field constraints/);

reject('client canonical Kafka production remains prohibited', (input) => {
  input.policy.offlineAndIdempotency.canonicalKafkaClientProduction = 'ALLOWED';
}, /client canonical Kafka policy/);

test('budget boundary uses frozen 5/15/30/45 caps and CATCH_UP is strictly greater than 2R0', () => {
  for (const [quota, cap] of [[5, 6], [15, 17], [30, 33], [45, 50]]) {
    const budget = dailyPlanBudget(sourceInputs.policy, quota);
    assert.equal(budget.result, 'PASS', budget.errors.join('\n'));
    assert.equal(budget.budget.totalCapMinutes, cap);
  }
  assert.equal(dailyPlanBudget(sourceInputs.policy, 10).result, 'FAIL');
  const equalThreshold = catchUpDecision(sourceInputs.policy, { dailyQuotaMinutes: 15, debtMinutes: 12 });
  assert.equal(equalThreshold.result, 'PASS');
  assert.equal(equalThreshold.trigger, false);
  const overThreshold = catchUpDecision(sourceInputs.policy, { dailyQuotaMinutes: 15, debtMinutes: 13 });
  assert.equal(overThreshold.result, 'PASS');
  assert.equal(overThreshold.trigger, true);
});

test('stable plan tuple uses fixed sentinels and binary final tie-breaker', () => {
  const base = {
    priorityClass: { ordinal: 3 }, dueSortAt: null, riskScore: 10, goalAffinity: 3, lastEvidenceAt: null,
  };
  const lowerId = { ...base, stableCandidateId: 'A-01' };
  const higherId = { ...base, stableCandidateId: 'B-01' };
  assert.ok(compareDailyPlanCandidates(sourceInputs.policy, lowerId, higherId) < 0);
  assert.ok(compareDailyPlanCandidates(sourceInputs.policy, { ...base, priorityClass: { ordinal: 2 }, stableCandidateId: 'z' }, lowerId) < 0);
  assert.ok(compareDailyPlanCandidates(sourceInputs.policy, { ...base, dueSortAt: '2026-03-01T00:00:00Z', stableCandidateId: 'z' }, lowerId) < 0);
});

test('SM2_Q03_V1 caps only legal pinned outcomes and uses deterministic decimal half-up arithmetic', () => {
  const objective = objectiveScoredContext();
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'UNANSWERED', objective).effectiveQuality, 0);
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'REVEALED_BEFORE_ANSWER', objective).effectiveQuality, 0);
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'INCORRECT', objective).effectiveQuality, 1);
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'GUESSED', objective).effectiveQuality, 2);
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 4, 'CORRECT_VERIFIED', objective).result, 'FAIL');
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'UNKNOWN_OUTCOME', objective).result, 'FAIL');
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'NO_OBJECTIVE_EXPECTED').result, 'FAIL');
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'NO_OBJECTIVE_EXPECTED', noObjectiveExpectedContext()).result, 'PASS');
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'NO_OBJECTIVE_EXPECTED', noObjectiveExpectedContext('UNDECLARED_CLIENT_TYPE')).result, 'FAIL');
  assert.equal(effectiveQualityForOutcome(sourceInputs.policy, 3, 'CORRECT_VERIFIED', noObjectiveExpectedContext()).result, 'FAIL');
  assert.equal(roundHalfUp(1.005, 2), 1.01);
  assert.equal(roundHalfUp('1.005', 2), 1.01);
  assert.equal(roundHalfUp(1.305, 2), 1.31);

  const failed = transitionSm2Q03(sourceInputs.policy, { easeFactor: 2.5, repetitions: 4, intervalDays: 30, lapseCount: 0 }, 0, 'UNANSWERED', objective);
  assert.equal(failed.result, 'PASS');
  assert.deepEqual(failed.state, { easeFactor: 2.18, repetitions: 0, intervalDays: 1, lapseCount: 1, srsStage: 'LEARNING' });

  const postSix = transitionSm2Q03(sourceInputs.policy, { easeFactor: 2.5, repetitions: 6, intervalDays: 90, lapseCount: 0 }, 3, 'CORRECT_VERIFIED', objective);
  assert.equal(postSix.result, 'PASS');
  assert.deepEqual(postSix.state, { easeFactor: 2.5, repetitions: 7, intervalDays: 225, lapseCount: 0, srsStage: 'CONSOLIDATED' });

  const lowerClamp = transitionSm2Q03(sourceInputs.policy, { easeFactor: 1.3, repetitions: 0, intervalDays: 0, lapseCount: 0 }, 0, 'UNANSWERED', objective);
  assert.equal(lowerClamp.state.easeFactor, 1.3);

  for (const [label, state] of [
    ['negative repetitions', { easeFactor: 2.5, repetitions: -1, intervalDays: 0, lapseCount: 0 }],
    ['fractional lapseCount', { easeFactor: 2.5, repetitions: 0, intervalDays: 0, lapseCount: 0.5 }],
    ['out-of-range interval', { easeFactor: 2.5, repetitions: 0, intervalDays: 366, lapseCount: 0 }],
    ['too many ease decimals', { easeFactor: 1.305, repetitions: 0, intervalDays: 0, lapseCount: 0 }],
    ['below ease minimum', { easeFactor: 1.29, repetitions: 0, intervalDays: 0, lapseCount: 0 }],
  ]) {
    const result = transitionSm2Q03(sourceInputs.policy, state, 3, 'CORRECT_VERIFIED', objective);
    assert.equal(result.result, 'FAIL', `${label} must fail static SM2 validation`);
  }
});

test('SRS, repair and mastery remain three independently validated state systems', () => {
  const valid = validateStateSeparation(sourceInputs.policy, {
    srsStage: 'MASTERED', repairWorkflowState: 'DELAY_VERIFY_D7', masteryStage: 'LEARNING',
  });
  assert.equal(valid.result, 'PASS', valid.errors.join('\n'));
  const coupled = validateStateSeparation(sourceInputs.policy, {
    srsStage: 'MASTERED', repairWorkflowState: 'DELAY_VERIFY_D7', masteryStage: 'LEARNING', sharedLearningState: 'MASTERED',
  });
  assert.equal(coupled.result, 'FAIL');
  assert.match(coupled.errors.join('\n'), /sharedLearningState/);
});

test('offline command enforces typed replay fields, immutable receipt replay, ordering and payload conflicts', () => {
  const command = {
    clientEventId: 'evt-1', clientSeq: 1, baseStateVersion: 3, contentVersionId: 7, payloadHash: SHA256, rawQuality: 3,
  };
  assert.equal(validateOfflineCommand(sourceInputs.policy, command).decision, 'ACCEPT_NEW');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, score: 100 }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, dueAt: '2026-10-01T00:00:00Z' }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, payloadHash: '' }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, clientEventId: ' client-generated' }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, clientSeq: 1.5 }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, baseStateVersion: -1 }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, contentVersionId: 0 }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, payloadHash: SHA256.toUpperCase() }).result, 'FAIL');
  assert.equal(validateOfflineCommand(sourceInputs.policy, { ...command, rawQuality: '3' }).result, 'FAIL');

  const accepted = [{ ...command, receiptId: 'receipt-1' }];
  const replay = validateOfflineCommand(sourceInputs.policy, command, accepted);
  assert.equal(replay.result, 'PASS', replay.errors.join('\n'));
  assert.equal(replay.decision, 'REPLAY_ORIGINAL_RECEIPT');
  assert.equal(replay.originalReceipt.receiptId, 'receipt-1');

  const payloadConflict = validateOfflineCommand(sourceInputs.policy, { ...command, payloadHash: 'b'.repeat(64) }, accepted);
  assert.equal(payloadConflict.result, 'FAIL');
  assert.match(payloadConflict.errors.join('\n'), /different payloadHash must conflict/);
  const outOfOrder = validateOfflineCommand(sourceInputs.policy, { ...command, clientEventId: 'evt-2', clientSeq: 1 }, accepted);
  assert.equal(outOfOrder.result, 'FAIL');
  assert.match(outOfOrder.errors.join('\n'), /strictly increasing/);
});

test('report snapshots enforce metric math, watermark/source/window and late-event lineage combinations', () => {
  const processing = reportSnapshot();
  assert.equal(validateReportSnapshot(sourceInputs.policy, processing).result, 'PASS');

  const ready = reportSnapshot('READY');
  assert.equal(validateReportSnapshot(sourceInputs.policy, ready).result, 'PASS');
  assert.equal(validateReportSnapshot(sourceInputs.policy, { ...ready, sourceWatermarks: null, sourceWatermarkDigest: null }).result, 'FAIL');

  const notApplicable = {
    ...structuredClone(ready), status: 'NOT_APPLICABLE',
    metrics: ready.metrics.map(({ code }) => ({ code, numerator: null, denominator: null, value: null, status: 'NOT_APPLICABLE' })),
  };
  assert.equal(validateReportSnapshot(sourceInputs.policy, notApplicable).result, 'PASS');
  assert.equal(validateReportSnapshot(sourceInputs.policy, { ...notApplicable, metrics: readyMetrics() }).result, 'FAIL');

  const zeroDenominator = structuredClone(ready);
  const objectiveAccuracy = zeroDenominator.metrics.find((metric) => metric.code === 'OBJECTIVE_ACCURACY');
  objectiveAccuracy.denominator = 0;
  objectiveAccuracy.value = null;
  objectiveAccuracy.status = 'NOT_APPLICABLE';
  assert.equal(validateReportSnapshot(sourceInputs.policy, zeroDenominator).result, 'PASS');
  objectiveAccuracy.value = 0;
  const invalidZero = validateReportSnapshot(sourceInputs.policy, zeroDenominator);
  assert.equal(invalidZero.result, 'FAIL');
  assert.match(invalidZero.errors.join('\n'), /zero denominator value/);

  const stringNumerator = structuredClone(ready);
  stringNumerator.metrics.find((metric) => metric.code === 'OBJECTIVE_ACCURACY').numerator = '1';
  assert.equal(validateReportSnapshot(sourceInputs.policy, stringNumerator).result, 'FAIL');
  const negativeDenominator = structuredClone(ready);
  negativeDenominator.metrics.find((metric) => metric.code === 'OBJECTIVE_ACCURACY').denominator = -1;
  assert.equal(validateReportSnapshot(sourceInputs.policy, negativeDenominator).result, 'FAIL');
  const arbitraryValue = structuredClone(ready);
  arbitraryValue.metrics.find((metric) => metric.code === 'OBJECTIVE_ACCURACY').value = 49.99;
  assert.equal(validateReportSnapshot(sourceInputs.policy, arbitraryValue).result, 'FAIL');
  const invalidWindow = structuredClone(ready);
  invalidWindow.window.endExclusive = '2026-10-01T00:00:00+08:00';
  assert.equal(validateReportSnapshot(sourceInputs.policy, invalidWindow).result, 'FAIL');
  const missingSource = structuredClone(ready);
  delete missingSource.sourceWatermarks['assessment-service'];
  assert.equal(validateReportSnapshot(sourceInputs.policy, missingSource).result, 'FAIL');

  const rebuilt = {
    ...structuredClone(ready), reportVersion: 2, supersedesReportVersion: 1,
    lateSourceFactId: 'fact-1', lateSourceWatermark: '43',
  };
  assert.equal(validateReportSnapshot(sourceInputs.policy, rebuilt).result, 'PASS');
  const partialLineage = structuredClone(rebuilt);
  delete partialLineage.lateSourceWatermark;
  assert.equal(validateReportSnapshot(sourceInputs.policy, partialLineage).result, 'FAIL');
});
