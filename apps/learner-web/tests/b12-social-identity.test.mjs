import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const componentPath = path.join(appRoot, 'src/components/b12/B12SocialExtensions.vue')
const source = fs.readFileSync(componentPath, 'utf8')
const requirePackage = createRequire(import.meta.url)
const vue = requirePackage('vue')

class TestApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function authenticatedSession(subject = 'A') {
  return vue.reactive({
    accessToken: `token-${subject}`,
    userId: subject,
    principal: { subject },
    permissions: ['social.leaderboard.read', 'social.report.create.self', 'notification.message.read.self'],
    status: 'authenticated',
    authGeneration: 1,
  })
}

function mountSocialExtensions(session, b4, api) {
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'B12 social extension must keep a script setup block')
  const compiled = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mounted = []
  const unmounted = []
  const runtimeVue = {
    ...vue,
    onMounted: callback => mounted.push(callback),
    onUnmounted: callback => unmounted.push(callback),
  }
  let authSnapshot = {
    accessToken: session.accessToken,
    subject: session.principal?.subject ?? null,
    generation: session.authGeneration,
    authenticated: session.status === 'authenticated',
  }
  const dependencies = {
    vue: runtimeVue,
    'vue-router': { RouterLink: {} },
    '../../api/client': { ApiError: TestApiError },
    '../../auth/access-token': { getInMemoryAuthSnapshot: () => ({ ...authSnapshot }) },
    '../../domain/b4': { B4_REPORT_REASONS: ['OTHER'], formatSeconds: value => String(value) },
    '../../stores/b4': { useB4Store: () => b4 },
    '../../stores/session': { useSessionStore: () => session },
    '../../api/b12': api,
    '../../platform/b12-i18n': { b12T: key => key },
  }
  const module = { exports: {} }
  const exportsForTest = `
    module.exports.__test = {
      selectedRoomId, leaderboard, notificationCount, lastReport, status, actionKey,
      canReadLeaderboard, canCreateSocialReport, canReadNotifications,
      loadLeaderboard, loadNotificationCount, reportUser,
    };
  `
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', `${compiled}\n${exportsForTest}`)(name => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name]
      throw new Error(`unexpected dependency: ${name}`)
    }, module, module.exports)
  })
  return {
    state: module.exports.__test,
    mount: () => mounted.forEach(callback => callback()),
    publishConfirmedSnapshot: () => {
      authSnapshot = {
        accessToken: session.accessToken,
        subject: session.principal?.subject ?? null,
        generation: session.authGeneration,
        authenticated: session.status === 'authenticated' && Boolean(session.accessToken && session.principal?.subject),
      }
    },
    unmount: () => { unmounted.forEach(callback => callback()); scope.stop() },
  }
}

async function flushPromises() {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
}

function room(roomId) { return { roomId, name: roomId } }
function leaderboardEntry(displayName, rank = 1) {
  return { rank, displayName, displayMode: 'NICKNAME', score: 30, qualifiedUnits: 30, isSelf: false, targetSeatIndex: 3 }
}

test('B12 notification badge labels its bounded fetched page count clearly', () => {
  const messages = fs.readFileSync(path.join(appRoot, 'src/platform/b12-i18n.ts'), 'utf8')
  assert.match(source, /b12T\('notifications\.loadedCount', \{ count: notificationCount \}\)/)
  assert.match(messages, /loadedCount: '已读取 \{\{count\}\} 条'/)
  assert.match(messages, /loadedCount: '\{\{count\}\} loaded'/)
})

