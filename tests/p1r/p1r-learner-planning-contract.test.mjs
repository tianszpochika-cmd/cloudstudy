import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  readLearnerPlanningContractInputs,
  validateLearnerPlanningContract,
  validateLearnerPlanningContractData,
} from '../../scripts/audit/p1r-learner-planning-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'config/p1r-learner-planning-contract.v1.json'), 'utf8'));

function makeSyntheticFixture() {
  const fixture = structuredClone(readLearnerPlanningContractInputs({ root }));
  fixture.goalOptionsPayload = {
    goalCatalogVersion: 'catalog-v1',
    contentLocale: 'zh-CN',
    generatedAt: '2026-08-30T00:00:00Z',
    options: fixture.policy.goalCatalog.goalCodes.map((goalCode) => ({
      goalCode,
      label: `localized-${goalCode}`,
      targetLevels: ['A1'],
      dailyQuotaMinutes: [5, 15, 30, 45],
    })),
  };
  return fixture;
}

function route(fixture, operationId) {
  return fixture.policy.canonicalRoutes.find((entry) => entry.operationId === operationId);
}

function b9Operation(fixture, operationId) {
  const entry = route(fixture, operationId);
  return fixture.b9OpenApi.paths[entry.path][entry.method.toLowerCase()];
}

function b9Schema(fixture, name) {
  return fixture.b9OpenApi.components.schemas[name];
}

function firstDayBranch(fixture, state) {
  return b9Schema(fixture, 'B9FirstDayProjection').allOf[1].oneOf
    .find((branch) => branch.properties.state.const === state);
}

function legacyOperation(fixture, operationId) {
  const entry = fixture.policy.legacyCompatibility.find((routeEntry) => routeEntry.operationId === operationId);
  return fixture.b1OpenApi.paths[entry.path][entry.method.toLowerCase()];
}

function eventEntry(document, eventName) {
  return document.events.find((entry) => entry.eventName === eventName);
}

function eventPayload(document, eventName) {
  const reference = eventEntry(document, eventName).payloadSchema.$ref;
  return document.payloadSchemas[reference.split('/').at(-1)];
}

function b26Topic(fixture) {
  return fixture.b26Runtime.topics.find((entry) => entry.name === fixture.policy.b26Static.topic.name);
}

function removeRequired(schema, field) {
  schema.required = schema.required.filter((candidate) => candidate !== field);
}

function removeNotField(branch, field) {
  branch.not.anyOf = branch.not.anyOf.filter((entry) => entry.required[0] !== field);
}

function rejectMutation(name, mutate) {
  test(`adversarial mutation: ${name}`, () => {
    const fixture = makeSyntheticFixture();
    mutate(fixture);
    const report = validateLearnerPlanningContractData(fixture);
    assert.equal(report.result, 'FAIL', `${name} must fail closed; got ${report.errors.join(' | ')}`);
  });
}

test('learner planning contract validator accepts the governed synthetic D2 fixture', () => {
  const report = validateLearnerPlanningContractData(makeSyntheticFixture());
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.summary.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
  assert.equal(report.summary.targetEventStatus, 'CANONICAL_D2');
});

test('B26 learner topic consumers remain exact while privacy consumers are added', () => {
  const fixture = makeSyntheticFixture();
  assert.deepEqual(fixture.policy.b26Static.topic.consumerGroups, [
    { name: 'cg.audit-from-learner.v1', service: 'audit-service', principal: 'cg.audit-from-learner.v1', replayEnabled: true },
    { name: 'cg.learning-from-learner.v1', service: 'learning-service', principal: 'cg.learning-from-learner.v1', replayEnabled: true },
    { name: 'cg.notification-from-learner.v1', service: 'notification-service', principal: 'cg.notification-from-learner.v1', replayEnabled: true },
    { name: 'cg.workflow-from-learner.v1', service: 'workflow-service', principal: 'cg.workflow-from-learner.v1', replayEnabled: true },
  ]);

  const missingConsumer = structuredClone(fixture);
  b26Topic(missingConsumer).consumerGroups.pop();
  const missingReport = validateLearnerPlanningContractData(missingConsumer);
  assert.equal(missingReport.result, 'FAIL');
  assert.match(missingReport.errors.join('\n'), /B26 learner consumers must exactly match the frozen policy contract/);

  const additionalConsumer = structuredClone(fixture);
  b26Topic(additionalConsumer).consumerGroups.push({
    name: 'cg.unapproved-from-learner.v1',
    service: 'unapproved-service',
    principal: 'cg.unapproved-from-learner.v1',
    replayEnabled: true,
  });
  const additionalReport = validateLearnerPlanningContractData(additionalConsumer);
  assert.equal(additionalReport.result, 'FAIL');
  assert.match(additionalReport.errors.join('\n'), /B26 learner consumers must exactly match the frozen policy contract/);
});

