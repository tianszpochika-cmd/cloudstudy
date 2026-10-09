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
    './learning-cache': { removeAllLearningCaches() {} },
  })
  return {
    accessTokens,
    api,
    auth,
    requests,
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

function requestAt(env, suffix, from = 0) {
  return env.requests.slice(from).find((request) => new URL(request.url).pathname === suffix)
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
  await request.success({ statusCode, data })
}

const principal = (subject) => ({ subject, roles: [], permissions: [], adultGate: 'PASSED' })

test('real login adapter bootstraps permissions with its new token, then binds the verified owner', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  const loginRequest = requestAt(env, '/auth/login')
  assert.equal(loginRequest.method, 'POST')
  assert.equal(loginRequest.header.Authorization, undefined)
  await completeRequest(loginRequest, 200, { accessToken: 'token-A', sessionId: 'session-A' })

  await waitFor(() => Boolean(requestAt(env, '/iam/permissions')))
  const permissionRequest = requestAt(env, '/iam/permissions')
  assert.equal(permissionRequest.header.Authorization, 'Bearer token-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionRequest, 200, principal('A'))

  assert.equal(await login, true)
  assert.equal(env.session.verifiedSubject, 'A')
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
  const permissionRequest = requestAt(env, '/iam/permissions')
  assert.equal(permissionRequest.header.Authorization, 'Bearer token-restored-A')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionRequest, 200, principal('A'))

  await restoring
  assert.equal(env.session.isAuthenticated, true)
  assert.equal(env.session.verifiedSubject, 'A')
  assert.equal(env.requests.length, 2)
})

test('real refresh adapter verifies permissions after replacing the token', async () => {
  const env = environment()
  const login = env.session.login('A', 'fixture-password')
  await waitFor(() => env.requests.length === 1)
  await completeRequest(requestAt(env, '/auth/login'), 200, { accessToken: 'token-A', sessionId: 'session-A' })
  await waitFor(() => env.requests.length === 2)
  await completeRequest(requestAt(env, '/iam/permissions'), 200, principal('A'))
  assert.equal(await login, true)
  const verifiedIdentity = env.session.getMobileApiIdentity()

  const refreshing = env.session.refreshSilently()
  await waitFor(() => env.requests.length === 3)
  const refreshRequest = requestAt(env, '/auth/token/refresh')
  assert.equal(refreshRequest.method, 'POST')
  assert.equal(refreshRequest.header.Authorization, 'Bearer token-A')
  await completeRequest(refreshRequest, 200, { accessToken: 'token-A-refreshed' })

  await waitFor(() => env.requests.length === 4)
  const permissionsRequest = env.requests[3]
  assert.equal(new URL(permissionsRequest.url).pathname, '/iam/permissions')
  assert.equal(permissionsRequest.header.Authorization, 'Bearer token-A-refreshed')
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await completeRequest(permissionsRequest, 200, principal('A'))

  assert.equal(await refreshing, true)
  assert.equal(env.session.verifiedSubject, 'A')
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
  await completeRequest(requestAt(env, '/iam/permissions'), 200, principal('A'))
  assert.equal(await login, true)

  const refreshing = env.session.refreshSilently()
  await waitFor(() => env.requests.length === 3)
  const refreshRequest = requestAt(env, '/auth/token/refresh')
  assert.equal(refreshRequest.header.Authorization, 'Bearer token-A')
  await completeRequest(refreshRequest, 200, { accessToken: 'token-A-refreshed', sessionId: 'session-A' })

  await waitFor(() => env.requests.length === 4)
  const permissionsRequest = env.requests[3]
  assert.equal(new URL(permissionsRequest.url).pathname, '/iam/permissions')
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
  await completeRequest(requestAt(env, '/iam/permissions'), 200, principal('A'))
  assert.equal(await loginA, true)
  assert.equal(env.session.verifiedSubject, 'A')

  const loginB = env.session.login('B', 'fixture-password')
  assert.equal(env.session.verifiedSubject, null)
  assert.equal(env.accessTokens.getInMemoryAuthRequestSnapshot().identity, null)
  await waitFor(() => env.requests.length === 3)
  const loginRequestB = requestAt(env, '/auth/login', 2)
  await completeRequest(loginRequestB, 200, { accessToken: 'token-B', sessionId: 'session-B' })
  await waitFor(() => env.requests.length === 4)
  const permissionsRequestB = env.requests[3]
  assert.equal(new URL(permissionsRequestB.url).pathname, '/iam/permissions')
  assert.equal(permissionsRequestB.header.Authorization, 'Bearer token-B')
  await completeRequest(permissionsRequestB, 200, principal('B'))

  assert.equal(await loginB, true)
  assert.equal(env.session.verifiedSubject, 'B')
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
  await completeRequest(requestAt(env, '/iam/permissions'), 200, principal('A'))
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
  await completeRequest(requestAt(env, '/iam/permissions'), 200, principal('A'))
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
  assert.equal(new URL(permissionsA.url).pathname, '/iam/permissions')
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
  assert.equal(env.session.verifiedSubject, 'B')
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
  const request = requestAt(env, '/iam/permissions')
  assert.equal(request.header.Authorization, 'Bearer expired-token')
  await completeRequest(request, 401, { code: 'expired' })
  assert.equal(await permissions, null)
  assert.equal(env.requests.length, 1)
})
