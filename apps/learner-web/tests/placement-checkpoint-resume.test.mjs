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
const STORAGE_KEY = 'yx.v2.learner-content.web.v1'

function load(relativePath, dependencies, replacements = []) {
  let source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  for (const [from, to] of replacements) source = source.replaceAll(from, to)
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`unexpected module: ${name}`)
  }, module, module.exports)
  return module.exports
}

class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const b1Domain = load('src/domain/b1.ts', {})
const learnerDomain = load('src/domain/learner-content.ts', {})
const apiSource = fs.readFileSync(path.join(appRoot, 'src/api/learner-content.ts'), 'utf8')
const apiCompiled = ts.transpileModule(apiSource, {
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

function webPort(handler) {
  const calls = []
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') {
      return {
        ApiError,
        apiClient: {
          request: async (requestPath, options = {}) => {
            const call = { path: requestPath, method: options.method ?? 'GET', body: options.body, headers: options.headers ?? {} }
            calls.push(call)
            return { data: await handler(call) }
          },
        },
      }
    }
    if (name === '../domain/learner-content') return learnerDomain
    if (name === '../domain/b1') return b1Domain
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', apiCompiled)(require, module, module.exports)
  return { port: module.exports.learnerContentPort, calls }
}

function submitInput(model, idempotencyKey = 'placement-response-key') {
  return {
    sessionId: model.sessionId,
    questionId: model.currentQuestion.questionId,
    selectedKey: 'a',
    timeSpentSec: 12,
    contentLocale: 'en-US',
    stateVersion: model.stateVersion,
    itemId: model.currentQuestion.itemId,
    itemSequence: model.currentQuestion.stepIndex,
    idempotencyKey,
  }
}

async function digestFor(sessionId, itemId, itemSequence, selectedKey) {
  const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [selectedKey] }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([sessionId, itemId, itemSequence, candidateResponse])))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

test('web resume reads the accepted checkpoint and stops on the next unsubmitted item', async () => {
  const { port, calls } = webPort(async () => checkpointView())
  const idle = await port.readPlacement({ contentLocale: 'en-US', sessionId: null })
  assert.equal(idle.status, 'EMPTY')
  assert.equal(calls.length, 0)
  const model = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].path, '/assessment/placement/sessions/asess_resume')
  assert.equal(model.sessionId, 'asess_resume')
  assert.equal(model.status, 'IN_PROGRESS')
  assert.equal(model.acceptedSequence, 3)
  assert.equal(model.nextSequence, 4)
  assert.equal(model.stateVersion, 4)
  assert.equal(model.currentQuestion.stemText, 'Stem 4')
  assert.equal(model.currentQuestion.itemId, 104)
  assert.equal(model.currentQuestion.stepIndex, 4)
  assert.equal(model.currentQuestion.questionId, '104')
})

test('web resume derives the next item from acceptedSequence when nextSequence is absent', async () => {
  const source = checkpointView()
  delete source.nextSequence
  const { port } = webPort(async () => source)
  const model = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  assert.equal(model.nextSequence, 4)
  assert.equal(model.currentQuestion.stemText, 'Stem 4')
  assert.notEqual(model.currentQuestion.stemText, 'Stem 1')
})

test('web resume prefers the server current item over the first sealed item', async () => {
  const { port } = webPort(async () => checkpointView({ currentItem: item(4) }))
  const model = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  assert.equal(model.currentQuestion.stemText, 'Stem 4')
  assert.equal(model.currentQuestion.itemId, 104)
})

test('web held checkpoint does not invent a question or a new session', async () => {
  const { port, calls } = webPort(async () => checkpointView({
    sessionId: 'asess_held',
    stateVersion: 11,
    acceptedSequence: 10,
    nextSequence: 11,
  }))
  const model = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_held' })
  assert.equal(model.currentQuestion, null)
  assert.equal(model.report, null)
  assert.equal(model.sessionId, 'asess_held')
  assert.equal(model.status, 'IN_PROGRESS')
  assert.equal(model.acceptedSequence, 10)
  assert.equal(model.nextSequence, 11)
  assert.equal(calls.some((call) => call.method === 'POST'), false)
})

