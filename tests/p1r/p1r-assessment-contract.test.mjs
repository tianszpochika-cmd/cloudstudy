import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  validateAssessmentContract,
  validateAssessmentContractData,
} from '../../scripts/audit/p1r-assessment-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config', 'p1r-assessment-contract.v1.json'), 'utf8'));

const trustedFacts = [...policy.authorization.trustedFacts];
const sensitiveAuditFields = [...policy.authorization.auditSensitiveFields];

function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function closed(properties, required) {
  return { type: 'object', additionalProperties: false, required, properties };
}

function scalar(name) {
  if (/(?:Version|Epoch|Version|Numerator|Denominator|Watermark|Seq|Cursor|Count)/.test(name)) return { type: 'integer', minimum: 0 };
  return { type: 'string', minLength: 1 };
}

function operation(operationId, responseSchema, options = {}) {
  const method = options.method || 'POST';
  const value = {
    operationId,
    'x-authorization': {
      defaultDecision: 'DENY',
      trustedFacts: [...trustedFacts],
      serviceSidePepRequired: true,
      auditSensitiveFields: [...sensitiveAuditFields],
    },
    responses: {
      [options.status || '200']: {
        description: 'fixture',
        content: { 'application/json': { schema: ref(responseSchema) } },
      },
    },
  };
  if (options.requestSchema) value.requestBody = { required: true, content: { 'application/json': { schema: ref(options.requestSchema) } } };
  if (options.idempotent) {
    value.parameters = [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8 } }];
    value['x-idempotency'] = { required: true, keyHeader: 'Idempotency-Key' };
  }
  return value;
}

function legacy(operationId, replacementOperationId, extras = {}) {
  return {
    operationId,
    deprecated: true,
    'x-p1r-deprecation': {
      deprecationAt: '2026-08-30T00:00:00Z',
      sunsetAt: 'UNSCHEDULED_UNTIL_DECLARED_REPLACEMENT_RUNTIME_GATE_ACCEPTED',
      migrationLink: '/docs/07-operations/b10-validation#legacy-adapter-retirement',
    },
    'x-p1r-assessment-legacy': {
      adapterOnly: true,
      replacementOperationId,
      ...extras,
    },
    responses: { 200: { description: 'historical adapter fixture' } },
  };
}

function eventPayload(requiredFields) {
  const properties = Object.fromEntries(requiredFields.map((field) => [field, field === 'reasonTrace'
    ? closed({ code: { type: 'string' }, ruleRef: { type: 'string' } }, ['code', 'ruleRef'])
    : field === 'outcomeKind'
      ? { type: 'string', enum: ['OBJECTIVE'] }
    : scalar(field)]));
  return closed(properties, [...requiredFields]);
}

function forbiddenAnswerNot() {
  return { anyOf: policy.answerSubmission.forbiddenFields.map((field) => ({ required: [field] })) };
}

function forbiddenNot(fields) {
  if (fields.length === 1) return { required: [fields[0]] };
  return { anyOf: fields.map((field) => ({ required: [field] })) };
}

