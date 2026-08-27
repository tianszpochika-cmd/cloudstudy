import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateG0ScopeGovernance } from '../../scripts/runtime/validate-g0-scope-governance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/g0-scope-governance.json'), 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('G0 static governance contract passes without promoting business completion', () => {
  const result = validateG0ScopeGovernance(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS')
  assert.equal(result.gate, 'G0')
  assert.equal(result.defaultDecision, 'BLOCKED')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.staticChecks, 5)
  assert.equal(result.runtimeEvidencePending, 3)
})

test('G0 runtime request fails closed when real signoff evidence is absent', () => {
  const result = validateG0ScopeGovernance(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('missing environment:')))
  assert.ok(result.errors.some((error) => error.includes('approved external runner')))
})

test('G0 source-backed marker tampering fails the static Gate', () => {
  const candidate = clone(manifest)
  candidate.checks[0].assertions.push({ contains: 'marker-that-does-not-exist' })
  const result = validateG0ScopeGovernance(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('missing source marker marker-that-does-not-exist')))
})

test('G0 cannot unlock Phase 2/3 through a static manifest', () => {
  const candidate = clone(manifest)
  candidate.scope.phaseLocks[0].defaultEnabled = true
  candidate.scope.phaseLocks[1].defaultRoute = 'allow'
  const result = validateG0ScopeGovernance(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('phase-2 must be locked and deny by default')))
  assert.ok(result.errors.some((error) => error.includes('phase-3 must be locked and deny by default')))
})

test('G0 rejects client authority facts and unsafe conflict promotion', () => {
  const candidate = clone(manifest)
  candidate.scope.clientAuthority.forbiddenFacts = candidate.scope.clientAuthority.forbiddenFacts.filter((fact) => fact !== 'tenantId')
  candidate.conflictPolicy.onConflict = 'WARN'
  const result = validateG0ScopeGovernance(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('client authority fact tenantId must be forbidden')))
  assert.ok(result.errors.some((error) => error.includes('conflict handling must block')))
})
