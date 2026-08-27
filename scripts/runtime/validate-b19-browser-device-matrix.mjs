import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const matrix = readJson('config/b19-browser-device-matrix.json')
const b18 = readJson('config/b18-frontend-test-matrix.json')
const ports = readJson('config/local-ports.json')
const errors = []
const fail = (message) => errors.push(message)
const has = (value, item) => Array.isArray(value) && value.includes(item)
const unique = (values) => Array.isArray(values) && new Set(values).size === values.length
const expectedApps = ['learner-web', 'mobile', 'admin-web', 'official-site']
const expectedBrowsers = ['playwright-chromium', 'playwright-edge', 'playwright-safari-webkit', 'safari-native']
const expectedStates = ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']
const expectedDevices = ['desktop-web', 'tablet-browser', 'windows-pwa', 'h5-android', 'h5-ios', 'app-android', 'app-ios', 'app-ipad', 'wechat-miniapp']
const expectedPlatforms = ['h5', 'ios', 'android', 'ipad', 'pwa', 'wechat-miniapp']
const expectedScenarioKinds = ['public', 'login', 'eight-states', 'permission', 'keyboard', 'responsive', 'secure-storage', 'media-permission', 'orientation', 'background-recovery', 'back-navigation']
const expectedOrigins = Object.fromEntries(b18.applications.map((app) => [app.id, app.origin]))

if (matrix.version !== 1) fail('B19 matrix version must be 1')
if (matrix.phase !== 'phase-1') fail('B19 matrix must remain Phase 1')
if (matrix.gatewayBasePath !== '/api/v1') fail('B19 matrix must use /api/v1')
if (JSON.stringify(matrix.ownerTasks) !== JSON.stringify(['V2-B19-BRW-003', 'V2-B19-DEV-004'])) fail('B19 owner task scope is incorrect')

const execution = matrix.execution ?? {}
if (execution.mode !== 'static-fixture-only') fail('B19 static fixture mode is required')
if (execution.status !== 'runtimeBlocked' || execution.runtimeBlocked !== true) fail('B19 must explicitly remain runtimeBlocked')
if (execution.allowUnverifiedPass !== false) fail('B19 must reject unverified pass results')
if (!Array.isArray(execution.blockedReasons) || execution.blockedReasons.length < 1) fail('B19 runtimeBlocked requires reasons')
if (execution.runtimeEvidence !== null) fail('B19 static fixture cannot contain runtime evidence')

const browsers = matrix.browserRuntimes ?? []
if (JSON.stringify(browsers.map((browser) => browser.id)) !== JSON.stringify(expectedBrowsers)) fail('B19 browser runtime coverage must be Chromium, Edge, WebKit proxy and native Safari')
if (new Set(browsers.map((browser) => browser.id)).size !== browsers.length) fail('B19 browser runtime ids must be unique')
for (const browser of browsers) {
  if (browser.status !== 'runtimeBlocked' || browser.runtimeEvidence !== null) fail(`${browser.id} must not claim runtime evidence`)
  if (browser.runner === 'playwright' && !['chromium', 'webkit'].includes(browser.engine)) fail(`${browser.id} has an unsupported Playwright engine`)
  if (browser.id === 'playwright-edge' && browser.channel !== 'msedge') fail('Edge must use the Playwright msedge channel')
  if (browser.id === 'playwright-safari-webkit' && browser.requiresNativeEvidence !== true) fail('WebKit compatibility cannot replace native Safari evidence')
  if (browser.id === 'safari-native' && browser.coverageMode !== 'native') fail('native Safari must be explicitly marked native')
}

