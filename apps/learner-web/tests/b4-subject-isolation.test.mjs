import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { createPinia, setActivePinia } = require('pinia')
const { reactive } = require('vue')
const root = path.resolve(import.meta.dirname, '..')
const queueKey = 'yx.b4.learner-web.sync.v1'

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function event(id) {
  return { clientEventId: id, eventType: 'social.interaction.sent.v1', occurredAt: '2026-09-23T00:00:00Z', entityId: 'room-1', entityVersion: 0, payload: { roomId: 'room-1', interactionCode: 'CHEER_UP' } }
}

function environment() {
  setActivePinia(createPinia())
  const storage = new Map()
  globalThis.window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    addEventListener: () => {},
    location: { pathname: '/home', search: '', hash: '' },
  }
  const session = reactive({ accessToken: null, principal: null, userId: null, status: 'unauthenticated', authGeneration: 0 })
  const sessionModule = { useSessionStore: () => session }
  function login(subject) {
    session.authGeneration += 1
    session.status = 'restoring'; session.principal = null; session.userId = null; session.accessToken = null
    session.accessToken = `token-${subject}`; session.principal = { subject }; session.userId = subject; session.status = 'authenticated'
  }
  function logout() {
    session.authGeneration += 1
    session.status = 'revoking'; session.principal = null; session.userId = null; session.accessToken = null
    session.status = 'unauthenticated'
  }
  const domain = load('src/domain/b4.ts', { '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture-${Math.random()}` } })
  const offlineModule = load('src/platform/b4-offline.ts', {})
  const api = {
    getB4Profile: async () => ({ userId: session.userId, xp: 25, level: 2, coins: 8, featureFlags: { privateWorld: true } }),
    getB4Streak: async () => ({ currentStreak: 3 }),
    listB4Quests: async () => ({ items: [{ questId: `${session.userId}-quest`, title: 'Daily', target: 2 }] }),
    getB4Season: async () => ({ seasonId: `${session.userId}-season`, title: 'Autumn' }),
    getB4AvatarProfile: async () => ({ avatarId: `${session.userId}-avatar`, resourceVersion: '1', loadoutId: 'loadout-1' }),
    listB4AvatarItems: async () => ({ items: [{ itemCode: `${session.userId}-item` }] }),
    listB4Loadouts: async () => ({ items: [{ loadoutId: `${session.userId}-loadout` }] }),
    getB4AvatarResources: async () => ({ resourceVersion: '1' }),
    listB4Games: async () => ({ items: [{ gameCode: 'WORD_MATCH', releasePhase: 'P0', enabled: true }] }),
    listB4Rooms: async () => ({ items: [{ roomId: `${session.userId}-room` }] }),
    listB4Notifications: async () => ({ items: [{ messageId: `${session.userId}-notice`, title: 'Notice' }] }),
    getB4NotificationPreferences: async () => ({ version: 1 }),
    listB4OfflinePackages: async () => ({ items: [{ packageId: `${session.userId}-package` }] }),
    listB4Chests: async () => ({ items: [{ chestGrantId: `${session.userId}-chest` }] }),
    sendB4Interaction: async () => {},
    pushB4SyncEvents: async () => ({ accepted: true }),
  }
  const strategy = { fallbackMode: 'svg' }
  const performance = { level: 'High', state: { strategy }, subscribe: () => () => {}, restore: () => {}, setLevel: () => {} }
  const ApiError = class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
  const storeModule = load('src/stores/b4.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../platform/experience-ui': { experiencePerformance: performance },
    '../api/b4': api, '../api/client': { ApiError },
    '../domain/b4': domain, '../platform/b4-offline': offlineModule, './session': sessionModule,
  })
  return { store: storeModule.useB4Store(), session, login, logout, api, storage, offlineModule, ApiError }
}

for (const status of [401, 403]) {
  test(`world ${status} clears previously visible owner data and reports permission denial`, async () => {
    const { store, login, api, ApiError } = environment()
    login('A')
    await store.loadWorld()
    assert.equal(store.profile.userId, 'A')
    api.listB4Rooms = async () => { throw new ApiError(status, 'denied') }
    await store.loadWorld()
    assert.equal(store.status, 'permission')
    assert.equal(store.profile, null)
    assert.equal(store.notifications.length, 0)
    assert.equal(store.rooms.length, 0)
    assert.deepEqual(store.featureFlags, {})
    assert.equal(store.lastError, '当前没有读取学习世界的权限。')
  })
}