function makeFixture() {
  const pinProperties = Object.fromEntries(policy.pins.activeContentPinRequiredFields.map((field) => [field, scalar(field)]));
  const itemRulePinProperties = Object.fromEntries(policy.pins.itemRulePinRequiredFields.map((field) => [field, scalar(field)]));
  const outcomeProperties = Object.fromEntries(policy.outcome.requiredFields.map((field) => [field, field === 'reasonTrace'
    ? ref('B10ReasonTrace')
    : scalar(field)]));
  const schemas = {
    B10ActiveSessionAttemptPin: closed(pinProperties, [...policy.pins.activeContentPinRequiredFields]),
    B10AssessmentItemRulePin: closed(itemRulePinProperties, [...policy.pins.itemRulePinRequiredFields]),
    B10ReasonTrace: closed({ code: { type: 'string' }, ruleRef: { type: 'string' } }, ['code', 'ruleRef']),
    B10ObjectiveOutcome: closed({ outcomeKind: { enum: ['OBJECTIVE'] }, ...outcomeProperties }, ['outcomeKind', ...policy.outcome.requiredFields]),
    B10SelfRatingOutcome: closed({ outcomeKind: { enum: ['SELF_RATING'] }, selfRating: { type: 'string' }, outcomeDigest: { type: 'string' } }, ['outcomeKind', 'selfRating', 'outcomeDigest']),
    B10ManualReviewOutcome: closed({ outcomeKind: { enum: ['MANUAL_REVIEW'] }, reviewStatus: { type: 'string' }, outcomeDigest: { type: 'string' } }, ['outcomeKind', 'reviewStatus', 'outcomeDigest']),
    B10AssessmentOutcome: {
      oneOf: [ref('B10ObjectiveOutcome'), ref('B10SelfRatingOutcome'), ref('B10ManualReviewOutcome')],
    },
    B10CreateAssessmentSessionRequest: closed({ mode: { type: 'string' }, contentVersionId: { type: 'integer', minimum: 1 } }, ['mode', 'contentVersionId']),
    B10AssessmentSession: closed({
      sessionId: { type: 'string' },
      status: { type: 'string', enum: [...policy.states.session] },
      stateVersion: { type: 'integer', minimum: 1 },
      pin: ref('B10ActiveSessionAttemptPin'),
      itemRulePins: { type: 'array', minItems: 1, items: ref('B10AssessmentItemRulePin') },
      answerRuleSetVersion: { type: 'string' },
      completionRuleVersion: { type: 'string' },
    }, ['sessionId', 'status', 'stateVersion', 'pin', 'itemRulePins', 'answerRuleSetVersion', 'completionRuleVersion']),
    B10SubmitAttemptRequest: closed({
      submissionId: { type: 'string' },
      submissionDigest: { type: 'string' },
      items: { type: 'array', minItems: 1, items: ref('B10AttemptSubmission') },
    }, ['submissionId', 'submissionDigest', 'items']),
    B10AttemptSubmission: closed({
      itemId: { type: 'integer', minimum: 1 },
      sequence: { type: 'integer', minimum: 1 },
      responseType: { type: 'string' },
      responseDigest: { type: 'string' },
      selectedOptionIds: { type: 'array', items: { type: 'string' } },
      pairs: { type: 'array', items: { type: 'string' } },
      orderedTokenIds: { type: 'array', items: { type: 'string' } },
      blanks: { type: 'array', items: { type: 'string' } },
      text: { type: 'string' },
    }, [...policy.answerSubmission.itemRequiredFields]),
    B10Attempt: closed({
      attemptId: { type: 'string' },
      sessionId: { type: 'string' },
      status: { type: 'string', enum: [...policy.states.attempt] },
      pin: ref('B10ActiveSessionAttemptPin'),
      itemRulePins: { type: 'array', minItems: 1, items: ref('B10AssessmentItemRulePin') },
      answerRuleSetVersion: { type: 'string' },
      completionRuleVersion: { type: 'string' },
      submissionId: { type: 'string' },
      submissionDigest: { type: 'string' },
      attemptVersion: { type: 'integer', minimum: 1 },
      assessmentVersion: { type: 'string' },
      outcome: ref('B10AssessmentOutcome'),
      reportId: { type: 'string' },
      assessedAt: { type: 'string', format: 'date-time', nullable: true },
      rejectionCode: { type: 'string' },
    }, ['attemptId', 'sessionId', 'status', 'pin', 'itemRulePins', 'answerRuleSetVersion', 'completionRuleVersion', 'submissionId', 'submissionDigest', 'attemptVersion']),
    B10AssessmentSessionCheckpointRequest: closed({
      protectedDraft: { type: 'object', additionalProperties: false, writeOnly: true, properties: { itemCursor: { type: 'integer' } } },
      baseStateVersion: { type: 'integer', minimum: 1 },
      checkpointVersion: { type: 'integer', minimum: 1 },
      clientEventId: { type: 'string' },
      clientSeq: { type: 'integer', minimum: 1 },
      checkpointDigest: { type: 'string' },
    }, [...policy.checkpoint.requiredFields]),
    B10AssessmentCheckpoint: closed({
      sessionId: { type: 'string' },
      checkpointVersion: { type: 'integer', minimum: 1 },
      checkpointDigest: { type: 'string' },
    }, ['sessionId', 'checkpointVersion', 'checkpointDigest']),
    B10AssessmentReport: closed({
      reportId: { type: 'string' },
      status: { type: 'string', enum: [...policy.states.report] },
      pin: ref('B10ActiveSessionAttemptPin'),
      itemRulePins: { type: 'array', minItems: 1, items: ref('B10AssessmentItemRulePin') },
      answerRuleSetVersion: { type: 'string' },
      completionRuleVersion: { type: 'string' },
      sessionId: { type: 'string' },
      attemptId: { type: 'string' },
      submissionId: { type: 'string' },
      submissionDigest: { type: 'string' },
      attemptVersion: { type: 'integer', minimum: 1 },
      reportVersion: { type: 'integer', minimum: 1 },
      reportRuleVersion: { type: 'string' },
      assessmentVersion: { type: 'string' },
      asOf: { type: 'string', format: 'date-time' },
      assessmentFactWatermark: { type: 'string' },
      outcome: ref('B10AssessmentOutcome'),
      mistakeCodes: { type: 'array', items: { type: 'string' } },
      partialReasonCodes: { type: 'array', items: { type: 'string' } },
      failureCode: { type: 'string' },
      retryable: { type: 'boolean' },
    }, ['reportId', 'status', 'pin', 'itemRulePins', 'answerRuleSetVersion', 'completionRuleVersion', ...policy.report.requiredFields]),
  };
  schemas.B10AttemptSubmission.oneOf = policy.answerSubmission.responseTypes.map((responseType) => {
    const rawFields = policy.auditRedaction.answerRawFieldsByResponseType[responseType];
    const rawProperties = Object.fromEntries(rawFields.map((field) => [field, field === 'text'
      ? { type: 'string' }
      : { type: 'array', items: { type: 'string' } }]));
    return closed({
      itemId: { type: 'integer', minimum: 1 },
      sequence: { type: 'integer', minimum: 1 },
      responseType: { const: responseType },
      responseDigest: { type: 'string' },
      ...rawProperties,
    }, [...policy.answerSubmission.itemRequiredFields, ...rawFields]);
  });
  schemas.B10AttemptSubmission.not = forbiddenAnswerNot();
  schemas.B10Attempt.oneOf = [
    { properties: { status: { enum: ['ACCEPTED', 'ASSESSING'] } }, required: ['status'], not: forbiddenNot(['assessmentVersion', 'outcome', 'reportId', 'assessedAt', 'rejectionCode']) },
    {
      properties: {
        status: { enum: ['ASSESSED'] },
        assessedAt: { type: 'string', format: 'date-time' },
      },
      required: ['status', 'assessmentVersion', 'outcome', 'reportId', 'assessedAt'],
      not: forbiddenNot(['rejectionCode']),
    },
    { properties: { status: { enum: ['REJECTED'] } }, required: ['status', 'rejectionCode'], not: forbiddenNot(['assessmentVersion', 'outcome', 'reportId', 'assessedAt']) },
  ];
  schemas.B10AssessmentReport.oneOf = [
    { properties: { status: { enum: ['GENERATING'] } }, required: ['status'], not: forbiddenNot(['outcome', 'mistakeCodes', 'partialReasonCodes', 'failureCode', 'retryable']) },
    { properties: { status: { enum: ['READY'] } }, required: ['status', 'outcome', 'mistakeCodes'], not: forbiddenNot(['partialReasonCodes', 'failureCode', 'retryable']) },
    { properties: { status: { enum: ['PARTIAL'] } }, required: ['status', 'outcome', 'partialReasonCodes'], not: forbiddenNot(['failureCode', 'retryable']) },
    { properties: { status: { enum: ['FAILED'] } }, required: ['status', 'failureCode', 'retryable'], not: forbiddenNot(['outcome', 'mistakeCodes', 'partialReasonCodes']) },
  ];

  const b10OpenApi = {
    openapi: '3.1.0',
    info: { title: 'assessment fixture', version: '1.0.0' },
    paths: {
      '/api/v1/assessment/sessions': {
        post: operation('createB10AssessmentSession', 'B10AssessmentSession', { requestSchema: 'B10CreateAssessmentSessionRequest', status: '201', idempotent: true }),
      },
      '/api/v1/assessment/sessions/{sessionId}': {
        get: operation('getB10AssessmentSession', 'B10AssessmentSession', { method: 'GET' }),
      },
      '/api/v1/assessment/sessions/{sessionId}/checkpoint': {
        put: {
          ...operation('putB10AssessmentSessionCheckpoint', 'B10AssessmentCheckpoint', { requestSchema: 'B10AssessmentSessionCheckpointRequest', idempotent: true, method: 'PUT' }),
          'x-checkpoint-concurrency': structuredClone(policy.checkpoint.conflictPolicy),
          responses: {
            200: { description: 'fixture', content: { 'application/json': { schema: ref('B10AssessmentCheckpoint') } } },
            409: { description: 'stale, conflicting or terminal checkpoint' },
          },
        },
      },
      '/api/v1/assessment/sessions/{sessionId}/attempts': {
        post: operation('submitB10AssessmentAttempt', 'B10Attempt', { requestSchema: 'B10SubmitAttemptRequest', idempotent: true }),
      },
      '/api/v1/assessment/reports/{reportId}': {
        get: operation('getB10AssessmentReport', 'B10AssessmentReport', { method: 'GET' }),
      },
      '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint': {
        put: legacy('putB10AssessmentCheckpoint', 'putB10AssessmentSessionCheckpoint'),
      },
    },
    components: { schemas },
  };
  b10OpenApi.paths['/api/v1/assessment/sessions/{sessionId}/attempts'].post['x-audit'] = {
    required: policy.auditRedaction.submit.required,
    event: policy.auditRedaction.submit.event,
    correlation: policy.auditRedaction.submit.correlation,
    redacted: [...policy.auditRedaction.submit.redacted],
    logBoundary: policy.auditRedaction.submit.logBoundary,
  };
  b10OpenApi.paths['/api/v1/assessment/sessions/{sessionId}/checkpoint'].put['x-audit'] = {
    required: policy.auditRedaction.checkpoint.required,
    event: policy.auditRedaction.checkpoint.event,
    correlation: policy.auditRedaction.checkpoint.correlation,
    redacted: [...policy.auditRedaction.checkpoint.redacted],
    logBoundary: policy.auditRedaction.checkpoint.logBoundary,
  };

  const b2OpenApi = { openapi: '3.1.0', info: { title: 'B2 fixture', version: '1.0.0' }, paths: {}, components: { schemas: {} } };
  for (const item of policy.legacyCompatibility.filter((candidate) => candidate.source === 'B2')) {
    b2OpenApi.paths[item.path] ??= {};
    b2OpenApi.paths[item.path][item.method.toLowerCase()] = legacy(item.operationId, item.replacementOperationId);
  }
  for (const item of policy.legacyExamWriteOperations) {
    b2OpenApi.paths[item.path] ??= {};
    b2OpenApi.paths[item.path][item.method.toLowerCase()] = legacy(item.operationId, undefined, {
      owner: item.owner,
      disposition: item.disposition,
      nextTask: item.nextTask,
      ...(item.operationId === 'recordB2AntiCheatEvent' ? { forbiddenEffects: [...item.forbiddenEffects] } : {}),
    });
  }

  const submittedPayload = eventPayload(policy.events.requiredSubmittedFields);
  const assessedPayload = eventPayload(policy.events.requiredAssessedFields);
  const eventFragment = {
    events: [
      { eventName: 'assessment.attempt.submitted.v1', payloadSchema: { $ref: '#/payloadSchemas/B10AssessmentAttemptSubmitted' } },
      { eventName: 'assessment.attempt.assessed.v1', payloadSchema: { $ref: '#/payloadSchemas/B10AssessmentAttemptAssessed' } },
    ],
    payloadSchemas: { B10AssessmentAttemptSubmitted: submittedPayload, B10AssessmentAttemptAssessed: assessedPayload },
  };
  const catalog = {
    events: [
      { eventName: 'assessment.attempt.submitted.v1', status: 'HISTORICAL_CANDIDATE', payloadSchema: { $ref: '#/payloadSchemas/B10AssessmentAttemptSubmitted' } },
      { eventName: 'assessment.attempt.assessed.v1', status: 'HISTORICAL_CANDIDATE', payloadSchema: { $ref: '#/payloadSchemas/B10AssessmentAttemptAssessed' } },
      { eventName: 'assessment.item.assessed.v2', status: 'CANONICAL_D2', payloadSchema: { $ref: '#/payloadSchemas/B10AssessmentItemAssessedV2' } },
      { eventName: 'assessment.placement.completed.v1', status: 'CANONICAL_D2', payloadSchema: { $ref: '#/payloadSchemas/B10PlacementCompleted' } },
    ],
    payloadSchemas: structuredClone(eventFragment.payloadSchemas),
  };
  const gapRegistry = {
    gaps: [{
      id: 'EVENT-GAP-BIND-ASM-001', status: 'CLOSED',
      closureTasks: ['P1R-M1-006', 'P1R-M1-010', 'P1R-M1-013'],
      closureEvidence: 'evidence/p1r/m1/P1R-M1-010/manifest.json',
    }],
  };
  return {
    policy: structuredClone(policy),
    b10OpenApi,
    b2OpenApi,
    canonicalOpenApi: structuredClone(b10OpenApi),
    eventFragment,
    catalog,
    gapRegistry,
  };
}

