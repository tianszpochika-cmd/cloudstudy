import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  calculatePlacementScore,
  determineCoverageConfidence,
  roundHalfUp,
  roundOverallAndReferenceLevel,
  readPlacementContractInputs,
  validatePlacementContract,
  validatePlacementContractData,
} from "../../scripts/audit/p1r-placement-contract-check.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const policy = JSON.parse(
  fs.readFileSync(
    path.join(root, "config", "p1r-placement-contract.v1.json"),
    "utf8",
  ),
);
const sourceInputs = readPlacementContractInputs({ root });

function clonePolicy() {
  return structuredClone(policy);
}

function cloneSourceInputs() {
  return structuredClone(sourceInputs);
}

function drop(array, value) {
  const index = array.indexOf(value);
  if (index >= 0) array.splice(index, 1);
}

function allowClientAuthority(payload, field) {
  drop(payload.authorization.forbiddenClientAuthorityFields, field);
}

const mutations = {
  CONFIG_UNKNOWN_FIELD: (fixture) => {
    fixture.unknown = true;
  },
  CONFIG_REQUIRED_FIELD_REMOVAL: (fixture) => {
    delete fixture.manifest;
  },
  CONFIG_RUNTIME_PROMOTION: (fixture) => {
    fixture.runtimeStatus = "RUNTIME_VERIFIED";
  },
  SOURCE_BASELINE_DRIFT: (fixture) => {
    fixture.sourceContractBaseline = "0000000000000000000000000000000000000000";
  },
  MANIFEST_ID_DRIFT: (fixture) => {
    fixture.manifest.id = "P1_PLACEMENT_V2";
  },
  MANIFEST_DIMENSION_UNKNOWN: (fixture) => {
    fixture.manifest.dimensions[3].id = "SPEAKING";
  },
  MANIFEST_DIMENSION_ORDER_DRIFT: (fixture) => {
    fixture.manifest.dimensions.reverse();
  },
  MANIFEST_DIMENSION_COUNT_DRIFT: (fixture) => {
    fixture.manifest.dimensions[0].requiredItemCount = 2;
  },
  MANIFEST_TOTAL_ITEM_COUNT_DRIFT: (fixture) => {
    fixture.manifest.totalItemCount = 12;
  },
  MANIFEST_WEIGHT_DRIFT: (fixture) => {
    fixture.manifest.dimensions[0].weight = 24;
  },
  MANIFEST_WEIGHT_SUM_NOT_100: (fixture) => {
    fixture.manifest.dimensions[0].weight = 26;
  },
  SCORING_CORRECT_VALUE_DRIFT: (fixture) => {
    fixture.scoring.correctValue = 2;
  },
  SCORING_UNANSWERED_VALUE_DRIFT: (fixture) => {
    fixture.scoring.unansweredValue = 1;
  },
  SCORING_TIME_FLIPS_CORRECTNESS: (fixture) => {
    fixture.scoring.timeMayChangeCorrectness = true;
  },
  SCORING_FORMULA_DRIFT: (fixture) => {
    fixture.scoring.aggregateFormula = "client supplied score";
  },
  DIMENSION_ROUNDING_DRIFT: (fixture) => {
    fixture.scoring.dimensionRounding.decimalPlaces = 0;
  },
  AGGREGATE_ROUNDING_DRIFT: (fixture) => {
    fixture.scoring.aggregateRounding.method = "ROUND_DOWN";
  },
  ROUNDING_ORDER_DRIFT: (fixture) => {
    fixture.scoring.aggregateRounding.appliedBeforeLevelBoundary = false;
  },
  LEVEL_BOUNDARY_GAP: (fixture) => {
    fixture.levelBoundaries[1].minimum = 41;
  },
  LEVEL_BOUNDARY_OVERLAP: (fixture) => {
    fixture.levelBoundaries[1].minimum = 39;
  },
  LEVEL_BOUNDARY_DRIFT: (fixture) => {
    fixture.levelBoundaries[5].referenceLevel = "C3";
  },
  RESULT_OFFICIAL_CLAIM: (fixture) => {
    fixture.resultSafety.officialCertification = true;
  },
  RESULT_PRECISE_VOCABULARY_LEAK: (fixture) => {
    drop(fixture.resultSafety.forbiddenResultFields, "preciseVocabularyCount");
  },
  CONFIDENCE_HIGH_THRESHOLD_DRIFT: (fixture) => {
    fixture.coverageAndConfidence.high.coverageRatio = 0.9;
  },
  CONFIDENCE_MEDIUM_THRESHOLD_DRIFT: (fixture) => {
    fixture.coverageAndConfidence.medium.minimumCoverageRatio = 0.75;
  },
  CONFIDENCE_LOW_ZERO_ACCEPTED: (fixture) => {
    fixture.coverageAndConfidence.low.minimumCoverageRatioExclusive = -0.01;
  },
  COVERAGE_CORRECTNESS_CONFLATION: (fixture) => {
    fixture.coverageAndConfidence.coverageIsIndependentFromCorrectness = false;
  },
  COVERAGE_MISSING_DIMENSION_PROMOTED: (fixture) => {
    fixture.coverageAndConfidence.completeAssessmentRequiresAllDimensionTargets = false;
  },
  PIN_MANIFEST_FIELD_REMOVAL: (fixture) => {
    drop(fixture.pins.manifest.requiredFields, "placementManifestDigest");
  },
  PIN_CONTENT_FIELD_REMOVAL: (fixture) => {
    drop(fixture.pins.content.requiredFields, "snapshotHash");
  },
  PIN_ANSWER_RULE_FIELD_REMOVAL: (fixture) => {
    drop(fixture.pins.answerRule.requiredFields, "ruleDigest");
  },
  PIN_DIGEST_PATTERN_WEAKENED: (fixture) => {
    fixture.pins.digestPattern = "^.*$";
  },
  SESSION_RECOVERY_NEW_SESSION_ALLOWED: (fixture) => {
    fixture.sessionRecovery.mayCreateReplacementSession = true;
  },
  SESSION_RECOVERY_SNAPSHOT_DRIFT_ALLOWED: (fixture) => {
    fixture.sessionRecovery.mayChangeSnapshotOrRulePins = true;
  },
  SESSION_RECOVERY_TERMINAL_ALLOWED: (fixture) => {
    fixture.sessionRecovery.allowedSessionStates.push("COMPLETED");
  },
  FIRST_DURABLE_RESULT_MUTABLE: (fixture) => {
    fixture.resultImmutability.mayOverwriteOriginalReport = true;
  },
  IDEMPOTENCY_SAME_KEY_REEXECUTES: (fixture) => {
    fixture.resultImmutability.sameIdempotencyKeySamePayload = "REEXECUTE";
  },
  IDEMPOTENCY_DIFFERENT_PAYLOAD_NOT_409: (fixture) => {
    fixture.resultImmutability.sameIdempotencyKeyDifferentPayload =
      "ALLOW_NEW_RESULT";
  },
  RECALIBRATION_OVERWRITES_ORIGINAL: (fixture) => {
    fixture.resultImmutability.recalibration = "OVERWRITE_ORIGINAL";
  },
  SKIP_CONFIDENCE_DRIFT: (fixture) => {
    fixture.skip.baselineConfidence = "LOW";
  },
  SKIP_REFERENCE_LEVEL_LEAK: (fixture) => {
    fixture.skip.referenceLevel = "A1";
  },
  CLIENT_SCORE_INJECTION: (fixture) => {
    allowClientAuthority(fixture, "score");
  },
  CLIENT_LEVEL_INJECTION: (fixture) => {
    allowClientAuthority(fixture, "referenceLevel");
  },
  CLIENT_RECOMMENDATION_INJECTION: (fixture) => {
    allowClientAuthority(fixture, "recommendation");
  },
  CLIENT_TENANT_INJECTION: (fixture) => {
    allowClientAuthority(fixture, "tenantId");
  },
  CLIENT_ANSWER_KEY_INJECTION: (fixture) => {
    allowClientAuthority(fixture, "answerKey");
  },
  AUTHORIZATION_DEFAULT_ALLOW: (fixture) => {
    fixture.authorization.defaultDecision = "ALLOW";
  },
  AUTHORIZATION_TRUSTED_FACT_REMOVAL: (fixture) => {
    drop(fixture.authorization.trustedFacts, "adultGate");
  },
  PEP_NOT_SERVICE_SIDE: (fixture) => {
    fixture.authorization.serviceSidePepRequired = false;
  },
  ASSESSMENT_OWNER_DRIFT: (fixture) => {
    fixture.ownership.assessment.service = "learning-service";
  },
  WORKFLOW_FOREIGN_WRITE_ALLOWED: (fixture) => {
    fixture.ownership.workflow.mayWriteForeignDomainSchema = true;
  },
  LEARNING_REPORT_WRITE_ALLOWED: (fixture) => {
    fixture.ownership.learning.mayModifyPlacementResultOrReport = true;
  },
  LEARNER_PLAN_WRITE_ALLOWED: (fixture) => {
    fixture.ownership.learner.mayWriteLearningPlan = true;
  },
  AUDIT_REPORT_OWNER_DRIFT: (fixture) => {
    fixture.ownership.audit.mayOwnPlacementReport = true;
  },
  COMPLETION_EVENT_HISTORICAL_DEMOTION: (fixture) => {
    fixture.completionEvent.status = "HISTORICAL_CANDIDATE";
  },
  COMPLETION_EVENT_RESULT_KIND_OPEN: (fixture) => {
    fixture.completionEvent.assessed.resultKind = "ANY";
  },
  COMPLETION_EVENT_ENVELOPE_FIELD_PAYLOAD_LEAK: (fixture) => {
    drop(fixture.completionEvent.envelopeOnlyFields, "eventId");
  },
  COMPLETION_EVENT_RAW_RESPONSE_LEAK: (fixture) => {
    drop(fixture.completionEvent.forbiddenPayloadFields, "rawResponse");
  },
  COMPLETION_EVENT_ANSWER_RULE_LEAK: (fixture) => {
    drop(fixture.completionEvent.forbiddenPayloadFields, "answerRule");
  },
  COMPLETION_EVENT_ASSESSED_SUMMARY_REMOVAL: (fixture) => {
    drop(
      fixture.completionEvent.assessed.requiredPayloadGroups,
      "dimension-learner-safe-summary",
    );
  },
  COMPLETION_EVENT_SKIP_CONFIDENCE_DRIFT: (fixture) => {
    fixture.completionEvent.skipped.fixedSummary.confidence = "LOW";
  },
  COMPLETION_EVENT_SKIP_COVERAGE_DRIFT: (fixture) => {
    fixture.completionEvent.skipped.fixedSummary.coverageRatio = 0.1;
  },
  COMPLETION_EVENT_SKIP_SCORE_LEAK: (fixture) => {
    fixture.completionEvent.skipped.fixedSummary.aggregateScore = 10;
  },
  COMPLETION_EVENT_SKIP_LEVEL_LEAK: (fixture) => {
    fixture.completionEvent.skipped.fixedSummary.referenceLevel = "A1";
  },
  COMPLETION_EVENT_SKIP_DIMENSION_LEAK: (fixture) => {
    drop(
      fixture.completionEvent.skipped.forbiddenPayloadGroups,
      "dimension-learner-safe-summary",
    );
  },
  COMPLETION_EVENT_SKIP_ALGORITHM_LEAK: (fixture) => {
    drop(
      fixture.completionEvent.skipped.forbiddenPayloadGroups,
      "assessment-algorithm-or-rule-explanation",
    );
  },
  COMPLETION_EVENT_SKIP_STARTING_LEVEL_AUTHORITY: (fixture) => {
    fixture.completionEvent.skipped.requestedStartingLevel.authority =
      "AUTHORITATIVE_MEASURED_LEVEL";
  },
  COMPLETION_EVENT_DUPLICATE_ALLOWED: (fixture) => {
    fixture.completionEvent.onlyFirstDurableResultMayPublish = false;
  },
  COMPLETION_EVENT_BEFORE_DURABLE: (fixture) => {
    fixture.completionEvent.publishTrigger = "ON_SUBMISSION_RECEIVED";
  },
  COMPLETION_EVENT_RUNTIME_PROMOTION: (fixture) => {
    fixture.completionEvent.runtimeStatus = "RUNTIME_VERIFIED";
  },
  SAGA_UNKNOWN_STEP: (fixture) => {
    fixture.placementPlanSaga.steps[1].id = "WRITE_ASSESSMENT_REPORT";
  },
  SAGA_STEP_ORDER_DRIFT: (fixture) => {
    fixture.placementPlanSaga.steps.reverse();
  },
  SAGA_PLANNING_INPUT_STEP_REMOVAL: (fixture) => {
    fixture.placementPlanSaga.steps.splice(1, 1);
  },
  SAGA_PLANNING_INPUT_NATURAL_KEY_DRIFT: (fixture) => {
    fixture.placementPlanSaga.planningInputNaturalKey =
      "targetId+planningRuleVersion";
  },
  SAGA_PLAN_EFFECT_DEDUPE_DRIFT: (fixture) => {
    fixture.placementPlanSaga.planEffectDedupeKey =
      "sessionId+placementResultId";
  },
  SAGA_FOREIGN_WRITE_ALLOWED: (fixture) => {
    fixture.placementPlanSaga.steps[1].writeBoundary =
      "direct-foreign-schema-write";
  },
  SAGA_DUPLICATE_PLAN_ALLOWED: (fixture) => {
    fixture.placementPlanSaga.oneActivePlanRule = "CREATE_NEW_PLAN_EACH_REPLAY";
  },
  SAGA_FAILURE_MUTATES_REPORT: (fixture) => {
    fixture.placementPlanSaga.planFailure = "ROLL_BACK_PLACEMENT_REPORT";
  },
  SAGA_RECOVERY_DROPS_REPORT: (fixture) => {
    fixture.placementPlanSaga.recovery = "DELETE_REPORT_THEN_RETRY";
  },
  SAGA_KAFKA_RPC_ENABLED: (fixture) => {
    fixture.placementPlanSaga.kafkaRpc = true;
  },
  SAGA_2PC_ENABLED: (fixture) => {
    fixture.placementPlanSaga.twoPhaseCommit = true;
  },
  GAP_CLOSURE_FROM_POLICY: (fixture) => {
    fixture.gapBoundaries.mayNotCloseFromPolicyOnly = false;
  },
  B26_RUNTIME_PROMOTION: (fixture) => {
    fixture.runtimeBoundary.b26.runtimeStatus = "ready";
  },
  RUNTIME_CLAIM_REMOVAL: (fixture) => {
    drop(
      fixture.runtimeBoundary.prohibitedRuntimeClaims,
      "workflow-placement-saga-executed",
    );
  },
  CONTRACT_INTEGRATION_PREMATURE_COMPLETION: (fixture) => {
    fixture.contractIntegration.status = "CONTRACTS_IMPLEMENTED";
  },
  CONTRACT_ROUTE_ALLOWLIST_DRIFT: (fixture) => {
    fixture.contractIntegration.canonicalRoutes[2].operationId =
      "submitB10PlacementStep";
  },
  CONTRACT_SCHEMA_ALLOWLIST_DRIFT: (fixture) => {
    fixture.contractIntegration.schemaBinding = "UNFROZEN_SCHEMA_BINDING";
  },
  CONTRACT_ROUTE_CLIENT_AUTHORITY_LEAK: (fixture) => {
    fixture.contractIntegration.requiredRouteBehavior[1] =
      "client-authoritative-score";
  },
  COMPATIBILITY_PROMOTION_BASELINE_DRIFT: (fixture) => {
    fixture.compatibilityPromotion.immutableGovernanceBaseline =
      "0000000000000000000000000000000000000000";
  },
  COMPATIBILITY_PROMOTION_RUNTIME_PROMOTION: (fixture) => {
    fixture.compatibilityPromotion.runtimeStatus = "RUNTIME_VERIFIED";
  },
};

