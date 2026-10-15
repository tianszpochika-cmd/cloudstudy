import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const appRoot = path.resolve(import.meta.dirname, '..')
const piniaPackage = require('pinia')
const vuePackage = require('vue')

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

function environment() {
  piniaPackage.setActivePinia(piniaPackage.createPinia())
  const storage = new Map()
  const cacheWipes = { count: 0 }
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } }
  const requests = []
  const runtime = {
    request(options) { requests.push(options) },
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  }
  const platform = { getUniRuntime: () => runtime, isNativeAppRuntime: () => false }
  const accessTokens = load('src/auth/access-token.ts', {})
  const gateway = {
    getGatewayBaseUrl: () => 'https://gateway.test',
    getIamAuthBaseUrl: () => 'https://iam.example.test/api/v1',
    requireIamAuthBaseUrl: (value) => {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.pathname.replace(/\/+$/, '') !== '/api/v1') {
        throw new Error('账号密码只能提交到 IAM 的 HTTPS 认证入口。')
      }
      return `${url.origin}/api/v1`
    },
    safeInternalReturnTo: (value, fallback) => typeof value === 'string' ? value : fallback,
  }
  const api = load('src/api/client.ts', {
    '../auth/access-token': accessTokens,
    '../platform/uni-runtime': platform,
    '../platform/gateway': gateway,
  })
  const auth = load('src/auth/gateway-auth.ts', {
    '../api/client': api,
    '../platform/gateway': gateway,
  })
  const sessionModule = load('src/stores/session.ts', {
    vue: vuePackage,
    pinia: piniaPackage,
    '../auth/access-token': accessTokens,
    '../auth/gateway-auth': auth,
    '../platform/uni-runtime': platform,
    '../auth/auth-failure-copy': { mobileAuthFailureMarker: () => 'failed' },
    './learning-cache': { removeAllLearningCaches() { cacheWipes.count += 1 } },
  })
  return {
    accessTokens,
    api,
    auth,
    requests,
    storage,
    cacheWipes,
    session: sessionModule.useSessionStore(),
  }
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.fail('Timed out waiting for real gateway-auth request')
}

const completedRequests = new WeakSet()

function requestAt(env, suffix, from = 0) {
  return env.requests.slice(from).reverse().find((request) => {
    const path = new URL(request.url).pathname
    return !completedRequests.has(request) && (path === suffix || path === `/api/v1${suffix}`)
  })
}

test('device management remains reachable with an authenticated IAM session before learning consent', async () => {
  const opened = []
  let preferenceReads = 0
  const session = { isAuthenticated: true, isLearningReady: false, restore: async () => {}, setReturnTo: () => {} }
  const navigation = load('src/auth/navigation.ts', {
    '../api/client': { setMobileApiErrorHandler: () => {} },
    './gateway-auth': { safeMobileReturnTo: (value) => value },
    '../platform/uni-runtime': {
      getUniRuntime: () => { throw new Error('Device route must not redirect to onboarding') },
      openUniPage: (path) => opened.push(path),
    },
    '../stores/pinia': { pinia: {} },
    '../stores/learner-content': { useLearnerContentStore: () => ({ loadAccount: async () => { preferenceReads += 1 } }) },
    '../stores/session': { useSessionStore: () => session },
    '../domain/onboarding-resume': load('src/domain/onboarding-resume.ts', {}),
  })
  assert.equal(navigation.isMobileLearningPath('/pages/devices/devices'), false)
  assert.equal(navigation.isMobileLearningPath('/pages/home/home'), true)
  assert.equal(await navigation.ensureMobilePageAccess('/pages/devices/devices'), true)
  await navigation.continueAfterLogin('/pages/devices/devices')
  assert.deepEqual(opened, ['/pages/devices/devices'])
  assert.equal(preferenceReads, 0)
})

async function completeRequest(request, statusCode, data = {}) {
  assert.ok(request)
  assert.equal(completedRequests.has(request), false, 'A completed request cannot answer a later bootstrap read')
  completedRequests.add(request)
  await request.success({ statusCode, data })
}

