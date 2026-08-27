import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateG2ImplementationInteraction } from '../../scripts/runtime/validate-g2-implementation-interaction.mjs'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDirectory, '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/g2-implementation-interaction.json'), 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function runtimeEnv(valueFor = () => '') {
  return Object.fromEntries(manifest.runtimeGate.requiredEnv.map((name) => [name, valueFor(name)]))
}

test('G2 static implementation and interaction contract passes while runtime evidence is pending', () => {
  const result = validateG2ImplementationInteraction(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  assert.equal(result.gate, 'G2')
  assert.equal(result.status, 'PASS')
  assert.equal(result.defaultDecision, 'NO-GO')
  assert.equal(result.runtimeEvidenceStatus, 'pending')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.staticChecks, 10)
  assert.equal(result.runtimeChecks, 8)
})

test('G2 static contract covers four platforms, eight UI states, four performance levels and owner rules', () => {
  assert.deepEqual(manifest.platformMatrix.map((platform) => platform.id), ['mobile', 'learner-web', 'admin-web', 'official-site'])
  assert.deepEqual(manifest.interactionStateContract.states, ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial'])
  assert.deepEqual(manifest.performanceContract.levels.map((level) => level.id), ['Ultra', 'High', 'Medium', 'Performance'])
  assert.equal(manifest.performanceContract.levels.at(-1).fallbackMode, 'static')
  assert.ok(manifest.ownershipContract.services.length >= 12)
  assert.equal(manifest.implementationContract.apiBoundary.external, '/api/v1')
  assert.equal(manifest.implementationContract.apiBoundary.internal, '/internal/v1')
  assert.equal(manifest.implementationContract.apiBoundary.writeIdempotencyHeader, 'Idempotency-Key')
  assert.equal(manifest.implementationContract.apiBoundary.offlineEventKey, 'clientEventId')
})

test('runtime request fails closed when no external evidence is supplied', () => {
  const result = validateG2ImplementationInteraction(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('runtime gate blocked; missing environment:')))
})

test('deleting a required source marker fails the static gate', () => {
  const candidate = clone(manifest)
  const check = candidate.staticChecks.find((item) => item.id === 'G2-STATIC-ARCH-MAP')
  const sourcePath = 'docs/02-architecture/v2-platform-capability-matrix.md'
  const source = fs.readFileSync(path.join(root, sourcePath), 'utf8')
  candidate.staticChecks.find((item) => item.id === 'G2-STATIC-ARCH-MAP').assertions.push({ contains: 'G2_SOURCE_MARKER_DELETED' })
  const result = validateG2ImplementationInteraction(candidate, {
    runtimeRequested: false,
    env: {},
    sourceOverrides: { [sourcePath]: source.replace('ARCH-API-001', '') },
  })
  assert.equal(check.id, 'G2-STATIC-ARCH-MAP')
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('missing source marker G2_SOURCE_MARKER_DELETED')))
})

test('forbidden Phase 2 AI capability cannot pass the Phase 1 static gate', () => {
  const candidate = clone(manifest)
  candidate.phasePolicy.generationAI = 'enabled'
  const result = validateG2ImplementationInteraction(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('generationAI must remain disabled')))
})

test('synthetic or HTTP-200 references cannot become runtime production evidence', () => {
  const env = runtimeEnv((name) => name.includes('FRONTEND') ? 'http-200' : `evidence://synthetic/${name}`)
  const result = validateG2ImplementationInteraction(manifest, { runtimeRequested: true, env })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('cannot be used as external runtime evidence reference')))
  assert.ok(result.errors.some((error) => error.includes('runtime evidence remains pending or blocked')))
})

test('static PASS cannot be promoted by forged runtime status or a production GO default', () => {
  const candidate = clone(manifest)
  candidate.runtimeEvidenceStatus = 'captured'
  candidate.runtimeGate.status = 'accepted'
  candidate.runtimeChecks.forEach((check) => { check.status = 'captured' })
  candidate.defaultDecision = 'GO'
  candidate.productionAction = 'enabled'
  const env = runtimeEnv((name) => `https://evidence.example/g2/${name.toLowerCase()}/report.json`)
  const result = validateG2ImplementationInteraction(candidate, { runtimeRequested: true, env })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('static G2 status must be PASS') === false || error.includes('runtime gate')))
  assert.ok(result.errors.some((error) => error.includes('runtime gate must remain blocked') || error.includes('runtime gate')))
})

test('manifest and source-backed implementation evidence contain no obvious credentials or PII', () => {
  const result = validateG2ImplementationInteraction(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  const serialized = JSON.stringify(manifest)
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~-]+/i)
  assert.doesNotMatch(serialized, /\bsk-[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
})