const sourceMutations = {
  SOURCE_CANONICAL_ROUTE_ALLOWLIST_DRIFT: (fixture) => {
    delete fixture.b10Placement.paths[
      "/api/v1/assessment/placement/reports/{reportId}"
    ];
  },
  SOURCE_CANONICAL_OPERATION_ID_DRIFT: (fixture) => {
    fixture.b10Placement.paths[
      "/api/v1/assessment/placement/sessions"
    ].post.operationId = "createPlacementSession";
  },
  SOURCE_CANONICAL_ROUTE_DEPRECATED: (fixture) => {
    fixture.b10Placement.paths[
      "/api/v1/assessment/placement/sessions"
    ].post.deprecated = true;
  },
  SOURCE_CANONICAL_BEARER_SECURITY_DRIFT: (fixture) => {
    fixture.b10Placement.paths[
      "/api/v1/assessment/placement/sessions"
    ].post.security = [];
  },
  SOURCE_CANONICAL_DEFAULT_ALLOW: (fixture) => {
    fixture.b10Placement.paths["/api/v1/assessment/placement/sessions"].post[
      "x-authorization"
    ].defaultDecision = "ALLOW";
  },
  SOURCE_CANONICAL_TRUSTED_FACT_REMOVAL: (fixture) => {
    drop(
      fixture.b10Placement.paths["/api/v1/assessment/placement/sessions"].post[
        "x-authorization"
      ].trustedFacts,
      "adultGate",
    );
  },
  SOURCE_CANONICAL_PEP_DRIFT: (fixture) => {
    fixture.b10Placement.paths["/api/v1/assessment/placement/sessions"].post[
      "x-authorization"
    ].serviceSidePepRequired = false;
  },
  SOURCE_SUBMIT_REQUEST_OPEN: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementResponseSubmitRequest.additionalProperties = true;
  },
  SOURCE_SUBMIT_REQUIRED_FIELD_REMOVAL: (fixture) => {
    drop(
      fixture.b10Placement.components.schemas.B10PlacementResponseSubmitRequest
        .required,
      "responseDigest",
    );
  },
  SOURCE_SUBMIT_CLIENT_SCORE_ALLOWED: (fixture) => {
    drop(
      fixture.b10Placement.components.schemas.B10PlacementResponseSubmitRequest[
        "x-forbidden-client-fields"
      ],
      "score",
    );
  },
  SOURCE_CANDIDATE_RESPONSE_BRANCH_DRIFT: (fixture) => {
    fixture.b10Assessment.components.schemas.B10CandidateResponse.oneOf.pop();
  },
  SOURCE_MANIFEST_SCORING_DRIFT: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementManifest[
      "x-p1r-placement-manifest"
    ].exactDimensions[0].weight = 24;
  },
  SOURCE_MANIFEST_PIN_REMOVAL: (fixture) => {
    drop(
      fixture.b10Placement.components.schemas.B10PlacementManifestPin.required,
      "placementManifestDigest",
    );
  },
  SOURCE_RESULT_ASSESSED_BRANCH_WEAKENED: (fixture) => {
    const branch =
      fixture.b10Placement.components.schemas.B10PlacementResult.allOf[1].oneOf.find(
        (entry) => entry.properties?.resultKind?.const === "ASSESSED",
      );
    drop(branch.required, "dimensionSummaries");
  },
  SOURCE_RESULT_SKIPPED_DIMENSION_LEAK: (fixture) => {
    const branch =
      fixture.b10Placement.components.schemas.B10PlacementResult.allOf[1].oneOf.find(
        (entry) => entry.properties?.resultKind?.const === "SKIPPED",
      );
    delete branch.not;
  },
  SOURCE_RESULT_SAGA_NATURAL_KEY_DRIFT: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementResult.allOf[0][
      "x-p1r-placement-plan-saga"
    ].activePlanNaturalKey = [
      "targetPin.targetId",
      "planningInput.planningRuleVersion",
    ];
  },
  SOURCE_RESULT_SAGA_DEDUPE_DRIFT: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementResult.allOf[0][
      "x-p1r-placement-plan-saga"
    ].effectDedupeKey = ["sessionId", "placementResultId"];
  },
  SOURCE_RESULT_DIMENSION_ORDER_DRIFT: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementResult.allOf[0].properties.dimensionSummaries[
      "x-p1r-exact-order"
    ].reverse();
  },
  SOURCE_RESULT_DIMENSION_UNIQUENESS_DRIFT: (fixture) => {
    delete fixture.b10Placement.components.schemas.B10PlacementResult.allOf[0]
      .properties.dimensionSummaries["x-unique-by"];
  },
  SOURCE_REPORT_MUTATION_ALLOWED: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementReport[
      "x-p1r-placement-report-result-consistency"
    ].reportMutation = "ALLOWED";
  },
  SOURCE_REPORT_MANIFEST_STRUCTURAL_EQUALITY: (fixture) => {
    fixture.b10Placement.components.schemas.B10PlacementReport[
      "x-p1r-placement-report-result-consistency"
    ].mustEqual[0] = ["result.manifest", "manifest"];
  },
  SOURCE_B1_LEGACY_DEPRECATION_REMOVAL: (fixture) => {
    fixture.b1OnboardingPrivacy.paths[
      "/api/v1/assessment/placement/start"
    ].post.deprecated = false;
  },
  SOURCE_B1_LEGACY_ADAPTER_PROMOTION: (fixture) => {
    fixture.b1AuthOnboarding.paths["/api/v1/assessment/placement/skip"].post[
      "x-p1r-b10-placement-adapter"
    ].adapterOnly = false;
  },
  SOURCE_EVENT_FRAGMENT_PROMOTION: (fixture) => {
    fixture.eventFragment.events.find(
      (entry) => entry.eventName === "assessment.placement.completed.v1",
    ).status = "CANONICAL_D2";
  },
  SOURCE_EVENT_CATALOG_STATUS_DRIFT: (fixture) => {
    fixture.eventCatalog.events.find(
      (entry) => entry.eventName === "assessment.placement.completed.v1",
    ).status = "HISTORICAL_CANDIDATE";
  },
  SOURCE_EVENT_PAYLOAD_OPEN: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.additionalProperties = true;
  },
  SOURCE_EVENT_ENVELOPE_PROPERTY_LEAK: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties.eventId =
      {
        type: "string",
      };
  },
  SOURCE_EVENT_LINEAGE_PROPERTY_LEAK: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties.sourceEventId =
      { type: "string" };
  },
  SOURCE_EVENT_RAW_RESPONSE_LEAK: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties.rawResponse =
      { type: "string" };
  },
  SOURCE_EVENT_PERMISSION_FACT_LEAK: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties.adultGate =
      { type: "boolean" };
  },
  SOURCE_EVENT_RESULT_KIND_OPEN: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties.resultKind.enum.push(
      "UNKNOWN",
    );
  },
  SOURCE_EVENT_ASSESSED_BRANCH_WEAKENED: (fixture) => {
    const branch =
      fixture.eventFragment.payloadSchemas.B10PlacementCompleted.oneOf.find(
        (entry) => entry.properties?.resultKind?.const === "ASSESSED",
      );
    drop(branch.required, "dimensionSummaries");
  },
  SOURCE_EVENT_SKIP_DIMENSION_LEAK: (fixture) => {
    const branch =
      fixture.eventFragment.payloadSchemas.B10PlacementCompleted.oneOf.find(
        (entry) => entry.properties?.resultKind?.const === "SKIPPED",
      );
    delete branch.not;
  },
  SOURCE_EVENT_DIMENSION_COVERAGE_ZERO_REJECTED: (fixture) => {
    const coverage =
      fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties
        .dimensionSummaries.prefixItems[0].properties.coverageRatio;
    delete coverage.minimum;
    coverage.exclusiveMinimum = 0;
  },
  SOURCE_EVENT_STARTING_LEVEL_AUTHORITY_DRIFT: (fixture) => {
    fixture.eventFragment.payloadSchemas.B10PlacementCompleted.properties.requestedStartingLevel.properties.authority.const =
      "AUTHORITATIVE";
  },
  SOURCE_EVENT_GOVERNANCE_RUNTIME_PROMOTION: (fixture) => {
    fixture.eventCatalog.events.find(
      (entry) => entry.eventName === "assessment.placement.completed.v1",
    )["x-p1r-governance"].runtimeStatus = "RUNTIME_VERIFIED";
  },
  SOURCE_B26_RUNTIME_PROMOTION: (fixture) => {
    fixture.b26StaticPolicy.runtimeStatus = "ready";
  },
  SUCCESSOR_PLANNING_REQUIRED_ADDITION_REMOVAL: (fixture) => {
    drop(
      fixture.b9Learner.components.schemas.B9PlanningInputSnapshot.required,
      "placementBaseline",
    );
  },
  SUCCESSOR_PLANNING_FORBIDDEN_AUTHORITY_REMOVAL: (fixture) => {
    drop(
      fixture.b9Learner.components.schemas.B9PlanningInputSnapshot[
        "x-forbidden-fields"
      ],
      "adultGate",
    );
  },
  SUCCESSOR_CONTENT_MAPPING_ADDITION_REMOVAL: (fixture) => {
    drop(
      fixture.b9Learner.components.schemas.B9PlanningInputSnapshot[
        "x-source-mapping"
      ].contentProjection,
      "contentVersionId",
    );
  },
  SUCCESSOR_PLACEMENT_MAPPING_REMOVAL: (fixture) => {
    fixture.b9Learner.components.schemas.B9PlanningInputSnapshot[
      "x-source-mapping"
    ].assessmentPlacement = [];
  },
  SUCCESSOR_PLACEMENT_BINDING_LINEAGE_DRIFT: (fixture) => {
    fixture.b9Learner.components.schemas.B9PlanningInputSnapshot[
      "x-p1r-placement-plan-saga"
    ].lineage.sourceEventId = "CLIENT_SUPPLIED";
  },
  SUCCESSOR_FIRST_DAY_CONSISTENCY_REMOVAL: (fixture) => {
    drop(
      fixture.b9Learner.components.schemas.B9FirstDayProjectionCommon[
        "x-consistency"
      ],
      "placementStatus=SKIPPED implies planningInput.placementBaseline.resultKind=SKIPPED",
    );
  },
  SUCCESSOR_FIRST_DAY_PIN_LINEAGE_CONSISTENCY_REMOVAL: (fixture) => {
    drop(
      fixture.b9Learner.components.schemas.B9FirstDayProjectionCommon[
        "x-consistency"
      ],
      "planningInput placement baseline target/content pins and lineage MUST remain bound while PROCESSING, READY or DEGRADED",
    );
  },
  SUCCESSOR_BASELINE_RAW_LEAK: (fixture) => {
    drop(
      fixture.b9Learner.components.schemas.B9PlacementBaseline[
        "x-forbidden-fields"
      ],
      "rawResponse",
    );
  },
  SUCCESSOR_LINEAGE_DERIVATION_DRIFT: (fixture) => {
    fixture.b9Learner.components.schemas.B9PlacementBaseline[
      "x-p1r-placement-baseline"
    ].lineage.rootEventId = "CLIENT_SUPPLIED";
  },
};

