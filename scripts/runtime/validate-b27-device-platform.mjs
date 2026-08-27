import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const configPath = path.join(root, 'config', 'b27-device-platform.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const errors = []
const fail = (message) => errors.push(message)
const has = (value, item) => Array.isArray(value) && value.includes(item)
const unique = (values) => Array.isArray(values) && new Set(values).size === values.length
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const readJson = (relativePath) => JSON.parse(readText(relativePath))
const getPath = (value, dottedPath) => dottedPath.split('.').reduce((current, key) => current == null ? undefined : current[key], value)
const args = new Set(process.argv.slice(2))
const requireRuntime = args.has('--require-runtime')

function checkSourceContract(contract) {
  if (contract.path) {
    if (!fs.existsSync(path.join(root, contract.path))) fail(`${contract.id} source path is missing: ${contract.path}`)
  }
  for (const relativePath of contract.paths ?? []) {
    if (!fs.existsSync(path.join(root, relativePath))) fail(`${contract.id} source path is missing: ${relativePath}`)
  }
  for (const assertion of contract.jsonAssertions ?? []) {
    if (!contract.path || !fs.existsSync(path.join(root, contract.path))) continue
    const source = readJson(contract.path)
    const actual = getPath(source, assertion.path)
    if (assertion.exists === true && actual === undefined) fail(`${contract.id} missing JSON path ${assertion.path}`)
    if (assertion.equals !== undefined && actual !== assertion.equals) fail(`${contract.id} ${assertion.path} must equal ${JSON.stringify(assertion.equals)}`)
    if (assertion.contains !== undefined && (!Array.isArray(actual) || !actual.includes(assertion.contains))) fail(`${contract.id} ${assertion.path} must contain ${assertion.contains}`)
  }
  for (const assertion of contract.textAssertions ?? []) {
    const assertionPath = assertion.path ?? contract.path
    if (!assertionPath || !fs.existsSync(path.join(root, assertionPath))) continue
    const source = readText(assertionPath)
    if (!source.includes(assertion.contains)) fail(`${contract.id} ${assertion.path} must contain ${assertion.contains}`)
  }
}

function collectStringValues(value, result = []) {
  if (typeof value === 'string') result.push(value)
  else if (Array.isArray(value)) for (const child of value) collectStringValues(child, result)
  else if (value && typeof value === 'object') for (const child of Object.values(value)) collectStringValues(child, result)
  return result
}

function assertNoSensitiveMaterial() {
  const values = collectStringValues(config)
  const forbiddenValues = config.evidenceContract?.forbiddenEvidenceValues ?? []
  for (const value of values) {
    if (forbiddenValues.includes(value)) continue
    if (/eyJ[A-Za-z0-9_-]{20,}/.test(value)) fail('configuration contains a JWT-like value')
    if (/BEGIN (?:RSA |EC )?PRIVATE KEY/.test(value)) fail('configuration contains a private key')
    if (/^sk-[A-Za-z0-9_-]{12,}/.test(value)) fail('configuration contains an API key-like value')
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail('configuration contains an email address')
    if (/\+?\d[\d -]{9,}\d/.test(value) && !/^\d{3,4}$/.test(value)) fail('configuration contains a phone-like value')
    for (const forbidden of forbiddenValues) if (value.includes(forbidden) && !config.evidenceContract.forbiddenFixtureFields.includes(value)) fail(`configuration contains forbidden evidence value: ${forbidden}`)
  }
}

if (config.schemaVersion !== 1) fail('B27 device platform schemaVersion must be 1')
if (config.batch !== 'B27') fail('B27 device platform batch is incorrect')
if (config.phase !== 'phase-1' || config.phaseLabel !== 'Phase 1') fail('B27 must remain Phase 1')
if (JSON.stringify(config.ownerTasks) !== JSON.stringify(['V2-B27-DEV-001', 'V2-B27-DEV-002'])) fail('B27 owner task scope is incorrect')
if (config.scope?.gatewayBasePath !== '/api/v1') fail('B27 must use Gateway /api/v1')
if (config.scope?.phase2AiEnabled !== false || config.scope?.phase3K12Enabled !== false) fail('B27 cannot enable Phase 2 AI or Phase 3 K12')

const execution = config.execution ?? {}
if (execution.mode !== 'static-contract-only') fail('B27 default mode must be static-contract-only')
if (execution.status !== 'runtimeBlocked' || execution.runtimeBlocked !== true) fail('B27 must explicitly remain runtimeBlocked')
if (execution.allowUnverifiedPass !== false) fail('B27 must reject unverified passes')
if (execution.runtimeRequired !== true) fail('B27 runtime evidence must be required')
if (!Array.isArray(execution.blockedReasons) || execution.blockedReasons.length < 3) fail('B27 runtimeBlocked requires concrete reasons')
if (!Array.isArray(execution.requiredRuntimeEnvironment) || execution.requiredRuntimeEnvironment.length < 4) fail('B27 runtime environment contract is incomplete')
if (execution.runtimeEvidence !== null) fail('B27 static configuration cannot contain runtime evidence')

const boundary = config.projectBoundary ?? {}
if (boundary.mobileBusinessProject !== 'apps/mobile') fail('apps/mobile must remain the unique mobile business project')
if (boundary.pwaOwner !== 'apps/learner-web') fail('apps/learner-web must own the PWA')
if (boundary.wechatConditionCompileOwner !== 'apps/mobile') fail('微信小程序 must be conditionally compiled from apps/mobile')
if (boundary.separateBusinessPageOrApiLayer !== false) fail('B27 cannot introduce a second business page/API layer')
if (!Array.isArray(boundary.forbiddenBusinessProjects) || boundary.forbiddenBusinessProjects.length < 3) fail('B27 second-project denylist is incomplete')
const legacyPlaceholders = new Map((boundary.allowedLegacyPlaceholders ?? []).map((item) => [item.path, item]))
for (const forbiddenProject of boundary.forbiddenBusinessProjects) {
  const absolutePath = path.join(root, forbiddenProject)
  if (!fs.existsSync(absolutePath)) continue
  const placeholder = legacyPlaceholders.get(forbiddenProject)
  if (!placeholder) {
    fail(`forbidden second business project exists: ${forbiddenProject}`)
    continue
  }
  const allowedFiles = new Set(placeholder.allowedFiles ?? [])
  const actualFiles = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absoluteEntry = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absoluteEntry)
      else actualFiles.push(path.relative(absolutePath, absoluteEntry).replaceAll('\\', '/'))
    }
  }
  visit(absolutePath)
  for (const actualFile of actualFiles) if (!allowedFiles.has(actualFile)) fail(`legacy placeholder contains business file: ${actualFile}`)
}

