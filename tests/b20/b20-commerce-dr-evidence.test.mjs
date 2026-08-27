import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const configPath = path.join(root, 'config', 'b20-commerce-dr-evidence.json')
const validatorPath = path.join(root, 'scripts/runtime/validate-b20-commerce-dr-evidence.mjs')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

function checks() {
  return config.qualityGates.flatMap((gate) => [
    ...(gate.staticChecks ?? []),
    ...(gate.runtimeChecks ?? []),
  ])
}

function runtimeChecks() {
  return checks().filter((check) => check.evidenceClass === 'runtime')
}

function staticChecks() {
  return checks().filter((check) => check.evidenceClass === 'static')
}

test('B20 commerce/DR/evidence manifest is Phase 1 and covers exactly the three assigned tasks', () => {
  assert.equal(config.schemaVersion, 1)
  assert.equal(config.batch, 'B20')
  assert.equal(config.phase, 'phase-1')
  assert.equal(config.mode, 'static-and-synthetic')
  assert.equal(config.status, 'static-foundation')
  assert.equal(config.runtimeDecision, 'BLOCKED')
  assert.deepEqual(config.tasks.map((task) => task.id), [
    'V2-B20-COM-004',
    'V2-B20-DR-005',
    'V2-B20-TEST-006',
  ])
  assert.deepEqual(config.qualityGates.map((gate) => gate.id), [
    'B20-COM-004-ENTITLEMENT',
    'B20-COM-004-PAYMENT',
    'B20-COM-004-REFUND-RECONCILIATION',
    'B20-DR-005-BACKUP',
    'B20-DR-005-RECOVERY',
    'B20-DR-005-OBSERVABILITY',
    'B20-TEST-006-RELEASE-EVIDENCE',
  ])
  for (const task of config.tasks) {
    assert.equal(task.status, 'defined')
    assert.equal(task.runtimeRequired, true)
    assert.equal(task.defaultDecision, 'deny')
  }
})

test('payment is sandbox-only, default closed, qualified and fail-closed', () => {
  const gate = config.commerce.featureGate
  assert.equal(gate.paymentsEnabledByDefault, false)
  assert.equal(gate.liveProviderEnabled, false)
  assert.equal(gate.providerMode, 'sandbox-only')
  assert.deepEqual(gate.liveProviders, [])
  assert.equal(gate.liveProvidersMustRemainEmpty, true)
  assert.equal(gate.liveEnvironmentOverrideAllowed, false)
  assert.equal(gate.missingQualificationDecision, 'deny')
  assert.deepEqual(gate.sandboxProviders, ['sandbox-hmac'])

  const controls = config.commerce.controls
  assert.deepEqual(controls.callbackVerification.verificationOrder, [
    'provider-allowlist',
    'canonical-payload-binding',
    'signature-verification',
    'provider-event-dedupe',
    'order-amount-currency-binding',
    'pending-attempt-state',
    'fact-write-and-outbox',
  ])
  assert.equal(controls.callbackVerification.rejectUnverified, true)
  assert.equal(controls.callbackVerification.sameEventSameDigestDecision, 'idempotent-no-second-effect')
  assert.equal(controls.callbackVerification.sameEventDifferentDigestDecision, 'reject-and-audit')
  assert.equal(controls.amountBinding.bindTo, 'server-order-price-snapshot')
  assert.equal(controls.amountBinding.clientAmountAuthority, false)
  assert.equal(controls.amountBinding.mismatchDecision, 'reject-and-audit')
  assert.equal(controls.replayProtection.callbackReceiptUnique, true)
  assert.equal(controls.replayProtection.noSecondEntitlementGrant, true)
  assert.equal(controls.replayProtection.noSecondRefundEffect, true)
  assert.equal(controls.refunds.amountCeiling, 'paid-minus-refunded')
  assert.equal(controls.refunds.idempotencyRequired, true)
  assert.equal(controls.refunds.refundCallbackAmountBound, true)
  assert.equal(controls.reconciliation.factOwner, 'commerce-service')
  assert.equal(controls.reconciliation.immutableDomainFacts, true)
  assert.equal(controls.reconciliation.requiresPostRecoveryRun, true)
})

test('synthetic commerce fixtures contain no real identity or provider credential', () => {
  const fixture = config.commerce.syntheticFixtures
  assert.equal(fixture.syntheticOnly, true)
  assert.equal(fixture.tenant, 'platform')
  assert.match(fixture.subject, /^synthetic-/)
  assert.match(fixture.orderId, /^order-/)
  assert.equal(typeof fixture.amountMinor, 'number')
  assert.equal(fixture.currency, 'CNY')
  const serialized = JSON.stringify(fixture)
  assert.doesNotMatch(serialized, /Bearer\s|sk-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]+\.|@/i)
  assert.doesNotMatch(serialized, /paymentCredential|accessToken|refreshToken|rawAudio|webhookBody/i)
})