function rejectMutation(name) {
  test(`rejects ${name}`, () => {
    const mutate = sourceMutations[name] ?? mutations[name];
    const sourceFixture = sourceMutations[name] !== undefined;
    assert.equal(typeof mutate, "function", `${name} has no mutation fixture`);
    const fixture = sourceFixture ? cloneSourceInputs() : clonePolicy();
    mutate(fixture);
    const report = sourceFixture
      ? validatePlacementContractData(fixture)
      : validatePlacementContractData({ policy: fixture });
    assert.equal(report.result, "FAIL", `${name} unexpectedly passed`);
    assert.ok(
      report.errors.length > 0,
      `${name} did not produce a fail-closed error`,
    );
  });
}

test("placement policy is a passing static D2 boundary", () => {
  const report = validatePlacementContract({ root });
  assert.equal(report.result, "PASS", report.errors.join("\n"));
  assert.equal(report.summary.runtimeStatus, "NOT_RUNTIME_VERIFIED");
  assert.equal(report.summary.manifestItems, 10);
  assert.equal(report.summary.weightTotal, 100);
  assert.equal(report.summary.contractIntegration, "SOURCE_BOUND_STATIC_D2");
});

test("adversarial matrix is exact, complete, and fail-closed", () => {
  assert.deepEqual(
    Object.keys({ ...mutations, ...sourceMutations }).sort(),
    [...policy.adversarialCases].sort(),
  );
  assert.ok(policy.adversarialCases.length >= 120);
});

