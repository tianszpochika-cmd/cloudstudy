import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateB22DataReconciliation } from '../../scripts/runtime/validate-b22-data-reconciliation.mjs'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDirectory, '..', '..')
const configPath = path.join(root, 'config/b22-data-reconciliation.json')
const validatorPath = path.join(root, 'scripts/runtime/validate-b22-data-reconciliation.mjs')
const manifest = JSON.parse(fs.readFileSync(configPath, 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function expectedRuntimeEnv() {
  return Object.fromEntries(manifest.execution.requiredEnv.map((name) => [name, `synthetic-${name.toLowerCase()}`]))
}

test('B22-DATA-002 static manifest passes without claiming runtime migration', () => {
  const result = validateB22DataReconciliation(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  assert.equal(result.batch, 'B22')
  assert.equal(result.task, 'V2-B22-DATA-002')
  assert.equal(result.serviceCount, 15)
  assert.equal(result.staticChecks, 9)
  assert.equal(result.runtimeChecks, 8)
  assert.equal(result.runtimeEvidencePending, 8)
  assert.equal(result.runtimeGate, 'static-only')
})

test('every Phase 1 data owner has an independent schema and migration lock', () => {
  const services = manifest.serviceMigrations
  assert.deepEqual(services.map((item) => item.service), [
    'iam-service', 'learner-service', 'content-service', 'learning-service', 'assessment-service',
    'media-service', 'gamification-service', 'social-service', 'commerce-service',
    'notification-service', 'analytics-service', 'admin-ops-service', 'audit-service',
    'workflow-service', 'core-api'
  ])
  assert.equal(new Set(services.map((item) => item.schema)).size, services.length)
  assert.equal(new Set(services.map((item) => item.migrationLock.key)).size, services.length)
  for (const service of services) {
    assert.deepEqual(service.scenarioCoverage, ['empty-database', 'upgrade', 'downgrade', 'failure-recovery'])
    assert.equal(service.migrationLock.provider, 'mysql-get-advisory-lock')
    assert.equal(service.migrationLock.releaseOnFailure, true)
  }
  assert.equal(manifest.dataOwnerPolicy.crossServiceWritesAllowed, false)
  assert.equal(manifest.dataOwnerPolicy.crossServiceSqlJoinsAllowed, false)
  assert.equal(manifest.dataOwnerPolicy.sharedOrmEntitiesAllowed, false)
})

test('migration policy covers empty database, upgrade, downgrade and failure recovery', () => {
  assert.deepEqual(manifest.migrationPolicy.requiredScenarios, ['empty-database', 'upgrade', 'downgrade', 'failure-recovery'])
  assert.equal(manifest.migrationPolicy.destructiveDowngradeAllowed, false)
  assert.equal(manifest.migrationPolicy.downgradeStrategy, 'restore-point-plus-compensation')
  assert.equal(manifest.migrationPolicy.scenarioStatus, 'pending')
  assert.equal(manifest.migrationPolicy.scenarioRuntimeRequired, true)
})

test('row count, digest, schema and migration versions are required reconciliation dimensions', () => {
  const ids = manifest.dataReconciliation.checks.map((check) => check.id)
  for (const id of ['row-count', 'canonical-digest', 'schema-version', 'migration-version', 'null-and-unique-invariants']) assert.ok(ids.includes(id), id)
  assert.equal(manifest.dataReconciliation.canonicalization, 'stable-json-v1-sort-by-primary-key-and-field-name')
  assert.equal(manifest.dataReconciliation.mismatchDecision, 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER')
  assert.equal(manifest.dataReconciliation.sourceRevisionRequired, true)
  assert.equal(manifest.dataReconciliation.environmentRequired, true)
  assert.equal(manifest.dataReconciliation.migrationVersionRequired, true)
  assert.equal(manifest.dataReconciliation.hashRequired, true)
})

test('outbox, event envelope, offsets, DLQ and replay are reconciled', () => {
  const event = manifest.eventReconciliation
  assert.equal(event.outbox.tableOwnedByProducer, true)
  assert.equal(event.outbox.sameLocalTransactionAsFact, true)
  assert.equal(event.outbox.crossServiceWriteAllowed, false)
  for (const field of ['eventId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey', 'payload']) assert.ok(event.eventEnvelope.requiredFields.includes(field), field)
  for (const check of ['outbox-fact-count-and-digest', 'event-id-set-and-schema-version', 'consumer-offset-continuity', 'dlq-and-replay-accounting', 'duplicate-consumption-no-second-effect']) assert.ok(event.checks.includes(check), check)
  assert.equal(event.offsets.replayUsesSameDedupeKey, true)
  assert.equal(event.mismatchDecision, 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER')
})

test('repeat migration and duplicate event delivery are fail-safe and idempotent', () => {
  assert.equal(manifest.idempotency.status, 'blocked')
  assert.equal(manifest.idempotency.sameFingerprintDecision, 'RETURN_EXISTING_RESULT_NO_SECOND_EFFECT')
  assert.equal(manifest.idempotency.differentFingerprintDecision, 'STOP_AND_AUDIT')
  for (const item of ['repeat-migration-run', 'repeat-outbox-reconciliation', 'duplicate-event-redelivery', 'mismatched-retry-after-partial-failure']) assert.ok(manifest.idempotency.cases.includes(item), item)

  const candidate = clone(manifest)
  candidate.idempotency.sameFingerprintDecision = 'APPLY_AGAIN'
  const result = validateB22DataReconciliation(candidate)
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('idempotency replay decisions are unsafe')))
})

test('core-api compatibility window and read-shadow are bounded before cutover', () => {
  const compatibility = manifest.routeCompatibilityWindow
  assert.equal(compatibility.legacySystem, 'core-api')
  assert.equal(compatibility.newEntryPoint, 'api-gateway')
  assert.equal(compatibility.legacyDirectPortPublic, false)
  assert.equal(compatibility.legacyWriteAllowed, false)
  assert.equal(compatibility.startAt, null)
  assert.equal(compatibility.endAt, null)
  assert.equal(manifest.readShadow.userVisible, false)
  assert.equal(manifest.readShadow.writeSideEffectsAllowed, false)
  assert.equal(manifest.resultParity.sameResultRequiredBeforeCutover, true)
  assert.equal(manifest.resultParity.differentResultDecision, 'STOP_RELEASE_AND_ROLLBACK_OR_MANUAL_TAKEOVER')
})

test('inconsistent row/digest or parity policy is rejected', () => {
  const candidate = clone(manifest)
  candidate.dataReconciliation.checks[1].id = 'unsafe-digest'
  candidate.resultParity.differentResultDecision = 'CONTINUE'
  const result = validateB22DataReconciliation(candidate)
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('canonical-digest')))
  assert.ok(result.errors.some((error) => error.includes('source/target result parity boundary is incomplete')))
})

test('restore point and compensation are required, while fields remain unbound until runtime', () => {
  const rollback = manifest.rollback
  assert.equal(rollback.status, 'blocked')
  assert.equal(rollback.restorePoint.status, 'pending')
  assert.equal(rollback.restorePoint.type, 'mysql-pitr-or-immutable-backup')
  assert.equal(rollback.compensation.strategy, 'saga-compensation-through-owner-service')
  assert.equal(rollback.compensation.twoPhaseCommitAllowed, false)
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'artifactHash', 'traceId', 'evidenceRef']) assert.equal(rollback.restorePoint[field], null, field)
})

