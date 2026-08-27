import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const configPath = path.join(root, 'config', 'b22-data-reconciliation.json')
const cliRuntimeRequested = process.argv.includes('--require-runtime')
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])
const expectedTask = 'V2-B22-DATA-002'
const expectedServices = [
  'iam-service',
  'learner-service',
  'content-service',
  'learning-service',
  'assessment-service',
  'media-service',
  'gamification-service',
  'social-service',
  'commerce-service',
  'notification-service',
  'analytics-service',
  'admin-ops-service',
  'audit-service',
  'workflow-service',
  'core-api'
]
const expectedScenarios = ['empty-database', 'upgrade', 'downgrade', 'failure-recovery']
const expectedStaticCheckIds = [
  'B22-DATA-OWNER-STATIC',
  'B22-DATA-MIGRATION-STATIC',
  'B22-DATA-RECONCILIATION-STATIC',
  'B22-DATA-E-EVENT-STATIC',
  'B22-DATA-IDEMPOTENCY-STATIC',
  'B22-DATA-COMPATIBILITY-STATIC',
  'B22-DATA-READ-SHADOW-STATIC',
  'B22-DATA-ROLLBACK-STATIC',
  'B22-DATA-BINDING-STATIC'
]
const expectedRuntimeCheckIds = [
  'B22-DATA-OWNER-RUNTIME',
  'B22-DATA-MIGRATION-RUNTIME',
  'B22-DATA-RECONCILIATION-RUNTIME',
  'B22-DATA-EVENT-RUNTIME',
  'B22-DATA-IDEMPOTENCY-RUNTIME',
  'B22-DATA-COMPATIBILITY-RUNTIME',
  'B22-DATA-ROLLBACK-RUNTIME',
  'B22-DATA-BINDING-RUNTIME'
]
const expectedStaticEvidenceIds = [
  'B22-DATA-E-OWNER-STATIC',
  'B22-DATA-E-MIGRATION-STATIC',
  'B22-DATA-E-RECONCILIATION-STATIC',
  'B22-DATA-E-EVENT-STATIC',
  'B22-DATA-E-IDEMPOTENCY-STATIC',
  'B22-DATA-E-COMPATIBILITY-STATIC',
  'B22-DATA-E-ROLLBACK-STATIC',
  'B22-DATA-E-BINDING-STATIC'
]
const expectedRuntimeEvidenceIds = [
  'B22-DATA-E-OWNER-RUNTIME',
  'B22-DATA-E-MIGRATION-RUNTIME',
  'B22-DATA-E-RECONCILIATION-RUNTIME',
  'B22-DATA-E-EVENT-RUNTIME',
  'B22-DATA-E-IDEMPOTENCY-RUNTIME',
  'B22-DATA-E-COMPATIBILITY-RUNTIME',
  'B22-DATA-E-ROLLBACK-RUNTIME',
  'B22-DATA-E-BINDING-RUNTIME'
]

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function fail(ctx, message) {
  ctx.errors.push(message)
}

function requireString(ctx, value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(ctx, `${label} must be a non-empty string`)
}

function requireBoolean(ctx, value, label) {
  if (typeof value !== 'boolean') fail(ctx, `${label} must be boolean`)
}

function requireArray(ctx, value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(ctx, `${label} must contain at least ${minimum} item(s)`)
}

function requireStatus(ctx, value, label) {
  if (!allowedRuntimeStatuses.has(value)) fail(ctx, `${label} must be pending or blocked`)
}

function unique(ctx, values, label) {
  if (new Set(values).size !== values.length) fail(ctx, `${label} must be unique`)
}

function has(ctx, values, item, label) {
  if (!Array.isArray(values) || !values.includes(item)) fail(ctx, `${label} must include ${item}`)
}

function readJson(filePath, ctx) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(ctx, `cannot read JSON ${path.relative(root, filePath)}: ${error.message}`)
    return null
  }
}

function readSource(relativePath, ctx) {
  const absolutePath = path.resolve(root, relativePath)
  if (!absolutePath.startsWith(`${root}${path.sep}`) && absolutePath !== root) {
    fail(ctx, `source path escapes repository: ${relativePath}`)
    return ''
  }
  if (!fs.existsSync(absolutePath)) {
    fail(ctx, `source path does not exist: ${relativePath}`)
    return ''
  }
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (error) {
    fail(ctx, `cannot read source ${relativePath}: ${error.message}`)
    return ''
  }
}

function assertSourceMarker(relativePath, marker, ctx) {
  const source = readSource(relativePath, ctx)
  if (source && !source.includes(marker)) fail(ctx, `${relativePath} is missing source marker: ${marker}`)
}

function validateHeader(config, ctx) {
  if (!isRecord(config)) {
    fail(ctx, 'manifest must be an object')
    return
  }
  if (config.schemaVersion !== 1) fail(ctx, 'schemaVersion must be 1')
  if (config.batch !== 'B22') fail(ctx, 'batch must be B22')
  if (config.phase !== 'phase-1') fail(ctx, 'manifest must remain Phase 1')
  if (config.mode !== 'static-and-synthetic') fail(ctx, 'manifest mode must be static-and-synthetic')
  if (config.status !== 'static-foundation') fail(ctx, 'manifest status must be static-foundation')
  if (config.scope !== expectedTask) fail(ctx, `scope must be ${expectedTask}`)
}

