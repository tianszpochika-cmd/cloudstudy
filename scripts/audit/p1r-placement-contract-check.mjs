import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PLACEMENT_POLICY = "config/p1r-placement-contract.v1.json";
export const DEFAULT_B10_PLACEMENT_FRAGMENT =
  "packages/contracts/fragments/b10/b10-placement.openapi.json";
export const DEFAULT_B10_ASSESSMENT_FRAGMENT =
  "packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json";
export const DEFAULT_B1_ONBOARDING_PRIVACY_FRAGMENT =
  "packages/contracts/fragments/b1/b1-onboarding-privacy.openapi.json";
export const DEFAULT_B1_AUTH_ONBOARDING_FRAGMENT =
  "packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json";
export const DEFAULT_B9_LEARNER_FRAGMENT =
  "packages/contracts/fragments/b9/b9-learner.openapi.json";
export const DEFAULT_PLACEMENT_EVENT_FRAGMENT =
  "packages/contracts/events/v1/fragments/b10-learning-assessment.events.json";
export const DEFAULT_EVENT_CATALOG =
  "packages/contracts/events/v1/catalog.json";
export const DEFAULT_B26_STATIC_POLICY = "config/b26-event-runtime.json";
export const FROZEN_POLICY_DIGEST =
  "9eb39bdaa5f4965d3940b3718dbaf519832948912acaaf5a3d78954dcc4f303b";

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ROOT_KEYS = Object.freeze([
  "$schema",
  "schemaVersion",
  "task",
  "phase",
  "maturity",
  "runtimeStatus",
  "compatibilityPromotion",
  "canonicalSources",
  "sourceContractBaseline",
  "startCommit",
  "scope",
  "integrationDependencies",
  "runtimeBoundary",
  "manifest",
  "scoring",
  "coverageAndConfidence",
  "levelBoundaries",
  "resultSafety",
  "pins",
  "sessionRecovery",
  "resultImmutability",
  "skip",
  "authorization",
  "ownership",
  "completionEvent",
  "placementPlanSaga",
  "gapBoundaries",
  "contractIntegration",
  "learnerPlanningSuccessor",
  "adversarialCases",
]);

