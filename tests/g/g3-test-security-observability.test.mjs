import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { validateG3TestSecurityObservability } from '../../scripts/runtime/validate-g3-test-security-observability.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(root, 'config', 'g3-test-security-observability.json')
const validatorPath = path.join(root, 'scripts', 'runtime', 'validate-g3-test-security-observability.mjs')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

function cleanEnvironment() {
  const environment = { ...process.env }
  delete environment.G3_REQUIRE_RUNTIME
  for (const name of manifest.runtimeGate.requiredEnv) delete environment[name]
  return environment
}

function withRuntimeReferences() {
  const environment = cleanEnvironment()
  for (const name of manifest.runtimeGate.requiredEnv) environment[name] = `external-attestation-ref-${name.toLowerCase()}`
  return environment
}

test('G3 is a Phase 1 static PASS with runtime acceptance closed by default', () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.batch, 'G3')
  assert.equal(manifest.gate, 'G3')
  assert.equal(manifest.phase, 'phase-1')
  assert.equal(manifest.mode, 'static-and-synthetic')
  assert.equal(manifest.status, 'PASS')
  assert.equal(manifest.staticStatus, 'PASS')
  assert.equal(manifest.runtimeStatus, 'blocked')
  assert.equal(manifest.runtimeDecision, 'BLOCKED')
  assert.equal(manifest.defaultDecision, 'NO-GO')
  assert.equal(manifest.execution.runtimeEvidence, null)
  assert.equal(manifest.execution.allowUnverifiedPass, false)
  assert.equal(manifest.execution.staticValidatorCannotPromoteRuntime, true)
  assert.equal(manifest.execution.productionTrafficAllowed, false)
})

test('G3 covers unit, integration, contract and E2E plus security and observability controls', () => {
  assert.deepEqual(manifest.controls.map((control) => control.id), [
    'G3-TEST-UNIT',
    'G3-TEST-INTEGRATION',
    'G3-TEST-CONTRACT',
    'G3-TEST-E2E',
    'G3-SEC-AUTH',
    'G3-REL-IDEMPOTENCY',
    'G3-SEC-PRIVACY',
    'G3-SEC-PERFORMANCE',
    'G3-SEC-PHASE',
    'G3-SEC-SCAN',
    'G3-OBS-CORRELATION',
    'G3-OBS-AUDIT-ALERT',
  ])
  assert.deepEqual(manifest.testPolicy.requiredTestKinds, ['unit', 'integration', 'contract', 'e2e'])
  for (const control of manifest.controls) {
    assert.equal(control.priority, 'P0')
    assert.equal(control.staticPolicy, 'defined')
    assert.equal(control.runtimeStatus, 'pending')
  }
  assert.match(JSON.stringify(manifest.scope), /authorization-and-default-deny/)
  assert.match(JSON.stringify(manifest.scope), /idempotency-and-retry/)
  assert.match(JSON.stringify(manifest.scope), /weak-network-and-offline/)
  assert.match(JSON.stringify(manifest.scope), /privacy-and-redaction/)
  assert.match(JSON.stringify(manifest.scope), /performance-and-adaptive-degradation/)
})

test('static checks are source-backed and runtime checks cannot claim captured evidence', () => {
  const staticChecks = manifest.qualityGates.flatMap((gate) => gate.staticChecks)
  const runtimeChecks = manifest.qualityGates.flatMap((gate) => gate.runtimeChecks)
  assert.equal(staticChecks.length, manifest.controls.length)
  assert.equal(runtimeChecks.length, manifest.controls.length)
  for (const check of staticChecks) {
    assert.equal(check.status, 'defined')
    assert.equal(check.evidenceClass, 'static')
    assert.equal(check.runtimeRequired, false)
    assert.ok(check.sourcePaths.length > 0)
    assert.ok(check.assertions.length > 0)
    assert.ok(check.policyAssertions.length > 0)
  }
  for (const check of runtimeChecks) {
    assert.ok(['pending', 'blocked'].includes(check.status))
    assert.equal(check.evidenceClass, 'runtime')
    assert.equal(check.runtimeRequired, true)
    assert.ok(check.tools.length > 0)
    assert.ok(check.targets.length > 0)
    assert.ok(check.scenarios.length > 0)
    assert.ok(check.evidenceRequired.length > 0)
    assert.ok(check.cannotBeSatisfiedBy.includes('static-manifest-only'))
    assert.ok(check.cannotBeSatisfiedBy.includes('synthetic-fixture-only'))
    assert.doesNotMatch(JSON.stringify(check), /\b(pass|passed|captured|verified|accepted)\b/i)
  }
  assert.equal(manifest.evidenceIndex.filter((item) => item.class === 'static').length, 12)
  assert.equal(manifest.evidenceIndex.filter((item) => item.class === 'runtime').length, 6)
  assert.ok(manifest.evidenceIndex.filter((item) => item.class === 'runtime').every((item) => ['pending', 'blocked'].includes(item.status)))
})

