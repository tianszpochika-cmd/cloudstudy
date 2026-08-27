import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { validateB21ObservabilityRc } from '../../scripts/runtime/validate-b21-observability-rc.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(root, 'config', 'b21-observability-rc.json')
const validatorPath = path.join(root, 'scripts', 'runtime', 'validate-b21-observability-rc.mjs')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

function checks() {
  return manifest.qualityGates.flatMap((gate) => [
    ...(gate.staticChecks ?? []),
    ...(gate.runtimeChecks ?? []),
  ])
}

function cleanEnvironment() {
  const environment = { ...process.env }
  delete environment.B21_REQUIRE_RUNTIME
  for (const name of manifest.runtimeGate.requiredEnv) delete environment[name]
  return environment
}

test('B21 OBS/RC manifest is Phase 1, limited to OBS-003 and RC-004, and closed by default', () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.batch, 'B21')
  assert.equal(manifest.phase, 'phase-1')
  assert.equal(manifest.mode, 'static-and-synthetic')
  assert.equal(manifest.status, 'static-foundation')
  assert.deepEqual(manifest.tasks.map((task) => task.id), ['V2-B21-OBS-003', 'V2-B21-RC-004'])
  assert.equal(manifest.execution.mode, 'static-fixture-only')
  assert.equal(manifest.execution.status, 'runtimeBlocked')
  assert.equal(manifest.execution.runtimeBlocked, true)
  assert.equal(manifest.execution.allowUnverifiedPass, false)
  assert.equal(manifest.execution.runtimeEvidence, null)
  assert.equal(manifest.releaseGate.status, 'BLOCKED')
  assert.equal(manifest.releaseGate.defaultDecision, 'NO-GO')
  assert.ok(manifest.execution.blockedReasons.length >= 3)
})

test('observability policy covers OTel signals, SLO/error budget, routing, ownership, dashboards and drills', () => {
  const observability = manifest.observability
  assert.equal(observability.runtimeStatus, 'pending')
  assert.equal(observability.signalStandard.provider, 'OpenTelemetry')
  assert.deepEqual(observability.signalStandard.signals, ['traces', 'metrics', 'logs'])
  for (const field of ['requestId', 'traceId', 'eventId', 'decisionId']) assert.ok(observability.signalStandard.correlationFields.includes(field))
  assert.equal(observability.signalStandard.sensitiveDataPolicy, 'redact-or-do-not-record')
  assert.equal(observability.errorBudget.status, 'target-not-measured')
  assert.equal(observability.errorBudget.exhaustionDecision, 'freeze-release-and-page')
  assert.deepEqual(observability.alertRouting.severityLevels, ['P0', 'P1', 'P2'])
  assert.equal(observability.alertRouting.silence.status, 'not-executed')
  assert.equal(observability.alertRouting.silence.requiresReason, true)
  assert.equal(observability.alertRouting.silence.requiresOwner, true)
  assert.equal(observability.alertRouting.silence.requiresExpiry, true)
  assert.equal(observability.alertRouting.silence.expiryMustPage, true)
  assert.equal(observability.onCall.handoffRequiresAudit, true)
  assert.equal(observability.onCall.noOwnerDecision, 'page-platform-and-block-release')
  assert.equal(observability.dashboards.length, 3)
  assert.equal(observability.incidentDrills.length, 3)
  for (const drill of observability.incidentDrills) assert.equal(drill.status, 'pending')
})

