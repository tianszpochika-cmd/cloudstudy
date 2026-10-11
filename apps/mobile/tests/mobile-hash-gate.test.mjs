import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function harness(session, content) {
  const opened = []
  const relaunched = []
  const listeners = {}
  const handlers = []
  globalThis.window = {
    location: { hash: '#/pages/settings/settings' },
    addEventListener(type, fn) { listeners[type] = fn },
  }
  const navigation = load('src/auth/navigation.ts', {
    '../api/client': { setMobileApiErrorHandler(handler) { handlers.push(handler) } },
    './gateway-auth': { safeMobileReturnTo: (value) => value },
    '../platform/uni-runtime': {
      getUniRuntime: () => ({
        reLaunch(options) { relaunched.push(options.url); return Promise.resolve() },
        navigateTo(options) { relaunched.push(options.url); return Promise.resolve() },
        addInterceptor() {},
      }),
      openUniPage: (path) => opened.push(path),
    },
    '../stores/pinia': { pinia: {} },
    '../stores/learner-content': { useLearnerContentStore: () => content },
    '../stores/session': { useSessionStore: () => session },
    '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
  })
  return { navigation, opened, relaunched, listeners, handlers }
}

const incomplete = {
  adultGate: 'PASSED',
  consent: { readable: true, accepted: false, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] },
  target: { readable: false, saved: false, goal: null, quota: null },
}

function session(extra) {
  return {
    isAuthenticated: true,
    isLearningReady: false,
    adultGate: 'PASSED',
    learningConsentWithdrawn: false,
    restore: async () => {},
    setReturnTo() {},
    refreshGateFromServer: async () => {},
    ...extra,
  }
}

test('a hash change after consent withdrawal opens the forbidden page without a reload', async () => {
  const refreshed = []
  const { navigation, opened, relaunched, listeners } = harness(session({
    learningConsentWithdrawn: true,
    refreshGateFromServer: async () => { refreshed.push('permissions') },
  }), { loadOnboardingResume: async () => incomplete })
  navigation.installMobileNavigationGuard()
  assert.equal(typeof listeners.hashchange, 'function')
  assert.equal(await navigation.revalidateMobileAccess('/pages/settings/settings'), true)
  window.location.hash = '#/pages/home/home'
  listeners.hashchange()
  for (let attempt = 0; attempt < 20 && opened.length === 0; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.deepEqual(refreshed, ['permissions', 'permissions'])
  assert.deepEqual(opened, ['/pages/forbidden/forbidden'])
  assert.deepEqual(relaunched, [])
})

test('a rejected minor stays on the forbidden page when only the hash changes', async () => {
  const { navigation, opened, relaunched } = harness(session({ adultGate: 'REJECTED' }), {
    loadOnboardingResume: async () => ({ ...incomplete, adultGate: 'REJECTED' }),
  })
  window.location.hash = '#/pages/home/home'
  assert.equal(await navigation.revalidateMobileAccess('/pages/home/home'), false)
  assert.deepEqual(opened, ['/pages/forbidden/forbidden'])
  assert.deepEqual(relaunched, [])
})

test('a revoked session after consent withdrawal stays on the forbidden page', async () => {
  const state = session({ learningConsentWithdrawn: true, clear() { state.learningConsentWithdrawn = true } })
  const { navigation, opened, relaunched, handlers } = harness(state, { loadOnboardingResume: async () => incomplete })
  navigation.installMobileNavigationGuard()
  window.location.hash = '#/pages/home/home'
  handlers[0](401, { error: { code: 'UNAUTHORIZED' } })
  assert.equal(state.learningConsentWithdrawn, true)
  handlers[0](403, { error: { code: 'CONSENT_REQUIRED' } })
  assert.deepEqual(opened, ['/pages/forbidden/forbidden', '/pages/forbidden/forbidden'])
  assert.deepEqual(relaunched, [])
})

test('a new adult who never consented is sent to onboarding, not the forbidden page', async () => {
  const { navigation, opened, relaunched } = harness(session(), {
    loadOnboardingResume: async () => incomplete,
  })
  window.location.hash = '#/pages/home/home'
  assert.equal(await navigation.revalidateMobileAccess('/pages/home/home'), false)
  assert.deepEqual(opened, [])
  assert.equal(relaunched[0].startsWith('/pages/onboarding/onboarding'), true)
})