function validateTask(config, ctx) {
  const task = config.task
  if (!isRecord(task)) {
    fail(ctx, 'task is required')
    return
  }
  if (task.id !== expectedTask) fail(ctx, `task.id must be ${expectedTask}`)
  if (task.status !== 'defined') fail(ctx, 'task must remain defined until runtime evidence exists')
  requireBoolean(ctx, task.runtimeRequired, 'task.runtimeRequired')
  if (task.runtimeRequired !== true) fail(ctx, 'task.runtimeRequired must be true')
  if (task.defaultDecision !== 'deny') fail(ctx, 'task.defaultDecision must be deny')
  has(ctx, task.dependsOn, 'V2-B22-REL-001', 'task.dependsOn')
  has(ctx, task.dependsOn, 'V2-B21-GATE-005', 'task.dependsOn')
  for (const ref of ['ARCH-DATA-001', 'ARCH-EVT-001', 'ARCH-REL-001', 'ARCH-DR-001']) has(ctx, task.acceptanceRefs, ref, 'task.acceptanceRefs')
  requireString(ctx, task.objective, 'task.objective')
}

function validateExecution(config, ctx, runtimeRequested, env) {
  const execution = config.execution
  if (!isRecord(execution)) {
    fail(ctx, 'execution is required')
    return
  }
  if (execution.mode !== 'static-fixture-only') fail(ctx, 'execution.mode must be static-fixture-only')
  if (execution.runtimeStatus !== 'blocked' || execution.runtimeBlocked !== true) fail(ctx, 'runtime must remain blocked')
  if (execution.allowUnverifiedPass !== false || execution.staticValidatorCannotPromoteRuntime !== true) fail(ctx, 'static/runtime separation policy is incomplete')
  for (const field of ['destructiveSqlAllowed', 'realMySqlMigrationAllowed', 'realKafkaReplayAllowed', 'productionTrafficChangeAllowed']) {
    if (execution[field] !== false) fail(ctx, `${field} must be false in static mode`)
  }
  requireArray(ctx, execution.requiredEnv, 'execution.requiredEnv', 8)
  unique(ctx, execution.requiredEnv ?? [], 'execution.requiredEnv')
  for (const envName of execution.requiredEnv ?? []) if (!/^[A-Z][A-Z0-9_]+$/.test(envName)) fail(ctx, `invalid runtime environment variable: ${envName}`)
  requireArray(ctx, execution.blockedReasons, 'execution.blockedReasons', 3)
  const prerequisite = execution.b21Prerequisite
  if (!isRecord(prerequisite) || prerequisite.required !== true || prerequisite.currentDecision !== 'BLOCKED' || prerequisite.requiredDecision !== 'ACCEPTED' || prerequisite.status !== 'blocked') fail(ctx, 'B21 prerequisite must be required and currently BLOCKED')
  if (prerequisite.acceptanceEvidenceStatus !== 'pending' || prerequisite.runtimeEvidenceMustBeExternal !== true) fail(ctx, 'B21 prerequisite must remain externally evidenced and pending')

  if (runtimeRequested) {
    const missing = (execution.requiredEnv ?? []).filter((name) => !env[name])
    if (missing.length > 0) fail(ctx, `runtime gate blocked; missing environment: ${missing.join(', ')}`)
    if (execution.runtimeStatus !== 'accepted') fail(ctx, 'runtime evidence remains pending/blocked; synthetic or placeholder variables cannot promote the Gate')
  }
}

function validateOwnerPolicy(config, ctx) {
  const policy = config.dataOwnerPolicy
  if (!isRecord(policy)) {
    fail(ctx, 'dataOwnerPolicy is required')
    return
  }
  for (const field of ['crossServiceWritesAllowed', 'crossServiceSqlJoinsAllowed', 'sharedOrmEntitiesAllowed', 'gatewayMayWriteDomainFacts', 'coreApiMayWriteMigratedFacts', 'projectionReadsMustBeVersioned']) requireBoolean(ctx, policy[field], `dataOwnerPolicy.${field}`)
  for (const field of ['crossServiceWritesAllowed', 'crossServiceSqlJoinsAllowed', 'sharedOrmEntitiesAllowed', 'gatewayMayWriteDomainFacts', 'coreApiMayWriteMigratedFacts']) if (policy[field] !== false) fail(ctx, `dataOwnerPolicy.${field} must be false`)
  if (policy.schemaOwnership !== 'one-schema-one-service-owner' || policy.writeAuthority !== 'owner-service-only' || policy.ownerMismatchDecision !== 'STOP_RELEASE_AND_MANUAL_TAKEOVER') fail(ctx, 'data owner boundary policy is incomplete')
  requireArray(ctx, policy.ownerMap, 'dataOwnerPolicy.ownerMap', expectedServices.length)
  const ids = (policy.ownerMap ?? []).map((item) => item?.service)
  if (JSON.stringify(ids) !== JSON.stringify(expectedServices)) fail(ctx, 'ownerMap service order/scope must match the Phase 1 migration set')
  unique(ctx, ids, 'ownerMap service ids')
  for (const item of policy.ownerMap ?? []) {
    requireString(ctx, item?.service, 'ownerMap.service')
    requireString(ctx, item?.factOwner, `${item?.service}.factOwner`)
    requireArray(ctx, item?.facts, `${item?.service}.facts`)
    if (item.service !== 'core-api' && item.factOwner !== item.service) fail(ctx, `${item.service} must own its own facts`)
  }
}