for (const contract of config.sourceContracts ?? []) checkSourceContract(contract)

const buildTargets = config.buildTargets ?? []
const targetById = new Map(buildTargets.map((target) => [target.id, target]))
if (new Set(buildTargets.map((target) => target.id)).size !== buildTargets.length) fail('B27 build target ids must be unique')
for (const target of buildTargets) {
  if (target.status !== 'runtimeBlocked' || target.runtimeEvidence !== null) fail(`${target.id} must not claim runtime evidence`)
  if (!fs.existsSync(path.join(root, target.sourceProject))) fail(`${target.id} source project is missing: ${target.sourceProject}`)
  if (!target.command || !target.compiler) fail(`${target.id} needs compiler and command metadata`)
}
if (targetById.get('mobile-h5')?.sourceProject !== 'apps/mobile') fail('mobile H5 must compile from apps/mobile')
if (targetById.get('mobile-native')?.sourceProject !== 'apps/mobile') fail('iOS/Android/iPad must compile from apps/mobile')
if (targetById.get('wechat-miniapp')?.sourceProject !== 'apps/mobile' || targetById.get('wechat-miniapp')?.conditionalCompile !== true) fail('WeChat target must be conditional compilation from apps/mobile')
if (targetById.get('wechat-miniapp')?.separateProject !== false) fail('WeChat target must not create a separate business project')
if (targetById.get('learner-pwa')?.sourceProject !== 'apps/learner-web') fail('PWA target must compile from apps/learner-web')

