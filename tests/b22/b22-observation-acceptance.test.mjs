import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { validateB22ObservationAcceptance } from '../../scripts/runtime/validate-b22-observation-acceptance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(root, 'config', 'b22-observation-acceptance.json')
const validatorPath = path.join(root, 'scripts', 'runtime', 'validate-b22-observation-acceptance.mjs')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

function cleanEnvironment() {
  const environment = { ...process.env }
  delete environment.B22_REQUIRE_RUNTIME
  for (const name of manifest.runtimeGate.requiredEnv) delete environment[name]
  return environment
}

test('B22 observation acceptance is Phase 1, scoped to OPS-003 and TEST-004, and closed by default', () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.batch, 'B22')
  assert.equal(manifest.phase, 'phase-1')
  assert.equal(manifest.mode, 'static-and-synthetic')
  assert.equal(manifest.status, 'static-foundation')
  assert.equal(manifest.runtimeDecision, 'BLOCKED')
  assert.deepEqual(manifest.tasks.map((task) => task.id), ['V2-B22-OPS-003', 'V2-B22-TEST-004'])
  assert.equal(manifest.execution.runtimeBlocked, true)
  assert.equal(manifest.execution.runtimeEvidence, null)
  assert.equal(manifest.execution.allowUnverifiedPass, false)
  assert.equal(manifest.execution.trafficSwitchAllowed, false)
  assert.equal(manifest.releaseGate.status, 'BLOCKED')
  assert.equal(manifest.releaseGate.defaultDecision, 'NO-GO')
})

test('observation policy covers real short/long windows, OTel signals, SLO/error budget, escalation, support and audit', () => {
  assert.equal(manifest.observationPolicy.windows.short.duration, '24h')
  assert.equal(manifest.observationPolicy.windows.long.duration, '7d')
  for (const window of Object.values(manifest.observationPolicy.windows)) {
    assert.equal(window.status, 'pending')
    assert.equal(window.runtimeRequired, true)
    assert.equal(window.realTrafficRequired, true)
  }
  assert.equal(manifest.observability.signalStandard.provider, 'OpenTelemetry')
  assert.deepEqual(manifest.observability.signalStandard.signals, ['traces', 'metrics', 'logs'])
  assert.equal(manifest.observability.errorBudget.status, 'target-not-measured')
  assert.equal(manifest.observability.errorBudget.overrunDecision, 'STOP-EXPANSION-AND-ROLLBACK')
  assert.deepEqual(manifest.observability.alertRouting.severityLevels, ['P0', 'P1', 'P2'])
  assert.equal(manifest.observability.customerSupport.status, 'pending')
  assert.equal(manifest.observability.onCall.handoffRequiresAudit, true)
  assert.equal(manifest.observability.incidentReview.status, 'pending')
  assert.equal(manifest.observability.userFeedback.status, 'pending')
  assert.equal(manifest.observability.legacyRisks.mustHaveOwner, true)
  assert.equal(manifest.observability.legacyRisks.mustHaveExpiry, true)
  assert.equal(manifest.observability.auditTrail.status, 'pending')
})

test('Phase 1 report schema is closed and requires evidence binding, smoke, safety and maintenance disposition', () => {
  const schema = manifest.reportSchema.jsonSchema
  assert.equal(manifest.reportSchema.closed, true)
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)
  for (const field of ['releaseCandidate', 'observation', 'keyJourneys', 'permissionPrivacy', 'backup', 'artifactBinding', 'maintenance', 'p1Disposition', 'reproducibility', 'reportHash']) assert.ok(schema.required.includes(field))
  assert.deepEqual(manifest.releaseAcceptance.p1Disposition.allowedActions, ['close', 'transfer'])
  assert.equal(manifest.releaseAcceptance.maintenanceOwner.status, 'not-assigned')
  assert.equal(manifest.releaseAcceptance.artifactBinding.status, 'pending')
  assert.equal(manifest.releaseAcceptance.backupEvidence.status, 'pending')
})