test('RC policy requires immutable signed artifacts, digest consistency, selected regression and rollback evidence', () => {
  const candidate = manifest.releaseCandidate
  const artifact = candidate.immutableArtifactPolicy
  assert.equal(artifact.referenceMode, 'oci-digest-only')
  assert.equal(artifact.mutableTagAllowed, false)
  assert.equal(artifact.sourceCommitRequired, true)
  assert.equal(artifact.lockfileDigestRequired, true)
  assert.equal(artifact.sbomRequired, true)
  assert.equal(artifact.provenanceRequired, true)
  assert.equal(artifact.signature.scheme, 'cosign')
  assert.equal(artifact.signature.keySource, 'external-approved-kms-or-vault')
  assert.equal(artifact.signature.verificationBeforeDeploy, true)
  assert.equal(artifact.signature.status, 'pending')
  assert.deepEqual(artifact.consistency.requiredBindings, ['sourceCommit', 'lockfileDigest', 'imageDigest', 'manifestDigest', 'sbomDigest', 'signatureDigest'])
  assert.equal(artifact.consistency.mismatchDecision, 'BLOCKED')
  assert.deepEqual(candidate.regressionPolicy.minimumSuites, ['phase1-smoke', 'quality-static'])
  for (const domain of ['contracts', 'e2e', 'browser-device', 'performance', 'security']) assert.ok(candidate.regressionPolicy.requiredDomains.includes(domain))
  assert.equal(candidate.zeroBlockingDefects.status, 'not-established')
  assert.equal(candidate.zeroBlockingDefects.noOpenRuntimeBlockers, true)
  assert.equal(candidate.rollbackPoint.status, 'not-established')
  assert.equal(candidate.rollbackPoint.owner, null)
  assert.equal(candidate.rollbackPoint.artifactRef, null)
  assert.equal(candidate.rollbackPoint.restorePointRef, null)
})

test('quality gates are source-backed and every evidence entry separates static from runtime', () => {
  assert.deepEqual(manifest.qualityGates.map((gate) => gate.id), [
    'B21-OBS-003-SLO',
    'B21-OBS-003-ALERTING',
    'B21-OBS-003-INCIDENT',
    'B21-RC-004-IMMUTABLE',
    'B21-RC-004-REGRESSION',
    'B21-RC-004-GATE',
  ])
  const evidence = new Map(manifest.evidenceIndex.map((item) => [item.id, item]))
  const staticChecks = checks().filter((check) => check.evidenceClass === 'static')
  const runtimeChecks = checks().filter((check) => check.evidenceClass === 'runtime')
  assert.equal(staticChecks.length, 6)
  assert.equal(runtimeChecks.length, 6)
  for (const check of staticChecks) {
    assert.equal(check.status, 'defined')
    assert.equal(check.runtimeRequired, false)
    assert.ok(check.sourcePaths.length > 0)
    assert.ok(check.assertions.length > 0)
    assert.ok(check.policyAssertions.length > 0)
    assert.equal(evidence.get(check.evidenceId).class, 'static')
    assert.equal(evidence.get(check.evidenceId).status, 'defined')
  }
  for (const check of runtimeChecks) {
    assert.equal(check.status, 'pending')
    assert.equal(check.runtimeRequired, true)
    assert.equal(check.evidenceClass, 'runtime')
    for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) assert.ok(check[field].length > 0)
    assert.doesNotMatch(JSON.stringify(check).toLowerCase(), /\b(pass|passed|captured|verified)\b/)
    assert.equal(evidence.get(check.evidenceId).status, 'pending')
    assert.equal(evidence.get(check.evidenceId).collectionPolicy, 'runtime-runner-only')
  }
})

