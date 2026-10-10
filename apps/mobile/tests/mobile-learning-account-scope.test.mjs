import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { createPinia, setActivePinia } = require('pinia')
const appRoot = path.resolve(import.meta.dirname, '..')
const B10_KEY = 'yx.b10.mobile.learning.v1'
const CONTENT_KEY = 'yx.v2.learner-content.mobile.v1'
const B1_KEY = 'yx.b1.mobile.v1'
const B11_KEY = 'yx.b11.mobile.learning.v1'
const B11_OFFLINE_KEY = 'yx.b11.mobile.offline.v1'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function load(relativePath, modules, transform = (source) => source) {
  const source = transform(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'))
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function environment() {
  setActivePinia(createPinia())
  const storage = new Map()
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } }
  const runtime = {
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  }
  const platform = { getUniRuntime: () => runtime, isNativeAppRuntime: () => false }
  const cache = load('src/stores/learning-cache.ts', { '../platform/uni-runtime': platform })
  let token = null
  const sessionModule = load('src/stores/session.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../auth/access-token': { getInMemoryAccessToken: () => token, setInMemoryAccessToken: (value) => { token = value }, setInMemoryRequestIdentity: () => {} },
    '../auth/auth-failure-copy': { mobileAuthFailureMarker: () => 'failed' },
    '../auth/gateway-auth': { createGatewayMobileAuthAdapter: () => { throw new Error('Use a test auth adapter') }, safeMobileReturnTo: (value) => typeof value === 'string' ? value : '/pages/home/home' },
    '../platform/uni-runtime': platform,
    './learning-cache': cache,
  })
  const session = sessionModule.useSessionStore()
  let subject = null
  const auth = {
    login: async ({ identifier }) => { subject = identifier; return { accessToken: `token-${identifier}` } },
    register: async ({ identifier }) => { subject = identifier; return { accessToken: `token-${identifier}` } },
    getPermissions: async () => ({ principal: { subject, roles: [], permissions: [], adultGate: 'PASSED' }, adultGate: 'PASSED' }),
    refresh: async () => ({ accessToken: `token-${subject}` }),
    logout: async () => {}, revoke: async () => {},
  }
  session.setAuthAdapter(auth)
  const b10ContentLocale = { value: 'en-US' }
  const b11ContentLocale = { value: 'en-US' }
  const mobileI18n = {
    locale: 'zh-CN',
    contentLocale: 'en-US',
    setContentLocale(locale) {
      this.contentLocale = locale
      b10ContentLocale.value = locale
      b11ContentLocale.value = locale
    },
  }
  const persistedAccounts = new Map()
  const accountReads = []
  const learningLocales = []
  function accountFor(subject) {
    return persistedAccounts.get(subject) ?? { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: null, quota: null, stateVersion: 3 }
  }
  const b10Api = {
    createAssessmentSession: async () => { throw new Error('Unexpected practice creation') },
    readAssessmentSession: async () => { throw new Error('Unexpected practice read') },
    submitAssessmentAnswer: async () => { throw new Error('Unexpected answer submission') },
  }
  const b10Module = load('src/stores/b10-learning.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../api/b10': { b10LearningApi: b10Api, b10ErrorInfo: (error) => ({ kind: 'offline', message: error.message }), createB10ClientEventId: (prefix) => `${prefix}-fixture` },
    '../platform/b10-foundation': { b10UiLocale: { value: 'zh-CN' }, b10ContentLocale },
    '../platform/uni-runtime': platform,
    './session': sessionModule,
    './learning-cache': cache,
  })
  const contentApi = {
    readOnboarding: async () => { throw new Error('Unexpected onboarding read') },
    readAccount: async () => {
      const subject = session.verifiedSubject
      accountReads.push(subject)
      return { ...accountFor(subject) }
    },
    savePreferences: async (input, isCurrent) => {
      if (isCurrent && !isCurrent()) throw new Error('账号已变化')
      const subject = session.verifiedSubject
      const updated = { ...accountFor(subject), ...input, stateVersion: accountFor(subject).stateVersion + 1 }
      persistedAccounts.set(subject, updated)
      return { ...updated }
    },
    readHome: async (locale) => { learningLocales.push(locale); return { tasks: [], content: [], contentStatus: 'EMPTY', targetMinutes: 15, completedMinutes: 0 } },
    readFirstDay: async (locale) => { learningLocales.push(locale); return { state: 'READY', taskCount: 0 } },
    readPlacement: async (locale) => { learningLocales.push(locale); return { sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false } },
    completeTask: async () => { throw new Error('Unexpected task completion') },
  }
  const contentModule = load('src/stores/learner-content.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../api/learner-content': { mobileLearnerContentApi: contentApi, mobileLearnerContentError: (error) => ({ message: error.message }) },
    '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
    '../platform/uni-runtime': platform,
    '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture` },
    './session': sessionModule,
    './learning-cache': cache,
    '../platform/v2-foundation': { mobileI18n },
  }, (source) => source.replace("import.meta.env.VITE_RUNTIME_MODE", "'local-real'"))
  const b1Module = load('src/stores/b1.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../platform/uni-runtime': platform,
    '../domain/b1': { MOBILE_B1_KEY: B1_KEY, createMobileB1State: () => ({ onboardingDone: false, assessmentDone: false, goal: '', quota: 15, progress: 0, lessonTitle: 'fixture lesson' }) },
    './session': sessionModule, './learning-cache': cache,
  })
  const offlineModule = load('src/platform/b11-offline.ts', { './uni-runtime': platform })
  const b11Api = {
    loadB11ReadingWorkspace: async () => { throw new Error('Unexpected B11 reading request') },
    registerB11Recording: async () => { throw new Error('Unexpected B11 recording request') },
  }
  const strategy = { enableWaveform: true, fallbackMode: 'svg' }
  const b11Module = load('src/stores/b11-learning.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '@englishflow/performance': { createAdaptivePerformanceEngine: () => ({ level: 'High', state: { strategy }, subscribe: () => () => {}, setLevel: () => {}, observe: () => ({ level: 'High', strategy }), dispose: () => {} }) },
    '../platform/b11-foundation': { b11UiLocale: { value: 'zh-CN' }, b11ContentLocale },
    '../platform/uni-runtime': platform,
    '../platform/b11-offline': offlineModule,
    '../utils/b11-errors': { b11ErrorText: (error, fallback) => error instanceof Error ? error.message : fallback },
    '../api/b11': b11Api,
    '../domain/b11': { contentVersionOf: (value, fallback) => value ?? fallback, createB11ClientEventId: (prefix) => `${prefix}-fixture` },
    './session': sessionModule, './learning-cache': cache,
  })
  return { session, auth, storage, b10: b10Module.useB10LearningStore(), content: contentModule.useLearnerContentStore(), b1: b1Module.useB1Store(), b11: b11Module.useB11LearningStore(), b10Api, contentApi, b11Api, mobileI18n, persistedAccounts, accountReads, learningLocales }
}

