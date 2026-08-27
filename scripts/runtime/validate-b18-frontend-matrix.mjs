import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'config/b18-frontend-test-matrix.json'), 'utf8'))
const ports = JSON.parse(fs.readFileSync(path.join(root, 'config/local-ports.json'), 'utf8'))
const errors = []
const expectedApps = ['learner-web', 'mobile', 'admin-web', 'official-site']
const expectedOrigins = {
  'learner-web': 'http://127.0.0.1:18180',
  'admin-web': 'http://127.0.0.1:18181',
  'official-site': 'http://127.0.0.1:18182',
  mobile: 'http://127.0.0.1:18183',
}

function fail(message) { errors.push(message) }

if (matrix.version !== 1) fail('B18 frontend matrix version must be 1')
if (matrix.phase !== 'phase-1') fail('B18 frontend matrix must remain Phase 1')
if (matrix.gatewayBasePath !== '/api/v1') fail('B18 frontend matrix must use /api/v1')
const apps = matrix.applications ?? []
if (JSON.stringify(apps.map((app) => app.id)) !== JSON.stringify(expectedApps)) fail('B18 frontend application order does not match the four-project contract')
if (new Set(apps.map((app) => app.origin)).size !== apps.length) fail('B18 frontend origins must be unique')

for (const app of apps) {
  if (app.origin !== expectedOrigins[app.id]) fail(`${app.id} origin does not match fixed port allocation`)
  if (app.auth === 'public-only' && app.id !== 'official-site') fail('only official-site may be public-only')
  if (app.id !== 'official-site' && app.auth !== 'oidc-test-idp') fail(`${app.id} must use the approved OIDC test IdP seam`)
  if (!Array.isArray(app.routes) || app.routes.length === 0) fail(`${app.id} must declare routes`)
  if (app.id === 'admin-web' && (!Array.isArray(app.requiredPermissions) || app.requiredPermissions.length < 4)) fail('admin-web must declare minimum permission matrix')
  if (app.id !== 'admin-web' && (!Array.isArray(app.requiredStates) || app.requiredStates.length !== 8)) fail(`${app.id} must declare the eight-state matrix`)
  const servicePort = ports.services?.[app.id === 'mobile' ? 'mobile-h5-dev' : `${app.id}-dev`]?.port
  if (servicePort && !app.origin.endsWith(`:${servicePort}`)) fail(`${app.id} origin does not use its registered dev port`)
}

const accounts = matrix.accounts ?? []
if (accounts.length !== 4) fail('B18 matrix must contain four synthetic account fixtures')
if (new Set(accounts.map((account) => account.id)).size !== accounts.length) fail('B18 account fixture ids must be unique')
for (const account of accounts) {
  if (!account.fixture || /password|secret|token|credential/i.test(JSON.stringify(account))) fail(`account fixture ${account.id} contains credential-like data`)
  if (account.kind === 'public' && account.subject !== null) fail('public anonymous fixture must not have a subject')
}

const matrixText = JSON.stringify(matrix)
for (const field of matrix.forbiddenFixtureFields ?? []) {
  if (new RegExp(`"${field}"\\s*:`).test(matrixText)) fail(`forbidden fixture field appears in matrix: ${field}`)
}
if (!Array.isArray(matrix.forbiddenDefaultCapabilities) || matrix.forbiddenDefaultCapabilities.length < 3) {
  fail('B18 matrix must explicitly declare the Phase 2/3 capabilities that are disabled by default')
}
if (JSON.stringify(matrix).match(/ai-orchestrator|realtime-voice|guardian-service|institution-service|curriculum-rights-service/i)) fail('Phase 2/3 service leaked into B18 frontend matrix')

if (errors.length) {
  for (const error of errors) console.error(`B18 frontend matrix error: ${error}`)
  process.exitCode = 1
} else {
  console.log('B18 frontend test matrix passed: four fixed-origin applications, four synthetic fixtures, Phase 1-only')
}
