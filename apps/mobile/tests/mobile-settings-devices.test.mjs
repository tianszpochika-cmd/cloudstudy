import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

test('device list reads the IAM envelope, parses server isCurrent, and rejects malformed records', async () => {
  const calls = []
  let response = { data: { devices: [
    { deviceId: 'device-a', deviceType: 'IOS', status: 'ACTIVE', lastActiveAt: '2026-09-25T10:00:00Z', isCurrent: true },
    { deviceId: 'device-b', deviceType: 'WEB', status: 'ACTIVE', lastActiveAt: '2026-09-25T10:05:00Z', isCurrent: false },
  ] } }
  const api = load('src/api/devices.ts', {
    './client': { mobileApiClient: { request: async (...args) => { calls.push(args); return response } } },
    '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture` },
  })

  assert.deepEqual(await api.listMobileDevices(), [
    { deviceId: 'device-a', deviceType: 'IOS', status: 'ACTIVE', lastActiveAt: '2026-09-25T10:00:00Z', isCurrent: true },
    { deviceId: 'device-b', deviceType: 'WEB', status: 'ACTIVE', lastActiveAt: '2026-09-25T10:05:00Z', isCurrent: false },
  ])
  assert.equal(calls[0][0], '/iam/devices')
  response = { data: { devices: [{ deviceId: 'device-c', deviceType: 'WEB', status: 'UNKNOWN', lastActiveAt: '' }] } }
  await assert.rejects(api.listMobileDevices(), /无效记录/)
})

test('device kickout encodes the ID and sends an idempotency key', async () => {
  const calls = []
  const api = load('src/api/devices.ts', {
    './client': { mobileApiClient: { request: async (...args) => { calls.push(args) } } },
    '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture` },
  })

  await api.kickoutMobileDevice('device/one')
  assert.equal(calls[0][0], '/iam/devices/device%2Fone/kickout')
  assert.equal(calls[0][1].method, 'POST')
  assert.equal(calls[0][1].header['Idempotency-Key'], 'mobile-device-kickout-fixture')
  await assert.rejects(api.kickoutMobileDevice(' '), /缺少设备标识/)
})

test('current devices and revoked devices cannot be revoked with server isCurrent priority and fallback', () => {
  const domain = load('src/domain/devices.ts', {})

  // Server provides isCurrent: true -> current device
  assert.equal(domain.isCurrentMobileDevice({ deviceId: 'dev-1', isCurrent: true }, 'dev-2'), true)
  assert.equal(domain.canRevokeMobileDevice({ deviceId: 'dev-1', status: 'ACTIVE', isCurrent: true }, 'dev-2'), false)

  // Server provides isCurrent: false -> not current device, even if client thought it was
  assert.equal(domain.isCurrentMobileDevice({ deviceId: 'dev-2', isCurrent: false }, 'dev-2'), false)
  assert.equal(domain.canRevokeMobileDevice({ deviceId: 'dev-2', status: 'ACTIVE', isCurrent: false }, 'dev-2'), true)

  // Revoked devices cannot be revoked
  assert.equal(domain.canRevokeMobileDevice({ deviceId: 'dev-3', status: 'REVOKED', isCurrent: false }, 'dev-1'), false)

  // Fallback mode when isCurrent is absent (undefined)
  assert.equal(domain.isCurrentMobileDevice({ deviceId: 'dev-fallback' }, 'dev-fallback'), true)
  assert.equal(domain.isCurrentMobileDevice({ deviceId: 'dev-fallback' }, 'other'), false)
  assert.equal(domain.isCurrentMobileDevice({ deviceId: 'dev-fallback' }, null), false)
  assert.equal(domain.canRevokeMobileDevice({ deviceId: 'dev-fallback', status: 'ACTIVE' }, 'dev-fallback'), false)
  assert.equal(domain.canRevokeMobileDevice({ deviceId: 'dev-fallback', status: 'ACTIVE' }, 'other'), true)
  assert.equal(domain.canRevokeMobileDevice({ deviceId: 'dev-fallback', status: 'ACTIVE' }, null), false)
})

test('reduced motion remains distinct from full motion and motion off', () => {
  const experience = load('src/domain/experience.ts', {})
  const normal = { level: 'High', motionDisabled: false, reducedMotion: false }
  assert.equal(experience.resolveMobileMotion('FULL', normal), 'on')
  assert.equal(experience.resolveMobileMotion('REDUCED', normal), 'reduced')
  assert.equal(experience.resolveMobileMotion('OFF', normal), 'off')
  assert.equal(experience.resolveMobileMotion('FULL', { ...normal, level: 'Performance' }), 'off')
  assert.equal(experience.resolveMobileMotion('FULL', { ...normal, reducedMotion: true }), 'off')
})

