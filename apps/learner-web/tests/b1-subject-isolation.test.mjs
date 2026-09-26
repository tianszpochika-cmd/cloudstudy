import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const requirePackage = createRequire(import.meta.url)
const { createPinia, setActivePinia } = requirePackage('pinia')
const vue = requirePackage('vue')
const root = resolve(import.meta.dirname, '..')
const key = 'yx.b1.learner-web.v1'

function moduleFrom(path, dependencies, substitutions = []) {
  let source = readFileSync(resolve(root, path), 'utf8')
  for (const [from, to] of substitutions) source = source.replaceAll(from, to)
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`unexpected dependency: ${name}`)
  }, module, module.exports)
  return module.exports
}

function memoryStorage() {
  const entries = new Map()
  return {
    getItem: name => entries.get(name) ?? null,
    setItem: (name, value) => entries.set(name, String(value)),
    removeItem: name => entries.delete(name),
  }
}

function fixture() {
  const localStorage = memoryStorage()
  const sessionStorage = memoryStorage()
  globalThis.window = {
    localStorage, sessionStorage,
    location: { pathname: '/home', search: '', hash: '' },
  }
  setActivePinia(createPinia())
  let token = null
  let account = 'A'
  let nextContinue = null
  let nextSave = null
  let nextHome = null
  let nextRefresh = null
  const domain = moduleFrom('src/domain/b1.ts', {})
  const access = {
    getInMemoryAccessToken: () => token,
    setInMemoryAccessToken: value => { token = value },
  }
  const router = { currentRoute: { value: { name: 'home' } }, replace: async () => {} }
  const sessionModule = moduleFrom('src/stores/session.ts', {
    vue, pinia: requirePackage('pinia'),
    '../auth/gateway-auth': { createGatewayAuthAdapter: () => { throw new Error('injected adapter required') }, safeReturnTo: () => '/home' },
    '../auth/access-token': access,
    '../api/client': { ApiError: class ApiError extends Error {} },
    '../platform/gateway': { getGatewayBaseUrl: () => 'http://127.0.0.1:18070' },
    '../domain/b1': domain,
    '../router': { router },
  })
  const api = {
    fetchContinueContext: async () => typeof nextContinue === 'function' ? nextContinue() : nextContinue,
    fetchHomeFeed: async () => typeof nextHome === 'function' ? nextHome() : nextHome,
    saveContinueContext: async () => { if (nextSave) return nextSave() },
  }
  const b1Module = moduleFrom('src/stores/b1.ts', {
    vue, pinia: requirePackage('pinia'),
    '../api/b1': api,
    './session': sessionModule,
    '../platform/client-id': { createClientId: () => 'test-device' },
    '../domain/b1': domain,
  }, [['import.meta.env.VITE_RUNTIME_MODE', "'local-real'"]])
  const adapter = {
    // The real IAM token response carries a bearer and session/device IDs,
    // while the verified subject arrives from the principal/permissions read.
    login: async () => ({ accessToken: `token-${account}` }),
    getPermissions: async () => ({ principal: { subject: account, roles: [], permissions: [], adultGate: 'PASSED' } }),
    refresh: async () => typeof nextRefresh === 'function'
      ? nextRefresh() : ({ accessToken: `token-${account}-refreshed` }),
    restoreSession: async () => ({ principal: { subject: account, roles: [], permissions: [], adultGate: 'PASSED' } }),
    logout: async () => {},
  }
  const session = sessionModule.useSessionStore()
  session.setAuthAdapter(adapter)
  const b1 = b1Module.useB1Store()
  return {
    session, b1, localStorage, domain,
    setAccount: value => { account = value },
    setContinue: value => { nextContinue = value },
    setSave: value => { nextSave = value },
    setHome: value => { nextHome = value },
    setRefresh: value => { nextRefresh = value },
    reload: async () => {
      setActivePinia(createPinia())
      const nextSession = sessionModule.useSessionStore()
      nextSession.setAuthAdapter(adapter)
      await nextSession.restore()
      const nextB1 = b1Module.useB1Store()
      nextB1.restore()
      return { session: nextSession, b1: nextB1 }
    },
  }
}

function checkpoint(moduleId) {
  return {
    moduleId, moduleLabel: moduleId, lessonId: 'lesson', lessonTitle: moduleId,
    stepIndex: 1, totalSteps: 2, elapsedTimeMs: 1000,
    updatedAt: '2026-09-23T00:00:00Z', status: 'ACTIVE',
  }
}

