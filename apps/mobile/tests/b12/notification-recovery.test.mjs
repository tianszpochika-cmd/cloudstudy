import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const categories = ['ACCOUNT', 'LEARNING', 'REVIEW', 'ACHIEVEMENT', 'SYSTEM', 'SECURITY', 'BILLING', 'CONTENT', 'STUDY_ROOM', 'SOCIAL', 'SUPPORT', 'MARKETING', 'REMINDER', 'OTHER']

function loadSetupScript(relativePath, modules, exposedNames = []) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, `Missing script setup in ${relativePath}`)
  const exposure = exposedNames.length ? `\nmodule.exports.__fixture = { ${exposedNames.join(', ')} }\n` : ''
  const compiled = ts.transpileModule(`${script}${exposure}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports.__fixture
}

function loadTypeScriptModule(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function preference(category, version = 1, enabled = false, dndWindow = { startLocalTime: '00:00', endLocalTime: '00:00' }) {
  return {
    category, channel: 'IN_APP', enabled, locale: 'zh-CN', consentVersion: 1,
    dndWindow: { ...dndWindow }, frequencyPolicy: enabled ? 'IMMEDIATE' : 'DISABLED', version,
    updatedAt: '2026-09-25T08:00:00Z',
  }
}

function makePreferenceHelpers() {
  return {
    NOTIFICATION_CATEGORIES: categories.map(category => ({ category, label: category })),
    DEFAULT_NOTIFICATION_DND_WINDOW: { startLocalTime: '22:00', endLocalTime: '07:00' },
    NOTIFICATION_DND_OFF: { startLocalTime: '00:00', endLocalTime: '00:00' },
    isNotificationDndEnabled: window => window.startLocalTime !== window.endLocalTime,
    makeNotificationPreferenceCommand(category, enabled, current, dndWindow, frequencyPolicy) {
      return {
        category, enabled, locale: current?.locale ?? 'zh-CN', consentVersion: current?.consentVersion ?? 1,
        dndWindow: { startLocalTime: dndWindow?.startLocalTime ?? '00:00', endLocalTime: dndWindow?.endLocalTime ?? '00:00' },
        frequencyPolicy: frequencyPolicy ?? (enabled ? current?.frequencyPolicy ?? 'IMMEDIATE' : 'DISABLED'),
        expectedVersion: current?.version ?? 0,
      }
    },
    notificationPreferenceMatchesCommand(preference, command) {
      return Boolean(preference
        && preference.category === command.category
        && preference.enabled === command.enabled
        && preference.locale === command.locale
        && preference.consentVersion === command.consentVersion
        && preference.frequencyPolicy === command.frequencyPolicy
        && preference.dndWindow.startLocalTime === command.dndWindow.startLocalTime
        && preference.dndWindow.endLocalTime === command.dndWindow.endLocalTime)
    },
  }
}

function makeSettingsHarness(api) {
  const session = {
    verifiedSubject: 'learner-a', identityRevision: 4,
    getMobileApiIdentity() { return this.verifiedSubject ? { subject: this.verifiedSubject, revision: this.identityRevision } : null },
  }
  const store = {
    accountStatus: 'ready', lastError: null,
    account: { themeMode: 'SYSTEM', motionMode: 'FULL', highContrast: false, contentLocale: 'en-US', goal: null, quota: 10 },
    goals: [], async loadAccount() {}, async savePreferences() {}, async saveContentLocale() { return 'en-US' },
  }
  const modules = {
    '../../components/MobilePageHeader.vue': {},
    '../../platform/v2-foundation': { mobileThemeController: { theme: 'light', setTheme() {} } },
    '../../platform/b10-foundation': { b10ContentLocale: { value: 'en-US' }, b10UiLocale: { value: 'zh-CN' } },
    '../../platform/experience': {
      mobileExperienceEngine: { state: { level: 'High' }, subscribe() { return () => {} } },
      mobileMotionMode: { value: 'FULL' }, restoreMobileQualityDefault() {}, setMobileMotion() {}, setMobileQuality() {},
      useMobileExperience() { return { experienceStyle: {}, experienceMotion: 'FULL' } },
    },
    vue: { ref: value => ({ value }), watch() {}, onBeforeUnmount() {} },
    '@dcloudio/uni-app': { onHide() {}, onShow() {} },
    '../../auth/navigation': { ensureMobilePageAccess: async () => true },
    '../../domain/it7-closure': { privacyNotices: () => [] },
    '../../api/support': { readMobileClosureBoard: async () => null },
    '../../api/learning-consent-withdrawal': { withdrawLearningConsent: async () => ({ withdrawn: false, targetsStatus: null, notice: '', version: 'b30-consent-v1' }) },
    '../../domain/learning-consent-withdrawal': {
      WITHDRAW_BUTTON_LABEL: '撤回学习同意',
      WITHDRAW_CONFIRM_COPY: '确认撤回后，学习能力会收回。账号仍会保留。',
    },
    '@englishflow/contracts': {},
    '@englishflow/performance': {},
    '../../stores/learner-content': { useLearnerContentStore: () => store },
    '../../stores/session': { useSessionStore: () => session },
    '../../api/b12': api,
    '../../domain/notification-preferences': makePreferenceHelpers(),
    '../../platform/uni-runtime': { getUniRuntime: () => null },
    '../../domain/mobile-preference-sync': {
      hasPendingMobilePreferenceSync: () => false,
      sameMobilePreferenceIdentity: (expected, current) => Boolean(expected && current && expected.subject === current.subject && expected.revision === current.revision),
      setPendingMobilePreferenceSync() {},
      transitionMobilePreferenceSubject: (_previous, next) => ({ subject: next ?? null, pendingSync: false }),
    },
  }
  const view = loadSetupScript('src/pages/settings/settings.vue', modules, [
    'notificationSettings', 'notificationRows', 'notificationStatus', 'notificationError', 'notificationDndEnabled',
    'notificationDndStart', 'notificationDndEnd', 'notificationDndDirty', 'notificationDndRetryPending',
    'notificationDndConflict', 'notificationDndRetryTarget', 'notificationSuccess',
    'loadNotificationSettings', 'toggleNotification', 'saveNotificationDnd',
  ])
  return { view, session }
}

test('failed category write reloads the owner version and keeps the failure visible for retry', async () => {
  const rows = categories.map((category, index) => preference(category, index + 1))
  const commands = []
  let reads = 0
  let attempts = 0
  const api = {
    async listB12NotificationPreferences() { reads += 1; return rows.map(row => ({ ...row, dndWindow: { ...row.dndWindow } })) },
    async updateB12NotificationPreference(category, _channel, command) {
      attempts += 1
      if (attempts === 1) {
        rows.find(row => row.category === category).version += 1
        throw new Error('409 version conflict')
      }
      commands.push(command)
      const row = rows.find(item => item.category === category)
      Object.assign(row, { enabled: command.enabled, frequencyPolicy: command.frequencyPolicy, version: row.version + 1 })
      return row
    },
  }
  const { view } = makeSettingsHarness(api)
  await view.loadNotificationSettings()
  await view.toggleNotification(view.notificationSettings.value.find(row => row.category === 'ACCOUNT'))

  assert.equal(reads, 2)
  assert.equal(view.notificationRows.value.find(row => row.category === 'ACCOUNT').version, 2)
  assert.match(view.notificationError.value, /保存失败/)
  assert.match(view.notificationError.value, /最新设置/)

  await view.toggleNotification(view.notificationSettings.value.find(row => row.category === 'ACCOUNT'))
  assert.equal(commands[0].expectedVersion, 2)
  assert.equal(view.notificationRows.value.find(row => row.category === 'ACCOUNT').enabled, true)
})

test('category write reconciles a lost response against the refreshed owner state', async () => {
  const rows = categories.map((category, index) => preference(category, index + 1))
  let reads = 0
  let writes = 0
  let submitted
  const api = {
    async listB12NotificationPreferences() { reads += 1; return rows.map(row => ({ ...row, dndWindow: { ...row.dndWindow } })) },
    async updateB12NotificationPreference(category, _channel, command) {
      writes += 1
      submitted = command
      const row = rows.find(item => item.category === category)
      Object.assign(row, {
        enabled: command.enabled,
        locale: command.locale,
        consentVersion: command.consentVersion,
        dndWindow: { ...command.dndWindow },
        frequencyPolicy: command.frequencyPolicy,
        version: row.version + 1,
      })
      throw new Error('response lost after the owner committed')
    },
  }
  const { view } = makeSettingsHarness(api)
  await view.loadNotificationSettings()
  await view.toggleNotification(view.notificationSettings.value.find(row => row.category === 'ACCOUNT'))

  assert.equal(reads, 2)
  assert.equal(writes, 1)
  assert.equal(submitted.expectedVersion, 1)
  assert.equal(view.notificationStatus.value, 'ready')
  assert.equal(view.notificationRows.value.find(row => row.category === 'ACCOUNT').enabled, true)
  assert.equal(view.notificationError.value, '')
  assert.equal(view.notificationSuccess.value, '设置已保存。')
})

test('partial DND success keeps one retry target and retries using freshly loaded versions', async () => {
  const rows = categories.map((category, index) => preference(category, index + 1))
  const attempts = new Map()
  const commands = []
  let reads = 0
  const api = {
    async listB12NotificationPreferences() { reads += 1; return rows.map(row => ({ ...row, dndWindow: { ...row.dndWindow } })) },
    async updateB12NotificationPreference(category, _channel, command) {
      const count = (attempts.get(category) ?? 0) + 1
      attempts.set(category, count)
      commands.push({ category, command: { ...command } })
      if (category === 'SYSTEM' && count === 1) throw new Error('temporary owner failure')
      const row = rows.find(item => item.category === category)
      Object.assign(row, { enabled: command.enabled, dndWindow: { ...command.dndWindow }, frequencyPolicy: command.frequencyPolicy, version: row.version + 1 })
      return row
    },
  }
  const { view } = makeSettingsHarness(api)
  await view.loadNotificationSettings()
  await view.saveNotificationDnd(true)

  assert.equal(reads, 2)
  assert.equal(view.notificationStatus.value, 'ready')
  assert.equal(view.notificationDndDirty.value, true)
  assert.equal(view.notificationDndRetryPending.value, true)
  assert.equal(view.notificationDndConflict.value, true)
  assert.deepEqual(view.notificationDndRetryTarget.value, { enabled: true, startLocalTime: '22:00', endLocalTime: '07:00' })
  const template = fs.readFileSync(path.join(appRoot, 'src/pages/settings/settings.vue'), 'utf8')
  assert.match(template, /v-if="notificationDndDirty \|\| notificationDndRetryPending"[^>]*@click="saveNotificationDnd\(notificationDndRetryPending \? notificationDndEnabled : true\)"/)
  assert.equal(view.notificationDndEnabled.value, true)
  assert.match(view.notificationError.value, /13 项已保存，1 项未保存/)
  assert.match(view.notificationError.value, /重试统一时段/)

  const refreshedSystemVersion = view.notificationRows.value.find(row => row.category === 'SYSTEM').version
  await view.saveNotificationDnd(view.notificationDndEnabled.value)
  const retrySystemCommand = commands.filter(item => item.category === 'SYSTEM').at(-1).command
  assert.equal(retrySystemCommand.expectedVersion, refreshedSystemVersion)
  assert.equal(view.notificationDndDirty.value, false)
  assert.equal(view.notificationDndRetryPending.value, false)
  assert.equal(view.notificationError.value, '')
  assert.ok(rows.every(row => row.dndWindow.startLocalTime === '22:00' && row.dndWindow.endLocalTime === '07:00'))
})

function deferred() {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}

function reportReceipt(roomId = 'room-a', targetSeatIndex = 8, overrides = {}) {
  return {
    reportId: 'rpt_mobile-test-0001', roomId, targetSeatIndex, reasonCode: 'SPAM', status: 'RECEIVED', reviewMode: 'MANUAL',
    createdAt: '2026-09-25T08:00:00Z', updatedAt: '2026-09-25T08:00:00Z', clientEventId: 'evt_mobile-test-0001',
    ...overrides,
  }
}

function makeSocialHarness(api, sessionState = null, rooms = [{ roomId: 'room-a', name: 'Room A' }]) {
  const watchers = []
  const session = sessionState ?? {
    verifiedSubject: 'learner-a', identityRevision: 1, status: 'authenticated', accessToken: 'token-a',
    permissions: ['social.leaderboard.read', 'social.report.create.self', 'notification.message.read.self'],
    get isAuthenticated() { return this.status === 'authenticated' && Boolean(this.accessToken && this.verifiedSubject) },
    getMobileApiIdentity() { return this.verifiedSubject ? { subject: this.verifiedSubject, revision: this.identityRevision } : null },
  }
  const b4 = { rooms, online: true }
  const readSource = source => Array.isArray(source) ? source.map(readSource) : typeof source === 'function' ? source() : source && typeof source === 'object' && 'value' in source ? source.value : source
  const sameWatchValue = (left, right) => Array.isArray(left) && Array.isArray(right)
    ? left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
    : Object.is(left, right)
  const modules = {
    vue: {
      ref: value => ({ value }),
      computed: getter => ({ get value() { return getter() } }),
      nextTick: callback => Promise.resolve().then(callback),
      onBeforeUnmount() {},
      watch(source, callback, options = {}) {
        const current = readSource(source)
        const watcher = { source, callback, previous: current }
        watchers.push(watcher)
        if (options.immediate) callback(current, undefined)
      },
    },
    '../../api/client': { MobileApiError: class MobileApiError extends Error { constructor(status, message) { super(message); this.status = status } } },
    '../../stores/b4': { useB4Store: () => b4 },
    '../../api/b12': { ...api, B12_REPORT_REASONS: ['SPAM', 'HARASSMENT', 'SENSITIVE_CONTENT', 'IMPERSONATION', 'OTHER'] },
    '../../platform/b12-i18n': { b12T: key => key === 'social.reportUncertain' ? '举报结果暂无法确认，请稍后重试原举报。' : key },
    '../../platform/uni-runtime': { openUniPage() {} },
    '../../stores/session': { useSessionStore: () => session },
  }
  const view = loadSetupScript('src/components/b12/B12SocialExtensions.vue', modules, [
    'notificationCount', 'leaderboard', 'lastReport', 'actionKey', 'reportPendingKey', 'lastError', 'status', 'uncertainReportRetry', 'loadLeaderboard', 'loadNotificationCount', 'report', 'selectRoom', 'selectReason', 'selectedRoomId',
  ])
  function notifyWatchers() {
    for (const watcher of watchers) {
      const previous = watcher.previous
      const current = readSource(watcher.source)
      if (sameWatchValue(current, previous)) continue
      watcher.previous = current
      watcher.callback(current, previous)
    }
  }
  function setIdentity(subject) {
    session.verifiedSubject = subject
    session.identityRevision += 1
    session.status = subject ? 'authenticated' : 'unauthenticated'
    session.accessToken = subject ? `token-${subject}` : null
    notifyWatchers()
  }
  function setPermissions(permissions) { session.permissions = permissions; notifyWatchers() }
  function setSessionStatus(status) { session.status = status; notifyWatchers() }
  function rotateAccessToken(accessToken) { session.accessToken = accessToken; notifyWatchers() }
  return { view, session, b4, setIdentity, setPermissions, setSessionStatus, rotateAccessToken }
}

test('notification count clears and reloads on account change; late old-account results are ignored', async () => {
  const delayedA = deferred()
  const requestedSubjects = []
  const session = {
    verifiedSubject: 'learner-a', identityRevision: 1, status: 'authenticated', accessToken: 'token-a',
    permissions: ['social.leaderboard.read', 'social.report.create.self', 'notification.message.read.self'],
    get isAuthenticated() { return this.status === 'authenticated' && Boolean(this.accessToken && this.verifiedSubject) },
    getMobileApiIdentity() { return this.verifiedSubject ? { subject: this.verifiedSubject, revision: this.identityRevision } : null },
  }
  const api = {
    listB12Notifications() {
      requestedSubjects.push(session.verifiedSubject)
      if (session.verifiedSubject === 'learner-a') return delayedA.promise
      return Promise.resolve([{ id: 'b-1' }, { id: 'b-2' }])
    },
    getB12SocialLeaderboard: async () => ({ entries: [] }),
    createB12SocialReport: async () => ({}),
  }
  const harness = makeSocialHarness(api, session)
  assert.equal(harness.view.notificationCount.value, null)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requestedSubjects, ['learner-a'])
  harness.setIdentity('learner-b')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requestedSubjects, ['learner-a', 'learner-b'])
  assert.equal(harness.view.notificationCount.value, 2)

  delayedA.resolve([{ id: 'a-1' }])
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.view.notificationCount.value, 2)

  harness.setIdentity(null)
  assert.equal(harness.view.notificationCount.value, null)
})

test('B12 clears every personal readout on account switch and ignores late notification and leaderboard reads', async () => {
  const delayedAcount = deferred()
  const delayedAboard = deferred()
  let session
  let delayA = false
  const api = {
    listB12Notifications() {
      if (session.verifiedSubject === 'learner-a' && delayA) return delayedAcount.promise
      return Promise.resolve({ data: [{ id: `${session.verifiedSubject}-1` }, { id: `${session.verifiedSubject}-2` }] })
    },
    getB12SocialLeaderboard() {
      if (session.verifiedSubject === 'learner-a' && delayA) return delayedAboard.promise
      return Promise.resolve({ data: { entries: [{ rank: 1, displayName: `${session.verifiedSubject} member`, qualifiedUnits: 3, isSelf: true }] } })
    },
    createB12SocialReport: async (roomId, targetSeatIndex, reasonCode, clientEventId) => reportReceipt(roomId, targetSeatIndex, { reasonCode, clientEventId }),
  }
  const harness = makeSocialHarness(api)
  session = harness.session
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.view.notificationCount.value, 2)
  assert.equal(harness.view.leaderboard.value.entries[0].displayName, 'learner-a member')
  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(harness.view.lastReport.value.status, 'RECEIVED')

  delayA = true
  const oldNotificationRead = harness.view.loadNotificationCount()
  const oldLeaderboardRead = harness.view.loadLeaderboard('room-a')
  harness.setIdentity('learner-b')
  assert.equal(harness.view.notificationCount.value, null)
  assert.equal(harness.view.leaderboard.value, null)
  assert.equal(harness.view.lastReport.value, null)
  assert.equal(harness.view.actionKey.value, null)

  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.view.notificationCount.value, 2)
  assert.equal(harness.view.leaderboard.value.entries[0].displayName, 'learner-b member')
  delayedAcount.resolve({ data: [{ id: 'learner-a-late' }] })
  delayedAboard.resolve({ data: { entries: [{ rank: 1, displayName: 'learner-a late', qualifiedUnits: 9, isSelf: true }] } })
  await Promise.all([oldNotificationRead, oldLeaderboardRead])
  assert.equal(harness.view.notificationCount.value, 2)
  assert.equal(harness.view.leaderboard.value.entries[0].displayName, 'learner-b member')

  harness.setIdentity(null)
  assert.equal(harness.view.notificationCount.value, null)
  assert.equal(harness.view.leaderboard.value, null)
  assert.equal(harness.view.lastReport.value, null)
})

test('permission revocation clears personal state and rejects a pending report receipt', async () => {
  const delayedReport = deferred()
  let reportCalls = 0
  const api = {
    listB12Notifications: async () => ({ data: [{ id: 'message-1' }] }),
    getB12SocialLeaderboard: async () => ({ data: { entries: [{ rank: 1, displayName: 'member', qualifiedUnits: 2, isSelf: false, targetSeatIndex: 8 }] } }),
    createB12SocialReport: () => { reportCalls += 1; return delayedReport.promise },
  }
  const harness = makeSocialHarness(api)
  await new Promise(resolve => setImmediate(resolve))
  const pendingReport = harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(reportCalls, 1)
  harness.setPermissions(['social.leaderboard.read', 'notification.message.read.self'])
  assert.equal(harness.view.lastReport.value, null)
  assert.equal(harness.view.leaderboard.value, null)
  assert.equal(harness.view.notificationCount.value, null)
  delayedReport.resolve(reportReceipt())
  await pendingReport
  assert.equal(harness.view.lastReport.value, null)
  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(reportCalls, 1)
})

test('switching rooms starts the selected leaderboard while the previous room is still loading', async () => {
  const delayedRoomA = deferred()
  const requestedRooms = []
  const api = {
    listB12Notifications: async () => [],
    getB12SocialLeaderboard(roomId) {
      requestedRooms.push(roomId)
      if (roomId === 'room-a') return delayedRoomA.promise
      return Promise.resolve({ data: { entries: [{ rank: 1, displayName: 'Room B member', qualifiedUnits: 4, isSelf: true }] } })
    },
    createB12SocialReport: async (roomId, targetSeatIndex, reasonCode, clientEventId) => reportReceipt(roomId, targetSeatIndex, { reasonCode, clientEventId }),
  }
  const harness = makeSocialHarness(api, null, [
    { roomId: 'room-a', name: 'Room A' },
    { roomId: 'room-b', name: 'Room B' },
  ])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requestedRooms, ['room-a'])
  harness.view.selectRoom({ detail: { value: 1 } })
  assert.equal(harness.view.actionKey.value, 'leaderboard.room-b')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requestedRooms, ['room-a', 'room-b'])
  assert.equal(harness.view.leaderboard.value.entries[0].displayName, 'Room B member')

  delayedRoomA.resolve({ data: { entries: [{ rank: 1, displayName: 'Stale Room A member', qualifiedUnits: 9, isSelf: true }] } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.view.leaderboard.value.entries[0].displayName, 'Room B member')
  assert.equal(harness.view.actionKey.value, null)
})

test('room switch keeps one report command in flight and hides its old-room receipt', async () => {
  const delayedReport = deferred()
  let reportCalls = 0
  const api = {
    listB12Notifications: async () => [],
    getB12SocialLeaderboard: async roomId => ({ data: { entries: [{ rank: 1, displayName: `${roomId} member`, qualifiedUnits: 2, isSelf: false, targetSeatIndex: roomId === 'room-a' ? 8 : 9 }] } }),
    createB12SocialReport(roomId, targetSeatIndex, _reasonCode, clientEventId) {
      reportCalls += 1
      return reportCalls === 1 ? delayedReport.promise : Promise.resolve(reportReceipt(roomId, targetSeatIndex, { clientEventId }))
    },
  }
  const harness = makeSocialHarness(api, null, [
    { roomId: 'room-a', name: 'Room A' },
    { roomId: 'room-b', name: 'Room B' },
  ])
  await new Promise(resolve => setImmediate(resolve))
  const pendingAReport = harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(reportCalls, 1)
  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(reportCalls, 1)

  harness.view.selectRoom({ detail: { value: 1 } })
  assert.equal(harness.view.lastReport.value, null)
  assert.equal(harness.view.reportPendingKey.value, 'report.room-a.8')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.view.leaderboard.value.entries[0].displayName, 'room-b member')
  await harness.view.report({ targetSeatIndex: 9, isSelf: false })
  assert.equal(reportCalls, 1)

  delayedReport.resolve(reportReceipt('room-a', 8))
  await pendingAReport
  assert.equal(harness.view.lastReport.value, null)
  assert.equal(harness.view.reportPendingKey.value, null)

  await harness.view.report({ targetSeatIndex: 9, isSelf: false })
  assert.equal(reportCalls, 2)
  assert.deepEqual(harness.view.lastReport.value, { reportId: 'rpt_mobile-test-0001', roomId: 'room-b', targetSeatIndex: 9, status: 'RECEIVED', reviewMode: 'MANUAL' })
})

test('changing report reason clears its retry key and ignores the old in-flight result', async () => {
  const delayedReport = deferred()
  const harness = makeSocialHarness({
    listB12Notifications: async () => [],
    getB12SocialLeaderboard: async () => ({ data: { entries: [] } }),
    createB12SocialReport: () => delayedReport.promise,
  })
  await new Promise(resolve => setImmediate(resolve))
  const pendingReport = harness.view.report({ targetSeatIndex: 8, isSelf: false })
  const originalClientEventId = harness.view.uncertainReportRetry.value.clientEventId

  harness.view.selectReason({ detail: { value: 1 } })
  assert.equal(harness.view.uncertainReportRetry.value, null)
  delayedReport.resolve({})
  await pendingReport

  assert.equal(harness.view.uncertainReportRetry.value, null)
  assert.equal(harness.view.lastReport.value, null)
  assert.notEqual(originalClientEventId, '')
})

for (const scenario of [
  { name: 'empty body', response: {} },
  { name: 'mismatched room', response: reportReceipt('room-other') },
  { name: 'mismatched target seat', response: reportReceipt('room-a', 9) },
  { name: 'mismatched reason despite replay marker', response: reportReceipt('room-a', 8, { reasonCode: 'HARASSMENT', idempotentReplay: true }) },
  { name: 'mismatched client event without replay marker', response: reportReceipt('room-a', 8, { clientEventId: 'evt_mobile-old' }) },
  { name: 'unknown status', response: reportReceipt('room-a', 8, { status: 'SUCCESS' }) },
  { name: 'non-manual review mode', response: reportReceipt('room-a', 8, { reviewMode: 'AUTOMATED' }) },
]) {
  test(`malformed report receipt (${scenario.name}) never fabricates a successful result`, async () => {
    const harness = makeSocialHarness({
      listB12Notifications: async () => [],
      getB12SocialLeaderboard: async () => ({ data: { entries: [] } }),
      createB12SocialReport: async () => scenario.response,
    })
    await new Promise(resolve => setImmediate(resolve))
    await harness.view.report({ targetSeatIndex: 8, isSelf: false })
    assert.equal(harness.view.lastReport.value, null)
    assert.equal(harness.view.status.value, 'recovery')
    assert.match(harness.view.lastError.value, /举报结果暂无法确认/)
  })
}

test('notification badge labels the count as loaded, with Chinese and English text', () => {
  const component = fs.readFileSync(path.join(appRoot, 'src/components/b12/B12SocialExtensions.vue'), 'utf8')
  const translations = fs.readFileSync(path.join(appRoot, 'src/platform/b12-i18n.ts'), 'utf8')
  assert.match(component, /notifications\.loadedCount/)
  assert.match(component, /notificationCount === null \? b12T\('notifications\.notLoaded'\)/)
  assert.match(component, /b12T\('social\.kicker'\)/)
  assert.match(component, /b12T\('notifications\.kicker'\)/)
  assert.doesNotMatch(component, />LEADERBOARD · REPORT<|>NOTIFICATION CENTER<|notifications\.loadedCount', \{ count: 0 \}/)
  assert.match(component, /lastReport && lastReport\.roomId === selectedRoomId/)
  assert.match(translations, /loadedCount: '已读取 \{\{count\}\} 条'/)
  assert.match(translations, /loadedCount: '\{\{count\}\} loaded'/)
  assert.match(translations, /notLoaded: '尚未读取'/)
  assert.match(translations, /notLoaded: 'Not loaded'/)
  assert.match(translations, /kicker: '排行榜 · 举报'/)
  assert.match(translations, /kicker: 'LEADERBOARD · REPORT'/)
  assert.match(translations, /kicker: '通知中心'/)
  assert.match(translations, /kicker: 'NOTIFICATION CENTER'/)
  assert.match(translations, /anonymousMember: '匿名学员'/)
  assert.match(translations, /anonymousMember: 'Anonymous learner'/)
  assert.match(translations, /hint: '站内通知和免打扰时段可在设置中调整。'/)
  assert.match(translations, /hint: 'Manage in-app notifications and quiet hours in Settings.'/)
  assert.match(translations, /reportUncertain: '举报结果暂无法确认，请稍后重试原举报。'/)
  assert.match(translations, /reportUncertain: 'Report outcome is unconfirmed; retry the original report later.'/)
  assert.doesNotMatch(component, /'匿名学员'|'暂无可查看的房间榜单。'|>去登录<|在设置中管理站内通知和免打扰时段。|>管理通知偏好/)
})

test('notification badge does not present an unread or failed read as zero messages', async () => {
  let readCalls = 0
  const withoutPermission = makeSocialHarness({
    listB12Notifications: async () => { readCalls += 1; return [] },
    getB12SocialLeaderboard: async () => ({ entries: [] }),
    createB12SocialReport: async () => ({}),
  }, {
    verifiedSubject: 'learner-a', identityRevision: 1, status: 'authenticated', accessToken: 'token-a',
    permissions: ['social.leaderboard.read'],
    get isAuthenticated() { return this.status === 'authenticated' && Boolean(this.accessToken && this.verifiedSubject) },
    getMobileApiIdentity() { return this.verifiedSubject ? { subject: this.verifiedSubject, revision: this.identityRevision } : null },
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(readCalls, 0)
  assert.equal(withoutPermission.view.notificationCount.value, null)

  const failedRead = makeSocialHarness({
    listB12Notifications: async () => { throw new Error('service unavailable') },
    getB12SocialLeaderboard: async () => ({ entries: [] }),
    createB12SocialReport: async () => ({}),
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(failedRead.view.notificationCount.value, null)
})

test('uncertain social report retry reuses the same idempotency key and request body until its scope changes', async () => {
  const requests = []
  const api = loadTypeScriptModule('src/api/b12.ts', {
    './client': { mobileApiClient: { async request(path, options) { requests.push({ path, options }); return {} } } },
    '../domain/notification-preferences': { readAllNotificationPreferencePages: async () => [] },
  })
  const harness = makeSocialHarness({
    listB12Notifications: async () => [],
    getB12SocialLeaderboard: async () => ({ data: { entries: [] } }),
    createB12SocialReport: api.createB12SocialReport,
  })
  await new Promise(resolve => setImmediate(resolve))

  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(harness.view.status.value, 'recovery')
  assert.equal(harness.view.lastError.value, '举报结果暂无法确认，请稍后重试原举报。')
  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.deepEqual(requests[1].options.data, requests[0].options.data)
  assert.equal(requests[1].options.header['Idempotency-Key'], requests[0].options.header['Idempotency-Key'])

  harness.view.selectReason({ detail: { value: 1 } })
  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(requests[2].options.data.reasonCode, 'HARASSMENT')
  assert.notEqual(requests[2].options.data.clientEventId, requests[1].options.data.clientEventId)

  await harness.view.report({ targetSeatIndex: 9, isSelf: false })
  assert.equal(requests[3].options.data.targetSeatIndex, 9)
  assert.notEqual(requests[3].options.data.clientEventId, requests[2].options.data.clientEventId)

  harness.setIdentity('learner-b')
  await new Promise(resolve => setImmediate(resolve))
  await harness.view.report({ targetSeatIndex: 9, isSelf: false })
  assert.notEqual(requests[4].options.data.clientEventId, requests[3].options.data.clientEventId)
  for (const { options } of requests) assert.equal(options.header['Idempotency-Key'], options.data.clientEventId)
})

test('an uncertain report keeps its key through verified access-token rotation and retries with that key', async () => {
  const submittedClientEventIds = []
  let attempt = 0
  const harness = makeSocialHarness({
    listB12Notifications: async () => [],
    getB12SocialLeaderboard: async () => ({ data: { entries: [] } }),
    async createB12SocialReport(roomId, targetSeatIndex, reasonCode, clientEventId) {
      submittedClientEventIds.push(clientEventId)
      attempt += 1
      if (attempt === 1) return {}
      return reportReceipt(roomId, targetSeatIndex, { reasonCode, clientEventId })
    },
  })
  await new Promise(resolve => setImmediate(resolve))

  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  const initialRetry = harness.view.uncertainReportRetry.value
  assert.ok(initialRetry)
  const pendingClientEventId = initialRetry.clientEventId
  const initialVersion = initialRetry.viewVersion

  harness.setSessionStatus('refreshing')
  assert.equal(harness.view.leaderboard.value, null)
  assert.equal(harness.view.lastReport.value, null)
  assert.equal(harness.view.uncertainReportRetry.value.clientEventId, pendingClientEventId)
  const refreshedViewVersion = harness.view.uncertainReportRetry.value.viewVersion
  assert.ok(refreshedViewVersion > initialVersion)

  harness.rotateAccessToken('token-a-rotated')
  assert.equal(harness.view.uncertainReportRetry.value.clientEventId, pendingClientEventId)
  harness.setSessionStatus('authenticated')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.view.uncertainReportRetry.value.clientEventId, pendingClientEventId)

  const beforeDirectRotation = harness.view.uncertainReportRetry.value.viewVersion
  harness.rotateAccessToken('token-a-rotated-again')
  assert.equal(harness.view.uncertainReportRetry.value.clientEventId, pendingClientEventId)
  assert.ok(harness.view.uncertainReportRetry.value.viewVersion > beforeDirectRotation)
  await new Promise(resolve => setImmediate(resolve))

  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.deepEqual(submittedClientEventIds, [pendingClientEventId, pendingClientEventId])
  assert.equal(harness.view.lastReport.value.status, 'RECEIVED')
  assert.equal(harness.view.uncertainReportRetry.value, null)
})

test('a valid server-marked report replay may return its original client event id', async () => {
  let attempt = 0
  let retryClientEventId = ''
  const harness = makeSocialHarness({
    listB12Notifications: async () => [],
    getB12SocialLeaderboard: async () => ({ data: { entries: [] } }),
    async createB12SocialReport(roomId, targetSeatIndex, reasonCode, clientEventId) {
      attempt += 1
      if (attempt === 1) { retryClientEventId = clientEventId; return {} }
      return { data: {
        idempotentReplay: true,
        report: reportReceipt(roomId, targetSeatIndex, { reasonCode, clientEventId: 'evt_original-committed-report' }),
      } }
    },
  })
  await new Promise(resolve => setImmediate(resolve))

  await harness.view.report({ targetSeatIndex: 8, isSelf: false })
  assert.equal(harness.view.status.value, 'recovery')
  await harness.view.report({ targetSeatIndex: 8, isSelf: false })

  assert.ok(retryClientEventId)
  assert.notEqual(retryClientEventId, 'evt_original-committed-report')
  assert.deepEqual(harness.view.lastReport.value, {
    reportId: 'rpt_mobile-test-0001', roomId: 'room-a', targetSeatIndex: 8, status: 'RECEIVED', reviewMode: 'MANUAL',
  })
  assert.equal(harness.view.status.value, 'success')
  assert.equal(harness.view.uncertainReportRetry.value, null)
})