test('RC release gate is explicitly coupled to B20 and remains NO-GO until B20 is fully accepted', () => {
  const prerequisite = manifest.releaseGate.b20Prerequisite
  assert.equal(prerequisite.required, true)
  assert.equal(prerequisite.requiredBatch, 'B20')
  assert.equal(prerequisite.currentDecision, 'BLOCKED')
  assert.equal(prerequisite.decisionRequiredForGo, 'PASS')
  assert.equal(prerequisite.whenNotPass, 'NO-GO')
  assert.equal(prerequisite.staticValidatorCannotOverride, true)
  for (const task of ['V2-B20-SEC-001', 'V2-B20-PRI-002', 'V2-B20-CNT-003', 'V2-B20-COM-004', 'V2-B20-DR-005', 'V2-B20-TEST-006']) assert.ok(prerequisite.requiredTasks.includes(task))
  for (const blocker of ['b20-gate-not-pass', 'runtime-evidence-pending-or-blocked', 'unsigned-or-mutable-artifact', 'open-p0-or-p1', 'rollback-point-or-drill-missing']) assert.ok(manifest.releaseGate.blockingConditions.includes(blocker))
  assert.equal(manifest.releaseGate.zeroBlockingDefects.openP0, 0)
  assert.equal(manifest.releaseGate.zeroBlockingDefects.openP1, 0)
  assert.equal(manifest.releaseGate.dualReview.minimumReviewers, 2)
  assert.equal(manifest.releaseGate.dualReview.reviewRecordStatus, 'not-present')
})

test('synthetic observability and RC fixtures contain references only, never credentials, PII or production data', () => {
  const fixtures = manifest.syntheticFixtures
  assert.equal(fixtures.fixturePolicy, 'synthetic-references-only-no-real-subjects-no-secrets-no-production-data')
  for (const field of ['traceId', 'requestId', 'eventId', 'decisionId']) assert.match(fixtures.trace[field], /ref:\/\/synthetic\//)
  for (const field of ['sourceCommit', 'signatureRef', 'rollbackPoint']) assert.match(fixtures.rc[field], /synthetic/)
  for (const field of ['lockfileDigest', 'imageDigest', 'manifestDigest', 'sbomDigest']) assert.match(fixtures.rc[field], /^sha256:fixture-/)
  const serialized = JSON.stringify(fixtures)
  assert.doesNotMatch(serialized, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i)
  assert.doesNotMatch(serialized, /\bAKIA[0-9A-Z]{16}\b/)
  assert.doesNotMatch(serialized, /Bearer\s+eyJ[A-Za-z0-9_-]+\./i)
  assert.doesNotMatch(serialized, /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.com/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
})

test('B21 validator passes static evidence and rejects premature runtime or GO promotion', () => {
  const staticResult = validateB21ObservabilityRc(manifest, { runtimeRequested: false })
  assert.equal(staticResult.result, 'PASS', JSON.stringify(staticResult, null, 2))
  assert.equal(staticResult.staticChecks, 6)
  assert.equal(staticResult.runtimeChecks, 6)
  assert.equal(staticResult.runtimeEvidencePending, 6)
  assert.equal(staticResult.runtimeBlocked, true)
  assert.equal(staticResult.releaseDecision, 'NO-GO')

  const runtimePromoted = structuredClone(manifest)
  runtimePromoted.qualityGates[0].runtimeChecks[0].status = 'passed'
  assert.equal(validateB21ObservabilityRc(runtimePromoted, { runtimeRequested: false }).result, 'FAIL')

  const goPromoted = structuredClone(manifest)
  goPromoted.releaseGate.defaultDecision = 'GO'
  assert.equal(validateB21ObservabilityRc(goPromoted, { runtimeRequested: false }).result, 'FAIL')
})

test('B21 validator blocks a requested runtime run when staging and external evidence are absent', () => {
  const result = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnvironment(),
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime gate blocked; missing environment/)
  assert.match(`${result.stdout}\n${result.stderr}`, /runtime gate remains blocked/)
})

test('B21 validator source assertions and B20 prerequisite checks execute in the repository', () => {
  const result = spawnSync(process.execPath, [validatorPath], {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnvironment(),
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /"result": "PASS"/)
  assert.match(result.stdout, /"qualityGateCount": 6/)
  assert.match(result.stdout, /"staticChecks": 6/)
  assert.match(result.stdout, /"runtimeChecks": 6/)
  assert.match(result.stdout, /"runtimeEvidencePending": 6/)
  assert.match(result.stdout, /"runtimeBlocked": true/)
  assert.match(result.stdout, /"releaseDecision": "NO-GO"/)
})