for (const caseName of policy.adversarialCases) rejectMutation(caseName);

test("dimension and aggregate rounding occur in the frozen order before level mapping", () => {
  assert.equal(roundHalfUp(12.345, 2), 12.35);
  assert.deepEqual(roundOverallAndReferenceLevel(39.49), {
    aggregateScore: 39,
    referenceLevel: "A1",
  });
  assert.deepEqual(roundOverallAndReferenceLevel(39.5), {
    aggregateScore: 40,
    referenceLevel: "A2",
  });
  assert.deepEqual(roundOverallAndReferenceLevel(59.5), {
    aggregateScore: 60,
    referenceLevel: "B1",
  });
  assert.deepEqual(roundOverallAndReferenceLevel(74.5), {
    aggregateScore: 75,
    referenceLevel: "B2",
  });
  assert.deepEqual(roundOverallAndReferenceLevel(84.5), {
    aggregateScore: 85,
    referenceLevel: "C1",
  });
  assert.deepEqual(roundOverallAndReferenceLevel(92.5), {
    aggregateScore: 93,
    referenceLevel: "C2",
  });
  const scored = calculatePlacementScore(
    [
      { id: "VOCABULARY", earnedItemCount: 2, availableItemCount: 3 },
      { id: "BASIC_GRAMMAR", earnedItemCount: 1, availableItemCount: 3 },
      { id: "READING", earnedItemCount: 1, availableItemCount: 2 },
      { id: "LISTENING", earnedItemCount: 1, availableItemCount: 2 },
    ],
    policy.manifest,
  );
  assert.deepEqual(
    scored.dimensions.map(({ id, dimensionPercent }) => ({
      id,
      dimensionPercent,
    })),
    [
      { id: "VOCABULARY", dimensionPercent: 66.67 },
      { id: "BASIC_GRAMMAR", dimensionPercent: 33.33 },
      { id: "READING", dimensionPercent: 50 },
      { id: "LISTENING", dimensionPercent: 50 },
    ],
  );
  assert.equal(scored.aggregateScore, 50);
  assert.equal(scored.referenceLevel, "A2");
});

