import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  M1018_IAM_CANONICAL_EVENT_GOVERNANCE,
  M1018_IAM_EVENT_FRAGMENT_PATH,
  M1018_IAM_GAP_D2_CLOSURE_TASKS,
} from '../contracts/event-catalog-policy.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(MODULE_PATH), '..', '..');
const POLICY_RELATIVE_PATH = 'config/p1r-m1-018-d2-total-gate.v1.json';
const SHA40 = /^[0-9a-f]{40}$/i;
const EXPECTED_SOURCE_CHECKPOINT = '97497afe1f31703601d1491c8d47d00121c90089';
const EXPECTED_TASK_START_COMMIT = '0b6b80038dbbf43e8d218750fcb39f49970703bb';
const EXPECTED_CONTRACT_BASELINE = '463c4b238caceb1592bff6c61327c00ab9bac922';
const EXPECTED_GOVERNANCE_BASELINE = '868c2177f62b6d2cf613bed702686dddcfe6943f';

export const EXPECTED_CONTRACT_GAPS = Object.freeze([
  'CONTRACT-GAP-ADM-001', 'CONTRACT-GAP-ADMIN-CONTENT-BOUNDARY', 'CONTRACT-GAP-ANL-001',
  'CONTRACT-GAP-COM-001', 'CONTRACT-GAP-CONTENT-SCHEDULE', 'CONTRACT-GAP-GAM-001',
  'CONTRACT-GAP-INF-001', 'CONTRACT-GAP-INF-002', 'CONTRACT-GAP-LRN-001',
  'CONTRACT-GAP-MEDIA-PROCESSING', 'CONTRACT-GAP-ONB-001', 'CONTRACT-GAP-ONB-002',
  'CONTRACT-GAP-PLACEMENT-MANIFEST', 'CONTRACT-GAP-PLAN-EXPLAIN',
  'CONTRACT-GAP-PRIVACY-DELETION', 'CONTRACT-GAP-PRIVACY-EXPORT', 'CONTRACT-GAP-RBAC-ADMIN',
  'CONTRACT-GAP-REP-001', 'CONTRACT-GAP-REPAIR-VARIANT', 'CONTRACT-GAP-REPORT-WATERMARK',
  'CONTRACT-GAP-SPK-001', 'CONTRACT-GAP-SRS-OUTCOME', 'CONTRACT-GAP-SUPPORT-ROUTING',
  'CONTRACT-GAP-USR-DEL-001',
]);
export const EXPECTED_ATOMIC_EVENT_GAPS = Object.freeze([
  'EVENT-GAP-IAM-001', 'EVENT-GAP-BIND-IAM-001', 'EVENT-GAP-BIND-IAM-002',
  'EVENT-GAP-ONB-001', 'EVENT-GAP-ONB-002', 'EVENT-GAP-PLACEMENT-PLAN',
  'EVENT-GAP-CONTENT-DUPLICATE', 'EVENT-GAP-BIND-CONT-001', 'EVENT-GAP-BIND-ASM-001',
  'EVENT-GAP-BIND-LRN-001', 'EVENT-GAP-BIND-GAM-001', 'EVENT-GAP-BIND-SOC-001',
  'EVENT-GAP-BIND-NOTIF-001', 'EVENT-GAP-BIND-PRIV-001', 'EVENT-GAP-USR-DEL-001',
]);
export const EVENT_GAP_ALIAS = 'EVENT-GAP-BIND';
export const EXPECTED_COUNTS = Object.freeze({ contract: 24, atomicEvent: 15, eventAlias: 1, eventRecords: 16 });

const EXPECTED_IMPLEMENTATION_GAPS = Object.freeze(['IMPLEMENTATION-GAP-PLAN-SCHEDULER', 'IMPLEMENTATION-GAP-MASTERY-D7']);
const EXPECTED_EVIDENCE_GAPS = Object.freeze(['EVIDENCE-GAP-LEARNING-LOOP', 'EVIDENCE-GAP-ADMIN-PUBLISH', 'EVIDENCE-GAP-SUPPORT-PRIVACY']);
const EXPECTED_GAP_IDS = Object.freeze([...EXPECTED_CONTRACT_GAPS, ...EXPECTED_ATOMIC_EVENT_GAPS, EVENT_GAP_ALIAS, ...EXPECTED_IMPLEMENTATION_GAPS, ...EXPECTED_EVIDENCE_GAPS]);
const IAM_HISTORICAL_EVENT_NAMES = Object.freeze([
  'auth.account.registered.v1', 'auth.login.succeeded.v1', 'auth.principal.mapped.v1',
  'auth.session.rotated.v1', 'auth.session.replay_detected.v1', 'auth.device.revoked.v1',
  'iam.session.revoked.v1', 'auth.consent.updated.v1', 'auth.adult_gate.rejected.v1',
  'iam.policy.version_changed.v1',
]);