const apps = matrix.applications ?? []
if (JSON.stringify(apps.map((app) => app.id)) !== JSON.stringify(expectedApps)) fail('B19 application order must match the four-project contract')
if (!unique(apps.map((app) => app.origin)) || apps.length !== 4) fail('B19 application origins must be unique')
const b18ById = new Map(b18.applications.map((app) => [app.id, app]))
for (const app of apps) {
  if (app.origin !== expectedOrigins[app.id]) fail(`${app.id} origin does not match B18 fixed origin`)
  if (!Array.isArray(app.routes) || app.routes.length === 0 || !unique(app.routes)) fail(`${app.id} routes must be non-empty and unique`)
  if (!Array.isArray(app.browserIds) || JSON.stringify(app.browserIds) !== JSON.stringify(expectedBrowsers)) fail(`${app.id} must cover all declared browser runtimes`)
  if (!Array.isArray(app.deviceIds) || app.deviceIds.length === 0) fail(`${app.id} must declare device profiles`)
  if (!Array.isArray(app.requiredStates) || JSON.stringify(app.requiredStates) !== JSON.stringify(expectedStates)) fail(`${app.id} must declare all eight states`)
  const baseline = b18ById.get(app.id)
  if (!baseline) fail(`${app.id} is not present in B18 four-app baseline`)
  else for (const route of baseline.routes) if (!app.routes.includes(route)) fail(`${app.id} is missing B18 route ${route}`)
  if (app.id === 'official-site' && JSON.stringify(app.auth) !== JSON.stringify(['public-only'])) fail('official-site must remain public-only')
  if (app.id !== 'official-site' && !has(app.auth, 'oidc-test-idp')) fail(`${app.id} must use the approved OIDC test IdP seam`)
  const registeredKey = app.id === 'mobile' ? 'mobile-h5-dev' : `${app.id}-dev`
  const registeredPort = ports.services?.[registeredKey]?.port
  if (registeredPort && !app.origin.endsWith(`:${registeredPort}`)) fail(`${app.id} origin is not on its fixed local port`)
}

const stateIds = (matrix.stateCatalog ?? []).map((state) => state.id)
if (JSON.stringify(stateIds) !== JSON.stringify(expectedStates)) fail('B19 state catalog must contain the exact eight states')

const devices = matrix.deviceProfiles ?? []
if (JSON.stringify(devices.map((device) => device.id)) !== JSON.stringify(expectedDevices)) fail('B19 device coverage must include desktop, tablet, PWA, H5, iOS, Android, iPad and WeChat')
if (new Set(devices.map((device) => device.id)).size !== devices.length) fail('B19 device ids must be unique')
const deviceIds = new Set(devices.map((device) => device.id))
const appIds = new Set(apps.map((app) => app.id))
for (const platform of expectedPlatforms) if (!devices.some((device) => device.platform === platform)) fail(`B19 is missing ${platform} device coverage`)
for (const device of devices) {
  if (device.status !== 'runtimeBlocked' || device.runtimeEvidence !== null) fail(`${device.id} must not claim runtime evidence`)
  if (!Array.isArray(device.appIds) || device.appIds.some((appId) => !appIds.has(appId))) fail(`${device.id} references an unknown application`)
  if (!Array.isArray(device.viewports) || device.viewports.length === 0) fail(`${device.id} needs viewport profiles`)
  if (!Array.isArray(device.orientations) || device.orientations.length === 0) fail(`${device.id} needs orientation coverage`)
  if (device.keyboard?.required !== true || !device.keyboard.backAction) fail(`${device.id} needs keyboard and back navigation coverage`)
  if (device.secureStorage?.required !== true || !device.secureStorage.adapter) fail(`${device.id} needs secure-storage adapter coverage`)
  if (device.mediaPermissions?.required !== true && device.id !== 'desktop-web' && device.id !== 'tablet-browser') fail(`${device.id} needs media permission coverage`)
  if (!has(device.mediaPermissions?.permissionStates, 'denied') || !has(device.mediaPermissions?.permissionStates, 'blocked')) fail(`${device.id} needs denied and blocked media states`)
  if (device.backgroundRecovery?.required !== true || !Array.isArray(device.backgroundRecovery.events) || device.backgroundRecovery.events.length < 2) fail(`${device.id} needs background recovery events`)
  for (const browserId of device.browserIds ?? []) if (!expectedBrowsers.includes(browserId)) fail(`${device.id} references an unknown browser ${browserId}`)
}

