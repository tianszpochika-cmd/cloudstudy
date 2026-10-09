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
  constructor(status) {
    super(`HTTP ${status}`)
    this.status = status
    this.details = {}
  }
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
    if (name === '../stores/session') return {
      useSessionStore: () => ({ isLearningReady: true, refreshSilently: async () => true }),
    }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports.learnerContentPort
}

test('BC-008: catches 409 CONSENT_VERSION_MISMATCH, re-fetches latest version and retries successfully', async () => {
  const calls = []
  let principalFetchCount = 0

  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body, headers: options.headers })
    if (path === '/iam/principal/me' && method === 'GET') {
      principalFetchCount += 1
      return {
        data: {
          consentState: {
            required: true,
            accepted: false,
            version: 'b30-consent-v2',
            requiredPurposes: ['PRIVACY', 'TERMS', 'ADULT_LEARNING'],
          },
        },
      }
    }
    if (path === '/iam/consents' && method === 'PUT') {
      if (options.body?.version === 'b30-consent-v1') {
        throw new ApiError(409)
      }
      return { data: { accepted: true } }
    }
    if (path.startsWith('/learner/profile')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/targets')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/preferences')) return { data: { stateVersion: 1 } }
    return { data: {} }
  }

  const port = portFor(request)
  await port.saveOnboarding({
    clientEventId: 'evt-retry-1',
    profile: {
      birthYear: 1992,
      ageConfirmed: true,
      privacyConsent: true,
      termsConsent: true,
      targetGoal: 'WORKPLACE',
      dailyQuotaMinutes: 30,
    },
  })

  // Should have fetched principal/me to recover
  assert.ok(principalFetchCount >= 1, 'should re-fetch latest consent version after 409')
  // All three consent types eventually succeeded with b30-consent-v2
  const successfulCalls = calls.filter((c) => c.path === '/iam/consents' && c.body?.version === 'b30-consent-v2')
  assert.equal(successfulCalls.length, 3)
})

test('BC-008: retains refreshed version for subsequent save and signs with it', async () => {
  const calls = []
  let principalFetchCount = 0

  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body, headers: options.headers })
    if (path === '/iam/principal/me' && method === 'GET') {
      principalFetchCount += 1
      return {
        data: {
          consentState: {
            required: true,
            accepted: false,
            version: 'b30-consent-v2',
            requiredPurposes: ['PRIVACY', 'TERMS', 'ADULT_LEARNING'],
          },
        },
      }
    }
    if (path === '/iam/consents' && method === 'PUT') {
      if (options.body?.version === 'b30-consent-v1') {
        throw new ApiError(409)
      }
      return { data: { accepted: true } }
    }
    if (path.startsWith('/learner/profile')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/targets')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/preferences')) return { data: { stateVersion: 1 } }
    return { data: {} }
  }

  const port = portFor(request)
  // First save triggers 409 and recovers to b30-consent-v2
  await port.saveOnboarding({
    clientEventId: 'evt-first',
    profile: {
      birthYear: 1995,
      ageConfirmed: true,
      privacyConsent: true,
      termsConsent: true,
      targetGoal: 'WORKPLACE',
      dailyQuotaMinutes: 15,
    },
  })

  const initialSuccessful = calls.filter((c) => c.path === '/iam/consents' && c.body?.version === 'b30-consent-v2')
  assert.equal(initialSuccessful.length, 3)

  // Second save directly uses cached activeVersion b30-consent-v2 without 409
  calls.length = 0
  await port.saveOnboarding({
    clientEventId: 'evt-second',
    profile: {
      birthYear: 1995,
      ageConfirmed: true,
      privacyConsent: true,
      termsConsent: true,
      targetGoal: 'WORKPLACE',
      dailyQuotaMinutes: 15,
    },
  })

  const secondConsentCalls = calls.filter((c) => c.path === '/iam/consents' && c.method === 'PUT')
  assert.equal(secondConsentCalls.length, 3)
  assert.ok(secondConsentCalls.every((c) => c.body?.version === 'b30-consent-v2'))
})

test('BC-008: falls back gracefully to default version when /iam/principal/me is unreachable', async () => {
  const calls = []
  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, body: options.body, headers: options.headers })
    if (path === '/iam/principal/me' && method === 'GET') {
      throw new ApiError(503)
    }
    if (path === '/iam/consents' && method === 'PUT') {
      assert.equal(options.body?.version, 'b30-consent-v1')
      return { data: { accepted: true } }
    }
    if (path.startsWith('/learner/profile')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/targets')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/preferences')) return { data: { stateVersion: 1 } }
    return { data: {} }
  }

  const port = portFor(request)
  await port.saveOnboarding({
    clientEventId: 'evt-fb-1',
    profile: {
      birthYear: 1990,
      ageConfirmed: true,
      privacyConsent: true,
      termsConsent: true,
      targetGoal: 'WORKPLACE',
      dailyQuotaMinutes: 15,
    },
  })

  const consentCalls = calls.filter((c) => c.path === '/iam/consents' && c.method === 'PUT')
  assert.equal(consentCalls.length, 3)
  assert.ok(consentCalls.every((c) => c.body?.version === 'b30-consent-v1'))
})
