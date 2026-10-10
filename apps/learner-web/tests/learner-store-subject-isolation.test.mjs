import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const requirePackage = createRequire(import.meta.url)
const vue = requirePackage('vue')
const pinia = requirePackage('pinia')
const root = resolve(import.meta.dirname, '..')

function load(path, dependencies, replacements = []) {
  let source = readFileSync(resolve(root, path), 'utf8')
  for (const [from, to] of replacements) source = source.replaceAll(from, to)
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`unexpected dependency: ${name}`)
  }, module, module.exports)
  return module.exports
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function setup() {
  const entries = new Map()
  const localStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
  }
  globalThis.window = { localStorage, addEventListener: () => {} }
  pinia.setActivePinia(pinia.createPinia())
  const session = vue.reactive({
    accessToken: 'token-A', userId: 'A', principal: { subject: 'A' },
    status: 'authenticated', authGeneration: 0, adultGate: 'PASSED',
  })
  const sessionModule = { useSessionStore: () => session, readAccessToken: () => session.accessToken }
  const performance = { level: 'High', subscribe: () => () => {}, setLevel: () => {}, restore: () => {} }
  const device = { createClientId: () => 'test-event' }
  const b1Domain = load('src/domain/b1.ts', {})
  const learnerDomain = load('src/domain/learner-content.ts', {})
  const b2Domain = load('src/domain/b2.ts', { '../platform/client-id': device })
  const b10Domain = load('src/domain/b10.ts', { '../platform/client-id': device })
  const logout = () => {
    session.status = 'unauthenticated'
    session.accessToken = null
    session.userId = null
    session.principal = null
    session.authGeneration += 1
  }
  const login = subject => {
    session.accessToken = `token-${subject}`
    session.userId = subject
    session.principal = { subject }
    session.status = 'authenticated'
  }
  return { localStorage, session, sessionModule, performance, b1Domain, learnerDomain, b2Domain, b10Domain, logout, login }
}