test('authorization, reliability, privacy, performance, AI and observability policies are fail-closed', () => {
  assert.equal(manifest.authorizationPolicy.defaultEffect, 'deny')
  assert.equal(manifest.authorizationPolicy.unknownDecision, 'deny')
  assert.equal(manifest.authorizationPolicy.clientAuthorityTrusted, false)
  assert.equal(manifest.idempotencyAndNetworkPolicy.writeRequestsRequire, 'Idempotency-Key')
  assert.equal(manifest.idempotencyAndNetworkPolicy.duplicateCommandDecision, 'same-result-no-duplicate-write')
  assert.equal(manifest.privacyPolicy.fixtureMode, 'synthetic-only')
  assert.equal(manifest.privacyPolicy.rawPIIAllowed, false)
  assert.deepEqual(manifest.performancePolicy.levels, ['Ultra', 'High', 'Medium', 'Performance'])
  assert.equal(manifest.phasePolicy.aiStatus, 'disabled')
  assert.equal(manifest.phasePolicy.generativeAIEnabled, false)
  assert.equal(manifest.phasePolicy.phase2CapabilitiesInDefaultRoute, false)
  assert.equal(manifest.securityScanPolicy.status, 'pending')
  assert.equal(manifest.observabilityPolicy.provider, 'OpenTelemetry')
  assert.deepEqual(manifest.observabilityPolicy.signals, ['traces', 'metrics', 'logs'])
  assert.deepEqual(manifest.observabilityPolicy.correlationFields, ['requestId', 'traceId', 'eventId', 'decisionId'])
  assert.equal(manifest.observabilityPolicy.audit.appendOnly, true)
  assert.deepEqual(manifest.observabilityPolicy.alerting.severityLevels, ['P0', 'P1', 'P2'])
})

test('exported validator passes the static foundation and reports runtime evidence pending', () => {
  const result = validateG3TestSecurityObservability(manifest, { runtimeRequested: false })
  assert.equal(result.result, 'PASS', JSON.stringify(result, null, 2))
  assert.equal(result.staticStatus, 'PASS')
  assert.equal(result.runtimeStatus, 'pending')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.staticChecks, 12)
  assert.equal(result.runtimeChecks, 12)
  assert.equal(result.runtimeEvidencePending, 6)
  assert.equal(result.runtimeBlocked, true)
  assert.equal(result.releaseDecision, 'NO-GO')
})

test('runtime request fails closed when required external evidence is missing', () => {
  const result = validateG3TestSecurityObservability(manifest, { runtimeRequested: true, env: cleanEnvironment() })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.match(result.errors.join('\n'), /runtime gate blocked; missing environment/)

  const processResult = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnvironment(),
  })
  assert.notEqual(processResult.status, 0)
  assert.match(`${processResult.stdout}\n${processResult.stderr}`, /runtime gate blocked; missing environment/)
})

test('runtime request remains fail closed even when environment variables only contain references', () => {
  const result = validateG3TestSecurityObservability(manifest, { runtimeRequested: true, env: withRuntimeReferences() })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeStatus, 'blocked')
  assert.match(result.errors.join('\n'), /approved runner/)
})

test('deleting a required source marker fails the static Gate', () => {
  const mutated = structuredClone(manifest)
  mutated.qualityGates[0].staticChecks[0].assertions[0] = { contains: 'G3-marker-that-does-not-exist' }
  const result = validateG3TestSecurityObservability(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.staticStatus, 'FAIL')
  assert.match(result.errors.join('\n'), /G3-UNIT-STATIC-001 missing source marker G3-marker-that-does-not-exist/)
})

test('removing source paths fails closed instead of treating an empty assertion as evidence', () => {
  const mutated = structuredClone(manifest)
  mutated.qualityGates[1].staticChecks[0].sourcePaths = []
  const result = validateG3TestSecurityObservability(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /G3-INTEGRATION-STATIC-001\.sourcePaths/)
})

test('forged Phase 2 AI enablement or AI evidence fails the Gate', () => {
  const enabled = structuredClone(manifest)
  enabled.phasePolicy.generativeAIEnabled = true
  let result = validateG3TestSecurityObservability(enabled, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /generativeAIEnabled/)

  const provider = structuredClone(manifest)
  provider.syntheticFixtures.phase2AiProvider = 'provider-ref://external-model'
  result = validateG3TestSecurityObservability(provider, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /Phase 2 AI evidence/)
})

test('forged production evidence or promoted runtime status fails the Gate', () => {
  const production = structuredClone(manifest)
  production.realProductionEvidence = { status: 'verified', source: 'production-run' }
  let result = validateG3TestSecurityObservability(production, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /real production evidence/)

  const promoted = structuredClone(manifest)
  promoted.evidenceIndex.find((item) => item.class === 'runtime').status = 'captured'
  result = validateG3TestSecurityObservability(promoted, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /runtime evidence must remain pending\/blocked/)
})

test('credential or PII material in a fixture is rejected by the validator', () => {
  const mutated = structuredClone(manifest)
  mutated.syntheticFixtures.leakedValue = `Bearer ${'x'.repeat(32)}`
  const result = validateG3TestSecurityObservability(mutated, { runtimeRequested: false })
  assert.equal(result.result, 'FAIL')
  assert.match(result.errors.join('\n'), /credential or PII pattern/)
})