test('web submit posts the read stateVersion and does not send If-Match', async () => {
  const receipt = {
    sessionId: 'asess_resume',
    status: 'IN_PROGRESS',
    stateVersion: 5,
    acceptedSequence: 4,
    nextSequence: 5,
    nextItem: item(5),
  }
  const { port, calls } = webPort(async (call) => call.method === 'POST' ? receipt : checkpointView())
  const read = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  const result = await port.submitPlacementAnswer(submitInput(read, 'placement-response-key'))
  const post = calls.find((call) => call.method === 'POST')
  assert.equal(post.path, '/assessment/placement/sessions/asess_resume/responses')
  assert.equal(post.headers['Idempotency-Key'], 'placement-response-key')
  assert.equal(Object.hasOwn(post.headers, 'If-Match'), false)
  assert.deepEqual(Object.keys(post.body).sort(), ['candidateResponse', 'expectedStateVersion', 'itemId', 'itemSequence', 'responseDigest', 'timeSpentSec'])
  assert.equal(post.body.expectedStateVersion, 4)
  assert.equal(post.body.itemId, 104)
  assert.equal(post.body.itemSequence, 4)
  assert.equal(post.body.timeSpentSec, 12)
  assert.deepEqual(post.body.candidateResponse, { responseType: 'CHOICE', selectedOptionIds: ['a'] })
  assert.equal(post.body.responseDigest, await digestFor('asess_resume', 104, 4, 'a'))
  assert.match(post.body.responseDigest, /^[a-f0-9]{64}$/)
  assert.equal(result.accepted, true)
  assert.equal(result.nextQuestion.stemText, 'Stem 5')
  assert.equal(result.acceptedSequence, 4)
  assert.equal(result.stateVersion, 5)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('web 409 on an unchanged checkpoint retries once with the original key', async () => {
  let posts = 0
  const receipt = {
    sessionId: 'asess_resume', status: 'IN_PROGRESS', stateVersion: 5, acceptedSequence: 4, nextSequence: 5, nextItem: item(5),
  }
  const { port, calls } = webPort(async (call) => {
    if (call.method === 'POST') {
      posts += 1
      if (posts === 1) throw new ApiError('conflict', 409)
      return receipt
    }
    return checkpointView()
  })
  const read = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  const before = calls.length
  const result = await port.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  const postCalls = during.filter((call) => call.method === 'POST')
  assert.equal(postCalls.length, 2)
  assert.equal(during.filter((call) => call.method === 'GET').length, 1)
  assert.equal(postCalls[0].headers['Idempotency-Key'], 'same-key')
  assert.equal(postCalls[1].headers['Idempotency-Key'], 'same-key')
  assert.deepEqual(postCalls[0].body, postCalls[1].body)
  assert.equal(postCalls[0].body.expectedStateVersion, 4)
  assert.equal(result.accepted, true)
  assert.equal(result.nextQuestion.stemText, 'Stem 5')
})

test('web second 409 stops and does not create another idempotency key', async () => {
  const { port, calls } = webPort(async (call) => {
    if (call.method === 'POST') throw new ApiError('conflict', 409)
    return checkpointView()
  })
  const read = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  const before = calls.length
  const result = await port.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  const postCalls = during.filter((call) => call.method === 'POST')
  assert.equal(postCalls.length, 2)
  assert.equal(during.filter((call) => call.method === 'GET').length, 2)
  assert.deepEqual(postCalls.map((call) => call.headers['Idempotency-Key']), ['same-key', 'same-key'])
  assert.equal(result.accepted, false)
  assert.equal(result.nextQuestion.stemText, 'Stem 4')
  assert.equal(result.acceptedSequence, 3)
  assert.equal(result.stateVersion, 4)
})

test('web 409 after the server accepted the item does not post again', async () => {
  const advanced = checkpointView({ stateVersion: 5, acceptedSequence: 4, nextSequence: 5, currentItem: item(5) })
  let posted = false
  const { port, calls } = webPort(async (call) => {
    if (call.method === 'POST') {
      posted = true
      throw new ApiError('conflict', 409)
    }
    return posted ? advanced : checkpointView()
  })
  const read = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  const before = calls.length
  const result = await port.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  assert.equal(during.filter((call) => call.method === 'POST').length, 1)
  assert.equal(during.filter((call) => call.method === 'GET').length, 1)
  assert.equal(result.accepted, false)
  assert.equal(result.acceptedSequence, 4)
  assert.equal(result.nextQuestion.stemText, 'Stem 5')
  assert.equal(result.stateVersion, 5)
  assert.equal(JSON.stringify(result).includes('secret'), false)
})

test('web 409 with a moved version does not resend under the old key', async () => {
  const moved = checkpointView({ stateVersion: 9 })
  let posted = false
  const { port, calls } = webPort(async (call) => {
    if (call.method === 'POST') {
      posted = true
      throw new ApiError('conflict', 409)
    }
    return posted ? moved : checkpointView()
  })
  const read = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  const before = calls.length
  const result = await port.submitPlacementAnswer(submitInput(read, 'same-key'))
  const during = calls.slice(before)
  const postCalls = during.filter((call) => call.method === 'POST')
  assert.equal(postCalls.length, 1)
  assert.equal(postCalls[0].body.expectedStateVersion, 4)
  assert.equal(result.accepted, false)
  assert.equal(result.stateVersion, 9)
})

test('web network failure and a missing checkpoint do not count the choice as submitted', async () => {
  const missing = webPort(async () => checkpointView())
  await assert.rejects(
    () => missing.port.submitPlacementAnswer({ sessionId: 'asess_resume', questionId: '104', selectedKey: 'a', timeSpentSec: 1, contentLocale: 'en-US' }),
    (error) => error instanceof learnerDomain.LearnerContentReadModelError && error.message.includes('没有提交'),
  )
  assert.equal(missing.calls.length, 0)

  const failed = webPort(async (call) => {
    if (call.method === 'POST') throw new ApiError('unavailable', 503)
    return checkpointView()
  })
  const read = await failed.port.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_resume' })
  const before = failed.calls.length
  await assert.rejects(() => failed.port.submitPlacementAnswer(submitInput(read)))
  const during = failed.calls.slice(before)
  assert.equal(during.filter((call) => call.method === 'POST').length, 1)
  assert.equal(during.filter((call) => call.method === 'GET').length, 0)
})

test('placement pages do not promise a local or offline completion', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/AssessmentPage.vue'), 'utf8')
  assert.equal(page.includes('已存本机'), false)
  assert.equal(page.includes('可离线答完'), false)
  assert.equal(page.includes('placement/sessions'), false)
  assert.match(page, /定级进度在服务端/)
  assert.match(page, /重新读取会从已接收检查点的下一题继续，不会新开一套题。/)
  assert.match(page, /共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。/)
  assert.match(page, /第 \{\{ question\.stepIndex \}\} 题，共 \{\{ question\.totalSteps \}\} 题/)
  assert.match(page, /当前选择只留在这一页。离开后，还没提交的选择不会保留。/)
  assert.match(page, /报告已生成/)
  assert.match(page, /@click="retest">重测/)
  assert.doesNotMatch(page, /重测尚未接通/)
  assert.doesNotMatch(page, /\{\{[^}]*correctOption/)
})

const session = vue.reactive({
  accessToken: 'token-A', userId: 'A', principal: { subject: 'A' },
  status: 'authenticated', authGeneration: 0, adultGate: 'PASSED',
})
const placementPort = {
  async readPlacement(input) { return placementPort.readPlacementImpl(input) },
  async startPlacement(input) { return placementPort.startPlacementImpl(input) },
  async submitPlacementAnswer(input) { return placementPort.submitPlacementAnswerImpl(input) },
}
const storeModule = load('src/stores/learner-content.ts', {
  vue,
  pinia,
  '../platform/v2-foundation': { learnerI18n: { contentLocale: 'en-US' } },
  './session': { useSessionStore: () => session, readAccessToken: () => session.accessToken },
  '../platform/client-id': { createClientId: (prefix) => `${prefix}-key` },
  '../domain/b1': b1Domain,
  '../api/learner-content': {
    learnerContentPort: placementPort,
    createLocalPlacementSnapshot: () => { throw new Error('real restore must not open a local paper') },
  },
  '../api/practice-today': { readPracticeToday: async () => [], submitPracticeTodayTask: async () => ({}) },
  '../domain/learner-content': learnerDomain,
  '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
}, [['import.meta.env.VITE_RUNTIME_MODE', "'local-real'"]])

function bootWebStore() {
  const entries = new Map()
  const localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  }
  globalThis.window = { localStorage, addEventListener() {} }
  pinia.setActivePinia(pinia.createPinia())
  return { localStorage, store: storeModule.useLearnerContentStore() }
}

function serverQuestion(sequence, sessionId = 'asess_resume') {
  return {
    questionId: String(100 + sequence),
    itemId: 100 + sequence,
    sessionId,
    stepIndex: sequence,
    totalSteps: 10,
    dimension: 'VOCABULARY',
    difficulty: 2,
    stemText: `Stem ${sequence}`,
    helperText: '',
    options: [{ key: 'a', text: 'Alpha' }, { key: 'b', text: 'Beta' }],
    correctKey: null,
    timeLimitSec: 25,
  }
}

function readModel(sequence, extra = {}) {
  return {
    status: 'IN_PROGRESS',
    sessionId: 'asess_resume',
    currentQuestion: sequence == null ? null : serverQuestion(sequence),
    report: null,
    skipBaseline: null,
    stateVersion: extra.stateVersion ?? 4,
    acceptedSequence: extra.acceptedSequence ?? 3,
    nextSequence: extra.nextSequence ?? 4,
    ...extra,
    currentQuestion: extra.currentQuestion === undefined ? (sequence == null ? null : serverQuestion(sequence)) : extra.currentQuestion,
  }
}

function seedCheckpoint(localStorage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    subject: 'A',
    placementSessionId: 'asess_resume',
    assessment: { sessionId: 'asess_resume', answers: [{ selectedKey: 'secret-choice', questionId: '104' }] },
    pendingAssessmentAnswers: [{ selectedKey: 'secret-choice', sessionId: 'asess_resume', questionId: '104', timeSpentSec: 3, contentLocale: 'en-US' }],
  }))
}

