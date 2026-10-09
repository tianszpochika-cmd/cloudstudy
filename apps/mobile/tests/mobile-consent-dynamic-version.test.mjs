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

class MobileApiError extends Error {
  constructor(status) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

function portFor(request) {
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return { mobileApiClient: { request }, MobileApiError }
    if (name === '../stores/session') return {
      useSessionStore: () => ({ refreshSilently: async () => true }),
    }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports.mobileLearnerContentApi
}

test('BC-008: mobile catches 409 and retries with refreshed consent version', async () => {
  const calls = []
  let principalFetchCount = 0

  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, data: options.data, header: options.header })
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
      if (options.data?.version === 'b30-consent-v1') {
        throw new MobileApiError(409)
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
    clientEventId: 'mob-evt-retry-1',
    birthYear: 1994,
    ageConfirmed: true,
    privacyConsent: true,
    termsConsent: true,
    goal: 'WORKPLACE',
    quota: 30,
  })

  assert.ok(principalFetchCount >= 1, 'should re-fetch latest consent version after 409')
  const successfulCalls = calls.filter((c) => c.path === '/iam/consents' && c.data?.version === 'b30-consent-v2')
  assert.equal(successfulCalls.length, 3)
})

test('BC-008: mobile retains refreshed version for subsequent save and signs with it', async () => {
  const calls = []
  let principalFetchCount = 0

  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, data: options.data, header: options.header })
    if (path === '/iam/principal/me' && method === 'GET') {
      principalFetchCount += 1
      return {
        data: {
          consentState: {
            required: true,
            accepted: false,
            version: 'b30-consent-v3',
            requiredPurposes: ['PRIVACY', 'TERMS', 'ADULT_LEARNING'],
          },
        },
      }
    }
    if (path === '/iam/consents' && method === 'PUT') {
      if (options.data?.version === 'b30-consent-v1') {
        throw new MobileApiError(409)
      }
      return { data: { accepted: true } }
    }
    if (path.startsWith('/learner/profile')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/targets')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/preferences')) return { data: { stateVersion: 1 } }
    return { data: {} }
  }

  const port = portFor(request)
  // First save triggers 409 and caches b30-consent-v3
  await port.saveOnboarding({
    clientEventId: 'mob-first',
    birthYear: 1996,
    ageConfirmed: true,
    privacyConsent: true,
    termsConsent: true,
    goal: 'WORKPLACE',
    quota: 15,
  })

  // Second save directly signs with cached b30-consent-v3 without 409
  calls.length = 0
  await port.saveOnboarding({
    clientEventId: 'mob-second',
    birthYear: 1996,
    ageConfirmed: true,
    privacyConsent: true,
    termsConsent: true,
    goal: 'WORKPLACE',
    quota: 15,
  })

  const secondConsentCalls = calls.filter((c) => c.path === '/iam/consents' && c.method === 'PUT')
  assert.equal(secondConsentCalls.length, 3)
  assert.ok(secondConsentCalls.every((c) => c.data?.version === 'b30-consent-v3'))
})

test('BC-008: mobile falls back to default version when principal/me is unavailable', async () => {
  const calls = []
  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ path, method, data: options.data, header: options.header })
    if (path === '/iam/principal/me' && method === 'GET') {
      throw new MobileApiError(503)
    }
    if (path === '/iam/consents' && method === 'PUT') {
      assert.equal(options.data?.version, 'b30-consent-v1')
      return { data: { accepted: true } }
    }
    if (path.startsWith('/learner/profile')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/targets')) return { data: { stateVersion: 1 } }
    if (path.startsWith('/learner/preferences')) return { data: { stateVersion: 1 } }
    return { data: {} }
  }

  const port = portFor(request)
  await port.saveOnboarding({
    clientEventId: 'mob-evt-fb-1',
    birthYear: 1991,
    ageConfirmed: true,
    privacyConsent: true,
    termsConsent: true,
    goal: 'WORKPLACE',
    quota: 15,
  })

  const consentCalls = calls.filter((c) => c.path === '/iam/consents' && c.method === 'PUT')
  assert.equal(consentCalls.length, 3)
  assert.ok(consentCalls.every((c) => c.data?.version === 'b30-consent-v1'))
})
