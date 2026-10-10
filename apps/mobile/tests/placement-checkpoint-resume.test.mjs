import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const requirePackage = createRequire(import.meta.url)
const vue = requirePackage('vue')
const pinia = requirePackage('pinia')
const appRoot = path.resolve(import.meta.dirname, '..')
const STORAGE_KEY = 'yx.v2.learner-content.mobile.v1'

function load(relativePath, dependencies, transform = (source) => source) {
  const source = transform(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'))
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`unexpected module: ${name} from ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

class MobileApiError extends Error {
  constructor(message, status, details = null) {
    super(message)
    this.name = 'MobileApiError'
    this.status = status
    this.details = details
  }
}

const apiCompiled = ts.transpileModule(fs.readFileSync(path.join(appRoot, 'src/api/learner-content.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function item(sequence) {
  return {
    itemId: 100 + sequence,
    stem: `Stem ${sequence}`,
    displayOrder: sequence,
    itemType: 'VOCABULARY',
    options: [{ optionId: 'a', label: 'Alpha' }, { optionId: 'b', label: 'Beta' }],
  }
}

function checkpointView(extra = {}) {
  return {
    sessionId: 'asess_resume',
    status: 'IN_PROGRESS',
    stateVersion: 4,
    acceptedSequence: 3,
    nextSequence: 4,
    manifest: { totalItemCount: 10 },
    items: [1, 2, 4, 3, 5, 6, 7, 8, 9, 10].map(item),
    ...extra,
  }
}

function mobileApi(handler) {
  const calls = []
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') {
      return {
        MobileApiError,
        mobileApiClient: {
          request: async (requestPath, options = {}) => {
            const call = { path: requestPath, method: options.method ?? 'GET', data: options.data, header: options.header ?? {} }
            calls.push(call)
            return { data: await handler(call) }
          },
        },
      }
    }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', apiCompiled)(require, module, module.exports)
  return { api: module.exports.mobileLearnerContentApi, calls }
}

function submitInput(model, clientEventId = 'mobile-placement-key') {
  return {
    sessionId: model.sessionId,
    questionId: model.currentQuestion.questionId,
    selectedKey: 'a',
    timeSpentSec: 12,
    contentLocale: 'en-US',
    clientEventId,
    stateVersion: model.stateVersion,
    itemId: model.currentQuestion.itemId,
    itemSequence: model.currentQuestion.stepIndex,
  }
}

async function digestFor(sessionId, itemId, itemSequence, selectedKey) {
  const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [selectedKey] }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([sessionId, itemId, itemSequence, candidateResponse])))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

test('mobile resume reads the accepted checkpoint and stops on the next unsubmitted item', async () => {
  const { api, calls } = mobileApi(async () => checkpointView())
  const idle = await api.readPlacement('en-US', null)
  assert.equal(idle.status, 'EMPTY')
  assert.equal(calls.length, 0)
  const model = await api.readPlacement('en-US', 'asess_resume')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].path, '/assessment/placement/sessions/asess_resume')
  assert.equal(model.sessionId, 'asess_resume')
  assert.equal(model.acceptedSequence, 3)
  assert.equal(model.nextSequence, 4)
  assert.equal(model.stateVersion, 4)
  assert.equal(model.currentQuestion.stemText, 'Stem 4')
  assert.equal(model.currentQuestion.itemId, 104)
  assert.equal(model.currentQuestion.stepIndex, 4)
  assert.equal(model.reconciledWithoutReceipt, false)
})

test('mobile resume derives the next item from acceptedSequence when nextSequence is absent', async () => {
  const source = checkpointView()
  delete source.nextSequence
  const { api } = mobileApi(async () => source)
  const model = await api.readPlacement('en-US', 'asess_resume')
  assert.equal(model.nextSequence, 4)
  assert.equal(model.currentQuestion.stemText, 'Stem 4')
})

test('mobile resume prefers the server current item over the first sealed item', async () => {
  const { api } = mobileApi(async () => checkpointView({ currentItem: item(4) }))
  const model = await api.readPlacement('en-US', 'asess_resume')
  assert.equal(model.currentQuestion.stemText, 'Stem 4')
  assert.equal(model.currentQuestion.itemId, 104)
})

test('mobile held checkpoint does not invent a question or a new session', async () => {
  const { api, calls } = mobileApi(async () => checkpointView({
    sessionId: 'asess_held',
    stateVersion: 11,
    acceptedSequence: 10,
    nextSequence: 11,
  }))
  const model = await api.readPlacement('en-US', 'asess_held')
  assert.equal(model.currentQuestion, null)
  assert.equal(model.report, null)
  assert.equal(model.sessionId, 'asess_held')
  assert.equal(model.status, 'IN_PROGRESS')
  assert.equal(model.acceptedSequence, 10)
  assert.equal(calls.some((call) => call.method === 'POST'), false)
})

test('mobile submit posts the read stateVersion and does not send If-Match', async () => {
  const receipt = {
    sessionId: 'asess_resume', status: 'IN_PROGRESS', stateVersion: 5, acceptedSequence: 4, nextSequence: 5, nextItem: item(5),
  }
  const { api, calls } = mobileApi(async (call) => call.method === 'POST' ? receipt : checkpointView())
  const read = await api.readPlacement('en-US', 'asess_resume')
  const result = await api.submitPlacementAnswer(submitInput(read, 'mobile-placement-key'))
  const post = calls.find((call) => call.method === 'POST')
  assert.equal(post.path, '/assessment/placement/sessions/asess_resume/responses')
  assert.equal(post.header['Idempotency-Key'], 'mobile-placement-key')
  assert.equal(Object.hasOwn(post.header, 'If-Match'), false)
  assert.deepEqual(Object.keys(post.data).sort(), ['candidateResponse', 'expectedStateVersion', 'itemId', 'itemSequence', 'responseDigest', 'timeSpentSec'])
  assert.equal(post.data.expectedStateVersion, 4)
  assert.equal(post.data.itemId, 104)
  assert.equal(post.data.itemSequence, 4)
  assert.deepEqual(post.data.candidateResponse, { responseType: 'CHOICE', selectedOptionIds: ['a'] })
  assert.equal(post.data.responseDigest, await digestFor('asess_resume', 104, 4, 'a'))
  assert.equal(result.reconciledWithoutReceipt, false)
  assert.equal(result.currentQuestion.stemText, 'Stem 5')
  assert.equal(result.acceptedSequence, 4)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('mobile 409 on an unchanged checkpoint retries once with the original key', async () => {
  let posts = 0
  const receipt = {
    sessionId: 'asess_resume', status: 'IN_PROGRESS', stateVersion: 5, acceptedSequence: 4, nextSequence: 5, nextItem: item(5),
  }
  const { api, calls } = mobileApi(async (call) => {
    if (call.method === 'POST') {
      posts += 1
      if (posts === 1) throw new MobileApiError('conflict', 409)
      return receipt
    }
    return checkpointView()
  })
  const read = await api.readPlacement('en-US', 'asess_resume')
  const before = calls.length
  const result = await api.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  const postCalls = during.filter((call) => call.method === 'POST')
  assert.equal(postCalls.length, 2)
  assert.equal(during.filter((call) => call.method === 'GET').length, 1)
  assert.deepEqual(postCalls.map((call) => call.header['Idempotency-Key']), ['same-key', 'same-key'])
  assert.deepEqual(postCalls[0].data, postCalls[1].data)
  assert.equal(postCalls[0].data.expectedStateVersion, 4)
  assert.equal(result.reconciledWithoutReceipt, false)
  assert.equal(result.currentQuestion.stemText, 'Stem 5')
})

test('mobile second 409 stops and does not create another idempotency key', async () => {
  const { api, calls } = mobileApi(async (call) => {
    if (call.method === 'POST') throw new MobileApiError('conflict', 409)
    return checkpointView()
  })
  const read = await api.readPlacement('en-US', 'asess_resume')
  const before = calls.length
  const result = await api.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  const postCalls = during.filter((call) => call.method === 'POST')
  assert.equal(postCalls.length, 2)
  assert.equal(during.filter((call) => call.method === 'GET').length, 2)
  assert.deepEqual(postCalls.map((call) => call.header['Idempotency-Key']), ['same-key', 'same-key'])
  assert.equal(result.reconciledWithoutReceipt, true)
  assert.equal(result.currentQuestion.stemText, 'Stem 4')
  assert.equal(result.acceptedSequence, 3)
})

test('mobile 409 after the server accepted the item does not post again', async () => {
  const advanced = checkpointView({ stateVersion: 5, acceptedSequence: 4, nextSequence: 5, currentItem: item(5) })
  let posted = false
  const { api, calls } = mobileApi(async (call) => {
    if (call.method === 'POST') {
      posted = true
      throw new MobileApiError('conflict', 409)
    }
    return posted ? advanced : checkpointView()
  })
  const read = await api.readPlacement('en-US', 'asess_resume')
  const before = calls.length
  const result = await api.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  assert.equal(during.filter((call) => call.method === 'POST').length, 1)
  assert.equal(result.reconciledWithoutReceipt, true)
  assert.equal(result.acceptedSequence, 4)
  assert.equal(result.currentQuestion.stemText, 'Stem 5')
})

test('mobile 409 with a moved version does not resend under the old key', async () => {
  const moved = checkpointView({ stateVersion: 9 })
  let posted = false
  const { api, calls } = mobileApi(async (call) => {
    if (call.method === 'POST') {
      posted = true
      throw new MobileApiError('conflict', 409)
    }
    return posted ? moved : checkpointView()
  })
  const read = await api.readPlacement('en-US', 'asess_resume')
  const before = calls.length
  const result = await api.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  const postCalls = during.filter((call) => call.method === 'POST')
  assert.equal(postCalls.length, 1)
  assert.equal(postCalls[0].data.expectedStateVersion, 4)
  assert.equal(result.reconciledWithoutReceipt, true)
  assert.equal(result.stateVersion, 9)
})

test('mobile network failure and a missing checkpoint do not count the choice as submitted', async () => {
  const missing = mobileApi(async () => checkpointView())
  await assert.rejects(
    () => missing.api.submitPlacementAnswer({ sessionId: 'asess_resume', questionId: '104', selectedKey: 'a', timeSpentSec: 1, contentLocale: 'en-US', clientEventId: 'missing' }),
    /没有提交/,
  )
  assert.equal(missing.calls.length, 0)

  const failed = mobileApi(async (call) => {
    if (call.method === 'POST') throw new MobileApiError('unavailable', 503)
    return checkpointView()
  })
  const read = await failed.api.readPlacement('en-US', 'asess_resume')
  const before = failed.calls.length
  await assert.rejects(() => failed.api.submitPlacementAnswer(submitInput(read)))
  const during = failed.calls.slice(before)
  assert.equal(during.filter((call) => call.method === 'POST').length, 1)
  assert.equal(during.filter((call) => call.method === 'GET').length, 0)
})

test('mobile placement page does not promise local or offline completion', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/assessment/assessment.vue'), 'utf8')
  assert.equal(page.includes('已存本机'), false)
  assert.equal(page.includes('可离线答完'), false)
  assert.equal(page.includes('placement/sessions'), false)
  assert.match(page, /定级进度在服务端。重新读取会从已接收检查点的下一题继续，不会新开一套题。/)
  assert.match(page, /共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。/)
  assert.match(page, /第 \{\{ question\.stepIndex \}\} 题，共 \{\{ question\.totalSteps \}\} 题/)
  assert.match(page, /当前选择只留在这一页。离开后，还没提交的选择不会保留。/)
  assert.match(page, /刚才提交的这题答对了。/)
  assert.match(page, /刚才提交的这题没有答对。/)
  assert.match(page, /报告已生成/)
  assert.match(page, /disabled>重测尚未接通/)
  assert.doesNotMatch(page, /correctOption|正确选项|3 分钟|已存本机|可离线答完/)
})

const session = vue.reactive({
  isAuthenticated: true,
  verifiedSubject: 'A',
  identityRevision: 1,
  adultGate: 'PASSED',
})
const placementApi = {
  readAccount: async () => ({
    uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM',
    highContrast: false, motionMode: 'FULL', goal: null, quota: null, stateVersion: 1,
  }),
  async readPlacement(locale, sessionId) { return placementApi.readPlacementImpl(locale, sessionId) },
  async startPlacement(locale, clientEventId) { return placementApi.startPlacementImpl(locale, clientEventId) },
  async submitPlacementAnswer(input) { return placementApi.submitPlacementAnswerImpl(input) },
}
const mobileI18n = { contentLocale: 'en-US', setContentLocale(locale) { this.contentLocale = locale } }
const storeModule = load('src/stores/learner-content.ts', {
  vue,
  pinia,
  '../api/learner-content': {
    mobileLearnerContentApi: placementApi,
    mobileLearnerContentError: (error) => ({ message: error instanceof Error && error.message ? error.message : '本题尚未提交成功。未提交的选择不会当成已保存。' }),
  },
  '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
  '../platform/uni-runtime': { getUniRuntime: () => globalThis.__placementRuntime },
  '../platform/client-id': { createClientId: (prefix) => `${prefix}-key` },
  './session': { useSessionStore: () => session },
  './learning-cache': {
    LEARNER_CONTENT_STORAGE_KEY: STORAGE_KEY,
    removeLearningCache: (key) => { globalThis.__placementStorage?.delete(key) },
  },
  '../platform/v2-foundation': { mobileI18n },
}, (source) => source.replaceAll("import.meta.env.VITE_RUNTIME_MODE", "'local-real'"))

function bootMobileStore() {
  const storage = new Map()
  globalThis.__placementStorage = storage
  globalThis.__placementRuntime = {
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, String(value)),
    removeStorageSync: (key) => storage.delete(key),
  }
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    addEventListener() {},
  }
  pinia.setActivePinia(pinia.createPinia())
  return { storage, store: storeModule.useLearnerContentStore() }
}

function serverQuestion(sequence) {
  return {
    questionId: String(100 + sequence),
    itemId: 100 + sequence,
    stemText: `Stem ${sequence}`,
    options: [{ key: 'a', text: 'Alpha' }, { key: 'b', text: 'Beta' }],
    dimension: 'VOCABULARY',
    difficulty: 1,
    stepIndex: sequence,
    totalSteps: 10,
    timeLimitSec: 25,
  }
}

function placementModel(sequence, extra = {}) {
  return {
    sessionId: extra.sessionId ?? 'asess_resume',
    status: 'IN_PROGRESS',
    currentQuestion: sequence == null ? null : serverQuestion(sequence),
    report: null,
    isCompleted: false,
    stateVersion: extra.stateVersion ?? 4,
    acceptedSequence: extra.acceptedSequence ?? 3,
    nextSequence: extra.nextSequence ?? 4,
    reconciledWithoutReceipt: false,
    ...extra,
    currentQuestion: extra.currentQuestion === undefined ? (sequence == null ? null : serverQuestion(sequence)) : extra.currentQuestion,
  }
}

function seedCheckpoint(storage) {
  storage.set(STORAGE_KEY, JSON.stringify({
    subject: 'A',
    placementSessionId: 'asess_resume',
    onboarding: { goal: null, quota: null },
    answers: [{ selectedKey: 'secret-choice' }],
    pendingAssessmentAnswers: [{ selectedKey: 'secret-choice' }],
  }))
}

test('mobile re-entry GETs the stored asess_ session and does not keep the local choice', async () => {
  const calls = []
  placementApi.readPlacementImpl = async (locale, sessionId) => {
    calls.push({ op: 'read', locale, sessionId })
    return placementModel(4)
  }
  placementApi.startPlacementImpl = async () => {
    calls.push({ op: 'start' })
    throw new Error('restore must not POST')
  }
  const first = bootMobileStore()
  seedCheckpoint(first.storage)
  await first.store.loadPlacement()
  assert.equal(first.store.placement.currentQuestion.stemText, 'Stem 4')
  assert.equal(first.store.placement.acceptedSequence, 3)
  assert.equal(first.store.placement.stateVersion, 4)
  assert.equal(first.store.placementStatus, 'ready')
  assert.deepEqual(calls.map((call) => call.op), ['read'])
  assert.equal(calls[0].sessionId, 'asess_resume')
  const saved = JSON.parse(first.storage.get(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_resume')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)
  assert.equal(Object.hasOwn(saved, 'answers'), false)

  pinia.setActivePinia(pinia.createPinia())
  const second = storeModule.useLearnerContentStore()
  await second.loadPlacement()
  assert.equal(second.placement.currentQuestion.stemText, 'Stem 4')
  assert.deepEqual(calls.map((call) => call.op), ['read', 'read'])
})

test('mobile GET failure keeps the session pointer and does not POST', async () => {
  const calls = []
  placementApi.readPlacementImpl = async () => {
    calls.push('read')
    throw new Error('down')
  }
  placementApi.startPlacementImpl = async () => {
    calls.push('start')
    throw new Error('restore must not POST')
  }
  const { store } = bootMobileStore()
  seedCheckpoint(globalThis.__placementStorage)
  await store.loadPlacement()
  assert.deepEqual(calls, ['read'])
  assert.equal(store.placement.sessionId, 'asess_resume')
  assert.equal(store.placement.currentQuestion, null)
  assert.equal(store.placementStatus, 'offline')
  assert.equal(store.placement.acceptedSequence, 0)
  const saved = JSON.parse(globalThis.__placementStorage.get(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_resume')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)
})

test('mobile posts a session only when no asess_ checkpoint exists', async () => {
  const calls = []
  placementApi.readPlacementImpl = async (locale, sessionId) => {
    calls.push({ op: 'read', sessionId })
    return placementModel(1, { sessionId, stateVersion: 1, acceptedSequence: 0, nextSequence: 1 })
  }
  placementApi.startPlacementImpl = async () => {
    calls.push({ op: 'start' })
    return placementModel(1, { sessionId: 'asess_new', stateVersion: 1, acceptedSequence: 0, nextSequence: 1 })
  }
  const { storage, store } = bootMobileStore()
  storage.set(STORAGE_KEY, JSON.stringify({
    subject: 'A',
    placementSessionId: 'local-placement',
    answers: [{ selectedKey: 'secret-choice' }],
  }))
  await store.loadPlacement()
  assert.deepEqual(calls.map((call) => call.op), ['start'])
  assert.equal(store.placement.sessionId, 'asess_new')
  assert.equal(store.placement.currentQuestion.stemText, 'Stem 1')
  const saved = JSON.parse(storage.get(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_new')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)
})

test('mobile new session without a question re-reads that session instead of posting twice', async () => {
  const calls = []
  placementApi.startPlacementImpl = async () => {
    calls.push('start')
    return placementModel(null, { sessionId: 'asess_new', stateVersion: 1, acceptedSequence: 0, nextSequence: 1, currentQuestion: null })
  }
  placementApi.readPlacementImpl = async (locale, sessionId) => {
    calls.push(`read:${sessionId}`)
    return placementModel(1, { sessionId, stateVersion: 1, acceptedSequence: 0, nextSequence: 1 })
  }
  const { store } = bootMobileStore()
  await store.loadPlacement()
  assert.deepEqual(calls, ['start', 'read:asess_new'])
  assert.equal(store.placement.currentQuestion.stemText, 'Stem 1')
  assert.equal(store.placement.sessionId, 'asess_new')
})

test('mobile held server progress stays on that session and a rejected submit is not stored', async () => {
  const calls = []
  placementApi.readPlacementImpl = async () => {
    calls.push('read')
    return placementModel(null, { stateVersion: 11, acceptedSequence: 10, nextSequence: 11, currentQuestion: null })
  }
  placementApi.startPlacementImpl = async () => {
    calls.push('start')
    throw new Error('held checkpoint must not POST')
  }
  const held = bootMobileStore()
  seedCheckpoint(held.storage)
  await held.store.loadPlacement()
  assert.deepEqual(calls, ['read'])
  assert.equal(held.store.placement.currentQuestion, null)
  assert.equal(held.store.placement.report, null)
  assert.equal(held.store.placementStatus, 'ready')
  assert.equal(held.store.placement.sessionId, 'asess_resume')

  const ready = bootMobileStore()
  seedCheckpoint(ready.storage)
  placementApi.readPlacementImpl = async () => placementModel(4)
  placementApi.startPlacementImpl = async () => { throw new Error('restore must not POST') }
  await ready.store.loadPlacement()
  placementApi.submitPlacementAnswerImpl = async (input) => {
    calls.push(input)
    return placementModel(4, { reconciledWithoutReceipt: true })
  }
  await ready.store.submitPlacementAnswer('secret-choice', 3)
  assert.equal(calls.at(-1).stateVersion, 4)
  assert.equal(calls.at(-1).itemId, 104)
  assert.equal(calls.at(-1).itemSequence, 4)
  assert.equal(calls.at(-1).selectedKey, 'secret-choice')
  assert.equal(calls.at(-1).clientEventId, 'mobile-placement-asess_resume-4-4-key')
  assert.equal(ready.store.placementStatus, 'offline')
  assert.equal(ready.store.placement.currentQuestion.stemText, 'Stem 4')
  assert.match(ready.store.lastError, /还没提交成功/)
  const saved = JSON.parse(ready.storage.get(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_resume')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)
})