test('web re-entry GETs the stored asess_ session and does not keep the local choice', async () => {
  const calls = []
  placementPort.readPlacementImpl = async (input) => {
    calls.push({ op: 'read', sessionId: input.sessionId })
    return readModel(4)
  }
  placementPort.startPlacementImpl = async () => {
    calls.push({ op: 'start' })
    throw new Error('restore must not POST')
  }
  const first = bootWebStore()
  seedCheckpoint(first.localStorage)
  await first.store.loadAssessment()
  assert.equal(first.store.assessment.currentQuestion.stemText, 'Stem 4')
  assert.equal(first.store.assessment.currentQuestion.stepIndex, 4)
  assert.equal(first.store.assessment.acceptedSequence, 3)
  assert.equal(first.store.assessment.stateVersion, 4)
  assert.equal(first.store.assessment.resumed, true)
  assert.equal(first.store.assessmentProgress, 3)
  assert.deepEqual(first.store.assessment.answers, [])
  assert.deepEqual(calls.map((call) => call.op), ['read'])
  const saved = JSON.parse(first.localStorage.getItem(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_resume')
  assert.deepEqual(saved.pendingAssessmentAnswers, [])
  assert.deepEqual(saved.assessment.answers, [])
  assert.equal(saved.assessment.sessionId, 'asess_resume')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)

  pinia.setActivePinia(pinia.createPinia())
  const second = storeModule.useLearnerContentStore()
  await second.loadAssessment()
  assert.equal(second.assessment.currentQuestion.stemText, 'Stem 4')
  assert.deepEqual(second.assessment.answers, [])
  assert.deepEqual(calls.map((call) => call.op), ['read', 'read'])
})

test('web GET failure keeps the session pointer and does not POST', async () => {
  const calls = []
  placementPort.readPlacementImpl = async () => {
    calls.push('read')
    throw new Error('')
  }
  placementPort.startPlacementImpl = async () => {
    calls.push('start')
    throw new Error('restore must not POST')
  }
  const { localStorage, store } = bootWebStore()
  seedCheckpoint(localStorage)
  await store.loadAssessment()
  assert.deepEqual(calls, ['read'])
  assert.equal(store.assessment.sessionId, 'asess_resume')
  assert.equal(store.assessment.currentQuestion, null)
  assert.deepEqual(store.assessment.answers, [])
  assert.match(store.lastError, /不会因此新开一套题/)
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_resume')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)
})

test('web posts a session only when no asess_ checkpoint exists', async () => {
  const calls = []
  placementPort.readPlacementImpl = async () => {
    calls.push('read')
    throw new Error('fresh start must not GET an old session')
  }
  placementPort.startPlacementImpl = async () => {
    calls.push('start')
    return readModel(1, { stateVersion: 1, acceptedSequence: 0, nextSequence: 1, sessionId: 'asess_new', currentQuestion: serverQuestion(1, 'asess_new') })
  }
  const { localStorage, store } = bootWebStore()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    subject: 'A',
    placementSessionId: 'local-placement',
    assessment: { answers: [{ selectedKey: 'secret-choice' }] },
    pendingAssessmentAnswers: [{ selectedKey: 'secret-choice' }],
  }))
  await store.loadAssessment()
  assert.deepEqual(calls, ['start'])
  assert.equal(store.assessment.sessionId, 'asess_new')
  assert.equal(store.assessment.currentQuestion.stemText, 'Stem 1')
  assert.deepEqual(store.assessment.answers, [])
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  assert.equal(saved.placementSessionId, 'asess_new')
  assert.equal(JSON.stringify(saved).includes('secret-choice'), false)
})

