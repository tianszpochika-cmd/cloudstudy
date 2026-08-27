import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateB27Handoff } from '../../scripts/runtime/validate-b27-handoff.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifestPath = path.join(root, 'config/b27-handoff.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('B27 RC and handoff static contract passes while release remains BLOCKED/NO-GO', () => {
  const result = validateB27Handoff(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS', result.errors.join('\n'))
  assert.equal(result.batch, 'B27')
  assert.equal(result.taskCount, 2)
  assert.equal(result.staticChecks, 6)
  assert.equal(result.runtimeChecks, 10)
  assert.equal(result.evidenceCount, 17)
  assert.equal(result.runtimeEvidencePending, 11)
  assert.equal(result.status, 'BLOCKED')
  assert.equal(result.releaseDecision, 'NO-GO')
  assert.equal(result.runtimeGate, 'static-only')
})

test('runtime request fails closed when external evidence variables are absent', () => {
  const result = validateB27Handoff(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('runtime gate blocked; missing environment:')))
})

test('runtime request cannot promote synthetic or pending evidence', () => {
  const env = Object.fromEntries(manifest.runtimeGate.requiredEnv.map((name) => [name, `pending-${name.toLowerCase()}`]))
  const result = validateB27Handoff(manifest, { runtimeRequested: true, env })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('cannot use a synthetic or placeholder evidence reference')))
  assert.ok(result.errors.some((error) => error.includes('B23-B26/B15-B22 upstream gates are not accepted')))
})

test('unsafe default GO, open traffic and incomplete role governance are rejected', () => {
  const candidate = clone(manifest)
  candidate.defaultDecision = 'GO'
  candidate.goNoGo.productionTrafficAllowed = true
  candidate.roleGovernance.roleDecisions.pop()
  const result = validateB27Handoff(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('default decision must be NO-GO')))
  assert.ok(result.errors.some((error) => error.includes('production traffic and real payment must remain disabled')))
  assert.ok(result.errors.some((error) => error.includes('role decisions must cover every required role in order')))
})

test('rollback requires an owner, immutable restore point and reconciliation sequence', () => {
  const candidate = clone(manifest)
  candidate.rollback.owner.required = false
  candidate.rollback.restorePoint.reference = 'restore-point-ref://real/production'
  candidate.rollback.rollbackSequence = ['stop-expansion-and-freeze-writes']
  const result = validateB27Handoff(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('rollback owner must be required and unassigned')))
  assert.ok(result.errors.some((error) => error.includes('restore point must be required but not-established')))
  assert.ok(result.errors.some((error) => error.includes('rollback.rollbackSequence must contain at least 8 item(s)')))
})

test('P0/P1 defects block while P2 requires ownership and disposition', () => {
  const candidate = clone(manifest)
  candidate.knownIssues[0].blocksRelease = false
  candidate.knownIssues[3].ownerRole = ''
  const result = validateB27Handoff(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('B27-P0-001 release-blocking policy is invalid')))
  assert.ok(result.errors.some((error) => error.includes('B27-P2-001.ownerRole must be a non-empty string')))
})

test('manifest and validator contain no obvious credentials or PII', () => {
  const serialized = JSON.stringify(manifest)
  const validatorSource = fs.readFileSync(path.join(root, 'scripts/runtime/validate-b27-handoff.mjs'), 'utf8')
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~-]+/i)
  assert.doesNotMatch(serialized, /\bsk-[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /\bghp_[A-Za-z0-9]/i)
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
  assert.doesNotMatch(validatorSource, /node:child_process/)
  assert.doesNotMatch(validatorSource, /\b(?:spawnSync|execFileSync|execSync|shell)\b/)
})