const fixtureSubject = (subject) => ({ A: '00000000-0000-4000-8000-00000000000a', B: '00000000-0000-4000-8000-00000000000b' })[subject]
const principal = (subject) => ({
  principalId: fixtureSubject(subject),
  tenantId: 'fixture-platform',
  sessionId: '00000000-0000-4000-8000-000000000010',
  deviceId: '00000000-0000-4000-8000-000000000020',
  roles: ['learner'],
  permissions: ['learning.plan.read'],
  authMode: 'self-owned-jwt',
  status: 'ACTIVE',
  adultGate: {
    status: 'PASSED', learningAccess: 'ELIGIBLE', effectiveAt: '2026-10-15T00:00:00Z',
    policyVersion: 'b30-adult-v1', minimumAge: 18, evidenceStatus: 'SERVER_VERIFIED', retryAllowed: false,
  },
  policyVersion: 'fixture-policy-v1',
})

async function restoredOwnerA() {
  const env = environment()
  env.accessTokens.setInMemoryAccessToken('token-restored-A')
  const restoring = env.session.restore()
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  await restoring
  assert.equal(env.session.restored, true)
  assert.equal(env.session.isAuthenticated, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('A'))
  return env
}

function observeRestore(env) {
  const observed = { completed: false, promise: null }
  observed.promise = env.session.restore().then(() => { observed.completed = true })
  return observed
}

async function assertRestorePending(env, observed) {
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(observed.completed, false, 'restore must wait for the current refresh verdict')
  assert.equal(env.session.status, 'refreshing')
  assert.equal(env.session.isAuthenticated, false, 'refreshing is not an authenticated grant')
  assert.equal(env.session.isLearningReady, false)
  const refreshRequests = env.requests.filter((request) => ['/auth/token/refresh', '/api/v1/auth/token/refresh'].includes(new URL(request.url).pathname))
  assert.equal(refreshRequests.length, 1, 'restore must reuse the pending refresh')
}

test('restored owner restore waits through refresh 200 until canonical principal verification', async () => {
  const env = await restoredOwnerA()
  const ownerIdentity = env.session.getMobileApiIdentity()
  const refreshing = env.session.refreshSilently()
  await waitFor(() => env.requests.length === 3)
  const first = observeRestore(env)
  const second = observeRestore(env)
  await assertRestorePending(env, first)
  assert.equal(second.completed, false)
  assert.equal(env.requests.length, 3)

  await completeRequest(requestAt(env, '/auth/token/refresh'), 200, { accessToken: 'token-A-refreshed' })
  await waitFor(() => env.requests.length === 4)
  const canonicalPrincipal = requestAt(env, '/iam/principal/me')
  assert.equal(canonicalPrincipal.header.Authorization, 'Bearer token-A-refreshed')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await assertRestorePending(env, first)
  assert.equal(second.completed, false)

  await completeRequest(canonicalPrincipal, 200, principal('A'))
  assert.equal(await refreshing, true)
  await Promise.all([first.promise, second.promise])
  assert.equal(first.completed, true)
  assert.equal(second.completed, true)
  assert.equal(env.session.isAuthenticated, true)
  assert.equal(env.session.isLearningReady, true)
  assert.deepEqual(env.session.getMobileApiIdentity(), ownerIdentity)
  assert.deepEqual(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, ownerIdentity)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, 'token-A-refreshed')
  assert.equal(env.requests.length, 4)
})

for (const stage of ['refresh', 'canonical principal']) {
  test(`restored owner restore waits for ${stage} 401 and stays unauthenticated`, async () => {
    const env = await restoredOwnerA()
    const refreshing = env.session.refreshSilently()
    await waitFor(() => env.requests.length === 3)
    const observed = observeRestore(env)
    await assertRestorePending(env, observed)
    let rejectedRequest = requestAt(env, '/auth/token/refresh')
    if (stage === 'canonical principal') {
      await completeRequest(rejectedRequest, 200, { accessToken: 'token-A-refreshed' })
      await waitFor(() => env.requests.length === 4)
      rejectedRequest = requestAt(env, '/iam/principal/me')
      assert.equal(rejectedRequest.header.Authorization, 'Bearer token-A-refreshed')
      await assertRestorePending(env, observed)
    }
    await completeRequest(rejectedRequest, 401, { code: 'fixture.session.expired' })
    assert.equal(await refreshing, false)
    await observed.promise
    assert.equal(observed.completed, true)
    assert.equal(env.session.status, 'unauthenticated')
    assert.equal(env.session.isAuthenticated, false)
    assert.equal(env.session.isLearningReady, false)
    assert.equal(env.session.verifiedSubject, null)
    assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, null)
    assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
    assert.equal(env.requests.length, stage === 'refresh' ? 3 : 4)
  })
}