test('B12 social card clears A data at logout and rejects late A responses after B login', async () => {
  const session = authenticatedSession('A')
  const b4 = vue.reactive({ rooms: [room('room-A')], online: true })
  const notificationAFirst = deferred()
  const notificationALate = deferred()
  const leaderboardA = deferred()
  const leaderboardLateA = deferred()
  const notificationCalls = []
  let notificationAReads = 0
  const leaderboardCalls = []
  const reportCalls = []
  const notificationsB = deferred()
  const leaderboardB = deferred()
  const component = mountSocialExtensions(session, b4, {
    listB12Notifications: () => {
      const subject = session.principal?.subject ?? 'anonymous'
      notificationCalls.push(subject)
      if (subject !== 'A') return notificationsB.promise
      notificationAReads += 1
      return notificationAReads === 1 ? notificationAFirst.promise : notificationALate.promise
    },
    getB12SocialLeaderboard: roomId => {
      const subject = session.principal?.subject ?? 'anonymous'
      leaderboardCalls.push(`${subject}:${roomId}`)
      if (subject === 'A') return roomId === 'room-A' ? leaderboardA.promise : leaderboardLateA.promise
      return leaderboardB.promise
    },
    createB12SocialReport: async (roomId, targetSeatIndex) => {
      const subject = session.principal?.subject ?? 'anonymous'
      reportCalls.push(`${subject}:${roomId}:${targetSeatIndex}`)
      return { status: 'RECEIVED', reviewMode: 'MANUAL' }
    },
  })

  component.mount()
  assert.deepEqual(notificationCalls, ['A'])
  assert.deepEqual(leaderboardCalls, ['A:room-A'])
  notificationAFirst.resolve({ data: [{ id: 'notice-A' }] })
  leaderboardA.resolve({ data: { entries: [leaderboardEntry('Learner A')] } })
  await flushPromises()
  assert.equal(component.state.notificationCount.value, 1)
  assert.equal(component.state.leaderboard.value.entries[0].displayName, 'Learner A')

  await component.state.reportUser({ isSelf: false, targetSeatIndex: 3 })
  assert.equal(component.state.lastReport.value.status, 'RECEIVED')
  const delayedNotifications = component.state.loadNotificationCount()
  const delayedLeaderboard = component.state.loadLeaderboard('room-A-late')
  assert.deepEqual(leaderboardCalls, ['A:room-A', 'A:room-A-late'])
  assert.deepEqual(reportCalls, ['A:room-A:3'])

  session.accessToken = null
  session.userId = null
  session.principal = null
  session.permissions = []
  session.status = 'unauthenticated'
  session.authGeneration += 1
  b4.rooms = []
  assert.equal(component.state.notificationCount.value, 0, 'logout synchronously clears the private notification count')
  assert.equal(component.state.leaderboard.value, null, 'logout synchronously clears the leaderboard projection')
  assert.equal(component.state.lastReport.value, null, 'logout synchronously clears the report receipt')

  session.accessToken = 'token-B'
  session.userId = 'B'
  session.principal = { subject: 'B' }
  session.permissions = ['social.leaderboard.read', 'social.report.create.self', 'notification.message.read.self']
  session.status = 'authenticated'
  b4.rooms = [room('room-B')]
  await flushPromises()
  assert.deepEqual(notificationCalls, ['A', 'A'], 'a newly staged B token is not read before the auth snapshot is confirmed')
  assert.ok(!leaderboardCalls.includes('B:room-B'), 'staged B token cannot start protected reads')

  component.publishConfirmedSnapshot()
  session.status = 'refreshing'
  session.status = 'authenticated'
  await flushPromises()
  assert.deepEqual(notificationCalls, ['A', 'A', 'B'])
  assert.ok(leaderboardCalls.includes('B:room-B'), 'the new owner loads the new owner room')
  assert.equal(component.state.notificationCount.value, 0, 'B sees no A count while B data is loading')
  assert.equal(component.state.leaderboard.value, null, 'B sees no A leaderboard while B data is loading')

  notificationsB.resolve({ data: [{ id: 'notice-B' }, { id: 'notice-B-2' }] })
  leaderboardB.resolve({ data: { entries: [leaderboardEntry('Learner B')] } })
  await flushPromises()
  notificationALate.resolve({ data: [{ id: 'late-notice-A' }, { id: 'late-notice-A-2' }] })
  leaderboardLateA.resolve({ data: { entries: [leaderboardEntry('Late learner A')] } })
  await Promise.all([delayedNotifications, delayedLeaderboard])
  await flushPromises()

  assert.equal(component.state.notificationCount.value, 2, 'late A inbox response cannot replace B count')
  assert.equal(component.state.leaderboard.value.entries[0].displayName, 'Learner B', 'late A leaderboard cannot replace B projection')
  assert.equal(component.state.lastReport.value, null, 'late A report receipt cannot reappear in B session')
  component.unmount()
})