function validateMigrationPolicy(config, ctx) {
  const policy = config.migrationPolicy
  if (!isRecord(policy)) {
    fail(ctx, 'migrationPolicy is required')
    return
  }
  if (policy.runner !== 'Flyway-per-service' || policy.lockProvider !== 'mysql-get-advisory-lock' || policy.lockScope !== 'one-lock-per-service-schema') fail(ctx, 'migration runner/lock policy is incomplete')
  requireBoolean(ctx, policy.lockKeyMustIncludeService, 'migrationPolicy.lockKeyMustIncludeService')
  requireBoolean(ctx, policy.releaseLockOnSuccess, 'migrationPolicy.releaseLockOnSuccess')
  requireBoolean(ctx, policy.releaseLockOnFailure, 'migrationPolicy.releaseLockOnFailure')
  if (policy.lockKeyMustIncludeService !== true || policy.releaseLockOnSuccess !== true || policy.releaseLockOnFailure !== true) fail(ctx, 'migration lock lifecycle policy is unsafe')
  if (policy.destructiveDowngradeAllowed !== false || policy.downgradeStrategy !== 'restore-point-plus-compensation') fail(ctx, 'destructive downgrade must be disabled and use restore/compensation')
  if (JSON.stringify(policy.requiredScenarios) !== JSON.stringify(expectedScenarios)) fail(ctx, 'migration scenarios must be empty-database, upgrade, downgrade and failure-recovery')
  if (policy.scenarioStatus !== 'pending' || policy.scenarioRuntimeRequired !== true) fail(ctx, 'migration scenarios must remain runtime-pending')
  if (policy.failureDecision !== 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER' || policy.schemaVersionMustBeBound !== true) fail(ctx, 'migration failure and version binding policy is incomplete')
}

function validateServiceMigrations(config, ctx) {
  const migrations = config.serviceMigrations
  requireArray(ctx, migrations, 'serviceMigrations', expectedServices.length)
  const ids = (migrations ?? []).map((item) => item?.service)
  if (JSON.stringify(ids) !== JSON.stringify(expectedServices)) fail(ctx, 'serviceMigrations must cover the exact Phase 1 service/schema owner set')
  unique(ctx, ids, 'service migration service ids')
  const schemas = []
  const locks = []
  const ownerMap = new Map((config.dataOwnerPolicy?.ownerMap ?? []).map((item) => [item.service, item.factOwner]))
  for (const item of migrations ?? []) {
    const service = item?.service
    requireString(ctx, service, 'serviceMigration.service')
    requireString(ctx, item?.schema, `${service}.schema`)
    requireString(ctx, item?.factOwner, `${service}.factOwner`)
    requireString(ctx, item?.migrationSource, `${service}.migrationSource`)
    requireString(ctx, item?.schemaVersion, `${service}.schemaVersion`)
    requireString(ctx, item?.targetMigrationVersion, `${service}.targetMigrationVersion`)
    requireString(ctx, item?.writeAuthority, `${service}.writeAuthority`)
    schemas.push(item.schema)
    if (ownerMap.get(service) !== item.factOwner) fail(ctx, `${service}.factOwner must match ownerMap`)
    const lock = item.migrationLock
    if (!isRecord(lock) || lock.provider !== 'mysql-get-advisory-lock' || lock.scope.length === 0 || lock.releaseOnFailure !== true) fail(ctx, `${service}.migrationLock is incomplete`)
    requireString(ctx, lock?.key, `${service}.migrationLock.key`)
    if (!lock.key.includes(service)) fail(ctx, `${service}.migrationLock.key must include service id`)
    locks.push(lock.key)
    if (JSON.stringify(item.scenarioCoverage) !== JSON.stringify(expectedScenarios)) fail(ctx, `${service}.scenarioCoverage must cover all four migration scenarios`)
    const evidence = item.scenarioEvidence
    if (!isRecord(evidence)) {
      fail(ctx, `${service}.scenarioEvidence is required`)
    } else {
      for (const scenario of ['emptyDatabase', 'upgrade', 'downgrade', 'failureRecovery']) {
        requireString(ctx, evidence[scenario], `${service}.scenarioEvidence.${scenario}`)
        if (!String(evidence[scenario]).startsWith('evidence-ref://synthetic/')) fail(ctx, `${service}.scenarioEvidence.${scenario} must be synthetic until runtime`)
      }
    }
    if (service === 'core-api') {
      if (item.writeAuthority !== 'read-only-during-compatibility-window' || item.migrationMode !== 'legacy-compatibility-boundary') fail(ctx, 'core-api must remain a read-only compatibility boundary')
    } else if (item.writeAuthority !== `${service}-only`) {
      fail(ctx, `${service} write authority must be owner-only`)
    }
  }
  unique(ctx, schemas, 'service schema names')
  unique(ctx, locks, 'migration lock keys')
}

function validateDataReconciliation(config, ctx) {
  const reconciliation = config.dataReconciliation
  if (!isRecord(reconciliation) || reconciliation.status !== 'blocked' || reconciliation.runtimeRequired !== true) fail(ctx, 'data reconciliation must remain blocked and runtime-required')
  if (reconciliation.canonicalization !== 'stable-json-v1-sort-by-primary-key-and-field-name' || reconciliation.mismatchDecision !== 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER' || reconciliation.unknownResultDecision !== 'STOP_RELEASE_AND_MANUAL_TAKEOVER') fail(ctx, 'data reconciliation canonicalization/mismatch policy is incomplete')
  for (const field of ['perServiceResultRequired', 'sourceRevisionRequired', 'environmentRequired', 'migrationVersionRequired', 'hashRequired', 'traceAndEvidenceRequired', 'tenantScopeMustBeServerDerived', 'repairMayWriteOnlyThroughOwner']) requireBoolean(ctx, reconciliation[field], `dataReconciliation.${field}`)
  requireArray(ctx, reconciliation.checks, 'dataReconciliation.checks', 5)
  const checkIds = (reconciliation.checks ?? []).map((check) => check?.id)
  for (const id of ['row-count', 'canonical-digest', 'schema-version', 'migration-version', 'null-and-unique-invariants']) has(ctx, checkIds, id, 'data reconciliation check ids')
  for (const check of reconciliation.checks ?? []) {
    requireString(ctx, check?.id, 'dataReconciliation.check.id')
    requireString(ctx, check?.algorithm, `${check?.id}.algorithm`)
    requireBoolean(ctx, check?.required, `${check?.id}.required`)
    if (check.required !== true) fail(ctx, `${check.id} must be required`)
  }
}

function validateEventReconciliation(config, ctx) {
  const reconciliation = config.eventReconciliation
  if (!isRecord(reconciliation) || reconciliation.status !== 'blocked' || reconciliation.runtimeRequired !== true || reconciliation.deliverySemantics !== 'at-least-once') fail(ctx, 'event reconciliation must remain blocked, runtime-required and at-least-once')
  const outbox = reconciliation.outbox
  if (!isRecord(outbox) || outbox.tableOwnedByProducer !== true || outbox.sameLocalTransactionAsFact !== true || outbox.oneNamespacePerService !== true || outbox.crossServiceWriteAllowed !== false || outbox.duplicateDecision !== 'NO_SECOND_EFFECT_AND_AUDIT') fail(ctx, 'outbox ownership/transaction/idempotency policy is incomplete')
  const envelope = reconciliation.eventEnvelope
  if (!isRecord(envelope) || envelope.partitionKey !== 'aggregateId' || envelope.payloadPolicy !== 'no-raw-pii-no-token-no-payment-credential-no-raw-media' || envelope.schemaCompatibility !== 'backward-compatible-or-new-version') fail(ctx, 'event envelope policy is incomplete')
  for (const field of ['eventId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey', 'payload']) has(ctx, envelope.requiredFields, field, 'eventEnvelope.requiredFields')
  const offsets = reconciliation.offsets
  if (!isRecord(offsets) || offsets.consumerGroupOwnedByConsumer !== true || offsets.offsetEvidenceRequired !== true || offsets.continuityCheckRequired !== true || offsets.lagAndDlqCheckRequired !== true || offsets.replayUsesSameDedupeKey !== true) fail(ctx, 'consumer offset/DLQ/replay policy is incomplete')
  for (const check of ['outbox-fact-count-and-digest', 'event-id-set-and-schema-version', 'aggregate-partition-order', 'consumer-offset-continuity', 'dlq-and-replay-accounting', 'duplicate-consumption-no-second-effect']) has(ctx, reconciliation.checks, check, 'event reconciliation checks')
  if (reconciliation.mismatchDecision !== 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER' || reconciliation.manualRecoveryMustBeAudited !== true) fail(ctx, 'event mismatch/manual recovery policy is incomplete')
}

function validateIdempotency(config, ctx) {
  const idempotency = config.idempotency
  if (!isRecord(idempotency) || idempotency.status !== 'blocked' || idempotency.runtimeRequired !== true) fail(ctx, 'idempotency gate must remain blocked and runtime-required')
  for (const field of ['migrationRunKey', 'reconciliationRunKey', 'eventDedupeKey']) requireString(ctx, idempotency[field], `idempotency.${field}`)
  if (idempotency.sameFingerprintDecision !== 'RETURN_EXISTING_RESULT_NO_SECOND_EFFECT' || idempotency.differentFingerprintDecision !== 'STOP_AND_AUDIT' || idempotency.mismatchDecision !== 'STOP_RELEASE_AND_MANUAL_TAKEOVER') fail(ctx, 'idempotency replay decisions are unsafe')
  for (const item of ['repeat-migration-run', 'repeat-row-digest-reconciliation', 'repeat-outbox-reconciliation', 'duplicate-event-redelivery', 'duplicate-compatibility-read-shadow', 'mismatched-retry-after-partial-failure']) has(ctx, idempotency.cases, item, 'idempotency.cases')
}

function validateCompatibility(config, ctx) {
  const compatibility = config.routeCompatibilityWindow
  if (!isRecord(compatibility) || compatibility.status !== 'blocked' || compatibility.runtimeRequired !== true) fail(ctx, 'route compatibility window must remain blocked and runtime-required')
  if (compatibility.legacySystem !== 'core-api' || compatibility.newEntryPoint !== 'api-gateway' || compatibility.externalRoutePrefix !== '/api/v1' || compatibility.legacyDirectPortPublic !== false || compatibility.windowMode !== 'bounded-read-compatibility-window') fail(ctx, 'core-api/Gateway compatibility boundary is incomplete')
  if (!Number.isInteger(compatibility.windowDurationDays) || compatibility.windowDurationDays <= 0 || compatibility.startAt !== null || compatibility.endAt !== null) fail(ctx, 'compatibility window must be bounded but not claimed active')
  if (compatibility.legacyWriteAllowed !== false || compatibility.newOwnerWriteOnly !== true || compatibility.expiryMustBeAudited !== true) fail(ctx, 'legacy write and expiry policy is unsafe')
  requireArray(ctx, compatibility.routePairs, 'routeCompatibilityWindow.routePairs', 3)
  for (const pair of compatibility.routePairs ?? []) {
    requireString(ctx, pair?.legacyRoute, 'compatibility.routePair.legacyRoute')
    requireString(ctx, pair?.gatewayRoute, 'compatibility.routePair.gatewayRoute')
    requireString(ctx, pair?.owner, 'compatibility.routePair.owner')
    requireString(ctx, pair?.operationId, 'compatibility.routePair.operationId')
    if (!pair.gatewayRoute.startsWith('/api/v1/')) fail(ctx, `${pair.operationId} must be a versioned Gateway route`)
  }
  if (compatibility.cutoverMismatchDecision !== 'STOP_EXPANSION_AND_ROLLBACK_OR_MANUAL_TAKEOVER') fail(ctx, 'compatibility mismatch must stop expansion')
  for (const item of ['parity-match', 'data-reconciliation-match', 'event-reconciliation-match', 'rollback-owner', 'audited-expiry']) has(ctx, compatibility.routeRemovalRequires, item, 'routeCompatibilityWindow.routeRemovalRequires')
}

function validateReadShadow(config, ctx) {
  const shadow = config.readShadow
  if (!isRecord(shadow) || shadow.status !== 'blocked' || shadow.runtimeRequired !== true || shadow.enabledForCompatibilityWindow !== true || shadow.userVisible !== false || shadow.writeSideEffectsAllowed !== false || shadow.syntheticOnlyUntilRuntimeEvidence !== true) fail(ctx, 'read-shadow must be non-user-visible, side-effect-free and runtime-pending')
  requireString(ctx, shadow.sampleReference, 'readShadow.sampleReference')
  for (const field of ['http-status', 'contract-version', 'canonical-business-fields', 'owner-and-tenant-scope', 'error-code']) has(ctx, shadow.compare, field, 'readShadow.compare')
  for (const field of ['traceId', 'requestId', 'routeVersion', 'sourceRevision', 'migrationVersion']) has(ctx, shadow.traceFields, field, 'readShadow.traceFields')
  if (shadow.mismatchDecision !== 'STOP_EXPANSION_AND_AUDIT') fail(ctx, 'read-shadow mismatch must stop expansion and audit')
}

function validateParity(config, ctx) {
  const parity = config.resultParity
  if (!isRecord(parity) || parity.status !== 'blocked' || parity.runtimeRequired !== true || parity.sameResultRequiredBeforeCutover !== true) fail(ctx, 'source/target result parity must remain blocked until runtime')
  if (parity.sourceResult !== 'legacy-core-api-read' || parity.targetResult !== 'gateway-to-new-owner-read' || parity.differentResultDecision !== 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER') fail(ctx, 'source/target result parity boundary is incomplete')
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'artifactHash', 'traceId', 'evidenceRef']) has(ctx, parity.comparisonEvidenceMustInclude, field, 'resultParity.comparisonEvidenceMustInclude')
}

function validateRollback(config, ctx) {
  const rollback = config.rollback
  if (!isRecord(rollback) || rollback.status !== 'blocked' || rollback.runtimeRequired !== true || rollback.mismatchDecision !== 'ROLLBACK_OR_MANUAL_TAKEOVER' || rollback.rollbackMustBeVersionBound !== true || rollback.rollbackOwnerRequired !== true) fail(ctx, 'rollback must remain blocked, version-bound and owner-gated')
  const restorePoint = rollback.restorePoint
  if (!isRecord(restorePoint) || restorePoint.type !== 'mysql-pitr-or-immutable-backup' || restorePoint.status !== 'pending' || restorePoint.restoreBeforeCutoverRequired !== true || restorePoint.integrityCheckRequired !== true) fail(ctx, 'restore point must remain pending and integrity-gated')
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'artifactHash', 'traceId', 'evidenceRef']) if (restorePoint[field] !== null) fail(ctx, `rollback.restorePoint.${field} must be null until runtime evidence is captured`)
  for (const step of ['stop-expansion-and-freeze-writes', 'retain-legacy-read-compatibility-window', 'restore-owner-schema-to-approved-point', 'reconcile-row-count-and-canonical-digest', 'reconcile-outbox-event-and-consumer-offset', 'run-owner-service-saga-compensation', 'verify-read-shadow-parity', 'record-audited-manual-takeover-if-needed']) has(ctx, rollback.rollbackSequence, step, 'rollback.rollbackSequence')
  const compensation = rollback.compensation
  if (!isRecord(compensation) || compensation.strategy !== 'saga-compensation-through-owner-service' || compensation.twoPhaseCommitAllowed !== false || compensation.directCrossServiceTableWriteAllowed !== false || compensation.idempotencyRequired !== true || compensation.auditRequired !== true || compensation.manualRecoveryOwnerRequired !== true) fail(ctx, 'rollback compensation must be owner-local, idempotent and audited')
}

