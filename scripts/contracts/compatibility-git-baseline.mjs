import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  M1008_CANONICAL_ENVELOPE,
  M1008_CONTENT_EVENT_NAMES,
  M1008_SOURCE_CONTRACT_BASELINE_REF,
  M1008_CONTENT_PROMOTION_ID,
  M1009_MEDIA_PROMOTION_ID,
  M1009_SOURCE_CONTRACT_BASELINE_REF,
  M1010_ASSESSMENT_PROMOTION_ID,
  M1010_SOURCE_CONTRACT_BASELINE_REF,
  M1011_LEARNER_PLANNING_PROMOTION_ID,
  M1011_SOURCE_CONTRACT_BASELINE_REF,
  M1012_PLACEMENT_PROMOTION_ID,
  M1012_SOURCE_CONTRACT_BASELINE_REF,
  M1013_LEARNING_LOOP_PROMOTION_ID,
  M1013_SOURCE_CONTRACT_BASELINE_REF,
  M1013_IMMUTABLE_GOVERNANCE_BASELINE_REF,
  M1013_APPROVED_CANONICAL_EVENTS,
  M1013_CANONICAL_ROUTE_PROJECTIONS,
  M1013_LEGACY_ADAPTER_PROJECTIONS,
  M1013_PROMOTION_ALLOWANCE_KEYS,
  M1013_EVENT_PAYLOAD_SCHEMA_PROJECTIONS,
  M1013_ASYNCAPI_CHANNEL_PROJECTIONS,
  M1013_ASYNCAPI_OPERATION_PROJECTIONS,
  M1013_OPENAPI_APPROVED_PARAMETER_PROJECTIONS,
  M1013_OPENAPI_APPROVED_SCHEMA_PROJECTIONS,
  M1013_OPENAPI_SOURCE_SEMANTIC_SHA256,
  M1013_OPENAPI_EXPECTED_SEMANTIC_SHA256,
  M1013_EVENT_SOURCE_SEMANTIC_SHA256,
  M1013_EVENT_EXPECTED_SEMANTIC_SHA256,
  M1013_B26_SOURCE_SEMANTIC_SHA256,
  M1013_B26_EXPECTED_SEMANTIC_SHA256,
  buildM1013OpenApiExpectedProjection,
  buildM1013EventExpectedProjection,
  buildM1013B26ExpectedProjection,
  compareM1013OpenApiDescriptors,
  compareM1013EventDescriptors,
  compareM1013B26Descriptors,
  M1014_GAMIFICATION_SOCIAL_PROMOTION_ID,
  M1014_SOURCE_CONTRACT_BASELINE_REF,
  M1014_IMMUTABLE_GOVERNANCE_BASELINE_REF,
  M1014_PROMOTION_ALLOWANCE_KEYS,
  M1014_POLICY_SEMANTIC_SHA256,
  buildM1014OpenApiExpectedProjection,
  buildM1014EventExpectedProjection,
  buildM1014B26ExpectedProjection,
  compareM1014OpenApiDescriptors,
  compareM1014EventDescriptors,
  compareM1014B26Descriptors,
  M1015_COMMERCE_PROMOTION_ID,
  M1015_SOURCE_CONTRACT_BASELINE_REF,
  M1015_IMMUTABLE_GOVERNANCE_BASELINE_REF,
  M1015_PROMOTION_ALLOWANCE_KEYS,
  M1015_POLICY_SEMANTIC_SHA256,
  M1015_APPROVED_SOURCE_FILES_SEMANTIC_SHA256,
  M1015_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256,
  M1015_B26_STATIC_POLICY_SEMANTIC_SHA256,
  M1015_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256,
  M1015_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256,
  buildM1015OpenApiExpectedProjection,
  buildM1015EventExpectedProjection,
  buildM1015B26ExpectedProjection,
  compareM1015OpenApiDescriptors,
  compareM1015EventDescriptors,
  compareM1015B26Descriptors,
  M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID,
  M1016_SOURCE_CONTRACT_BASELINE_REF,
  M1016_IMMUTABLE_GOVERNANCE_BASELINE_REF,
  M1016_PROMOTION_ALLOWANCE_KEYS,
  M1016_POLICY_SEMANTIC_SHA256,
  M1016_APPROVED_SOURCE_FILES_SEMANTIC_SHA256,
  M1016_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256,
  M1016_B26_STATIC_POLICY_SEMANTIC_SHA256,
  M1016_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256,
  M1016_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256,
  buildM1016OpenApiExpectedProjection,
  buildM1016EventExpectedProjection,
  buildM1016B26ExpectedProjection,
  compareM1016OpenApiDescriptors,
  compareM1016EventDescriptors,
  compareM1016B26Descriptors,
  M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID,
  M1017_SOURCE_CONTRACT_BASELINE_REF,
  M1017_IMMUTABLE_GOVERNANCE_BASELINE_REF,
  M1017_PROMOTION_ALLOWANCE_KEYS,
  M1017_POLICY_SEMANTIC_SHA256,
  M1017_APPROVED_SOURCE_FILES_SEMANTIC_SHA256,
  M1017_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256,
  M1017_B26_STATIC_POLICY_SEMANTIC_SHA256,
  M1018_IAM_EVENT_PROMOTION_ID,
  M1018_SOURCE_CONTRACT_BASELINE_REF,
  M1018_IMMUTABLE_GOVERNANCE_BASELINE_REF,
  M1018_PROMOTION_ALLOWANCE_KEYS,
  M1018_POLICY_SEMANTIC_SHA256,
  M1018_APPROVED_SOURCE_FILES_SEMANTIC_SHA256,
  M1018_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256,
  M1018_B26_STATIC_POLICY_SEMANTIC_SHA256,
  isValidM1018PromotionAllowance,
  M2001_GATEWAY_EXECUTION_TARGET_PROMOTION_ID,
  M2001_SOURCE_CONTRACT_BASELINE_REF,
  M2001_OPENAPI_SOURCE_SEMANTIC_SHA256,
  M2001_PROMOTION_ALLOWANCE_KEYS,
  isValidM2001PromotionAllowance,
  buildM1008PromotionExpectedCatalog,
  compareB26WorkflowGovernance,
  compareContracts,
  hasEventGovernance,
  stableGovernanceSha256,
  stableGovernanceValue,
} from './compatibility-diff.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const contractPaths = {
  openapi: 'packages/contracts/openapi/v1/openapi.json',
  events: 'packages/contracts/events/v1/catalog.json',
  schema: 'packages/contracts/schemas/v1/registry.json',
};
const b26RuntimePath = 'config/b26-event-runtime.json';
const contentLifecyclePolicyPath = 'config/p1r-content-lifecycle.v1.json';
const mediaContractPolicyPath = 'config/p1r-media-contract.v1.json';
const assessmentContractPolicyPath = 'config/p1r-assessment-contract.v1.json';
const learnerPlanningContractPolicyPath = 'config/p1r-learner-planning-contract.v1.json';
const placementContractPolicyPath = 'config/p1r-placement-contract.v1.json';
const learningLoopContractPolicyPath = 'config/p1r-learning-loop-contract.v1.json';
const gamificationSocialContractPolicyPath = 'config/p1r-gamification-social-contract.v1.json';
const commerceContractPolicyPath = 'config/p1r-commerce-contract.v1.json';
const notificationSyncSupportContractPolicyPath = 'config/p1r-notification-sync-support-contract.v1.json';
const privacyAnalyticsAuditContractPolicyPath = 'config/p1r-privacy-analytics-audit-contract.v1.json';
const iamEventContractPolicyPath = 'config/p1r-iam-event-contract.v1.json';
const gatewayBoundaryContractPath = 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json';

export const REQUIRED_CI_CONTRACT_BASELINE_REF = '463c4b238caceb1592bff6c61327c00ab9bac922';
export const REQUIRED_EVENT_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF = M1008_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF = M1009_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF = M1010_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF = M1011_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF = M1012_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF = M1013_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF = M1014_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF = M1015_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF = M1016_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1017_SOURCE_CONTRACT_BASELINE_REF = M1017_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M1018_SOURCE_CONTRACT_BASELINE_REF = M1018_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_M2001_SOURCE_CONTRACT_BASELINE_REF = M2001_SOURCE_CONTRACT_BASELINE_REF;
export const REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND =
  `pnpm contracts:compatibility:git -- --ref ${REQUIRED_CI_CONTRACT_BASELINE_REF} --governance-ref ${REQUIRED_EVENT_GOVERNANCE_BASELINE_REF} --kind all --json`;
export const REQUIRED_CI_CONTRACT_COMMANDS = Object.freeze([
  'pnpm contracts:merge:check',
  'pnpm contracts:generate:check',
  'pnpm contracts:validate',
  REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND,
]);

function workflowLines(workflowText) {
  return String(workflowText).replace(/\r\n/g, '\n').split('\n');
}

function workflowJob(workflowText, name) {
  const lines = workflowLines(workflowText);
  const jobsStart = lines.findIndex((line) => line === 'jobs:');
  if (jobsStart < 0) return [];
  const start = lines.findIndex((line, index) => index > jobsStart && line === `  ${name}:`);
  if (start < 0) return [];
  const endOffset = lines.slice(start + 1).findIndex((line) => /^  [a-z0-9-]+:\s*$/.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start, end);
}