test('a late refreshed A principal cannot replace B after logout while restore waits', async () => {
  const env = await restoredOwnerA()
  const refreshingA = env.session.refreshSilently()
  await waitFor(() => env.requests.length === 3)
  await completeRequest(requestAt(env, '/auth/token/refresh'), 200, { accessToken: 'token-A-refreshed' })
  await waitFor(() => env.requests.length === 4)
  const latePrincipalA = requestAt(env, '/iam/principal/me')
  const observed = observeRestore(env)
  await assertRestorePending(env, observed)

  const loggingOut = env.session.logout()
  await waitFor(() => env.requests.length === 5)
  const logoutRequest = requestAt(env, '/auth/logout')
  assert.equal(logoutRequest.header.Authorization, 'Bearer token-A-refreshed')
  await completeRequest(logoutRequest, 204)
  assert.equal(await loggingOut, true)
  assert.equal(env.session.verifiedSubject, null)

  const loginB = env.session.login('B', 'fixture-password')
  await waitFor(() => env.requests.length === 6)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-B', sessionId: 'session-B' })
  await waitFor(() => env.requests.length === 7)
  const principalB = requestAt(env, '/iam/principal/me')
  assert.equal(principalB.header.Authorization, 'Bearer token-B')
  await completeRequest(principalB, 200, principal('B'))
  assert.equal(await loginB, true)
  const ownerB = env.session.getMobileApiIdentity()
  const cacheWipesAfterB = env.cacheWipes.count
  assert.equal(env.session.verifiedSubject, fixtureSubject('B'))
  assert.equal(observed.completed, false)

  await completeRequest(latePrincipalA, 200, principal('A'))
  assert.equal(await refreshingA, false)
  await observed.promise
  assert.equal(env.session.isAuthenticated, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('B'))
  assert.deepEqual(env.session.getMobileApiIdentity(), ownerB)
  assert.deepEqual(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, ownerB)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, 'token-B')
  assert.equal(env.cacheWipes.count, cacheWipesAfterB)
  assert.equal(env.requests.length, 7)
})

test('real login adapter bootstraps permissions with its new token, then binds the verified owner', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  const loginRequest = requestAt(env, '/auth/login')
  assert.equal(loginRequest.method, 'POST')
  assert.equal(new URL(loginRequest.url).origin, 'https://iam.example.test')
  assert.equal(loginRequest.header.Authorization, undefined)
  await completeRequest(loginRequest, 200, { accessToken: 'token-A', sessionId: 'session-A' })

  await waitFor(() => Boolean(requestAt(env, '/iam/principal/me')))
  const permissionRequest = requestAt(env, '/iam/principal/me')
  assert.equal(new URL(permissionRequest.url).origin, 'https://gateway.test')
  assert.equal(permissionRequest.header.Authorization, 'Bearer token-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionRequest, 200, principal('A'))

  assert.equal(await login, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('A'))
  assert.equal(env.session.adultLearningAccess, 'ELIGIBLE')
  assert.equal(env.session.isLearningReady, true)
  assert.deepEqual(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, env.session.getMobileApiIdentity())
  assert.equal(env.requests.length, 2)
})