test('A to B drops live and persisted onboarding, assessment, home and checkpoint', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.b1.restore()
  f.b1.setConsent({ birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  f.b1.assessment.answers.push({ questionId: 'private-A' })
  f.b1.continueContext = checkpoint('private-A')
  f.b1.persist()
  assert.equal(JSON.parse(f.localStorage.getItem(key)).subject, 'A')
  assert.equal(Object.hasOwn(JSON.parse(f.localStorage.getItem(key)), 'continueContext'), false)

  f.setAccount('B')
  assert.equal(await f.session.login('B', 'pw'), true)
  assert.equal(f.b1.onboarding.ageConfirmed, false)
  assert.equal(f.b1.assessment.answers.length, 0)
  assert.equal(f.b1.continueContext, null)
  assert.equal(f.b1.home, null)
  assert.equal(f.localStorage.getItem(key), null)
  f.b1.restore()
  assert.equal(f.b1.assessment.answers.length, 0)
  f.b1.setConsent({ birthYear: 1998, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  assert.equal(JSON.parse(f.localStorage.getItem(key)).subject, 'B')
  assert.equal(JSON.stringify(JSON.parse(f.localStorage.getItem(key))).includes('private-A'), false)
})

test('logout clears local and live B1 state; legacy unbound snapshot is discarded', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.b1.setConsent({ birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  f.b1.continueContext = checkpoint('private-A')
  assert.equal(await f.session.logout(), true)
  assert.equal(f.localStorage.getItem(key), null)
  assert.equal(f.b1.onboarding.ageConfirmed, false)
  assert.equal(f.b1.continueContext, null)

  f.localStorage.setItem(key, JSON.stringify({ onboarding: { ageConfirmed: true } }))
  assert.equal(await f.session.login('A', 'pw'), true)
  f.b1.restore()
  assert.equal(f.b1.onboarding.ageConfirmed, false)
  assert.equal(f.localStorage.getItem(key), null)
})

test('same verified subject restores scoped draft and survives token refresh', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.b1.setConsent({ birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  f.b1.assessment.answers.push({ questionId: 'private-A' })
  f.b1.persist()
  assert.equal(await f.session.refreshSilently(), true)
  assert.equal(f.b1.onboarding.ageConfirmed, true)
  assert.equal(f.b1.assessment.answers[0].questionId, 'private-A')
  assert.equal(JSON.parse(f.localStorage.getItem(key)).subject, 'A')
  // A fresh Pinia store models a browser reload with the same verified account.
  const reloaded = await f.reload()
  assert.equal(reloaded.b1.onboarding.ageConfirmed, true)
  assert.equal(reloaded.b1.assessment.answers[0].questionId, 'private-A')
  assert.equal(reloaded.b1.continueContext, null)
})

test('a new browser session for B rejects an A snapshot left on disk', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.b1.setConsent({ birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  f.b1.assessment.answers.push({ questionId: 'private-A' })
  f.b1.persist()
  f.setAccount('B')
  const reloaded = await f.reload()
  assert.equal(reloaded.session.principal.subject, 'B')
  assert.equal(reloaded.b1.onboarding.ageConfirmed, false)
  assert.equal(reloaded.b1.assessment.answers.length, 0)
  assert.equal(f.localStorage.getItem(key), null)
})

test('refresh whose verified principal changes fails closed and erases A state', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.b1.setConsent({ birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true })
  f.setAccount('B')
  assert.equal(await f.session.refreshSilently(), false)
  assert.equal(f.session.isAuthenticated, false)
  assert.equal(f.session.lastError, '认证主体不一致，请重新登录。')
  assert.equal(f.b1.onboarding.ageConfirmed, false)
  assert.equal(f.localStorage.getItem(key), null)
})

test('null or failed owner lookup clears a previously displayed checkpoint', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.setContinue(checkpoint('owner-A'))
  await f.b1.loadContinueContext()
  assert.equal(f.b1.continueContext.moduleId, 'owner-A')
  f.setContinue(null)
  await f.b1.loadContinueContext()
  assert.equal(f.b1.continueContext, null)
  f.setContinue(checkpoint('owner-A'))
  await f.b1.loadContinueContext()
  f.setContinue(() => { throw new Error('HTTP 503') })
  await f.b1.loadContinueContext()
  assert.equal(f.b1.continueContext, null)
  assert.equal(f.b1.lastError, 'HTTP 503')
})

test('late A owner response cannot repopulate B after identity switch', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  let resolveA
  f.setContinue(() => new Promise(resolve => { resolveA = resolve }))
  const pending = f.b1.loadContinueContext()
  f.setAccount('B')
  assert.equal(await f.session.login('B', 'pw'), true)
  resolveA(checkpoint('owner-A'))
  await pending
  assert.equal(f.b1.continueContext, null)
  assert.equal(f.localStorage.getItem(key), null)
})

test('failed owner checkpoint write does not masquerade as a saved local checkpoint', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  f.setContinue(checkpoint('owner-A'))
  await f.b1.loadContinueContext()
  f.setSave(() => { throw new Error('HTTP 503') })
  await f.b1.updateContinueContext({ moduleId: 'unsaved-A', lessonId: 'unsaved-lesson' })
  assert.equal(f.b1.continueContext, null)
  assert.equal(f.b1.lastError, 'HTTP 503')
  assert.equal(Object.hasOwn(JSON.parse(f.localStorage.getItem(key)), 'continueContext'), false)
})

test('late home response from a prior A session cannot overwrite a new A session', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  let resolveOldHome
  f.setHome(() => new Promise(resolve => { resolveOldHome = resolve }))
  const oldRequest = f.b1.loadHome()
  const oldGeneration = f.session.authGeneration

  assert.equal(await f.session.logout(), true)
  assert.equal(await f.session.login('A', 'pw'), true)
  assert.notEqual(f.session.authGeneration, oldGeneration)
  f.setHome({ dailyStream: { completedMinutes: 3, targetMinutes: 30 } })
  await f.b1.loadHome()
  assert.equal(f.b1.home.dailyStream.completedMinutes, 3)

  resolveOldHome({ dailyStream: { completedMinutes: 29, targetMinutes: 30 } })
  await oldRequest
  assert.equal(f.b1.home.dailyStream.completedMinutes, 3)
})

test('a refresh resolved after logout cannot restore an exited session', async () => {
  const f = fixture()
  assert.equal(await f.session.login('A', 'pw'), true)
  let resolveRefresh
  f.setRefresh(() => new Promise(resolve => { resolveRefresh = resolve }))
  const pendingRefresh = f.session.refreshSilently()
  assert.equal(await f.session.logout(), true)

  resolveRefresh({ accessToken: 'late-token-A' })
  assert.equal(await pendingRefresh, false)
  assert.equal(f.session.isAuthenticated, false)
  assert.equal(f.session.principal, null)
  assert.equal(f.localStorage.getItem('yx.auth.session-hint'), null)
})