function validateBinding(config, ctx) {
  const binding = config.evidenceBinding
  if (!isRecord(binding) || binding.status !== 'synthetic-only' || binding.missingRuntimeDecision !== 'BLOCKED' || binding.allRuntimeFieldsMustBeReboundExternally !== true) fail(ctx, 'evidence binding must remain synthetic-only and externally rebound')
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'traceId']) {
    requireString(ctx, binding[field], `evidenceBinding.${field}`)
    if (!String(binding[field]).includes('synthetic')) fail(ctx, `evidenceBinding.${field} must be synthetic in static mode`)
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(binding.artifactHash ?? '')) fail(ctx, 'evidenceBinding.artifactHash must be a synthetic sha256 digest')
  requireArray(ctx, binding.evidenceRefs, 'evidenceBinding.evidenceRefs', 2)
  for (const ref of binding.evidenceRefs ?? []) if (!String(ref).startsWith('evidence-ref://synthetic/')) fail(ctx, 'evidenceBinding.evidenceRefs must be synthetic')
}

function validateSyntheticFixtures(config, ctx) {
  const fixtures = config.syntheticFixtures
  if (!isRecord(fixtures) || fixtures.policy !== 'synthetic-references-only-no-production-data-no-pii-no-credentials-no-raw-media') fail(ctx, 'synthetic fixture policy is unsafe or incomplete')
  for (const field of ['productionDataAllowed', 'realCredentialsAllowed', 'destructiveSqlAllowed']) if (fixtures[field] !== false) fail(ctx, `syntheticFixtures.${field} must be false`)
  requireArray(ctx, fixtures.subjects, 'syntheticFixtures.subjects', 2)
  for (const subject of fixtures.subjects ?? []) {
    for (const field of ['subjectRef', 'tenantRef', 'aggregateRef']) requireString(ctx, subject?.[field], `syntheticFixtures.subject.${field}`)
    for (const field of ['subjectRef', 'tenantRef', 'aggregateRef']) if (!String(subject[field]).startsWith(`${field === 'subjectRef' ? 'subject' : field === 'tenantRef' ? 'tenant' : 'aggregate'}-ref://synthetic/`)) fail(ctx, `syntheticFixtures.${field} must use a synthetic reference`)
  }
  const serialized = JSON.stringify(config)
  for (const pattern of [/Bearer\s+[A-Za-z0-9._~-]+/i, /\bsk-[A-Za-z0-9]/i, /\bghp_[A-Za-z0-9]/i, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/]) if (pattern.test(serialized)) fail(ctx, `synthetic manifest contains prohibited secret or personal-data pattern: ${pattern}`)
}