test('quality gates separate source-backed static checks from pending runtime evidence', () => {
  const checks = manifest.qualityGates.flatMap((gate) => [
    ...(gate.staticChecks ?? []),
    ...(gate.runtimeChecks ?? []),
  ])
  assert.deepEqual(manifest.qualityGates.map((gate) => gate.id), [
    'B22-OPS-003-OBSERVATION',
    'B22-OPS-003-ESCALATION',
    'B22-OPS-003-INCIDENT',
    'B22-TEST-004-ACCEPTANCE',
    'B22-TEST-004-EVIDENCE',
    'B22-TEST-004-MAINTENANCE',
  ])
  assert.equal(checks.filter((check) => check.evidenceClass === 'static').length, 6)
  assert.equal(checks.filter((check) => check.evidenceClass === 'runtime').length, 6)
  for (const check of checks.filter((item) => item.evidenceClass === 'static')) {
    assert.equal(check.status, 'defined')
    assert.equal(check.runtimeRequired, false)
    assert.ok(check.sourcePaths.length > 0)
    assert.ok(check.assertions.length > 0)
  }
  for (const check of checks.filter((item) => item.evidenceClass === 'runtime')) {
    assert.equal(check.status, 'pending')
    assert.equal(check.runtimeRequired, true)
    assert.ok(check.evidenceRequired.length > 0)
    assert.ok(check.cannotBeSatisfiedBy.some((item) => ['synthetic-fixture-only', 'development-http-200', 'static-manifest-only', 'unfired-alert-definition', 'verbal-review'].includes(item)))
    assert.doesNotMatch(JSON.stringify(check), /\b(pass|passed|captured|verified)\b/i)
  }
  assert.equal(manifest.evidenceIndex.filter((item) => item.class === 'runtime' && item.status === 'pending').length, 6)
})

test('static validator passes only the closed static foundation and keeps runtime blocked', () => {
  const result = validateB22ObservationAcceptance(manifest, { runtimeRequested: false })
  assert.equal(result.result, 'PASS', JSON.stringify(result, null, 2))
  assert.equal(result.staticChecks, 6)
  assert.equal(result.runtimeChecks, 6)
  assert.equal(result.runtimeEvidencePending, 6)
  assert.equal(result.runtimeBlocked, true)
  assert.equal(result.releaseDecision, 'NO-GO')
})

test('missing evidence item blocks the Gate', () => {
  const mutated = structuredClone(manifest)
  mutated.evidenceIndex = mutated.evidenceIndex.filter((item) => item.id !== 'B22-E-TEST-RUNTIME-REPORT')
  const result = validateB22ObservationAcceptance(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /B22-E-TEST-RUNTIME-REPORT|evidenceIndex/)
})

test('any P0/P1 blocks stop/rollback acceptance', () => {
  const mutated = structuredClone(manifest)
  mutated.releaseGate.stopRollback.openP0 = 1
  const result = validateB22ObservationAcceptance(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /P0\/P1 stop-rollback/)
})

test('error budget overrun blocks acceptance', () => {
  const mutated = structuredClone(manifest)
  mutated.observability.errorBudget.status = 'exhausted'
  mutated.observability.errorBudget.consumedPercent = 100
  const result = validateB22ObservationAcceptance(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /errorBudget/)
})

test('unreproducible report blocks acceptance', () => {
  const mutated = structuredClone(manifest)
  mutated.releaseAcceptance.reportReproducibility.status = 'not-reproducible'
  const result = validateB22ObservationAcceptance(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /report reproducibility/)
})

test('--require-runtime fails when B21, production observation and report evidence are absent', () => {
  const result = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnvironment(),
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime gate blocked; missing environment/)
  assert.match(`${result.stdout}\n${result.stderr}`, /real B21, production observation and Phase 1 acceptance report evidence is pending/)
})