const DIMENSIONS = Object.freeze([
  Object.freeze({
    id: "VOCABULARY",
    weight: 25,
    requiredItemCount: 3,
    displayOrder: 1,
  }),
  Object.freeze({
    id: "BASIC_GRAMMAR",
    weight: 25,
    requiredItemCount: 3,
    displayOrder: 2,
  }),
  Object.freeze({
    id: "READING",
    weight: 25,
    requiredItemCount: 2,
    displayOrder: 3,
  }),
  Object.freeze({
    id: "LISTENING",
    weight: 25,
    requiredItemCount: 2,
    displayOrder: 4,
  }),
]);
const LEVEL_BOUNDARIES = Object.freeze([
  Object.freeze({ minimum: 0, maximum: 39, referenceLevel: "A1" }),
  Object.freeze({ minimum: 40, maximum: 59, referenceLevel: "A2" }),
  Object.freeze({ minimum: 60, maximum: 74, referenceLevel: "B1" }),
  Object.freeze({ minimum: 75, maximum: 84, referenceLevel: "B2" }),
  Object.freeze({ minimum: 85, maximum: 92, referenceLevel: "C1" }),
  Object.freeze({ minimum: 93, maximum: 100, referenceLevel: "C2" }),
]);
const SOURCE_BASELINE = "270b0dfbf8dbec1329b8dc7036ee3e7490a8ffb3";
const START_COMMIT = "35d78f9";
const REQUIRED_TRUSTED_FACTS = Object.freeze([
  "subject",
  "tenant",
  "adultGate",
  "phase",
  "contentRights",
  "entitlement",
  "resourceOwner",
  "policyVersion",
]);
const RUNTIME_CLAIMS = Object.freeze([
  "assessment-service-placement-session-persisted",
  "assessment-service-placement-report-persisted",
  "outbox-or-kafka-placement-completion-delivery-verified",
  "workflow-placement-saga-executed",
  "learning-plan-or-learner-projection-created",
  "gateway-or-resource-server-pep-verified",
  "browser-or-device-placement-e2e-verified",
]);
const MANIFEST_PIN_FIELDS = Object.freeze([
  "placementManifestId",
  "placementManifestVersion",
  "placementManifestDigest",
  "dimensionSetDigest",
  "totalItemCount",
]);
const CONTENT_PIN_FIELDS = Object.freeze([
  "contentVersionId",
  "contentEpoch",
  "snapshotId",
  "snapshotHash",
]);
const ANSWER_RULE_PIN_FIELDS = Object.freeze([
  "answerRuleSetVersion",
  "answerRuleVersion",
  "ruleDigest",
  "completionRuleVersion",
]);
const SESSION_PIN_FIELDS = Object.freeze([
  "sessionId",
  "stateVersion",
  "sessionSnapshotDigest",
]);
const RESULT_PIN_FIELDS = Object.freeze([
  "placementResultId",
  "resultVersion",
  "reportId",
  "reportVersion",
  "reportDigest",
  "resultDigest",
  "completedAt",
]);
const COMPLETION_EVENT_FORBIDDEN_FIELDS = Object.freeze([
  "rawResponse",
  "response",
  "responses",
  "answer",
  "answers",
  "answerKey",
  "answerRule",
  "recording",
  "recordingUrl",
  "estimatedVocabulary",
  "preciseVocabularyCount",
  "officialCertification",
  "mastery",
  "aiScore",
  "aiRecommendation",
]);
const EXPECTED_ROUTES = Object.freeze([
  Object.freeze({
    path: "/api/v1/assessment/placement/sessions",
    method: "POST",
    operationId: "createB10PlacementSession",
  }),
  Object.freeze({
    path: "/api/v1/assessment/placement/sessions/{sessionId}",
    method: "GET",
    operationId: "getB10PlacementSession",
  }),
  Object.freeze({
    path: "/api/v1/assessment/placement/sessions/{sessionId}/responses",
    method: "POST",
    operationId: "submitB10PlacementResponse",
  }),
  Object.freeze({
    path: "/api/v1/assessment/placement/baselines/skip",
    method: "POST",
    operationId: "createB10PlacementSkipBaseline",
  }),
  Object.freeze({
    path: "/api/v1/assessment/placement/reports/{reportId}",
    method: "GET",
    operationId: "getB10PlacementReport",
  }),
]);
const CANONICAL_SOURCES = Object.freeze({
  b10PlacementFragment: DEFAULT_B10_PLACEMENT_FRAGMENT,
  b10AssessmentFragment: DEFAULT_B10_ASSESSMENT_FRAGMENT,
  b1OnboardingPrivacyFragment: DEFAULT_B1_ONBOARDING_PRIVACY_FRAGMENT,
  b1AuthOnboardingFragment: DEFAULT_B1_AUTH_ONBOARDING_FRAGMENT,
  eventFragment: DEFAULT_PLACEMENT_EVENT_FRAGMENT,
  eventCatalog: DEFAULT_EVENT_CATALOG,
});
const COMPATIBILITY_PROMOTION = Object.freeze({
  id: "P1R-M1-012",
  sourceContractBaseline: SOURCE_BASELINE,
  previousPromotion: "M1-011_LEARNER_PLANNING_CONTRACT_PROMOTION",
  immutableGovernanceBaseline: "868c2177f62b6d2cf613bed702686dddcfe6943f",
  runtimeStatus: "NOT_RUNTIME_VERIFIED",
  scope: "OPENAPI_EVENT_GOVERNANCE_B26_STATIC",
  canonicalFragment: DEFAULT_B10_PLACEMENT_FRAGMENT,
  legacyAdapterFragments: [
    DEFAULT_B1_ONBOARDING_PRIVACY_FRAGMENT,
    DEFAULT_B1_AUTH_ONBOARDING_FRAGMENT,
  ],
  planningFragment: DEFAULT_B9_LEARNER_FRAGMENT,
  eventFragment: DEFAULT_PLACEMENT_EVENT_FRAGMENT,
  b26StaticPolicy: "config/b26-event-runtime.json",
});
const LEARNER_PLANNING_SUCCESSOR = Object.freeze({
  task: "P1R-M1-012",
  basePolicyId: "M1-011_LEARNER_PLANNING_CONTRACT_PROMOTION",
  planningFragment: DEFAULT_B9_LEARNER_FRAGMENT,
  placementBaselineSchema: "B9PlacementBaseline",
  planningInput: {
    schema: "B9PlanningInputSnapshot",
    addedRequiredFields: ["contentVersionId", "placementBaseline"],
    addedForbiddenFields: [
      "placementRaw",
      "placementScore",
      "placementAlgorithm",
      "aggregateScore",
      "dimensionSummaries",
      "placementReport",
      "placementResult",
      "srsState",
      "mastery",
      "adultGate",
      "consent",
      "phase",
      "policyVersion",
      "contentRights",
    ],
    sourceMappingAdditions: {
      contentProjection: ["contentVersionId"],
      assessmentPlacement: ["placementBaseline"],
    },
  },
  placementBinding: {
    sourceEvent: "assessment.placement.completed.v1",
    planningInputOwner: "learning-service",
    assembleOrReplayBeforePlan: true,
    activePlanNaturalKey: [
      "targetId",
      "contentVersionId",
      "contentEpoch",
      "planningRuleVersion",
    ],
    effectDedupeKey: [
      "placementBaseline.placementSessionId",
      "placementBaseline.placementResultId",
      "placementBaseline.resultVersion",
      "targetVersion",
      "pinId",
      "pinVersion",
      "pinDigest",
      "inputFactWatermark",
    ],
    pinConsistency:
      "placementBaseline target/content pins, sourceEventId and rootEventId MUST equal their planning-input counterparts",
    lineage: {
      sourceEventId:
        "DERIVED_BY_LEARNING_FROM_ASSESSMENT_COMPLETION_ENVELOPE_EVENT_ID",
      rootEventId:
        "FIRST_DURABLE_COMPLETION_SAGA_ROOT_EQUALS_ASSESSMENT_COMPLETION_ENVELOPE_EVENT_ID",
      assessmentPayloadEventIdentityFields: "PROHIBITED",
    },
    rawAuthorityFacts: "PROHIBITED",
    runtimeStatus: "NOT_RUNTIME_VERIFIED",
  },
  firstDay: {
    commonSchema: "B9FirstDayProjectionCommon",
    addedConsistency: [
      "placementStatus=COMPLETED implies planningInput.placementBaseline.resultKind=ASSESSED",
      "placementStatus=SKIPPED implies planningInput.placementBaseline.resultKind=SKIPPED",
      "planningInput placement baseline target/content pins and lineage MUST remain bound while PROCESSING, READY or DEGRADED",
    ],
  },
  lineage: {
    sourceEventId:
      "DERIVED_BY_LEARNING_FROM_ASSESSMENT_COMPLETION_ENVELOPE_EVENT_ID",
    rootEventId:
      "FIRST_DURABLE_COMPLETION_SAGA_ROOT_EQUALS_ASSESSMENT_COMPLETION_ENVELOPE_EVENT_ID",
    assessmentPayloadEventIdentityFields: "PROHIBITED",
  },
});
const B10_ROUTE_POLICIES = Object.freeze([
  Object.freeze({
    ...EXPECTED_ROUTES[0],
    lifecycle: "CREATE_SERVER_PINNED_SESSION",
    legacyAdapter: "startPlacementSession",
    responseStatuses: ["201", "401", "403", "409", "422"],
    requestBody: "FORBIDDEN",
    idempotency: true,
  }),
  Object.freeze({
    ...EXPECTED_ROUTES[1],
    lifecycle: "READ_SAME_SESSION",
    legacyAdapter: "readPlacementSession",
    responseStatuses: ["200", "401", "403", "404"],
    requestBody: "FORBIDDEN",
    idempotency: false,
  }),
  Object.freeze({
    ...EXPECTED_ROUTES[2],
    lifecycle: "CHECKPOINT_OR_COMPLETE_SAME_SESSION",
    legacyAdapter: "submitPlacementStep",
    responseStatuses: ["200", "401", "403", "409", "422"],
    requestBody: "B10PlacementResponseSubmitRequest",
    idempotency: true,
  }),
  Object.freeze({
    ...EXPECTED_ROUTES[3],
    lifecycle: "CREATE_UNVERIFIED_BASELINE",
    legacyAdapter: "skipB1Placement",
    responseStatuses: ["201", "401", "403", "409", "422"],
    requestBody: "B10PlacementSkipBaselineRequest",
    requestBodyRequired: false,
    idempotency: true,
  }),
  Object.freeze({
    ...EXPECTED_ROUTES[4],
    lifecycle: "READ_IMMUTABLE_RESULT_REPORT",
    legacyAdapter: "getB1PlacementReport",
    responseStatuses: ["200", "401", "403", "404"],
    requestBody: "FORBIDDEN",
    idempotency: false,
  }),
]);
const LEGACY_PLACEMENT_ADAPTERS = Object.freeze([
  Object.freeze({
    document: "b1OnboardingPrivacy",
    path: "/api/v1/assessment/placement/start",
    method: "GET",
    operationId: "readPlacementSession",
    canonicalOperationId: "getB10PlacementSession",
    canonicalRoute: "/api/v1/assessment/placement/sessions/{sessionId}",
  }),
  Object.freeze({
    document: "b1OnboardingPrivacy",
    path: "/api/v1/assessment/placement/start",
    method: "POST",
    operationId: "startPlacementSession",
    canonicalOperationId: "createB10PlacementSession",
    canonicalRoute: "/api/v1/assessment/placement/sessions",
  }),
  Object.freeze({
    document: "b1OnboardingPrivacy",
    path: "/api/v1/assessment/placement/submit-step",
    method: "POST",
    operationId: "submitPlacementStep",
    canonicalOperationId: "submitB10PlacementResponse",
    canonicalRoute:
      "/api/v1/assessment/placement/sessions/{sessionId}/responses",
  }),
  Object.freeze({
    document: "b1AuthOnboarding",
    path: "/api/v1/assessment/placement/skip",
    method: "POST",
    operationId: "skipB1Placement",
    canonicalOperationId: "createB10PlacementSkipBaseline",
    canonicalRoute: "/api/v1/assessment/placement/baselines/skip",
  }),
  Object.freeze({
    document: "b1AuthOnboarding",
    path: "/api/v1/assessment/placement/report/{sessionId}",
    method: "GET",
    operationId: "getB1PlacementReport",
    canonicalOperationId: "getB10PlacementReport",
    canonicalRoute: "/api/v1/assessment/placement/reports/{reportId}",
  }),
]);
const PLACEMENT_EVENT_REQUIRED_FIELDS = Object.freeze([
  "tenantId",
  "principalId",
  "sessionId",
  "stateVersion",
  "sessionSnapshotDigest",
  "placementResultId",
  "resultVersion",
  "reportId",
  "reportVersion",
  "resultDigest",
  "reportDigest",
  "placementManifestId",
  "placementManifestVersion",
  "placementManifestDigest",
  "dimensionSetDigest",
  "totalItemCount",
  "contentVersionId",
  "contentEpoch",
  "snapshotId",
  "snapshotHash",
  "answerRuleSetVersion",
  "answerRuleVersion",
  "ruleDigest",
  "completionRuleVersion",
  "targetId",
  "targetVersion",
  "targetSnapshotDigest",
  "resultKind",
  "completionStatus",
  "aggregateScore",
  "referenceLevel",
  "confidence",
  "coverageRatio",
  "completedAt",
]);
const PLACEMENT_EVENT_PROPERTY_ALLOWLIST = Object.freeze([
  ...PLACEMENT_EVENT_REQUIRED_FIELDS,
  "dimensionSummaries",
  "requestedStartingLevel",
]);
const EVENT_ENVELOPE_ONLY_FIELDS = Object.freeze([
  "eventId",
  "eventName",
  "schema",
  "version",
  "schemaVersion",
  "occurredAt",
  "dedupeKey",
]);
const EVENT_PAYLOAD_FORBIDDEN_FIELDS = Object.freeze([
  ...EVENT_ENVELOPE_ONLY_FIELDS,
  "sourceEventId",
  "rootEventId",
  "adultGate",
  "consent",
  "phase",
  "policyVersion",
  "contentRights",
  "entitlement",
  "resourceOwner",
  ...COMPLETION_EVENT_FORBIDDEN_FIELDS,
]);
const EXPECTED_ADVERSARIAL_CASES = Object.freeze([
  "CONFIG_UNKNOWN_FIELD",
  "CONFIG_REQUIRED_FIELD_REMOVAL",
  "CONFIG_RUNTIME_PROMOTION",
  "SOURCE_BASELINE_DRIFT",
  "MANIFEST_ID_DRIFT",
  "MANIFEST_DIMENSION_UNKNOWN",
  "MANIFEST_DIMENSION_ORDER_DRIFT",
  "MANIFEST_DIMENSION_COUNT_DRIFT",
  "MANIFEST_TOTAL_ITEM_COUNT_DRIFT",
  "MANIFEST_WEIGHT_DRIFT",
  "MANIFEST_WEIGHT_SUM_NOT_100",
  "SCORING_CORRECT_VALUE_DRIFT",
  "SCORING_UNANSWERED_VALUE_DRIFT",
  "SCORING_TIME_FLIPS_CORRECTNESS",
  "SCORING_FORMULA_DRIFT",
  "DIMENSION_ROUNDING_DRIFT",
  "AGGREGATE_ROUNDING_DRIFT",
  "ROUNDING_ORDER_DRIFT",
  "LEVEL_BOUNDARY_GAP",
  "LEVEL_BOUNDARY_OVERLAP",
  "LEVEL_BOUNDARY_DRIFT",
  "RESULT_OFFICIAL_CLAIM",
  "RESULT_PRECISE_VOCABULARY_LEAK",
  "CONFIDENCE_HIGH_THRESHOLD_DRIFT",
  "CONFIDENCE_MEDIUM_THRESHOLD_DRIFT",
  "CONFIDENCE_LOW_ZERO_ACCEPTED",
  "COVERAGE_CORRECTNESS_CONFLATION",
  "COVERAGE_MISSING_DIMENSION_PROMOTED",
  "PIN_MANIFEST_FIELD_REMOVAL",
  "PIN_CONTENT_FIELD_REMOVAL",
  "PIN_ANSWER_RULE_FIELD_REMOVAL",
  "PIN_DIGEST_PATTERN_WEAKENED",
  "SESSION_RECOVERY_NEW_SESSION_ALLOWED",
  "SESSION_RECOVERY_SNAPSHOT_DRIFT_ALLOWED",
  "SESSION_RECOVERY_TERMINAL_ALLOWED",
  "FIRST_DURABLE_RESULT_MUTABLE",
  "IDEMPOTENCY_SAME_KEY_REEXECUTES",
  "IDEMPOTENCY_DIFFERENT_PAYLOAD_NOT_409",
  "RECALIBRATION_OVERWRITES_ORIGINAL",
  "SKIP_CONFIDENCE_DRIFT",
  "SKIP_REFERENCE_LEVEL_LEAK",
  "CLIENT_SCORE_INJECTION",
  "CLIENT_LEVEL_INJECTION",
  "CLIENT_RECOMMENDATION_INJECTION",
  "CLIENT_TENANT_INJECTION",
  "CLIENT_ANSWER_KEY_INJECTION",
  "AUTHORIZATION_DEFAULT_ALLOW",
  "AUTHORIZATION_TRUSTED_FACT_REMOVAL",
  "PEP_NOT_SERVICE_SIDE",
  "ASSESSMENT_OWNER_DRIFT",
  "WORKFLOW_FOREIGN_WRITE_ALLOWED",
  "LEARNING_REPORT_WRITE_ALLOWED",
  "LEARNER_PLAN_WRITE_ALLOWED",
  "AUDIT_REPORT_OWNER_DRIFT",
  "COMPLETION_EVENT_HISTORICAL_DEMOTION",
  "COMPLETION_EVENT_RESULT_KIND_OPEN",
  "COMPLETION_EVENT_ENVELOPE_FIELD_PAYLOAD_LEAK",
  "COMPLETION_EVENT_RAW_RESPONSE_LEAK",
  "COMPLETION_EVENT_ANSWER_RULE_LEAK",
  "COMPLETION_EVENT_ASSESSED_SUMMARY_REMOVAL",
  "COMPLETION_EVENT_SKIP_CONFIDENCE_DRIFT",
  "COMPLETION_EVENT_SKIP_COVERAGE_DRIFT",
  "COMPLETION_EVENT_SKIP_SCORE_LEAK",
  "COMPLETION_EVENT_SKIP_LEVEL_LEAK",
  "COMPLETION_EVENT_SKIP_DIMENSION_LEAK",
  "COMPLETION_EVENT_SKIP_ALGORITHM_LEAK",
  "COMPLETION_EVENT_SKIP_STARTING_LEVEL_AUTHORITY",
  "COMPLETION_EVENT_DUPLICATE_ALLOWED",
  "COMPLETION_EVENT_BEFORE_DURABLE",
  "COMPLETION_EVENT_RUNTIME_PROMOTION",
  "SAGA_UNKNOWN_STEP",
  "SAGA_STEP_ORDER_DRIFT",
  "SAGA_PLANNING_INPUT_STEP_REMOVAL",
  "SAGA_PLANNING_INPUT_NATURAL_KEY_DRIFT",
  "SAGA_PLAN_EFFECT_DEDUPE_DRIFT",
  "SAGA_FOREIGN_WRITE_ALLOWED",
  "SAGA_DUPLICATE_PLAN_ALLOWED",
  "SAGA_FAILURE_MUTATES_REPORT",
  "SAGA_RECOVERY_DROPS_REPORT",
  "SAGA_KAFKA_RPC_ENABLED",
  "SAGA_2PC_ENABLED",
  "GAP_CLOSURE_FROM_POLICY",
  "B26_RUNTIME_PROMOTION",
  "RUNTIME_CLAIM_REMOVAL",
  "CONTRACT_INTEGRATION_PREMATURE_COMPLETION",
  "CONTRACT_ROUTE_ALLOWLIST_DRIFT",
  "CONTRACT_SCHEMA_ALLOWLIST_DRIFT",
  "CONTRACT_ROUTE_CLIENT_AUTHORITY_LEAK",
  "COMPATIBILITY_PROMOTION_BASELINE_DRIFT",
  "COMPATIBILITY_PROMOTION_RUNTIME_PROMOTION",
  "SOURCE_CANONICAL_ROUTE_ALLOWLIST_DRIFT",
  "SOURCE_CANONICAL_OPERATION_ID_DRIFT",
  "SOURCE_CANONICAL_ROUTE_DEPRECATED",
  "SOURCE_CANONICAL_BEARER_SECURITY_DRIFT",
  "SOURCE_CANONICAL_DEFAULT_ALLOW",
  "SOURCE_CANONICAL_TRUSTED_FACT_REMOVAL",
  "SOURCE_CANONICAL_PEP_DRIFT",
  "SOURCE_SUBMIT_REQUEST_OPEN",
  "SOURCE_SUBMIT_REQUIRED_FIELD_REMOVAL",
  "SOURCE_SUBMIT_CLIENT_SCORE_ALLOWED",
  "SOURCE_CANDIDATE_RESPONSE_BRANCH_DRIFT",
  "SOURCE_MANIFEST_SCORING_DRIFT",
  "SOURCE_MANIFEST_PIN_REMOVAL",
  "SOURCE_RESULT_ASSESSED_BRANCH_WEAKENED",
  "SOURCE_RESULT_SKIPPED_DIMENSION_LEAK",
  "SOURCE_RESULT_SAGA_NATURAL_KEY_DRIFT",
  "SOURCE_RESULT_SAGA_DEDUPE_DRIFT",
  "SOURCE_RESULT_DIMENSION_ORDER_DRIFT",
  "SOURCE_RESULT_DIMENSION_UNIQUENESS_DRIFT",
  "SOURCE_REPORT_MUTATION_ALLOWED",
  "SOURCE_REPORT_MANIFEST_STRUCTURAL_EQUALITY",
  "SOURCE_B1_LEGACY_DEPRECATION_REMOVAL",
  "SOURCE_B1_LEGACY_ADAPTER_PROMOTION",
  "SOURCE_EVENT_FRAGMENT_PROMOTION",
  "SOURCE_EVENT_CATALOG_STATUS_DRIFT",
  "SOURCE_EVENT_PAYLOAD_OPEN",
  "SOURCE_EVENT_ENVELOPE_PROPERTY_LEAK",
  "SOURCE_EVENT_LINEAGE_PROPERTY_LEAK",
  "SOURCE_EVENT_RAW_RESPONSE_LEAK",
  "SOURCE_EVENT_PERMISSION_FACT_LEAK",
  "SOURCE_EVENT_RESULT_KIND_OPEN",
  "SOURCE_EVENT_ASSESSED_BRANCH_WEAKENED",
  "SOURCE_EVENT_SKIP_DIMENSION_LEAK",
  "SOURCE_EVENT_DIMENSION_COVERAGE_ZERO_REJECTED",
  "SOURCE_EVENT_STARTING_LEVEL_AUTHORITY_DRIFT",
  "SOURCE_EVENT_GOVERNANCE_RUNTIME_PROMOTION",
  "SOURCE_B26_RUNTIME_PROMOTION",
  "SUCCESSOR_PLANNING_REQUIRED_ADDITION_REMOVAL",
  "SUCCESSOR_PLANNING_FORBIDDEN_AUTHORITY_REMOVAL",
  "SUCCESSOR_CONTENT_MAPPING_ADDITION_REMOVAL",
  "SUCCESSOR_PLACEMENT_MAPPING_REMOVAL",
  "SUCCESSOR_PLACEMENT_BINDING_LINEAGE_DRIFT",
  "SUCCESSOR_FIRST_DAY_CONSISTENCY_REMOVAL",
  "SUCCESSOR_FIRST_DAY_PIN_LINEAGE_CONSISTENCY_REMOVAL",
  "SUCCESSOR_BASELINE_RAW_LEAK",
  "SUCCESSOR_LINEAGE_DERIVATION_DRIFT",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function exact(errors, actual, expected, label) {
  add(errors, stable(actual) === stable(expected), `${label} drifted`);
}

function exactKeys(errors, value, keys, label) {
  add(errors, isRecord(value), `${label} must be an object`);
  if (!isRecord(value)) return;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  add(
    errors,
    stable(actual) === stable(expected),
    `${label} must have exact allowed fields`,
  );
}

function exactStringArray(errors, value, expected, label) {
  add(errors, Array.isArray(value), `${label} must be an array`);
  if (!Array.isArray(value)) return;
  add(
    errors,
    value.every((entry) => typeof entry === "string" && entry.length > 0),
    `${label} must contain non-empty strings`,
  );
  add(errors, new Set(value).size === value.length, `${label} must be unique`);
  exact(errors, value, expected, label);
}

function includesAll(actual, expected) {
  return (
    Array.isArray(actual) && expected.every((entry) => actual.includes(entry))
  );
}

function percentage(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateHeaders(policy, errors) {
  exactKeys(errors, policy, ROOT_KEYS, "placement policy root");
  add(
    errors,
    policy?.$schema === "p1r.placement-contract.v1",
    "policy schema must be p1r.placement-contract.v1",
  );
  add(
    errors,
    policy?.schemaVersion === "p1r.placement-contract.v1",
    "policy schemaVersion must be p1r.placement-contract.v1",
  );
  add(
    errors,
    policy?.task === "P1R-M1-012" && policy?.phase === "P1",
    "policy task and phase must remain P1R-M1-012/P1",
  );
  add(
    errors,
    policy?.maturity === "D2_CONTRACT_READY",
    "placement policy maturity must remain D2_CONTRACT_READY",
  );
  add(
    errors,
    policy?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "placement policy runtimeStatus must remain NOT_RUNTIME_VERIFIED",
  );
  exact(
    errors,
    policy?.canonicalSources,
    CANONICAL_SOURCES,
    "placement canonical source inventory",
  );
  exact(
    errors,
    policy?.compatibilityPromotion,
    COMPATIBILITY_PROMOTION,
    "placement compatibility promotion",
  );
  exact(
    errors,
    policy?.learnerPlanningSuccessor,
    LEARNER_PLANNING_SUCCESSOR,
    "M1-012 learner-planning successor boundary",
  );
  add(
    errors,
    policy?.sourceContractBaseline === SOURCE_BASELINE,
    "source contract baseline drifted",
  );
  add(
    errors,
    policy?.startCommit === START_COMMIT,
    "M1-012 start commit drifted",
  );
  exactStringArray(
    errors,
    policy?.scope,
    [
      "RULE-P1-PLACEMENT",
      "INT-P1-004",
      "P1_PLACEMENT_V1_MANIFEST_RESULT_EVENT_AND_PLAN_SAGA",
    ],
    "policy scope",
  );
  exact(
    errors,
    policy?.integrationDependencies,
    {
      status: "SOURCE_BOUND_STATIC_D2",
      trackOwner: "P1R-M1-012_TRACK_B",
      unresolvedDecisions: [],
    },
    "Track B integration dependency boundary",
  );
}

function validateRuntimeBoundary(policy, errors) {
  const boundary = policy?.runtimeBoundary;
  exactKeys(
    errors,
    boundary,
    ["staticContractOnly", "prohibitedRuntimeClaims", "b26", "runtimeOwners"],
    "runtimeBoundary",
  );
  add(
    errors,
    boundary?.staticContractOnly === true,
    "placement policy must be static-contract-only",
  );
  exactStringArray(
    errors,
    boundary?.prohibitedRuntimeClaims,
    RUNTIME_CLAIMS,
    "runtime prohibited claims",
  );
  exact(
    errors,
    boundary?.b26,
    { mode: "static-only", runtimeStatus: "pending", defaultDecision: "NO-GO" },
    "B26 static boundary",
  );
  exact(
    errors,
    boundary?.runtimeOwners,
    {
      ownerDataAndTransaction: "P1R-M2-004",
      kafkaOutboxAndDelivery: "P1R-M2-005",
      workflowSagaAndRecovery: "P1R-M2-006",
      endToEndEvidence: "P1R-M8-006/011/012",
      releaseGate: "P1R-M0-006",
    },
    "runtime owner boundary",
  );
}

function validateManifestAndScoring(policy, errors) {
  const manifest = policy?.manifest;
  exactKeys(
    errors,
    manifest,
    [
      "id",
      "version",
      "ownerService",
      "totalItemCount",
      "dimensions",
      "closed",
      "noExtraDimensions",
    ],
    "manifest",
  );
  add(
    errors,
    manifest?.id === "P1_PLACEMENT_V1" &&
      manifest?.version === "P1_PLACEMENT_V1",
    "placement manifest id/version must be P1_PLACEMENT_V1",
  );
  add(
    errors,
    manifest?.ownerService === "assessment-service",
    "assessment-service must own the placement manifest",
  );
  add(
    errors,
    manifest?.totalItemCount === 10 &&
      manifest?.closed === true &&
      manifest?.noExtraDimensions === true,
    "manifest must be a closed ten-item four-dimension contract",
  );
  exact(errors, manifest?.dimensions, DIMENSIONS, "manifest dimensions");
  add(
    errors,
    Array.isArray(manifest?.dimensions) &&
      manifest.dimensions.reduce(
        (sum, dimension) => sum + dimension.weight,
        0,
      ) === 100,
    "placement dimension weights must total 100",
  );
  add(
    errors,
    Array.isArray(manifest?.dimensions) &&
      manifest.dimensions.reduce(
        (sum, dimension) => sum + dimension.requiredItemCount,
        0,
      ) === manifest.totalItemCount,
    "placement dimension item counts must total manifest item count",
  );

  const scoring = policy?.scoring;
  exactKeys(
    errors,
    scoring,
    [
      "correctValue",
      "incorrectValue",
      "unansweredValue",
      "dimensionFormula",
      "aggregateFormula",
      "aggregateScale",
      "dimensionRounding",
      "aggregateRounding",
      "timeRole",
      "timeMayChangeCorrectness",
      "serverDerivedFields",
    ],
    "scoring",
  );
  add(
    errors,
    scoring?.correctValue === 1 &&
      scoring?.incorrectValue === 0 &&
      scoring?.unansweredValue === 0,
    "placement scoring must be correct=1 and incorrect/unanswered=0",
  );
  add(
    errors,
    scoring?.dimensionFormula === "earnedItemCount / availableItemCount * 100",
    "placement dimension formula drifted",
  );
  add(
    errors,
    scoring?.aggregateFormula ===
      "sum(dimensionPercent * dimensionWeight / 100)" &&
      scoring?.aggregateScale === "0_TO_100",
    "placement aggregate formula drifted",
  );
  exact(
    errors,
    scoring?.dimensionRounding,
    {
      method: "ROUND_HALF_UP",
      decimalPlaces: 2,
      appliedBeforeAggregation: true,
    },
    "dimension rounding",
  );
  exact(
    errors,
    scoring?.aggregateRounding,
    {
      method: "ROUND_HALF_UP",
      decimalPlaces: 0,
      appliedBeforeLevelBoundary: true,
    },
    "aggregate rounding",
  );
  add(
    errors,
    scoring?.timeRole === "EXPLANATION_OR_TIEBREAKER_ONLY" &&
      scoring?.timeMayChangeCorrectness === false,
    "time must not change placement correctness",
  );
  exactStringArray(
    errors,
    scoring?.serverDerivedFields,
    [
      "correctness",
      "dimensionPercent",
      "aggregateScore",
      "referenceLevel",
      "confidence",
      "recommendation",
    ],
    "placement server-derived scoring fields",
  );

  exact(
    errors,
    policy?.levelBoundaries,
    LEVEL_BOUNDARIES,
    "placement level boundaries",
  );
  let expectedMinimum = 0;
  for (const boundary of policy?.levelBoundaries ?? []) {
    add(
      errors,
      Number.isInteger(boundary?.minimum) &&
        Number.isInteger(boundary?.maximum),
      "placement level boundaries must be integer ranges",
    );
    add(
      errors,
      boundary?.minimum === expectedMinimum &&
        boundary?.maximum >= boundary?.minimum,
      "placement level boundaries must be gap-free and non-overlapping",
    );
    expectedMinimum = (boundary?.maximum ?? -2) + 1;
  }
  add(
    errors,
    expectedMinimum === 101,
    "placement level boundaries must cover exactly 0 through 100",
  );
}

function validateCoverageAndResultSafety(policy, errors) {
  const coverage = policy?.coverageAndConfidence;
  exactKeys(
    errors,
    coverage,
    [
      "coverageFormula",
      "coverageIsIndependentFromCorrectness",
      "completeAssessmentRequiresAllDimensionTargets",
      "confidenceCodes",
      "high",
      "medium",
      "low",
      "unverified",
      "incompleteResultPolicy",
    ],
    "coverageAndConfidence",
  );
  add(
    errors,
    coverage?.coverageFormula ===
      "validServerAcceptedItemCount / manifest.totalItemCount",
    "coverage formula must use server-accepted items",
  );
  add(
    errors,
    coverage?.coverageIsIndependentFromCorrectness === true,
    "coverage must remain independent from correctness",
  );
  add(
    errors,
    coverage?.completeAssessmentRequiresAllDimensionTargets === true,
    "complete assessment must require every dimension target",
  );
  exactStringArray(
    errors,
    coverage?.confidenceCodes,
    ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"],
    "confidence codes",
  );
  exact(
    errors,
    coverage?.high,
    {
      coverageRatio: 1,
      allDimensionTargetsMet: true,
      minimumValidItemsPerDimension: DIMENSIONS.map(
        ({ id, requiredItemCount }) => ({
          dimension: id,
          count: requiredItemCount,
        }),
      ),
    },
    "HIGH confidence rule",
  );
  exact(
    errors,
    coverage?.medium,
    { minimumCoverageRatio: 0.8, minimumValidItemsPerDimension: 1 },
    "MEDIUM confidence rule",
  );
  exact(
    errors,
    coverage?.low,
    {
      minimumCoverageRatioExclusive: 0,
      when: "coverage is positive but does not qualify for HIGH or MEDIUM",
    },
    "LOW confidence rule",
  );
  exact(
    errors,
    coverage?.unverified,
    { when: "skip or no valid coverage", mustNotImplyMeasuredLevel: true },
    "UNVERIFIED confidence rule",
  );
  add(
    errors,
    coverage?.incompleteResultPolicy ===
      "MISSING_A_DIMENSION_MUST_NOT_BE_PRESENTED_AS_COMPLETE_ASSESSMENT",
    "missing dimensions must not be presented as complete assessment",
  );

  const resultSafety = policy?.resultSafety;
  exactKeys(
    errors,
    resultSafety,
    [
      "referenceOnly",
      "officialCertification",
      "forbiddenResultFields",
      "requiredLearnerSafeFields",
    ],
    "resultSafety",
  );
  add(
    errors,
    resultSafety?.referenceOnly === true &&
      resultSafety?.officialCertification === false,
    "placement result must remain a non-official reference",
  );
  exactStringArray(
    errors,
    resultSafety?.forbiddenResultFields,
    [
      "estimatedVocabulary",
      "preciseVocabularyCount",
      "officialCertificate",
      "officialCertification",
      "officialCEFR",
      "nationwidePercentile",
      "mastery",
      "aiScore",
      "aiRecommendation",
    ],
    "placement forbidden result fields",
  );
  exactStringArray(
    errors,
    resultSafety?.requiredLearnerSafeFields,
    [
      "placementResultId",
      "sessionId",
      "reportId",
      "resultVersion",
      "reportVersion",
      "aggregateScore",
      "referenceLevel",
      "confidence",
      "coverageRatio",
      "completionStatus",
      "resultDigest",
      "completedAt",
    ],
    "placement learner-safe result fields",
  );
}

function validatePinsRecoveryAndImmutability(policy, errors) {
  const pins = policy?.pins;
  exactKeys(
    errors,
    pins,
    [
      "digestPattern",
      "manifest",
      "content",
      "answerRule",
      "session",
      "result",
      "bindingRule",
    ],
    "pins",
  );
  add(
    errors,
    pins?.digestPattern === "^[a-f0-9]{64}$",
    "placement pin digests must be lower-case SHA-256",
  );
  exact(
    errors,
    pins?.manifest,
    { requiredFields: MANIFEST_PIN_FIELDS },
    "manifest pin fields",
  );
  exact(
    errors,
    pins?.content,
    { requiredFields: CONTENT_PIN_FIELDS },
    "content pin fields",
  );
  exact(
    errors,
    pins?.answerRule,
    { requiredFields: ANSWER_RULE_PIN_FIELDS },
    "answer-rule pin fields",
  );
  exact(
    errors,
    pins?.session,
    { requiredFields: SESSION_PIN_FIELDS },
    "session pin fields",
  );
  exact(
    errors,
    pins?.result,
    { requiredFields: RESULT_PIN_FIELDS },
    "result pin fields",
  );
  add(
    errors,
    pins?.bindingRule ===
      "ALL_RESULT_AND_PLAN_REFERENCES_MUST_BIND_THE_SAME_MANIFEST_CONTENT_AND_ANSWER_RULE_PIN_SET",
    "placement pin binding rule drifted",
  );

  exact(
    errors,
    policy?.sessionRecovery,
    {
      resumeScope: "SAME_SESSION_SAME_SUBJECT_SAME_IMMUTABLE_PIN_SET_ONLY",
      checkpointOperationId: "putB10AssessmentSessionCheckpoint",
      checkpointOwner: "assessment-service",
      allowedSessionStates: ["CREATED", "IN_PROGRESS", "INTERRUPTED"],
      forbiddenSessionStates: [
        "SUBMITTING",
        "COMPLETED",
        "AUTO_SUBMITTED",
        "CANCELLED",
        "EXPIRED",
      ],
      mayCreateReplacementSession: false,
      mayChangeSnapshotOrRulePins: false,
      crossSubjectResume: "FORBIDDEN",
    },
    "same-session recovery policy",
  );
  exact(
    errors,
    policy?.resultImmutability,
    {
      firstDurableResultRule:
        "FIRST_DURABLE_COMPLETED_RESULT_AND_REPORT_ARE_IMMUTABLE",
      sameIdempotencyKeySamePayload: "RETURN_ORIGINAL_DURABLE_RESULT",
      sameIdempotencyKeyDifferentPayload: "CONFLICT_409",
      duplicateCompletionEvent:
        "RETURN_ORIGINAL_EVENT_OR_DEDUPLICATE_WITHOUT_NEW_PLAN",
      recalibration: "CREATE_NEW_SEPARATE_RESULT_WITH_ORIGINAL_RESULT_RETAINED",
      mayOverwriteOriginalReport: false,
      mayCreateSecondPlanForSameBindings: false,
    },
    "placement result immutability",
  );
  exact(
    errors,
    policy?.skip,
    {
      resultKind: "SKIPPED",
      baselineConfidence: "UNVERIFIED",
      aggregateScore: null,
      referenceLevel: null,
      recommendation: "CONSERVATIVE_ENTRY_PLAN_ONLY",
      mustNotImplyMeasuredResult: true,
    },
    "placement skip policy",
  );
}

function validateAuthorizationAndOwnership(policy, errors) {
  const authorization = policy?.authorization;
  exactKeys(
    errors,
    authorization,
    [
      "defaultDecision",
      "serviceSidePepRequired",
      "trustedFacts",
      "candidateResponseBoundary",
      "serverAuthorityFields",
      "forbiddenClientAuthorityFields",
    ],
    "authorization",
  );
  add(
    errors,
    authorization?.defaultDecision === "DENY" &&
      authorization?.serviceSidePepRequired === true,
    "placement authorization must use service-side default DENY PEP",
  );
  exactStringArray(
    errors,
    authorization?.trustedFacts,
    REQUIRED_TRUSTED_FACTS,
    "placement trusted facts",
  );
  add(
    errors,
    authorization?.candidateResponseBoundary ===
      "CLIENT_MAY_SUBMIT_ONLY_CANDIDATE_RESPONSE_IN_PROTECTED_ASSESSMENT_REQUEST_BOUNDARY",
    "candidate response boundary drifted",
  );
  exactStringArray(
    errors,
    authorization?.serverAuthorityFields,
    [
      "correctness",
      "answerKey",
      "answerRule",
      "score",
      "aggregateScore",
      "dimensionPercent",
      "referenceLevel",
      "confidence",
      "recommendation",
      "placementManifestId",
      "contentVersionId",
      "contentEpoch",
      "snapshotId",
      "snapshotHash",
      "answerRuleSetVersion",
      "answerRuleVersion",
      "ruleDigest",
      "completionRuleVersion",
      "resultVersion",
      "reportVersion",
    ],
    "placement server authority fields",
  );
  exactStringArray(
    errors,
    authorization?.forbiddenClientAuthorityFields,
    [
      "tenant",
      "tenantId",
      "subject",
      "subjectId",
      "owner",
      "ownerId",
      "adultGate",
      "phase",
      "contentRights",
      "entitlement",
      "policyVersion",
      "correct",
      "isCorrect",
      "correctness",
      "answerKey",
      "answerRule",
      "answerRuleVersion",
      "ruleDigest",
      "score",
      "aggregateScore",
      "dimensionPercent",
      "referenceLevel",
      "confidence",
      "recommendation",
      "placementManifestId",
      "placementManifestVersion",
      "placementManifestDigest",
      "contentVersionId",
      "contentEpoch",
      "snapshotId",
      "snapshotHash",
      "resultVersion",
      "reportVersion",
    ],
    "placement forbidden client authority fields",
  );

  exact(
    errors,
    policy?.ownership,
    {
      assessment: {
        service: "assessment-service",
        owns: [
          "placement-session",
          "placement-checkpoint",
          "placement-manifest-pin",
          "placement-result",
          "placement-report",
          "placement-completion-fact",
        ],
        mayWriteForeignDomainSchema: false,
      },
      workflow: {
        service: "workflow-service",
        owns: [
          "placement-plan-saga",
          "retry",
          "dedupe",
          "compensation",
          "dlq-reference",
          "manual-recovery-reference",
        ],
        mayWriteForeignDomainSchema: false,
        mayModifyPlacementResultOrReport: false,
        commands: "VERSIONED_OWNER_API_OR_EVENT_ONLY",
      },
      learning: {
        service: "learning-service",
        owns: ["initial-learning-plan", "one-active-plan-constraint"],
        mayModifyPlacementResultOrReport: false,
        planCreationBinding:
          "placementSessionId+placementResultId+targetVersion+planningInputPinId",
      },
      learner: {
        service: "learner-service",
        owns: [
          "learner-facing-placement-reference",
          "first-day-projection-reference",
        ],
        mayRecomputePlacement: false,
        mayWriteLearningPlan: false,
        mayModifyPlacementResultOrReport: false,
      },
      audit: {
        service: "audit-service",
        owns: ["immutable-security-audit"],
        mayOwnPlacementReport: false,
        mayWriteForeignDomainSchema: false,
      },
    },
    "placement ownership boundary",
  );
}

function validateEventSagaAndIntegration(policy, errors) {
  const event = policy?.completionEvent;
  exactKeys(
    errors,
    event,
    [
      "bindingStatus",
      "name",
      "status",
      "producerService",
      "publishTrigger",
      "aggregateType",
      "runtimeStatus",
      "envelopeOnlyFields",
      "commonRequiredPayloadGroups",
      "consumerProjectionLineage",
      "assessed",
      "skipped",
      "forbiddenPayloadFields",
      "dedupeRule",
      "onlyFirstDurableResultMayPublish",
      "trackBMustFreeze",
    ],
    "completionEvent",
  );
  add(
    errors,
    event?.bindingStatus === "SOURCE_BOUND_STATIC_D2" &&
      event?.name === "assessment.placement.completed.v1" &&
      event?.status === "CANONICAL_D2",
    "placement completion event identity/binding drifted",
  );
  add(
    errors,
    event?.producerService === "assessment-service" &&
      event?.publishTrigger === "FIRST_DURABLE_COMPLETED_RESULT_ONLY",
    "assessment must publish only after first durable result",
  );
  add(
    errors,
    event?.aggregateType === "placement_session" &&
      event?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "completion event aggregate/runtime boundary drifted",
  );
  exactStringArray(
    errors,
    event?.envelopeOnlyFields,
    EVENT_ENVELOPE_ONLY_FIELDS,
    "completion event envelope-only fields",
  );
  exactStringArray(
    errors,
    event?.commonRequiredPayloadGroups,
    [
      "placement-session-result-report-identity-and-version",
      "manifest-content-answer-rule-pin-set",
      "target-reference-and-version",
    ],
    "completion event common payload groups",
  );
  exact(
    errors,
    event?.consumerProjectionLineage,
    {
      ownerService: "learning-service",
      assembly: "B9PlacementBaseline_AND_B9PlanningInputSnapshot",
      sourceEventIdDerivation: "completion-envelope.eventId",
      rootEventIdDerivation: "first-placement-completion-envelope.eventId",
      payloadMustNotContain: ["eventId", "sourceEventId", "rootEventId"],
    },
    "completion event consumer projection lineage",
  );
  exact(
    errors,
    event?.assessed,
    {
      resultKind: "ASSESSED",
      requiredPayloadGroups: [
        "learner-safe-score-level-coverage-confidence-summary",
        "dimension-learner-safe-summary",
      ],
    },
    "ASSESSED completion event branch",
  );
  exact(
    errors,
    event?.skipped,
    {
      resultKind: "SKIPPED",
      fixedSummary: {
        confidence: "UNVERIFIED",
        coverageRatio: 0,
        aggregateScore: null,
        referenceLevel: null,
      },
      forbiddenPayloadGroups: [
        "dimension-learner-safe-summary",
        "assessment-algorithm-or-rule-explanation",
      ],
      requestedStartingLevel: {
        allowed: true,
        authority: "USER_SELECTED_NON_AUTHORITATIVE",
      },
    },
    "SKIPPED completion event branch",
  );
  exactStringArray(
    errors,
    event?.forbiddenPayloadFields,
    COMPLETION_EVENT_FORBIDDEN_FIELDS,
    "completion event forbidden payload fields",
  );
  add(
    errors,
    event?.dedupeRule === "FIRST_DURABLE_RESULT_PER_PLACEMENT_SESSION_ONLY" &&
      event?.onlyFirstDurableResultMayPublish === true,
    "completion event dedupe/final-result rule drifted",
  );
  exactStringArray(
    errors,
    event?.trackBMustFreeze,
    [
      "event-name",
      "event-catalog-status-and-governance-fields",
      "payload-schema-allowlist-and-required-fields",
      "resultKind-oneOf-and-branch-not-guards",
      "aggregate-id-field",
      "compatibility-policy",
    ],
    "completion event Track B freeze list",
  );

  const saga = policy?.placementPlanSaga;
  exactKeys(
    errors,
    saga,
    [
      "sagaType",
      "coordinator",
      "sourceEventBinding",
      "requiredBindingGroups",
      "steps",
      "oneActivePlanRule",
      "planningInputNaturalKey",
      "planEffectDedupeKey",
      "outOfOrderOrDuplicateEvent",
      "planFailure",
      "recovery",
      "kafkaRpc",
      "twoPhaseCommit",
      "runtimeStatus",
    ],
    "placementPlanSaga",
  );
  add(
    errors,
    saga?.sagaType === "PLACEMENT_TO_INITIAL_PLAN_V1" &&
      saga?.coordinator === "workflow-service" &&
      saga?.sourceEventBinding === "SOURCE_BOUND_STATIC_D2",
    "placement plan saga identity/binding drifted",
  );
  exactStringArray(
    errors,
    saga?.requiredBindingGroups,
    [
      "immutable-placement-session-result",
      "manifest-content-answer-rule-pins",
      "target-version",
      "planning-input-pin-and-watermark",
    ],
    "placement plan saga binding groups",
  );
  exact(
    errors,
    saga?.steps,
    [
      {
        id: "VALIDATE_COMPLETION_FACT",
        ownerService: "workflow-service",
        writeBoundary: "workflow-service-schema-only",
      },
      {
        id: "ASSEMBLE_OR_REPLAY_PLANNING_INPUT",
        ownerService: "learning-service",
        writeBoundary: "versioned-learning-owner-api-only",
      },
      {
        id: "CREATE_OR_REPLAY_INITIAL_PLAN",
        ownerService: "learning-service",
        writeBoundary: "versioned-learning-owner-api-only",
      },
      {
        id: "PROJECT_LEARNER_REFERENCE",
        ownerService: "learner-service",
        writeBoundary: "versioned-learner-owner-api-only",
      },
    ],
    "placement plan saga steps",
  );
  add(
    errors,
    saga?.oneActivePlanRule ===
      "SAME_BINDINGS_REPLAY_OR_RETURN_EXISTING_PLAN_NEVER_CREATE_A_SECOND_ACTIVE_PLAN",
    "saga must prohibit a second active plan for the same bindings",
  );
  add(
    errors,
    saga?.planningInputNaturalKey ===
      "targetId+contentVersionId+contentEpoch+planningRuleVersion",
    "planning-input natural key drifted",
  );
  add(
    errors,
    saga?.planEffectDedupeKey ===
      "sessionId+placementResultId+resultVersion+targetVersion+planningInputPinId+planningInputPinVersion+planningInputDigest+inputFactWatermark",
    "placement plan effect dedupe key drifted",
  );
  add(
    errors,
    saga?.outOfOrderOrDuplicateEvent ===
      "DEDUPE_OR_RECONCILE_WITHOUT_ASSESSMENT_MUTATION",
    "duplicate/out-of-order events must not mutate assessment",
  );
  add(
    errors,
    saga?.planFailure ===
      "RETAIN_IMMUTABLE_PLACEMENT_RESULT_AND_REPORT_AND_OPEN_OWNER_SCOPED_RECOVERY",
    "plan failure must retain placement result/report",
  );
  add(
    errors,
    saga?.recovery ===
      "RETRY_OR_MANUAL_RECOVERY_MAY_NOT_OVERWRITE_PLACEMENT_RESULT_REPORT_OR_WRITE_FOREIGN_SCHEMA",
    "placement recovery must remain owner scoped and immutable",
  );
  add(
    errors,
    saga?.kafkaRpc === false &&
      saga?.twoPhaseCommit === false &&
      saga?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "placement saga must remain D2 without Kafka RPC, 2PC, or runtime claim",
  );

  exact(
    errors,
    policy?.gapBoundaries,
    {
      mustRemainOpenUntilIntegratedEvidence: [
        "CONTRACT-GAP-ONB-002",
        "CONTRACT-GAP-PLACEMENT-MANIFEST",
        "EVENT-GAP-ONB-002",
        "EVENT-GAP-PLACEMENT-PLAN",
      ],
      mayNotCloseFromPolicyOnly: true,
    },
    "placement gap boundary",
  );
  const integration = policy?.contractIntegration;
  exactKeys(
    errors,
    integration,
    [
      "status",
      "staticSourceBindingOnly",
      "canonicalRoutes",
      "schemaBinding",
      "requiredRouteBehavior",
    ],
    "contractIntegration",
  );
  add(
    errors,
    integration?.status === "SOURCE_BOUND_STATIC_D2" &&
      integration?.staticSourceBindingOnly === true,
    "policy must retain a static-only source-bound D2 boundary",
  );
  add(
    errors,
    integration?.schemaBinding === "EXACT_B10_B1_EVENT_SOURCE_GATE",
    "schema binding must remain the exact B10/B1/event source gate",
  );
  exact(
    errors,
    integration?.canonicalRoutes,
    EXPECTED_ROUTES,
    "Track B canonical placement route allowlist",
  );
  exactStringArray(
    errors,
    integration?.requiredRouteBehavior,
    [
      "bearer-security-and-service-side-PEP-default-deny",
      "server-authoritative-pins-score-level-confidence-and-recommendation",
      "same-session-checkpoint-recovery-only",
      "same-idempotency-key-same-payload-replay-original",
      "same-idempotency-key-different-payload-409",
      "skip-produces-unverified-baseline-only",
      "all-five-B1-placement-operations-deprecated-adapter-only",
    ],
    "contract integration required route behavior",
  );
}

function readJson(root, relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"),
  );
}

function resolveLocalReference(document, reference) {
  if (typeof reference !== "string" || !reference.startsWith("#/"))
    return undefined;
  return reference
    .slice(2)
    .split("/")
    .reduce(
      (value, token) =>
        value?.[token.replaceAll("~1", "/").replaceAll("~0", "~")],
      document,
    );
}

function dereference(document, schema, fallback, seen = new Set()) {
  if (!isRecord(schema) || typeof schema.$ref !== "string") return schema;
  if (seen.has(schema.$ref)) return schema;
  const resolved =
    resolveLocalReference(document, schema.$ref) ??
    resolveLocalReference(fallback, schema.$ref);
  if (!isRecord(resolved)) return schema;
  const nextSeen = new Set(seen);
  nextSeen.add(schema.$ref);
  const siblings = { ...schema };
  delete siblings.$ref;
  return dereference(
    document,
    { ...resolved, ...siblings },
    fallback,
    nextSeen,
  );
}

function sourceComponent(document, name, fallback) {
  return (
    document?.components?.schemas?.[name] ??
    fallback?.components?.schemas?.[name]
  );
}

function sourceProperties(document, schema, fallback) {
  const resolved = dereference(document, schema, fallback);
  if (!isRecord(resolved)) return {};
  const inherited = Array.isArray(resolved.allOf)
    ? Object.assign(
        {},
        ...resolved.allOf.map((part) =>
          sourceProperties(document, part, fallback),
        ),
      )
    : {};
  return { ...inherited, ...(resolved.properties ?? {}) };
}

function sourceRequired(document, schema, fallback) {
  const resolved = dereference(document, schema, fallback);
  if (!isRecord(resolved)) return [];
  const inherited = Array.isArray(resolved.allOf)
    ? resolved.allOf.flatMap((part) => sourceRequired(document, part, fallback))
    : [];
  return [...new Set([...inherited, ...(resolved.required ?? [])])];
}

function sourceClosedObject(document, schema, fallback) {
  const resolved = dereference(document, schema, fallback);
  return (
    resolved?.type === "object" && resolved?.additionalProperties === false
  );
}

function sourceEnum(document, schema, fallback) {
  const resolved = dereference(document, schema, fallback);
  if (!isRecord(resolved)) return undefined;
  if (Object.hasOwn(resolved, "const")) return [resolved.const];
  return resolved.enum;
}

function sourceOperation(document, route) {
  return document?.paths?.[route.path]?.[route.method.toLowerCase()];
}

function requestSchema(operation) {
  return operation?.requestBody?.content?.["application/json"]?.schema;
}

function containsReference(value, target, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (value.$ref === target) return true;
  return Object.values(value).some((child) =>
    containsReference(child, target, seen),
  );
}

function findEvent(document, eventName) {
  return (document?.events ?? []).find(
    (event) => event?.eventName === eventName,
  );
}

function eventPayload(document, event) {
  return resolveLocalReference(document, event?.payloadSchema?.$ref);
}

function branchWithConst(branches, field, value) {
  return branches.find(
    (branch) => branch?.properties?.[field]?.const === value,
  );
}

function branchNotRequired(branch, field) {
  return stable(branch?.not) === stable({ required: [field] });
}

function checkDigestSchema(document, schema, fallback, label, errors) {
  exact(
    errors,
    dereference(document, schema, fallback),
    {
      type: "string",
      pattern: "^[a-f0-9]{64}$",
      minLength: 64,
      maxLength: 64,
      description:
        "Lowercase SHA-256 digest pinned by the assessment owner; it is not client authority.",
    },
    label,
  );
}

function checkCanonicalRoutes(b10Placement, b10Assessment, policy, errors) {
  exact(
    errors,
    Object.keys(b10Placement?.paths ?? {}).sort(),
    B10_ROUTE_POLICIES.map((route) => route.path).sort(),
    "B10 placement route path allowlist",
  );
  for (const route of B10_ROUTE_POLICIES) {
    const operation = sourceOperation(b10Placement, route);
    const label = `B10 ${route.operationId}`;
    add(errors, isRecord(operation), `${label} route is required`);
    if (!isRecord(operation)) continue;
    exact(
      errors,
      operation.operationId,
      route.operationId,
      `${label} operationId`,
    );
    add(
      errors,
      operation.deprecated !== true,
      `${label} must not be deprecated`,
    );
    exact(
      errors,
      operation.security,
      [{ bearerAuth: [] }],
      `${label} bearer security`,
    );
    exact(
      errors,
      operation?.["x-p1r-placement"],
      {
        canonical: true,
        lifecycle: route.lifecycle,
        ...(route.operationId === "createB10PlacementSession"
          ? {
              resultOwner: "assessment-service",
              planOwner: "learning-service",
            }
          : {}),
        legacyAdapter: route.legacyAdapter,
      },
      `${label} canonical placement boundary`,
    );
    add(
      errors,
      operation?.["x-contract"]?.owner === "assessment-service" &&
        operation?.["x-contract"]?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
      `${label} assessment owner/D2 runtime boundary drifted`,
    );
    const authorization = operation?.["x-authorization"];
    add(
      errors,
      authorization?.defaultDecision === "DENY" &&
        authorization?.serviceSidePepRequired === true,
      `${label} must retain service-side default DENY PEP`,
    );
    exact(
      errors,
      authorization?.trustedFacts,
      REQUIRED_TRUSTED_FACTS,
      `${label} trusted authorization facts`,
    );
    exact(
      errors,
      Object.keys(operation?.responses ?? {}).sort(),
      route.responseStatuses,
      `${label} response status boundary`,
    );
    if (route.idempotency) {
      add(
        errors,
        operation?.["x-idempotency"]?.required === true &&
          operation?.["x-idempotency"]?.keyHeader === "Idempotency-Key" &&
          operation?.["x-idempotency"]?.sameKeyDifferentPayload ===
            "CONFLICT_409" &&
          typeof operation?.["x-idempotency"]?.replayBehavior === "string" &&
          operation["x-idempotency"].replayBehavior.length > 0,
        `${label} idempotency replay/409 boundary drifted`,
      );
    } else {
      add(
        errors,
        !Object.hasOwn(operation, "x-idempotency"),
        `${label} read route must not expose write idempotency semantics`,
      );
    }
    if (route.requestBody === "FORBIDDEN") {
      add(
        errors,
        !Object.hasOwn(operation, "requestBody"),
        `${label} must retain its bodyless route shape`,
      );
    } else {
      add(
        errors,
        containsReference(
          requestSchema(operation),
          `#/components/schemas/${route.requestBody}`,
        ),
        `${label} request schema drifted`,
      );
      if (Object.hasOwn(route, "requestBodyRequired")) {
        add(
          errors,
          operation?.requestBody?.required === route.requestBodyRequired,
          `${label} request-body requiredness drifted`,
        );
      }
    }
  }

  const responseRequest = sourceComponent(
    b10Placement,
    "B10PlacementResponseSubmitRequest",
    b10Assessment,
  );
  add(
    errors,
    sourceClosedObject(b10Placement, responseRequest, b10Assessment),
    "B10 placement response request must be closed",
  );
  exact(
    errors,
    sourceRequired(b10Placement, responseRequest, b10Assessment),
    [
      "expectedStateVersion",
      "itemId",
      "itemSequence",
      "candidateResponse",
      "responseDigest",
      "timeSpentSec",
    ],
    "B10 placement response required fields",
  );
  const responseProperties = sourceProperties(
    b10Placement,
    responseRequest,
    b10Assessment,
  );
  add(
    errors,
    containsReference(
      responseProperties.candidateResponse,
      "#/components/schemas/B10CandidateResponse",
    ),
    "B10 placement response must use the protected candidate response union",
  );
  exact(
    errors,
    responseRequest?.["x-forbidden-client-fields"],
    [
      "tenant",
      "tenantId",
      "subject",
      "principalId",
      "owner",
      "ownerId",
      "adultGate",
      "consent",
      "phase",
      "policyVersion",
      "contentRights",
      "correct",
      "isCorrect",
      "correctness",
      "answerKey",
      "answerRule",
      "score",
      "aggregateScore",
      "dimensionPercent",
      "referenceLevel",
      "confidence",
      "recommendation",
      "placementManifestId",
      "contentVersionId",
      "contentEpoch",
      "snapshotId",
      "snapshotHash",
      "resultVersion",
      "reportVersion",
    ],
    "B10 placement response forbidden client authority fields",
  );
  checkDigestSchema(
    b10Placement,
    responseProperties.responseDigest,
    b10Assessment,
    "B10 placement response digest",
    errors,
  );

  const candidateResponse = sourceComponent(
    b10Assessment,
    "B10CandidateResponse",
  );
  exact(
    errors,
    candidateResponse?.discriminator,
    {
      propertyName: "responseType",
      mapping: {
        CHOICE: "#/components/schemas/B10ChoiceResponse",
        MATCHING: "#/components/schemas/B10MatchingResponse",
        ORDERING: "#/components/schemas/B10OrderingResponse",
        CLOZE: "#/components/schemas/B10ClozeResponse",
        TEXT: "#/components/schemas/B10TextResponse",
        UNANSWERED: "#/components/schemas/B10UnansweredResponse",
      },
    },
    "B10 protected candidate response discriminator",
  );
  exact(
    errors,
    candidateResponse?.oneOf,
    [
      { $ref: "#/components/schemas/B10ChoiceResponse" },
      { $ref: "#/components/schemas/B10MatchingResponse" },
      { $ref: "#/components/schemas/B10OrderingResponse" },
      { $ref: "#/components/schemas/B10ClozeResponse" },
      { $ref: "#/components/schemas/B10TextResponse" },
      { $ref: "#/components/schemas/B10UnansweredResponse" },
    ],
    "B10 protected candidate response branch allowlist",
  );
  for (const [responseType, schemaName, rawField] of [
    ["CHOICE", "B10ChoiceResponse", "selectedOptionIds"],
    ["MATCHING", "B10MatchingResponse", "pairs"],
    ["ORDERING", "B10OrderingResponse", "orderedTokenIds"],
    ["CLOZE", "B10ClozeResponse", "blanks"],
    ["TEXT", "B10TextResponse", "text"],
    ["UNANSWERED", "B10UnansweredResponse", undefined],
  ]) {
    const branch = sourceComponent(b10Assessment, schemaName);
    add(
      errors,
      sourceClosedObject(b10Assessment, branch),
      `${schemaName} must be closed`,
    );
    const expectedRequired = rawField
      ? ["responseType", rawField]
      : ["responseType"];
    exact(
      errors,
      sourceRequired(b10Assessment, branch),
      expectedRequired,
      `${schemaName} required fields`,
    );
    exact(
      errors,
      sourceEnum(
        b10Assessment,
        sourceProperties(b10Assessment, branch).responseType,
      ),
      [responseType],
      `${schemaName} response discriminator`,
    );
  }
}

function checkManifestPinsAndResult(b10Placement, b10Assessment, errors) {
  const manifest = sourceComponent(
    b10Placement,
    "B10PlacementManifest",
    b10Assessment,
  );
  add(
    errors,
    sourceClosedObject(b10Placement, manifest, b10Assessment) &&
      manifest?.readOnly === true,
    "B10PlacementManifest must be closed and assessment read-only",
  );
  exact(
    errors,
    manifest?.["x-p1r-placement-manifest"],
    {
      id: "P1_PLACEMENT_V1",
      totalItemCount: 10,
      exactDimensions: DIMENSIONS.map(
        ({ id, weight, requiredItemCount, displayOrder }) => ({
          dimension: id,
          weight,
          requiredItemCount,
          displayOrder,
        }),
      ),
      correctValue: 1,
      incorrectValue: 0,
      unansweredValue: 0,
      dimensionRounding: "ROUND_HALF_UP_2",
      aggregateRounding: "ROUND_HALF_UP_0_BEFORE_LEVEL_BOUNDARY",
      timeRole: "EXPLANATION_OR_TIEBREAKER_ONLY",
    },
    "B10 placement manifest frozen scoring policy",
  );
  exact(
    errors,
    sourceRequired(b10Placement, manifest, b10Assessment),
    [...MANIFEST_PIN_FIELDS, "dimensions"],
    "B10PlacementManifest required fields",
  );
  const manifestProperties = sourceProperties(
    b10Placement,
    manifest,
    b10Assessment,
  );
  exact(
    errors,
    sourceEnum(
      b10Placement,
      manifestProperties.placementManifestId,
      b10Assessment,
    ),
    ["P1_PLACEMENT_V1"],
    "B10 placement manifest id",
  );
  exact(
    errors,
    sourceEnum(
      b10Placement,
      manifestProperties.placementManifestVersion,
      b10Assessment,
    ),
    ["P1_PLACEMENT_V1"],
    "B10 placement manifest version",
  );
  exact(
    errors,
    sourceEnum(b10Placement, manifestProperties.totalItemCount, b10Assessment),
    [10],
    "B10 placement total item count",
  );
  checkDigestSchema(
    b10Placement,
    manifestProperties.placementManifestDigest,
    b10Assessment,
    "B10 placement manifest digest",
    errors,
  );
  checkDigestSchema(
    b10Placement,
    manifestProperties.dimensionSetDigest,
    b10Assessment,
    "B10 placement dimension-set digest",
    errors,
  );
  exact(
    errors,
    manifestProperties.dimensions?.["x-p1r-exact-order"],
    DIMENSIONS.map(({ id }) => id),
    "B10 placement manifest dimension order",
  );
  add(
    errors,
    manifestProperties.dimensions?.minItems === 4 &&
      manifestProperties.dimensions?.maxItems === 4,
    "B10 placement manifest must expose exactly four dimensions",
  );

  for (const [name, fields] of [
    ["B10PlacementManifestPin", MANIFEST_PIN_FIELDS],
    ["B10PlacementContentPin", CONTENT_PIN_FIELDS],
    ["B10PlacementAnswerRulePin", ANSWER_RULE_PIN_FIELDS],
    [
      "B10PlacementTargetPin",
      ["targetId", "targetVersion", "targetSnapshotDigest"],
    ],
  ]) {
    const schema = sourceComponent(b10Placement, name, b10Assessment);
    add(
      errors,
      sourceClosedObject(b10Placement, schema, b10Assessment) &&
        schema?.readOnly === true,
      `${name} must be closed and read-only`,
    );
    exact(
      errors,
      sourceRequired(b10Placement, schema, b10Assessment),
      fields,
      `${name} required fields`,
    );
  }

  const session = sourceComponent(
    b10Placement,
    "B10PlacementSession",
    b10Assessment,
  );
  add(
    errors,
    sourceClosedObject(b10Placement, session, b10Assessment) &&
      session?.readOnly === true,
    "B10PlacementSession must be closed and read-only",
  );
  exact(
    errors,
    sourceRequired(b10Placement, session, b10Assessment),
    [
      "sessionId",
      "status",
      "stateVersion",
      "sessionSnapshotDigest",
      "manifest",
      "contentPin",
      "answerRulePin",
      "targetPin",
      "startedAt",
    ],
    "B10PlacementSession required pins",
  );

  const result = sourceComponent(
    b10Placement,
    "B10PlacementResult",
    b10Assessment,
  );
  add(
    errors,
    Array.isArray(result?.allOf) && result.allOf.length === 2,
    "B10PlacementResult must retain its base plus result-kind branch model",
  );
  const base = result?.allOf?.[0];
  add(
    errors,
    sourceClosedObject(b10Placement, base, b10Assessment) &&
      base?.readOnly === true,
    "B10PlacementResult base must be closed and read-only",
  );
  exact(
    errors,
    sourceRequired(b10Placement, base, b10Assessment),
    [
      "placementResultId",
      "sessionId",
      "resultVersion",
      "resultDigest",
      "reportId",
      "reportVersion",
      "reportDigest",
      "resultKind",
      "confidence",
      "coverageRatio",
      "completionStatus",
      "manifest",
      "contentPin",
      "answerRulePin",
      "targetPin",
      "completedAt",
    ],
    "B10PlacementResult durable result/pin fields",
  );
  exact(
    errors,
    base?.["x-p1r-placement-plan-saga"],
    {
      sourceEvent: "assessment.placement.completed.v1",
      planningInputOwner: "learning-service",
      assemblePlanningInputBeforePlan: true,
      activePlanNaturalKey: [
        "targetPin.targetId",
        "contentPin.contentVersionId",
        "contentPin.contentEpoch",
        "planningInput.planningRuleVersion",
      ],
      effectDedupeKey: [
        "sessionId",
        "placementResultId",
        "resultVersion",
        "targetPin.targetVersion",
        "planningInput.pinId",
        "planningInput.pinVersion",
        "planningInput.pinDigest",
        "planningInput.inputFactWatermark",
      ],
      effectOwner: "learning-service",
      workflowBoundary:
        "workflow-service coordinates only via events or versioned owner APIs; no foreign schema write, Kafka RPC or two-phase commit",
      reportMutation: "PROHIBITED",
    },
    "B10 placement-result to planning saga binding",
  );
  const resultProperties = sourceProperties(b10Placement, base, b10Assessment);
  exact(
    errors,
    {
      type: resultProperties.dimensionSummaries?.type,
      minItems: resultProperties.dimensionSummaries?.minItems,
      maxItems: resultProperties.dimensionSummaries?.maxItems,
      exactOrder: resultProperties.dimensionSummaries?.["x-p1r-exact-order"],
      uniqueBy: resultProperties.dimensionSummaries?.["x-unique-by"],
    },
    {
      type: "array",
      minItems: 4,
      maxItems: 4,
      exactOrder: DIMENSIONS.map(({ id }) => id),
      uniqueBy: "dimension",
    },
    "B10 placement-result dimension summary order/uniqueness",
  );
  const resultBranches = result?.allOf?.[1]?.oneOf ?? [];
  add(
    errors,
    resultBranches.length === 2,
    "B10PlacementResult must have exactly ASSESSED and SKIPPED branches",
  );
  const assessed = branchWithConst(resultBranches, "resultKind", "ASSESSED");
  const skipped = branchWithConst(resultBranches, "resultKind", "SKIPPED");
  exact(
    errors,
    assessed?.required,
    ["resultKind", "aggregateScore", "referenceLevel", "dimensionSummaries"],
    "B10PlacementResult ASSESSED required fields",
  );
  exact(
    errors,
    assessed?.properties,
    {
      resultKind: { const: "ASSESSED" },
      completionStatus: { const: "COMPLETED" },
      confidence: { enum: ["HIGH", "MEDIUM", "LOW"] },
      aggregateScore: { type: "integer", minimum: 0, maximum: 100 },
      referenceLevel: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      },
    },
    "B10PlacementResult ASSESSED branch guards",
  );
  add(
    errors,
    branchNotRequired(assessed, "requestedStartingLevel"),
    "B10PlacementResult ASSESSED must forbid a requested starting level",
  );
  exact(
    errors,
    skipped?.required,
    ["resultKind", "aggregateScore", "referenceLevel"],
    "B10PlacementResult SKIPPED required fields",
  );
  exact(
    errors,
    skipped?.properties,
    {
      resultKind: { const: "SKIPPED" },
      completionStatus: { const: "SKIPPED" },
      confidence: { const: "UNVERIFIED" },
      coverageRatio: { const: 0 },
      aggregateScore: { const: null },
      referenceLevel: { const: null },
    },
    "B10PlacementResult SKIPPED branch guards",
  );
  add(
    errors,
    branchNotRequired(skipped, "dimensionSummaries"),
    "B10PlacementResult SKIPPED must forbid dimension summaries",
  );

  const report = sourceComponent(
    b10Placement,
    "B10PlacementReport",
    b10Assessment,
  );
  add(
    errors,
    sourceClosedObject(b10Placement, report, b10Assessment) &&
      report?.readOnly === true,
    "B10PlacementReport must be closed and immutable",
  );
  exact(
    errors,
    report?.["x-p1r-placement-report-result-consistency"],
    {
      equality: "JSON_STRUCTURAL_EXACT",
      mustEqual: [
        ["result.manifest.placementManifestId", "manifest.placementManifestId"],
        [
          "result.manifest.placementManifestVersion",
          "manifest.placementManifestVersion",
        ],
        [
          "result.manifest.placementManifestDigest",
          "manifest.placementManifestDigest",
        ],
        ["result.manifest.dimensionSetDigest", "manifest.dimensionSetDigest"],
        ["result.manifest.totalItemCount", "manifest.totalItemCount"],
        ["result.contentPin", "contentPin"],
        ["result.answerRulePin", "answerRulePin"],
        ["result.targetPin", "targetPin"],
      ],
      resultIdentityIsAuthoritative: [
        "result.placementResultId",
        "result.resultVersion",
        "result.resultDigest",
        "result.reportId",
        "result.reportVersion",
        "result.reportDigest",
      ],
      reportMutation: "PROHIBITED",
    },
    "B10 placement report/result consistency boundary",
  );
}

function checkLegacyAdapters(b1OnboardingPrivacy, b1AuthOnboarding, errors) {
  const documents = { b1OnboardingPrivacy, b1AuthOnboarding };
  const actualLegacyOperations = Object.entries(documents)
    .flatMap(([documentName, document]) =>
      Object.entries(document?.paths ?? {}).flatMap(([routePath, pathItem]) =>
        Object.entries(pathItem ?? {})
          .filter(
            ([method, operation]) =>
              ["get", "post", "put", "patch", "delete"].includes(method) &&
              isRecord(operation) &&
              routePath.startsWith("/api/v1/assessment/placement/"),
          )
          .map(([method, operation]) => ({
            document: documentName,
            path: routePath,
            method: method.toUpperCase(),
            operationId: operation.operationId,
          })),
      ),
    )
    .sort((left, right) =>
      `${left.document}:${left.path}:${left.method}`.localeCompare(
        `${right.document}:${right.path}:${right.method}`,
      ),
    );
  const expectedLegacyOperations = LEGACY_PLACEMENT_ADAPTERS.map(
    ({ document, path: routePath, method, operationId }) => ({
      document,
      path: routePath,
      method,
      operationId,
    }),
  ).sort((left, right) =>
    `${left.document}:${left.path}:${left.method}`.localeCompare(
      `${right.document}:${right.path}:${right.method}`,
    ),
  );
  exact(
    errors,
    actualLegacyOperations,
    expectedLegacyOperations,
    "B1 placement legacy operation inventory",
  );
  for (const route of LEGACY_PLACEMENT_ADAPTERS) {
    const operation = sourceOperation(documents[route.document], route);
    const label = `B1 ${route.operationId}`;
    add(errors, isRecord(operation), `${label} legacy route is required`);
    if (!isRecord(operation)) continue;
    add(
      errors,
      operation.deprecated === true,
      `${label} must remain deprecated`,
    );
    add(
      errors,
      operation?.["x-p1r-deprecation"]?.migrationLink === route.canonicalRoute,
      `${label} must retain its canonical migration link`,
    );
    const adapter = operation?.["x-p1r-b10-placement-adapter"];
    const bindingIsSafe =
      route.operationId === "skipB1Placement"
        ? isRecord(adapter?.legacyFastTrackLevelMapping) &&
          Object.values(adapter.legacyFastTrackLevelMapping).every(
            (entry) => entry?.authority === "USER_SELECTED_NON_AUTHORITATIVE",
          )
        : typeof adapter?.serverDerivedBinding === "string" &&
          adapter.serverDerivedBinding.length > 0;
    add(
      errors,
      adapter?.adapterOnly === true &&
        adapter?.legacyWirePreserved === true &&
        adapter?.canonicalOperationId === route.canonicalOperationId &&
        adapter?.canonicalRoute === route.canonicalRoute &&
        adapter?.newCanonicalFactsFromLegacyPayload === "PROHIBITED" &&
        adapter?.runtimeStatus === "NOT_RUNTIME_VERIFIED" &&
        bindingIsSafe,
      `${label} must remain a D2 adapter-only legacy wire boundary`,
    );
  }
}

function checkCompletionEvent(eventFragment, eventCatalog, errors) {
  const eventName = "assessment.placement.completed.v1";
  const fragmentEvent = findEvent(eventFragment, eventName);
  const catalogEvent = findEvent(eventCatalog, eventName);
  add(
    errors,
    isRecord(fragmentEvent),
    "placement completion event fragment is required",
  );
  add(
    errors,
    isRecord(catalogEvent),
    "placement completion event catalog entry is required",
  );
  if (!isRecord(fragmentEvent) || !isRecord(catalogEvent)) return;
  add(
    errors,
    !Object.hasOwn(fragmentEvent, "status"),
    "placement completion fragment must not self-promote a catalog status",
  );
  exact(
    errors,
    {
      eventName: fragmentEvent.eventName,
      domain: fragmentEvent.domain,
      version: fragmentEvent.version,
      schema: fragmentEvent.schema,
      aggregateType: fragmentEvent.aggregateType,
      aggregateIdField: fragmentEvent.aggregateIdField,
      payloadSchema: fragmentEvent.payloadSchema,
    },
    {
      eventName,
      domain: "assessment",
      version: 1,
      schema: "assessment.event.v1",
      aggregateType: "placement_session",
      aggregateIdField: "sessionId",
      payloadSchema: { $ref: "#/payloadSchemas/B10PlacementCompleted" },
    },
    "placement completion event identity",
  );
  exact(
    errors,
    fragmentEvent?.["x-envelope-required"],
    [
      "eventId",
      "eventName",
      "schema",
      "version",
      "occurredAt",
      "aggregateType",
      "aggregateId",
      "actorId",
      "traceId",
      "requestId",
      "schemaVersion",
      "dedupeKey",
      "payload",
    ],
    "placement completion event envelope fields",
  );
  const fragmentPayload = eventPayload(eventFragment, fragmentEvent);
  const catalogPayload = eventPayload(eventCatalog, catalogEvent);
  add(
    errors,
    sourceClosedObject(eventFragment, fragmentPayload),
    "placement completion payload must be closed",
  );
  exact(
    errors,
    sourceRequired(eventFragment, fragmentPayload),
    PLACEMENT_EVENT_REQUIRED_FIELDS,
    "placement completion payload required fields",
  );
  const properties = sourceProperties(eventFragment, fragmentPayload);
  exact(
    errors,
    Object.keys(properties).sort(),
    [...PLACEMENT_EVENT_PROPERTY_ALLOWLIST].sort(),
    "placement completion payload property allowlist",
  );
  add(
    errors,
    EVENT_PAYLOAD_FORBIDDEN_FIELDS.every(
      (field) => !Object.hasOwn(properties, field),
    ),
    "placement completion payload must reject envelope, lineage, raw-answer, and permission facts",
  );
  exact(
    errors,
    sourceEnum(eventFragment, properties.resultKind),
    ["ASSESSED", "SKIPPED"],
    "placement completion result-kind enum",
  );
  exact(
    errors,
    sourceEnum(eventFragment, properties.completionStatus),
    ["COMPLETED", "SKIPPED"],
    "placement completion status enum",
  );
  exact(
    errors,
    sourceEnum(eventFragment, properties.confidence),
    ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"],
    "placement completion confidence enum",
  );
  exact(
    errors,
    properties.placementManifestId,
    { type: "string", const: "P1_PLACEMENT_V1" },
    "placement completion manifest id pin",
  );
  exact(
    errors,
    properties.placementManifestVersion,
    { type: "string", const: "P1_PLACEMENT_V1" },
    "placement completion manifest version pin",
  );
  add(
    errors,
    properties.totalItemCount?.type === "integer" &&
      properties.totalItemCount?.const === 10,
    "placement completion total-item pin drifted",
  );
  for (const field of [
    "sessionSnapshotDigest",
    "resultDigest",
    "reportDigest",
    "placementManifestDigest",
    "dimensionSetDigest",
    "snapshotHash",
    "ruleDigest",
    "targetSnapshotDigest",
  ]) {
    add(
      errors,
      properties[field]?.type === "string" &&
        properties[field]?.pattern === "^[a-f0-9]{64}$",
      `placement completion ${field} must be a lower-case SHA-256 pin`,
    );
  }
  const branches = fragmentPayload?.oneOf ?? [];
  add(
    errors,
    branches.length === 2,
    "placement completion payload must have exactly ASSESSED and SKIPPED branches",
  );
  const eventDimensions = properties.dimensionSummaries;
  add(
    errors,
    eventDimensions?.type === "array" &&
      eventDimensions?.minItems === 4 &&
      eventDimensions?.maxItems === 4 &&
      eventDimensions?.items === false &&
      Array.isArray(eventDimensions?.prefixItems) &&
      eventDimensions.prefixItems.length === DIMENSIONS.length,
    "placement completion dimension summary cardinality/order boundary drifted",
  );
  for (const [index, dimension] of DIMENSIONS.entries()) {
    const item = eventDimensions?.prefixItems?.[index];
    exact(
      errors,
      item,
      {
        type: "object",
        additionalProperties: false,
        required: ["dimensionId", "dimensionPercent", "coverageRatio"],
        properties: {
          dimensionId: { type: "string", const: dimension.id },
          dimensionPercent: { type: "number", minimum: 0, maximum: 100 },
          coverageRatio: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      `placement completion ${dimension.id} learner-safe dimension summary`,
    );
  }
  const assessed = branchWithConst(branches, "resultKind", "ASSESSED");
  const skipped = branchWithConst(branches, "resultKind", "SKIPPED");
  exact(
    errors,
    assessed?.required,
    [
      "resultKind",
      "completionStatus",
      "aggregateScore",
      "referenceLevel",
      "confidence",
      "coverageRatio",
      "dimensionSummaries",
    ],
    "placement completion ASSESSED required fields",
  );
  exact(
    errors,
    assessed?.properties,
    {
      resultKind: { const: "ASSESSED" },
      completionStatus: { const: "COMPLETED" },
      aggregateScore: { type: "integer", minimum: 0, maximum: 100 },
      referenceLevel: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      },
      confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      coverageRatio: { type: "number", exclusiveMinimum: 0, maximum: 1 },
    },
    "placement completion ASSESSED branch guards",
  );
  add(
    errors,
    branchNotRequired(assessed, "requestedStartingLevel"),
    "placement completion ASSESSED must forbid requestedStartingLevel",
  );
  exact(
    errors,
    skipped?.required,
    [
      "resultKind",
      "completionStatus",
      "aggregateScore",
      "referenceLevel",
      "confidence",
      "coverageRatio",
    ],
    "placement completion SKIPPED required fields",
  );
  exact(
    errors,
    skipped?.properties,
    {
      resultKind: { const: "SKIPPED" },
      completionStatus: { const: "SKIPPED" },
      aggregateScore: { type: "null" },
      referenceLevel: { type: "null" },
      confidence: { const: "UNVERIFIED" },
      coverageRatio: { const: 0 },
    },
    "placement completion SKIPPED branch guards",
  );
  add(
    errors,
    branchNotRequired(skipped, "dimensionSummaries"),
    "placement completion SKIPPED must forbid dimension summaries",
  );
  const requestedStartingLevel = properties.requestedStartingLevel;
  add(
    errors,
    sourceClosedObject(eventFragment, requestedStartingLevel),
    "placement completion requested starting level must be closed",
  );
  exact(
    errors,
    sourceRequired(eventFragment, requestedStartingLevel),
    ["level", "authority"],
    "placement completion requested starting level fields",
  );
  exact(
    errors,
    sourceEnum(
      eventFragment,
      sourceProperties(eventFragment, requestedStartingLevel).authority,
    ),
    ["USER_SELECTED_NON_AUTHORITATIVE"],
    "placement completion requested starting level authority",
  );
  exact(
    errors,
    catalogEvent.status,
    "CANONICAL_D2",
    "placement completion catalog status",
  );
  exact(
    errors,
    catalogEvent?.["x-p1r-governance"],
    {
      status: "CANONICAL_D2",
      runtimeStatus: "NOT_RUNTIME_VERIFIED",
      scope: "CROSS_SERVICE_INTEGRATION_FACT",
      producer: {
        service: "assessment-service",
        dataOwner: "assessment-service",
        outboxRequired: true,
        publishOperationId: "publish_assessment_placement_completed_v1",
      },
      consumers: [
        {
          service: "learning-service",
          consumerGroup: "cg.learning-from-assessment.v1",
          subscriptionOperationId:
            "subscribe_assessment_placement_completed_v1_cg_learning_from_assessment_v1",
        },
        {
          service: "workflow-service",
          consumerGroup: "cg.workflow-from-assessment.v1",
          subscriptionOperationId:
            "subscribe_assessment_placement_completed_v1_cg_workflow_from_assessment_v1",
        },
      ],
      transport: {
        protocol: "kafka",
        topic: "platform.assessment.v1",
        partitionKey: "aggregateId",
        aggregateIdSource: "payload.sessionId",
        delivery: "at-least-once",
        bindingVersion: "0.5.0",
        channelId: "assessment_placement_completed_v1",
      },
      schema: {
        schemaVersion: "assessment.event.v1",
        payloadRef: "#/payloadSchemas/B10PlacementCompleted",
        compatibility: "additive",
      },
      correlation: [
        "eventId",
        "aggregateId",
        "requestId",
        "traceId",
        "dedupeKey",
      ],
      traceability: ["ARCH-EVT-001", "INT-P1-017"],
    },
    "placement completion canonical D2 governance",
  );
  exact(
    errors,
    catalogPayload,
    fragmentPayload,
    "placement completion catalog/fragment payload parity",
  );
}

function checkLearnerPlanningSuccessor(b9Learner, policy, errors) {
  const successor = policy?.learnerPlanningSuccessor;
  const planningInput = sourceComponent(
    b9Learner,
    successor?.planningInput?.schema,
  );
  add(
    errors,
    sourceClosedObject(b9Learner, planningInput),
    "B9PlanningInputSnapshot successor input must be closed",
  );
  const planningRequired = sourceRequired(b9Learner, planningInput);
  add(
    errors,
    successor?.planningInput?.addedRequiredFields?.every((field) =>
      planningRequired.includes(field),
    ),
    "M1-012 planning-input required additions drifted",
  );
  exact(
    errors,
    planningInput?.["x-forbidden-fields"],
    successor?.planningInput?.addedForbiddenFields,
    "M1-012 planning-input forbidden-field boundary",
  );
  const planningProperties = sourceProperties(b9Learner, planningInput);
  add(
    errors,
    containsReference(
      planningProperties.placementBaseline,
      `#/components/schemas/${successor?.placementBaselineSchema}`,
    ),
    "B9PlanningInputSnapshot must bind B9PlacementBaseline",
  );
  const sourceMapping = planningInput?.["x-source-mapping"];
  exact(
    errors,
    sourceMapping?.contentProjection,
    [
      "contentVersionId",
      "contentEpoch",
      "projectionVersion",
      "rightsSnapshotVersion",
    ],
    "B9 planning content-projection source mapping",
  );
  exact(
    errors,
    sourceMapping?.assessmentPlacement,
    successor?.planningInput?.sourceMappingAdditions?.assessmentPlacement,
    "B9 planning assessment-placement source mapping",
  );
  exact(
    errors,
    planningInput?.["x-p1r-placement-plan-saga"],
    successor?.placementBinding,
    "B9 planning placement binding",
  );

  const baseline = sourceComponent(
    b9Learner,
    successor?.placementBaselineSchema,
  );
  add(
    errors,
    sourceClosedObject(b9Learner, baseline) && baseline?.readOnly === true,
    "B9PlacementBaseline must remain a closed learning-owned read-only reference",
  );
  const baselineRequired = sourceRequired(b9Learner, baseline);
  add(
    errors,
    [
      "placementSessionId",
      "placementResultId",
      "resultVersion",
      "resultDigest",
      "reportId",
      "reportVersion",
      "reportDigest",
      "manifest",
      "contentPin",
      "answerRulePin",
      "targetPin",
      "sourceEventId",
      "rootEventId",
    ].every((field) => baselineRequired.includes(field)),
    "B9PlacementBaseline durable pin/lineage fields drifted",
  );
  exact(
    errors,
    baseline?.["x-p1r-placement-baseline"]?.lineage,
    successor?.lineage,
    "B9 placement baseline envelope-derived lineage",
  );
  add(
    errors,
    [
      "placementRaw",
      "rawResponse",
      "response",
      "responses",
      "answer",
      "answers",
      "answerKey",
      "answerRule",
      "placementScore",
      "placementAlgorithm",
      "aggregateScore",
      "dimensionSummaries",
      "srsState",
      "mastery",
      "adultGate",
      "consent",
      "phase",
      "policyVersion",
      "contentRights",
    ].every((field) => baseline?.["x-forbidden-fields"]?.includes(field)),
    "B9PlacementBaseline must reject placement raw detail and authority facts",
  );

  const firstDayCommon = sourceComponent(
    b9Learner,
    successor?.firstDay?.commonSchema,
  );
  const consistency = firstDayCommon?.["x-consistency"];
  add(
    errors,
    Array.isArray(consistency) &&
      new Set(consistency).size === consistency.length &&
      successor?.firstDay?.addedConsistency?.every((entry) =>
        consistency.includes(entry),
      ),
    "B9 first-day placement result-kind consistency additions drifted",
  );
}

function checkB26StaticPolicy(b26StaticPolicy, errors) {
  exact(
    errors,
    {
      runtimeStatus: b26StaticPolicy?.runtimeStatus,
      mode: b26StaticPolicy?.mode,
      staticDecision: b26StaticPolicy?.staticDecision,
      defaultDecision: b26StaticPolicy?.defaultDecision,
    },
    {
      runtimeStatus: "pending",
      mode: "static-only",
      staticDecision: "PASS",
      defaultDecision: "NO-GO",
    },
    "B26 placement static-only boundary",
  );
  const topic = (b26StaticPolicy?.topics ?? []).find(
    (entry) => entry?.name === "platform.assessment.v1",
  );
  add(
    errors,
    topic?.ownerService === "assessment-service" &&
      topic?.producerPrincipal === "svc.assessment-service" &&
      stable(topic?.consumerGroups?.map((entry) => entry?.name)) ===
        stable([
          "cg.learning-from-assessment.v1",
          "cg.workflow-from-assessment.v1",
        ]),
    "B26 placement assessment topic ownership/consumers drifted",
  );
  const routing = (b26StaticPolicy?.eventRouting ?? []).find(
    (entry) => entry?.eventName === "assessment.placement.completed.v1",
  );
  exact(
    errors,
    routing,
    {
      eventName: "assessment.placement.completed.v1",
      topic: "platform.assessment.v1",
      partitionKey: "aggregateId",
      consumerGroups: [
        "cg.learning-from-assessment.v1",
        "cg.workflow-from-assessment.v1",
      ],
    },
    "B26 placement event routing",
  );
}

function validateStaticSources(input, errors) {
  const requiredSources = [
    ["b10Placement", "B10 placement OpenAPI"],
    ["b10Assessment", "B10 assessment OpenAPI"],
    ["b1OnboardingPrivacy", "B1 onboarding/privacy OpenAPI"],
    ["b1AuthOnboarding", "B1 auth/onboarding OpenAPI"],
    ["b9Learner", "B9 learner OpenAPI"],
    ["eventFragment", "placement event fragment"],
    ["eventCatalog", "event catalog"],
    ["b26StaticPolicy", "B26 static event policy"],
  ];
  const sourceIsProvided = requiredSources.some(
    ([key]) => input[key] !== undefined,
  );
  if (!sourceIsProvided) return;
  for (const [key, label] of requiredSources)
    add(errors, isRecord(input[key]), `${label} must be an object`);
  if (!requiredSources.every(([key]) => isRecord(input[key]))) return;
  checkCanonicalRoutes(
    input.b10Placement,
    input.b10Assessment,
    input.policy,
    errors,
  );
  checkManifestPinsAndResult(input.b10Placement, input.b10Assessment, errors);
  checkLegacyAdapters(
    input.b1OnboardingPrivacy,
    input.b1AuthOnboarding,
    errors,
  );
  checkCompletionEvent(input.eventFragment, input.eventCatalog, errors);
  checkLearnerPlanningSuccessor(input.b9Learner, input.policy, errors);
  checkB26StaticPolicy(input.b26StaticPolicy, errors);
}

function validateFrozenDigest(policy, errors) {
  const actual = digest(policy);
  add(
    errors,
    actual === FROZEN_POLICY_DIGEST,
    `frozen placement policy digest mismatch: expected ${FROZEN_POLICY_DIGEST}, got ${actual}`,
  );
}

function validateAdversarialCases(policy, errors) {
  exactStringArray(
    errors,
    policy?.adversarialCases,
    EXPECTED_ADVERSARIAL_CASES,
    "placement adversarial case matrix",
  );
  add(
    errors,
    (policy?.adversarialCases?.length ?? 0) >= 60,
    "placement adversarial matrix must cover at least 60 cases",
  );
}

/**
 * Rounds a deterministic placement value without relying on JavaScript's banker's / binary edge behavior.
 * This is a static contract helper, not a runtime scoring implementation claim.
 */
export function roundHalfUp(value, decimalPlaces) {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > 12
  ) {
    throw new TypeError(
      "roundHalfUp requires a finite value and 0..12 decimal places",
    );
  }
  const factor = 10 ** decimalPlaces;
  const magnitude = Math.abs(value) * factor;
  return (
    (Math.sign(value) * Math.floor(magnitude + 0.5 + Number.EPSILON)) / factor
  );
}

export function referenceLevelForRoundedScore(
  score,
  boundaries = LEVEL_BOUNDARIES,
) {
  if (!Number.isInteger(score) || score < 0 || score > 100)
    throw new RangeError(
      "placement score must be an integer from 0 through 100",
    );
  const boundary = boundaries.find(
    (entry) => score >= entry.minimum && score <= entry.maximum,
  );
  if (!boundary) throw new RangeError("placement score has no level boundary");
  return boundary.referenceLevel;
}

export function roundOverallAndReferenceLevel(rawOverallScore) {
  const aggregateScore = roundHalfUp(rawOverallScore, 0);
  return {
    aggregateScore,
    referenceLevel: referenceLevelForRoundedScore(aggregateScore),
  };
}

export function calculatePlacementScore(
  dimensionFacts,
  manifest = { dimensions: DIMENSIONS },
) {
  if (
    !Array.isArray(dimensionFacts) ||
    !isRecord(manifest) ||
    !Array.isArray(manifest.dimensions)
  ) {
    throw new TypeError("dimension facts and a manifest are required");
  }
  const byDimension = new Map(
    dimensionFacts.map((entry) => [entry?.id, entry]),
  );
  if (
    byDimension.size !== DIMENSIONS.length ||
    DIMENSIONS.some(({ id }) => !byDimension.has(id))
  ) {
    throw new RangeError(
      "dimension facts must cover each frozen placement dimension exactly once",
    );
  }
  const scoredDimensions = manifest.dimensions.map((definition) => {
    const fact = byDimension.get(definition.id);
    if (
      !positiveInteger(fact?.availableItemCount) ||
      !Number.isInteger(fact?.earnedItemCount) ||
      fact.earnedItemCount < 0 ||
      fact.earnedItemCount > fact.availableItemCount
    ) {
      throw new RangeError(
        `invalid server-derived item counts for ${definition.id}`,
      );
    }
    const dimensionPercent = roundHalfUp(
      (fact.earnedItemCount / fact.availableItemCount) * 100,
      2,
    );
    return { id: definition.id, dimensionPercent, weight: definition.weight };
  });
  const rawOverallScore = scoredDimensions.reduce(
    (sum, dimension) =>
      sum + (dimension.dimensionPercent * dimension.weight) / 100,
    0,
  );
  return {
    dimensions: scoredDimensions,
    rawOverallScore,
    ...roundOverallAndReferenceLevel(rawOverallScore),
  };
}

export function determineCoverageConfidence(
  dimensionValidItemCounts,
  { skipped = false } = {},
) {
  if (!isRecord(dimensionValidItemCounts))
    throw new TypeError("dimension valid-item counts are required");
  const allowed = new Set(DIMENSIONS.map(({ id }) => id));
  const keys = Object.keys(dimensionValidItemCounts);
  if (
    keys.length !== DIMENSIONS.length ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new RangeError(
      "coverage must include every frozen placement dimension exactly once",
    );
  }
  const totalValidItems = DIMENSIONS.reduce((sum, definition) => {
    const count = dimensionValidItemCounts[definition.id];
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      count > definition.requiredItemCount
    ) {
      throw new RangeError(`invalid coverage count for ${definition.id}`);
    }
    return sum + count;
  }, 0);
  const coverageRatio = totalValidItems / 10;
  const allTargetsMet = DIMENSIONS.every(
    (definition) =>
      dimensionValidItemCounts[definition.id] === definition.requiredItemCount,
  );
  const allDimensionsHaveOne = DIMENSIONS.every(
    (definition) => dimensionValidItemCounts[definition.id] >= 1,
  );
  const confidence =
    skipped || totalValidItems === 0
      ? "UNVERIFIED"
      : coverageRatio === 1 && allTargetsMet
        ? "HIGH"
        : coverageRatio >= 0.8 && allDimensionsHaveOne
          ? "MEDIUM"
          : "LOW";
  return {
    totalValidItems,
    coverageRatio,
    allTargetsMet,
    completeAssessment: allTargetsMet,
    confidence,
  };
}

