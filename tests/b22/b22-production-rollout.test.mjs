import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateB22ProductionRollout } from '../../scripts/runtime/validate-b22-production-rollout.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/b22-production-rollout.json'), 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('B22 REL-001 static contract passes while release remains BLOCKED/NO-GO', () => {
  const result = validateB22ProductionRollout(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS')
  assert.equal(result.status, 'BLOCKED')
  assert.equal(result.releaseDecision, 'NO-GO')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.staticChecks, 8)
  assert.equal(result.runtimeChecks, 9)
})

test('runtime request fails closed when external evidence variables are absent', () => {
  const result = validateB22ProductionRollout(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('runtime gate blocked; missing environment:')))
})

test('synthetic runtime references cannot become production evidence', () => {
  const env = Object.fromEntries(manifest.runtimeGate.requiredEnv.map((name) => [name, `synthetic-${name.toLowerCase()}`]))
  const result = validateB22ProductionRollout(manifest, { runtimeRequested: true, env })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('cannot use a synthetic or placeholder evidence reference')))
  assert.ok(result.errors.some((error) => error.includes('B21 Go/No-Go has not been accepted')))
})

test('unsafe default GO is rejected', () => {
  const candidate = clone(manifest)
  candidate.defaultDecision = 'GO'
  const result = validateB22ProductionRollout(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('default decision must be NO-GO')))
})

test('canary cannot be enabled or expanded by the static fixture', () => {
  const candidate = clone(manifest)
  candidate.canaryPlan.stages[0].enabled = true
  candidate.featureFlags.flags[0].defaultValue = true
  const result = validateB22ProductionRollout(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('canary-1 must not be enabled')))
  assert.ok(result.errors.some((error) => error.includes('canary-enabled must default disabled')))
})

test('four platform binding is mandatory and version/digest mismatch is blocked', () => {
  const candidate = clone(manifest)
  candidate.fourPlatformBinding.platforms.pop()
  const result = validateB22ProductionRollout(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('four-platform ids are incomplete')))
})

test('mutable artifact references are rejected', () => {
  const candidate = clone(manifest)
  candidate.immutableArtifactPolicy.artifacts[0].image = 'registry.example.invalid/englishflow/api-gateway:latest'
  const result = validateB22ProductionRollout(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('immutable digest image')))
})

test('source-backed checks require the deployment templates to remain present', () => {
  const candidate = clone(manifest)
  candidate.preReleaseChecks.staticChecks[4].assertions.push({ contains: 'marker-that-is-not-present' })
  const result = validateB22ProductionRollout(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('missing source marker marker-that-is-not-present')))
})

test('manifest and deployment evidence contain no obvious credentials or PII', () => {
  const serialized = JSON.stringify(manifest)
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~-]+/i)
  assert.doesNotMatch(serialized, /\bsk-[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'deploy/b22/oci/image-lock.yaml'), 'utf8'), /-----BEGIN|Bearer\s+eyJ|AKIA[0-9A-Z]{16}/i)
})
