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
const queueKey = 'yx.b4.mobile.sync.v1'
const worldApiNames = ['getB4Profile', 'getB4Streak', 'listB4Quests', 'getB4Season', 'getB4AvatarProfile', 'listB4AvatarItems', 'listB4Loadouts', 'getB4AvatarResources', 'listB4Games', 'listB4Rooms', 'listB4Notifications', 'getB4NotificationPreferences', 'listB4OfflinePackages']

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

function event(id, roomId = 'room-1') {
  return { clientEventId: id, eventType: 'social.interaction.sent.v1', occurredAt: '2026-09-23T00:00:00Z', entityId: roomId, entityVersion: 0, payload: { roomId, interactionCode: 'CHEER_UP' } }
}

function environment() {
  setActivePinia(createPinia())
  const storage = new Map()
  const runtime = { getStorageSync: (key) => storage.get(key) ?? '', setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: (key) => storage.delete(key) }
  const platform = { getUniRuntime: () => runtime }
  const session = reactive({ verifiedSubject: null, identityRevision: 0, isAuthenticated: false })
  const sessionModule = { useSessionStore: () => session }
  function login(subject) { session.verifiedSubject = subject; session.identityRevision += 1; session.isAuthenticated = true }
  function logout() { session.isAuthenticated = false; session.verifiedSubject = null; session.identityRevision += 1 }
  const domain = load('src/domain/b4.ts', { '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture-${Math.random()}` } })
  const offlineModule = load('src/platform/b4-offline.ts', { './uni-runtime': platform })
  const cache = load('src/stores/learning-cache.ts', { '../platform/uni-runtime': platform })
  const api = {
    getB4Profile: async () => ({ userId: session.verifiedSubject, xp: 25, level: 2, coins: 8 }),
    getB4Streak: async () => ({ currentStreak: 3 }),
    listB4Quests: async () => ({ items: [{ questId: `${session.verifiedSubject}-quest`, title: 'Daily', target: 2 }] }),
    getB4Season: async () => ({ seasonId: `${session.verifiedSubject}-season`, title: 'Autumn' }),
    getB4AvatarProfile: async () => ({ avatarId: `${session.verifiedSubject}-avatar`, resourceVersion: '1', loadoutId: 'loadout-1' }),
    listB4AvatarItems: async () => ({ items: [{ itemCode: `${session.verifiedSubject}-item` }] }),
    listB4Loadouts: async () => ({ items: [{ loadoutId: `${session.verifiedSubject}-loadout` }] }),
    getB4AvatarResources: async () => ({ resourceVersion: '1' }),
    listB4Games: async () => ({ items: [{ gameCode: 'WORD_MATCH', releasePhase: 'P0', enabled: true }] }),
    listB4Rooms: async () => ({ items: [{ roomId: `${session.verifiedSubject}-room` }] }),
    listB4Notifications: async () => ({ items: [{ messageId: `${session.verifiedSubject}-notice`, safeBody: 'Safe body' }] }),
    getB4NotificationPreferences: async () => ({ version: 1 }),
    listB4OfflinePackages: async () => ({ items: [{ packageId: `${session.verifiedSubject}-package` }] }),
    listB4Chests: async () => ({ items: [{ chestGrantId: `${session.verifiedSubject}-chest` }] }),
    sendB4Interaction: async () => {},
    pushB4SyncEvents: async () => ({ accepted: true }),
  }
  const strategy = { fallbackMode: 'svg' }
  class MobileApiError extends Error { constructor(status, message) { super(message); this.status = status } }
  const storeModule = load('src/stores/b4.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '@englishflow/performance': { createAdaptivePerformanceEngine: () => ({ level: 'High', state: { strategy }, subscribe: () => () => {}, restore: () => {}, setLevel: () => {}, dispose: () => {} }) },
    '../api/client': { MobileApiError },
    '../api/b4': api, '../domain/b4': domain, '../platform/b4-offline': offlineModule,
    '../platform/uni-runtime': platform, './session': sessionModule,
  })
  const store = storeModule.useB4Store()
  return { store, session, login, logout, api, storage, runtime, offlineModule, cache, MobileApiError }
}

test('world owner feeds clear on A to B and late A read cannot overwrite B', async () => {
  const { store, login, api } = environment()
  login('A')
  const delayedA = deferred()
  const getProfile = api.getB4Profile
  api.getB4Profile = () => delayedA.promise
  const oldRead = store.loadWorld()
  login('B')
  assert.equal(store.profile, null)
  assert.equal(store.notifications.length, 0)
  assert.equal(store.quests.length, 0)
  assert.equal(store.offlinePackages.length, 0)
  api.getB4Profile = getProfile
  await store.loadWorld()
  assert.equal(store.profile.userId, 'B')
  assert.equal(store.notifications[0].messageId, 'B-notice')
  delayedA.resolve({ userId: 'A', xp: 900, level: 10, coins: 100 })
  await oldRead
  assert.equal(store.profile.userId, 'B')
  assert.equal(store.notifications[0].messageId, 'B-notice')
})

test('permission denial clears prior world data and late individual reads but preserves offline queue', async () => {
  const { store, login, api, storage, MobileApiError } = environment()
  login('A')
  await store.loadWorld()
  api.sendB4Interaction = async () => { throw new TypeError('offline') }
  await store.sendInteraction('A-room', 'CHEER_UP')
  assert.equal(store.queueCount, 1)
  const lateChests = deferred()
  api.listB4Chests = () => lateChests.promise
  const chestRead = store.loadChests()
  api.getB4Profile = async () => { throw new MobileApiError(403, 'Access denied') }
  await store.loadWorld()
  assert.equal(store.status, 'permission')
  assert.equal(store.profile, null)
  assert.equal(store.galaxy, null)
  assert.equal(store.streak, null)
  assert.equal(store.quests.length, 0)
  assert.equal(store.avatarProfile, null)
  assert.equal(store.rooms.length, 0)
  assert.equal(store.notifications.length, 0)
  assert.equal(store.notificationStatus, 'error')
  assert.equal(store.offlinePackages.length, 0)
  assert.equal(store.queueCount, 1)
  assert.equal(JSON.parse(storage.get(queueKey)).subject, 'A')
  lateChests.resolve({ items: [{ chestGrantId: 'stale-reward' }] })
  await chestRead
  assert.equal(store.chests.length, 0)
  assert.equal(store.status, 'permission')
})

test('all world reads failing clears stale views and leaves an in-flight offline event retryable', async () => {
  const { store, login, api } = environment()
  login('A')
  await store.loadWorld()
  api.sendB4Interaction = async () => { throw new TypeError('offline') }
  await store.sendInteraction('A-room', 'CHEER_UP')
  store.online = true
  const delayedSync = deferred()
  api.pushB4SyncEvents = () => delayedSync.promise
  const syncing = store.syncOffline()
  for (const name of worldApiNames) api[name] = async () => { throw new TypeError('offline') }
  await store.loadWorld()
  assert.equal(store.status, 'offline')
  assert.equal(store.profile, null)
  assert.equal(store.notifications.length, 0)
  assert.equal(store.notificationStatus, 'error')
  assert.equal(store.offlinePackages.length, 0)
  delayedSync.resolve({ accepted: true })
  await syncing
  assert.equal(store.queueCount, 1)
  assert.equal(store.offlineRecords[0].status, 'FAILED')
  assert.equal(store.status, 'offline')
})

test('partial world success displays only fresh successful feeds and reports failed feed', async () => {
  const { store, login, api } = environment()
  login('A')
  await store.loadWorld()
  assert.equal(store.notifications.length, 1)
  api.getB4Profile = async () => ({ userId: 'A', xp: 88, level: 4, coins: 3 })
  api.listB4Quests = async () => { throw new TypeError('offline') }
  api.listB4Notifications = async () => { throw new TypeError('offline') }
  await store.loadWorld()
  assert.equal(store.status, 'ready')
  assert.equal(store.profile.xp, 88)
  assert.equal(store.quests.length, 0)
  assert.equal(store.notifications.length, 0)
  assert.equal(store.notificationStatus, 'error')
  assert.equal(store.lastError, '部分功能暂不可用，已显示可读取的内容。')
})

test('logout then same subject login drops old chest response and personal state', async () => {
  const { store, login, logout, api } = environment()
  login('A')
  await store.loadWorld()
  const delayed = deferred()
  api.listB4Chests = () => delayed.promise
  const oldRead = store.loadChests()
  logout()
  assert.equal(store.profile, null)
  assert.equal(store.avatarProfile, null)
  assert.equal(store.activeGame, null)
  assert.equal(store.notifications.length, 0)
  login('A')
  delayed.resolve({ items: [{ chestGrantId: 'old-A-chest' }] })
  await oldRead
  assert.equal(store.chests.length, 0)
  assert.equal(store.profile, null)
  assert.equal(store.actionKey, null)
})

test('offline records are hidden until the matching verified subject and legacy records are removed', () => {
  const { storage, offlineModule } = environment()
  const aEvent = event('A-event')
  storage.set(queueKey, JSON.stringify({ schemaVersion: 2, subject: 'A', records: [{ id: 'A-event', event: aEvent, status: 'SYNCING', attemptCount: 0, lastError: null, queuedAt: '2026-09-23T00:00:00Z' }] }))
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

test('A offline interaction is never replayed as B, and logout clears queue storage', async () => {
  const { store, login, logout, api, storage, cache } = environment()
  login('A')
  api.sendB4Interaction = async () => { throw new TypeError('network unavailable') }
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
  logout()
  assert.equal(store.queueCount, 0)
  assert.equal(storage.has(queueKey), false)
  storage.set(queueKey, 'old queue')
  cache.removeAllLearningCaches()
  assert.equal(storage.has(queueKey), false)
})

test('late A interaction failure and in-flight sync cannot populate B queue or status', async () => {
  const { store, login, api } = environment()
  login('A')
  const delayedSend = deferred()
  api.sendB4Interaction = () => delayedSend.promise
  const sending = store.sendInteraction('A-room', 'CHEER_UP')
  login('B')
  delayedSend.reject(new TypeError('old network failure'))
  await sending
  assert.equal(store.queueCount, 0)
  assert.equal(store.status, 'idle')

  api.sendB4Interaction = async () => { throw new TypeError('network unavailable') }
  await store.sendInteraction('B-room', 'CHEER_UP')
  assert.equal(store.queueCount, 1)
  store.online = true
  const delayedSync = deferred()
  api.pushB4SyncEvents = () => delayedSync.promise
  const syncing = store.syncOffline()
  login('C')
  delayedSync.resolve({ accepted: true })
  await syncing
  assert.equal(store.queueCount, 0)
  assert.equal(store.status, 'idle')
})

test('B4 owner actions do not issue requests without authenticated subject', async () => {
  const { store, api } = environment()
  let calls = 0
  api.sendB4Interaction = async () => { calls += 1 }
  api.getB4Profile = async () => { calls += 1 }
  api.pushB4SyncEvents = async () => { calls += 1 }
  await store.sendInteraction('room-1', 'CHEER_UP')
  await store.loadWorld()
  await store.syncOffline()
  assert.equal(calls, 0)
  assert.equal(store.queueCount, 0)
})

test('offline storage failure does not claim an interaction was queued', async () => {
  const { store, login, api, runtime, storage } = environment()
  login('A')
  api.sendB4Interaction = async () => { throw new TypeError('network unavailable') }
  runtime.setStorageSync = () => { throw new Error('storage unavailable') }
  await store.sendInteraction('A-room', 'CHEER_UP')
  assert.equal(store.queueCount, 0)
  assert.equal(storage.has(queueKey), false)
  assert.equal(store.lastError, '离线保存失败，请重试。')
})