function practice(sessionId) {
  return { sessionId, status: 'IN_PROGRESS', exercises: [{ exerciseId: 42 }], answerSheet: [], lastCheckpointSeq: 0, stateVersion: 1 }
}

test('A to B clears cached practice and onboarding, and drops late A owner responses', async () => {
  const { session, storage, b10, content, b10Api, contentApi } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  storage.set(B10_KEY, JSON.stringify({ subject: 'A', practice: practice('A-session'), answers: { 42: { selectedKey: 'A' } } }))
  storage.set(CONTENT_KEY, JSON.stringify({ subject: 'A', onboarding: { goal: 'CET_4_6', quota: 30, completed: false } }))
  b10.restore(); content.restore()
  assert.equal(b10.practice.sessionId, 'A-session')
  assert.equal(content.onboarding.goal, 'CET_4_6')
  const pendingPractice = deferred()
  const pendingHome = deferred()
  b10Api.readAssessmentSession = () => pendingPractice.promise
  contentApi.readHome = () => pendingHome.promise
  const practiceRead = b10.loadPractice()
  const homeRead = content.loadHome()
  assert.equal(await session.login('B', 'fixture'), true)
  assert.equal(session.verifiedSubject, 'B')
  assert.equal(b10.practice, null)
  assert.equal(content.onboarding.goal, null)
  assert.equal(storage.has(B10_KEY), false)
  assert.equal(storage.has(CONTENT_KEY), false)
  pendingPractice.resolve(practice('A-late-session'))
  pendingHome.resolve({ tasks: [{ id: 'A-task' }], content: [], contentStatus: 'READY', targetMinutes: 30, completedMinutes: 5 })
  await Promise.all([practiceRead, homeRead])
  assert.equal(b10.practice, null)
  assert.equal(content.home, null)
  await b10.submitAnswer(42, { selectedKey: 'A' })
  await content.completeTask('A-task')
  contentApi.readHome = async () => { throw new Error('HTTP 503') }
  await content.loadHome()
  assert.equal(content.home, null)
  assert.equal(content.homeStatus, 'offline')
  assert.equal(storage.has(B10_KEY), false)
  assert.equal(JSON.parse(storage.get(CONTENT_KEY)).subject, 'B')
  assert.equal(JSON.parse(storage.get(CONTENT_KEY)).home, null)
})

