import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const readJson = (relativePath) => JSON.parse(readText(relativePath))
const config = readJson('config/b27-device-platform.json')
const validator = path.join(root, 'scripts/runtime/validate-b27-device-platform.mjs')

function runValidator(...args) {
  return spawnSync(process.execPath, [validator, ...args], { cwd: root, encoding: 'utf8', windowsHide: true })
}

function valuesOnly(value, result = []) {
  if (typeof value === 'string') result.push(value)
  else if (Array.isArray(value)) for (const child of value) valuesOnly(child, result)
  else if (value && typeof value === 'object') for (const child of Object.values(value)) valuesOnly(child, result)
  return result
}

test('B27 is scoped to Phase 1 and static execution is explicitly blocked for runtime', () => {
  assert.equal(config.schemaVersion, 1)
  assert.equal(config.batch, 'B27')
  assert.equal(config.phase, 'phase-1')
  assert.equal(config.phaseLabel, 'Phase 1')
  assert.deepEqual(config.ownerTasks, ['V2-B27-DEV-001', 'V2-B27-DEV-002'])
  assert.equal(config.execution.mode, 'static-contract-only')
  assert.equal(config.execution.status, 'runtimeBlocked')
  assert.equal(config.execution.runtimeBlocked, true)
  assert.equal(config.execution.allowUnverifiedPass, false)
  assert.equal(config.execution.runtimeEvidence, null)
  assert.ok(config.execution.blockedReasons.length >= 3)
})

test('B27 keeps apps/mobile as the only mobile business project and uses learner-web for PWA', () => {
  const boundary = config.projectBoundary
  assert.equal(boundary.mobileBusinessProject, 'apps/mobile')
  assert.equal(boundary.mobileH5Owner, 'apps/mobile')
  assert.equal(boundary.nativeAppOwner, 'apps/mobile')
  assert.equal(boundary.ipadOwner, 'apps/mobile')
  assert.equal(boundary.wechatConditionCompileOwner, 'apps/mobile')
  assert.equal(boundary.pwaOwner, 'apps/learner-web')
  assert.equal(boundary.separateBusinessPageOrApiLayer, false)
  const allowedPlaceholders = new Map((boundary.allowedLegacyPlaceholders ?? []).map((item) => [item.path, item]))
  for (const forbidden of boundary.forbiddenBusinessProjects) {
    if (!fs.existsSync(path.join(root, forbidden))) continue
    const placeholder = allowedPlaceholders.get(forbidden)
    assert.ok(placeholder, `second business project exists: ${forbidden}`)
    const actualFiles = []
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absoluteEntry = path.join(directory, entry.name)
        if (entry.isDirectory()) visit(absoluteEntry)
        else actualFiles.push(path.relative(path.join(root, forbidden), absoluteEntry).replaceAll('\\', '/'))
      }
    }
    visit(path.join(root, forbidden))
    for (const actualFile of actualFiles) assert.ok(placeholder.allowedFiles.includes(actualFile), `legacy placeholder contains business file: ${actualFile}`)
  }

  const targets = new Map(config.buildTargets.map((target) => [target.id, target]))
  assert.equal(targets.get('mobile-h5').sourceProject, 'apps/mobile')
  assert.equal(targets.get('mobile-native').sourceProject, 'apps/mobile')
  assert.equal(targets.get('learner-pwa').sourceProject, 'apps/learner-web')
  assert.equal(targets.get('wechat-miniapp').sourceProject, 'apps/mobile')
  assert.equal(targets.get('wechat-miniapp').conditionalCompile, true)
  assert.equal(targets.get('wechat-miniapp').separateProject, false)
})

