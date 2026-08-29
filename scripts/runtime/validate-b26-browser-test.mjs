import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'config/b26-browser-test.json'), 'utf8'))
const ports = JSON.parse(fs.readFileSync(path.join(root, 'config/local-ports.json'), 'utf8'))
const errors = []
const fail = (message) => errors.push(message)
const requiredStates = ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']
const expectedApps = ['learner-web', 'mobile', 'admin-web', 'official-site']
const expectedOrigins = {
  'learner-web': 'http://127.0.0.1:18180',
  mobile: 'http://127.0.0.1:18183',
  'admin-web': 'http://127.0.0.1:18181',
  'official-site': 'http://127.0.0.1:18182',
}
const forbiddenValue = /(?:Bearer\s+eyJ[A-Za-z0-9_-]+\.|^eyJ[A-Za-z0-9_-]+\.|^sk-[A-Za-z0-9]|-----BEGIN\s+(?:RSA\s+)?PRIVATE KEY-----)/i

if (matrix.version !== 1) fail('B26 browser matrix version must be 1')
if (matrix.batch !== 'B26' || matrix.phase !== 'phase-1') fail('B26 matrix must remain Phase 1')
if (matrix.gatewayBasePath !== '/api/v1') fail('B26 matrix must use /api/v1')
if (JSON.stringify(matrix.ownerTasks) !== JSON.stringify(['V2-B26-BRW-004', 'V2-B26-BRW-005', 'V2-B26-BRW-006'])) fail('B26 browser owner task scope is incorrect')

const execution = matrix.execution ?? {}
if (execution.mode !== 'static-contract-and-runtime-browser-gate') fail('B26 execution mode is incorrect')
if (execution.status !== 'runtimeBlocked' || execution.runtimeBlocked !== true) fail('B26 must remain runtimeBlocked before authenticated browser evidence')
if (execution.allowUnverifiedPass !== false) fail('B26 must reject unverified browser pass')
if (!Array.isArray(execution.requiredEnvironment) || execution.requiredEnvironment.length < 5) fail('B26 runtime environment contract is incomplete')
if (!Array.isArray(execution.blockedReasons) || execution.blockedReasons.length < 2) fail('B26 blocked reasons are incomplete')
if (execution.runtimeEvidence !== null) fail('B26 static matrix must not contain runtime evidence')

const apps = matrix.applications ?? []
if (JSON.stringify(apps.map((app) => app.id)) !== JSON.stringify(expectedApps)) fail('B26 application order must match the four-project contract')
if (new Set(apps.map((app) => app.origin)).size !== apps.length) fail('B26 application origins must be unique')
for (const app of apps) {
  if (app.origin !== expectedOrigins[app.id]) fail(`${app.id} origin does not match fixed local port`)
  if (!Array.isArray(app.requiredStates) || JSON.stringify(app.requiredStates) !== JSON.stringify(requiredStates)) fail(`${app.id} must cover the eight interaction states`)
  if (!Array.isArray(app.runtimeAssertions) || app.runtimeAssertions.length === 0) fail(`${app.id} needs runtime assertions`)
  if (app.id === 'official-site' && app.auth !== 'public-only') fail('official-site must remain public-only')
  if (app.id !== 'official-site' && app.auth !== 'self-owned-jwt') fail(`${app.id} must use the platform-owned JWT login`)
  const portKey = app.id === 'mobile' ? 'mobile-h5-dev' : `${app.id}-dev`
  if (ports.services?.[portKey]?.port && !app.origin.endsWith(`:${ports.services[portKey].port}`)) fail(`${app.id} is not on its registered port`)
}

const viewports = matrix.viewports ?? []
if (viewports.length < 4) fail('B26 must declare desktop, tablet and both mobile orientations')
if (new Set(viewports.map((item) => item.id)).size !== viewports.length) fail('B26 viewport ids must be unique')
for (const viewport of viewports) {
  if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height) || viewport.width <= 0 || viewport.height <= 0) fail(`${viewport.id} viewport dimensions are invalid`)
}

const scenarios = matrix.scenarios ?? []
for (const kind of ['authenticated-real-data', 'permission-and-recovery', 'responsive-i18n-theme']) {
  if (!scenarios.some((scenario) => scenario.kind === kind)) fail(`B26 is missing scenario kind ${kind}`)
}
for (const scenario of scenarios) {
  if (!Array.isArray(scenario.apps) || scenario.apps.length === 0) fail(`${scenario.id} must declare applications`)
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) fail(`${scenario.id} must declare steps`)
  if (!Array.isArray(scenario.evidence) || scenario.evidence.length === 0) fail(`${scenario.id} must declare evidence outputs`)
}

const journey = matrix.journey ?? {}
if (!Array.isArray(journey.ownerServices) || journey.ownerServices.length < 5) fail('B26 journey owner service list is incomplete')
if (!Array.isArray(journey.ownerFacts) || journey.ownerFacts.length < 5) fail('B26 journey owner fact list is incomplete')
if (journey.readAfterWriteRequired !== true || journey.restartReadBackRequired !== true) fail('B26 must require read-after-write and restart read-back')
if (journey.redisIsProjectionOnly !== true || journey.kafkaIsIntegrationOnly !== true || journey.allowKafkaRpc !== false) fail('B26 Redis/Kafka boundaries are unsafe')

const evidence = matrix.evidenceContract ?? {}
for (const required of ['runId', 'caseId', 'targetId', 'startedAt', 'finishedAt', 'browserOrDevice', 'status', 'consoleLog', 'pageErrors', 'networkTrace', 'screenshots', 'dbReconciliation', 'eventReconciliation']) {
  if (!evidence.requiredPerCase?.includes(required)) fail(`B26 evidence contract misses ${required}`)
}
for (const required of ['status-is-passed', 'runtimeBlocked-is-false', 'pageErrors-is-empty', 'network-trace-has-authenticated-api', 'db-reconciliation-matches-owner-facts', 'event-reconciliation-is-idempotent']) {
  if (!evidence.passRequirements?.includes(required)) fail(`B26 pass contract misses ${required}`)
}
for (const required of ['status-is-runtimeBlocked', 'runtimeBlocked-is-true', 'blockedReason-is-present', 'runtimeEvidence-is-null']) {
  if (!evidence.blockedRequirements?.includes(required)) fail(`B26 blocked contract misses ${required}`)
}
if (evidence.consolePolicy?.failOnConsoleError !== true || evidence.consolePolicy?.failOnPageError !== true) fail('B26 console/page errors must be blocking')
const walkValues = (value, location = '$') => {
  if (typeof value === 'string' && forbiddenValue.test(value)) fail(`${location} contains a credential-like value`)
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) walkValues(child, `${location}.${key}`)
}
walkValues(matrix)
if (JSON.stringify(matrix).match(/ai-orchestrator|realtime-voice|guardian-service|institution-service|curriculum-rights-service/i)) fail('Phase 2/3 service leaked into B26 browser matrix')

if (errors.length) {
  for (const error of errors) console.error(`[B26] ${error}`)
  process.exitCode = 1
} else {
  console.log(`B26 browser matrix passed: ${apps.length} applications, ${scenarios.length} scenarios, ${viewports.length} viewports; runtime evidence remains blocked.`)
}
