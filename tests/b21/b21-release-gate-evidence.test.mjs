import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateB21ReleaseGateEvidence } from '../../scripts/runtime/validate-b21-release-gate-evidence.mjs'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(testDirectory, '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/b21-release-gate-evidence.json'), 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('B21 release gate manifest passes static validation', () => {
  const result = validateB21ReleaseGateEvidence(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  assert.equal(result.batch, 'B21')
  assert.equal(result.taskCount, 2)
  assert.equal(result.qualityGateCount, 2)
  assert.equal(result.runtimeGate, 'static-only')
})

test('B21 task scope is limited to GATE-005 and TEST-006', () => {
  assert.deepEqual(manifest.tasks.map((task) => task.id), ['V2-B21-GATE-005', 'V2-B21-TEST-006'])
  assert.deepEqual(manifest.qualityGates.map((gate) => gate.task), ['V2-B21-GATE-005', 'V2-B21-TEST-006'])
})

test('Go/No-Go defaults to NO-GO and blocks incomplete B20 prerequisites', () => {
  assert.equal(manifest.releaseGate.defaultDecision, 'NO-GO')
  assert.equal(manifest.releaseGate.status, 'BLOCKED')
  assert.equal(manifest.b20Prerequisite.status, 'blocked')
  assert.equal(manifest.b20Prerequisite.acceptanceEvidenceStatus, 'pending')
  assert.equal(manifest.releaseGate.rollback.ownerStatus, 'not-assigned')
})

test('report schema is closed and requires binding, hashes, roles and reproducibility', () => {
  const schema = manifest.reportSchema.jsonSchema
  assert.equal(manifest.reportSchema.closed, true)
  assert.equal(schema.additionalProperties, false)
  for (const field of ['releaseCandidate', 'roles', 'evidence', 'artifactBindings', 'reproducibility', 'reportHash']) {
    assert.ok(schema.required.includes(field), `${field} must be required`)
  }
  assert.equal(schema.properties.decisionPolicy.properties.missingEvidenceDecision.const, 'NO-GO')
})

test('unsafe promotion to GO is rejected by the validator', () => {
  const candidate = clone(manifest)
  candidate.releaseGate.defaultDecision = 'GO'
  const result = validateB21ReleaseGateEvidence(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('default decision must be NO-GO')))
})

test('runtime mode remains blocked when external evidence variables are absent', () => {
  const result = validateB21ReleaseGateEvidence(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('runtime gate blocked; missing environment:')))
})

test('runtime mode cannot be promoted by synthetic fixtures even with env placeholders', () => {
  const env = Object.fromEntries(manifest.runtimeGate.requiredEnv.map((name) => [name, `synthetic-${name.toLowerCase()}`]))
  const result = validateB21ReleaseGateEvidence(manifest, { runtimeRequested: true, env })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('runtime evidence remains pending')))
  assert.equal(manifest.syntheticFixtures.fixturePolicy.includes('no-pii'), true)
})

test('manifest contains no obvious credentials or personal data', () => {
  const serialized = JSON.stringify(manifest)
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~-]+/i)
  assert.doesNotMatch(serialized, /\bsk-[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
})