const sourceMarkers = {
  'B22-DATA-OWNER-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', '禁止跨服务 SQL join、跨服务写表和共享 ORM entity'],
    ['docs/10-decisions/0010-java25-microservices-gateway-iam.md', '每个服务拥有自己的 schema、迁移、Redis 命名空间、OpenAPI/事件契约和写权限']
  ],
  'B22-DATA-MIGRATION-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', '每个服务使用自己的 Flyway migration'],
    ['services/content-service/src/main/resources/db/migration/V1__create_content_service_schema.sql', 'CREATE TABLE']
  ],
  'B22-DATA-RECONCILIATION-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', '可重放、可对账、可人工恢复']
  ],
  'B22-DATA-E-EVENT-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', 'Outbox 只用于跨服务集成事实'],
    ['packages/contracts/events/v1/catalog.json', '"eventId"']
  ],
  'B22-DATA-IDEMPOTENCY-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', '写操作要求 `Idempotency-Key`'],
    ['docs/02-architecture/v2-microservices-architecture.md', '消费者必须支持去重']
  ],
  'B22-DATA-COMPATIBILITY-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', 'Gateway + IAM/RBAC 先接入旧 `core-api`'],
    ['services/api-gateway/README.md', 'Gateway']
  ],
  'B22-DATA-READ-SHADOW-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', '只读投影/事件旁路验证']
  ],
  'B22-DATA-ROLLBACK-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', 'MySQL 使用备份、PITR'],
    ['config/b21-release-gate-evidence.json', '"status": "BLOCKED"']
  ],
  'B22-DATA-BINDING-STATIC': [
    ['docs/02-architecture/v2-microservices-architecture.md', '→ 数据 owner + migration'],
    ['config/b21-release-gate-evidence.json', '"sourceRevisionRequired": true']
  ]
}