const expectedViewports = new Set(['phone-portrait-390x844', 'phone-landscape-844x390', 'ipad-portrait-768x1024', 'ipad-landscape-1024x768', 'pwa-desktop-1440x900', 'pwa-tablet-1024x768'])
const viewports = config.viewports ?? []
if (viewports.length !== expectedViewports.size || !viewports.every((viewport) => expectedViewports.has(viewport.id))) fail('B27 viewport matrix is incomplete')
for (const viewport of viewports) {
  if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height) || viewport.width <= 0 || viewport.height <= 0) fail(`${viewport.id} has invalid dimensions`)
  if (!['portrait', 'landscape'].includes(viewport.orientation)) fail(`${viewport.id} has invalid orientation`)
}

const expectedDevices = ['h5-android', 'h5-ios', 'android', 'ios', 'ipad', 'windows-pwa', 'wechat-miniapp']
const devices = config.deviceProfiles ?? []
if (JSON.stringify(devices.map((device) => device.id)) !== JSON.stringify(expectedDevices)) fail('B27 device order/coverage must include H5, iOS, Android, iPad, PWA and WeChat')
if (!unique(devices.map((device) => device.id))) fail('B27 device ids must be unique')
const viewportIds = new Set(viewports.map((viewport) => viewport.id))
for (const device of devices) {
  if (device.status !== 'runtimeBlocked' || device.runtimeEvidence !== null) fail(`${device.id} must not claim runtime evidence`)
  if (device.sourceProject !== 'apps/mobile' && device.sourceProject !== 'apps/learner-web') fail(`${device.id} has an invalid source project`)
  if (device.sourceProject === 'apps/mobile' && device.id === 'windows-pwa') fail('PWA cannot use apps/mobile as its business project')
  if (device.sourceProject === 'apps/learner-web' && device.id !== 'windows-pwa') fail(`${device.id} cannot use learner-web as a mobile business project`)
  if (!Array.isArray(device.viewports) || device.viewports.length === 0 || device.viewports.some((id) => !viewportIds.has(id))) fail(`${device.id} needs valid viewport coverage`)
  if (!Array.isArray(device.orientations) || !has(device.orientations, 'portrait') && device.id !== 'windows-pwa') fail(`${device.id} needs portrait coverage`)
  if (!Array.isArray(device.orientations) || !has(device.orientations, 'landscape')) fail(`${device.id} needs landscape coverage`)
  if (device.safeArea?.required !== (device.id !== 'windows-pwa')) fail(`${device.id} safe-area requirement is incorrect`)
  if (!Array.isArray(device.safeArea?.checks) || device.safeArea.checks.length === 0) fail(`${device.id} needs safe-area assertions`)
  if (device.backgroundRecovery?.required !== true || (device.backgroundRecovery.events ?? []).length < 2) fail(`${device.id} needs background recovery events`)
  if (device.networkSwitch?.required !== true || !has(device.networkSwitch.states, 'offline') || !has(device.networkSwitch.states, 'online-recovery')) fail(`${device.id} needs network switch recovery states`)
  if (device.networkSwitch.writeRule !== 'no-fake-success-and-no-duplicate-submit') fail(`${device.id} network write rule is unsafe`)
  if (device.audioPermission?.required !== true || !has(device.audioPermission.states, 'denied') || !has(device.audioPermission.states, 'blocked')) fail(`${device.id} needs denied/blocked audio permission states`)
  if (device.loginBoundary?.anonymous !== 'login' || device.loginBoundary?.expired !== 'login' || device.loginBoundary?.authenticated !== 'server-backed-learning') fail(`${device.id} login boundary is incomplete`)
  if (!device.backAndShare?.back || !device.backAndShare?.share || device.backAndShare.unsavedWrite !== 'confirm-or-preserve-draft') fail(`${device.id} back/share boundary is incomplete`)
  if (device.id === 'windows-pwa' && device.installUpdateCache?.required !== true) fail('PWA install/update/cache contract is missing')
  if (device.id === 'wechat-miniapp' && device.conditionalCompile?.separateProject !== false) fail('WeChat separate-project boundary is missing')
}

