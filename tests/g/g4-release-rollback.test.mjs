import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateG4ReleaseRollback } from '../../scripts/runtime/validate-g4-release-rollback.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifestPath = path.join(root, 'config/g4-release-rollback.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function assertStaticFailure(candidate, message) {
  const result = validateG4ReleaseRollback(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes(message)), `expected error containing: ${message}\n${result.errors.join('\n')}`)
}

test('G4 static contract passes while release remains BLOCKED/NO-GO/disabled', () => {
  const result = validateG4ReleaseRollback(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS')
  assert.equal(result.status, 'BLOCKED')
  assert.equal(result.releaseDecision, 'NO-GO')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.staticChecks, 10)
  assert.equal(result.runtimeChecks, 12)
  assert.equal(result.evidenceCount, 22)
})

test('runtime request fails closed when external evidence variables are absent', () => {
  const result = validateG4ReleaseRollback(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('runtime gate blocked; missing environment:')))
})

test('unsafe default GO is rejected', () => {
  const candidate = clone(manifest)
  candidate.defaultDecision = 'GO'
  assertStaticFailure(candidate, 'G4 default decision must be NO-GO')
})

test('opening traffic is rejected by the static baseline', () => {
  const candidate = clone(manifest)
  candidate.trafficPlan.trafficSwitchAllowed = true
  assertStaticFailure(candidate, 'traffic plan must be blocked, disabled and manual')
})

test('mutable image references are rejected', () => {
  const candidate = clone(manifest)
  candidate.immutableArtifactPolicy.artifacts[0].image = 'registry.example.invalid/englishflow/api-gateway:latest'
  assertStaticFailure(candidate, 'must use an immutable digest image')
})

test('missing restore point is rejected', () => {
  const candidate = clone(manifest)
  candidate.backupRestore.restorePoint = null
  assertStaticFailure(candidate, 'restore point must be required, immutable and not-established')
})

test('missing compatibility window is rejected', () => {
  const candidate = clone(manifest)
  candidate.compatibilityWindow = null
  assertStaticFailure(candidate, 'compatibility window must remain pending and runtime-required')
})

test('content and payment gates cannot be opened in the static baseline', () => {
  const candidate = clone(manifest)
  candidate.contentGate.defaultDecision = 'GO'
  candidate.paymentGate.realPaymentEnabled = true
  const result = validateG4ReleaseRollback(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('content Gate must remain blocked/NO-GO/runtime-required')))
  assert.ok(result.errors.some((error) => error.includes('real payment must remain disabled until qualification')))
})

test('static source assertions fail when a deployment marker is removed', () => {
  const candidate = clone(manifest)
  candidate.releaseChecks.staticChecks[0].assertions.push({ contains: 'marker-that-is-not-present' })
  assertStaticFailure(candidate, 'g4-static-immutable-artifact missing source marker marker-that-is-not-present')
})

test('validator uses no external command execution and fixtures contain no credentials or PII', () => {
  const validatorSource = fs.readFileSync(path.join(root, 'scripts/runtime/validate-g4-release-rollback.mjs'), 'utf8')
  assert.doesNotMatch(validatorSource, /node:child_process/)
  assert.doesNotMatch(validatorSource, /\b(?:spawnSync|execFileSync|execSync|shell)\b/)
  const serialized = JSON.stringify(manifest)
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~-]+/i)
  assert.doesNotMatch(serialized, /\bsk-[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
  for (const relativePath of [
    'deploy/g4/base/release-gate.yaml',
    'deploy/g4/base/rollout.yaml',
    'deploy/g4/base/feature-flags.yaml',
    'deploy/g4/base/backup-restore.yaml',
    'deploy/g4/base/compatibility-window.yaml',
    'deploy/g4/base/network-policy.yaml',
    'deploy/g4/base/maintenance-approval.yaml',
    'deploy/g4/gitops/application-production.yaml',
    'deploy/g4/oci/image-lock.yaml',
  ]) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
    assert.doesNotMatch(source, /-----BEGIN|Bearer\s+eyJ|AKIA[0-9A-Z]{16}/i)
  }
})