test('same verified subject refresh keeps drafts; logout clears them immediately', async () => {
  const { session, storage, b10, content } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  b10.practice = practice('A-session'); b10.answers = { 42: { selectedKey: 'A' } }; b10.persist()
  content.onboarding = { ...content.onboarding, goal: 'ZERO_BASIS', quota: 15 }; content.persist()
  const revision = session.identityRevision
  assert.equal(await session.refreshSilently(), true)
  assert.equal(session.identityRevision, revision)
  assert.equal(b10.practice.sessionId, 'A-session')
  assert.equal(content.onboarding.goal, 'ZERO_BASIS')
  assert.equal(storage.has(B10_KEY), true)
  assert.equal(storage.has(CONTENT_KEY), true)
  const logout = session.logout()
  assert.equal(session.isAuthenticated, false)
  assert.equal(b10.practice, null)
  assert.equal(content.onboarding.goal, null)
  assert.equal(storage.has(B10_KEY), false)
  assert.equal(storage.has(CONTENT_KEY), false)
  assert.equal(await logout, true)
})

test('saved content language drives learning reads and a new account reloads its persisted preference', async () => {
  const { session, content, contentApi, mobileI18n, persistedAccounts, accountReads, learningLocales } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  persistedAccounts.set('A', { ...persistedAccounts.get('A'), contentLocale: 'en-US', stateVersion: 4 })

  assert.equal(await content.saveContentLocale('zh-CN'), true)
  assert.equal(mobileI18n.contentLocale, 'zh-CN')
  await content.loadHome()
  assert.equal(learningLocales.at(-1), 'zh-CN')

  const pendingSave = deferred()
  contentApi.savePreferences = () => pendingSave.promise
  const savingA = content.saveContentLocale('en-US')
  persistedAccounts.set('B', { uiLocale: 'zh-CN', contentLocale: 'zh-CN', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: null, quota: null, stateVersion: 8 })
  assert.equal(await session.login('B', 'fixture'), true)
  await content.loadHome()
  assert.equal(accountReads.at(-1), 'B')
  assert.equal(mobileI18n.contentLocale, 'zh-CN')
  assert.equal(learningLocales.at(-1), 'zh-CN')

  pendingSave.resolve({ ...persistedAccounts.get('A'), contentLocale: 'en-US', stateVersion: 6 })
  assert.equal(await savingA, false)
  assert.equal(session.verifiedSubject, 'B')
  assert.equal(mobileI18n.contentLocale, 'zh-CN')
  assert.equal(content.account.contentLocale, 'zh-CN')
})

test('a failed content language PATCH leaves the displayed language unchanged', async () => {
  const { session, content, contentApi, mobileI18n } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  await content.loadAccount()
  contentApi.savePreferences = async () => { throw new Error('HTTP 503') }

  assert.equal(await content.saveContentLocale('zh-CN'), false)
  assert.equal(mobileI18n.contentLocale, 'en-US')
  assert.equal(content.account.contentLocale, 'en-US')
  assert.equal(content.accountStatus, 'offline')
})