test('web held server progress stays on that session and a rejected submit is not stored', async () => {
  const calls = []
  placementPort.readPlacementImpl = async () => {
    calls.push('read')
    return readModel(null, { stateVersion: 11, acceptedSequence: 10, nextSequence: 11, currentQuestion: null })
  }
  placementPort.startPlacementImpl = async () => {
    calls.push('start')
    throw new Error('held checkpoint must not POST')
  }
  const held = bootWebStore()
  seedCheckpoint(held.localStorage)
  await held.store.loadAssessment()
  assert.deepEqual(calls, ['read'])
  assert.equal(held.store.assessment.currentQuestion, null)
  assert.equal(held.store.assessment.report, null)
  assert.equal(held.store.assessmentStatus, 'ready')
  assert.equal(held.store.assessment.sessionId, 'asess_resume')
  assert.equal(held.store.assessmentProgress, 10)

  const ready = bootWebStore()
  seedCheckpoint(ready.localStorage)
  placementPort.readPlacementImpl = async () => readModel(4)
  placementPort.startPlacementImpl = async () => { throw new Error('restore must not POST') }
  await ready.store.loadAssessment()
  placementPort.submitPlacementAnswerImpl = async (input) => {
    calls.push(input)
    return {
      accepted: false,
      isCompleted: false,
      nextQuestion: serverQuestion(4),
      report: null,
      stateVersion: 4,
      acceptedSequence: 3,
      nextSequence: 4,
      sessionId: 'asess_resume',
    }
  }
  await ready.store.submitAnswer('secret-choice', 3)
  assert.equal(calls.at(-1).stateVersion, 4)
  assert.equal(calls.at(-1).itemId, 104)
  assert.equal(calls.at(-1).itemSequence, 4)
  assert.equal(calls.at(-1).selectedKey, 'secret-choice')
  assert.equal(calls.at(-1).idempotencyKey, 'placement-response-asess_resume-4-4-key')
  assert.equal(ready.store.assessment.status, 'error')
  assert.equal(ready.store.assessment.currentQuestion.stemText, 'Stem 4')
  assert.deepEqual(ready.store.assessment.answers, [])
  assert.match(ready.store.lastError, /还没提交成功/)
  assert.equal(JSON.stringify(JSON.parse(ready.localStorage.getItem(STORAGE_KEY))).includes('secret-choice'), false)
})