function b10Operation(fixture, pathValue, method) {
  return fixture.b10OpenApi.paths[pathValue][method];
}

function rejectMutation(name, mutate) {
  test(`adversarial mutation: ${name}`, () => {
    const fixture = makeFixture();
    mutate(fixture);
    const report = validateAssessmentContractData(fixture);
    assert.equal(report.result, 'FAIL', `${name} must fail closed; got ${report.errors.join(' | ')}`);
  });
}

test('assessment contract validator accepts a fully governed D2 fixture', () => {
  const report = validateAssessmentContractData(makeFixture());
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.summary.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
});

rejectMutation('CONFIG_UNKNOWN_FIELD', (fixture) => { fixture.policy.unapprovedRuntimeClaim = true; });
rejectMutation('CONFIG_DUPLICATE_ROUTE', (fixture) => { fixture.policy.canonicalRoutes.push(structuredClone(fixture.policy.canonicalRoutes[0])); });
rejectMutation('CONFIG_RUNTIME_PROMOTION', (fixture) => { fixture.policy.runtimeStatus = 'RUNTIME_VERIFIED'; });
rejectMutation('COMPATIBILITY_PROMOTION_DRIFT', (fixture) => { fixture.policy.compatibilityPromotion.previousPromotion = 'M1-000_UNKNOWN'; });
rejectMutation('CANONICAL_ROUTE_DRIFT', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions', 'post').operationId = 'createAssessmentSession'; });
rejectMutation('MISSING_PEP_TRUSTED_FACT', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions', 'post')['x-authorization'].trustedFacts.pop(); });
rejectMutation('AUTHZ_DEFAULT_ALLOW', (fixture) => { b10Operation(fixture, '/api/v1/assessment/reports/{reportId}', 'get')['x-authorization'].defaultDecision = 'ALLOW'; });
rejectMutation('SESSION_STATE_ENUM_DRIFT', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentSession.properties.status.enum.pop(); });
rejectMutation('ATTEMPT_STATE_ENUM_DRIFT', (fixture) => { fixture.b10OpenApi.components.schemas.B10Attempt.properties.status.enum[0] = 'SUBMITTED'; });
rejectMutation('REPORT_STATE_ENUM_DRIFT', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.properties.status.enum.push('PUBLISHED'); });
rejectMutation('ATTEMPT_ACCEPTED_REJECTION_LEAK', (fixture) => { fixture.b10OpenApi.components.schemas.B10Attempt.oneOf[0].not.anyOf.pop(); });
rejectMutation('ATTEMPT_ASSESSED_REJECTION_LEAK', (fixture) => { delete fixture.b10OpenApi.components.schemas.B10Attempt.oneOf[1].not; });
rejectMutation('ATTEMPT_REJECTED_OUTCOME_LEAK', (fixture) => { delete fixture.b10OpenApi.components.schemas.B10Attempt.oneOf[2].not; });
rejectMutation('REPORT_GENERATING_OUTCOME_LEAK', (fixture) => { delete fixture.b10OpenApi.components.schemas.B10AssessmentReport.oneOf[0].not; });
rejectMutation('REPORT_READY_FAILURE_LEAK', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.oneOf[1].not.anyOf.pop(); });
rejectMutation('REPORT_PARTIAL_FAILURE_LEAK', (fixture) => { delete fixture.b10OpenApi.components.schemas.B10AssessmentReport.oneOf[2].not; });
rejectMutation('REPORT_FAILED_OUTCOME_LEAK', (fixture) => { delete fixture.b10OpenApi.components.schemas.B10AssessmentReport.oneOf[3].not; });
rejectMutation('PIN_FIELD_REMOVAL', (fixture) => { fixture.b10OpenApi.components.schemas.B10ActiveSessionAttemptPin.required = fixture.b10OpenApi.components.schemas.B10ActiveSessionAttemptPin.required.filter((field) => field !== 'snapshotHash'); });
rejectMutation('PIN_UNKNOWN_FIELD', (fixture) => { fixture.b10OpenApi.components.schemas.B10ActiveSessionAttemptPin.additionalProperties = true; });
rejectMutation('CHECKPOINT_NOT_SESSION_SCOPED', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put').operationId = 'putB10AssessmentCheckpoint'; });
rejectMutation('CHECKPOINT_MISSING_BASE_STATE_VERSION', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentSessionCheckpointRequest.required = fixture.b10OpenApi.components.schemas.B10AssessmentSessionCheckpointRequest.required.filter((field) => field !== 'baseStateVersion'); });
rejectMutation('CHECKPOINT_SAME_VERSION_REPLAY_WEAKENED', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-checkpoint-concurrency'].sameVersionSameDigest = 'CONFLICT_409'; });
rejectMutation('CHECKPOINT_OLD_VERSION_NOT_409', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-checkpoint-concurrency'].olderVersion = 'ALLOW'; });
rejectMutation('CHECKPOINT_SAME_VERSION_DIFFERENT_DIGEST_NOT_409', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-checkpoint-concurrency'].sameVersionDifferentDigest = 'REPLAY'; });
rejectMutation('CHECKPOINT_TERMINAL_NOT_409', (fixture) => { delete b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put').responses[409]; });
for (const [name, pathValue] of [
  ['SUBMIT_AUDIT_SELECTED_OPTION_IDS_REDACTION_MISSING', 'request.body.items[].selectedOptionIds'],
  ['SUBMIT_AUDIT_PAIRS_REDACTION_MISSING', 'request.body.items[].pairs'],
  ['SUBMIT_AUDIT_ORDERED_TOKEN_IDS_REDACTION_MISSING', 'request.body.items[].orderedTokenIds'],
  ['SUBMIT_AUDIT_BLANKS_REDACTION_MISSING', 'request.body.items[].blanks'],
  ['SUBMIT_AUDIT_TEXT_REDACTION_MISSING', 'request.body.items[].text'],
  ['SUBMIT_AUDIT_RESPONSE_DIGEST_REDACTION_MISSING', 'request.body.items[].responseDigest'],
]) {
  rejectMutation(name, (fixture) => {
    const redacted = b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts', 'post')['x-audit'].redacted;
    redacted.splice(redacted.indexOf(pathValue), 1);
  });
}
for (const [name, pathValue] of [
  ['CHECKPOINT_AUDIT_SELECTED_OPTION_IDS_REDACTION_MISSING', 'request.body.protectedDraft.responses[].selectedOptionIds'],
  ['CHECKPOINT_AUDIT_PAIRS_REDACTION_MISSING', 'request.body.protectedDraft.responses[].pairs'],
  ['CHECKPOINT_AUDIT_ORDERED_TOKEN_IDS_REDACTION_MISSING', 'request.body.protectedDraft.responses[].orderedTokenIds'],
  ['CHECKPOINT_AUDIT_BLANKS_REDACTION_MISSING', 'request.body.protectedDraft.responses[].blanks'],
  ['CHECKPOINT_AUDIT_TEXT_REDACTION_MISSING', 'request.body.protectedDraft.responses[].text'],
  ['CHECKPOINT_AUDIT_RESPONSE_DIGEST_REDACTION_MISSING', 'request.body.protectedDraft.responses[].responseDigest'],
  ['CHECKPOINT_AUDIT_PROTECTED_DRAFT_REDACTION_MISSING', 'request.body.protectedDraft'],
]) {
  rejectMutation(name, (fixture) => {
    const redacted = b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-audit'].redacted;
    redacted.splice(redacted.indexOf(pathValue), 1);
  });
}
rejectMutation('SUBMIT_AUDIT_LEGACY_RESPONSE_PATH', (fixture) => {
  b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts', 'post')['x-audit'].redacted[1] = 'request.body.items[].response';
});
rejectMutation('CHECKPOINT_AUDIT_LEGACY_RESPONSE_PATH', (fixture) => {
  b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-audit'].redacted[2] = 'request.body.protectedDraft.responses[].response';
});
rejectMutation('ATTEMPT_ASSESSED_AT_NULLABLE', (fixture) => {
  fixture.b10OpenApi.components.schemas.B10Attempt.oneOf[1].properties.assessedAt.nullable = true;
});
rejectMutation('ATTEMPT_ASSESSED_AT_BRANCH_OVERRIDE_REMOVAL', (fixture) => {
  delete fixture.b10OpenApi.components.schemas.B10Attempt.oneOf[1].properties.assessedAt;
});
rejectMutation('ANSWER_UNREDACTED_RAW_FIELD_INJECTION', (fixture) => {
  const answer = fixture.b10OpenApi.components.schemas.B10AttemptSubmission;
  answer.properties.selfRating = { type: 'boolean' };
  answer.oneOf[0].properties.selfRating = { type: 'boolean' };
});
rejectMutation('ANSWER_BRANCH_MULTI_DISCRIMINATOR', (fixture) => {
  fixture.b10OpenApi.components.schemas.B10AttemptSubmission.oneOf[0].properties.responseType = {
    type: 'string',
    enum: ['CHOICE', 'TEXT'],
  };
});
rejectMutation('ANSWER_RAW_FIELD_OPTIONAL', (fixture) => {
  const branch = fixture.b10OpenApi.components.schemas.B10AttemptSubmission.oneOf[0];
  branch.required.splice(branch.required.indexOf('selectedOptionIds'), 1);
});
rejectMutation('ANSWER_ROOT_REQUIRED_DRIFT', (fixture) => {
  fixture.b10OpenApi.components.schemas.B10AttemptSubmission.required.push('selectedOptionIds');
});
rejectMutation('SUBMIT_AUDIT_REQUIRED_REMOVAL', (fixture) => {
  delete b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts', 'post')['x-audit'].required;
});
rejectMutation('CHECKPOINT_AUDIT_EVENT_DRIFT', (fixture) => {
  b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-audit'].event = 'assessment.checkpoint.saved.v1';
});
rejectMutation('SUBMIT_AUDIT_CORRELATION_DRIFT', (fixture) => {
  b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts', 'post')['x-audit'].correlation = 'request-id-only';
});
rejectMutation('CHECKPOINT_AUDIT_LOG_BOUNDARY_REMOVAL', (fixture) => {
  delete b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/checkpoint', 'put')['x-audit'].logBoundary;
});
rejectMutation('SUBMIT_AUDIT_UNKNOWN_FIELD', (fixture) => {
  b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts', 'post')['x-audit'].runtimeSink = 'raw-answer-log';
});
rejectMutation('CANONICAL_SUBMIT_AUDIT_DRIFT', (fixture) => {
  fixture.canonicalOpenApi.paths['/api/v1/assessment/sessions/{sessionId}/attempts'].post['x-audit'].redacted.pop();
});
rejectMutation('ANSWER_ONEOF_REMOVAL', (fixture) => { fixture.b10OpenApi.components.schemas.B10AttemptSubmission.oneOf.pop(); });
rejectMutation('ANSWER_NOT_GUARD_REMOVAL', (fixture) => { delete fixture.b10OpenApi.components.schemas.B10AttemptSubmission.not; });
rejectMutation('ANSWER_NOT_GUARD_WEAKENED', (fixture) => { fixture.b10OpenApi.components.schemas.B10AttemptSubmission.not.anyOf.pop(); });
rejectMutation('ANSWER_UNKNOWN_TYPE', (fixture) => { fixture.b10OpenApi.components.schemas.B10AttemptSubmission.oneOf[0].properties.responseType.const = 'UNKNOWN'; });
rejectMutation('CLIENT_SCORE_INJECTION', (fixture) => { fixture.b10OpenApi.components.schemas.B10AttemptSubmission.properties.score = { type: 'number' }; });
rejectMutation('CLIENT_RULE_INJECTION', (fixture) => { fixture.b10OpenApi.components.schemas.B10AttemptSubmission.properties.answerRule = { type: 'string' }; });
rejectMutation('SUBMISSION_DIGEST_REMOVAL', (fixture) => { fixture.b10OpenApi.components.schemas.B10Attempt.required = fixture.b10OpenApi.components.schemas.B10Attempt.required.filter((field) => field !== 'submissionDigest'); });
rejectMutation('OUTCOME_OBJECTIVE_NUMERATOR_REMOVAL', (fixture) => { fixture.b10OpenApi.components.schemas.B10ObjectiveOutcome.required = fixture.b10OpenApi.components.schemas.B10ObjectiveOutcome.required.filter((field) => field !== 'objectiveNumerator'); });
rejectMutation('OUTCOME_REASON_TRACE_REMOVAL', (fixture) => { fixture.b10OpenApi.components.schemas.B10ObjectiveOutcome.properties.reasonTrace = { type: 'string' }; });
rejectMutation('SUBJECTIVE_OBJECTIVE_IMPERSONATION', (fixture) => { fixture.b10OpenApi.components.schemas.B10SelfRatingOutcome.properties.objectiveNumerator = { type: 'integer' }; });
rejectMutation('REPORT_VERSION_REMOVAL', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.required = fixture.b10OpenApi.components.schemas.B10AssessmentReport.required.filter((field) => field !== 'reportVersion'); });
rejectMutation('REPORT_MASTERY_LEAK', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.properties.mastery = { type: 'string' }; });
rejectMutation('LEGACY_ATTEMPT_ROUTE_NOT_DEPRECATED', (fixture) => { b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint', 'put').deprecated = false; });
rejectMutation('LEGACY_DEPRECATION_DRIFT', (fixture) => { delete b10Operation(fixture, '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint', 'put')['x-p1r-deprecation'].migrationLink; });
rejectMutation('B2_LEGACY_ROUTE_NOT_DEPRECATED', (fixture) => { fixture.b2OpenApi.paths['/api/v1/assessment/sessions/{sessionId}/answers'].post.deprecated = false; });
rejectMutation('B2_EXAM_WRITE_NOT_DEPRECATED', (fixture) => { fixture.b2OpenApi.paths['/api/v1/exam/sessions/{sessionId}/submit'].post.deprecated = false; });
rejectMutation('ANTI_CHEAT_AUTHORITY_EFFECT', (fixture) => { fixture.b2OpenApi.paths['/api/v1/exam/sessions/{sessionId}/anti-cheat-events'].post['x-p1r-assessment-legacy'].forbiddenEffects = ['score']; });
rejectMutation('EVENT_RAW_RESPONSE_LEAK', (fixture) => { fixture.eventFragment.payloadSchemas.B10AssessmentAttemptSubmitted.properties.rawResponse = { type: 'string' }; });
rejectMutation('EVENT_RAW_RULE_LEAK', (fixture) => { fixture.catalog.payloadSchemas.B10AssessmentAttemptAssessed.properties.answerRule = { type: 'object' }; });
rejectMutation('EVENT_RECORDING_LEAK', (fixture) => { fixture.catalog.payloadSchemas.B10AssessmentAttemptAssessed.properties.recording = { type: 'string' }; });
rejectMutation('EVENT_SUBJECTIVE_OUTCOME_LEAK', (fixture) => { fixture.catalog.payloadSchemas.B10AssessmentAttemptAssessed.properties.outcomeKind.enum = ['SELF_RATING']; });
rejectMutation('EVENT_CANONICAL_PROMOTION', (fixture) => { fixture.catalog.events[0].status = 'CANONICAL_D2'; });
rejectMutation('EVENT_GAP_REOPEN', (fixture) => { fixture.gapRegistry.gaps[0].status = 'OPEN'; });
rejectMutation('EVENT_GAP_EVIDENCE_DRIFT', (fixture) => { fixture.gapRegistry.gaps[0].closureEvidence = null; });
rejectMutation('EVENT_MISSING_PIN', (fixture) => { fixture.catalog.payloadSchemas.B10AssessmentAttemptSubmitted.required = fixture.catalog.payloadSchemas.B10AssessmentAttemptSubmitted.required.filter((field) => field !== 'snapshotHash'); });
rejectMutation('AI_AUTHORITY_CLAIM', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.properties.aiScore = { type: 'number' }; });
rejectMutation('ANTI_CHEAT_AUTHORITY_CLAIM', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.properties.cheatingConclusion = { type: 'string' }; });
rejectMutation('OFFICIAL_CERTIFICATION_CLAIM', (fixture) => { fixture.b10OpenApi.components.schemas.B10AssessmentReport.properties.officialCertification = { type: 'string' }; });
rejectMutation('SCOPE_OWNER_DRIFT', (fixture) => { fixture.policy.scopeGroups.find((group) => group.id === 'downstream-learning-and-ui').downstreamOwner = 'assessment-service'; });
rejectMutation('RUNTIME_STATUS_PROMOTION', (fixture) => { fixture.policy.compatibilityPromotion.runtimeStatus = 'RUNTIME_VERIFIED'; });

test('repository assessment contract remains a static D2 policy boundary', () => {
  const report = validateAssessmentContract();
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.summary.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
});