test('missing or failed permission owner fails closed, and old permission responses cannot replace B', async () => {
  const { session, auth, storage, b10, content } = environment()
  auth.getPermissions = async () => null
  assert.equal(await session.login('A', 'fixture'), false)
  assert.equal(session.isAuthenticated, false)
  assert.equal(session.verifiedSubject, null)
  assert.equal(storage.has(B10_KEY), false)
  assert.equal(storage.has(CONTENT_KEY), false)
  auth.getPermissions = async () => { throw new Error('HTTP 503') }
  assert.equal(await session.login('A', 'fixture'), false)
  assert.equal(session.isAuthenticated, false)
  const oldPermissions = deferred()
  auth.getPermissions = async () => auth.subject === 'A' ? oldPermissions.promise : { principal: { subject: 'B', roles: [], permissions: [], adultGate: 'PASSED' } }
  auth.login = async ({ identifier }) => { auth.subject = identifier; return { accessToken: `token-${identifier}` } }
  const loginA = session.login('A', 'fixture')
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(await session.login('B', 'fixture'), true)
  oldPermissions.resolve({ principal: { subject: 'A', roles: [], permissions: [], adultGate: 'PASSED' } })
  assert.equal(await loginA, false)
  assert.equal(session.verifiedSubject, 'B')
  assert.equal(session.isAuthenticated, true)
  assert.equal(b10.practice, null)
  assert.equal(content.home, null)
})

test('an in-flight refresh cannot restore A after logout', async () => {
  const { session, auth, storage, b10 } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  b10.practice = practice('A-session'); b10.persist()
  const pendingRefresh = deferred()
  auth.refresh = () => pendingRefresh.promise
  const refreshing = session.refreshSilently()
  assert.equal(await session.logout(), true)
  pendingRefresh.resolve({ accessToken: 'late-A-token' })
  assert.equal(await refreshing, false)
  assert.equal(session.verifiedSubject, null)
  assert.equal(session.isAuthenticated, false)
  assert.equal(b10.practice, null)
  assert.equal(storage.has(B10_KEY), false)
})

test('logout in progress refuses a new refresh', async () => {
  const { session, auth } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  const pendingLogout = deferred()
  auth.logout = () => pendingLogout.promise
  auth.refresh = () => { throw new Error('Refresh must not start during logout') }
  const logout = session.logout()
  assert.equal(await session.refreshSilently(), false)
  assert.equal(session.verifiedSubject, null)
  pendingLogout.resolve()
  assert.equal(await logout, true)
})

test('legacy unscoped cache is rejected instead of inheriting a former account draft', async () => {
  const { session, storage, b10, content } = environment()
  assert.equal(await session.login('B', 'fixture'), true)
  storage.set(B10_KEY, JSON.stringify({ practice: practice('legacy-session') }))
  storage.set(CONTENT_KEY, JSON.stringify({ onboarding: { goal: 'CET_4_6' } }))
  b10.restore(); content.restore()
  assert.equal(b10.practice, null)
  assert.equal(content.onboarding.goal, null)
  assert.equal(storage.has(B10_KEY), false)
  assert.equal(storage.has(CONTENT_KEY), false)
})

test('onboarding stops before learner writes if identity changes during IAM consent', async () => {
  const consent = deferred()
  const writes = []
  const api = load('src/api/learner-content.ts', {
    './client': {
      MobileApiError: class MobileApiError extends Error {},
      mobileApiClient: { request: async (route, options = {}) => {
        if (route === '/iam/consents') return consent.promise
        writes.push({ route, method: options.method ?? 'GET' })
        throw new Error('Unexpected owner request after identity change')
      } },
    },
  }).mobileLearnerContentApi
  let current = true
  const saving = api.saveOnboarding({ goal: 'ZERO_BASIS', quota: 15, birthYear: 1995, ageConfirmed: true, privacyConsent: true, termsConsent: true, clientEventId: 'A-onboarding' }, () => current)
  current = false
  consent.resolve({ data: {} })
  await assert.rejects(saving, /账号已变化/)
  assert.deepEqual(writes, [])
})