export function validatePlacementContractData(input = {}) {
  const { policy } = input;
  const errors = [];
  validateHeaders(policy, errors);
  validateRuntimeBoundary(policy, errors);
  validateManifestAndScoring(policy, errors);
  validateCoverageAndResultSafety(policy, errors);
  validatePinsRecoveryAndImmutability(policy, errors);
  validateAuthorizationAndOwnership(policy, errors);
  validateEventSagaAndIntegration(policy, errors);
  validateAdversarialCases(policy, errors);
  validateStaticSources(input, errors);
  validateFrozenDigest(policy, errors);
  return {
    result: errors.length === 0 ? "PASS" : "FAIL",
    errors,
    summary:
      errors.length === 0
        ? {
            task: policy.task,
            sourceContractBaseline: policy.sourceContractBaseline,
            dimensions: policy.manifest.dimensions.length,
            manifestItems: policy.manifest.totalItemCount,
            weightTotal: policy.manifest.dimensions.reduce(
              (sum, dimension) => sum + dimension.weight,
              0,
            ),
            levelBoundaries: policy.levelBoundaries.length,
            adversarialCases: policy.adversarialCases.length,
            runtimeStatus: policy.runtimeStatus,
            contractIntegration: policy.contractIntegration.status,
            frozenPolicyDigest: FROZEN_POLICY_DIGEST,
          }
        : undefined,
  };
}