const CLOSURE_TASKS = Object.freeze({
  'CONTRACT-GAP-ADM-001': ['P1R-M1-008'],
  'CONTRACT-GAP-ADMIN-CONTENT-BOUNDARY': ['P1R-M1-008'],
  'CONTRACT-GAP-ANL-001': ['P1R-M1-017'],
  'CONTRACT-GAP-COM-001': ['P1R-M1-015'],
  'CONTRACT-GAP-CONTENT-SCHEDULE': ['P1R-M1-008'],
  'CONTRACT-GAP-GAM-001': ['P1R-M1-014'],
  'CONTRACT-GAP-INF-001': ['P1R-M1-016'],
  'CONTRACT-GAP-INF-002': ['P1R-M1-016'],
  'CONTRACT-GAP-LRN-001': ['P1R-M1-013'],
  'CONTRACT-GAP-MEDIA-PROCESSING': ['P1R-M1-009'],
  'CONTRACT-GAP-ONB-001': ['P1R-M1-011'],
  'CONTRACT-GAP-ONB-002': ['P1R-M1-012'],
  'CONTRACT-GAP-PLACEMENT-MANIFEST': ['P1R-M1-012'],
  'CONTRACT-GAP-PLAN-EXPLAIN': ['P1R-M1-013'],
  'CONTRACT-GAP-PRIVACY-DELETION': ['P1R-M1-017'],
  'CONTRACT-GAP-PRIVACY-EXPORT': ['P1R-M1-017'],
  'CONTRACT-GAP-RBAC-ADMIN': ['P1R-M1-003'],
  'CONTRACT-GAP-REP-001': ['P1R-M1-013'],
  'CONTRACT-GAP-REPAIR-VARIANT': ['P1R-M1-013'],
  'CONTRACT-GAP-REPORT-WATERMARK': ['P1R-M1-013'],
  'CONTRACT-GAP-SPK-001': ['P1R-M1-009'],
  'CONTRACT-GAP-SRS-OUTCOME': ['P1R-M1-013'],
  'CONTRACT-GAP-SUPPORT-ROUTING': ['P1R-M1-016'],
  'CONTRACT-GAP-USR-DEL-001': ['P1R-M1-017'],
  'EVENT-GAP-IAM-001': [...M1018_IAM_GAP_D2_CLOSURE_TASKS['EVENT-GAP-IAM-001']],
  'EVENT-GAP-BIND-IAM-001': [...M1018_IAM_GAP_D2_CLOSURE_TASKS['EVENT-GAP-BIND-IAM-001']],
  'EVENT-GAP-BIND-IAM-002': [...M1018_IAM_GAP_D2_CLOSURE_TASKS['EVENT-GAP-BIND-IAM-002']],
  'EVENT-GAP-ONB-001': ['P1R-M1-006', 'P1R-M1-011'],
  'EVENT-GAP-ONB-002': ['P1R-M1-006', 'P1R-M1-012'],
  'EVENT-GAP-PLACEMENT-PLAN': ['P1R-M1-006', 'P1R-M1-012'],
  'EVENT-GAP-CONTENT-DUPLICATE': ['P1R-M1-006', 'P1R-M1-008'],
  'EVENT-GAP-BIND-CONT-001': ['P1R-M1-006', 'P1R-M1-008'],
  'EVENT-GAP-BIND-ASM-001': ['P1R-M1-006', 'P1R-M1-010', 'P1R-M1-013'],
  'EVENT-GAP-BIND-LRN-001': ['P1R-M1-006', 'P1R-M1-013'],
  'EVENT-GAP-BIND-GAM-001': ['P1R-M1-006', 'P1R-M1-014'],
  'EVENT-GAP-BIND-SOC-001': ['P1R-M1-006', 'P1R-M1-014'],
  'EVENT-GAP-BIND-NOTIF-001': ['P1R-M1-006', 'P1R-M1-016'],
  'EVENT-GAP-BIND-PRIV-001': ['P1R-M1-006', 'P1R-M1-017'],
  'EVENT-GAP-USR-DEL-001': ['P1R-M1-006', 'P1R-M1-017'],
  [EVENT_GAP_ALIAS]: ['P1R-M1-006', 'P1R-M1-018'],
  'IMPLEMENTATION-GAP-PLAN-SCHEDULER': ['P1R-M4-007'],
  'IMPLEMENTATION-GAP-MASTERY-D7': ['P1R-M5-010'],
  'EVIDENCE-GAP-LEARNING-LOOP': ['P1R-M8-003', 'P1R-M8-004'],
  'EVIDENCE-GAP-ADMIN-PUBLISH': ['P1R-M8-002'],
  'EVIDENCE-GAP-SUPPORT-PRIVACY': ['P1R-M8-006'],
});