test('B27 covers iOS, Android, iPad, mobile H5, PWA and WeChat target matrices', () => {
  assert.deepEqual(config.deviceProfiles.map((device) => device.id), ['h5-android', 'h5-ios', 'android', 'ios', 'ipad', 'windows-pwa', 'wechat-miniapp'])
  const platforms = new Set(config.deviceProfiles.map((device) => device.platform))
  for (const platform of ['mobile-h5', 'android', 'ios', 'ipad', 'pwa', 'wechat-miniapp']) assert.ok(platforms.has(platform), `missing ${platform}`)
  const viewportIds = new Set(config.viewports.map((viewport) => viewport.id))
  for (const device of config.deviceProfiles) {
    assert.equal(device.status, 'runtimeBlocked')
    assert.equal(device.runtimeEvidence, null)
    assert.ok(device.viewports.every((viewport) => viewportIds.has(viewport)))
    assert.ok(device.orientations.includes('landscape'))
    if (device.id !== 'windows-pwa') assert.ok(device.orientations.includes('portrait'))
    assert.ok(device.safeArea.checks.length > 0)
    assert.equal(device.backgroundRecovery.required, true)
    assert.equal(device.networkSwitch.required, true)
    assert.ok(device.networkSwitch.states.includes('offline'))
    assert.ok(device.networkSwitch.states.includes('online-recovery'))
    assert.ok(device.audioPermission.states.includes('denied'))
    assert.ok(device.audioPermission.states.includes('blocked'))
    assert.equal(device.loginBoundary.anonymous, 'login')
    assert.equal(device.loginBoundary.expired, 'login')
    assert.ok(device.backAndShare.back)
    assert.ok(device.backAndShare.share)
  }
  assert.equal(config.deviceProfiles.find((device) => device.id === 'windows-pwa').installUpdateCache.required, true)
  assert.equal(config.deviceProfiles.find((device) => device.id === 'wechat-miniapp').conditionalCompile.separateProject, false)
})

test('B27 scenarios cover orientation, lifecycle, network, audio, auth, navigation, PWA and conditional compilation', () => {
  const kinds = new Set(config.scenarios.map((scenario) => scenario.kind))
  for (const kind of ['orientation-safe-area', 'background-recovery', 'network-switch', 'audio-permission', 'login-boundary', 'back-and-share', 'pwa-install-update-cache', 'wechat-conditional-compile']) assert.ok(kinds.has(kind), `missing ${kind}`)
  for (const scenario of config.scenarios) {
    assert.equal(scenario.status, 'runtimeBlocked')
    assert.equal(scenario.runtimeEvidence, null)
    assert.ok(scenario.targetIds.length > 0)
    assert.ok(scenario.assertions.length >= 3)
    assert.ok(scenario.evidenceRequired.length >= 2)
  }
  const audio = config.scenarios.find((scenario) => scenario.kind === 'audio-permission')
  assert.deepEqual(audio.permissionStates, ['not-requested', 'granted', 'denied', 'blocked'])
  assert.match(JSON.stringify(config.scenarios), /no-fake-success-and-no-duplicate-submit|server-backed|database-reconciliation/)
})