test('learner-content rejects A storage for B and discards A home response after account switch', async () => {
  const f = setup()
  const pendingA = deferred()
  let homeRead = () => pendingA.promise
  const port = {
    readHome: () => homeRead(),
    readToday: async () => null,
  }
  const storeModule = load('src/stores/learner-content.ts', {
    vue, pinia,
    '../platform/v2-foundation': { learnerI18n: { contentLocale: 'en-US' } },
    './session': f.sessionModule,
    '../platform/client-id': { createClientId: () => 'event' },
    '../domain/b1': f.b1Domain,
    '../api/learner-content': { learnerContentPort: port, createLocalPlacementSnapshot: () => ({}) },
    '../api/practice-today': { readPracticeToday: async () => [], submitPracticeTodayTask: async () => ({}) },
    '../api/plan-today': { readPlanTodayQueue: async () => ({ planId: '', planVersion: 0, itemCount: 0 }), ensureLearningPlan: async () => ({}), replanLearningPlan: async () => ({}) },
    '../domain/plan-today': { shouldEnsurePlan: () => false },
    '../domain/learner-content': f.learnerDomain,
    '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
  }, [['import.meta.env.VITE_RUNTIME_MODE', "'local-real'"]])
  const store = storeModule.useLearnerContentStore()
  store.setConsent({ birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  const key = 'yx.v2.learner-content.web.v1'
  assert.equal(JSON.parse(f.localStorage.getItem(key)).subject, 'A')
  const oldRead = store.loadHome()
  f.logout()
  f.login('B')
  pendingA.resolve({ home: { owner: 'A' }, today: null, content: [], contentStatus: 'READY' })
  await oldRead
  assert.equal(store.home, null)
  assert.equal(f.localStorage.getItem(key), null)
  homeRead = async () => ({ home: { owner: 'B' }, today: null, content: [], contentStatus: 'READY' })
  await store.loadHome()
  assert.equal(store.home.home.owner, 'B')
  assert.equal(JSON.parse(f.localStorage.getItem(key)).subject, 'B')

  f.localStorage.setItem(key, JSON.stringify({ onboarding: { ageConfirmed: true } }))
  f.logout()
  f.login('B')
  store.restore()
  assert.equal(store.onboarding.ageConfirmed, false)
  assert.equal(f.localStorage.getItem(key), null)
})

test('learner-content A logout and A login rejects delayed response from the earlier generation', async () => {
  const f = setup()
  const pending = deferred()
  const storeModule = load('src/stores/learner-content.ts', {
    vue, pinia,
    '../platform/v2-foundation': { learnerI18n: { contentLocale: 'en-US' } },
    './session': f.sessionModule,
    '../platform/client-id': { createClientId: () => 'event' },
    '../domain/b1': f.b1Domain,
    '../api/learner-content': { learnerContentPort: { readToday: () => pending.promise }, createLocalPlacementSnapshot: () => ({}) },
    '../api/practice-today': { readPracticeToday: async () => [], submitPracticeTodayTask: async () => ({}) },
    '../api/plan-today': { readPlanTodayQueue: async () => ({ planId: '', planVersion: 0, itemCount: 0 }), ensureLearningPlan: async () => ({}), replanLearningPlan: async () => ({}) },
    '../domain/plan-today': { shouldEnsurePlan: () => false },
    '../domain/learner-content': f.learnerDomain,
    '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
  }, [['import.meta.env.VITE_RUNTIME_MODE', "'local-real'"]])
  const store = storeModule.useLearnerContentStore()
  const oldRead = store.loadToday()
  f.logout()
  f.login('A')
  pending.resolve({ home: null, today: { owner: 'old-A' }, content: [], contentStatus: 'READY' })
  await oldRead
  assert.equal(store.today, null)
  assert.equal(store.home, null)
})

test('B2 queue and checkpoint clear on switch, and late A batch cannot fill new account', async () => {
  const f = setup()
  const pending = deferred()
  const storeModule = load('src/stores/b2.ts', {
    vue, pinia,
    '../platform/experience-ui': { experiencePerformance: f.performance },
    '../api/b2': { createSrsBatch: () => pending.promise, isB2OfflineError: () => false },
    '../domain/b2': f.b2Domain,
    './session': f.sessionModule,
  })
  const store = storeModule.useB2Store()
  store.queue = [{ id: 'private-A', event: { clientEventId: 'private-A' }, status: 'PENDING' }]
  store.continueContext = { sessionId: 'private-A' }
  store.persist()
  assert.equal(JSON.parse(f.localStorage.getItem(f.b2Domain.B2_QUEUE_KEY)).subject, 'A')
  const oldRead = store.loadVocabulary()
  f.logout()
  f.login('B')
  pending.resolve([{ id: 'private-A-card' }])
  await oldRead
  assert.deepEqual(store.cards, [])
  assert.deepEqual(store.queue, [])
  assert.equal(store.continueContext, null)
  assert.equal(f.localStorage.getItem(f.b2Domain.B2_QUEUE_KEY), null)
  f.localStorage.setItem(f.b2Domain.B2_QUEUE_KEY, JSON.stringify([{ id: 'legacy-A', event: {} }]))
  store.restore()
  assert.deepEqual(store.queue, [])
  assert.equal(f.localStorage.getItem(f.b2Domain.B2_QUEUE_KEY), null)
})

test('B10 drafts and offline queue clear on logout; delayed same-subject response cannot return', async () => {
  const f = setup()
  const pending = deferred()
  const storeModule = load('src/stores/b10.ts', {
    vue, pinia,
    '../platform/experience-ui': { experiencePerformance: f.performance },
    '../api/b10': { listVocabularyBatch: () => pending.promise },
    '../domain/b10': f.b10Domain,
    './session': f.sessionModule,
  })
  const store = storeModule.useB10Store()
  store.saveWritingDraft('private-A-draft')
  store.setPracticeAnswer('question-A', 'private-A-answer')
  store.saveGrammarExerciseAnswer(77, 'private-A-grammar')
  f.localStorage.setItem('yx.b10.learner-web.v1.offline-queue',
    JSON.stringify({ subject: 'A', value: [{ id: 'private-A-queued-answer' }] }))
  f.localStorage.setItem('yx.b10.learner-web.v1.reading-state',
    JSON.stringify({ subject: 'A', value: { blockId: 'private-A-reading' } }))
  assert.equal(JSON.parse(f.localStorage.getItem('yx.b10.learner-web.v1.writing-draft')).subject, 'A')
  const oldRead = store.loadVocabulary()
  f.logout()
  f.login('A')
  pending.resolve([{ id: 'private-A-card' }])
  await oldRead
  assert.equal(store.writingDraft, '')
  assert.equal(store.practiceAnswer('question-A'), undefined)
  assert.equal(store.grammarExerciseAnswer(77), undefined)
  assert.deepEqual(store.cards, [])
  assert.equal(f.localStorage.getItem('yx.b10.learner-web.v1.writing-draft'), null)
  assert.equal(f.localStorage.getItem('yx.b10.learner-web.v1.offline-queue'), null)
  assert.equal(f.localStorage.getItem('yx.b10.learner-web.v1.reading-state'), null)

  f.localStorage.setItem('yx.b10.learner-web.v1.writing-draft', JSON.stringify('legacy-unowned'))
  pinia.setActivePinia(pinia.createPinia())
  const next = storeModule.useB10Store()
  assert.equal(next.writingDraft, '')
  assert.equal(f.localStorage.getItem('yx.b10.learner-web.v1.writing-draft'), null)
})