const EXPECTED_IAM_EVENT_NAMES = Object.freeze(Object.keys(M1018_IAM_CANONICAL_EVENT_GOVERNANCE));
const EXPECTED_IAM_FRAGMENT_EVENT_NAMES = Object.freeze([
  'iam.account.bootstrap.created.v2',
  'iam.learning_eligibility.changed.v2',
  'iam.policy.security_state_changed.v2',
]);
const EXPECTED_IAM_PAYLOAD_SCHEMA_NAMES = Object.freeze([
  'M1018IamAccountBootstrapCreated',
  'M1018IamLearningEligibilityChanged',
  'M1018IamPolicySecurityStateChanged',
]);
const REQUIRED_EVENT_ENVELOPE = Object.freeze([
  'eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType',
  'aggregateId', 'actorId', 'traceId', 'requestId', 'schemaVersion', 'dedupeKey', 'payload',
]);
const EVENT_GAP_FAMILIES = Object.freeze({
  'EVENT-GAP-IAM-001': 'EVENT-GAP-IAM',
  'EVENT-GAP-BIND-IAM-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-IAM-002': 'EVENT-GAP-BIND',
  'EVENT-GAP-ONB-001': 'EVENT-GAP-ONB',
  'EVENT-GAP-ONB-002': 'EVENT-GAP-ONB',
  'EVENT-GAP-PLACEMENT-PLAN': 'EVENT-GAP-PLACEMENT',
  'EVENT-GAP-CONTENT-DUPLICATE': 'EVENT-GAP-CONTENT',
  'EVENT-GAP-BIND-CONT-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-ASM-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-LRN-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-GAM-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-SOC-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-NOTIF-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-PRIV-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-USR-DEL-001': 'EVENT-GAP-USR-DEL',
  [EVENT_GAP_ALIAS]: 'EVENT-GAP-BIND',
});
const EXPECTED_CANONICAL_INPUTS = Object.freeze({
  traceabilityMatrix: 'requirements/backlog/v2-phase1-rebaseline/04-追溯覆盖矩阵.md',
  gapRegistry: 'config/p1r-gap-registry.v1.json',
  eventCatalog: 'packages/contracts/events/v1/catalog.json',
  dataOwnershipPolicy: 'config/p1r-data-ownership.v1.json',
  apiContract: 'packages/contracts/openapi/v1/openapi.json',
  schemaRegistry: 'packages/contracts/schemas/v1/registry.json',
  generatedOpenApi: 'packages/contracts/generated/openapi.ts',
  generatedEvents: 'packages/contracts/generated/events.ts',
  reliabilityPolicy: 'packages/contracts/events/v1/reliability-policy.json',
  iamEventFragment: M1018_IAM_EVENT_FRAGMENT_PATH,
  b26Runtime: 'config/b26-event-runtime.json',
  g0Scope: 'config/g0-scope-governance.json',
  g3Security: 'config/g3-test-security-observability.json',
  taskLedger: 'requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md',
  m0_006: 'evidence/p1r/m0/P1R-M0-006/manifest.json',
});
const EXPECTED_IAM_EVENT_DECISION = Object.freeze({
  required: true,
  decision: 'MINIMAL_CANONICAL_V2',
  canonicalEventNames: [...EXPECTED_IAM_EVENT_NAMES],
  source: 'scripts/contracts/event-catalog-policy.mjs#M1018_IAM_CANONICAL_EVENT_GOVERNANCE',
  historicalV1MustRemainCandidate: true,
  sourceMustNameDecision: true,
  crossServiceFactRequires: ['canonicalEvent', 'producer', 'consumer', 'topic', 'partitionKey', 'payloadSchema'],
});
const EXPECTED_MODES = Object.freeze({
  review: Object.freeze({
    resultWhenBlocked: 'REWORK',
    allowTargetRegistryStatus: 'OPEN',
    allowTargetClosureEvidence: null,
    requireOwnerTasksAccepted: true,
    allowInProgressTask: 'P1R-M1-018',
    allowAliasRegistryStatus: 'OPEN',
    allowAliasCatalogStatus: 'D2_CONTRACT_CLOSED',
  }),
  final: Object.freeze({
    resultWhenBlocked: 'FAIL',
    requireTaskAccepted: 'P1R-M1-018',
    allowInProgressTask: null,
    requireTargetRegistryStatus: 'CLOSED',
    requireTargetCanonicalEvidence: true,
    requireAliasRegistryStatus: 'CLOSED',
    requireAliasCatalogStatus: 'D2_CONTRACT_CLOSED',
  }),
});
const EXPECTED_RUNTIME_BOUNDARY = Object.freeze({
  catalogMaturity: 'D2_CONTRACT_READY',
  catalogRuntimeStatus: 'NOT_RUNTIME_VERIFIED',
  b26: Object.freeze({ mode: 'static-only', runtimeStatus: 'pending', defaultDecision: 'NO-GO' }),
  g0: Object.freeze({ defaultDecision: 'BLOCKED' }),
  g3: Object.freeze({ runtimeDecision: 'BLOCKED', defaultDecision: 'NO-GO' }),
  m0_006: Object.freeze({ taskId: 'P1R-M0-006', status: 'BLOCKED', decision: 'BLOCKED' }),
  forbiddenPromotion: ['GO', 'PASS', 'ACCEPTED', 'RUNTIME_VERIFIED', 'PRODUCTION_READY'],
});
const EXPECTED_PROHIBITIONS = Object.freeze([
  'historical-v1-event-promotion',
  'dual-publish-v1-and-v2',
  'client-event-producer',
  'runtime-status-promotion',
  'b26-go',
  'm0-006-blocker-wash',
  'alias-counted-as-atomic-event',
  'closure-without-owner',
  'closure-without-canonical-evidence',
  'no-static-check-bypass',
]);
const DEFAULT_STATIC_CHECK_TIMEOUT_MS = 180_000;
const LONG_RUNNING_STATIC_CHECK_TIMEOUT_MS = 600_000;
const EXPECTED_STATIC_CHECKS = Object.freeze([
  { id: 'api-contract', owner: 'contract-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-api-contract-check.mjs'] },
  { id: 'auth-contract', owner: 'iam-service', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-auth-contract-check.mjs'] },
  { id: 'iam-policy', owner: 'iam-service', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-iam-policy-contract-check.mjs'] },
  { id: 'gateway-contract', owner: 'api-gateway', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-gateway-contract-check.mjs'] },
  { id: 'data-ownership', owner: 'data-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-data-ownership-check.mjs', '--json'] },
  { id: 'event-governance', owner: 'event-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-event-governance-check.mjs', '--json'] },
  { id: 'event-reliability', owner: 'workflow-service', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-event-reliability-check.mjs', '--json'] },
  { id: 'saga-recovery', owner: 'workflow-service', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/p1r-saga-recovery-check.mjs', '--json'] },
  { id: 'domain-contracts', owner: 'domain-owners', timeoutMs: LONG_RUNNING_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/dev/run-node-tests.mjs', 'tests/p1r'] },
  { id: 'contract-tooling', owner: 'contract-governance', timeoutMs: LONG_RUNNING_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/dev/run-node-tests.mjs', 'tests/p1r/p1r-contract-tooling.test.mjs'] },
  { id: 'compatibility', owner: 'contract-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/contracts/compatibility-git-baseline.mjs', '--ref', EXPECTED_CONTRACT_BASELINE, '--governance-ref', EXPECTED_GOVERNANCE_BASELINE, '--kind', 'all', '--json'] },
  { id: 'generated-types', owner: 'contract-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/contracts/generate-contracts.mjs', '--check'] },
  { id: 'migration-policy', owner: 'data-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/database/validate-migrations.mjs'] },
  { id: 'plan-and-evidence', owner: 'qa-governance', timeoutMs: DEFAULT_STATIC_CHECK_TIMEOUT_MS, argv: ['scripts/audit/verify-phase1-rebaseline-plan.mjs'] },
]);

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function add(errors, condition, message) { if (!condition) errors.push(message); }
function sorted(value) { return [...(value ?? [])].sort(); }
function sameArray(actual, expected) { return JSON.stringify(actual ?? []) === JSON.stringify(expected ?? []); }
function sameSet(actual, expected) { return sameArray(sorted(actual), sorted(expected)); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}
function stableJson(value) { return JSON.stringify(stableValue(value)); }
function exactValue(errors, actual, expected, message) { add(errors, stableJson(actual) === stableJson(expected), message); }
function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function parseM1018Matrix(markdown) {
  const text = typeof markdown === 'string' ? markdown : '';
  const section = text.match(/^## 8[.、 ]+GAP[\s\S]*?(?=^## 9[.、 ]|\Z)/m)?.[0] ?? text;
  const byId = {};
  const seenIds = new Set();
  const duplicates = [];
  for (const line of section.split(/\r?\n/u)) {
    const row = line.match(/^\|\s*`([^`]+)`[^|]*\|([^|]*)\|/u);
    if (!row) continue;
    const id = row[1].trim();
    if (!/^(?:CONTRACT|EVENT|IMPLEMENTATION|EVIDENCE)-GAP-(?:[A-Z0-9-]+|BIND)$/u.test(id)) continue;
    if (seenIds.has(id)) duplicates.push(id);
    seenIds.add(id);
    byId[id] = [];
    for (const match of row[2].matchAll(/\b(?:P1R-)?(M\d)-(\d{3}(?:\/\d{3})*)\b/gu)) {
      for (const taskNumber of match[2].split('/')) byId[id].push(`P1R-${match[1]}-${taskNumber}`);
    }
  }
  return { ids: Object.keys(byId), closureTasks: byId, duplicates };
}

function normalizeMatrix(input, errors = []) {
  if (typeof input === 'string') return parseM1018Matrix(input);
  if (isRecord(input?.matrix)) return normalizeMatrix(input.matrix, errors);
  if (isRecord(input)) {
    const closureTasks = input.closureTasks ?? input.gapClosureTasks ?? input.byId;
    if (isRecord(closureTasks)) {
      const ids = input.ids ?? Object.keys(closureTasks);
      for (const id of duplicateValues(ids)) errors.push(`traceability matrix duplicates GAP ID ${id}`);
      return { ids, closureTasks, duplicates: input.duplicates ?? [] };
    }
    if (Array.isArray(input.ids)) return { ids: input.ids, closureTasks: {} };
  }
  return { ids: [], closureTasks: {} };
}

function normalizeTasks(input, errors = []) {
  const source = input?.tasks ?? input;
  const entries = Array.isArray(source)
    ? source.map((task) => [task?.id ?? task?.taskId, task])
    : isRecord(source) ? Object.entries(source).map(([id, task]) => [task?.id ?? task?.taskId ?? id, task]) : [];
  const result = new Map();
  for (const [id, task] of entries) {
    if (!nonEmpty(id) || !isRecord(task)) {
      errors.push('task input contains a missing id or non-object task');
      continue;
    }
    if (result.has(id)) errors.push(`task input duplicates ${id}`);
    result.set(id, task);
  }
  if (!Array.isArray(source) && !isRecord(source)) errors.push('task input must be an array or object');
  return result;
}

function normalizeManifests(input, errors = []) {
  const source = input?.manifests ?? input?.canonicalManifests ?? input;
  const entries = Array.isArray(source)
    ? source.map((item) => [item?.path ?? item?.manifestPath ?? item?.taskId, item?.manifest ?? item])
    : isRecord(source) ? Object.entries(source).map(([key, value]) => [key, value?.manifest ?? value]) : [];
  const result = new Map();
  const primaryKeys = new Set();
  for (const [key, value] of entries) {
    if (!isRecord(value)) {
      errors.push('manifest input contains a non-object manifest');
      continue;
    }
    const primaryKey = nonEmpty(key) ? String(key).replaceAll('\\', '/') : value.manifestPath ?? value.taskId;
    if (!nonEmpty(primaryKey)) {
      errors.push('manifest input contains a missing path and taskId');
    } else if (primaryKeys.has(primaryKey)) {
      errors.push(`manifest input duplicates ${primaryKey}`);
    } else {
      primaryKeys.add(primaryKey);
    }
    const aliases = [];
    if (nonEmpty(key)) aliases.push(String(key).replaceAll('\\', '/'));
    if (nonEmpty(value.taskId)) aliases.push(value.taskId);
    if (nonEmpty(value.manifestPath)) aliases.push(String(value.manifestPath).replaceAll('\\', '/'));
    for (const alias of aliases) {
      const previous = result.get(alias);
      if (previous && stableJson(previous) !== stableJson(value)) errors.push(`manifest input alias ${alias} maps to conflicting manifests`);
      result.set(alias, value);
    }
  }
  return result;
}

function findManifest(manifests, evidencePath, taskId) {
  const normalized = String(evidencePath ?? '').replaceAll('\\', '/');
  return manifests.get(normalized) ?? manifests.get(taskId) ?? manifests.get(path.basename(path.dirname(normalized))) ?? null;
}

function checkPolicy(policy, errors) {
  add(errors, isRecord(policy), 'M1-018 total-gate policy must be an object');
  if (!isRecord(policy)) return;
  add(errors, policy.$schema === 'https://json-schema.org/draft/2020-12/schema', 'M1-018 total-gate policy schema dialect drifted');
  add(errors, policy.schemaVersion === 'p1r.m1-018.d2-total-gate.v1', 'M1-018 total-gate policy schemaVersion drifted');
  add(errors, policy.taskId === 'P1R-M1-018', 'M1-018 total-gate policy taskId drifted');
  add(errors, policy.phase === 'P1', 'M1-018 total-gate policy must be Phase 1');
  add(errors, policy.maturity === 'D2_CONTRACT_READY', 'M1-018 total-gate policy maturity must remain D2_CONTRACT_READY');
  add(errors, policy.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'M1-018 total-gate policy must remain NOT_RUNTIME_VERIFIED');
  add(errors, policy.sourceCheckpoint === EXPECTED_SOURCE_CHECKPOINT, 'M1-018 sourceCheckpoint must remain the immutable M1-017 integration checkpoint');
  add(errors, policy.taskStartCommit === EXPECTED_TASK_START_COMMIT, 'M1-018 taskStartCommit must remain the immutable task start commit');
  exactValue(errors, policy.fixedCompatibility, {
    acceptedContractBaseline: EXPECTED_CONTRACT_BASELINE,
    immutableGovernanceBaseline: EXPECTED_GOVERNANCE_BASELINE,
  }, 'fixed compatibility baselines drifted');
  add(errors, sameArray(policy.contractGapIds, EXPECTED_CONTRACT_GAPS), 'policy Contract GAP set/order must be exact');
  add(errors, sameArray(policy.atomicEventGapIds, EXPECTED_ATOMIC_EVENT_GAPS), 'policy atomic Event GAP set/order must be exact');
  add(errors, policy.eventGapAlias === EVENT_GAP_ALIAS, 'policy EVENT-GAP alias drifted');
  exactValue(errors, policy.expectedCounts, {
    contractGaps: 24,
    atomicEventGaps: 15,
    eventGapAlias: 1,
    eventGapRecords: 16,
    implementationGaps: 2,
    evidenceGaps: 3,
  }, 'policy GAP counts must be exactly Contract=24/Event=15/alias=1/records=16');
  exactValue(errors, policy.canonicalInputs, EXPECTED_CANONICAL_INPUTS, 'canonical input paths must be the fixed M1-018 source set');
  exactValue(errors, policy.modes, EXPECTED_MODES, 'M1-018 review/final mode policy drifted');
  exactValue(errors, policy.iamEventDecision, EXPECTED_IAM_EVENT_DECISION, 'IAM event decision must bind the exact M1-018 canonical source decision');
  exactValue(errors, policy.runtimeBoundary, EXPECTED_RUNTIME_BOUNDARY, 'M1-018 runtime boundary policy drifted');
  exactValue(errors, policy.prohibitions, EXPECTED_PROHIBITIONS, 'M1-018 prohibitions must be exact and include no static-check bypass');
  exactValue(errors, policy.requiredStaticChecks, EXPECTED_STATIC_CHECKS, 'required static checker command set/owners must be exact');
}

function checkMatrix(matrixInput, policy, errors) {
  const matrix = normalizeMatrix(matrixInput, errors);
  for (const id of matrix.duplicates ?? []) errors.push(`traceability matrix duplicates GAP ID ${id}`);
  const expectedIds = [...EXPECTED_GAP_IDS];
  add(errors, duplicateValues(matrix.ids ?? []).length === 0, 'traceability matrix GAP IDs must be unique');
  add(errors, sameSet(matrix.ids, expectedIds), 'traceability matrix must contain the exact 45 GAP IDs');
  for (const id of expectedIds) {
    const actual = matrix.closureTasks?.[id] ?? [];
    const expected = CLOSURE_TASKS[id] ?? [];
    add(errors, duplicateValues(actual).length === 0, `traceability matrix closure owner list duplicates a task for ${id}`);
    add(errors, sameSet(actual, expected), `traceability matrix closure owner drifted for ${id}`);
  }
  add(errors, sameArray(policy.contractGapIds, EXPECTED_CONTRACT_GAPS), 'matrix Contract GAP projection does not match policy');
  add(errors, sameArray(policy.atomicEventGapIds, EXPECTED_ATOMIC_EVENT_GAPS), 'matrix atomic Event GAP projection does not match policy');
  return matrix;
}

function checkRegistry(registry, matrix, tasks, manifests, mode, policy, errors) {
  add(errors, isRecord(registry) && Array.isArray(registry.gaps), 'GAP registry must contain gaps');
  if (!isRecord(registry) || !Array.isArray(registry.gaps)) return new Map();
  const records = registry.gaps;
  const byId = new Map();
  for (const record of records) {
    if (isRecord(record) && nonEmpty(record.id)) {
      add(errors, !byId.has(record.id), `GAP registry duplicates ${record.id}`);
      byId.set(record.id, record);
    }
  }
  add(errors, records.length === 45, `GAP registry must contain exactly 45 records, got ${records.length}`);
  add(errors, sameSet([...byId.keys()], EXPECTED_GAP_IDS), 'GAP registry IDs must match the exact M1 registry set');
  add(errors, registry.expectedCounts?.CONTRACT === 24 && registry.expectedCounts?.EVENT === 16 && registry.expectedCounts?.IMPLEMENTATION === 2 && registry.expectedCounts?.EVIDENCE === 3 && registry.expectedCounts?.TOTAL === 45, 'GAP registry expectedCounts must retain 24/16/2/3/45 (alias is inside Event records)');

  for (const id of EXPECTED_GAP_IDS) {
    const record = byId.get(id);
    if (!record) continue;
    const expectedKind = id.startsWith('CONTRACT-') ? 'CONTRACT' : id.startsWith('EVENT-') ? 'EVENT' : id.startsWith('IMPLEMENTATION-') ? 'IMPLEMENTATION' : 'EVIDENCE';
    add(errors, record.kind === expectedKind, `${id} registry kind is incorrect`);
    const expectedTasks = CLOSURE_TASKS[id] ?? [];
    const actualTasks = record.closureTasks ?? [];
    const target = EXPECTED_CONTRACT_GAPS.includes(id) || EXPECTED_ATOMIC_EVENT_GAPS.includes(id) || id === EVENT_GAP_ALIAS;
    add(errors, Array.isArray(actualTasks), `${id} registry closureTasks must be an array`);
    add(errors, duplicateValues(actualTasks).length === 0, `${id} registry closureTasks must not contain duplicates`);
    add(errors, sameSet(actualTasks, expectedTasks), `${id} registry closureTasks do not match matrix owner task mapping`);
    for (const taskId of actualTasks) {
      const task = tasks.get(taskId);
      add(errors, isRecord(task), `${id} references missing owner task ${taskId}`);
      if (isRecord(task) && target) {
        const modePolicy = EXPECTED_MODES[mode];
        const accepted = task.status === 'ACCEPTED';
        const reviewInProgress = mode === 'review'
          && modePolicy?.allowInProgressTask === taskId
          && task.status === 'IN_PROGRESS';
        add(errors, accepted || reviewInProgress, `${id} owner task ${taskId} must be ACCEPTED before ${mode} gate${reviewInProgress ? '' : ' (review may leave only P1R-M1-018 IN_PROGRESS)'}`);
      }
    }
    if (target) {
      const reviewOpen = mode === 'review' && record.status === 'OPEN';
      const reviewClosed = mode === 'review' && record.status === 'CLOSED';
      const finalClosed = mode === 'final' && record.status === 'CLOSED';
      add(errors, reviewOpen || reviewClosed || finalClosed, `${id} registry status is invalid for ${mode} mode`);
      if (reviewOpen) add(errors, record.closureEvidence === null, `${id} review record must not carry closure evidence`);
      if (reviewClosed || finalClosed) {
        add(errors, nonEmpty(record.closureEvidence), `${id} closed record needs canonical Evidence`);
        if (nonEmpty(record.closureEvidence)) {
          add(errors, /^evidence\/p1r\/[^/]+\/P1R-M\d-\d{3}\/manifest\.json$/u.test(record.closureEvidence), `${id} closureEvidence must be a canonical manifest path`);
          const evidenceTaskId = String(record.closureEvidence).match(/\/(P1R-M\d-\d{3})\/manifest\.json$/u)?.[1];
          add(errors, actualTasks.includes(evidenceTaskId), `${id} closureEvidence must belong to one of its owner tasks`);
          const manifest = findManifest(manifests, record.closureEvidence, evidenceTaskId);
          add(errors, isRecord(manifest), `${id} closureEvidence manifest is missing or fake`);
          if (isRecord(manifest)) {
            add(errors, manifest.taskId === evidenceTaskId && manifest.canonicalTaskStatus === 'ACCEPTED' && manifest.decision === 'ACCEPTED', `${id} closureEvidence manifest must be an ACCEPTED canonical manifest`);
            add(errors, nonEmpty(manifest.reviewer), `${id} closureEvidence manifest needs an independent reviewer`);
            add(errors, SHA40.test(manifest.sourceCommit ?? ''), `${id} closureEvidence manifest sourceCommit must be immutable SHA`);
            add(errors, Array.isArray(manifest.sourceIds) && manifest.sourceIds.includes(id), `${id} closureEvidence manifest must name the closed GAP`);
            const actors = Array.isArray(manifest.actors) ? manifest.actors : manifest.executionOwners;
            add(errors, !Array.isArray(actors) || !actors.includes(manifest.reviewer), `${id} closureEvidence reviewer must be independent from actors`);
          }
        }
      }
    } else {
      add(errors, record.status === 'OPEN' && record.closureEvidence === null, `${id} non-M1 target GAP must remain OPEN with no closure evidence`);
    }
  }
  add(errors, policy.expectedCounts?.atomicEventGaps === EXPECTED_ATOMIC_EVENT_GAPS.length, 'atomic Event count must exclude the alias');
  return byId;
}

function pick(value, keys) {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(value ?? {}, key)).map((key) => [key, value[key]]));
}

function checkIamCanonicalSource({ catalog, iamFragment }, errors) {
  add(errors, isRecord(iamFragment), 'M1-018 IAM event fragment must be loaded from the fixed canonical input');
  if (!isRecord(iamFragment)) return;
  exactValue(errors, Object.keys(iamFragment), ['version', 'events', 'payloadSchemas'], 'M1-018 IAM fragment root keys drifted');
  const fragmentEvents = Array.isArray(iamFragment.events) ? iamFragment.events : [];
  const fragmentNames = fragmentEvents.map((event) => event?.eventName);
  add(errors, duplicateValues(fragmentNames).length === 0, 'M1-018 IAM fragment must not duplicate event names');
  add(errors, sameArray(fragmentNames, EXPECTED_IAM_FRAGMENT_EVENT_NAMES), 'M1-018 IAM fragment event set/order must be exact');
  const fragmentSchemas = isRecord(iamFragment.payloadSchemas) ? iamFragment.payloadSchemas : {};
  add(errors, sameArray(Object.keys(fragmentSchemas), EXPECTED_IAM_PAYLOAD_SCHEMA_NAMES), 'M1-018 IAM fragment payload schema set/order must be exact');
  for (const event of fragmentEvents) {
    add(errors, event?.status === undefined && event?.['x-p1r-governance'] === undefined, `${event?.eventName ?? 'IAM fragment event'} must not carry catalog-owned status/governance`);
    add(errors, sameArray(Object.keys(event ?? {}).sort(), ['aggregateIdField', 'aggregateType', 'compatibility', 'domain', 'eventName', 'payloadSchema', 'schema', 'version', 'x-envelope-required'].sort()), `${event?.eventName ?? 'IAM fragment event'} source fields must be closed`);
  }

  const catalogEvents = Array.isArray(catalog?.events) ? catalog.events : [];
  const catalogByName = new Map();
  for (const event of catalogEvents) {
    if (nonEmpty(event?.eventName) && !catalogByName.has(event.eventName)) catalogByName.set(event.eventName, event);
  }
  const canonicalIamNames = catalogEvents
    .filter((event) => event?.eventName?.startsWith('iam.') && event?.status === 'CANONICAL_D2')
    .map((event) => event.eventName);
  add(errors, sameArray(sorted(canonicalIamNames), sorted(EXPECTED_IAM_EVENT_NAMES)), 'catalog canonical IAM event set must be exactly the three M1-018 events');
  for (const eventName of EXPECTED_IAM_EVENT_NAMES) {
    const source = fragmentEvents.find((event) => event?.eventName === eventName);
    const event = catalogByName.get(eventName);
    const frozen = M1018_IAM_CANONICAL_EVENT_GOVERNANCE[eventName];
    add(errors, isRecord(source), `${eventName} is missing from the fixed IAM fragment`);
    add(errors, isRecord(event), `${eventName} is missing from the canonical event catalog`);
    add(errors, isRecord(frozen), `${eventName} is missing from M1018_IAM_CANONICAL_EVENT_GOVERNANCE`);
    if (!isRecord(source) || !isRecord(event) || !isRecord(frozen)) continue;
    exactValue(errors, pick(event, ['eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'x-envelope-required', 'payloadSchema', 'compatibility']),
      pick(source, ['eventName', 'domain', 'version', 'schema', 'aggregateType', 'aggregateIdField', 'x-envelope-required', 'payloadSchema', 'compatibility']),
      `${eventName} catalog fields must exactly match the fixed IAM fragment`);
    add(errors, event.status === frozen.status, `${eventName} status must match M1018_IAM_CANONICAL_EVENT_GOVERNANCE`);
    exactValue(errors, event['x-p1r-governance'], frozen.governance, `${eventName} governance must exactly match M1018_IAM_CANONICAL_EVENT_GOVERNANCE`);
    const schemaName = event.payloadSchema?.$ref?.split('/').pop();
    add(errors, EXPECTED_IAM_PAYLOAD_SCHEMA_NAMES.includes(schemaName), `${eventName} payload schema must use the fixed IAM schema set`);
    exactValue(errors, catalog?.payloadSchemas?.[schemaName], fragmentSchemas[schemaName], `${eventName} catalog payload schema must exactly match its fixed IAM fragment`);
    add(errors, event['x-envelope-required'] && sameArray(event['x-envelope-required'], REQUIRED_EVENT_ENVELOPE), `${eventName} must require the complete canonical event envelope`);
  }
}

function checkCatalog(catalog, registryById, ownerPolicy, b26Runtime, mode, policy, iamFragment, errors) {
  add(errors, isRecord(catalog), 'event catalog must be an object');
  if (!isRecord(catalog)) return;
  const governance = catalog['x-p1r-event-governance'];
  add(errors, isRecord(governance), 'event catalog governance is required');
  add(errors, governance?.maturity === 'D2_CONTRACT_READY' && governance?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'event catalog cannot promote D2/runtime status');
  add(errors, governance?.transportPolicy?.canonical === 'KAFKA_COMPATIBLE_ONLY' && governance?.transportPolicy?.clientProducer === 'PROHIBITED', 'event catalog must be Kafka-only with client producers prohibited');
  add(errors, governance?.transportPolicy?.coreApiV1RabbitMq === 'HISTORICAL_MIGRATION_ONLY' && governance?.transportPolicy?.redisStreams === 'PROHIBITED', 'legacy event transports must remain historical/prohibited');
  const events = Array.isArray(catalog.events) ? catalog.events : [];
  const names = events.map((event) => event?.eventName).filter(nonEmpty);
  add(errors, new Set(names).size === names.length, 'event catalog must not contain duplicate event names');
  const historical = new Set(IAM_HISTORICAL_EVENT_NAMES);
  for (const event of events) if (historical.has(event?.eventName)) add(errors, event.status === 'HISTORICAL_CANDIDATE', `${event.eventName} historical v1 event must not be promoted`);
  const canonicalNames = new Set(events.filter((event) => event?.status === 'CANONICAL_D2').map((event) => event.eventName));
  for (const eventName of canonicalNames) {
    if (!eventName?.endsWith('.v2')) continue;
    const v1 = `${eventName.slice(0, -2)}v1`;
    add(errors, !canonicalNames.has(v1), `${eventName} cannot dual-publish its v1 sibling`);
  }
  const serviceOwners = new Set((ownerPolicy?.serviceOwners ?? []).map((item) => item?.service).filter(nonEmpty));
  const dataOwners = new Set((ownerPolicy?.serviceOwners ?? []).filter((item) => item?.dataOwner === true).map((item) => item?.service).filter(nonEmpty));
  for (const event of events.filter((item) => item?.status === 'CANONICAL_D2')) {
    const governanceEntry = event['x-p1r-governance'];
    const producer = governanceEntry?.producer;
    add(errors, isRecord(producer) && serviceOwners.has(producer.service) && dataOwners.has(producer.dataOwner) && producer.service === producer.dataOwner, `${event.eventName} must have a unique service/data owner`);
    add(errors, producer?.service !== 'api-gateway' && producer?.outboxRequired === true, `${event.eventName} producer cannot be Gateway/client and must require Outbox`);
    add(errors, Array.isArray(governanceEntry?.consumers) && governanceEntry.consumers.length > 0, `${event.eventName} must have explicit consumers`);
    for (const consumer of governanceEntry?.consumers ?? []) add(errors, serviceOwners.has(consumer?.service) && nonEmpty(consumer?.consumerGroup), `${event.eventName} has a missing/unknown consumer owner`);
    add(errors, governanceEntry?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', `${event.eventName} runtime status was promoted`);
    add(errors, governanceEntry?.transport?.protocol === 'kafka' && governanceEntry?.transport?.partitionKey === 'aggregateId' && nonEmpty(governanceEntry?.transport?.topic), `${event.eventName} must have Kafka topic/aggregate partition binding`);
  }
  const closures = governance?.plannedClosures;
  add(errors, Array.isArray(closures), 'event catalog plannedClosures must be an array');
  const closureIds = (closures ?? []).map((item) => item?.gapId);
  add(errors, duplicateValues(closureIds).length === 0, 'event catalog plannedClosures must not contain duplicate GAP IDs');
  const closureById = new Map((closures ?? []).map((item) => [item?.gapId, item]));
  const expectedClosureIds = [...EXPECTED_ATOMIC_EVENT_GAPS, EVENT_GAP_ALIAS];
  add(errors, sameArray(closureIds, expectedClosureIds), 'event catalog must list exactly 15 atomic gaps plus one alias in canonical order');
  for (const id of expectedClosureIds) {
    const closure = closureById.get(id);
    const record = registryById.get(id);
    if (!closure || !record) continue;
    add(errors, closure.status === 'D2_CONTRACT_CLOSED', `${id} catalog closure status must be D2_CONTRACT_CLOSED for ${mode} mode`);
    const expectedTasks = record.closureTasks ?? [];
    add(errors, Array.isArray(closure.d2ClosureTasks) && duplicateValues(closure.d2ClosureTasks).length === 0, `${id} catalog closure tasks must be a duplicate-free array`);
    add(errors, sameSet(closure.d2ClosureTasks, expectedTasks), `${id} catalog closure tasks must match registry exactly`);
    add(errors, closure.family === EVENT_GAP_FAMILIES[id], `${id} catalog closure family drifted`);
  }
  add(errors, !Object.keys(catalog).some((key) => key.toLowerCase().includes('runtimepromotion')), 'event catalog cannot carry runtime promotion metadata');
  return { canonicalNames, closureById };
}

function checkIamDecision(decisionInput, catalog, iamFragment, policy, errors) {
  add(errors, isRecord(decisionInput), 'IAM Event GAPs require an explicit design decision');
  if (!isRecord(decisionInput)) return;
  exactValue(errors, decisionInput, EXPECTED_IAM_EVENT_DECISION, 'IAM Event design decision must be the frozen MINIMAL_CANONICAL_V2 decision');
  add(errors, policy?.iamEventDecision && stableJson(policy.iamEventDecision) === stableJson(EXPECTED_IAM_EVENT_DECISION), 'IAM Event policy decision is not bound to the frozen decision');
  checkIamCanonicalSource({ catalog, iamFragment }, errors);
}

function checkRuntimeBoundary({ catalog, b26Runtime, g0, g3, m0_006, policy }, errors) {
  add(errors, b26Runtime?.mode === 'static-only' && b26Runtime?.runtimeStatus === 'pending' && b26Runtime?.defaultDecision === 'NO-GO', 'B26 must remain static-only/pending/NO-GO');
  add(errors, g0?.defaultDecision === 'BLOCKED', 'G0 must remain BLOCKED');
  add(errors, g3?.runtimeDecision === 'BLOCKED' && g3?.defaultDecision === 'NO-GO', 'G3 runtime must remain BLOCKED/NO-GO');
  add(errors, m0_006?.taskId === 'P1R-M0-006' && m0_006?.canonicalTaskStatus === 'BLOCKED' && m0_006?.decision === 'BLOCKED', 'M0-006 must remain a BLOCKED task and cannot be washed into PASS');
  add(errors, catalog?.['x-p1r-event-governance']?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'catalog runtime promotion is forbidden');
  add(errors, policy?.runtimeStatus === 'NOT_RUNTIME_VERIFIED', 'total-gate runtime promotion is forbidden');
}

function checkStaticReports(staticChecks, policy, errors) {
  const reports = isRecord(staticChecks) ? staticChecks : null;
  add(errors, isRecord(reports), 'M1-018 total gate requires reports from all fixed static checker commands');
  if (!reports) return;
  const expectedChecks = policy.requiredStaticChecks ?? [];
  const expectedIds = expectedChecks.map((item) => item.id);
  add(errors, sameSet(Object.keys(reports), expectedIds), 'static checker report IDs must match the fixed command set exactly');
  for (const expected of expectedChecks) {
    const report = reports[expected.id] ?? null;
    add(errors, isRecord(report), `missing required static checker report: ${expected.id}`);
    if (!isRecord(report)) continue;
    add(errors, report.result === 'PASS' && report.status === undefined, `static checker ${expected.id} did not report PASS`);
    add(errors, report.exitCode === 0, `static checker ${expected.id} did not exit successfully`);
    add(errors, report.executed === true, `static checker ${expected.id} is not bound to an executed command`);
    add(errors, sameArray(report.argv, expected.argv), `static checker ${expected.id} argv drifted from the fixed command`);
    add(errors, report.timeoutMs === expected.timeoutMs, `static checker ${expected.id} timeout drifted from the fixed policy`);
    add(errors, report.timedOut === false, `static checker ${expected.id} timed out`);
  }
}

export function validateM1018D2TotalGateData(input = {}) {
  const errors = [];
  const mode = input.mode ?? 'review';
  add(errors, mode === 'review' || mode === 'final', `unsupported M1-018 gate mode: ${mode}`);
  const policy = input.policy ?? {};
  checkPolicy(policy, errors);
  const matrix = checkMatrix(input.matrix ?? input.matrixMarkdown, policy, errors);
  const tasks = normalizeTasks(input.tasks ?? input.tasksById, errors);
  const manifests = normalizeManifests(input.manifests ?? input.canonicalManifests, errors);
  const registryById = checkRegistry(input.registry, matrix, tasks, manifests, mode, policy, errors);
  checkCatalog(input.catalog, registryById, input.ownerPolicy, input.b26Runtime, mode, policy, input.iamFragment, errors);
  checkIamDecision(input.iamEventDecision ?? input.iamDecision ?? policy.iamEventDecision, input.catalog, input.iamFragment, policy, errors);
  checkRuntimeBoundary({ catalog: input.catalog, b26Runtime: input.b26Runtime, g0: input.g0, g3: input.g3, m0_006: input.m0_006 ?? input.m0Manifest, policy }, errors);
  add(errors, input.requireStaticChecks !== false, 'M1-018 static checker execution cannot be disabled');
  checkStaticReports(input.staticChecks, policy, errors);
  const m1018 = tasks.get('P1R-M1-018');
  if (mode === 'final') add(errors, m1018?.status === 'ACCEPTED', 'final M1-018 gate requires P1R-M1-018=ACCEPTED');
  const result = errors.length === 0 ? 'PASS' : (mode === 'review' ? 'REWORK' : 'FAIL');
  return {
    result,
    decision: result === 'PASS' ? 'ACCEPTED' : result,
    mode,
    summary: {
      contractGapCount: EXPECTED_CONTRACT_GAPS.length,
      atomicEventGapCount: EXPECTED_ATOMIC_EVENT_GAPS.length,
      eventGapAliasCount: 1,
      eventGapRecordCount: EXPECTED_ATOMIC_EVENT_GAPS.length + 1,
      closedContractGapCount: (input.registry?.gaps ?? []).filter((gap) => EXPECTED_CONTRACT_GAPS.includes(gap?.id) && gap?.status === 'CLOSED').length,
      closedAtomicEventGapCount: (input.registry?.gaps ?? []).filter((gap) => EXPECTED_ATOMIC_EVENT_GAPS.includes(gap?.id) && gap?.status === 'CLOSED').length,
      aliasStatus: input.registry?.gaps?.find((gap) => gap?.id === EVENT_GAP_ALIAS)?.status ?? 'MISSING',
      runtimeStatus: input.catalog?.['x-p1r-event-governance']?.runtimeStatus,
      b26Decision: input.b26Runtime?.defaultDecision,
    },
    errors,
  };
}

export const validateM1018TotalGateData = validateM1018D2TotalGateData;

function readJson(root, relativePath, errors) {
  try { return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8')); }
  catch (error) { errors.push(`missing or invalid canonical input ${relativePath}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}

function parseLedgerTasks(text) {
  return [...String(text ?? '').matchAll(/^\|\s*`(P1R-M\d-\d{3})`\s*\|.*?\|\s*`([A-Z_]+)`\s*\|\s*$/gmu)].map((match) => ({ id: match[1], status: match[2] }));
}

export function readM1018D2TotalGateInputs({ root = DEFAULT_ROOT, mode = 'review' } = {}) {
  const errors = [];
  const policy = readJson(root, POLICY_RELATIVE_PATH, errors) ?? {};
  const matrixPath = EXPECTED_CANONICAL_INPUTS.traceabilityMatrix;
  const registry = readJson(root, EXPECTED_CANONICAL_INPUTS.gapRegistry, errors);
  const catalog = readJson(root, EXPECTED_CANONICAL_INPUTS.eventCatalog, errors);
  const ownerPolicy = readJson(root, EXPECTED_CANONICAL_INPUTS.dataOwnershipPolicy, errors);
  const iamFragment = readJson(root, EXPECTED_CANONICAL_INPUTS.iamEventFragment, errors);
  const b26Runtime = readJson(root, EXPECTED_CANONICAL_INPUTS.b26Runtime, errors);
  const g0 = readJson(root, EXPECTED_CANONICAL_INPUTS.g0Scope, errors);
  const g3 = readJson(root, EXPECTED_CANONICAL_INPUTS.g3Security, errors);
  const m0_006 = readJson(root, EXPECTED_CANONICAL_INPUTS.m0_006, errors);
  const ledgerPath = EXPECTED_CANONICAL_INPUTS.taskLedger;
  for (const [inputName, relativePath] of Object.entries(EXPECTED_CANONICAL_INPUTS)) {
    try {
      if (inputName === 'traceabilityMatrix' || inputName === 'taskLedger') fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
      else if (inputName === 'generatedOpenApi' || inputName === 'generatedEvents') fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
      else if (inputName !== 'gapRegistry' && inputName !== 'eventCatalog' && inputName !== 'dataOwnershipPolicy' && inputName !== 'iamEventFragment' && inputName !== 'b26Runtime' && inputName !== 'g0Scope' && inputName !== 'g3Security' && inputName !== 'm0_006') fs.accessSync(path.join(root, ...relativePath.split('/')));
    } catch (error) {
      errors.push(`missing canonical input ${inputName} (${relativePath}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let ledger = '';
  try { ledger = fs.readFileSync(path.join(root, ...ledgerPath.split('/')), 'utf8'); } catch (error) { errors.push(`missing canonical ledger: ${error.message}`); }
  const tasks = parseLedgerTasks(ledger);
  const manifests = {};
  for (const record of registry?.gaps ?? []) {
    if (!record?.closureEvidence) continue;
    const manifestPath = String(record.closureEvidence).replaceAll('\\', '/');
    const manifest = readJson(root, manifestPath, errors);
    if (manifest) manifests[manifestPath] = manifest;
  }
  return {
    policy, matrixMarkdown: (() => { try { return fs.readFileSync(path.join(root, ...matrixPath.split('/')), 'utf8'); } catch (error) { errors.push(`missing canonical matrix: ${error.message}`); return ''; } })(),
    registry, catalog, ownerPolicy, iamFragment, b26Runtime, g0, g3, m0_006, tasks, manifests, mode,
    readErrors: errors,
  };
}

export function executeM1018RequiredStaticChecks({ root = DEFAULT_ROOT, policy } = {}) {
  const effectivePolicy = policy ?? (() => {
    const errors = [];
    return readJson(root, POLICY_RELATIVE_PATH, errors) ?? {};
  })();
  const reports = {};
  const errors = [];
  for (const check of effectivePolicy.requiredStaticChecks ?? []) {
    const argv = Array.isArray(check?.argv) ? check.argv : [];
    const timeoutMs = check?.timeoutMs;
    if (!nonEmpty(check?.id) || argv.length === 0 || !Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 900_000) {
      errors.push(`cannot execute malformed static checker definition ${check?.id ?? '(missing id)'}`);
      continue;
    }
    let execution;
    const startedAt = Date.now();
    try {
      execution = spawnSync(process.execPath, argv, {
        cwd: root,
        encoding: 'utf8',
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (error) {
      execution = { status: null, error };
    }
    const exitCode = typeof execution?.status === 'number' ? execution.status : -1;
    const output = `${execution?.stdout ?? ''}${execution?.stderr ?? ''}`;
    const timedOut = execution?.error?.code === 'ETIMEDOUT';
    reports[check.id] = {
      result: exitCode === 0 && !execution?.error ? 'PASS' : 'FAIL',
      exitCode,
      executed: true,
      argv: [...argv],
      timeoutMs,
      timedOut,
      durationMs: Date.now() - startedAt,
      outputTail: output.slice(-2000),
    };
    if (reports[check.id].result !== 'PASS') {
      errors.push(timedOut
        ? `static checker ${check.id} timed out after ${timeoutMs}ms`
        : `static checker ${check.id} failed (exit=${exitCode})`);
    }
  }
  return { reports, errors };
}

export function validateM1018D2TotalGate({ root = DEFAULT_ROOT, mode = 'review', input } = {}) {
  const loaded = input ?? readM1018D2TotalGateInputs({ root, mode });
  if (!input) {
    const execution = executeM1018RequiredStaticChecks({ root, policy: loaded.policy });
    loaded.staticChecks = execution.reports;
    loaded.staticCheckExecutionErrors = execution.errors;
  }
  const report = validateM1018D2TotalGateData({ ...loaded, mode });
  if (loaded.readErrors?.length) report.errors.unshift(...loaded.readErrors);
  if (loaded.staticCheckExecutionErrors?.length) report.errors.push(...loaded.staticCheckExecutionErrors);
  report.result = report.errors.length === 0 ? 'PASS' : (mode === 'review' ? 'REWORK' : 'FAIL');
  return report;
}

export const validateM1018TotalGate = validateM1018D2TotalGate;

function cliOptions(argv) {
  const options = { mode: 'review', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--mode') options.mode = argv[++index];
    else if (arg?.startsWith('--mode=')) options.mode = arg.slice(7);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  try {
    const options = cliOptions(process.argv.slice(2));
    if (options.help) { console.log('Usage: node scripts/audit/p1r-m1-018-d2-total-gate.mjs [--mode review|final] [--json]'); process.exit(0); }
    const report = validateM1018D2TotalGate({ mode: options.mode });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else { console.log(`P1R-M1-018 D2 total gate ${report.result} (${report.summary.contractGapCount} Contract, ${report.summary.atomicEventGapCount} atomic Event, alias=${report.summary.eventGapAliasCount}, mode=${report.mode}).`); for (const error of report.errors) console.error(`- ${error}`); }
    process.exitCode = report.result === 'PASS' ? 0 : 1;
  } catch (error) { console.error(JSON.stringify({ result: 'FAIL', errors: [error instanceof Error ? error.message : String(error)] }, null, 2)); process.exitCode = 1; }
}