test("coverage confidence is independent from correctness and follows HIGH/MEDIUM/LOW/UNVERIFIED rules", () => {
  assert.deepEqual(
    determineCoverageConfidence({
      VOCABULARY: 3,
      BASIC_GRAMMAR: 3,
      READING: 2,
      LISTENING: 2,
    }),
    {
      totalValidItems: 10,
      coverageRatio: 1,
      allTargetsMet: true,
      completeAssessment: true,
      confidence: "HIGH",
    },
  );
  assert.deepEqual(
    determineCoverageConfidence({
      VOCABULARY: 3,
      BASIC_GRAMMAR: 2,
      READING: 1,
      LISTENING: 2,
    }),
    {
      totalValidItems: 8,
      coverageRatio: 0.8,
      allTargetsMet: false,
      completeAssessment: false,
      confidence: "MEDIUM",
    },
  );
  assert.deepEqual(
    determineCoverageConfidence({
      VOCABULARY: 3,
      BASIC_GRAMMAR: 0,
      READING: 1,
      LISTENING: 0,
    }),
    {
      totalValidItems: 4,
      coverageRatio: 0.4,
      allTargetsMet: false,
      completeAssessment: false,
      confidence: "LOW",
    },
  );
  assert.equal(
    determineCoverageConfidence({
      VOCABULARY: 0,
      BASIC_GRAMMAR: 0,
      READING: 0,
      LISTENING: 0,
    }).confidence,
    "UNVERIFIED",
  );
  assert.equal(
    determineCoverageConfidence(
      { VOCABULARY: 3, BASIC_GRAMMAR: 3, READING: 2, LISTENING: 2 },
      { skipped: true },
    ).confidence,
    "UNVERIFIED",
  );
});

test("CLI reports the static D2 source binding without claiming runtime verification", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/audit/p1r-placement-contract-check.mjs", "--json"],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.result, "PASS");
  assert.equal(report.summary.runtimeStatus, "NOT_RUNTIME_VERIFIED");
  assert.equal(report.summary.contractIntegration, "SOURCE_BOUND_STATIC_D2");
});