test('world total failure clears old data and never reports ready', async () => {
  const { store, login, api } = environment()
  login('A')
  await store.loadWorld()
  assert.equal(store.profile.userId, 'A')
  for (const name of [
    'getB4Profile', 'getB4Streak', 'listB4Quests', 'getB4Season', 'getB4AvatarProfile',
    'listB4AvatarItems', 'listB4Loadouts', 'getB4AvatarResources', 'listB4Games',
    'listB4Rooms', 'listB4Notifications', 'getB4NotificationPreferences', 'listB4OfflinePackages',
  ]) api[name] = async () => { throw new TypeError('network unavailable') }
  await store.loadWorld()
  assert.equal(store.status, 'offline')
  assert.equal(store.online, false)
  assert.equal(store.profile, null)
  assert.equal(store.quests.length, 0)
  assert.equal(store.offlinePackages.length, 0)
})

test('world partial failure preserves successful owner feeds with a visible warning', async () => {
  const { store, login, api } = environment()
  login('A')
  api.listB4Rooms = async () => { throw new TypeError('rooms unavailable') }
  await store.loadWorld()
  assert.equal(store.status, 'ready')
  assert.equal(store.profile.userId, 'A')
  assert.equal(store.rooms.length, 0)
  assert.match(store.lastError, /部分内容暂时未能加载/)
})

test('A to B clears all B4 owner feeds and late A world response cannot overwrite B', async () => {
  const { store, login, api } = environment()
  login('A')
  const delayedA = deferred()
  const getProfile = api.getB4Profile
  api.getB4Profile = () => delayedA.promise
  const oldRead = store.loadWorld()
  login('B')
  assert.equal(store.profile, null)
  assert.equal(store.notifications.length, 0)
  assert.deepEqual(store.featureFlags, {})
  api.getB4Profile = getProfile
  await store.loadWorld()
  assert.equal(store.profile.userId, 'B')
  assert.equal(store.notifications[0].messageId, 'B-notice')
  delayedA.resolve({ userId: 'A', xp: 999, level: 99, coins: 999 })
  await oldRead
  assert.equal(store.profile.userId, 'B')
  assert.equal(store.quests[0].questId, 'B-quest')
})

test('A logout then A login rejects old reward result', async () => {
  const { store, login, logout, api } = environment()
  login('A')
  await store.loadWorld()
  const delayed = deferred()
  api.listB4Chests = () => delayed.promise
  const oldRead = store.loadChests()
  logout()
  assert.equal(store.profile, null)
  assert.equal(store.avatarProfile, null)
  assert.equal(store.rooms.length, 0)
  login('A')
  delayed.resolve({ items: [{ chestGrantId: 'old-A-chest' }] })
  await oldRead
  assert.equal(store.chests.length, 0)
  assert.equal(store.actionKey, null)
})

test('queue restores only matching subject and discards unowned legacy records', () => {
  const { storage, offlineModule } = environment()
  storage.set(queueKey, JSON.stringify({ schemaVersion: 2, subject: 'A', records: [{ id: 'A-event', event: event('A-event'), status: 'SYNCING', attemptCount: 0, lastError: null, queuedAt: '2026-09-23T00:00:00Z' }] }))
  const queue = offlineModule.createB4OfflineQueue()
  assert.equal(queue.records.length, 0)
  queue.bindSubject('A')
  assert.equal(queue.records.length, 1)
  assert.equal(queue.records[0].status, 'FAILED')
  queue.bindSubject('B')
  assert.equal(queue.records.length, 0)
  assert.equal(storage.has(queueKey), false)
  storage.set(queueKey, JSON.stringify({ schemaVersion: 1, records: [{ id: 'legacy', event: event('legacy'), status: 'PENDING', attemptCount: 0 }] }))
  queue.bindSubject('A')
  assert.equal(queue.records.length, 0)
  assert.equal(storage.has(queueKey), false)
})

