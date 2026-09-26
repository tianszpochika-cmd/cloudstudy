import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(appRoot, 'src/api/learner-content.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

class ApiError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; this.details = {} }
}

class LearnerContentReadModelError extends Error {
  constructor({ code, status, retryable, message }) {
    super(message)
    Object.assign(this, { code, status, retryable })
  }
}

function portFor(request) {
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return { ApiError, apiClient: { request } }
    if (name === '../domain/learner-content') return { LearnerContentReadModelError }
    if (name === '../domain/b1') return {
      assessmentQuestions: [],
      createDefaultAssessment: () => ({}),
      createDefaultOnboarding: () => ({}),
      dailyQuotaOptions: [5, 15, 30, 45],
      targetGoals: [{ value: 'WORKPLACE', label: '职场英语', description: '' }],
    }
    if (name === '../auth/access-token') return { setInMemoryAccessToken: () => {} }
    if (name === '../stores/session') return { useSessionStore: () => ({ isLearningReady: true, refreshSilently: async () => true }) }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports.learnerContentPort
}

function owner({ failOnceAt }) {
  const calls = []
  let version = 0
  let target = null
  let failed = false
  const profile = { status: 'ONBOARDING', uiLocale: 'en-US', contentLocale: 'en-US', timezone: 'UTC' }
  const preferences = { uiLocale: 'en-US', contentLocale: 'en-US', timezone: 'UTC', themeMode: 'DARK', highContrast: false, motionMode: 'FULL' }
  const response = (data) => ({ data: { ...data, stateVersion: version } })
  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body, headers: options.headers })
    if (path === '/iam/consents' && method === 'PUT') return { data: { accepted: true } }
    if (path.startsWith('/learner/profile') && method === 'GET') return response(profile)
    if (path.startsWith('/learner/targets') && method === 'GET') {
      if (!target) throw new ApiError(404)
      return response(target)
    }
    if (path.startsWith('/learner/preferences') && method === 'GET') return response(preferences)
    if (path.startsWith('/onboarding/options') && method === 'GET') return { data: { goals: [], dailyQuotaMinutes: [15] } }
    if (path === '/learner/profile' && method === 'PATCH') {
      assert.equal(options.body.expectedStateVersion, version)
      Object.assign(profile, { uiLocale: options.body.uiLocale, contentLocale: options.body.contentLocale, timezone: options.body.timezone })
      Object.assign(preferences, { uiLocale: options.body.uiLocale, contentLocale: options.body.contentLocale, timezone: options.body.timezone })
      version += 1
      return response(profile)
    }
    if (path === '/learner/targets' && method === 'PUT') {
      assert.equal(options.body.expectedStateVersion, version)
      if (failOnceAt === 'target' && !failed) { failed = true; throw new ApiError(503) }
      target = { goalCode: options.body.goalCode, targetLevel: options.body.targetLevel, dailyQuotaMinutes: options.body.dailyQuotaMinutes, status: 'ACTIVE' }
      version += 1
      return response(target)
    }
    if (path === '/learner/preferences' && method === 'PATCH') {
      assert.equal(options.body.expectedStateVersion, version)
      if (failOnceAt === 'preferences' && !failed) { failed = true; throw new ApiError(503) }
      Object.assign(preferences, options.body)
      version += 1
      return response(preferences)
    }
    throw new Error(`unexpected request: ${method} ${path}`)
  }
  return { calls, request, get version() { return version } }
}

const onboarding = (clientEventId) => ({
  clientEventId,
  profile: { birthYear: 1995, ageConfirmed: true, privacyConsent: true, termsConsent: true, targetGoal: 'WORKPLACE', dailyQuotaMinutes: 15 },
})

function writes(calls, path) { return calls.filter((call) => call.path === path && call.method !== 'GET') }

test('onboarding resumes after target write fails without replaying the confirmed profile write', async () => {
  const service = owner({ failOnceAt: 'target' })
  const port = portFor(service.request)
  await assert.rejects(port.saveOnboarding(onboarding('first')), /学习服务暂时不可用/)
  await port.saveOnboarding(onboarding('retry'))

  assert.equal(writes(service.calls, '/learner/profile').length, 1)
  assert.deepEqual(writes(service.calls, '/learner/targets').map((call) => call.body.expectedStateVersion), [1, 1])
  assert.deepEqual(writes(service.calls, '/learner/preferences').map((call) => call.body.expectedStateVersion), [2])
  assert.equal(service.version, 3)
  assert.equal(service.calls.some((call) => call.path.includes('/onboarding/daily-tasks/ensure')), false)
  assert.equal(service.calls.some((call) => call.path.includes('/content/learner/catalog')), false)
})

test('onboarding resumes after preference write fails and skips matching owner facts', async () => {
  const service = owner({ failOnceAt: 'preferences' })
  const port = portFor(service.request)
  await assert.rejects(port.saveOnboarding(onboarding('first')), /学习服务暂时不可用/)
  await port.saveOnboarding(onboarding('retry'))
  await port.saveOnboarding(onboarding('again'))

  assert.equal(writes(service.calls, '/learner/profile').length, 1)
  assert.equal(writes(service.calls, '/learner/targets').length, 1)
  assert.deepEqual(writes(service.calls, '/learner/preferences').map((call) => call.body.expectedStateVersion), [2, 2])
  assert.equal(service.version, 3)
})