function validateQualityGates(config, ctx) {
  requireArray(ctx, config.qualityGates, 'qualityGates', 1)
  if (config.qualityGates?.length !== 1) fail(ctx, 'B22-DATA must define exactly one quality gate')
  const gate = config.qualityGates?.[0]
  if (!isRecord(gate) || gate.id !== 'B22-DATA-GATE-002' || gate.task !== expectedTask || gate.decision !== 'BLOCKED') fail(ctx, 'B22-DATA quality gate must be BLOCKED for DATA-002')
  requireArray(ctx, gate?.evidenceIds, 'B22-DATA-GATE-002.evidenceIds', 16)
  const staticChecks = gate?.staticChecks ?? []
  const runtimeChecks = gate?.runtimeChecks ?? []
  const staticIds = staticChecks.map((check) => check?.id)
  const runtimeIds = runtimeChecks.map((check) => check?.id)
  if (JSON.stringify(staticIds) !== JSON.stringify(expectedStaticCheckIds)) fail(ctx, 'static checks do not cover the DATA-002 scope')
  if (JSON.stringify(runtimeIds) !== JSON.stringify(expectedRuntimeCheckIds)) fail(ctx, 'runtime checks do not cover the DATA-002 scope')
  unique(ctx, [...staticIds, ...runtimeIds], 'quality check ids')
  const referencedEvidence = new Set()
  for (const check of [...staticChecks, ...runtimeChecks]) {
    requireString(ctx, check?.id, 'qualityCheck.id')
    requireString(ctx, check?.evidenceId, `${check?.id}.evidenceId`)
    referencedEvidence.add(check.evidenceId)
    requireArray(ctx, check?.sourcePaths, `${check?.id}.sourcePaths`)
    requireArray(ctx, check?.assertions, `${check?.id}.assertions`)
    if (check.evidenceClass === 'static') {
      if (check.status !== 'defined' || check.runtimeRequired !== false) fail(ctx, `${check.id} must be a defined static check`)
      for (const sourcePath of check.sourcePaths ?? []) readSource(sourcePath, ctx)
      for (const [sourcePath, marker] of sourceMarkers[check.id] ?? []) assertSourceMarker(sourcePath, marker, ctx)
    } else if (check.evidenceClass === 'runtime') {
      if (!allowedRuntimeStatuses.has(check.status) || check.runtimeRequired !== true) fail(ctx, `${check.id} must remain pending/blocked and runtime-required`)
      for (const sourcePath of check.sourcePaths ?? []) if (!String(sourcePath).startsWith('evidence/')) fail(ctx, `${check.id} runtime source path must be external evidence/`)
    } else {
      fail(ctx, `${check.id} evidenceClass must be static or runtime`)
    }
  }
  for (const evidenceId of referencedEvidence) if (!gate.evidenceIds.includes(evidenceId)) fail(ctx, `${gate.id} does not list check evidence: ${evidenceId}`)
  for (const evidenceId of gate.evidenceIds) if (!referencedEvidence.has(evidenceId)) fail(ctx, `${gate.id} evidence id is not bound to a check: ${evidenceId}`)
  return { gate, referencedEvidence }
}