const scenarios = config.scenarios ?? []
const expectedScenarioKinds = ['orientation-safe-area', 'background-recovery', 'network-switch', 'audio-permission', 'login-boundary', 'back-and-share', 'pwa-install-update-cache', 'wechat-conditional-compile']
if (!unique(scenarios.map((scenario) => scenario.id))) fail('B27 scenario ids must be unique')
for (const kind of expectedScenarioKinds) if (!scenarios.some((scenario) => scenario.kind === kind)) fail(`B27 is missing ${kind} scenario coverage`)
const deviceIds = new Set(devices.map((device) => device.id))
for (const scenario of scenarios) {
  if (!['V2-B27-DEV-001', 'V2-B27-DEV-002'].includes(scenario.task)) fail(`${scenario.id} is outside B27-DEV-001/002 scope`)
  if (scenario.status !== 'runtimeBlocked' || scenario.runtimeEvidence !== null) fail(`${scenario.id} must remain runtimeBlocked`)
  if (!Array.isArray(scenario.targetIds) || scenario.targetIds.length === 0 || scenario.targetIds.some((id) => !deviceIds.has(id))) fail(`${scenario.id} has invalid target coverage`)
  if (!Array.isArray(scenario.assertions) || scenario.assertions.length < 3) fail(`${scenario.id} needs auditable assertions`)
  if (!Array.isArray(scenario.evidenceRequired) || scenario.evidenceRequired.length < 2) fail(`${scenario.id} needs runtime evidence requirements`)
  if (scenario.kind === 'audio-permission' && !has(scenario.permissionStates, 'denied')) fail(`${scenario.id} needs denied audio evidence`)
  if (scenario.kind === 'wechat-conditional-compile' && scenario.task !== 'V2-B27-DEV-002') fail(`${scenario.id} has the wrong task owner`)
}

const evidence = config.evidenceContract ?? {}
for (const required of ['runId', 'caseId', 'targetId', 'sourceProject', 'compilerVersion', 'deviceProfile', 'startedAt', 'finishedAt', 'status', 'screenshotsOrDeviceCapture', 'traceOrNativeDeviceLog', 'networkTrace', 'authTrace', 'storageOrCacheReport', 'databaseReconciliation', 'consoleLog', 'pageErrors']) {
  if (!has(evidence.requiredPerCase, required)) fail(`evidence contract misses ${required}`)
}
for (const required of ['status-is-passed', 'runtimeBlocked-is-false', 'evidence-files-are-addressable', 'consoleLog-has-no-error', 'pageErrors-is-empty', 'authenticated-journey-is-server-backed', 'database-reconciliation-is-matched']) if (!has(evidence.passRequirements, required)) fail(`pass contract misses ${required}`)
for (const required of ['status-is-runtimeBlocked', 'runtimeBlocked-is-true', 'blockedReason-is-present', 'runtimeEvidence-is-null']) if (!has(evidence.blockedRequirements, required)) fail(`blocked contract misses ${required}`)
if (evidence.consolePolicy?.failOnConsoleError !== true || evidence.consolePolicy?.failOnPageError !== true || evidence.consolePolicy?.failOnUnhandledRejection !== true) fail('console/page/unhandled errors must block a pass')
if (!Array.isArray(evidence.forbiddenFixtureFields) || evidence.forbiddenFixtureFields.length < 8) fail('secret/PII fixture denylist is incomplete')
if (!Array.isArray(evidence.forbiddenDefaultCapabilities) || !has(evidence.forbiddenDefaultCapabilities, 'phase-2-ai') || !has(evidence.forbiddenDefaultCapabilities, 'phase-3-k12')) fail('Phase 2/3 capability denylist is incomplete')

assertNoSensitiveMaterial()

if (requireRuntime) {
  if (execution.runtimeBlocked !== false) fail('runtime requested while B27 is explicitly runtimeBlocked; refusing to infer device evidence')
  const missing = execution.requiredRuntimeEnvironment.filter((name) => !process.env[name])
  if (missing.length > 0) fail(`runtime evidence variables are missing: ${missing.join(', ')}`)
  if (execution.runtimeEvidence === null) fail('runtime requested without an addressable runtime evidence manifest')
}

const result = errors.length === 0 ? 'PASS' : 'FAIL'
console.log(JSON.stringify({
  result,
  mode: execution.mode,
  runtimeRequested: requireRuntime,
  runtimeBlocked: execution.runtimeBlocked === true,
  buildTargets: buildTargets.length,
  deviceProfiles: devices.length,
  scenarios: scenarios.length,
  sourceContracts: config.sourceContracts?.length ?? 0,
  errors
}, null, 2))
if (errors.length > 0) process.exitCode = 1