export function readPlacementContractInputs({ root = defaultRoot } = {}) {
  return {
    policy: readJson(root, DEFAULT_PLACEMENT_POLICY),
    b10Placement: readJson(root, DEFAULT_B10_PLACEMENT_FRAGMENT),
    b10Assessment: readJson(root, DEFAULT_B10_ASSESSMENT_FRAGMENT),
    b1OnboardingPrivacy: readJson(root, DEFAULT_B1_ONBOARDING_PRIVACY_FRAGMENT),
    b1AuthOnboarding: readJson(root, DEFAULT_B1_AUTH_ONBOARDING_FRAGMENT),
    b9Learner: readJson(root, DEFAULT_B9_LEARNER_FRAGMENT),
    eventFragment: readJson(root, DEFAULT_PLACEMENT_EVENT_FRAGMENT),
    eventCatalog: readJson(root, DEFAULT_EVENT_CATALOG),
    b26StaticPolicy: readJson(root, DEFAULT_B26_STATIC_POLICY),
  };
}

export function validatePlacementContract({ root = defaultRoot } = {}) {
  return validatePlacementContractData(readPlacementContractInputs({ root }));
}

function runCli() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const unknown = args.filter((arg) => arg !== "--json");
  if (unknown.length > 0) {
    process.stderr.write(
      "Usage: node scripts/audit/p1r-placement-contract-check.mjs [--json]\n",
    );
    process.exitCode = 2;
    return;
  }
  const report = validatePlacementContract();
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.result === "PASS") {
    process.stdout.write(
      `[p1r-placement-contract] PASS ${report.summary.dimensions} dimensions, ${report.summary.manifestItems} items, ${report.summary.adversarialCases} adversarial cases, runtime=${report.summary.runtimeStatus}, integration=${report.summary.contractIntegration}\n`,
    );
  } else {
    process.stdout.write(
      `[p1r-placement-contract] FAIL\n${report.errors.map((error) => `- ${error}`).join("\n")}\n`,
    );
  }
  process.exitCode = report.result === "PASS" ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCli();
}