test('A offline interaction is not replayed as B; late send and sync cannot alter C', async () => {
  const { store, login, api, storage } = environment()
  login('A')
  api.sendB4Interaction = async () => { throw new TypeError('offline') }
  await store.sendInteraction('A-room', 'CHEER_UP')
  assert.equal(store.queueCount, 1)
  assert.equal(JSON.parse(storage.get(queueKey)).subject, 'A')
  let pushes = 0
  api.pushB4SyncEvents = async () => { pushes += 1; return { accepted: true } }
  login('B')
  assert.equal(store.queueCount, 0)
  assert.equal(storage.has(queueKey), false)
  await store.syncOffline()
  assert.equal(pushes, 0)

  const delayedSend = deferred()
  api.sendB4Interaction = () => delayedSend.promise
  const oldSend = store.sendInteraction('B-room', 'CHEER_UP')
  login('C')
  delayedSend.reject(new TypeError('old failure'))
  await oldSend
  assert.equal(store.queueCount, 0)
  assert.equal(store.status, 'idle')
  api.sendB4Interaction = async () => { throw new TypeError('offline') }
  await store.sendInteraction('C-room', 'CHEER_UP')
  store.online = true
  const delayedSync = deferred()
  api.pushB4SyncEvents = () => delayedSync.promise
  const syncing = store.syncOffline()
  login('D')
  delayedSync.resolve({ accepted: true })
  await syncing
  assert.equal(store.queueCount, 0)
  assert.equal(store.status, 'idle')
})

test('anonymous B4 owner actions issue no personal requests', async () => {
  const { store, api } = environment()
  let calls = 0
  api.getB4Profile = async () => { calls += 1 }
  api.sendB4Interaction = async () => { calls += 1 }
  api.pushB4SyncEvents = async () => { calls += 1 }
  await store.loadWorld(); await store.sendInteraction('room', 'CHEER_UP'); await store.syncOffline()
  assert.equal(calls, 0)
})

test('offline storage failure is visible and leaves no false queued item', async () => {
  const { store, login, api, storage } = environment()
  login('A')
  api.sendB4Interaction = async () => { throw new TypeError('offline') }
  globalThis.window.localStorage.setItem = () => { throw new Error('storage unavailable') }
  await store.sendInteraction('A-room', 'CHEER_UP')
  assert.equal(store.queueCount, 0)
  assert.equal(storage.has(queueKey), false)
  assert.equal(store.lastError, '离线保存失败，请重试。')
})

test('session logout removes B4 queue immediately even before B4 store is instantiated', async () => {
  setActivePinia(createPinia())
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }, location: { pathname: '/home', search: '', hash: '' } }
  let token = null
  let authSnapshot = { accessToken: null, subject: null, generation: 0, authenticated: false }
  const sessionModule = load('src/stores/session.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../auth/gateway-auth': { createGatewayAuthAdapter: () => { throw new Error('Inject auth adapter') }, safeReturnTo: () => '/home' },
    '../auth/access-token': {
      getInMemoryAccessToken: () => token,
      setInMemoryAccessToken: (value) => { token = value },
      getInMemoryAuthSnapshot: () => ({ ...authSnapshot }),
      setInMemoryAuthSnapshot: (value) => { authSnapshot = { ...value }; token = value.accessToken },
    },
    '../api/client': { ApiError: class ApiError extends Error {} },
    '../auth/auth-failure-copy': { learnerAuthFailureMarker: () => 'failed' },
    '../platform/gateway': { getGatewayBaseUrl: () => 'http://127.0.0.1:18070' },
    '../domain/b1': { B1_STORAGE_KEY: 'yx.b1.learner-web.v1' },
    '../router': { router: { currentRoute: { value: { name: 'login' } }, replace: async () => {} } },
  })
  const session = sessionModule.useSessionStore()
  const pendingLogout = deferred()
  session.setAuthAdapter({
    login: async () => ({ accessToken: 'A-token' }),
    getPermissions: async () => ({ principal: { subject: 'A', roles: [], permissions: [], adultGate: 'PASSED' } }),
    logout: () => pendingLogout.promise,
  })
  assert.equal(await session.login('A', 'fixture'), true)
  storage.set(queueKey, JSON.stringify({ schemaVersion: 2, subject: 'A', records: [{ id: 'A-event', event: event('A-event'), status: 'PENDING', attemptCount: 0 }] }))
  const logout = session.logout()
  assert.equal(storage.has(queueKey), false)
  pendingLogout.resolve()
  assert.equal(await logout, true)
})