const scenarios = matrix.scenarios ?? []
if (new Set(scenarios.map((scenario) => scenario.id)).size !== scenarios.length) fail('B19 scenario ids must be unique')
for (const kind of expectedScenarioKinds) if (!scenarios.some((scenario) => scenario.kind === kind)) fail(`B19 is missing ${kind} scenario coverage`)
for (const scenario of scenarios) {
  if (!['V2-B19-BRW-003', 'V2-B19-DEV-004'].includes(scenario.task)) fail(`${scenario.id} is outside the assigned B19 task scope`)
  if (!Array.isArray(scenario.appIds) || scenario.appIds.length === 0 || scenario.appIds.some((appId) => !appIds.has(appId))) fail(`${scenario.id} has invalid application coverage`)
  if (!scenario.routeByApp || scenario.appIds.some((appId) => typeof scenario.routeByApp[appId] !== 'string')) fail(`${scenario.id} must map every app to a route`)
  if (scenario.status !== 'runtimeBlocked' || scenario.runtimeEvidence !== null) fail(`${scenario.id} must remain runtimeBlocked without evidence`)
  if (!Array.isArray(scenario.browserIds) || scenario.browserIds.some((browserId) => !expectedBrowsers.includes(browserId))) fail(`${scenario.id} has invalid browser coverage`)
  if (!Array.isArray(scenario.deviceIds) || scenario.deviceIds.length === 0 || scenario.deviceIds.some((deviceId) => !deviceIds.has(deviceId))) fail(`${scenario.id} has invalid device coverage`)
  if (!Array.isArray(scenario.assertions) || scenario.assertions.length === 0) fail(`${scenario.id} needs auditable assertions`)
  if (scenario.kind === 'eight-states' && JSON.stringify(scenario.stateIds) !== JSON.stringify(expectedStates)) fail(`${scenario.id} must cover all eight states`)
  if (scenario.kind === 'responsive' && (!Array.isArray(scenario.viewportIds) || scenario.viewportIds.length < 4)) fail(`${scenario.id} needs desktop/tablet/phone responsive viewports`)
  if (scenario.kind === 'permission' && !Array.isArray(scenario.requiredPermissions) && !scenario.accountIds?.includes('learner-forbidden')) fail(`${scenario.id} needs a permission or forbidden-account fixture`)
  if (scenario.kind === 'media-permission' && !has(scenario.permissionStates, 'denied')) fail(`${scenario.id} needs denied media permission evidence`)
}

const evidence = matrix.evidenceContract ?? {}
for (const required of ['runId', 'caseId', 'targetId', 'startedAt', 'finishedAt', 'runnerVersion', 'status', 'consoleLog', 'pageErrors', 'screenshotsOrDeviceCapture', 'traceOrNativeDeviceLog']) {
  if (!has(evidence.requiredPerCase, required)) fail(`evidence contract misses ${required}`)
}
for (const required of ['status-is-passed', 'runtimeBlocked-is-false', 'evidence-files-are-addressable', 'consoleLog-has-no-error', 'pageErrors-is-empty']) if (!has(evidence.passRequirements, required)) fail(`pass contract misses ${required}`)
for (const required of ['status-is-runtimeBlocked', 'runtimeBlocked-is-true', 'blockedReason-is-present', 'runtimeEvidence-is-null']) if (!has(evidence.blockedRequirements, required)) fail(`blocked contract misses ${required}`)
if (evidence.consolePolicy?.failOnConsoleError !== true || evidence.consolePolicy?.failOnPageError !== true) fail('console and page errors must be blocking')
if (!Array.isArray(evidence.forbiddenFixtureFields) || evidence.forbiddenFixtureFields.length < 5) fail('sensitive fixture field denylist is incomplete')

const accountText = JSON.stringify(b18.accounts)
if (/password|secret|accessToken|refreshToken|authorization|paymentCredential|rawAudio/i.test(accountText)) fail('B18 account fixtures contain credential-like data')
const forbiddenServiceIds = /ai-orchestrator|realtime-voice|guardian-service|institution-service|curriculum-rights-service/i
if (forbiddenServiceIds.test(JSON.stringify(matrix).replace(/"forbiddenDefaultCapabilities"\s*:\s*\[[^\]]*\]/, ''))) fail('Phase 2/3 service leaked into B19 matrix')

const result = errors.length === 0 ? 'PASS' : 'FAIL'
console.log(JSON.stringify({
  result,
  staticOnly: execution.mode === 'static-fixture-only',
  runtimeBlocked: execution.runtimeBlocked === true,
  browserRuntimes: browsers.length,
  applications: apps.length,
  deviceProfiles: devices.length,
  scenarios: scenarios.length,
  errors,
}, null, 2))
if (errors.length) process.exitCode = 1