test('real restore adapter reads principal and permissions through the unverified-owner bootstrap', async () => {
  const env = environment()
  env.accessTokens.setInMemoryAccessToken('token-restored-A')
  const restoring = env.session.restore()
  await waitFor(() => env.requests.length === 1)

  const principalRequest = requestAt(env, '/iam/principal/me')
  assert.equal(principalRequest.header.Authorization, 'Bearer token-restored-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(principalRequest, 200, principal('A'))

  await waitFor(() => env.requests.length === 2)
  const permissionRequest = requestAt(env, '/iam/principal/me')
  assert.equal(permissionRequest.header.Authorization, 'Bearer token-restored-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionRequest, 200, principal('A'))

  await restoring
  assert.equal(env.session.isAuthenticated, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('A'))
  assert.equal(env.requests.length, 2)
})

test('real refresh adapter verifies permissions after replacing the token', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  assert.equal(await login, true)
  const verifiedIdentity = env.session.getMobileApiIdentity()

  const refreshing = env.session.refreshSilently()
  await waitFor(() => env.requests.length === 3)
  const refreshRequest = requestAt(env, '/auth/token/refresh')
  assert.equal(refreshRequest.method, 'POST')
  assert.equal(new URL(refreshRequest.url).origin, 'https://iam.example.test')
  assert.equal(refreshRequest.header.Authorization, undefined, 'IAM refresh uses the Secure cookie and must not attach the access token')
  assert.equal(refreshRequest.withCredentials, true)
  await completeRequest(refreshRequest, 200, { accessToken: 'token-A-refreshed' })

  await waitFor(() => env.requests.length === 4)
  const permissionsRequest = env.requests[3]
  assert.equal(new URL(permissionsRequest.url).pathname, '/iam/principal/me')
  assert.equal(permissionsRequest.header.Authorization, 'Bearer token-A-refreshed')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionsRequest, 200, principal('A'))

  assert.equal(await refreshing, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('A'))
  assert.deepEqual(env.session.getMobileApiIdentity(), verifiedIdentity)
  assert.deepEqual(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, verifiedIdentity)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, 'token-A-refreshed')
})

test('real refresh fails closed when verified A receives B permissions, before applying snapshot tokens', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  assert.equal(await login, true)

  const refreshing = env.session.refreshSilently()
  await waitFor(() => env.requests.length === 3)
  const refreshRequest = requestAt(env, '/auth/token/refresh')
  assert.equal(new URL(refreshRequest.url).origin, 'https://iam.example.test')
  assert.equal(refreshRequest.header.Authorization, undefined, 'IAM refresh uses the Secure cookie and must not attach the access token')
  await completeRequest(refreshRequest, 200, { accessToken: 'token-A-refreshed', sessionId: 'session-A' })

  await waitFor(() => env.requests.length === 4)
  const permissionsRequest = env.requests[3]
  assert.equal(new URL(permissionsRequest.url).pathname, '/iam/principal/me')
  assert.equal(permissionsRequest.header.Authorization, 'Bearer token-A-refreshed')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionsRequest, 200, {
    ...principal('B'),
    accessToken: 'snapshot-token-B',
    sessionId: 'session-B',
  })

  assert.equal(await refreshing, false)
  assert.equal(env.session.verifiedSubject, null)
  assert.equal(env.session.isAuthenticated, false)
  assert.equal(env.session.status, 'unauthenticated')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, null)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  assert.equal(env.requests.length, 4)
})

test('explicit login from verified A to B succeeds as an intentional account switch', async () => {
  const env = environment()
  const loginA = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  assert.equal(await loginA, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('A'))

  const loginB = env.session.login('B', 'fixture-password')
  assert.equal(env.session.verifiedSubject, null)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await waitFor(() => env.requests.length === 3)
  const loginRequestB = requestAt(env, '/auth/login', 2)
  await completeRequest(loginRequestB, 200, { accessToken: 'token-B', sessionId: 'session-B' })
  await waitFor(() => env.requests.length === 4)
  const permissionsRequestB = env.requests[3]
  assert.equal(new URL(permissionsRequestB.url).pathname, '/iam/principal/me')
  assert.equal(permissionsRequestB.header.Authorization, 'Bearer token-B')
  await completeRequest(permissionsRequestB, 200, principal('B'))

  assert.equal(await loginB, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('B'))
  assert.equal(env.session.isAuthenticated, true)
  assert.deepEqual(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, env.session.getMobileApiIdentity())
  assert.equal(env.requests.length, 4)
})

test('real logout adapter can revoke the old token only on its exact route after owner invalidation', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  assert.equal(await login, true)

  const loggingOut = env.session.logout()
  await waitFor(() => env.requests.length === 3)
  const logoutRequest = requestAt(env, '/auth/logout')
  assert.equal(logoutRequest.method, 'POST')
  assert.equal(logoutRequest.header.Authorization, 'Bearer token-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(logoutRequest, 204)

  assert.equal(await loggingOut, true)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, null)
  assert.equal(env.requests.length, 3)
})