test('report schema is closed and binds revision, environment, migration, hash, trace and evidence', () => {
  const schema = manifest.reportSchema.jsonSchema
  assert.equal(manifest.reportSchema.closed, true)
  assert.equal(schema.additionalProperties, false)
  for (const field of ['sourceRevision', 'environment', 'migrationVersion', 'artifactHash', 'traceId', 'evidenceRefs', 'serviceResults', 'mismatchAction']) assert.ok(schema.required.includes(field), field)
  assert.equal(schema.properties.serviceResults.items.additionalProperties, false)
  assert.ok(schema.properties.artifactHash.pattern.includes('sha256'))

  const candidate = clone(manifest)
  candidate.reportSchema.jsonSchema.additionalProperties = true
  const result = validateB22DataReconciliation(candidate)
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('closed object')))
})

test('missing evidence index blocks the static gate', () => {
  const candidate = clone(manifest)
  candidate.evidenceIndex = candidate.evidenceIndex.filter((item) => item.id !== 'B22-DATA-E-RECONCILIATION-RUNTIME')
  const result = validateB22DataReconciliation(candidate)
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('evidenceIndex must contain')))
})

test('B21 Go/No-Go prerequisite must remain blocked until real acceptance', () => {
  assert.equal(manifest.execution.b21Prerequisite.currentDecision, 'BLOCKED')
  assert.equal(manifest.releaseGate.status, 'BLOCKED')
  assert.equal(manifest.releaseGate.defaultDecision, 'NO-GO')
  const candidate = clone(manifest)
  candidate.execution.b21Prerequisite.currentDecision = 'ACCEPTED'
  const result = validateB22DataReconciliation(candidate)
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('B21 prerequisite must be required and currently BLOCKED')))
})

test('runtime mode is blocked when external evidence variables are absent', () => {
  const result = validateB22DataReconciliation(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('runtime gate blocked; missing environment:')))
})

test('synthetic placeholders cannot promote runtime even when every variable is present', () => {
  const result = validateB22DataReconciliation(manifest, { runtimeRequested: true, env: expectedRuntimeEnv() })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('synthetic or placeholder variables cannot promote the Gate')))
})

test('CLI --require-runtime exits non-zero for missing evidence', () => {
  const env = { ...process.env }
  for (const name of manifest.execution.requiredEnv) env[name] = ''
  const result = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    env,
    encoding: 'utf8',
    windowsHide: true
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime gate blocked; missing environment:/)
})

test('manifest and synthetic evidence contain no production credentials or personal data', () => {
  const result = validateB22DataReconciliation(manifest)
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  const serialized = JSON.stringify(manifest)
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~-]+/i)
  assert.doesNotMatch(serialized, /\bsk-[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
})