test('disaster recovery covers MySQL, Redis, Kafka and object storage without claiming runtime success', () => {
  const dr = config.disasterRecovery
  assert.deepEqual(dr.systems.map((system) => system.id), ['mysql', 'redis', 'kafka', 'object-storage'])
  assert.equal(dr.systems.find((system) => system.id === 'mysql').pitr, true)
  assert.equal(dr.systems.find((system) => system.id === 'object-storage').pitr, true)
  assert.equal(dr.targets.status, 'target-not-measured')
  assert.equal(dr.targets.measurementRequired, true)
  for (const system of dr.systems) {
    assert.equal(typeof dr.targets.rpoMinutes[system.id], 'number')
    assert.equal(typeof dr.targets.rtoMinutes[system.id], 'number')
  }
  assert.equal(dr.recoveryDrills.length, 4)
  for (const drill of dr.recoveryDrills) assert.equal(drill.status, 'pending')
  assert.equal(dr.faultInjection.productionEnabled, false)
  assert.equal(dr.faultInjection.requiresChangeWindow, true)
  for (const safety of ['bounded-retry', 'visible-degradation', 'no-duplicate-entitlement', 'no-duplicate-refund', 'manual-recovery-record']) assert.ok(dr.faultInjection.expectedSafety.includes(safety))
  assert.equal(dr.postRecoveryReconciliation.required, true)
  assert.equal(dr.postRecoveryReconciliation.mismatchDecision, 'hold-and-manual-recovery')
  assert.equal(dr.postRecoveryReconciliation.successStatus, 'MATCHED_AFTER_RECOVERY')
})

test('runtime checks and runtime evidence remain pending; static checks never masquerade as runtime', () => {
  const runtime = runtimeChecks()
  const statics = staticChecks()
  assert.ok(runtime.length >= 7)
  assert.ok(statics.length >= 7)
  for (const check of runtime) {
    assert.ok(['pending', 'blocked'].includes(check.status), `${check.id} must not claim pass`)
    assert.equal(check.evidenceClass, 'runtime')
    assert.equal(check.runtimeRequired, true)
    for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) assert.ok(check[field].length > 0, `${check.id}.${field} is incomplete`)
  }
  for (const check of statics) {
    assert.equal(check.status, 'defined')
    assert.equal(check.evidenceClass, 'static')
    assert.equal(check.runtimeRequired, false)
  }
  for (const gate of config.qualityGates) assert.equal(gate.decision, 'BLOCKED')
  for (const item of config.evidenceIndex.filter((item) => item.class === 'runtime')) {
    assert.ok(['pending', 'blocked'].includes(item.status))
    assert.equal(item.runtimeRequired, true)
    assert.equal(item.collectionPolicy, 'runtime-runner-only')
  }
  assert.equal(config.runtimeGate.staticOnlyByDefault, true)
  assert.ok(config.runtimeGate.requiredEnv.every((name) => /^B20_RUNTIME_[A-Z0-9_]+$/.test(name)))
})

test('release evidence policy blocks missing gates, requires two reviewers and keeps rollback unresolved', () => {
  const release = config.releaseGate
  assert.equal(release.status, 'BLOCKED')
  assert.equal(release.defaultDecision, 'deny')
  assert.equal(release.requiresAllAssignedTasks, true)
  for (const task of ['V2-B20-SEC-001', 'V2-B20-PRI-002', 'V2-B20-CNT-003', 'V2-B20-COM-004', 'V2-B20-DR-005']) assert.ok(release.requiredUpstreamTasks.includes(task))
  for (const blocker of ['any-required-evidence-missing', 'runtime-evidence-pending-or-blocked', 'artifact-hash-missing-or-invalid', 'live-provider-or-unqualified-payment', 'restore-or-reconciliation-unmeasured', 'single-reviewer-or-conflicted-reviewer', 'open-p0-or-p1', 'rollback-conclusion-missing']) assert.ok(release.blockingConditions.includes(blocker))
  assert.equal(release.dualReview.required, true)
  assert.equal(release.dualReview.independentReviewers, true)
  assert.equal(release.dualReview.minimumReviewers, 2)
  assert.equal(release.dualReview.samePersonCannotSatisfyBoth, true)
  assert.equal(release.dualReview.reviewRecordStatus, 'not-present')
  assert.equal(release.riskAcceptance.defaultStatus, 'not-present')
  assert.equal(release.riskAcceptance.requiresExpiration, true)
  assert.equal(release.riskAcceptance.cannotAcceptP0, true)
  assert.equal(release.riskAcceptance.cannotOpenLivePayment, true)
  assert.equal(release.rollback.defaultStatus, 'not-established')
  assert.equal(release.rollback.conclusionStatus, 'not-established')
  assert.equal(release.rollback.requiresDrillEvidence, true)
})

test('evidence index is closed and report schema rejects unknown fields', () => {
  const evidenceIds = new Set(config.evidenceIndex.map((item) => item.id))
  for (const check of checks()) assert.ok(evidenceIds.has(check.evidenceId), `missing evidence ${check.evidenceId}`)
  for (const check of checks()) for (const evidenceId of check.supportingEvidenceIds ?? []) assert.ok(evidenceIds.has(evidenceId), `missing supporting evidence ${evidenceId}`)
  for (const gate of config.qualityGates) for (const evidenceId of gate.evidenceIds) assert.ok(evidenceIds.has(evidenceId), `missing gate evidence ${evidenceId}`)
  const schema = config.reportSchema.jsonSchema
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)
  for (const field of ['schemaVersion', 'reportId', 'batch', 'decision', 'gates', 'evidence', 'review', 'riskAcceptance', 'rollback']) assert.ok(schema.required.includes(field))
  for (const field of ['gates', 'evidence', 'review', 'riskAcceptance', 'rollback']) assert.ok(schema.properties[field])
})

test('B20 commerce/DR evidence validator passes only the static contract', () => {
  const result = spawnSync(process.execPath, [validatorPath], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /"result": "PASS"/)
  assert.match(result.stdout, /"runtimeEvidencePending": 15/)
})

test('B20 commerce/DR validator blocks a requested runtime run without external evidence', () => {
  const environment = { ...process.env, B20_REQUIRE_RUNTIME: '1' }
  for (const name of config.runtimeGate.requiredEnv) delete environment[name]
  const result = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    encoding: 'utf8',
    env: environment,
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime gate blocked; missing environment/)
})