const mutations = {
  CONFIG_UNKNOWN_FIELD: (fixture) => { fixture.policy.unapprovedRuntimeClaim = true; },
  CONFIG_NESTED_UNKNOWN_FIELD: (fixture) => { fixture.policy.goalCatalog.freeformMode = true; },
  CONFIG_TYPE_DRIFT: (fixture) => { fixture.policy.runtimeBoundary.staticContractOnly = 'true'; },
  CONFIG_REQUIRED_FIELD_REMOVAL: (fixture) => { delete fixture.policy.b26Static; },
  CONFIG_DUPLICATE_ROUTE: (fixture) => { fixture.policy.canonicalRoutes.push(structuredClone(fixture.policy.canonicalRoutes[0])); },
  COMPATIBILITY_BASELINE_DRIFT: (fixture) => { fixture.policy.compatibilityPromotion.sourceContractBaseline = 'a55ac26045db7f2277521936b0fb6a2f39b0805e'; },
  COMPATIBILITY_SCOPE_DRIFT: (fixture) => { fixture.policy.compatibilityPromotion.scope = 'OPENAPI_ONLY'; },
  RUNTIME_STATUS_PROMOTION: (fixture) => { fixture.policy.runtimeStatus = 'RUNTIME_VERIFIED'; },
  RUNTIME_CLAIM_REMOVAL: (fixture) => { fixture.policy.runtimeBoundary.prohibitedRuntimeClaims.pop(); },
  GOAL_CODE_ENUM_DRIFT: (fixture) => { b9Schema(fixture, 'B9GoalOption').properties.goalCode.enum[0] = 'LEGACY'; },
  GOAL_CODE_FREEFORM_ACCEPTED: (fixture) => { delete b9Schema(fixture, 'B9LearnerTargetUpsert').properties.goalCode.enum; },
  GOAL_OPTION_LABEL_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9GoalOption'), 'label'); },
  GOAL_OPTIONS_UNIQUE_BY_DRIFT: (fixture) => { b9Schema(fixture, 'B9GoalOptions')['x-goal-catalog-policy'].uniqueBy = 'label'; },
  GOAL_OPTION_DUPLICATE_GOVERNANCE_WEAKENED: (fixture) => { b9Schema(fixture, 'B9GoalOptions').properties.options['x-unique-by'] = 'label'; },
  GOAL_OPTIONS_DUPLICATE_CODE_PAYLOAD: (fixture) => { fixture.goalOptionsPayload.options[1] = { ...fixture.goalOptionsPayload.options[1], goalCode: 'FOUNDATION', label: 'different-localized-label' }; },
  GOAL_PROFILE_COMPATIBILITY_AUTHORITY: (fixture) => { b9Schema(fixture, 'B9LearnerProfile')['x-planning-source-policy'].targetGoal = 'AUTHORITATIVE'; },
  PROFILE_TIMEZONE_PATTERN_DRIFT: (fixture) => { delete b9Schema(fixture, 'B9LearnerProfile').properties.timezone.pattern; },
  PREFERENCE_PLANNING_SOURCE_DRIFT: (fixture) => { b9Schema(fixture, 'B9LearnerPreferences')['x-planning-source-policy'].timezone = 'COMPATIBILITY_SHADOW'; },
  PREFERENCE_TIMEZONE_PATTERN_REMOVAL: (fixture) => { delete b9Schema(fixture, 'B9LearnerPreferencesPatch').properties.timezone.pattern; },
  PREFERENCE_WEEKLY_DAYS_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9LearnerPreferences'), 'weeklyStudyDays'); },
  DAILY_QUOTA_10_ACCEPTED: (fixture) => { b9Schema(fixture, 'B9LearnerTargetUpsert').properties.dailyQuotaMinutes.enum[1] = 10; },
  DAILY_QUOTA_20_ACCEPTED: (fixture) => { b9Schema(fixture, 'B9GoalOption').properties.dailyQuotaMinutes.items.enum[1] = 20; },
  DAILY_QUOTA_ENUM_REMOVAL: (fixture) => { delete b9Schema(fixture, 'B9LearnerTarget').properties.dailyQuotaMinutes.enum; },
  DAILY_QUOTA_DUPLICATE: (fixture) => { fixture.policy.goalCatalog.dailyQuotaMinutes[3] = 30; },
  B1_LEGACY_UNKNOWN_GOAL: (fixture) => { fixture.b1OpenApi.components.schemas.B1OnboardingProfileRequest.properties.targetGoal.enum[0] = 'UNKNOWN_LEGACY_GOAL'; },
  B1_LEGACY_MAPPING_DRIFT: (fixture) => { fixture.b1OpenApi.components.schemas.B1OnboardingProfileRequest['x-p1r-b9-target-mapping'].mappings[0].goalCode = 'COLLEGE_CET'; },
  B1_EXPECTED_VERSION_MINIMUM_DRIFT: (fixture) => { fixture.b1OpenApi.components.schemas.B1OnboardingProfileRequest.properties.expectedVersion.minimum = -1; },
  B1_BODYLESS_SOURCE_POLICY_REMOVAL: (fixture) => { delete legacyOperation(fixture, 'createB1FirstGoal')['x-p1r-b9-adapter'].sourceSnapshotSchema; },
  B1_BODYLESS_VERSION_POLICY_REMOVAL: (fixture) => { delete legacyOperation(fixture, 'createB1FirstGoal')['x-p1r-b9-adapter'].expectedStateVersionSource; },
  B1_BODYLESS_TARGET_MAPPING_POLICY_REMOVAL: (fixture) => { delete legacyOperation(fixture, 'createB1FirstGoal')['x-p1r-b9-adapter'].targetMappingPolicy; },
  B1_BODYLESS_REQUEST_BODY_EXPOSED: (fixture) => { legacyOperation(fixture, 'createB1FirstGoal').requestBody = { required: true, content: { 'application/json': { schema: { type: 'object' } } } }; },
  PROFILE_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9LearnerProfile'), 'profileVersion'); },
  PROFILE_VERSION_NULLABLE: (fixture) => { b9Schema(fixture, 'B9LearnerProfile').properties.profileVersion.nullable = true; },
  PROFILE_VERSION_ZERO: (fixture) => { b9Schema(fixture, 'B9LearnerProfile').properties.profileVersion = { type: 'integer', minimum: 0 }; },
  PROFILE_STATE_VERSION_MISMATCH: (fixture) => { b9Schema(fixture, 'B9LearnerProfile')['x-version-policy'].equality = 'profileVersion may differ'; },
  TARGET_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9LearnerTarget'), 'targetVersion'); },
  TARGET_VERSION_NULLABLE: (fixture) => { b9Schema(fixture, 'B9LearnerTarget').properties.targetVersion.nullable = true; },
  TARGET_VERSION_ZERO: (fixture) => { b9Schema(fixture, 'B9LearnerTarget').properties.targetVersion = { type: 'integer', minimum: 0 }; },
  TARGET_STATE_VERSION_MISMATCH: (fixture) => { b9Schema(fixture, 'B9LearnerTarget')['x-version-policy'].serverOwned = ['targetVersion']; },
  PREFERENCE_VERSION_MISMATCH: (fixture) => { b9Schema(fixture, 'B9LearnerPreferences')['x-version-policy'].clientMaySubmit = true; },
  PROFILE_EXPECTED_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9LearnerProfilePatch'), 'expectedStateVersion'); },
  TARGET_EXPECTED_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9LearnerTargetUpsert'), 'expectedStateVersion'); },
  PREFERENCE_EXPECTED_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9LearnerPreferencesPatch'), 'expectedStateVersion'); },
  B9_IF_MATCH_PARAMETER_REMOVAL: (fixture) => { b9Operation(fixture, 'putB9LearnerTarget').parameters = b9Operation(fixture, 'putB9LearnerTarget').parameters.filter((parameter) => parameter.$ref !== '#/components/parameters/B9IfMatch'); },
  B9_IF_MATCH_BINDING_DRIFT: (fixture) => { b9Operation(fixture, 'patchB9LearnerProfile')['x-concurrency'].comparison = 'NUMERIC_COERCION_ALLOWED'; },
  B9_IF_MATCH_PATTERN_DRIFT: (fixture) => { fixture.canonicalOpenApi.components.parameters.B9IfMatch.schema.pattern = '^.*$'; },
  B9_IDEMPOTENCY_SAME_KEY_REPLAY_DRIFT: (fixture) => { b9Operation(fixture, 'patchB9LearnerPreferences')['x-idempotency'].sameKeySamePayload = 'REEXECUTE_COMMAND'; },
  B9_IDEMPOTENCY_DIFFERENT_PAYLOAD_DRIFT: (fixture) => { b9Operation(fixture, 'putB9LearnerTarget')['x-idempotency'].sameKeyDifferentPayload = 'ALLOW_NEW_COMMAND'; },
  AUTHZ_DEFAULT_ALLOW: (fixture) => { b9Operation(fixture, 'getB9LearnerProfile')['x-authorization'].defaultDecision = 'ALLOW'; },
  AUTHZ_TRUSTED_FACT_REMOVAL: (fixture) => { b9Operation(fixture, 'putB9LearnerTarget')['x-authorization'].trustedFacts.pop(); },
  AUTHZ_PEP_DRIFT: (fixture) => { b9Operation(fixture, 'patchB9LearnerPreferences')['x-authorization'].pep = 'gateway-only'; },
  AUTHZ_CLIENT_AUTHORITY_WEAKENED: (fixture) => { b9Operation(fixture, 'getB9LearnerHomeProjection')['x-authorization'].clientAuthority = 'client fields are trusted'; },
  B9_BEARER_SECURITY_MISSING: (fixture) => { delete b9Operation(fixture, 'getB9LearnerProfile').security; },
  B9_BEARER_SECURITY_EMPTY: (fixture) => { b9Operation(fixture, 'putB9LearnerTarget').security = []; },
  CLIENT_TENANT_INJECTION: (fixture) => { b9Schema(fixture, 'B9LearnerProfilePatch').properties.tenantId = { type: 'string' }; },
  CLIENT_SUBJECT_INJECTION: (fixture) => { b9Schema(fixture, 'B9LearnerProfilePatch').properties.principalId = { type: 'string' }; },
  CLIENT_OWNER_INJECTION: (fixture) => { b9Schema(fixture, 'B9LearnerTargetUpsert').properties.ownerId = { type: 'string' }; },
  CLIENT_ADULT_GATE_INJECTION: (fixture) => { b9Schema(fixture, 'B9LearnerTargetUpsert').properties.adultGate = { type: 'boolean' }; },
  CLIENT_POLICY_VERSION_INJECTION: (fixture) => { b9Schema(fixture, 'B9LearnerPreferencesPatch').properties.policyVersion = { type: 'string' }; },
  CLIENT_TARGET_VERSION_INJECTION: (fixture) => { b9Schema(fixture, 'B9LearnerTargetUpsert').properties.targetVersion = { type: 'integer' }; },
  PROFILE_PATCH_TARGET_GOAL_NOT_REMOVAL: (fixture) => { delete b9Schema(fixture, 'B9LearnerProfilePatch').not; },
  PROFILE_PATCH_TARGET_GOAL_POLICY_DRIFT: (fixture) => { b9Schema(fixture, 'B9LearnerProfilePatch')['x-compatibility-shadow-policy'].targetGoal = 'AUTHORITATIVE'; },
  PROFILE_PATCH_TARGET_GOAL_422_REMOVAL: (fixture) => { delete b9Operation(fixture, 'patchB9LearnerProfile').responses['422']; },
  PLANNING_INPUT_UNKNOWN_FIELD: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').additionalProperties = true; },
  PLANNING_INPUT_PIN_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9PlanningInputSnapshot'), 'pinId'); },
  PLANNING_INPUT_VERSION_NULLABLE: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.pinVersion.nullable = true; },
  PLANNING_INPUT_DIGEST_REMOVAL: (fixture) => { delete b9Schema(fixture, 'B9PlanningInputSnapshot').properties.pinDigest; },
  PLANNING_INPUT_DIGEST_WEAKENED: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.pinDigest.minLength = 32; },
  PLANNING_INPUT_ELIGIBILITY_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9PlanningInputSnapshot'), 'eligibilitySnapshotVersion'); },
  PLANNING_INPUT_ELIGIBILITY_DIGEST_REMOVAL: (fixture) => { delete b9Schema(fixture, 'B9PlanningInputSnapshot').properties.eligibilitySnapshotDigest; },
  PLANNING_INPUT_ELIGIBILITY_DIGEST_WEAKENED: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.eligibilitySnapshotDigest.maxLength = 128; },
  PLANNING_INPUT_ELIGIBILITY_SOURCE_MAPPING_DRIFT: (fixture) => { delete b9Schema(fixture, 'B9PlanningInputSnapshot')['x-source-mapping'].iamEligibility; },
  PLANNING_INPUT_WATERMARK_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9PlanningInputSnapshot'), 'inputFactWatermark'); },
  PLANNING_INPUT_SOURCE_MAPPING_DRIFT: (fixture) => { delete b9Schema(fixture, 'B9PlanningInputSnapshot')['x-source-mapping'].learnerPreferences; },
  PLANNING_INPUT_PLACEMENT_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.placementRaw = { type: 'object' }; },
  PLANNING_INPUT_MASTERY_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.mastery = { type: 'string' }; },
  PLANNING_INPUT_ADULT_GATE_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.adultGate = { type: 'boolean' }; },
  PLANNING_INPUT_CONSENT_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.consent = { type: 'boolean' }; },
  PLANNING_INPUT_PHASE_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.phase = { type: 'string' }; },
  PLANNING_INPUT_POLICY_VERSION_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.policyVersion = { type: 'string' }; },
  PLANNING_INPUT_CONTENT_RIGHTS_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.contentRights = { type: 'string' }; },
  JOB_INPUT_BINDING_DRIFT: (fixture) => { b9Schema(fixture, 'B9PlanningJobRef')['x-input-binding'].inputPinVersion = 'MAY_DIFFER_FROM_PLANNING_INPUT'; },
  PLAN_REQUIRED_PIN_VERSION_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9PlanReference'), 'planningInputPinVersion'); },
  PLAN_PIN_VERSION_NULLABLE: (fixture) => { b9Schema(fixture, 'B9PlanReference').properties.planningInputPinVersion.nullable = true; },
  PLAN_WATERMARK_SHAPE_WEAKENED: (fixture) => { delete b9Schema(fixture, 'B9PlanReference').properties.inputFactWatermark.pattern; },
  PLAN_INPUT_BINDING_DRIFT: (fixture) => { b9Schema(fixture, 'B9PlanReference')['x-input-binding'].inputFactWatermark = 'MAY_DIFFER_FROM_PLANNING_INPUT'; },
  RECOVERY_INPUT_BINDING_DRIFT: (fixture) => { b9Schema(fixture, 'B9FirstDayRecovery')['x-input-binding']['job.inputPinId'] = 'MAY_DIFFER_FROM_PLANNING_INPUT'; },
  PROJECTION_WATERMARK_REMOVAL: (fixture) => { removeRequired(b9Schema(fixture, 'B9FirstDayProjectionCommon'), 'projectionWatermark'); },
  PROJECTION_WATERMARK_NULLABLE: (fixture) => { b9Schema(fixture, 'B9FirstDayProjectionCommon').properties.projectionWatermark.nullable = true; },
  FIRST_DAY_STATE_ENUM_DRIFT: (fixture) => { b9Schema(fixture, 'B9FirstDayProjectionCommon').properties.state.enum[0] = 'PENDING'; },
  FIRST_DAY_ONEOF_REMOVAL: (fixture) => { b9Schema(fixture, 'B9FirstDayProjection').allOf[1].oneOf.pop(); },
  FIRST_DAY_NOT_READY_PLAN_LEAK: (fixture) => { removeNotField(firstDayBranch(fixture, 'NOT_READY'), 'plan'); },
  FIRST_DAY_PROCESSING_RECOVERY_LEAK: (fixture) => { removeNotField(firstDayBranch(fixture, 'PROCESSING'), 'recovery'); },
  FIRST_DAY_READY_PIN_REMOVAL: (fixture) => { removeRequired(firstDayBranch(fixture, 'READY'), 'planningInput'); },
  FIRST_DAY_READY_TASKCOUNT_WEAKENED: (fixture) => { firstDayBranch(fixture, 'READY').properties.taskCount.minimum = 0; },
  FIRST_DAY_READY_TASKS_MINITEMS_WEAKENED: (fixture) => { firstDayBranch(fixture, 'READY').properties.tasks.minItems = 0; },
  FIRST_DAY_DEGRADED_REASON_REMOVAL: (fixture) => { removeRequired(firstDayBranch(fixture, 'DEGRADED'), 'degradedReason'); },
  FIRST_DAY_DEGRADED_REASON_ALIAS_LEAK: (fixture) => { firstDayBranch(fixture, 'DEGRADED').properties.reason = { type: 'string' }; },
  FIRST_DAY_DEGRADED_RECOVERY_REMOVAL: (fixture) => { removeRequired(firstDayBranch(fixture, 'DEGRADED'), 'recovery'); },
  FIRST_DAY_DEGRADED_TASK_LEAK: (fixture) => { firstDayBranch(fixture, 'DEGRADED').properties.tasks.maxItems = 1; },
  STATE_NOT_GUARD_WEAKENED: (fixture) => { firstDayBranch(fixture, 'READY').not = { required: ['blocker'] }; },
  FIRST_DAY_INPUT_CONSISTENCY_REMOVAL: (fixture) => { b9Schema(fixture, 'B9FirstDayProjectionCommon')['x-consistency'].pop(); },
  PROCESSING_JOB_STATUS_SCOPE_DRIFT: (fixture) => { firstDayBranch(fixture, 'PROCESSING').properties.job.allOf[1].properties.status.enum.push('FAILED'); },
  DEGRADED_RECOVERY_STATUS_SCOPE_DRIFT: (fixture) => { firstDayBranch(fixture, 'DEGRADED').properties.recovery.allOf[1].properties.status.enum.pop(); },
  RECOVERY_PATH_PARAM_REMOVAL: (fixture) => { b9Operation(fixture, 'getB9FirstDayRecovery').parameters = []; },
  RECOVERY_POST_EXPOSED: (fixture) => { fixture.b9OpenApi.paths[fixture.policy.recovery.path].post = { operationId: 'postB9FirstDayRecovery' }; },
  RECOVERY_REQUEST_BODY_EXPOSED: (fixture) => { b9Operation(fixture, 'getB9FirstDayRecovery').requestBody = { required: true, content: { 'application/json': { schema: { type: 'object' } } } }; },
  RECOVERY_CROSS_SUBJECT_BINDING_DRIFT: (fixture) => { b9Operation(fixture, 'getB9FirstDayRecovery')['x-contract'].subjectBinding = 'client provides principalId'; },
  RECOVERY_OPERATOR_FIELD_LEAK: (fixture) => { b9Schema(fixture, 'B9FirstDayRecovery').properties.rawError = { type: 'string' }; },
  RECOVERY_CLIENT_EXECUTION_ENABLED: (fixture) => { fixture.policy.recovery.clientMayExecuteRecovery = true; },
  RECOVERY_PROJECTION_WATERMARK_REMOVAL: (fixture) => { delete b9Schema(fixture, 'B9FirstDayRecovery').properties.projectionWatermark; },
  RECOVERY_RETRYABLE_STATE_DRIFT: (fixture) => { b9Schema(fixture, 'B9FirstDayRecovery').oneOf[1].properties.retryable.const = false; },
  JOB_RETRYABLE_STATE_DRIFT: (fixture) => { b9Schema(fixture, 'B9PlanningJobRef').oneOf[2].properties.lastErrorCode.enum = ['NONE']; },
  B1_LEGACY_NOT_DEPRECATED: (fixture) => { legacyOperation(fixture, 'getB1OnboardingOptions').deprecated = false; },
  B1_LEGACY_NOT_ADAPTER_ONLY: (fixture) => { legacyOperation(fixture, 'getB1OnboardingProfile')['x-p1r-b9-adapter'].adapterOnly = false; },
  B1_LEGACY_REPLACEMENT_DRIFT: (fixture) => { legacyOperation(fixture, 'createB1FirstGoal')['x-p1r-b9-adapter'].replacementOperationId = 'getB9FirstDayProjection'; },
  B1_LEGACY_AUTHZ_ALLOW: (fixture) => { legacyOperation(fixture, 'saveB1OnboardingProfile')['x-authorization'].defaultDecision = 'ALLOW'; },
  B1_LEGACY_TRUSTED_FACT_REMOVAL: (fixture) => { legacyOperation(fixture, 'patchB1OnboardingProfile')['x-authorization'].trustedFacts.pop(); },
  B1_LEGACY_RESPONSE_422_REMOVAL: (fixture) => { delete legacyOperation(fixture, 'createB1FirstGoal').responses['422']; },
  B1_IDEMPOTENCY_SAME_KEY_REPLAY_DRIFT: (fixture) => { legacyOperation(fixture, 'saveB1OnboardingProfile')['x-idempotency'].sameKeySamePayload = 'REEXECUTE_COMMAND'; },
  B1_IDEMPOTENCY_DIFFERENT_PAYLOAD_DRIFT: (fixture) => { legacyOperation(fixture, 'patchB1OnboardingProfile')['x-idempotency'].sameKeyDifferentPayload = 'ALLOW_NEW_COMMAND'; },
  B1_BEARER_SECURITY_MISSING: (fixture) => { delete legacyOperation(fixture, 'getB1OnboardingOptions').security; },
  B1_BEARER_SECURITY_EMPTY: (fixture) => { legacyOperation(fixture, 'createB1FirstGoal').security = []; },
  EVENT_PROFILE_PAYLOAD_LEAK: (fixture) => { eventPayload(fixture.eventFragment, 'learner.profile.updated.v1').properties.profile = { type: 'object' }; },
  EVENT_TARGET_REQUIRED_PIN_REMOVAL: (fixture) => { removeRequired(eventPayload(fixture.eventFragment, 'learner.target.updated.v1'), 'profileVersion'); },
  EVENT_TARGET_GOAL_ENUM_DRIFT: (fixture) => { eventPayload(fixture.catalog, 'learner.target.updated.v1').properties.goalCode.enum[0] = 'UNKNOWN'; },
  EVENT_TARGET_SELF_CONTAINED_PREFERENCE_REMOVAL: (fixture) => { removeRequired(eventPayload(fixture.catalog, 'learner.target.updated.v1'), 'weeklyStudyDays'); },
  EVENT_TARGET_DIGEST_WEAKENED: (fixture) => { eventPayload(fixture.eventFragment, 'learner.target.updated.v1').properties.targetSnapshotDigest.maxLength = 128; },
  EVENT_TARGET_ADULT_GATE_LEAK: (fixture) => { eventPayload(fixture.catalog, 'learner.target.updated.v1').properties.adultGate = { type: 'boolean' }; },
  EVENT_TARGET_CONSENT_LEAK: (fixture) => { eventPayload(fixture.eventFragment, 'learner.target.updated.v1').properties.consent = { type: 'boolean' }; },
  EVENT_TARGET_POLICY_VERSION_LEAK: (fixture) => { eventPayload(fixture.catalog, 'learner.target.updated.v1').properties.policyVersion = { type: 'string' }; },
  EVENT_TARGET_CONTENT_RIGHTS_LEAK: (fixture) => { eventPayload(fixture.eventFragment, 'learner.target.updated.v1').properties.contentRights = { type: 'string' }; },
  EVENT_TARGET_HISTORICAL_DEMOTION: (fixture) => { eventEntry(fixture.catalog, 'learner.target.updated.v1').status = 'HISTORICAL_CANDIDATE'; },
  EVENT_FIRST_DAY_PIN_REMOVAL: (fixture) => { delete eventPayload(fixture.eventFragment, 'learner.first_day.projected.v1').properties.planningInputVersion; },
  EVENT_FIRST_DAY_FAILURE_RAW_LEAK: (fixture) => { eventPayload(fixture.catalog, 'learner.first_day.projected.v1').properties.rawError = { type: 'string' }; },
  EVENT_GOVERNANCE_RUNTIME_PROMOTION: (fixture) => { eventEntry(fixture.catalog, 'learner.target.updated.v1')['x-p1r-governance'].runtimeStatus = 'RUNTIME_VERIFIED'; },
  EVENT_GAP_D2_STATUS_DRIFT: (fixture) => { fixture.catalog['x-p1r-event-governance'].plannedClosures.find((entry) => entry.gapId === 'EVENT-GAP-ONB-001').status = 'PLANNED'; },
  EVENT_GAP_REGISTRY_CLOSED: (fixture) => { fixture.gapRegistry.gaps.find((entry) => entry.id === 'EVENT-GAP-ONB-001').status = 'CLOSED'; },
  B26_TOPIC_OWNER_DRIFT: (fixture) => { fixture.b26Runtime.topics.find((entry) => entry.name === 'platform.learner.v1').ownerService = 'workflow-service'; },
  B26_CONSUMER_DRIFT: (fixture) => { fixture.b26Runtime.eventRouting.find((entry) => entry.eventName === 'learner.target.updated.v1').consumerGroups.pop(); },
  B26_RUNTIME_PROMOTION: (fixture) => { fixture.b26Runtime.runtimeStatus = 'ready'; },
  DATA_OWNER_DRIFT: (fixture) => { fixture.dataOwnership.serviceOwners.find((entry) => entry.service === 'learning-service').dataOwner = false; },
  CROSS_OWNER_WRITE_ALLOWED: (fixture) => { fixture.policy.ownership.forbiddenCrossOwnerWrites = fixture.policy.ownership.forbiddenCrossOwnerWrites.filter((entry) => entry !== 'learner-service->learning-plan'); },
  M1_012_PLACEMENT_SCOPE_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.placementScore = { type: 'number' }; },
  M1_013_PLAN_SRS_SCOPE_LEAK: (fixture) => { b9Schema(fixture, 'B9PlanningInputSnapshot').properties.srsState = { type: 'object' }; },
};

