import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const json = (relative) => JSON.parse(read(relative))

test('B26 browser matrix is Phase 1-only and refuses an unverified pass', () => {
  const matrix = json('config/b26-browser-test.json')
  assert.equal(matrix.batch, 'B26')
  assert.equal(matrix.phase, 'phase-1')
  assert.equal(matrix.execution.runtimeBlocked, true)
  assert.equal(matrix.execution.allowUnverifiedPass, false)
  assert.equal(matrix.execution.runtimeEvidence, null)
  assert.deepEqual(matrix.applications.map((app) => app.id), ['learner-web', 'mobile', 'admin-web', 'official-site'])
  assert.doesNotMatch(JSON.stringify(matrix), /Bearer\s+eyJ[A-Za-z0-9_-]+\.|-----BEGIN\s+(?:RSA\s+)?PRIVATE KEY-----/i)
})

test('B26 authenticated journey requires real API, DB and event evidence', () => {
  const matrix = json('config/b26-browser-test.json')
  const journey = matrix.scenarios.find((scenario) => scenario.id === 'B26-BRW-004-HAPPY-PATH')
  assert.ok(journey)
  assert.deepEqual(journey.steps.slice(0, 5), ['clean session', 'register', 'login', 'adult gate', 'save onboarding'])
  assert.ok(journey.steps.includes('submit practice'))
  assert.ok(journey.steps.includes('submit assessment'))
  assert.ok(journey.steps.includes('read SRS/report/notification'))
  assert.ok(journey.evidence.includes('DB owner reconciliation'))
  assert.ok(journey.evidence.includes('Kafka event reconciliation'))
  assert.equal(matrix.journey.readAfterWriteRequired, true)
  assert.equal(matrix.journey.restartReadBackRequired, true)
  assert.equal(matrix.journey.redisIsProjectionOnly, true)
  assert.equal(matrix.journey.kafkaIsIntegrationOnly, true)
  assert.equal(matrix.journey.allowKafkaRpc, false)
})

test('B26 browser boundary covers all apps, eight states and fixed local origins', () => {
  const matrix = json('config/b26-browser-test.json')
  const expectedStates = ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']
  const expected = {
    'learner-web': 'http://127.0.0.1:18180',
    mobile: 'http://127.0.0.1:18183',
    'admin-web': 'http://127.0.0.1:18181',
    'official-site': 'http://127.0.0.1:18182',
  }
  for (const app of matrix.applications) {
    assert.equal(app.origin, expected[app.id])
    assert.deepEqual(app.requiredStates, expectedStates)
  }
  assert.equal(matrix.viewports.length, 4)
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'permission-and-recovery'))
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'responsive-i18n-theme'))
})

test('B26 evidence contract blocks console and page errors', () => {
  const evidence = json('config/b26-browser-test.json').evidenceContract
  assert.equal(evidence.consolePolicy.failOnConsoleError, true)
  assert.equal(evidence.consolePolicy.failOnPageError, true)
  for (const field of ['networkTrace', 'dbReconciliation', 'eventReconciliation']) assert.ok(evidence.requiredPerCase.includes(field))
  for (const field of ['runtimeBlocked-is-false', 'pageErrors-is-empty', 'db-reconciliation-matches-owner-facts', 'event-reconciliation-is-idempotent']) assert.ok(evidence.passRequirements.includes(field))
})

test('B26 frontend writes preserve explicit idempotency semantics', () => {
  const learnerApi = read('apps/learner-web/src/api/learner-content.ts')
  const mobileApi = read('apps/mobile/src/api/learner-content.ts')
  assert.match(learnerApi, /Idempotency-Key/)
  assert.match(mobileApi, /Idempotency-Key/)
  assert.match(learnerApi, /contentCatalog/)
  assert.match(mobileApi, /contentCatalog|readHome|readOnboarding/)
})

test('B26 official site remains public-only while learner/mobile require self-owned JWT session boundary', () => {
  const matrix = json('config/b26-browser-test.json')
  assert.equal(matrix.applications.find((app) => app.id === 'official-site').auth, 'public-only')
  for (const id of ['learner-web', 'mobile', 'admin-web']) assert.equal(matrix.applications.find((app) => app.id === id).auth, 'self-owned-jwt')
  assert.doesNotMatch(read('apps/official-site/utils/public-links.mjs'), /accessToken|refreshToken|Authorization\s*:/i)
})