test('B1 and B11 owner caches, offline queue and late reads are isolated on A to B', async () => {
  const { session, storage, b1, b11, b11Api } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  b1.completeOnboarding('CET_4_6', 30)
  b11.reading = { article: { articleId: 101, blocks: [{ blockId: 'A-block' }], rightsStatus: 'AUTHORIZED' }, questions: [], contentVersion: 1 }
  b11.setRecordingDraft({ clientEventId: 'A-recording', sourceSegmentId: 'A-segment', durationMs: 1000, contentHash: 'hash', storageMode: 'LOCAL', contentVersion: 1, status: 'LOCAL_ONLY' })
  storage.set(B11_OFFLINE_KEY, JSON.stringify({ cursor: 'A-cursor', records: [{ clientEventId: 'A-event', status: 'PENDING' }], conflicts: [], entityVersions: {} }))
  b11.refreshQueue()
  assert.equal(b11.queueCount, 1)
  const pendingReading = deferred()
  b11Api.loadB11ReadingWorkspace = () => pendingReading.promise
  const reading = b11.loadReading()
  assert.equal(await session.login('B', 'fixture'), true)
  assert.equal(b1.state.onboardingDone, false)
  assert.equal(b11.reading, null)
  assert.equal(b11.recordingDraft, null)
  assert.equal(b11.queueCount, 0)
  assert.equal(storage.has(B1_KEY), false)
  assert.equal(storage.has(B11_KEY), false)
  assert.equal(storage.has(B11_OFFLINE_KEY), false)
  pendingReading.resolve({ article: { articleId: 101, blocks: [{ blockId: 'A-late' }], rightsStatus: 'AUTHORIZED' }, questions: [], contentVersion: 1 })
  await reading
  assert.equal(b11.reading, null)
  b1.restore(); b11.restore()
  assert.equal(b1.state.goal, '')
  assert.equal(b11.queueCount, 0)
})

test('B11 delayed recording result cannot attach to B; A logout then A login does not revive old drafts', async () => {
  const { session, storage, b1, b11, b11Api } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  b1.completeAssessment()
  const draft = { clientEventId: 'A-recording', sourceSegmentId: 'A-segment', durationMs: 1000, contentHash: 'hash', storageMode: 'LOCAL', contentVersion: 1, status: 'LOCAL_ONLY' }
  b11.setRecordingDraft(draft)
  const pendingRecording = deferred()
  b11Api.registerB11Recording = () => pendingRecording.promise
  const registering = b11.registerRecordingDraft()
  assert.equal(await session.logout(), true)
  assert.equal(await session.login('A', 'fixture'), true)
  pendingRecording.resolve({ recording: { recordingId: 'A-old-recording' } })
  await registering
  b1.restore(); b11.restore()
  assert.equal(b1.state.assessmentDone, false)
  assert.equal(b11.recordingDraft, null)
  assert.equal(b11.savedRecording, null)
  assert.equal(storage.has(B1_KEY), false)
  assert.equal(storage.has(B11_KEY), false)
})

test('B1 and B11 reject legacy or mismatched owner caches and retain same-owner refresh', async () => {
  const { session, storage, b1, b11 } = environment()
  assert.equal(await session.login('A', 'fixture'), true)
  storage.set(B1_KEY, JSON.stringify({ goal: 'CET_4_6', onboardingDone: true }))
  storage.set(B11_KEY, JSON.stringify({ subject: 'B', recordingDraft: { clientEventId: 'B-recording' } }))
  storage.set(B11_OFFLINE_KEY, JSON.stringify({ cursor: 'B-cursor', records: [{ clientEventId: 'B-event', status: 'PENDING' }], conflicts: [], entityVersions: {} }))
  b1.restore(); b11.restore()
  assert.equal(b1.state.onboardingDone, false)
  assert.equal(b11.recordingDraft, null)
  assert.equal(b11.queueCount, 0)
  assert.equal(storage.has(B1_KEY), false)
  assert.equal(storage.has(B11_KEY), false)
  assert.equal(storage.has(B11_OFFLINE_KEY), false)
  b1.completeToday()
  b11.setRecordingDraft({ clientEventId: 'A-recording', sourceSegmentId: 'A-segment', durationMs: 1000, contentHash: 'hash', storageMode: 'LOCAL', contentVersion: 1, status: 'LOCAL_ONLY' })
  const revision = session.identityRevision
  assert.equal(await session.refreshSilently(), true)
  assert.equal(session.identityRevision, revision)
  assert.equal(b1.state.progress, 100)
  assert.equal(b11.recordingDraft.clientEventId, 'A-recording')
  assert.equal(JSON.parse(storage.get(B1_KEY)).subject, 'A')
  assert.equal(JSON.parse(storage.get(B11_KEY)).subject, 'A')
})