test('adversarial matrix is complete and frozen', () => {
  assert.deepEqual(Object.keys(mutations).sort(), [...policy.adversarialCases].sort());
  assert.ok(policy.adversarialCases.length >= 60);
});

for (const caseName of policy.adversarialCases) rejectMutation(caseName, mutations[caseName]);

test('repository learner planning contract remains a static D2 policy boundary', () => {
  const report = validateLearnerPlanningContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.equal(report.summary.runtimeStatus, 'NOT_RUNTIME_VERIFIED');
});

test('M1-012 placement successor policy is an immutable current-source trust anchor', () => {
  const fixture = makeSyntheticFixture();
  fixture.placementPolicy.learnerPlanningSuccessor.firstDay.addedConsistency.pop();
  const report = validateLearnerPlanningContractData(fixture);
  assert.equal(report.result, 'FAIL');
  assert.match(report.errors.join('\n'), /M1-012 placement successor policy digest drift/);
});

test('M1-012 B9 placement-to-plan binding cannot drift from the frozen successor', () => {
  const fixture = makeSyntheticFixture();
  b9Schema(fixture, 'B9PlanningInputSnapshot')['x-p1r-placement-plan-saga'].effectDedupeKey.pop();
  const report = validateLearnerPlanningContractData(fixture);
  assert.equal(report.result, 'FAIL');
  assert.match(report.errors.join('\n'), /placement-to-plan saga binding/);
});

test('learner planning contract CLI emits a passing machine-readable report', () => {
  const result = spawnSync(process.execPath, ['scripts/audit/p1r-learner-planning-contract-check.mjs', '--json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, 'PASS');
  assert.equal(report.summary.targetEventStatus, 'CANONICAL_D2');
});
