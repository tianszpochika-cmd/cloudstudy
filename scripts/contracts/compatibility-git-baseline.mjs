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
  buildM1008PromotionExpectedCatalog,
  compareB26WorkflowGovernance,
  compareContracts,
  hasEventGovernance,
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

export const REQUIRED_CI_CONTRACT_BASELINE_REF = '463c4b238caceb1592bff6c61327c00ab9bac922';
export const REQUIRED_EVENT_GOVERNANCE_BASELINE_REF = '868c2177f62b6d2cf613bed702686dddcfe6943f';
export const REQUIRED_M1008_SOURCE_CONTRACT_BASELINE_REF = M1008_SOURCE_CONTRACT_BASELINE_REF;
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

function parseArgs(argv) {
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
  const needsM1008Promotion = selectedKinds.some((contractKind) => contractKind === 'events' || contractKind === 'openapi');
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
    if (contractKind === 'openapi' && useM1008Promotion) {
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

  if (baselineCommit === currentCommit && comparisons.every((comparison) => comparison.identical)) {
    throw new Error(
      `Compatibility baseline ${ref} resolves to the current HEAD and every selected contract is identical; choose an older accepted commit.`,
    );
  }
  const results = comparisons.map((comparison) => comparison.result);

  return {
    ref,
    baselineCommit,
    currentCommit,
    governanceBaseline: governanceSummary,
    promotion: useM1008Promotion
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