function validateEvidenceIndex(config, ctx, gateInfo) {
  requireArray(ctx, config.evidenceIndex, 'evidenceIndex', 16)
  if (config.evidenceIndex?.length !== 16) fail(ctx, 'evidenceIndex must contain the eight static and eight runtime DATA-002 evidence entries')
  const ids = (config.evidenceIndex ?? []).map((item) => item?.id)
  unique(ctx, ids, 'evidence ids')
  const expectedIds = [...expectedStaticEvidenceIds, ...expectedRuntimeEvidenceIds]
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) fail(ctx, 'evidenceIndex ids/order must match the DATA-002 gate')
  const gateIds = new Set(config.qualityGates.map((gate) => gate.id))
  for (const item of config.evidenceIndex ?? []) {
    requireString(ctx, item?.id, 'evidence.id')
    if (!gateIds.has(item?.gateId)) fail(ctx, `${item.id} references an unknown gate`)
    requireString(ctx, item?.artifactPathPattern, `${item.id}.artifactPathPattern`)
    requireString(ctx, item?.collectionPolicy, `${item.id}.collectionPolicy`)
    requireString(ctx, item?.binding, `${item.id}.binding`)
    if (item.class === 'static') {
      if (item.status !== 'defined' || item.runtimeRequired !== false || item.collectionPolicy !== 'repository-static-validator' || !item.artifactPathPattern.startsWith('config/')) fail(ctx, `${item.id} static evidence policy is invalid`)
    } else if (item.class === 'runtime') {
      if (!allowedRuntimeStatuses.has(item.status) || item.runtimeRequired !== true || item.collectionPolicy !== 'approved-runtime-runner-only' || !item.artifactPathPattern.startsWith('evidence/')) fail(ctx, `${item.id} runtime evidence policy is invalid`)
    } else {
      fail(ctx, `${item.id} class must be static or runtime`)
    }
  }
  for (const evidenceId of gateInfo.referencedEvidence) if (!ids.includes(evidenceId)) fail(ctx, `quality check evidence is missing from index: ${evidenceId}`)
}

