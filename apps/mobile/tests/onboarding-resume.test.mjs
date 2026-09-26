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
  constructor(status) { super(`HTTP ${status}`); this.status = status }
}

function adapter(failAt) {
  let version = 0
  let target = null
  let preferences = { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'DARK', highContrast: false, motionMode: 'FULL' }
  let failures = 0
  let targetWrites = 0
  let preferenceWrites = 0
  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    const route = path.split('?')[0]
    if (route === '/iam/consents') return { data: {} }
    if (route === '/learner/profile' && method === 'GET') return { data: { status: 'ONBOARDING', stateVersion: version } }
    if (route === '/learner/targets' && method === 'GET') {
      if (!target) throw new MobileApiError(404)
      return { data: { ...target, stateVersion: version } }
    }
    if (route === '/learner/targets' && method === 'PUT') {
      assert.equal(options.data.expectedStateVersion, version)
      targetWrites++
      target = { ...options.data }
      version++
      if (failAt === 'target' && failures++ === 0) throw new Error('response lost after target commit')
      return { data: { ...target, stateVersion: version } }
    }
    if (route === '/learner/preferences' && method === 'GET') return { data: { ...preferences, stateVersion: version } }
    if (route === '/learner/preferences' && method === 'PATCH') {
      assert.equal(options.data.expectedStateVersion, version)
      preferenceWrites++
      preferences = { ...options.data }
      version++
      if (failAt === 'preferences' && failures++ === 0) throw new Error('response lost after preferences commit')
      return { data: { ...preferences, stateVersion: version } }
    }
    if (route === '/onboarding/options') return { data: { goals: [], dailyQuotaMinutes: [15] } }
    throw new Error(`unexpected request: ${method} ${path}`)
  }
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return { mobileApiClient: { request }, MobileApiError }
    if (name === '../stores/session') return { useSessionStore: () => ({ refreshSilently: async () => true }) }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return {
    api: module.exports.mobileLearnerContentApi,
    counts: () => ({ targetWrites, preferenceWrites }),
  }
}

const input = (clientEventId) => ({
  goal: 'ZERO_BASIS', quota: 15, birthYear: 1995,
  ageConfirmed: true, privacyConsent: true, termsConsent: true, clientEventId,
})

test('onboarding retry resumes after a committed target whose response was lost', async () => {
  const { api, counts } = adapter('target')
  await assert.rejects(api.saveOnboarding(input('first')), /response lost/)
  const saved = await api.saveOnboarding(input('retry'))
  assert.equal(saved.goal, 'ZERO_BASIS')
  assert.equal(saved.quota, 15)
  assert.deepEqual(counts(), { targetWrites: 1, preferenceWrites: 1 })
})

test('onboarding retry does not repeat an already committed preferences write', async () => {
  const { api, counts } = adapter('preferences')
  await assert.rejects(api.saveOnboarding(input('first')), /response lost/)
  const saved = await api.saveOnboarding(input('retry'))
  assert.equal(saved.goal, 'ZERO_BASIS')
  assert.deepEqual(counts(), { targetWrites: 1, preferenceWrites: 1 })
})