test('real revoke adapter can revoke a session only on the session-specific route', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  assert.equal(await login, true)

  const revoking = env.session.revokeCurrentSession()
  await waitFor(() => env.requests.length === 3)
  const revokeRequest = requestAt(env, '/auth/sessions/session-A/revoke')
  assert.equal(revokeRequest.method, 'POST')
  assert.equal(revokeRequest.header.Authorization, 'Bearer token-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(revokeRequest, 204)

  assert.equal(await revoking, true)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, null)
  assert.equal(env.requests.length, 3)
})

test('a delayed A bootstrap response is rejected after B starts logging in', async () => {
  const env = environment()
  const loginA = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  const permissionsA = env.requests[1]
  assert.equal(new URL(permissionsA.url).pathname, '/iam/principal/me')
  assert.equal(permissionsA.header.Authorization, 'Bearer token-A')

  const loginB = env.session.login('B', 'fixture-password')
  await waitFor(() => env.requests.length === 3)
  await completeRequest(requestAt(env, '/auth/login', 2), 200, { accessToken: 'token-B', sessionId: 'session-B' })
  await waitFor(() => env.requests.length === 4)
  const permissionsB = env.requests[3]

  await completeRequest(permissionsA, 200, principal('A'))
  assert.equal(await loginA, false)
  assert.equal(env.session.verifiedSubject, null)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().accessToken, 'token-B')

  await completeRequest(permissionsB, 200, principal('B'))
  assert.equal(await loginB, true)
  assert.equal(env.session.verifiedSubject, fixtureSubject('B'))
  assert.equal(env.requests.length, 4)
})

test('bootstrap markers do not authorize arbitrary or method-mismatched routes', async () => {
  const env = environment()
  env.accessTokens.setInMemoryAccessToken('orphan-token')
  await assert.rejects(env.api.mobileApiClient.request('/business/write', { method: 'POST', skipAuthRetry: true, authBootstrap: 'identity', data: {} }), { status: 401 })
  await assert.rejects(env.api.mobileApiClient.request('/auth/logout-extra', { method: 'POST', skipAuthRetry: true, authBootstrap: 'logout', data: {} }), { status: 401 })
  await assert.rejects(env.api.mobileApiClient.request('/auth/logout', { method: 'POST', skipAuthRetry: false, authBootstrap: 'logout', data: {} }), { status: 401 })
  assert.equal(env.requests.length, 0)
})

test('real identity bootstrap does not refresh or replay after 401', async () => {
  const env = environment()
  env.accessTokens.setInMemoryAccessToken('expired-token')
  const permissions = env.auth.createGatewayMobileAuthAdapter().getPermissions()
  await waitFor(() => env.requests.length === 1)
  const request = requestAt(env, '/iam/principal/me')
  assert.equal(request.header.Authorization, 'Bearer expired-token')
  await completeRequest(request, 401, { code: 'expired' })
  assert.equal(await permissions, null)
  assert.equal(env.requests.length, 1)
})

test('H5 cookie restore keeps the subject-scoped placement checkpoint', async () => {
  const env = environment()
  const checkpoint = JSON.stringify({ subject: fixtureSubject('A'), placementSessionId: 'asess_keep' })
  env.storage.set('yx.auth.mobile.session-hint', '1')
  env.storage.set('yx.v2.learner-content.mobile.v1', checkpoint)
  const restoring = env.session.restore()
  await waitFor(() => Boolean(requestAt(env, '/auth/token/refresh')))
  assert.equal(env.cacheWipes.count, 0)
  const refreshRequest = requestAt(env, '/auth/token/refresh')
  await completeRequest(refreshRequest, 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/principal/me'), 200, principal('A'))
  await waitFor(() => env.requests.length === 3)
  const secondPermissions = env.requests[2]
  assert.equal(new URL(secondPermissions.url).pathname, '/iam/principal/me')
  await completeRequest(secondPermissions, 200, principal('A'))
  await restoring
  assert.equal(env.session.verifiedSubject, fixtureSubject('A'))
  assert.equal(env.session.isAuthenticated, true)
  assert.equal(env.cacheWipes.count, 0)
  assert.equal(env.storage.get('yx.v2.learner-content.mobile.v1'), checkpoint)
})

test('clear still deletes the subject-scoped learning cache', async () => {
  const env = environment()
  env.storage.set('yx.v2.learner-content.mobile.v1', '{"subject":"A","placementSessionId":"asess_keep"}')
  env.session.clear()
  assert.equal(env.cacheWipes.count, 1)
  assert.equal(env.session.verifiedSubject, null)
})