function validateReleaseGate(config, ctx) {
  const gate = config.releaseGate
  if (!isRecord(gate) || gate.status !== 'BLOCKED' || gate.defaultDecision !== 'NO-GO' || gate.missingEvidenceDecision !== 'NO-GO' || gate.mismatchDecision !== 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER') fail(ctx, 'release gate must default to BLOCKED/NO-GO and stop on mismatch')
  for (const field of ['requiresB21Accepted', 'requiresAllServiceMigrationsReconciled', 'requiresEventAndOffsetReconciled', 'requiresReadShadowParity', 'requiresRestorePoint', 'requiresRollbackOwner', 'requiresCompatibilityWindow', 'manualTakeoverMustBeAudited']) if (gate[field] !== true) fail(ctx, `releaseGate.${field} must be true`)
  if (gate.openP0P1Decision !== 'NO-GO') fail(ctx, 'open P0/P1 must be NO-GO')
  if (!Array.isArray(gate.allowedDecisions) || !gate.allowedDecisions.includes('NO-GO') || !gate.allowedDecisions.includes('GO')) fail(ctx, 'release gate decision enum is incomplete')
}

function validateReportSchema(config, ctx) {
  const reportSchema = config.reportSchema
  if (!isRecord(reportSchema) || reportSchema.closed !== true) {
    fail(ctx, 'reportSchema must be closed')
    return
  }
  const schema = reportSchema.jsonSchema
  if (!isRecord(schema) || schema.type !== 'object' || schema.additionalProperties !== false) fail(ctx, 'reportSchema.jsonSchema must be a closed object')
  const required = new Set(schema?.required ?? [])
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'artifactHash', 'traceId', 'evidenceRefs', 'serviceResults', 'mismatchAction']) if (!required.has(field)) fail(ctx, `report schema missing required binding field: ${field}`)
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'artifactHash', 'traceId', 'evidenceRefs', 'serviceResults', 'mismatchAction']) if (!schema?.properties?.[field]) fail(ctx, `report schema missing property: ${field}`)
  if (!schema?.properties?.artifactHash?.pattern?.includes('sha256')) fail(ctx, 'report artifactHash must be a sha256 pattern')
  if (!schema?.properties?.decision?.enum?.includes('NO-GO') || !schema?.properties?.decision?.enum?.includes('BLOCKED')) fail(ctx, 'report decision must support blocked/no-go')
  const serviceSchema = schema?.properties?.serviceResults?.items
  if (!isRecord(serviceSchema) || serviceSchema.additionalProperties !== false) fail(ctx, 'service result schema must be closed')
  for (const field of ['service', 'factOwner', 'schema', 'migrationVersion', 'rowCountDigest', 'eventOffsetStatus', 'resultStatus', 'evidenceRef']) if (!serviceSchema.required?.includes(field)) fail(ctx, `service result schema missing ${field}`)
}

function validateNoUnsafeContent(config, ctx) {
  const serialized = JSON.stringify(config)
  for (const pattern of [/-----BEGIN [A-Z ]+-----/i, /Bearer\s+eyJ/i, /\bsk-[A-Za-z0-9]/i, /\bghp_[A-Za-z0-9]/i]) if (pattern.test(serialized)) fail(ctx, `manifest contains prohibited credential material: ${pattern}`)
  if (serialized.includes('production-database-dump') || serialized.includes('real-user-export')) fail(ctx, 'manifest contains a production data reference')
}

export function validateB22DataReconciliation(config = readJson(configPath, { errors: [] }), options = {}) {
  const ctx = { errors: [] }
  const runtimeRequested = options.runtimeRequested ?? cliRuntimeRequested
  const env = options.env ?? process.env
  if (!config) return { result: 'FAIL', errors: [...ctx.errors], runtimeGate: runtimeRequested ? 'blocked' : 'static-only' }

  validateHeader(config, ctx)
  validateTask(config, ctx)
  validateExecution(config, ctx, runtimeRequested, env)
  validateOwnerPolicy(config, ctx)
  validateMigrationPolicy(config, ctx)
  validateServiceMigrations(config, ctx)
  validateDataReconciliation(config, ctx)
  validateEventReconciliation(config, ctx)
  validateIdempotency(config, ctx)
  validateCompatibility(config, ctx)
  validateReadShadow(config, ctx)
  validateParity(config, ctx)
  validateRollback(config, ctx)
  validateBinding(config, ctx)
  validateSyntheticFixtures(config, ctx)
  const gateInfo = validateQualityGates(config, ctx)
  validateEvidenceIndex(config, ctx, gateInfo)
  validateReleaseGate(config, ctx)
  validateReportSchema(config, ctx)
  validateNoUnsafeContent(config, ctx)

  return {
    result: ctx.errors.length === 0 ? 'PASS' : 'FAIL',
    batch: config.batch,
    task: config.task?.id,
    serviceCount: config.serviceMigrations?.length ?? 0,
    staticChecks: config.qualityGates?.[0]?.staticChecks?.length ?? 0,
    runtimeChecks: config.qualityGates?.[0]?.runtimeChecks?.length ?? 0,
    runtimeEvidencePending: (config.evidenceIndex ?? []).filter((item) => item.class === 'runtime' && allowedRuntimeStatuses.has(item.status)).length,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    errors: [...ctx.errors]
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const config = readJson(configPath, { errors: [] })
  const result = validateB22DataReconciliation(config, { runtimeRequested: cliRuntimeRequested, env: process.env })
  console.log(JSON.stringify(result, null, 2))
  if (result.result !== 'PASS') process.exitCode = 1
}