test('account save changes only display preferences while retaining server locales', async () => {
  const calls = []
  class MobileApiError extends Error { constructor(message, status) { super(message); this.status = status } }
  const response = (path, options) => {
    if (path === '/learner/profile') return { data: { profile: { stateVersion: 99 } } }
    if (path === '/learner/targets') return { data: { goalCode: 'ZERO_BASIS', dailyQuotaMinutes: 15 } }
    if (path === '/learner/preferences') return { data: { stateVersion: 4, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' } }
    return undefined
  }
  const api = load('src/api/learner-content.ts', {
    './client': { MobileApiError, mobileApiClient: { request: async (path, options) => {
      calls.push({ path, options })
      if (options?.method === 'PATCH') return { data: { stateVersion: 5 } }
      return response(path, options)
    } } },
    '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture` },
  })

  await api.mobileLearnerContentApi.savePreferences({ themeMode: 'DARK', highContrast: true, motionMode: 'OFF', clientEventId: 'settings-save-1' })
  const patch = calls.find((call) => call.options?.method === 'PATCH')
  assert.equal(patch.path, '/learner/preferences')
  assert.deepEqual(patch.options.data, {
    expectedStateVersion: 4,
    uiLocale: 'zh-CN',
    contentLocale: 'en-US',
    timezone: 'Asia/Shanghai',
    themeMode: 'DARK',
    highContrast: true,
    motionMode: 'OFF',
  })
  assert.equal(Object.hasOwn(patch.options.data, 'performanceLevel'), false)
})

test('onboarding options use the canonical content locale read from persisted preferences', async () => {
  const calls = []
  const api = load('src/api/learner-content.ts', {
    './client': {
      MobileApiError: class MobileApiError extends Error {},
      mobileApiClient: { request: async (path) => {
        calls.push(path)
        if (path === '/learner/preferences') return { data: { uiLocale: 'zh-CN', contentLocale: 'zh-CN', stateVersion: 7 } }
        if (path.startsWith('/learner/profile')) return { data: { profile: { stateVersion: 3 } } }
        if (path.startsWith('/learner/targets')) return { data: { goalCode: 'ZERO_BASIS', dailyQuotaMinutes: 15 } }
        if (path.startsWith('/onboarding/options')) return { data: { goals: [{ value: 'ZERO_BASIS', label: '从零开始' }], dailyQuotaMinutes: [15] } }
        throw new Error(`Unexpected request ${path}`)
      } },
    },
  }).mobileLearnerContentApi

  const onboarding = await api.readOnboarding()
  assert.equal(onboarding.contentLocale, 'zh-CN')
  assert.equal(calls[0], '/learner/preferences')
  assert.ok(calls.includes('/onboarding/options?contentLocale=zh-CN'))
})

test('content locale PATCH uses preference aggregate version and confirms the persisted GET value', async () => {
  const calls = []
  let persistedLocale = 'en-US'
  let preferenceVersion = 6
  const api = load('src/api/learner-content.ts', {
    './client': {
      MobileApiError: class MobileApiError extends Error {},
      mobileApiClient: { request: async (path, options = {}) => {
        calls.push({ path, options })
        if (path === '/learner/profile') return { data: { profile: { stateVersion: 90 } } }
        if (path === '/learner/targets') return { data: { goalCode: 'ZERO_BASIS', dailyQuotaMinutes: 15 } }
        if (path === '/learner/preferences' && options.method !== 'PATCH') return { data: { uiLocale: 'zh-CN', contentLocale: persistedLocale, stateVersion: preferenceVersion, themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', timezone: 'Asia/Shanghai' } }
        if (path === '/learner/preferences' && options.method === 'PATCH') {
          persistedLocale = options.data.contentLocale
          preferenceVersion += 1
          return { data: { stateVersion: preferenceVersion } }
        }
        throw new Error(`Unexpected request ${path}`)
      } },
    },
  }).mobileLearnerContentApi

  const result = await api.savePreferences({ contentLocale: 'zh-CN', clientEventId: 'content-locale-save' })
  const patch = calls.find(({ options }) => options.method === 'PATCH')
  assert.equal(patch.options.data.expectedStateVersion, 6)
  assert.equal(patch.options.data.contentLocale, 'zh-CN')
  assert.equal(result.contentLocale, 'zh-CN')
  assert.ok(calls.filter(({ path }) => path === '/learner/preferences').length >= 3)
})

test('pending settings draft does not cross a verified account transition', () => {
  const values = new Map()
  const storage = {
    getStorageSync: (key) => values.get(key),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
  }
  const sync = load('src/domain/mobile-preference-sync.ts', {})

  let scope = sync.transitionMobilePreferenceSubject(null, 'subject-a', storage)
  assert.equal(scope.pendingSync, false)
  sync.setPendingMobilePreferenceSync(scope.subject, true, storage)
  assert.equal(sync.hasPendingMobilePreferenceSync('subject-a', storage), true)

  scope = sync.transitionMobilePreferenceSubject('subject-a', 'subject-b', storage)
  assert.deepEqual(scope, { subject: 'subject-b', pendingSync: false })
  assert.equal(sync.hasPendingMobilePreferenceSync('subject-a', storage), false)

  scope = sync.transitionMobilePreferenceSubject('subject-b', 'subject-a', storage)
  assert.deepEqual(scope, { subject: 'subject-a', pendingSync: false })
  assert.equal(sync.sameMobilePreferenceIdentity({ subject: 'subject-a', revision: 1 }, { subject: 'subject-a', revision: 1 }), true)
  assert.equal(sync.sameMobilePreferenceIdentity({ subject: 'subject-a', revision: 1 }, { subject: 'subject-b', revision: 1 }), false)
  assert.equal(sync.sameMobilePreferenceIdentity({ subject: 'subject-a', revision: 1 }, { subject: 'subject-a', revision: 2 }), false)
})