test('B12 social card ignores a report receipt returned after its reporting owner changes', async () => {
  const session = authenticatedSession('A')
  const b4 = vue.reactive({ rooms: [room('room-A')], online: true })
  const reportA = deferred()
  const notificationsB = deferred()
  const leaderboardB = deferred()
  const component = mountSocialExtensions(session, b4, {
    listB12Notifications: async () => session.principal?.subject === 'A' ? { data: [] } : notificationsB.promise,
    getB12SocialLeaderboard: async roomId => session.principal?.subject === 'A'
      ? { data: { entries: [leaderboardEntry('Learner A')] } }
      : leaderboardB.promise,
    createB12SocialReport: async () => reportA.promise,
  })
  component.mount()
  await flushPromises()
  const delayedReport = component.state.reportUser({ isSelf: false, targetSeatIndex: 3 })

  session.accessToken = null
  session.userId = null
  session.principal = null
  session.permissions = []
  session.status = 'unauthenticated'
  session.authGeneration += 1
  b4.rooms = []
  assert.equal(component.state.lastReport.value, null)

  session.accessToken = 'token-B'
  session.userId = 'B'
  session.principal = { subject: 'B' }
  session.permissions = ['social.leaderboard.read', 'social.report.create.self', 'notification.message.read.self']
  session.status = 'authenticated'
  b4.rooms = [room('room-B')]
  await flushPromises()
  assert.equal(component.state.leaderboard.value, null, 'an unconfirmed B auth snapshot cannot start or populate reads')
  component.publishConfirmedSnapshot()
  session.status = 'refreshing'
  session.status = 'authenticated'
  await flushPromises()
  notificationsB.resolve({ data: [] })
  leaderboardB.resolve({ data: { entries: [leaderboardEntry('Learner B')] } })
  await flushPromises()

  reportA.resolve({ status: 'RECEIVED', reviewMode: 'MANUAL' })
  await delayedReport
  assert.equal(component.state.lastReport.value, null, 'a late A report receipt never appears in B session')
  assert.equal(component.state.leaderboard.value.entries[0].displayName, 'Learner B')
  component.unmount()
})

test('B12 social card clears scoped data and blocks protected calls when permissions are revoked', async () => {
  const session = authenticatedSession('A')
  const b4 = vue.reactive({ rooms: [room('room-A')], online: true })
  let notificationReads = 0
  let leaderboardReads = 0
  let reportWrites = 0
  const component = mountSocialExtensions(session, b4, {
    listB12Notifications: async () => { notificationReads += 1; return { data: [{ id: 'notice-A' }] } },
    getB12SocialLeaderboard: async () => { leaderboardReads += 1; return { data: { entries: [leaderboardEntry('Learner A')] } } },
    createB12SocialReport: async () => { reportWrites += 1; return { status: 'RECEIVED', reviewMode: 'MANUAL' } },
  })
  component.mount()
  await flushPromises()
  assert.equal(component.state.notificationCount.value, 1)
  assert.equal(component.state.leaderboard.value.entries.length, 1)
  await component.state.reportUser({ isSelf: false, targetSeatIndex: 3 })
  assert.equal(component.state.lastReport.value.status, 'RECEIVED')

  session.permissions = []
  assert.equal(component.state.notificationCount.value, 0, 'revoking read permissions immediately clears both private projections')
  assert.equal(component.state.leaderboard.value, null)
  assert.equal(component.state.lastReport.value, null, 'permission snapshot changes clear the last report receipt')
  await component.state.loadNotificationCount()
  await component.state.loadLeaderboard('room-A')
  await component.state.reportUser({ isSelf: false, targetSeatIndex: 3 })
  assert.equal(notificationReads, 1, 'no notification request starts without its self-read permission')
  assert.equal(leaderboardReads, 1, 'no leaderboard request starts without its read permission')
  assert.equal(reportWrites, 1, 'no report is submitted without its create permission')

  session.permissions = ['social.leaderboard.read', 'social.report.create.self', 'notification.message.read.self']
  await flushPromises()
  assert.equal(notificationReads, 2, 'restored permissions reload the current owner inbox')
  assert.ok(leaderboardReads >= 2, 'restored permissions reload the current owner leaderboard')
  assert.equal(component.state.notificationCount.value, 1)
  assert.equal(component.state.leaderboard.value.entries[0].displayName, 'Learner A')
  component.unmount()
})
