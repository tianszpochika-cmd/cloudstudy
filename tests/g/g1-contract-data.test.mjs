import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateG1ContractData } from '../../scripts/runtime/validate-g1-contract-data.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/g1-contract-data.json'), 'utf8'))

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('G1 static contract/data Gate passes with canonical/generated parity and remains BLOCKED', () => {
  const result = validateG1ContractData(manifest, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'PASS')
  assert.equal(result.gate, 'G1')
  assert.equal(result.defaultDecision, 'BLOCKED')
  assert.equal(result.runtimeGate, 'static-only')
  assert.equal(result.operationCount, 410)
  assert.equal(result.schemaCount, 741)
  assert.equal(result.eventCount, 183)
  assert.equal(result.payloadSchemaCount, manifest.contractSources.asyncapi.expectedPayloadSchemaCount)
  assert.equal(result.dataOwnerCount, 15)
})

test('G1 runtime request fails closed when live diff and migration evidence are absent', () => {
  const result = validateG1ContractData(manifest, { runtimeRequested: true, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.equal(result.runtimeGate, 'blocked')
  assert.ok(result.errors.some((error) => error.includes('missing environment:')))
  assert.ok(result.errors.some((error) => error.includes('approved external runner')))
})

test('G1 source-backed marker tampering fails the static Gate', () => {
  const candidate = clone(manifest)
  candidate.checks[0].assertions.push({ contains: 'marker-that-does-not-exist' })
  const result = validateG1ContractData(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('missing source marker marker-that-does-not-exist')))
})

test('G1 operationId contract conflict is rejected instead of hidden by generated files', () => {
  const candidate = clone(manifest)
  candidate.contractSources.openapi.expectedOperationCount = 405
  const result = validateG1ContractData(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('OpenAPI operation count mismatch')))
})

test('G1 Phase 2/3 and client authority facts cannot be enabled through contract metadata', () => {
  const candidate = clone(manifest)
  candidate.phaseBoundary.futurePhases[0].defaultEnabled = true
  candidate.stateAndSecurityPolicy.forbiddenClientAuthorityFacts = candidate.stateAndSecurityPolicy.forbiddenClientAuthorityFacts.filter((fact) => fact !== 'tenantId')
  const result = validateG1ContractData(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('phase-2 contract route must be disabled/deny by default')))
  assert.ok(result.errors.some((error) => error.includes('client authority fact tenantId must be forbidden')))
})

test('G1 shared owner/Redis namespace or cross-service write widening is rejected', () => {
  const candidate = clone(manifest)
  candidate.dataOwnership.services[1].redisNamespace = candidate.dataOwnership.services[2].redisNamespace
  candidate.dataOwnership.services[3].writeBoundary = 'shared-table-write'
  candidate.crossServiceWritePolicy.defaultDecision = 'allow'
  const result = validateG1ContractData(candidate, { runtimeRequested: false, env: {} })
  assert.equal(result.result, 'FAIL')
  assert.ok(result.errors.some((error) => error.includes('service Redis namespaces must be unique')))
  assert.ok(result.errors.some((error) => error.includes('content-service write boundary is unsafe')))
  assert.ok(result.errors.some((error) => error.includes('cross-service write policy must default deny')))
})
