import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const matrix = JSON.parse(readFileSync(join(root, 'config/b19-browser-device-matrix.json'), 'utf8'))

const expectedApps = ['learner-web', 'mobile', 'admin-web', 'official-site']
const expectedBrowsers = ['playwright-chromium', 'playwright-edge', 'playwright-safari-webkit', 'safari-native']
const expectedStates = ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']
const expectedDevices = ['desktop-web', 'tablet-browser', 'windows-pwa', 'h5-android', 'h5-ios', 'app-android', 'app-ios', 'app-ipad', 'wechat-miniapp']

test('B19 fixture is Phase 1 static-only and explicitly runtime blocked', () => {
  assert.equal(matrix.version, 1)
  assert.equal(matrix.phase, 'phase-1')
  assert.deepEqual(matrix.ownerTasks, ['V2-B19-BRW-003', 'V2-B19-DEV-004'])
  assert.equal(matrix.execution.mode, 'static-fixture-only')
  assert.equal(matrix.execution.status, 'runtimeBlocked')
  assert.equal(matrix.execution.runtimeBlocked, true)
  assert.equal(matrix.execution.allowUnverifiedPass, false)
  assert.ok(matrix.execution.blockedReasons.length >= 3)
  assert.equal(matrix.execution.runtimeEvidence, null)
})

test('B19 covers four applications and browser engine boundaries without fake passes', () => {
  assert.deepEqual(matrix.applications.map((app) => app.id), expectedApps)
  assert.deepEqual(matrix.browserRuntimes.map((browser) => browser.id), expectedBrowsers)
  for (const browser of matrix.browserRuntimes) {
    assert.equal(browser.status, 'runtimeBlocked')
    assert.equal(browser.runtimeEvidence, null)
  }
  assert.equal(matrix.browserRuntimes.find((browser) => browser.id === 'playwright-chromium').engine, 'chromium')
  assert.equal(matrix.browserRuntimes.find((browser) => browser.id === 'playwright-edge').channel, 'msedge')
  assert.equal(matrix.browserRuntimes.find((browser) => browser.id === 'playwright-safari-webkit').engine, 'webkit')
  assert.equal(matrix.browserRuntimes.find((browser) => browser.id === 'safari-native').coverageMode, 'native')
  for (const app of matrix.applications) {
    assert.ok(app.origin.startsWith('http://127.0.0.1:'))
    assert.deepEqual(app.requiredStates, expectedStates)
    assert.ok(app.routes.length > 0)
    assert.deepEqual(app.browserIds, expectedBrowsers)
  }
})

test('B19 scenarios cover public/login/eight-state/permission/keyboard/responsive cases', () => {
  const kinds = new Set(matrix.scenarios.map((scenario) => scenario.kind))
  for (const kind of ['public', 'login', 'eight-states', 'permission', 'keyboard', 'responsive']) assert.ok(kinds.has(kind), `missing ${kind} scenario`)
  for (const scenario of matrix.scenarios) {
    assert.equal(scenario.status, 'runtimeBlocked')
    assert.equal(scenario.runtimeEvidence, null)
    assert.ok(scenario.appIds.length > 0)
    assert.ok(scenario.assertions.length > 0)
    for (const appId of scenario.appIds) assert.ok(scenario.routeByApp[appId], `${scenario.id} needs a route for ${appId}`)
  }
  for (const scenario of matrix.scenarios.filter((item) => item.kind === 'eight-states')) assert.deepEqual(scenario.stateIds, expectedStates)
  assert.ok(matrix.scenarios.find((scenario) => scenario.kind === 'permission' && scenario.requiredPermissions?.length))
  assert.ok(matrix.scenarios.find((scenario) => scenario.kind === 'keyboard'))
  assert.ok(matrix.scenarios.find((scenario) => scenario.kind === 'responsive' && scenario.viewportIds.length >= 4))
})

test('B19 device fixture covers H5/native iOS/Android/iPad/PWA/WeChat and required capabilities', () => {
  assert.deepEqual(matrix.deviceProfiles.map((device) => device.id), expectedDevices)
  const platforms = new Set(matrix.deviceProfiles.map((device) => device.platform))
  for (const platform of ['h5', 'ios', 'android', 'ipad', 'pwa', 'wechat-miniapp']) assert.ok(platforms.has(platform), `missing ${platform}`)
  for (const device of matrix.deviceProfiles) {
    assert.equal(device.status, 'runtimeBlocked')
    assert.equal(device.runtimeEvidence, null)
    assert.ok(device.secureStorage.required)
    assert.ok(device.mediaPermissions.permissionStates.includes('denied'))
    assert.ok(device.mediaPermissions.permissionStates.includes('blocked'))
    assert.ok(device.orientations.length > 0)
    assert.ok(device.keyboard.required)
    assert.ok(device.backgroundRecovery.required)
  }
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'secure-storage'))
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'media-permission'))
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'orientation'))
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'background-recovery'))
  assert.ok(matrix.scenarios.some((scenario) => scenario.kind === 'back-navigation'))
})

test('B19 evidence contract rejects an unverified pass and forbids sensitive fixtures', () => {
  assert.ok(matrix.evidenceContract.passRequirements.includes('runtimeBlocked-is-false'))
  assert.ok(matrix.evidenceContract.passRequirements.includes('evidence-files-are-addressable'))
  assert.ok(matrix.evidenceContract.blockedRequirements.includes('runtimeEvidence-is-null'))
  assert.deepEqual(matrix.evidenceContract.forbiddenFixtureFields, ['password', 'clientSecret', 'accessToken', 'refreshToken', 'authorization', 'paymentCredential', 'rawAudio'])
  assert.doesNotMatch(JSON.stringify(matrix.accounts ?? []), /password|secret|accessToken|refreshToken|authorization|paymentCredential|rawAudio/i)
  assert.doesNotMatch(JSON.stringify(matrix), /ai-orchestrator|realtime-voice|guardian-service|institution-service|curriculum-rights-service/i)
})