test('B27 source contracts match the existing mobile manifest, auth gate and PWA shell', () => {
  const mobileManifest = readJson('apps/mobile/src/manifest.json')
  assert.ok(mobileManifest['app-plus'].screenOrientation.includes('portrait-primary'))
  assert.ok(mobileManifest['app-plus'].screenOrientation.includes('landscape-primary'))
  assert.equal(mobileManifest.h5.router.mode, 'hash')
  assert.ok(mobileManifest['mp-weixin'])
  assert.equal(mobileManifest['mp-weixin'].appid, '')
  assert.match(readText('apps/mobile/index.html'), /viewport-fit=cover/)
  const mobileApp = readText('apps/mobile/src/App.vue')
  assert.match(mobileApp, /bootstrapMobileAuth/)
  assert.match(mobileApp, /env\(safe-area-inset-top\)/)
  assert.match(mobileApp, /env\(safe-area-inset-bottom\)/)
  assert.match(mobileApp, /未完成身份校验前不会渲染受保护学习内容/)
  const navigation = readText('apps/mobile/src/auth/navigation.ts')
  for (const marker of ['installMobileNavigationGuard', 'isMobileProtectedPath', 'safeMobileReturnTo', 'status === 401', 'FORBIDDEN_PATH']) assert.match(navigation, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const mobilePackage = readJson('apps/mobile/package.json')
  for (const script of ['build:h5', 'build:app', 'build:mp-weixin']) assert.ok(mobilePackage.scripts[script])
  const pwaManifest = readJson('apps/learner-web/public/manifest.webmanifest')
  assert.equal(pwaManifest.start_url, '/home')
  assert.equal(pwaManifest.display, 'standalone')
  assert.equal(pwaManifest.lang, 'zh-CN')
  const learnerIndex = readText('apps/learner-web/index.html')
  assert.match(learnerIndex, /rel="manifest"/)
  assert.match(learnerIndex, /navigator\.serviceWorker\.register\('\/sw\.js'\)/)
  assert.match(learnerIndex, /location\.protocol === 'https:'/)
  const serviceWorker = readText('apps/learner-web/public/sw.js')
  for (const marker of ['CACHE_NAME', 'caches.delete', "event.request.method !== 'GET'"]) assert.match(serviceWorker, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('B27 evidence contract requires real device artifacts and blocks console/page errors', () => {
  const evidence = config.evidenceContract
  for (const required of ['runId', 'caseId', 'targetId', 'sourceProject', 'compilerVersion', 'deviceProfile', 'screenshotsOrDeviceCapture', 'traceOrNativeDeviceLog', 'networkTrace', 'authTrace', 'storageOrCacheReport', 'databaseReconciliation', 'consoleLog', 'pageErrors']) assert.ok(evidence.requiredPerCase.includes(required), `missing ${required}`)
  for (const required of ['status-is-passed', 'runtimeBlocked-is-false', 'evidence-files-are-addressable', 'authenticated-journey-is-server-backed', 'database-reconciliation-is-matched']) assert.ok(evidence.passRequirements.includes(required), `missing ${required}`)
  for (const required of ['status-is-runtimeBlocked', 'runtimeBlocked-is-true', 'blockedReason-is-present', 'runtimeEvidence-is-null']) assert.ok(evidence.blockedRequirements.includes(required), `missing ${required}`)
  assert.deepEqual(evidence.consolePolicy, { failOnConsoleError: true, failOnPageError: true, failOnUnhandledRejection: true })
  for (const forbidden of ['password', 'clientSecret', 'accessToken', 'refreshToken', 'phone', 'email', 'rawAudio']) assert.ok(evidence.forbiddenFixtureFields.includes(forbidden))
})

test('B27 static validator passes and runtime request fails closed', () => {
  const staticResult = runValidator()
  assert.equal(staticResult.status, 0, staticResult.stdout + staticResult.stderr)
  const staticReport = JSON.parse(staticResult.stdout)
  assert.equal(staticReport.result, 'PASS')
  assert.equal(staticReport.runtimeBlocked, true)
  assert.equal(staticReport.runtimeRequested, false)

  const runtimeResult = runValidator('--require-runtime')
  assert.notEqual(runtimeResult.status, 0, 'runtime must not pass without runtime evidence')
  const runtimeReport = JSON.parse(runtimeResult.stdout)
  assert.equal(runtimeReport.result, 'FAIL')
  assert.equal(runtimeReport.runtimeRequested, true)
  assert.ok(runtimeReport.errors.some((error) => /runtimeBlocked|runtime evidence/i.test(error)))
})

test('B27 configuration contains no credential, PII or Phase 2/3 runtime evidence', () => {
  const values = valuesOnly(config)
  for (const value of values) {
    if (config.evidenceContract.forbiddenEvidenceValues.includes(value)) continue
    assert.doesNotMatch(value, /eyJ[A-Za-z0-9_-]{20,}/)
    assert.doesNotMatch(value, /BEGIN (?:RSA |EC )?PRIVATE KEY/)
    assert.doesNotMatch(value, /^sk-[A-Za-z0-9_-]{12,}/)
    assert.doesNotMatch(value, /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    assert.doesNotMatch(value, /\+?\d[\d -]{9,}\d/)
  }
  assert.equal(config.execution.runtimeEvidence, null)
  for (const target of config.buildTargets) assert.equal(target.runtimeEvidence, null)
  for (const device of config.deviceProfiles) assert.equal(device.runtimeEvidence, null)
  for (const scenario of config.scenarios) assert.equal(scenario.runtimeEvidence, null)
  assert.ok(config.evidenceContract.forbiddenDefaultCapabilities.includes('phase-2-ai'))
  assert.ok(config.evidenceContract.forbiddenDefaultCapabilities.includes('phase-3-k12'))
})