function workflowSteps(jobLines) {
  const steps = [];
  for (let index = 0; index < jobLines.length; index += 1) {
    const match = jobLines[index].match(/^(\s*)-\s+(run|uses):\s*(.*?)\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    let end = index + 1;
    while (end < jobLines.length) {
      const line = jobLines[end];
      if (line.trim().length > 0) {
        const nextIndent = line.match(/^\s*/)[0].length;
        if (nextIndent <= indent) break;
      }
      end += 1;
    }
    steps.push({ kind: match[2], value: match[3], lines: jobLines.slice(index, end) });
    index = end - 1;
  }
  return steps;
}

export function hasRequiredCiContractBaseline(workflowText) {
  const source = String(workflowText);
  return !source.includes('P1R_CONTRACT_BASELINE_REF')
    && !source.includes('P1R_EVENT_GOVERNANCE_BASELINE_REF')
    && source.split(REQUIRED_CI_CONTRACT_COMPATIBILITY_COMMAND).length === 2;
}

export function inspectRequiredCiContractGate(workflowText) {
  const jobLines = workflowJob(workflowText, 'contracts-and-data');
  const steps = workflowSteps(jobLines);
  const expectedJobDirectLines = [
    '    name: Contracts and data boundaries',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 20',
    '    needs: governance',
    '    steps:',
  ];
  const jobDirectLines = jobLines.filter((line) => /^ {4}\S/.test(line) && !/^ {4}#/.test(line));
  const hasExactJobShape = JSON.stringify(jobDirectLines) === JSON.stringify(expectedJobDirectLines);
  const checkoutSteps = steps.filter((step) => step.kind === 'uses' && step.value === 'actions/checkout@v4');
  const expectedCheckoutLines = [
    '      - uses: actions/checkout@v4',
    '        with:',
    '          fetch-depth: 0',
  ];
  const hasFullHistoryCheckout = checkoutSteps.length === 1
    && JSON.stringify(checkoutSteps[0].lines.filter((line) => line.trim().length > 0 && !/^\s*#/.test(line)))
      === JSON.stringify(expectedCheckoutLines);

  const commands = Object.fromEntries(REQUIRED_CI_CONTRACT_COMMANDS.map((command) => {
    const matches = steps.filter((step) => step.kind === 'run' && step.value === command);
    const exactUnconditional = matches.length === 1
      && matches[0].lines.filter((line) => line.trim().length > 0 && !/^\s*#/.test(line)).length === 1;
    return [command, exactUnconditional];
  }));

  return {
    hasRequiredBaseline: hasRequiredCiContractBaseline(workflowText),
    hasContractsAndDataJob: jobLines.length > 0,
    hasFullHistoryCheckout,
    hasExactJobShape,
    hasUnsafeJobControl: !hasExactJobShape,
    commands,
    valid: jobLines.length > 0
      && hasRequiredCiContractBaseline(workflowText)
      && hasFullHistoryCheckout
      && hasExactJobShape
      && Object.values(commands).every(Boolean),
  };
}

export function parseArgs(argv) {
  // pnpm forwards its leading separator to package scripts; preserve all real flags.
  if (argv[0] === '--') argv = argv.slice(1);
  const args = { kind: 'all', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--help') args.help = true;
    else if (value === '--kind') args.kind = argv[++index];
    else if (value === '--ref') args.ref = argv[++index];
    else if (value === '--governance-ref') args.governanceRef = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function defaultGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}

function normalizeKind(kind) {
  if (kind === 'all') return Object.keys(contractPaths);
  if (kind in contractPaths) return [kind];
  throw new Error(`Unsupported contract kind: ${kind}`);
}

const M1008_HISTORICAL_CONTENT_EVENTS = Object.freeze([
  'content.public_projection.invalidated.v1',
  'cms.content.submitted.v1',
  'cms.review.decided.v1',
  'cms.content.published.v1',
  'cms.content.rolled_back.v1',
  'cms.content.version_saved.v1',
  'cms.import.completed.v1',
]);

const M1008_POLICY_TOP_LEVEL_KEYS = Object.freeze([
  '$schema',
  'schemaVersion',
  'taskId',
  'phase',
  'maturity',
  'runtimeStatus',
  'sourceOfTruth',
  'sourceRefs',
  'owner',
  'persistentVersionStates',
  'reviewStages',
  'legacyWireAliases',
  'commands',
  'actorClasses',
  'reviewWorkflow',
  'publishEligibility',
  'internalRetirement',
  'schedule',
  'projection',
  'legacyB1',
  'eventGovernance',
  'plannedClosureDisposition',
  'runtimeEvidenceBoundary',
]);

const M1008_EVENT_GOVERNANCE_KEYS = Object.freeze([
  'catalogPath',
  'b26Path',
  'reliabilityPolicyPath',
  'canonicalEvents',
  'historicalOnlyEvents',
  'canonicalTopic',
  'canonicalProducer',
  'canonicalEnvelope',
  'canonicalRuntimeStatus',
  'compatibilityPromotion',
]);

const M1008_PROMOTION_KEYS = Object.freeze([
  'sourceContractBaseline',
  'immutableGovernanceBaseline',
  'fromStatus',
  'toStatus',
  'eventNames',
  'gapIds',
  'topic',
  'addedConsumerGroups',
  'runtimeStatus',
]);

const M1008_CLOSED_GAPS = Object.freeze([
  {
    gapId: 'EVENT-GAP-CONTENT-DUPLICATE',
    status: 'D2_CONTRACT_CLOSED',
    closureTask: 'P1R-M1-008',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    remainingRuntimeTasks: ['P1R-M2-005', 'P1R-M2-006'],
  },
  {
    gapId: 'EVENT-GAP-BIND-CONT-001',
    status: 'D2_CONTRACT_CLOSED',
    closureTask: 'P1R-M1-008',
    maturity: 'D2_CONTRACT_READY',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    remainingRuntimeTasks: ['P1R-M2-005', 'P1R-M2-006'],
  },
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactPolicyKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (stableGovernanceValue(actual) !== stableGovernanceValue(wanted)) {
    errors.push(`${label} keys are not the frozen M1-008 set`);
  }
}

function exactPolicyValue(value, expected, label, errors) {
  if (stableGovernanceValue(value) !== stableGovernanceValue(expected)) {
    errors.push(`${label} is not the frozen M1-008 value`);
  }
}

export function validateM1008CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyKeys(policy, M1008_POLICY_TOP_LEVEL_KEYS, 'content lifecycle policy', errors);
  if (!isRecord(policy)) return errors;
  exactPolicyValue(policy.$schema, 'p1r.content-lifecycle.v1', 'content lifecycle policy $schema', errors);
  exactPolicyValue(policy.schemaVersion, 'p1r.content-lifecycle.v1', 'content lifecycle policy schemaVersion', errors);
  exactPolicyValue(policy.taskId, 'P1R-M1-008', 'content lifecycle policy taskId', errors);
  exactPolicyValue(policy.phase, 'PHASE_1', 'content lifecycle policy phase', errors);
  exactPolicyValue(policy.maturity, 'D2_CONTRACT_READY', 'content lifecycle policy maturity', errors);
  exactPolicyValue(policy.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'content lifecycle policy runtimeStatus', errors);
  exactPolicyValue(policy.sourceOfTruth, contentLifecyclePolicyPath, 'content lifecycle policy sourceOfTruth', errors);
  exactPolicyValue(policy.sourceRefs, [
    'JNY-P1-13',
    'INT-P1-005',
    'INT-P1-011',
    'ADM-0493-ADM-0540',
    'docs/06-design/v2-980plus/phase1-business-operation/README.md',
    'packages/contracts/fragments/b9/b9-content.openapi.json',
  ], 'content lifecycle policy sourceRefs', errors);
  exactPolicyValue(policy.owner, {
    service: 'content-service',
    dataOwner: 'content-service',
    gatewayDomainWrite: 'PROHIBITED',
    foreignSchemaWrite: 'PROHIBITED',
    actorContext: 'SERVER_DERIVED',
    clientRoleHeader: 'PROHIBITED',
  }, 'content lifecycle policy owner', errors);
  exactPolicyValue(policy.reviewWorkflow, {
    contentBindingFields: ['contentVersionId', 'contentHash'],
    stageOrder: ['FIRST_REVIEW', 'FINAL_REVIEW'],
    clientStageOrActorFacts: 'PROHIBITED',
    reviewFirstRequiredFacts: ['VALIDATION_REPORT_PASS', 'CONTENT_HASH_MATCH', 'EDITOR_DISTINCT', 'REVIEW_VERSION_CURRENT'],
    reviewFinalRequiredFacts: ['FIRST_REVIEW_APPROVED', 'CONTENT_HASH_MATCH', 'EDITOR_DISTINCT', 'FIRST_REVIEWER_DISTINCT', 'REVIEW_VERSION_CURRENT'],
    protectedContentMutation: 'INVALIDATE_VALIDATION_AND_REVIEWS',
    recordProjection: {
      policyId: 'P1R-B9-REVIEW-CHAIN-V1',
      scope: 'CURRENT_CONTENT_VERSION_CHAIN',
      collectionSemantics: 'STAGE_KEYED_SET_ORDER_INDEPENDENT',
      allowedShapes: ['EMPTY', 'FIRST_ONLY', 'FIRST_AND_FINAL'],
      recordIdentityFields: ['contentVersionId', 'contentHash'],
      identityConstraint: 'ALL_RECORDS_SAME_AND_MATCH_EXACTLY_ONE_VERSION_SUMMARY',
      allowedStageSets: [[], ['FIRST_REVIEW'], ['FIRST_REVIEW', 'FINAL_REVIEW']],
      workflowStageOrder: ['FIRST_REVIEW', 'FINAL_REVIEW'],
      stageMaxOccurrences: { FIRST_REVIEW: 1, FINAL_REVIEW: 1 },
      finalPrerequisite: {
        predecessorStage: 'FIRST_REVIEW',
        predecessorDecision: 'APPROVED',
        sameIdentityFields: ['contentVersionId', 'contentHash'],
        precedence: 'STRICTLY_PRECEDES',
      },
      reviewVersionUniquenessScope: ['contentVersionId', 'contentHash', 'reviewStage'],
      approvedOrLaterStatesRequireBothApproved: ['APPROVED', 'PUBLISHED', 'ARCHIVED'],
      writer: 'SERVER_DERIVED_READ_ONLY',
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    },
  }, 'content lifecycle review workflow', errors);
  exactPolicyValue(policy.publishEligibility, {
    owner: 'content-service',
    clientFactSubmission: 'PROHIBITED',
    bindingFields: ['contentVersionId', 'contentHash', 'expectedStateVersion'],
    requiredFacts: [
      { name: 'VALIDATION_REPORT', requiredFields: ['reportId', 'reportVersion', 'contentHash'], decision: 'PASS' },
      { name: 'FIRST_REVIEW', requiredFields: ['reviewVersion', 'contentHash'], decision: 'APPROVED' },
      { name: 'FINAL_REVIEW', requiredFields: ['reviewVersion', 'contentHash'], decision: 'APPROVED' },
      { name: 'RIGHTS_SNAPSHOT', requiredFields: ['snapshotId', 'snapshotVersion'], decision: 'VALID' },
      { name: 'MEDIA', requiredFields: [], decision: 'READY' },
      { name: 'PHASE_FEATURE_GATE', requiredFields: [], decision: 'ALLOW' },
    ],
    actorFactFields: ['editorSubjectId', 'firstReviewerSubjectId', 'finalReviewerSubjectId', 'releaseOperatorSubjectId'],
    actorSeparation: 'ALL_FOUR_DISTINCT',
    protectedContentMutation: 'INVALIDATE_VALIDATION_AND_REVIEWS',
    scheduleExecution: 'RECHECK_ALL_REQUIRED_FACTS',
  }, 'content lifecycle publish eligibility', errors);
  exactPolicyValue(policy.internalRetirement, {
    externalCommand: 'PROHIBITED',
    handlerOwner: 'content-service',
    callerIdentity: 'B8WorkloadIdentity',
    externalExposure: 'DENY',
    fromStates: ['PUBLISHED'],
    terminalState: 'ARCHIVED',
    allowedReasons: ['RETENTION_EXPIRED', 'RIGHTS_PERMANENTLY_REMOVED', 'SECURITY_PERMANENTLY_REMOVED', 'LEGAL_PERMANENTLY_REMOVED'],
    currentPublicationPrecondition: 'MUST_NOT_REFERENCE_TARGET_VERSION',
    rollbackEligibilityPrecondition: 'MUST_NOT_BE_ROLLBACK_TARGET',
    activePinPrecondition: 'NO_ACTIVE_PIN_OR_ALL_PINS_EXPLICIT_UNAVAILABLE_EMERGENCY',
    recovery: 'PROHIBITED',
    idempotencyScope: 'contentVersionId+expectedStateVersion+retirementReason',
    correlationFields: ['retirementId', 'auditId', 'requestId', 'traceId', 'contentVersionId', 'stateVersion'],
    canonicalEvent: 'NONE',
    implementationTask: 'P1R-M3-006',
    runtimeEvidenceTask: 'P1R-M2-004',
  }, 'content lifecycle internal retirement', errors);

  const governance = policy.eventGovernance;
  exactPolicyKeys(governance, M1008_EVENT_GOVERNANCE_KEYS, 'content event governance policy', errors);
  if (isRecord(governance)) {
    exactPolicyValue(governance.catalogPath, 'packages/contracts/events/v1/catalog.json', 'content event governance catalogPath', errors);
    exactPolicyValue(governance.b26Path, 'config/b26-event-runtime.json', 'content event governance b26Path', errors);
    exactPolicyValue(governance.reliabilityPolicyPath, 'packages/contracts/events/v1/reliability-policy.json', 'content event governance reliabilityPolicyPath', errors);
    exactPolicyValue(governance.canonicalEvents, M1008_CONTENT_EVENT_NAMES, 'content event governance canonicalEvents', errors);
    exactPolicyValue(governance.historicalOnlyEvents, M1008_HISTORICAL_CONTENT_EVENTS, 'content event governance historicalOnlyEvents', errors);
    exactPolicyValue(governance.canonicalTopic, 'platform.content.v1', 'content event governance canonicalTopic', errors);
    exactPolicyValue(governance.canonicalProducer, 'content-service', 'content event governance canonicalProducer', errors);
    exactPolicyValue(governance.canonicalEnvelope, M1008_CANONICAL_ENVELOPE, 'content event governance canonicalEnvelope', errors);
    exactPolicyValue(governance.canonicalRuntimeStatus, 'NOT_RUNTIME_VERIFIED', 'content event governance canonicalRuntimeStatus', errors);
    const promotion = governance.compatibilityPromotion;
    exactPolicyKeys(promotion, M1008_PROMOTION_KEYS, 'M1-008 compatibility promotion', errors);
    exactPolicyValue(promotion, {
      sourceContractBaseline: REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
      immutableGovernanceBaseline: REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
      fromStatus: 'HISTORICAL_CANDIDATE',
      toStatus: 'CANONICAL_D2',
      eventNames: M1008_CONTENT_EVENT_NAMES,
      gapIds: M1008_CLOSED_GAPS.map((gap) => gap.gapId),
      topic: 'platform.content.v1',
      addedConsumerGroups: ['cg.admin-ops-from-content.v1', 'cg.audit-from-content.v1'],
      runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    }, 'M1-008 compatibility promotion', errors);
  }
  exactPolicyValue(policy.plannedClosureDisposition, M1008_CLOSED_GAPS, 'M1-008 planned closure disposition', errors);
  return errors;
}

function loadM1008CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...contentLifecyclePolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-008 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1008CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-008 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  const promotion = policy.eventGovernance.compatibilityPromotion;
  return Object.freeze({
    id: M1008_CONTENT_PROMOTION_ID,
    sourceContractBaseline: promotion.sourceContractBaseline,
    immutableGovernanceBaseline: promotion.immutableGovernanceBaseline,
    fromStatus: promotion.fromStatus,
    toStatus: promotion.toStatus,
    eventNames: [...promotion.eventNames],
    gapIds: [...promotion.gapIds],
    topic: promotion.topic,
    addedConsumerGroups: [...promotion.addedConsumerGroups],
    runtimeStatus: promotion.runtimeStatus,
    canonicalEnvelope: [...policy.eventGovernance.canonicalEnvelope],
    closureStatus: 'D2_CONTRACT_CLOSED',
  });
}

export function validateM1009CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyValue(policy?.task, 'P1R-M1-009', 'media contract policy task', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'media contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'media contract policy runtimeStatus', errors);
  exactPolicyValue(policy?.compatibilityPromotion, {
    id: M1009_MEDIA_PROMOTION_ID,
    sourceContractBaseline: REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    previousPromotion: M1008_CONTENT_PROMOTION_ID,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    scope: 'OPENAPI_ONLY',
    eventCatalogDecision: 'UNCHANGED_HISTORICAL_ONLY',
    canonicalFragment: 'packages/contracts/fragments/b11/p1r-media.openapi.json',
  }, 'M1-009 compatibility promotion', errors);
  return errors;
}

function loadM1009CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...mediaContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-009 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1009CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-009 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

export function validateM1010CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyValue(policy?.task, 'P1R-M1-010', 'assessment contract policy task', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'assessment contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'assessment contract policy runtimeStatus', errors);
  exactPolicyValue(policy?.compatibilityPromotion, {
    id: M1010_ASSESSMENT_PROMOTION_ID,
    sourceContractBaseline: REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    previousPromotion: M1009_MEDIA_PROMOTION_ID,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    scope: 'OPENAPI_AND_HISTORICAL_EVENT_PAYLOADS',
    eventCatalogDecision: 'HISTORICAL_PAYLOADS_ONLY_NO_CANONICAL_PROMOTION',
    canonicalFragment: 'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json',
    legacyAdapterFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json',
    historicalEventFragment: 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json',
  }, 'M1-010 compatibility promotion', errors);
  return errors;
}

function loadM1010CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...assessmentContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-010 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1010CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-010 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

const M1011_AUTHORIZATION_POLICY_KEYS = Object.freeze([
  'defaultDecision',
  'pep',
  'bearerSecurity',
  'trustedFacts',
  'genericClientAuthority',
  'recoveryClientAuthority',
  'forbiddenClientFieldsBySchema',
]);
const M1011_PLANNING_INPUT_POLICY_KEYS = Object.freeze([
  'schema',
  'owner',
  'projectionOwner',
  'requiredFields',
  'forbiddenFields',
  'positiveIntegerFields',
  'pinnedStringFields',
  'opaqueStringFields',
  'pinDigest',
  'eligibilitySnapshotDigest',
  'sourceMapping',
  'referenceBindings',
  'placementBinding',
  'planAndSrsBinding',
]);
const M1011_CONCURRENCY_POLICY_KEYS = Object.freeze([
  'ifMatchParameter',
  'writeOperationIds',
  'writeParameterRefs',
  'operationBinding',
]);
const M1011_FIRST_DAY_POLICY_KEYS = Object.freeze([
  'schema',
  'commonSchema',
  'owner',
  'planOwner',
  'stateField',
  'states',
  'baseRequiredFields',
  'consistency',
  'statePolicy',
  'statePolicies',
]);
const M1011_AUTHORIZATION_POLICY = Object.freeze({
  defaultDecision: 'DENY',
  pep: 'learner-service-local',
  bearerSecurity: [{ bearerAuth: [] }],
  trustedFacts: ['subject', 'tenant', 'resourceOwner', 'roles', 'permissions', 'phase', 'adultGate', 'consent', 'contentRights', 'policyVersion'],
  genericClientAuthority: 'none; authority fields are server-derived and client assertions cannot expand ALLOW',
  recoveryClientAuthority: 'none; task ownership and status are server-derived',
  forbiddenClientFieldsBySchema: [
    {
      schema: 'B9LearnerProfilePatch',
      fields: ['principalId', 'tenantId', 'ownerId', 'role', 'permissions', 'adultGate', 'consent', 'policyVersion', 'contentRights', 'profileVersion', 'stateVersion'],
    },
    {
      schema: 'B9LearnerTargetUpsert',
      fields: ['principalId', 'tenantId', 'targetId', 'ownerId', 'role', 'permissions', 'adultGate', 'consent', 'policyVersion', 'contentRights', 'targetVersion', 'stateVersion'],
    },
    {
      schema: 'B9LearnerPreferencesPatch',
      fields: ['principalId', 'tenantId', 'ownerId', 'role', 'permissions', 'adultGate', 'consent', 'policyVersion', 'contentRights', 'preferenceVersion', 'stateVersion'],
    },
  ],
});
const M1011_CONCURRENCY_POLICY = Object.freeze({
  ifMatchParameter: {
    name: 'If-Match',
    in: 'header',
    required: true,
    description: '资源状态版本的乐观并发条件；必须以无前导零的十进制字符串精确等于请求体 expectedStateVersion，版本不匹配时返回 409，不覆盖其他写入。',
    schema: { type: 'string', minLength: 1, maxLength: 19, pattern: '^(?:0|[1-9][0-9]{0,18})$' },
  },
  writeOperationIds: ['patchB9LearnerProfile', 'putB9LearnerTarget', 'patchB9LearnerPreferences'],
  writeParameterRefs: [{ $ref: '#/components/parameters/B9IdempotencyKey' }, { $ref: '#/components/parameters/B9IfMatch' }],
  operationBinding: {
    ifMatchParameterRef: '#/components/parameters/B9IfMatch',
    requestField: 'expectedStateVersion',
    comparison: 'EXACT_DECIMAL_STRING_EQUAL',
    mismatchDecision: 'DENY_WITH_409',
  },
});
const M1011_PLANNING_INPUT_ELIGIBILITY_POLICY = Object.freeze({
  schema: 'B9PlanningInputSnapshot',
  requiredFields: [
    'pinId', 'pinVersion', 'pinDigest', 'targetId', 'targetVersion', 'profileVersion', 'preferenceVersion', 'goalCatalogVersion',
    'dailyQuotaMinutes', 'timezone', 'weeklyStudyDays', 'contentLocale', 'contentEpoch', 'projectionVersion', 'rightsSnapshotVersion',
    'eligibilitySnapshotVersion', 'eligibilitySnapshotDigest', 'planningRuleVersion', 'inputFactWatermark', 'sourceEventId', 'rootEventId',
  ],
  forbiddenFields: ['placementRaw', 'placementScore', 'placementAlgorithm', 'srsState', 'mastery', 'adultGate', 'consent', 'phase', 'policyVersion', 'contentRights'],
  positiveIntegerFields: [
    'pinVersion', 'targetId', 'targetVersion', 'profileVersion', 'preferenceVersion', 'contentEpoch', 'projectionVersion',
    'rightsSnapshotVersion', 'eligibilitySnapshotVersion',
  ],
  pinnedStringFields: [
    'pinId', 'pinDigest', 'eligibilitySnapshotDigest', 'goalCatalogVersion', 'planningRuleVersion', 'inputFactWatermark', 'sourceEventId', 'rootEventId',
  ],
  opaqueStringFields: ['pinId', 'pinDigest', 'eligibilitySnapshotDigest', 'inputFactWatermark', 'sourceEventId', 'rootEventId'],
  eligibilitySnapshotDigest: { minLength: 64, maxLength: 64, pattern: '^[A-Fa-f0-9]{64}$' },
  sourceMapping: {
    learnerTarget: ['targetId', 'targetVersion', 'dailyQuotaMinutes', 'goalCatalogVersion'],
    learnerProfile: ['profileVersion'],
    learnerPreferences: ['preferenceVersion', 'timezone', 'weeklyStudyDays', 'contentLocale'],
    contentProjection: ['contentEpoch', 'projectionVersion', 'rightsSnapshotVersion'],
    iamEligibility: ['eligibilitySnapshotVersion', 'eligibilitySnapshotDigest'],
    learningPolicy: ['planningRuleVersion'],
    learningOwner: ['pinId', 'pinVersion', 'pinDigest', 'inputFactWatermark', 'sourceEventId', 'rootEventId'],
  },
});
const M1011_B1_TARGET_MAPPING_POLICY = Object.freeze({
  schema: 'B1OnboardingProfileRequest',
  extension: 'x-p1r-b9-target-mapping',
  sourceField: 'targetGoal',
  dailyQuotaField: 'dailyQuotaMinutes',
  expectedStateVersionField: 'expectedVersion',
  expectedVersionSchema: { type: 'integer', format: 'int64', minimum: 0 },
  missingOrUnknownDecision: 'DENY_WITH_422',
  dailyQuotaMinutes: [5, 15, 30, 45],
  legacyGoalCodes: ['ZERO_BASIS', 'CET_4_6', 'POSTGRADUATE', 'WORKPLACE_DAILY'],
  mappings: [
    { legacyTargetGoal: 'ZERO_BASIS', goalCode: 'FOUNDATION', targetLevel: 'A1' },
    { legacyTargetGoal: 'CET_4_6', goalCode: 'COLLEGE_CET', targetLevel: 'B1' },
    { legacyTargetGoal: 'POSTGRADUATE', goalCode: 'POSTGRADUATE_ENGLISH', targetLevel: 'B2' },
    { legacyTargetGoal: 'WORKPLACE_DAILY', goalCode: 'WORKPLACE_DAILY', targetLevel: 'B2' },
  ],
});
const M1011_PROFILE_TARGET_GOAL_POLICY = Object.freeze({
  schema: 'B9LearnerProfile',
  patchSchema: 'B9LearnerProfilePatch',
  patchOperationId: 'patchB9LearnerProfile',
  field: 'targetGoal',
  deprecated: true,
  planningAuthority: false,
  patchPolicy: { targetGoal: 'SERVER_REJECTED_422_NON_AUTHORITATIVE' },
  patchNot: { required: ['targetGoal'] },
  patchResponseStatus: '422',
});
const M1011_CANONICAL_WRITE_IDEMPOTENCY = Object.freeze([
  {
    operationId: 'patchB9LearnerProfile', path: '/api/v1/learner/profile', method: 'PATCH', idempotencyRequired: true,
    idempotencyPolicy: {
      required: true, strategy: 'learner-profile-update', keyHeader: 'Idempotency-Key',
      replayBehavior: 'same subject and request hash returns the original profile version',
      sameKeySamePayload: 'REPLAY_ORIGINAL_RESPONSE', sameKeyDifferentPayload: 'DENY_WITH_409',
      commandFingerprint: 'SERVER_COMPUTED_NORMALIZED_COMMAND_HASH',
    },
  },
  {
    operationId: 'putB9LearnerTarget', path: '/api/v1/learner/targets', method: 'PUT', idempotencyRequired: true,
    idempotencyPolicy: {
      required: true, strategy: 'learner-target-upsert', keyHeader: 'Idempotency-Key',
      replayBehavior: 'same subject and state version returns the original target',
      sameKeySamePayload: 'REPLAY_ORIGINAL_RESPONSE', sameKeyDifferentPayload: 'DENY_WITH_409',
      commandFingerprint: 'SERVER_COMPUTED_NORMALIZED_COMMAND_HASH',
    },
  },
  {
    operationId: 'patchB9LearnerPreferences', path: '/api/v1/learner/preferences', method: 'PATCH', idempotencyRequired: true,
    idempotencyPolicy: {
      required: true, strategy: 'learner-preference-update', keyHeader: 'Idempotency-Key',
      replayBehavior: 'same subject and request hash returns the original preferences',
      sameKeySamePayload: 'REPLAY_ORIGINAL_RESPONSE', sameKeyDifferentPayload: 'DENY_WITH_409',
      commandFingerprint: 'SERVER_COMPUTED_NORMALIZED_COMMAND_HASH',
    },
  },
]);
const M1011_LEGACY_WRITE_IDEMPOTENCY = Object.freeze([
  {
    operationId: 'saveB1OnboardingProfile', path: '/api/v1/onboarding/profile', method: 'POST',
    idempotencyPolicy: {
      required: true, strategy: 'request-key', keyHeader: 'Idempotency-Key', replayBehavior: 'return-original-profile',
      sameKeySamePayload: 'REPLAY_ORIGINAL_RESPONSE', sameKeyDifferentPayload: 'DENY_WITH_409',
      commandFingerprint: 'SERVER_COMPUTED_NORMALIZED_COMMAND_HASH',
    },
  },
  {
    operationId: 'patchB1OnboardingProfile', path: '/api/v1/onboarding/profile', method: 'PATCH',
    idempotencyPolicy: {
      required: true, strategy: 'request-key', keyHeader: 'Idempotency-Key', replayBehavior: 'return-original-profile',
      sameKeySamePayload: 'REPLAY_ORIGINAL_RESPONSE', sameKeyDifferentPayload: 'DENY_WITH_409',
      commandFingerprint: 'SERVER_COMPUTED_NORMALIZED_COMMAND_HASH',
    },
  },
  {
    operationId: 'createB1FirstGoal', path: '/api/v1/onboarding/goals/first', method: 'POST',
    idempotencyPolicy: {
      required: true, strategy: 'request-key', keyHeader: 'Idempotency-Key', replayBehavior: 'return-original-goal',
      sameKeySamePayload: 'REPLAY_ORIGINAL_RESPONSE', sameKeyDifferentPayload: 'DENY_WITH_409',
      commandFingerprint: 'SERVER_COMPUTED_NORMALIZED_COMMAND_HASH',
    },
  },
]);
const M1011_FIRST_DAY_WIRE_POLICY = Object.freeze({
  schema: 'B9FirstDayProjection',
  commonSchema: 'B9FirstDayProjectionCommon',
  stateField: 'state',
  states: ['NOT_READY', 'PROCESSING', 'READY', 'DEGRADED'],
  baseRequiredFields: ['state', 'profileReady', 'targetReady', 'placementStatus', 'taskCount', 'tasks', 'contentEpoch', 'projectionVersion', 'projectionWatermark', 'generatedAt'],
  statePolicy: {
    failureCannotMasqueradeAsEmptySuccess: true,
    notReady: 'empty tasks plus an explicit blocker; no planning, plan, failure or recovery fields',
    processing: 'empty tasks plus immutable planningInput and job; no plan, failure or recovery fields',
    ready: 'at least one task plus immutable planningInput and plan; no blocker, job, failure or recovery fields',
    degraded: 'empty tasks plus immutable planningInput, safe reason and read-only recovery; never a READY result',
  },
  statePolicies: [
    { state: 'NOT_READY', required: ['state', 'tasks', 'blocker'], forbidden: ['planningInput', 'job', 'plan', 'degradedReason', 'recovery'], taskCount: { const: 0 }, tasks: { maxItems: 0 }, constants: {} },
    { state: 'PROCESSING', required: ['state', 'tasks', 'planningInput', 'job'], forbidden: ['blocker', 'plan', 'degradedReason', 'recovery'], taskCount: { const: 0 }, tasks: { maxItems: 0 }, constants: { profileReady: true, targetReady: true }, inputReference: { field: 'job', schema: 'B9PlanningJobRef', statuses: ['QUEUED', 'PROCESSING', 'RETRYABLE'] } },
    { state: 'READY', required: ['state', 'tasks', 'planningInput', 'plan'], forbidden: ['blocker', 'job', 'degradedReason', 'recovery'], taskCount: { minimum: 1 }, tasks: { minItems: 1 }, constants: { profileReady: true, targetReady: true } },
    { state: 'DEGRADED', required: ['state', 'tasks', 'planningInput', 'degradedReason', 'recovery'], forbidden: ['blocker', 'job', 'plan'], taskCount: { const: 0 }, tasks: { maxItems: 0 }, constants: { profileReady: true, targetReady: true }, inputReference: { field: 'recovery', schema: 'B9FirstDayRecovery', statuses: ['QUEUED', 'PROCESSING', 'RETRYABLE', 'FAILED'] } },
  ],
});

function exactM1011PolicyKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (stableGovernanceValue(Object.keys(value).sort()) !== stableGovernanceValue([...expected].sort())) {
    errors.push(`${label} keys are not the frozen M1-011 set`);
  }
}

function exactM1011PolicyValue(value, expected, label, errors) {
  if (stableGovernanceValue(value) !== stableGovernanceValue(expected)) {
    errors.push(`${label} is not the frozen M1-011 value`);
  }
}

function exactM1011WriteIdempotency(routes, expected, label, errors) {
  if (!Array.isArray(routes)) {
    errors.push(`${label} must be an array`);
    return;
  }
  const actual = expected.map((expectedRoute) => {
    const { operationId } = expectedRoute;
    const matches = routes.filter((route) => isRecord(route) && route.operationId === operationId);
    if (matches.length !== 1) return { operationId, matchingEntries: matches.length };
    const route = matches[0];
    const projected = {
      operationId: route.operationId,
      path: route.path,
      method: route.method,
      idempotencyPolicy: route.idempotencyPolicy,
    };
    if (Object.hasOwn(expectedRoute, 'idempotencyRequired')) projected.idempotencyRequired = route.idempotencyRequired;
    return projected;
  });
  exactM1011PolicyValue(actual, expected, label, errors);
}

export function validateM1011CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyValue(policy?.task, 'P1R-M1-011', 'learner planning contract policy task', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'learner planning contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'learner planning contract policy runtimeStatus', errors);
  exactPolicyValue(policy?.compatibilityPromotion, {
    id: M1011_LEARNER_PLANNING_PROMOTION_ID,
    sourceContractBaseline: REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    previousPromotion: M1010_ASSESSMENT_PROMOTION_ID,
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    scope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
    eventCatalogDecision: 'TARGET_CANONICAL_D2_PROFILE_AND_FIRST_DAY_HISTORICAL',
    canonicalFragment: 'packages/contracts/fragments/b9/b9-learner.openapi.json',
    legacyAdapterFragment: 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json',
    historicalEventFragment: 'packages/contracts/events/v1/fragments/b9-learner-content.events.json',
  }, 'M1-011 compatibility promotion', errors);
  if (!isRecord(policy)) return errors;

  exactM1011PolicyKeys(policy.authorization, M1011_AUTHORIZATION_POLICY_KEYS, 'M1-011 authorization policy', errors);
  exactM1011PolicyValue(policy.authorization, M1011_AUTHORIZATION_POLICY, 'M1-011 authorization policy', errors);
  exactM1011PolicyKeys(policy.concurrency, M1011_CONCURRENCY_POLICY_KEYS, 'M1-011 concurrency policy', errors);
  exactM1011PolicyValue(policy.concurrency, M1011_CONCURRENCY_POLICY, 'M1-011 concurrency policy', errors);

  const planningInput = policy.planningInput;
  exactM1011PolicyKeys(planningInput, M1011_PLANNING_INPUT_POLICY_KEYS, 'M1-011 planning-input policy', errors);
  exactM1011PolicyValue(isRecord(planningInput) ? {
    schema: planningInput.schema,
    requiredFields: planningInput.requiredFields,
    forbiddenFields: planningInput.forbiddenFields,
    positiveIntegerFields: planningInput.positiveIntegerFields,
    pinnedStringFields: planningInput.pinnedStringFields,
    opaqueStringFields: planningInput.opaqueStringFields,
    eligibilitySnapshotDigest: planningInput.eligibilitySnapshotDigest,
    sourceMapping: planningInput.sourceMapping,
  } : planningInput, M1011_PLANNING_INPUT_ELIGIBILITY_POLICY, 'M1-011 planning-input eligibility policy', errors);

  exactM1011PolicyValue(policy.goalCatalog?.legacyB1TargetMapping, M1011_B1_TARGET_MAPPING_POLICY, 'M1-011 B1 target mapping policy', errors);
  exactM1011PolicyValue(policy.goalCatalog?.profileTargetGoal, M1011_PROFILE_TARGET_GOAL_POLICY, 'M1-011 profile targetGoal policy', errors);
  exactM1011WriteIdempotency(policy.canonicalRoutes, M1011_CANONICAL_WRITE_IDEMPOTENCY, 'M1-011 canonical write idempotency', errors);
  exactM1011WriteIdempotency(policy.legacyCompatibility, M1011_LEGACY_WRITE_IDEMPOTENCY, 'M1-011 legacy write idempotency', errors);

  const firstDay = policy.firstDay;
  exactM1011PolicyKeys(firstDay, M1011_FIRST_DAY_POLICY_KEYS, 'M1-011 first-day policy', errors);
  exactM1011PolicyValue(isRecord(firstDay) ? {
    schema: firstDay.schema,
    commonSchema: firstDay.commonSchema,
    stateField: firstDay.stateField,
    states: firstDay.states,
    baseRequiredFields: firstDay.baseRequiredFields,
    statePolicy: firstDay.statePolicy,
    statePolicies: firstDay.statePolicies,
  } : firstDay, M1011_FIRST_DAY_WIRE_POLICY, 'M1-011 first-day READY/DEGRADED wire policy', errors);
  return errors;
}

function loadM1011CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...learnerPlanningContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-011 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1011CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-011 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

const M1012_COMPATIBILITY_PROMOTION_POLICY = Object.freeze({
  id: M1012_PLACEMENT_PROMOTION_ID,
  sourceContractBaseline: REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
  previousPromotion: M1011_LEARNER_PLANNING_PROMOTION_ID,
  immutableGovernanceBaseline: REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
  runtimeStatus: 'NOT_RUNTIME_VERIFIED',
  scope: 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC',
  canonicalFragment: 'packages/contracts/fragments/b10/b10-placement.openapi.json',
  legacyAdapterFragments: [
    'packages/contracts/fragments/b1/b1-onboarding-privacy.openapi.json',
    'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json',
  ],
  planningFragment: 'packages/contracts/fragments/b9/b9-learner.openapi.json',
  eventFragment: 'packages/contracts/events/v1/fragments/b10-learning-assessment.events.json',
  b26StaticPolicy: 'config/b26-event-runtime.json',
});

const M1012_CANONICAL_ROUTE_OPERATIONS = Object.freeze([
  { path: '/api/v1/assessment/placement/sessions', method: 'POST', operationId: 'createB10PlacementSession' },
  { path: '/api/v1/assessment/placement/sessions/{sessionId}', method: 'GET', operationId: 'getB10PlacementSession' },
  { path: '/api/v1/assessment/placement/sessions/{sessionId}/responses', method: 'POST', operationId: 'submitB10PlacementResponse' },
  { path: '/api/v1/assessment/placement/baselines/skip', method: 'POST', operationId: 'createB10PlacementSkipBaseline' },
  { path: '/api/v1/assessment/placement/reports/{reportId}', method: 'GET', operationId: 'getB10PlacementReport' },
]);

/**
 * This is intentionally narrower than the placement source checker: it
 * freezes the promotion authority used by the generic compatibility tool and
 * proves that the promoted surface is static D2 only.  The source checker
 * owns the detailed scoring and payload rules.
 */
export function validateM1012CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyValue(policy?.task, 'P1R-M1-012', 'placement contract policy task', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'placement contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'placement contract policy runtimeStatus', errors);
  exactPolicyValue(policy?.sourceContractBaseline, REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF, 'placement contract source baseline', errors);
  exactPolicyValue(policy?.compatibilityPromotion, M1012_COMPATIBILITY_PROMOTION_POLICY, 'M1-012 compatibility promotion', errors);
  exactPolicyValue(policy?.completionEvent && {
    name: policy.completionEvent.name,
    status: policy.completionEvent.status,
    runtimeStatus: policy.completionEvent.runtimeStatus,
    producerService: policy.completionEvent.producerService,
    aggregateType: policy.completionEvent.aggregateType,
  }, {
    name: 'assessment.placement.completed.v1',
    status: 'CANONICAL_D2',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    producerService: 'assessment-service',
    aggregateType: 'placement_session',
  }, 'M1-012 placement completion event boundary', errors);
  exactPolicyValue(policy?.contractIntegration && {
    status: policy.contractIntegration.status,
    staticSourceBindingOnly: policy.contractIntegration.staticSourceBindingOnly,
    canonicalRoutes: policy.contractIntegration.canonicalRoutes,
  }, {
    status: 'SOURCE_BOUND_STATIC_D2',
    staticSourceBindingOnly: true,
    canonicalRoutes: M1012_CANONICAL_ROUTE_OPERATIONS,
  }, 'M1-012 canonical placement route boundary', errors);
  exactPolicyValue(policy?.learnerPlanningSuccessor && {
    task: policy.learnerPlanningSuccessor.task,
    basePolicyId: policy.learnerPlanningSuccessor.basePolicyId,
    planningFragment: policy.learnerPlanningSuccessor.planningFragment,
    placementBaselineSchema: policy.learnerPlanningSuccessor.placementBaselineSchema,
  }, {
    task: 'P1R-M1-012',
    basePolicyId: M1011_LEARNER_PLANNING_PROMOTION_ID,
    planningFragment: 'packages/contracts/fragments/b9/b9-learner.openapi.json',
    placementBaselineSchema: 'B9PlacementBaseline',
  }, 'M1-012 learner planning successor boundary', errors);
  return errors;
}

function loadM1012CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...placementContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-012 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1012CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-012 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({
    ...policy.compatibilityPromotion,
    legacyAdapterFragments: [...policy.compatibilityPromotion.legacyAdapterFragments],
  });
}

const M1013_APPROVED_SOURCE_FILES = Object.freeze([
  'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json',
  'packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json',
  'packages/contracts/fragments/b2-compatibility.openapi.json',
  'packages/contracts/fragments/b2-vocabulary-srs.openapi.json',
  'packages/contracts/fragments/b2-assessment-mastery.openapi.json',
  'packages/contracts/events/v1/fragments/b10-learning-loop.events.json',
  'packages/contracts/events/v1/catalog.json',
  'packages/contracts/events/v1/reliability-policy.json',
  'config/b26-event-runtime.json',
]);

const M1013_HISTORICAL_ONLY_SOURCES = Object.freeze([
  'getB2DailyStream',
  'submitReviewEvent',
  'syncReviewEvents',
  'getB2DailyReport',
  'getB2WeeklyReport',
  'assessment.attempt.assessed.v1',
  'learning.mastery.projected.v1',
  'learning.review.scheduled.v1',
  'vocabulary.review.accepted.v1',
  'vocabulary.srs.state_changed.v1',
  'mastery.verification_state_changed.v1',
  'report.generated.v1',
]);

const M1013_PROHIBITED_RUNTIME_CLAIMS = Object.freeze([
  'http-execution-verified',
  'database-persistence-verified',
  'kafka-delivery-verified',
  'consumer-processing-verified',
  'gateway-pep-runtime-verified',
  'b26-go',
  'runtime-ready',
]);

const M1013_CANONICAL_ROUTE_POLICY = Object.freeze([
  { id: 'B10-REVIEW-QUEUE-LIST', method: 'GET', path: '/api/v1/learning/review-queue', operationId: 'listB10LearningReviewQueue', requestSchema: 'NONE', responseSchema: 'B10LearningQueueItem[]', owner: 'learning-service', requiredPermission: 'learning.srs.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-REVIEW-COMPLETE', method: 'POST', path: '/api/v1/learning/review-queue/{queueItemId}/complete', operationId: 'completeB10LearningReview', requestSchema: 'B10CompleteReviewRequest', responseSchema: 'B10LearningReviewResult', owner: 'learning-service', requiredPermission: 'learning.srs.write', security: 'bearerAuth', idempotency: 'REQUIRED' },
  { id: 'B10-MASTERY-ITEM', method: 'GET', path: '/api/v1/learning/mastery/{itemId}', operationId: 'getB10LearningMasteryProjection', requestSchema: 'NONE', responseSchema: 'B10MasteryProjection', owner: 'learning-service', requiredPermission: 'learning.mastery.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-PLAN-CURRENT', method: 'GET', path: '/api/v1/learning/plans/current', operationId: 'getB10LearningPlan', requestSchema: 'NONE', responseSchema: 'B10LearningPlan', owner: 'learning-service', requiredPermission: 'learning.plan.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-TODAY', method: 'GET', path: '/api/v1/learning/today', operationId: 'getB10LearningToday', requestSchema: 'NONE', responseSchema: 'B10TodayLearningPlan', owner: 'learning-service', requiredPermission: 'learning.today.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-PLAN-REORDER', method: 'POST', path: '/api/v1/learning/plans/reorder', operationId: 'reorderB10LearningPlan', requestSchema: 'B10PlanReorderRequest', responseSchema: 'B10PlanReorderResult', owner: 'learning-service', requiredPermission: 'learning.plan.write', security: 'bearerAuth', idempotency: 'REQUIRED' },
  { id: 'B10-TASK-COMPLETE', method: 'POST', path: '/api/v1/learning/tasks/{taskId}/complete', operationId: 'completeB10LearningTask', requestSchema: 'B10TaskCompletionRequest', responseSchema: 'B10TaskCompletionResult', owner: 'learning-service', requiredPermission: 'learning.task.write', security: 'bearerAuth', idempotency: 'REQUIRED' },
  { id: 'B10-REPAIR-LIST', method: 'GET', path: '/api/v1/learning/repairs', operationId: 'listB10LearningRepairs', requestSchema: 'NONE', responseSchema: 'B10RepairItem[]', owner: 'learning-service', requiredPermission: 'learning.repair.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-REPAIR-DETAIL', method: 'GET', path: '/api/v1/learning/repairs/{repairId}', operationId: 'getB10LearningRepair', requestSchema: 'NONE', responseSchema: 'B10RepairItem', owner: 'learning-service', requiredPermission: 'learning.repair.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-MASTERY-OVERVIEW', method: 'GET', path: '/api/v1/learning/mastery', operationId: 'getB10LearningMasteryOverview', requestSchema: 'NONE', responseSchema: 'B10MasteryOverview', owner: 'learning-service', requiredPermission: 'learning.mastery.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
  { id: 'B10-REPORT', method: 'GET', path: '/api/v1/learning/reports/{reportType}', operationId: 'getB10LearningReport', requestSchema: 'NONE', responseSchema: 'B10LearningReport', owner: 'learning-service', requiredPermission: 'learning.report.read', security: 'bearerAuth', idempotency: 'NOT_REQUIRED' },
]);

const M1013_LEGACY_ADAPTER_POLICY = Object.freeze([
  { id: 'LEGACY-B1-DAILY-TASKS-TODAY', sourceFragment: 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json', method: 'GET', path: '/api/v1/onboarding/daily-tasks/today', operationId: 'getB1DailyTasks', canonicalOperationId: 'getB10LearningToday', canonicalRoute: '/api/v1/learning/today', owner: 'learning-service', requiredPermission: 'learning.plan.read', write: false },
  { id: 'LEGACY-B1-DAILY-TASK-COMPLETE', sourceFragment: 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json', method: 'POST', path: '/api/v1/onboarding/daily-tasks/{taskId}/complete', operationId: 'completeB1DailyTask', canonicalOperationId: 'completeB10LearningTask', canonicalRoute: '/api/v1/learning/tasks/{taskId}/complete', owner: 'learning-service', requiredPermission: 'learning.task.write', write: true },
  { id: 'LEGACY-B1-DAILY-TASKS-REORDER', sourceFragment: 'packages/contracts/fragments/b1/b1-auth-user-onboarding.openapi.json', method: 'POST', path: '/api/v1/onboarding/daily-tasks/reorder', operationId: 'reorderB1DailyTasks', canonicalOperationId: 'reorderB10LearningPlan', canonicalRoute: '/api/v1/learning/plans/reorder', owner: 'learning-service', requiredPermission: 'learning.plan.write', write: true },
  { id: 'LEGACY-B2-CURRENT-LEARNING-PLAN', sourceFragment: 'packages/contracts/fragments/b2-compatibility.openapi.json', method: 'GET', path: '/api/v1/learning/plan/current', operationId: 'getCurrentLearningPlan', canonicalOperationId: 'getB10LearningPlan', canonicalRoute: '/api/v1/learning/plans/current', owner: 'learning-service', requiredPermission: 'learning.plan.read', write: false },
  { id: 'LEGACY-B2-TODAY-LEARNING-STREAM', sourceFragment: 'packages/contracts/fragments/b2-compatibility.openapi.json', method: 'GET', path: '/api/v1/learning/stream/today', operationId: 'getTodayLearningStream', canonicalOperationId: 'getB10LearningToday', canonicalRoute: '/api/v1/learning/today', owner: 'learning-service', requiredPermission: 'learning.plan.read', write: false },
  { id: 'LEGACY-B2-SUBMIT-LEARNING-STREAM-ACTION', sourceFragment: 'packages/contracts/fragments/b2-compatibility.openapi.json', method: 'POST', path: '/api/v1/learning/stream/action', operationId: 'submitLearningStreamAction', canonicalOperationId: 'completeB10LearningReview', canonicalRoute: '/api/v1/learning/review-queue/{queueItemId}/complete', owner: 'learning-service', requiredPermission: 'learning.srs.write', write: true },
  { id: 'LEGACY-B2-LEARNING-MISTAKE-QUEUE', sourceFragment: 'packages/contracts/fragments/b2-compatibility.openapi.json', method: 'GET', path: '/api/v1/learning/mistakes/queue', operationId: 'getLearningMistakeQueue', canonicalOperationId: 'listB10LearningRepairs', canonicalRoute: '/api/v1/learning/repairs', owner: 'learning-service', requiredPermission: 'learning.repair.read', write: false },
  { id: 'LEGACY-B2-VERIFY-LEARNING-MISTAKE', sourceFragment: 'packages/contracts/fragments/b2-compatibility.openapi.json', method: 'POST', path: '/api/v1/learning/mistakes/verify', operationId: 'verifyLearningMistake', canonicalOperationId: 'completeB10LearningReview', canonicalRoute: '/api/v1/learning/review-queue/{queueItemId}/complete', owner: 'learning-service', requiredPermission: 'learning.srs.write', write: true },
  { id: 'LEGACY-B2-DAILY-LEARNING-SUMMARY', sourceFragment: 'packages/contracts/fragments/b2-compatibility.openapi.json', method: 'GET', path: '/api/v1/learning/stats/daily-summary', operationId: 'getDailyLearningSummary', canonicalOperationId: 'getB10LearningReport', canonicalRoute: '/api/v1/learning/reports/{reportType}', owner: 'learning-service', requiredPermission: 'learning.report.read', write: false },
  { id: 'LEGACY-B2-CREATE-SRS-BATCH', sourceFragment: 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json', method: 'POST', path: '/api/v1/learning/srs/batches', operationId: 'createSrsBatch', canonicalOperationId: 'getB10LearningToday', canonicalRoute: '/api/v1/learning/today', owner: 'learning-service', requiredPermission: 'learning.plan.read', write: true },
  { id: 'LEGACY-B2-GET-SRS-BATCH', sourceFragment: 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json', method: 'GET', path: '/api/v1/learning/srs/batches/{snapshotId}', operationId: 'getSrsBatch', canonicalOperationId: 'getB10LearningToday', canonicalRoute: '/api/v1/learning/today', owner: 'learning-service', requiredPermission: 'learning.plan.read', write: false },
  { id: 'LEGACY-B2-SUBMIT-REVIEW-EVENT', sourceFragment: 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json', method: 'POST', path: '/api/v1/learning/srs/reviews', operationId: 'submitReviewEvent', canonicalOperationId: 'completeB10LearningReview', canonicalRoute: '/api/v1/learning/review-queue/{queueItemId}/complete', owner: 'learning-service', requiredPermission: 'learning.srs.write', write: true },
  { id: 'LEGACY-B2-SYNC-REVIEW-EVENTS', sourceFragment: 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json', method: 'POST', path: '/api/v1/learning/srs/reviews:sync', operationId: 'syncReviewEvents', canonicalOperationId: 'completeB10LearningReview', canonicalRoute: '/api/v1/learning/review-queue/{queueItemId}/complete', owner: 'learning-service', requiredPermission: 'learning.srs.write', write: true },
  { id: 'LEGACY-B2-LIST-SRS-STATES', sourceFragment: 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json', method: 'GET', path: '/api/v1/learning/srs/states', operationId: 'listSrsStates', canonicalOperationId: 'listB10LearningReviewQueue', canonicalRoute: '/api/v1/learning/review-queue', owner: 'learning-service', requiredPermission: 'learning.srs.read', write: false },
  { id: 'LEGACY-B2-GET-SRS-OVERVIEW', sourceFragment: 'packages/contracts/fragments/b2-vocabulary-srs.openapi.json', method: 'GET', path: '/api/v1/learning/srs/overview', operationId: 'getSrsOverview', canonicalOperationId: 'listB10LearningReviewQueue', canonicalRoute: '/api/v1/learning/review-queue', owner: 'learning-service', requiredPermission: 'learning.srs.read', write: false },
  { id: 'LEGACY-B2-DAILY-STREAM', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/assessment/daily-stream', operationId: 'getB2DailyStream', canonicalOperationId: 'getB10LearningToday', canonicalRoute: '/api/v1/learning/today', owner: 'learning-service', requiredPermission: 'learning.plan.read', write: false },
  { id: 'LEGACY-B2-MASTERY-OVERVIEW', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/mastery/overview', operationId: 'getB2MasteryOverview', canonicalOperationId: 'getB10LearningMasteryOverview', canonicalRoute: '/api/v1/learning/mastery', owner: 'learning-service', requiredPermission: 'learning.mastery.read', write: false },
  { id: 'LEGACY-B2-MISTAKES', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/mastery/mistakes', operationId: 'listB2Mistakes', canonicalOperationId: 'listB10LearningRepairs', canonicalRoute: '/api/v1/learning/repairs', owner: 'learning-service', requiredPermission: 'learning.repair.read', write: false },
  { id: 'LEGACY-B2-MISTAKE-DETAIL', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/mastery/mistakes/{mistakeId}', operationId: 'getB2MistakeDetail', canonicalOperationId: 'getB10LearningRepair', canonicalRoute: '/api/v1/learning/repairs/{repairId}', owner: 'learning-service', requiredPermission: 'learning.repair.read', write: false },
  { id: 'LEGACY-B2-MISTAKE-RETRY', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'POST', path: '/api/v1/mastery/mistakes/{mistakeId}/retry', operationId: 'startB2MistakeRetry', canonicalOperationId: 'completeB10LearningReview', canonicalRoute: '/api/v1/learning/review-queue/{queueItemId}/complete', owner: 'learning-service', requiredPermission: 'learning.srs.write', write: true },
  { id: 'LEGACY-B2-MASTERY-VERIFICATIONS', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/mastery/verifications', operationId: 'listB2MasteryVerifications', canonicalOperationId: 'listB10LearningRepairs', canonicalRoute: '/api/v1/learning/repairs', owner: 'learning-service', requiredPermission: 'learning.repair.read', write: false },
  { id: 'LEGACY-B2-SUBMIT-MASTERY-VERIFICATION', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'POST', path: '/api/v1/mastery/verifications/{verificationId}/submit', operationId: 'submitB2MasteryVerification', canonicalOperationId: 'completeB10LearningReview', canonicalRoute: '/api/v1/learning/review-queue/{queueItemId}/complete', owner: 'learning-service', requiredPermission: 'learning.srs.write', write: true },
  { id: 'LEGACY-B2-DAILY-REPORT', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/learning/stats/daily-report', operationId: 'getB2DailyReport', canonicalOperationId: 'getB10LearningReport', canonicalRoute: '/api/v1/learning/reports/{reportType}', owner: 'learning-service', requiredPermission: 'learning.report.read', write: false },
  { id: 'LEGACY-B2-WEEKLY-REPORT', sourceFragment: 'packages/contracts/fragments/b2-assessment-mastery.openapi.json', method: 'GET', path: '/api/v1/learning/stats/weekly-report', operationId: 'getB2WeeklyReport', canonicalOperationId: 'getB10LearningReport', canonicalRoute: '/api/v1/learning/reports/{reportType}', owner: 'learning-service', requiredPermission: 'learning.report.read', write: false },
]);

const M1013_COMPATIBILITY_PROMOTION_POLICY_KEYS = M1013_PROMOTION_ALLOWANCE_KEYS;

export function validateM1013CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyValue(policy?.task, 'P1R-M1-013', 'learning-loop contract policy task', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'learning-loop contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'learning-loop contract policy runtimeStatus', errors);
  exactPolicyValue(policy?.sourceBaseline, M1013_SOURCE_CONTRACT_BASELINE_REF, 'learning-loop contract source baseline', errors);
  const promotion = policy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M1013_COMPATIBILITY_PROMOTION_POLICY_KEYS, 'M1-013 compatibility promotion', errors);
  exactPolicyValue(promotion?.id, M1013_LEARNING_LOOP_PROMOTION_ID, 'M1-013 promotion id', errors);
  exactPolicyValue(promotion?.sourceContractBaseline, M1013_SOURCE_CONTRACT_BASELINE_REF, 'M1-013 promotion source baseline', errors);
  exactPolicyValue(promotion?.previousPromotion, M1012_PLACEMENT_PROMOTION_ID, 'M1-013 previous promotion', errors);
  exactPolicyValue(promotion?.immutableGovernanceBaseline, M1013_IMMUTABLE_GOVERNANCE_BASELINE_REF, 'M1-013 immutable governance baseline', errors);
  exactPolicyValue(promotion?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-013 promotion runtimeStatus', errors);
  exactPolicyValue(promotion?.scope, 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC', 'M1-013 promotion scope', errors);
  exactPolicyValue(promotion?.approvedSourceFiles, M1013_APPROVED_SOURCE_FILES, 'M1-013 approved source files', errors);
  exactPolicyValue(promotion?.approvedCanonicalEvents, M1013_APPROVED_CANONICAL_EVENTS, 'M1-013 approved canonical events', errors);
  exactPolicyValue(promotion?.canonicalRoutes, M1013_CANONICAL_ROUTE_POLICY, 'M1-013 canonical route policy', errors);
  exactPolicyValue(promotion?.legacyAdapters, M1013_LEGACY_ADAPTER_POLICY, 'M1-013 legacy adapter policy', errors);
  exactPolicyValue(promotion?.historicalOnlySources, M1013_HISTORICAL_ONLY_SOURCES, 'M1-013 historical-only sources', errors);
  exactPolicyValue(promotion?.prohibitedRuntimeClaims, M1013_PROHIBITED_RUNTIME_CLAIMS, 'M1-013 prohibited runtime claims', errors);
  return errors;
}

function loadM1013CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...learningLoopContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-013 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1013CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-013 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

const M1014_POLICY_TOP_LEVEL_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'sourceBaseline', 'maturity', 'runtimeStatus', 'collectionPolicy',
  'canonicalSources', 'compatibilityPromotion', 'runtimeBoundary', 'owners', 'authority', 'trustedCompletion',
  'ledger', 'randomRewards', 'gameCatalog', 'socialSpaces', 'leaderboard', 'moderation', 'events',
  'phase1Prohibitions',
]);

export function validateM1014CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyKeys(policy, M1014_POLICY_TOP_LEVEL_KEYS, 'gamification/social contract policy', errors);
  exactPolicyValue(policy?.$schema, 'p1r.gamification-social-contract.v1', 'gamification/social contract policy $schema', errors);
  exactPolicyValue(policy?.schemaVersion, 'p1r.gamification-social-contract.v1', 'gamification/social contract policy schemaVersion', errors);
  exactPolicyValue(policy?.task, 'P1R-M1-014', 'gamification/social contract policy task', errors);
  exactPolicyValue(policy?.phase, 'P1', 'gamification/social contract policy phase', errors);
  exactPolicyValue(policy?.sourceBaseline, M1014_SOURCE_CONTRACT_BASELINE_REF, 'gamification/social contract source baseline', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'gamification/social contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'gamification/social contract policy runtimeStatus', errors);
  if (stableGovernanceSha256(policy) !== M1014_POLICY_SEMANTIC_SHA256) {
    errors.push('gamification/social contract policy is not the frozen M1-014 semantic policy value');
  }

  const promotion = policy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M1014_PROMOTION_ALLOWANCE_KEYS, 'M1-014 compatibility promotion', errors);
  exactPolicyValue(promotion?.id, M1014_GAMIFICATION_SOCIAL_PROMOTION_ID, 'M1-014 promotion id', errors);
  exactPolicyValue(promotion?.sourceContractBaseline, M1014_SOURCE_CONTRACT_BASELINE_REF, 'M1-014 promotion source baseline', errors);
  exactPolicyValue(promotion?.previousPromotion, M1013_LEARNING_LOOP_PROMOTION_ID, 'M1-014 previous promotion', errors);
  exactPolicyValue(promotion?.immutableGovernanceBaseline, M1014_IMMUTABLE_GOVERNANCE_BASELINE_REF, 'M1-014 immutable governance baseline', errors);
  exactPolicyValue(promotion?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-014 promotion runtimeStatus', errors);
  exactPolicyValue(promotion?.scope, 'OPENAPI_EVENT_GOVERNANCE_B26_STATIC', 'M1-014 promotion scope', errors);
  return errors;
}

function loadM1014CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...gamificationSocialContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-014 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1014CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-014 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

const M1015_POLICY_TOP_LEVEL_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'collectionPolicy', 'canonicalSources', 'compatibilityPromotion', 'runtimeBoundary', 'owners', 'authority',
  'stateMachines', 'objects', 'paymentPolicy', 'activationPolicy', 'callbackPolicy', 'entitlementPolicy',
  'refundPolicy', 'reconciliationPolicy', 'sensitiveDataPolicy', 'canonicalRouteExpectations', 'canonicalRoutes',
  'canonicalEventExpectations', 'historicalCandidates', 'scopeExclusions', 'handoff', 'phase1Prohibitions',
]);

export function validateM1015CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyKeys(policy, M1015_POLICY_TOP_LEVEL_KEYS, 'commerce contract policy', errors);
  exactPolicyValue(policy?.$schema, 'p1r.commerce-contract.v1', 'commerce contract policy $schema', errors);
  exactPolicyValue(policy?.schemaVersion, 'p1r.commerce-contract.v1', 'commerce contract policy schemaVersion', errors);
  exactPolicyValue(policy?.task, 'P1R-M1-015', 'commerce contract policy task', errors);
  exactPolicyValue(policy?.phase, 'P1', 'commerce contract policy phase', errors);
  exactPolicyValue(policy?.startCommit, '798e68c217ee4fbc12720a05c402486d35563fdb', 'commerce contract policy startCommit', errors);
  exactPolicyValue(policy?.sourceBaseline, M1015_SOURCE_CONTRACT_BASELINE_REF, 'commerce contract source baseline', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'commerce contract policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'commerce contract policy runtimeStatus', errors);
  if (stableGovernanceSha256(policy) !== M1015_POLICY_SEMANTIC_SHA256) {
    errors.push('commerce contract policy is not the frozen M1-015 semantic policy value');
  }

  const promotion = policy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M1015_PROMOTION_ALLOWANCE_KEYS, 'M1-015 compatibility promotion', errors);
  exactPolicyValue(promotion?.id, M1015_COMMERCE_PROMOTION_ID, 'M1-015 promotion id', errors);
  exactPolicyValue(promotion?.sourceContractBaseline, M1015_SOURCE_CONTRACT_BASELINE_REF, 'M1-015 promotion source baseline', errors);
  exactPolicyValue(promotion?.previousPromotion, M1014_GAMIFICATION_SOCIAL_PROMOTION_ID, 'M1-015 previous promotion', errors);
  exactPolicyValue(promotion?.previousPromotionContract, 'config/p1r-gamification-social-contract.v1.json', 'M1-015 previous promotion contract', errors);
  exactPolicyValue(promotion?.immutableGovernanceBaseline, M1015_IMMUTABLE_GOVERNANCE_BASELINE_REF, 'M1-015 immutable governance baseline', errors);
  exactPolicyValue(promotion?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-015 promotion runtimeStatus', errors);
  exactPolicyValue(promotion?.scope, 'OPENAPI_EVENT_GOVERNANCE_M1015_V2_B26_STATIC_WITH_B5_B13_V1_B20_HISTORICAL', 'M1-015 promotion scope', errors);
  exactPolicyValue(promotion?.promotionMode, 'FUTURE_M1015_V2_ONLY', 'M1-015 promotion mode', errors);
  exactPolicyValue(promotion?.allowsHistoricalV1Promotion, false, 'M1-015 historical v1 promotion allowance', errors);
  exactPolicyValue(promotion?.allowsDualPublish, false, 'M1-015 dual-publish allowance', errors);
  for (const [field, digest, label] of [
    ['approvedSourceFiles', M1015_APPROVED_SOURCE_FILES_SEMANTIC_SHA256, 'M1-015 approved source files'],
    ['requiredCompatibilityChecks', M1015_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256, 'M1-015 required compatibility checks'],
    ['b26StaticPolicy', M1015_B26_STATIC_POLICY_SEMANTIC_SHA256, 'M1-015 B26 static policy'],
    ['canonicalOpenApiSource', M1015_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256, 'M1-015 canonical OpenAPI source'],
    ['canonicalEventSource', M1015_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256, 'M1-015 canonical event source'],
  ]) {
    if (stableGovernanceSha256(promotion?.[field]) !== digest) errors.push(`${label} is not the frozen M1-015 value`);
  }
  return errors;
}

const M1016_POLICY_TOP_LEVEL_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'collectionPolicy', 'canonicalSources', 'compatibilityPromotion', 'ownership', 'authority', 'notification',
  'sync', 'support', 'events', 'legacyCompatibility', 'runtimeBoundary', 'requiredAcceptanceEvidence',
  'adversarialCases',
]);

export function validateM1016CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyKeys(policy, M1016_POLICY_TOP_LEVEL_KEYS, 'notification/sync/support contract policy', errors);
  exactPolicyValue(policy?.$schema, 'p1r.notification-sync-support-contract.v1', 'notification/sync/support policy $schema', errors);
  exactPolicyValue(policy?.schemaVersion, 'p1r.notification-sync-support-contract.v1', 'notification/sync/support policy schemaVersion', errors);
  exactPolicyValue(policy?.task, 'P1R-M1-016', 'notification/sync/support policy task', errors);
  exactPolicyValue(policy?.phase, 'P1', 'notification/sync/support policy phase', errors);
  exactPolicyValue(policy?.startCommit, '334447782ba22ceaa9c97dc2a6044c91ba75400a', 'notification/sync/support policy startCommit', errors);
  exactPolicyValue(policy?.sourceBaseline, M1016_SOURCE_CONTRACT_BASELINE_REF, 'notification/sync/support source baseline', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'notification/sync/support policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'notification/sync/support policy runtimeStatus', errors);
  if (stableGovernanceSha256(policy) !== M1016_POLICY_SEMANTIC_SHA256) {
    errors.push('notification/sync/support contract policy is not the frozen M1-016 semantic policy value');
  }

  const promotion = policy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M1016_PROMOTION_ALLOWANCE_KEYS, 'M1-016 compatibility promotion', errors);
  exactPolicyValue(promotion?.id, M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID, 'M1-016 promotion id', errors);
  exactPolicyValue(promotion?.sourceContractBaseline, M1016_SOURCE_CONTRACT_BASELINE_REF, 'M1-016 promotion source baseline', errors);
  exactPolicyValue(promotion?.previousPromotion, M1015_COMMERCE_PROMOTION_ID, 'M1-016 previous promotion', errors);
  exactPolicyValue(promotion?.previousPromotionContract, 'config/p1r-commerce-contract.v1.json', 'M1-016 previous promotion contract', errors);
  exactPolicyValue(promotion?.immutableGovernanceBaseline, M1016_IMMUTABLE_GOVERNANCE_BASELINE_REF, 'M1-016 immutable governance baseline', errors);
  exactPolicyValue(promotion?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-016 promotion runtimeStatus', errors);
  exactPolicyValue(promotion?.scope, 'M1016_OPENAPI_EVENT_GOVERNANCE_B26_STATIC_WITH_B11_B5_B13_V1_HISTORICAL', 'M1-016 promotion scope', errors);
  exactPolicyValue(promotion?.promotionMode, 'FUTURE_M1016_V2_ONLY', 'M1-016 promotion mode', errors);
  exactPolicyValue(promotion?.allowsHistoricalV1Promotion, false, 'M1-016 historical v1 promotion allowance', errors);
  exactPolicyValue(promotion?.allowsDualPublish, false, 'M1-016 dual-publish allowance', errors);
  for (const [field, digest, label] of [
    ['approvedSourceFiles', M1016_APPROVED_SOURCE_FILES_SEMANTIC_SHA256, 'M1-016 approved source files'],
    ['requiredCompatibilityChecks', M1016_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256, 'M1-016 required compatibility checks'],
    ['b26StaticPolicy', M1016_B26_STATIC_POLICY_SEMANTIC_SHA256, 'M1-016 B26 static policy'],
    ['canonicalOpenApiSource', M1016_CANONICAL_OPENAPI_SOURCE_SEMANTIC_SHA256, 'M1-016 canonical OpenAPI source'],
    ['canonicalEventSource', M1016_CANONICAL_EVENT_SOURCE_SEMANTIC_SHA256, 'M1-016 canonical event source'],
  ]) {
    if (stableGovernanceSha256(promotion?.[field]) !== digest) errors.push(`${label} is not the frozen M1-016 value`);
  }
  return errors;
}

function loadM1016CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...notificationSyncSupportContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-016 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1016CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-016 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

const M1017_POLICY_TOP_LEVEL_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'collectionPolicy', 'sourcePolicies', 'canonicalSources', 'compatibilityPromotion', 'canonicalOperations',
  'canonicalEvents', 'telemetryBoundary', 'gapBindings', 'runtimeBoundary',
]);

export function validateM1017CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyKeys(policy, M1017_POLICY_TOP_LEVEL_KEYS, 'privacy/analytics/audit contract policy', errors);
  exactPolicyValue(policy?.$schema, 'p1r.privacy-analytics-audit-contract.v1', 'M1-017 policy $schema', errors);
  exactPolicyValue(policy?.schemaVersion, 'p1r.privacy-analytics-audit-contract.v1', 'M1-017 policy schemaVersion', errors);
  exactPolicyValue(policy?.task, 'P1R-M1-017', 'M1-017 policy task', errors);
  exactPolicyValue(policy?.phase, 'P1', 'M1-017 policy phase', errors);
  exactPolicyValue(policy?.startCommit, '6245ca42ef254ecc4a45e86e57a5c65922c69c22', 'M1-017 policy startCommit', errors);
  exactPolicyValue(policy?.sourceBaseline, M1017_SOURCE_CONTRACT_BASELINE_REF, 'M1-017 source baseline', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'M1-017 policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-017 policy runtimeStatus', errors);
  if (stableGovernanceSha256(policy) !== M1017_POLICY_SEMANTIC_SHA256) {
    errors.push('privacy/analytics/audit contract policy is not the frozen M1-017 semantic policy value');
  }

  const promotion = policy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M1017_PROMOTION_ALLOWANCE_KEYS, 'M1-017 compatibility promotion', errors);
  exactPolicyValue(promotion?.id, M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID, 'M1-017 promotion id', errors);
  exactPolicyValue(promotion?.sourceContractBaseline, M1017_SOURCE_CONTRACT_BASELINE_REF, 'M1-017 promotion source baseline', errors);
  exactPolicyValue(promotion?.previousPromotion, M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID, 'M1-017 previous promotion', errors);
  exactPolicyValue(promotion?.previousPromotionContract, 'config/p1r-notification-sync-support-contract.v1.json', 'M1-017 previous promotion contract', errors);
  exactPolicyValue(promotion?.immutableGovernanceBaseline, M1017_IMMUTABLE_GOVERNANCE_BASELINE_REF, 'M1-017 immutable governance baseline', errors);
  exactPolicyValue(promotion?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-017 promotion runtimeStatus', errors);
  exactPolicyValue(promotion?.scope, 'M1017_OPENAPI_EVENT_GOVERNANCE_B26_STATIC_WITH_B1_B13_V1_HISTORICAL', 'M1-017 promotion scope', errors);
  exactPolicyValue(promotion?.promotionMode, 'FUTURE_M1017_V2_ONLY', 'M1-017 promotion mode', errors);
  exactPolicyValue(promotion?.allowsHistoricalV1Promotion, false, 'M1-017 historical v1 promotion allowance', errors);
  exactPolicyValue(promotion?.allowsDualPublish, false, 'M1-017 dual-publish allowance', errors);
  for (const [field, digest, label] of [
    ['approvedSourceFiles', M1017_APPROVED_SOURCE_FILES_SEMANTIC_SHA256, 'M1-017 approved source files'],
    ['requiredCompatibilityChecks', M1017_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256, 'M1-017 required compatibility checks'],
    ['b26StaticPolicy', M1017_B26_STATIC_POLICY_SEMANTIC_SHA256, 'M1-017 B26 static policy'],
  ]) {
    if (stableGovernanceSha256(promotion?.[field]) !== digest) errors.push(`${label} is not the frozen M1-017 value`);
  }
  return errors;
}

function loadM1017CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...privacyAnalyticsAuditContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-017 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1017CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-017 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

const M1018_POLICY_TOP_LEVEL_KEYS = Object.freeze([
  '$schema', 'schemaVersion', 'task', 'phase', 'startCommit', 'sourceBaseline', 'maturity', 'runtimeStatus',
  'canonicalSources', 'canonicalEvents', 'gapBindings', 'closureSemantics', 'compatibilityPromotion', 'runtimeBoundary',
]);

export function validateM1018CompatibilityPolicy(policy) {
  const errors = [];
  exactPolicyKeys(policy, M1018_POLICY_TOP_LEVEL_KEYS, 'IAM event contract policy', errors);
  exactPolicyValue(policy?.$schema, 'p1r.iam-event-contract.v1', 'M1-018 policy $schema', errors);
  exactPolicyValue(policy?.schemaVersion, 'p1r.iam-event-contract.v1', 'M1-018 policy schemaVersion', errors);
  exactPolicyValue(policy?.task, 'P1R-M1-018', 'M1-018 policy task', errors);
  exactPolicyValue(policy?.phase, 'P1', 'M1-018 policy phase', errors);
  exactPolicyValue(policy?.startCommit, '0b6b80038dbbf43e8d218750fcb39f49970703bb', 'M1-018 policy start commit', errors);
  exactPolicyValue(policy?.sourceBaseline, M1018_SOURCE_CONTRACT_BASELINE_REF, 'M1-018 source baseline', errors);
  exactPolicyValue(policy?.maturity, 'D2_CONTRACT_READY', 'M1-018 policy maturity', errors);
  exactPolicyValue(policy?.runtimeStatus, 'NOT_RUNTIME_VERIFIED', 'M1-018 policy runtimeStatus', errors);
  if (stableGovernanceSha256(policy) !== M1018_POLICY_SEMANTIC_SHA256) {
    errors.push('IAM event contract policy is not the frozen M1-018 semantic policy value');
  }
  const promotion = policy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M1018_PROMOTION_ALLOWANCE_KEYS, 'M1-018 compatibility promotion', errors);
  if (!isValidM1018PromotionAllowance(promotion)) {
    errors.push('M1-018 compatibility promotion is not the frozen IAM v2 static-governance allowance');
  }
  for (const [field, digest, label] of [
    ['approvedSourceFiles', M1018_APPROVED_SOURCE_FILES_SEMANTIC_SHA256, 'M1-018 approved source files'],
    ['requiredCompatibilityChecks', M1018_REQUIRED_COMPATIBILITY_CHECKS_SEMANTIC_SHA256, 'M1-018 required compatibility checks'],
    ['b26StaticPolicy', M1018_B26_STATIC_POLICY_SEMANTIC_SHA256, 'M1-018 B26 static policy'],
  ]) {
    if (stableGovernanceSha256(promotion?.[field]) !== digest) errors.push(`${label} is not the frozen M1-018 value`);
  }
  return errors;
}

function loadM1018CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...iamEventContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-018 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1018CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-018 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

function loadM1015CompatibilityPolicy(readFile) {
  let policy;
  try {
    policy = JSON.parse(readFile(path.join(repoRoot, ...commerceContractPolicyPath.split('/'))));
  } catch (error) {
    throw new Error(`M1-015 compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM1015CompatibilityPolicy(policy);
  if (errors.length > 0) {
    throw new Error(`M1-015 compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...policy.compatibilityPromotion });
}

function loadM1013SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== M1013_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-013 source contract ref ${M1013_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

function loadM1014SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== M1014_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-014 source contract ref ${M1014_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

function loadM1015SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-015 source contract ref ${REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

function loadM1016SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-016 source contract ref ${REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

function loadM1017SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1017_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-017 source contract ref ${REQUIRED_M1017_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

function loadM1018SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1018_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-018 source contract ref ${REQUIRED_M1018_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

export function validateM2001CompatibilityPolicy(gatewayBoundaryDocument) {
  const errors = [];
  const executionTargetPolicy = gatewayBoundaryDocument?.['x-p1r-gateway-boundary']?.executionTargetPolicy;
  const promotion = executionTargetPolicy?.compatibilityPromotion;
  exactPolicyKeys(promotion, M2001_PROMOTION_ALLOWANCE_KEYS, 'M2-001 compatibility promotion', errors);
  if (!isValidM2001PromotionAllowance(promotion)) {
    errors.push('M2-001 compatibility promotion is not the frozen Gateway root-and-health-identity-only allowance');
  }
  return errors;
}

function loadM2001CompatibilityPolicy(readFile) {
  let document;
  try {
    document = JSON.parse(readFile(path.join(repoRoot, ...gatewayBoundaryContractPath.split('/'))));
  } catch (error) {
    throw new Error(`M2-001 Gateway execution-target compatibility policy could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  const errors = validateM2001CompatibilityPolicy(document);
  if (errors.length > 0) {
    throw new Error(`M2-001 Gateway execution-target compatibility policy is invalid (fail closed):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return Object.freeze({ ...document['x-p1r-gateway-boundary'].executionTargetPolicy.compatibilityPromotion });
}

function loadM2001SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M2001_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M2-001 source contract ref ${REQUIRED_M2001_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  const openapi = JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`]));
  if (stableGovernanceSha256(openapi) !== M2001_OPENAPI_SOURCE_SEMANTIC_SHA256) {
    throw new Error('M2-001 source contract is not the frozen accepted M1-018 OpenAPI checkpoint.');
  }
  return {
    ref,
    commit,
    openapi,
    source: `git:${commit}:${contractPaths.openapi}`,
  };
}

function loadImmutableGovernanceBaseline(governanceRef, git) {
  if (governanceRef !== REQUIRED_EVENT_GOVERNANCE_BASELINE_REF) {
    throw new Error(
      `Compatibility --governance-ref must remain immutable ${REQUIRED_EVENT_GOVERNANCE_BASELINE_REF}; received ${String(governanceRef)}.`,
    );
  }
  const commit = git(['rev-parse', '--verify', `${governanceRef}^{commit}`]).trim();
  if (commit !== REQUIRED_EVENT_GOVERNANCE_BASELINE_REF) {
    throw new Error(
      `Immutable governance ref ${REQUIRED_EVENT_GOVERNANCE_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  const eventsText = git(['show', `${commit}:${contractPaths.events}`]);
  const b26Text = git(['show', `${commit}:${b26RuntimePath}`]);
  return {
    ref: governanceRef,
    commit,
    catalog: JSON.parse(eventsText),
    b26Runtime: JSON.parse(b26Text),
    sources: {
      catalog: `git:${commit}:${contractPaths.events}`,
      b26StaticPolicy: `git:${commit}:${b26RuntimePath}`,
    },
  };
}

function loadM1008SourceContractBaseline(promotion, git, { includeOpenApi = true, includeEvents = true } = {}) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-008 source contract ref ${REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  const openapi = includeOpenApi
    ? JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`]))
    : undefined;
  const catalog = includeEvents
    ? JSON.parse(git(['show', `${commit}:${contractPaths.events}`]))
    : undefined;
  const b26Runtime = includeEvents
    ? JSON.parse(git(['show', `${commit}:${b26RuntimePath}`]))
    : undefined;
  return {
    ref,
    commit,
    openapi,
    catalog,
    b26Runtime,
    source: `git:${commit}:${contractPaths.events}`,
  };
}

function loadM1009SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-009 source contract ref ${REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    source: `git:${commit}:${contractPaths.openapi}`,
  };
}

function loadM1010SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-010 source contract ref ${REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json}`,
  };
}

function loadM1011SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-011 source contract ref ${REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

function loadM1012SourceContractBaseline(promotion, git) {
  const ref = promotion.sourceContractBaseline;
  const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  if (commit !== REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF) {
    throw new Error(
      `M1-012 source contract ref ${REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF} resolved to ${commit || '<empty>'}; it must resolve to the frozen full commit.`,
    );
  }
  return {
    ref,
    commit,
    openapi: JSON.parse(git(['show', `${commit}:${contractPaths.openapi}`])),
    catalog: JSON.parse(git(['show', `${commit}:${contractPaths.events}`])),
    b26Runtime: JSON.parse(git(['show', `${commit}:${b26RuntimePath}`])),
    source: `git:${commit}:packages/contracts/{openapi/v1/openapi.json,events/v1/catalog.json,../config/b26-event-runtime.json}`,
  };
}

export function runGitBaselineCompatibility({
  ref,
  kind = 'all',
  governanceRef = REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,
  git = defaultGit,
  readFile = (filePath) => fs.readFileSync(filePath, 'utf8'),
} = {}) {
  if (typeof ref !== 'string' || ref.trim().length === 0) {
    throw new Error('Compatibility --ref is required; use an accepted commit older than the current implementation commit.');
  }

  const selectedKinds = normalizeKind(kind);
  const baselineCommit = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  const currentCommit = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  if (baselineCommit === currentCommit) {
    throw new Error(
      `Compatibility baseline ${ref} resolves to the current HEAD and every selected contract is identical; choose an older accepted commit.`,
    );
  }
  const needsM1008Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1010Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1011Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1012Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1013Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1014Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1015Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1016Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1017Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM1018Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
  const needsM2001Promotion = selectedKinds.includes('openapi');
  const m2001BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1017_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1018_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M2001_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM2001Promotion = needsM2001Promotion && m2001BaselineRefs.has(baselineCommit);
  const m1018BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1017_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1018_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1018Promotion = needsM1018Promotion && m1018BaselineRefs.has(baselineCommit);
  const m1017BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1017_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1018_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1017Promotion = needsM1017Promotion && m1017BaselineRefs.has(baselineCommit);
  const m1016BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1016_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1016Promotion = needsM1016Promotion && m1016BaselineRefs.has(baselineCommit);
  const m1015BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1015Promotion = needsM1015Promotion && m1015BaselineRefs.has(baselineCommit);
  const m1014BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1014Promotion = needsM1014Promotion && m1014BaselineRefs.has(baselineCommit);
  const m1013BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1013_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1014_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1015_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1013Promotion = needsM1013Promotion && m1013BaselineRefs.has(baselineCommit);
  const needsM1009Promotion = selectedKinds.includes('openapi');
  const needsM1009Policy = needsM1009Promotion || needsM1010Promotion;
  const needsEventGovernance = selectedKinds.includes('events');
  const immutableGovernanceBaseline = needsEventGovernance
    ? loadImmutableGovernanceBaseline(governanceRef, git)
    : undefined;
  const promotion = needsM1008Promotion
    ? loadM1008CompatibilityPolicy(readFile)
    : undefined;
  const sourceContractBaseline = needsM1008Promotion
    ? loadM1008SourceContractBaseline(promotion, git, {
      includeOpenApi: selectedKinds.includes('openapi'),
      includeEvents: needsEventGovernance,
    })
    : undefined;
  const mediaPromotion = needsM1009Policy
    ? loadM1009CompatibilityPolicy(readFile)
    : undefined;
  const mediaSourceContractBaseline = needsM1009Policy
    ? loadM1009SourceContractBaseline(mediaPromotion, git)
    : undefined;
  const assessmentPromotion = needsM1010Promotion
    ? loadM1010CompatibilityPolicy(readFile)
    : undefined;
  const assessmentSourceContractBaseline = needsM1010Promotion
    ? loadM1010SourceContractBaseline(assessmentPromotion, git)
    : undefined;
  const learnerPlanningPromotion = needsM1011Promotion
    ? loadM1011CompatibilityPolicy(readFile)
    : undefined;
  const learnerPlanningSourceContractBaseline = needsM1011Promotion
    ? loadM1011SourceContractBaseline(learnerPlanningPromotion, git)
    : undefined;
  const placementPromotion = needsM1012Promotion
    ? loadM1012CompatibilityPolicy(readFile)
    : undefined;
  const placementSourceContractBaseline = needsM1012Promotion
    ? loadM1012SourceContractBaseline(placementPromotion, git)
    : undefined;
  const learningLoopPromotion = useM1013Promotion
    ? loadM1013CompatibilityPolicy(readFile)
    : undefined;
  const learningLoopSourceContractBaseline = useM1013Promotion
    ? loadM1013SourceContractBaseline(learningLoopPromotion, git)
    : undefined;
  const gamificationSocialPromotion = useM1014Promotion
    ? loadM1014CompatibilityPolicy(readFile)
    : undefined;
  const gamificationSocialSourceContractBaseline = useM1014Promotion
    ? loadM1014SourceContractBaseline(gamificationSocialPromotion, git)
    : undefined;
  const commercePromotion = useM1015Promotion
    ? loadM1015CompatibilityPolicy(readFile)
    : undefined;
  const commerceSourceContractBaseline = useM1015Promotion
    ? loadM1015SourceContractBaseline(commercePromotion, git)
    : undefined;
  const notificationSyncSupportPromotion = useM1016Promotion
    ? loadM1016CompatibilityPolicy(readFile)
    : undefined;
  const notificationSyncSupportSourceContractBaseline = useM1016Promotion
    ? loadM1016SourceContractBaseline(notificationSyncSupportPromotion, git)
    : undefined;
  const privacyAnalyticsAuditPromotion = useM1017Promotion
    ? loadM1017CompatibilityPolicy(readFile)
    : undefined;
  const privacyAnalyticsAuditSourceContractBaseline = useM1017Promotion
    ? loadM1017SourceContractBaseline(privacyAnalyticsAuditPromotion, git)
    : undefined;
  const iamEventPromotion = useM1018Promotion
    ? loadM1018CompatibilityPolicy(readFile)
    : undefined;
  const iamEventSourceContractBaseline = useM1018Promotion
    ? loadM1018SourceContractBaseline(iamEventPromotion, git)
    : undefined;
  const gatewayExecutionPromotion = useM2001Promotion
    ? loadM2001CompatibilityPolicy(readFile)
    : undefined;
  const gatewayExecutionSourceContractBaseline = useM2001Promotion
    ? loadM2001SourceContractBaseline(gatewayExecutionPromotion, git)
    : undefined;
  const immutableBaselineIntegrityChanges = needsEventGovernance
    ? [
      ...compareContracts('events', sourceContractBaseline.catalog, immutableGovernanceBaseline.catalog),
      ...compareB26WorkflowGovernance(sourceContractBaseline.b26Runtime, immutableGovernanceBaseline.b26Runtime),
    ]
    : [];
  const m1008BaselineRefs = new Set([
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_CI_CONTRACT_BASELINE_REF,
  ]);
  const useM1008Promotion = needsM1008Promotion && m1008BaselineRefs.has(baselineCommit);
  const m1009BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1009Promotion = needsM1009Promotion && m1009BaselineRefs.has(baselineCommit);
  const m1010BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1010Promotion = needsM1010Promotion && m1010BaselineRefs.has(baselineCommit);
  const m1011BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1011Promotion = needsM1011Promotion && m1011BaselineRefs.has(baselineCommit);
  const m1012BaselineRefs = new Set([
    REQUIRED_CI_CONTRACT_BASELINE_REF,
    REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1009_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1010_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1011_SOURCE_CONTRACT_BASELINE_REF,
    REQUIRED_M1012_SOURCE_CONTRACT_BASELINE_REF,
  ]);
  const useM1012Promotion = needsM1012Promotion && m1012BaselineRefs.has(baselineCommit);
  const m1008ToM1009IntegrityChanges = needsM1009Promotion
    ? compareContracts(
      'openapi',
      sourceContractBaseline.openapi,
      mediaSourceContractBaseline.openapi,
      { allowance: promotion },
    )
    : [];
  const m1009ToM1010OpenApiIntegrityChanges = needsM1009Promotion
    ? compareContracts(
      'openapi',
      mediaSourceContractBaseline.openapi,
      assessmentSourceContractBaseline.openapi,
      { allowance: mediaPromotion },
    )
    : [];
  const m1008ToM1010EventIntegrityChanges = needsEventGovernance
    ? compareContracts(
      'events',
      sourceContractBaseline.catalog,
      assessmentSourceContractBaseline.catalog,
      { allowance: promotion },
    )
    : [];
  const m1010ToM1011OpenApiIntegrityChanges = needsM1009Promotion
    ? compareContracts(
      'openapi',
      assessmentSourceContractBaseline.openapi,
      learnerPlanningSourceContractBaseline.openapi,
      { allowance: assessmentPromotion },
    )
    : [];
  const m1010ToM1011EventIntegrityChanges = needsEventGovernance
    ? compareContracts(
      'events',
      assessmentSourceContractBaseline.catalog,
      learnerPlanningSourceContractBaseline.catalog,
      { allowance: assessmentPromotion },
    )
    : [];
  const m1011ToM1012OpenApiIntegrityChanges = needsM1009Promotion
    ? compareContracts(
      'openapi',
      learnerPlanningSourceContractBaseline.openapi,
      placementSourceContractBaseline.openapi,
      { allowance: learnerPlanningPromotion },
    )
    : [];
  const m1011ToM1012EventIntegrityChanges = needsEventGovernance
    ? compareContracts(
      'events',
      learnerPlanningSourceContractBaseline.catalog,
      placementSourceContractBaseline.catalog,
      { allowance: learnerPlanningPromotion },
    )
    : [];
  const m1012ToM1013OpenApiIntegrityChanges = useM1013Promotion
    ? compareContracts(
      'openapi',
      placementSourceContractBaseline.openapi,
      learningLoopSourceContractBaseline.openapi,
      { allowance: placementPromotion },
    )
    : [];
  const m1012ToM1013EventIntegrityChanges = useM1013Promotion && needsEventGovernance
    ? compareContracts(
      'events',
      placementSourceContractBaseline.catalog,
      learningLoopSourceContractBaseline.catalog,
      { allowance: placementPromotion },
    )
    : [];
  const m1013ToM1014OpenApiIntegrityChanges = useM1014Promotion
    ? compareContracts(
      'openapi',
      learningLoopSourceContractBaseline.openapi,
      gamificationSocialSourceContractBaseline.openapi,
      { allowance: learningLoopPromotion },
    )
    : [];
  const m1013ToM1014EventIntegrityChanges = useM1014Promotion && needsEventGovernance
    ? compareContracts(
      'events',
      learningLoopSourceContractBaseline.catalog,
      gamificationSocialSourceContractBaseline.catalog,
      { allowance: learningLoopPromotion },
    )
    : [];
  const m1014ToM1015OpenApiIntegrityChanges = useM1015Promotion
    ? compareContracts(
      'openapi',
      gamificationSocialSourceContractBaseline.openapi,
      commerceSourceContractBaseline.openapi,
      { allowance: gamificationSocialPromotion },
    )
    : [];
  const m1014ToM1015EventIntegrityChanges = useM1015Promotion && needsEventGovernance
    ? compareContracts(
      'events',
      gamificationSocialSourceContractBaseline.catalog,
      commerceSourceContractBaseline.catalog,
      { allowance: gamificationSocialPromotion },
    )
    : [];
  const m1015ToM1016OpenApiIntegrityChanges = useM1017Promotion && useM1016Promotion
    ? compareContracts(
      'openapi',
      notificationSyncSupportSourceContractBaseline.openapi,
      privacyAnalyticsAuditSourceContractBaseline.openapi,
      { allowance: notificationSyncSupportPromotion },
    )
    : [];
  const m1015ToM1016EventIntegrityChanges = useM1017Promotion && useM1016Promotion && needsEventGovernance
    ? compareContracts(
      'events',
      notificationSyncSupportSourceContractBaseline.catalog,
      privacyAnalyticsAuditSourceContractBaseline.catalog,
      { allowance: notificationSyncSupportPromotion },
    )
    : [];
  const m1011SourceB26IntegrityChanges = needsEventGovernance
    ? compareB26WorkflowGovernance(
      immutableGovernanceBaseline.b26Runtime,
      learnerPlanningSourceContractBaseline.b26Runtime,
      { allowance: promotion },
    )
    : [];
  const m1011ToM1012B26IntegrityChanges = needsEventGovernance
    ? compareB26WorkflowGovernance(
      learnerPlanningSourceContractBaseline.b26Runtime,
      placementSourceContractBaseline.b26Runtime,
      { allowance: learnerPlanningPromotion },
    )
    : [];
  const m1012ToM1013B26IntegrityChanges = useM1013Promotion && needsEventGovernance
    ? compareB26WorkflowGovernance(
      placementSourceContractBaseline.b26Runtime,
      learningLoopSourceContractBaseline.b26Runtime,
      { allowance: placementPromotion },
    )
    : [];
  const m1013ToM1014B26IntegrityChanges = useM1014Promotion && needsEventGovernance
    ? compareB26WorkflowGovernance(
      learningLoopSourceContractBaseline.b26Runtime,
      gamificationSocialSourceContractBaseline.b26Runtime,
      { allowance: learningLoopPromotion },
    )
    : [];
  const m1014ToM1015B26IntegrityChanges = useM1015Promotion && needsEventGovernance
    ? compareB26WorkflowGovernance(
      gamificationSocialSourceContractBaseline.b26Runtime,
      commerceSourceContractBaseline.b26Runtime,
      { allowance: gamificationSocialPromotion },
    )
    : [];
  const m1015ToM1016B26IntegrityChanges = useM1017Promotion && useM1016Promotion && needsEventGovernance
    ? compareB26WorkflowGovernance(
      notificationSyncSupportSourceContractBaseline.b26Runtime,
      privacyAnalyticsAuditSourceContractBaseline.b26Runtime,
      { allowance: notificationSyncSupportPromotion },
    )
    : [];
  const m1017ToM1018OpenApiIntegrityChanges = useM1018Promotion && useM1017Promotion
    ? compareContracts(
      'openapi',
      privacyAnalyticsAuditSourceContractBaseline.openapi,
      iamEventSourceContractBaseline.openapi,
      { allowance: privacyAnalyticsAuditPromotion },
    )
    : [];
  const m1017ToM1018EventIntegrityChanges = useM1018Promotion && useM1017Promotion && needsEventGovernance
    ? compareContracts(
      'events',
      privacyAnalyticsAuditSourceContractBaseline.catalog,
      iamEventSourceContractBaseline.catalog,
      { allowance: privacyAnalyticsAuditPromotion },
    )
    : [];
  const m1017ToM1018B26IntegrityChanges = useM1018Promotion && useM1017Promotion && needsEventGovernance
    ? compareB26WorkflowGovernance(
      privacyAnalyticsAuditSourceContractBaseline.b26Runtime,
      iamEventSourceContractBaseline.b26Runtime,
      { allowance: privacyAnalyticsAuditPromotion },
    )
    : [];
  const m1018ToM2001OpenApiIntegrityChanges = useM2001Promotion && useM1018Promotion
    ? compareContracts(
      'openapi',
      iamEventSourceContractBaseline.openapi,
      gatewayExecutionSourceContractBaseline.openapi,
      { allowance: iamEventPromotion },
    )
    : [];

  const governanceSummary = immutableGovernanceBaseline === undefined
    ? undefined
    : {
      ref: immutableGovernanceBaseline.ref,
      commit: immutableGovernanceBaseline.commit,
      sources: immutableGovernanceBaseline.sources,
      scope: 'static-governance-only',
      runtimeStatus: immutableGovernanceBaseline.catalog['x-p1r-event-governance']?.runtimeStatus ?? 'UNSPECIFIED',
    };

  const comparisons = selectedKinds.map((contractKind) => {
    const relativePath = contractPaths[contractKind];
    const currentPath = path.join(repoRoot, ...relativePath.split('/'));
    const baselineText = git(['show', `${baselineCommit}:${relativePath}`]);
    const currentText = readFile(currentPath);

    const previous = JSON.parse(baselineText);
    const current = JSON.parse(currentText);
    let breakingChanges;
    let resultGovernanceBaseline;
    let promotionResult;
    if (contractKind === 'openapi' && useM2001Promotion) {
      breakingChanges = [
        ...(useM1018Promotion ? [
          ...m1008ToM1009IntegrityChanges,
          ...m1009ToM1010OpenApiIntegrityChanges,
          ...m1010ToM1011OpenApiIntegrityChanges,
          ...m1011ToM1012OpenApiIntegrityChanges,
          ...m1012ToM1013OpenApiIntegrityChanges,
          ...m1013ToM1014OpenApiIntegrityChanges,
          ...m1014ToM1015OpenApiIntegrityChanges,
          ...m1015ToM1016OpenApiIntegrityChanges,
          ...m1017ToM1018OpenApiIntegrityChanges,
          ...m1018ToM2001OpenApiIntegrityChanges,
        ] : []),
        ...compareContracts(
          'openapi',
          gatewayExecutionSourceContractBaseline.openapi,
          current,
          { allowance: gatewayExecutionPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: gatewayExecutionPromotion.id,
        sourceContractBaseline: gatewayExecutionSourceContractBaseline.commit,
        previousPromotion: M1018_IAM_EVENT_PROMOTION_ID,
        previousPromotionSource: M1018_SOURCE_CONTRACT_BASELINE_REF,
        runtimeStatus: gatewayExecutionPromotion.runtimeStatus,
        scope: gatewayExecutionPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1018Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...m1012ToM1013OpenApiIntegrityChanges,
        ...m1013ToM1014OpenApiIntegrityChanges,
        ...m1014ToM1015OpenApiIntegrityChanges,
        ...m1015ToM1016OpenApiIntegrityChanges,
        ...m1017ToM1018OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          iamEventSourceContractBaseline.openapi,
          current,
          { allowance: iamEventPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: iamEventPromotion.id,
        sourceContractBaseline: iamEventSourceContractBaseline.commit,
        previousPromotion: M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID,
        previousPromotionSource: M1017_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: iamEventPromotion.immutableGovernanceBaseline,
        runtimeStatus: iamEventPromotion.runtimeStatus,
        scope: iamEventPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1018Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...m1012ToM1013EventIntegrityChanges,
        ...m1013ToM1014EventIntegrityChanges,
        ...m1014ToM1015EventIntegrityChanges,
        ...m1015ToM1016EventIntegrityChanges,
        ...m1017ToM1018EventIntegrityChanges,
        ...compareContracts(
          'events',
          iamEventSourceContractBaseline.catalog,
          current,
          { allowance: iamEventPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...m1012ToM1013B26IntegrityChanges,
        ...m1013ToM1014B26IntegrityChanges,
        ...m1014ToM1015B26IntegrityChanges,
        ...m1015ToM1016B26IntegrityChanges,
        ...m1017ToM1018B26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          iamEventSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: iamEventPromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: iamEventPromotion.id,
        sourceContractBaseline: iamEventSourceContractBaseline.commit,
        previousPromotion: M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID,
        previousPromotionSource: M1017_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        runtimeStatus: iamEventPromotion.runtimeStatus,
        scope: iamEventPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1017Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...m1012ToM1013OpenApiIntegrityChanges,
        ...m1013ToM1014OpenApiIntegrityChanges,
        ...m1014ToM1015OpenApiIntegrityChanges,
        ...m1015ToM1016OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          privacyAnalyticsAuditSourceContractBaseline.openapi,
          current,
          { allowance: privacyAnalyticsAuditPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: privacyAnalyticsAuditPromotion.id,
        sourceContractBaseline: privacyAnalyticsAuditSourceContractBaseline.commit,
        previousPromotion: M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID,
        previousPromotionSource: M1016_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: privacyAnalyticsAuditPromotion.immutableGovernanceBaseline,
        runtimeStatus: privacyAnalyticsAuditPromotion.runtimeStatus,
        scope: privacyAnalyticsAuditPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1017Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...m1012ToM1013EventIntegrityChanges,
        ...m1013ToM1014EventIntegrityChanges,
        ...m1014ToM1015EventIntegrityChanges,
        ...m1015ToM1016EventIntegrityChanges,
        ...compareContracts(
          'events',
          privacyAnalyticsAuditSourceContractBaseline.catalog,
          current,
          { allowance: privacyAnalyticsAuditPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...m1012ToM1013B26IntegrityChanges,
        ...m1013ToM1014B26IntegrityChanges,
        ...m1014ToM1015B26IntegrityChanges,
        ...m1015ToM1016B26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          privacyAnalyticsAuditSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: privacyAnalyticsAuditPromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: privacyAnalyticsAuditPromotion.id,
        sourceContractBaseline: privacyAnalyticsAuditSourceContractBaseline.commit,
        previousPromotion: M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID,
        previousPromotionSource: M1016_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        runtimeStatus: privacyAnalyticsAuditPromotion.runtimeStatus,
        scope: privacyAnalyticsAuditPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1016Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...m1012ToM1013OpenApiIntegrityChanges,
        ...m1013ToM1014OpenApiIntegrityChanges,
        ...m1014ToM1015OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          notificationSyncSupportSourceContractBaseline.openapi,
          current,
          { allowance: notificationSyncSupportPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: notificationSyncSupportPromotion.id,
        sourceContractBaseline: notificationSyncSupportSourceContractBaseline.commit,
        previousPromotion: commercePromotion?.id ?? M1015_COMMERCE_PROMOTION_ID,
        previousPromotionSource: commercePromotion
          ? (commerceSourceContractBaseline?.commit ?? M1015_SOURCE_CONTRACT_BASELINE_REF)
          : M1015_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: notificationSyncSupportPromotion.immutableGovernanceBaseline,
        runtimeStatus: notificationSyncSupportPromotion.runtimeStatus,
        scope: notificationSyncSupportPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1016Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...m1012ToM1013EventIntegrityChanges,
        ...m1013ToM1014EventIntegrityChanges,
        ...m1014ToM1015EventIntegrityChanges,
        ...compareContracts(
          'events',
          notificationSyncSupportSourceContractBaseline.catalog,
          current,
          { allowance: notificationSyncSupportPromotion },
        ),
        ...compareB26WorkflowGovernance(
          notificationSyncSupportSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: notificationSyncSupportPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...m1012ToM1013B26IntegrityChanges,
        ...m1013ToM1014B26IntegrityChanges,
        ...m1014ToM1015B26IntegrityChanges,
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: notificationSyncSupportPromotion.id,
        sourceContractBaseline: notificationSyncSupportSourceContractBaseline.commit,
        previousPromotion: commercePromotion?.id ?? M1015_COMMERCE_PROMOTION_ID,
        previousPromotionSource: commercePromotion
          ? (commerceSourceContractBaseline?.commit ?? M1015_SOURCE_CONTRACT_BASELINE_REF)
          : M1015_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        runtimeStatus: notificationSyncSupportPromotion.runtimeStatus,
        scope: notificationSyncSupportPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1015Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...m1012ToM1013OpenApiIntegrityChanges,
        ...m1013ToM1014OpenApiIntegrityChanges,
        ...m1014ToM1015OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          commerceSourceContractBaseline.openapi,
          current,
          { allowance: commercePromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: commercePromotion.id,
        sourceContractBaseline: commerceSourceContractBaseline.commit,
        previousPromotion: gamificationSocialPromotion.id,
        previousPromotionSource: gamificationSocialSourceContractBaseline.commit,
        immutableGovernanceBaseline: commercePromotion.immutableGovernanceBaseline,
        runtimeStatus: commercePromotion.runtimeStatus,
        scope: commercePromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1015Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...m1012ToM1013EventIntegrityChanges,
        ...m1013ToM1014EventIntegrityChanges,
        ...m1014ToM1015EventIntegrityChanges,
        ...compareContracts(
          'events',
          commerceSourceContractBaseline.catalog,
          current,
          { allowance: commercePromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...m1012ToM1013B26IntegrityChanges,
        ...m1013ToM1014B26IntegrityChanges,
        ...m1014ToM1015B26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          commerceSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: commercePromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: commercePromotion.id,
        sourceContractBaseline: commerceSourceContractBaseline.commit,
        previousPromotion: gamificationSocialPromotion.id,
        previousPromotionSource: gamificationSocialSourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        runtimeStatus: commercePromotion.runtimeStatus,
        scope: commercePromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1014Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...m1012ToM1013OpenApiIntegrityChanges,
        ...m1013ToM1014OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          gamificationSocialSourceContractBaseline.openapi,
          current,
          { allowance: gamificationSocialPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: gamificationSocialPromotion.id,
        sourceContractBaseline: gamificationSocialSourceContractBaseline.commit,
        previousPromotion: learningLoopPromotion.id,
        previousPromotionSource: learningLoopSourceContractBaseline.commit,
        immutableGovernanceBaseline: gamificationSocialPromotion.immutableGovernanceBaseline,
        runtimeStatus: gamificationSocialPromotion.runtimeStatus,
        scope: gamificationSocialPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1014Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...m1012ToM1013EventIntegrityChanges,
        ...m1013ToM1014EventIntegrityChanges,
        ...compareContracts(
          'events',
          gamificationSocialSourceContractBaseline.catalog,
          current,
          { allowance: gamificationSocialPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...m1012ToM1013B26IntegrityChanges,
        ...m1013ToM1014B26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          gamificationSocialSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: gamificationSocialPromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: gamificationSocialPromotion.id,
        sourceContractBaseline: gamificationSocialSourceContractBaseline.commit,
        previousPromotion: learningLoopPromotion.id,
        previousPromotionSource: learningLoopSourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        runtimeStatus: gamificationSocialPromotion.runtimeStatus,
        scope: gamificationSocialPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1013Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...m1012ToM1013OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          learningLoopSourceContractBaseline.openapi,
          current,
          { allowance: learningLoopPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: learningLoopPromotion.id,
        sourceContractBaseline: learningLoopSourceContractBaseline.commit,
        previousPromotion: placementPromotion.id,
        previousPromotionSource: placementSourceContractBaseline.commit,
        immutableGovernanceBaseline: learningLoopPromotion.immutableGovernanceBaseline,
        runtimeStatus: learningLoopPromotion.runtimeStatus,
        scope: learningLoopPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1013Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...m1012ToM1013EventIntegrityChanges,
        ...compareContracts(
          'events',
          learningLoopSourceContractBaseline.catalog,
          current,
          { allowance: learningLoopPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...m1012ToM1013B26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          learningLoopSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: learningLoopPromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: learningLoopPromotion.id,
        sourceContractBaseline: learningLoopSourceContractBaseline.commit,
        previousPromotion: placementPromotion.id,
        previousPromotionSource: placementSourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        runtimeStatus: learningLoopPromotion.runtimeStatus,
        scope: learningLoopPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1012Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...m1011ToM1012OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          placementSourceContractBaseline.openapi,
          current,
          { allowance: placementPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: placementPromotion.id,
        sourceContractBaseline: placementSourceContractBaseline.commit,
        previousPromotion: learnerPlanningPromotion.id,
        previousPromotionSource: learnerPlanningSourceContractBaseline.commit,
        immutableGovernanceBaseline: placementPromotion.immutableGovernanceBaseline,
        scope: placementPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1012Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...m1011ToM1012EventIntegrityChanges,
        ...compareContracts(
          'events',
          placementSourceContractBaseline.catalog,
          current,
          { allowance: placementPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...m1011ToM1012B26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          placementSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: placementPromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: placementPromotion.id,
        sourceContractBaseline: placementSourceContractBaseline.commit,
        previousPromotion: learnerPlanningPromotion.id,
        previousPromotionSource: learnerPlanningSourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        scope: placementPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1011Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...m1010ToM1011OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          learnerPlanningSourceContractBaseline.openapi,
          current,
          { allowance: learnerPlanningPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: learnerPlanningPromotion.id,
        sourceContractBaseline: learnerPlanningSourceContractBaseline.commit,
        previousPromotion: assessmentPromotion.id,
        previousPromotionSource: assessmentSourceContractBaseline.commit,
        scope: learnerPlanningPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1011Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...m1010ToM1011EventIntegrityChanges,
        ...compareContracts(
          'events',
          learnerPlanningSourceContractBaseline.catalog,
          current,
          { allowance: learnerPlanningPromotion },
        ),
        ...m1011SourceB26IntegrityChanges,
        ...compareB26WorkflowGovernance(
          learnerPlanningSourceContractBaseline.b26Runtime,
          currentB26,
          { allowance: learnerPlanningPromotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: learnerPlanningPromotion.id,
        sourceContractBaseline: learnerPlanningSourceContractBaseline.commit,
        previousPromotion: assessmentPromotion.id,
        previousPromotionSource: assessmentSourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        scope: learnerPlanningPromotion.scope,
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1010Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...m1009ToM1010OpenApiIntegrityChanges,
        ...compareContracts(
          'openapi',
          assessmentSourceContractBaseline.openapi,
          current,
          { allowance: assessmentPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: assessmentPromotion.id,
        sourceContractBaseline: assessmentSourceContractBaseline.commit,
        previousPromotion: mediaPromotion.id,
        previousPromotionSource: mediaSourceContractBaseline.commit,
        scope: 'explicit-openapi-and-historical-event-payloads',
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'events' && useM1010Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges = [
        ...m1008ToM1010EventIntegrityChanges,
        ...compareContracts(
          'events',
          assessmentSourceContractBaseline.catalog,
          current,
          { allowance: assessmentPromotion },
        ),
        ...compareB26WorkflowGovernance(
          immutableGovernanceBaseline.b26Runtime,
          currentB26,
          { allowance: promotion },
        ),
        ...immutableBaselineIntegrityChanges,
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: assessmentPromotion.id,
        sourceContractBaseline: assessmentSourceContractBaseline.commit,
        previousPromotion: mediaPromotion.id,
        previousPromotionSource: mediaSourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        scope: 'explicit-openapi-and-historical-event-payloads',
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1009Promotion) {
      breakingChanges = [
        ...m1008ToM1009IntegrityChanges,
        ...compareContracts(
          'openapi',
          mediaSourceContractBaseline.openapi,
          current,
          { allowance: mediaPromotion },
        ),
      ];
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      promotionResult = {
        id: mediaPromotion.id,
        sourceContractBaseline: mediaSourceContractBaseline.commit,
        previousPromotion: promotion.id,
        previousPromotionSource: sourceContractBaseline.commit,
        scope: 'explicit-openapi-only',
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind === 'openapi' && useM1008Promotion) {
      breakingChanges = compareContracts(
        'openapi',
        sourceContractBaseline.openapi,
        current,
        { allowance: promotion },
      );
      promotionResult = {
        id: promotion.id,
        sourceContractBaseline: sourceContractBaseline.commit,
        immutableGovernanceBaseline: promotion.immutableGovernanceBaseline,
        scope: 'explicit-additive-only',
        accepted: breakingChanges.length === 0,
      };
    } else if (contractKind !== 'events') {
      breakingChanges = compareContracts(contractKind, previous, current);
    } else if (useM1008Promotion) {
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      const promotionChanges = compareContracts(
        'events',
        sourceContractBaseline.catalog,
        current,
        { allowance: promotion },
      );
      const immutableChanges = compareContracts(
        'events',
        immutableGovernanceBaseline.catalog,
        current,
        { allowance: promotion },
      );
      const b26Changes = compareB26WorkflowGovernance(
        immutableGovernanceBaseline.b26Runtime,
        currentB26,
        { allowance: promotion },
      );
      breakingChanges = [...promotionChanges, ...immutableChanges, ...b26Changes];
      breakingChanges.push(...immutableBaselineIntegrityChanges);
      const uniqueChanges = new Map();
      for (const change of breakingChanges) uniqueChanges.set(stableGovernanceValue(change), change);
      breakingChanges = [...uniqueChanges.values()];
      resultGovernanceBaseline = governanceSummary;
      promotionResult = {
        id: promotion.id,
        sourceContractBaseline: sourceContractBaseline.commit,
        immutableGovernanceBaseline: immutableGovernanceBaseline.commit,
        scope: 'explicit-additive-only',
        accepted: breakingChanges.length === 0,
      };
    } else {
      const requiresGovernanceBaseline = !hasEventGovernance(previous);
      breakingChanges = compareContracts(
        contractKind,
        previous,
        current,
        requiresGovernanceBaseline ? { governanceBaseline: immutableGovernanceBaseline.catalog } : undefined,
      );
      const currentB26 = JSON.parse(readFile(path.join(repoRoot, ...b26RuntimePath.split('/'))));
      breakingChanges.push(...compareB26WorkflowGovernance(immutableGovernanceBaseline.b26Runtime, currentB26));
      breakingChanges.push(...immutableBaselineIntegrityChanges);
      resultGovernanceBaseline = governanceSummary;
    }
    return {
      identical: baselineText.trim() === currentText.trim(),
      result: {
      kind: contractKind,
      baseline: `git:${baselineCommit}:${relativePath}`,
      current: currentPath,
      breakingChanges,
      compatible: breakingChanges.length === 0,
      governanceBaseline: resultGovernanceBaseline,
      promotion: promotionResult,
      },
    };
  });

  const results = comparisons.map((comparison) => comparison.result);

  return {
    ref,
    baselineCommit,
    currentCommit,
    governanceBaseline: governanceSummary,
    promotion: useM2001Promotion
      ? {
        id: gatewayExecutionPromotion.id,
        sourceContractBaseline: gatewayExecutionSourceContractBaseline.commit,
        previousPromotion: M1018_IAM_EVENT_PROMOTION_ID,
        previousPromotionSource: M1018_SOURCE_CONTRACT_BASELINE_REF,
        runtimeStatus: gatewayExecutionPromotion.runtimeStatus,
        scope: gatewayExecutionPromotion.scope,
      }
      : useM1018Promotion
      ? {
        id: iamEventPromotion.id,
        sourceContractBaseline: iamEventSourceContractBaseline.commit,
        previousPromotion: M1017_PRIVACY_ANALYTICS_AUDIT_PROMOTION_ID,
        previousPromotionSource: M1017_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: iamEventPromotion.immutableGovernanceBaseline,
        runtimeStatus: iamEventPromotion.runtimeStatus,
        scope: iamEventPromotion.scope,
      }
      : useM1017Promotion
      ? {
        id: privacyAnalyticsAuditPromotion.id,
        sourceContractBaseline: privacyAnalyticsAuditSourceContractBaseline.commit,
        previousPromotion: M1016_NOTIFICATION_SYNC_SUPPORT_PROMOTION_ID,
        previousPromotionSource: M1016_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: privacyAnalyticsAuditPromotion.immutableGovernanceBaseline,
        runtimeStatus: privacyAnalyticsAuditPromotion.runtimeStatus,
        scope: privacyAnalyticsAuditPromotion.scope,
      }
      : useM1016Promotion
      ? {
        id: notificationSyncSupportPromotion.id,
        sourceContractBaseline: notificationSyncSupportSourceContractBaseline.commit,
        previousPromotion: commercePromotion?.id ?? M1015_COMMERCE_PROMOTION_ID,
        previousPromotionSource: commercePromotion
          ? (commerceSourceContractBaseline?.commit ?? M1015_SOURCE_CONTRACT_BASELINE_REF)
          : M1015_SOURCE_CONTRACT_BASELINE_REF,
        immutableGovernanceBaseline: notificationSyncSupportPromotion.immutableGovernanceBaseline,
        runtimeStatus: notificationSyncSupportPromotion.runtimeStatus,
        scope: notificationSyncSupportPromotion.scope,
      }
      : useM1015Promotion
      ? {
        id: commercePromotion.id,
        sourceContractBaseline: commerceSourceContractBaseline.commit,
        previousPromotion: gamificationSocialPromotion.id,
        previousPromotionSource: gamificationSocialSourceContractBaseline.commit,
        immutableGovernanceBaseline: commercePromotion.immutableGovernanceBaseline,
        runtimeStatus: commercePromotion.runtimeStatus,
        scope: commercePromotion.scope,
      }
      : useM1014Promotion
      ? {
        id: gamificationSocialPromotion.id,
        sourceContractBaseline: gamificationSocialSourceContractBaseline.commit,
        previousPromotion: learningLoopPromotion.id,
        previousPromotionSource: learningLoopSourceContractBaseline.commit,
        immutableGovernanceBaseline: gamificationSocialPromotion.immutableGovernanceBaseline,
        runtimeStatus: gamificationSocialPromotion.runtimeStatus,
        scope: gamificationSocialPromotion.scope,
      }
      : useM1013Promotion
      ? {
        id: learningLoopPromotion.id,
        sourceContractBaseline: learningLoopSourceContractBaseline.commit,
        previousPromotion: placementPromotion.id,
        previousPromotionSource: placementSourceContractBaseline.commit,
        immutableGovernanceBaseline: learningLoopPromotion.immutableGovernanceBaseline,
        runtimeStatus: learningLoopPromotion.runtimeStatus,
        scope: learningLoopPromotion.scope,
      }
      : useM1012Promotion
      ? {
        id: placementPromotion.id,
        sourceContractBaseline: placementSourceContractBaseline.commit,
        previousPromotion: learnerPlanningPromotion.id,
        previousPromotionSource: learnerPlanningSourceContractBaseline.commit,
        immutableGovernanceBaseline: placementPromotion.immutableGovernanceBaseline,
        runtimeStatus: placementPromotion.runtimeStatus,
        scope: placementPromotion.scope,
      }
      : useM1011Promotion
      ? {
        id: learnerPlanningPromotion.id,
        sourceContractBaseline: learnerPlanningSourceContractBaseline.commit,
        previousPromotion: assessmentPromotion.id,
        previousPromotionSource: assessmentSourceContractBaseline.commit,
        runtimeStatus: learnerPlanningPromotion.runtimeStatus,
        scope: learnerPlanningPromotion.scope,
      }
      : useM1010Promotion
      ? {
        id: assessmentPromotion.id,
        sourceContractBaseline: assessmentSourceContractBaseline.commit,
        previousPromotion: mediaPromotion.id,
        previousPromotionSource: mediaSourceContractBaseline.commit,
        runtimeStatus: assessmentPromotion.runtimeStatus,
        scope: 'explicit-openapi-and-historical-event-payloads',
      }
      : useM1009Promotion
      ? {
        id: mediaPromotion.id,
        sourceContractBaseline: mediaSourceContractBaseline.commit,
        previousPromotion: promotion.id,
        previousPromotionSource: sourceContractBaseline.commit,
        runtimeStatus: mediaPromotion.runtimeStatus,
        scope: 'explicit-openapi-only',
      }
      : useM1008Promotion
        ? {
          id: promotion.id,
          sourceContractBaseline: sourceContractBaseline.commit,
          immutableGovernanceBaseline: promotion.immutableGovernanceBaseline,
          scope: 'explicit-additive-only',
        }
        : undefined,
    results,
    compatible: results.every((result) => result.compatible),
  };
}

function printHelp() {
  console.log(`Usage: node scripts/contracts/compatibility-git-baseline.mjs --ref <older-commit> [--governance-ref ${REQUIRED_EVENT_GOVERNANCE_BASELINE_REF}] [--kind all|openapi|events|schema] [--json]`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = runGitBaselineCompatibility(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      if (result.governanceBaseline) {
        console.log(`Git-baseline immutable governance freeze: ${result.governanceBaseline.ref} (${result.governanceBaseline.scope}; ${result.governanceBaseline.runtimeStatus}).`);
      }
      for (const item of result.results) {
        console.log(`Git-baseline compatibility ${item.compatible ? 'passed' : 'failed'}: ${item.kind}, ${item.breakingChanges.length} breaking change(s).`);
      }
    }
    if (!result.compatible) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
