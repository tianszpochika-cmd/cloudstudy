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

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

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

function environment({ unauthorizedHandler } = {}) {
  piniaPackage.setActivePinia(piniaPackage.createPinia())
  const storage = new Map()
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } }
  let accessToken = null
  let requestIdentity = null
  let requestRevision = 0
  let authSubject = null
  let refreshHandler = async () => ({ accessToken: `token-${authSubject}-refreshed` })
  let refreshCalls = 0
  const requests = []
  const runtime = {
    request(options) { requests.push(options) },
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  }
  const platform = { getUniRuntime: () => runtime, isNativeAppRuntime: () => false }
  const cache = { removeAllLearningCaches() {} }
  const sessionModule = load('src/stores/session.ts', {
    vue: vuePackage,
    pinia: piniaPackage,
    '../auth/access-token': {
      getInMemoryAccessToken: () => accessToken,
      setInMemoryAccessToken: (value) => { accessToken = value },
      setInMemoryRequestIdentity: (value, revision = requestRevision) => { requestIdentity = value ? { ...value } : null; requestRevision = revision },
    },
    '../auth/gateway-auth': { createGatewayMobileAuthAdapter: () => { throw new Error('A test auth adapter must be installed') }, safeMobileReturnTo: (value) => typeof value === 'string' ? value : '/pages/home/home' },
    '../platform/uni-runtime': platform,
    './learning-cache': cache,
  })
  const session = sessionModule.useSessionStore()
  const auth = {
    login: async ({ identifier }) => { authSubject = identifier; return { accessToken: `token-${identifier}` } },
    register: async ({ identifier }) => { authSubject = identifier; return { accessToken: `token-${identifier}` } },
    getPermissions: async () => ({ principal: { subject: authSubject, roles: [], permissions: [], adultGate: 'PASSED' }, adultGate: 'PASSED' }),
    refresh: async () => { refreshCalls += 1; return refreshHandler() },
    logout: async () => {},
    revoke: async () => {},
  }
  session.setAuthAdapter(auth)
  const apiModule = load('src/api/client.ts', {
    '../auth/access-token': { getInMemoryAuthRequestSnapshot: () => ({ accessToken, identity: requestIdentity ? { ...requestIdentity } : null, revision: requestRevision }) },
    '../platform/uni-runtime': platform,
    '../platform/gateway': { getGatewayBaseUrl: () => 'https://gateway.test' },
  })
  const refreshForIdentity = unauthorizedHandler ?? ((identity) => session.refreshSilentlyForIdentity(identity))
  const client = apiModule.createMobileApiClient('https://gateway.test', refreshForIdentity)
  return {
    apiModule,
    auth,
    client,
    get accessToken() { return accessToken },
    get refreshCalls() { return refreshCalls },
    get requestIdentity() { return requestIdentity },
    requests,
    session,
    setAuthSubject(value) { authSubject = value },
    setRefreshHandler(handler) { refreshHandler = handler },
    setRawToken(value) { accessToken = value },
  }
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.fail('Timed out waiting for the API client fixture')
}

function observe(promise) {
  return promise.then((value) => ({ value }), (error) => ({ error }))
}

function assertIdentityChanged(result) {
  assert.ok(result.error)
  assert.equal(result.error.status, 401)
  assert.equal(result.error.details.code, 'SESSION_IDENTITY_CHANGED')
}

test('a request with an access token but no verified identity fails before transport', async () => {
  const env = environment()
  env.setRawToken('orphan-token')
  const result = await observe(env.client.request('/protected/read', { timeout: 0 }))
  assertIdentityChanged(result)
  assert.equal(env.requests.length, 0)
  assert.equal(env.refreshCalls, 0)
})

test('caller-supplied authorization is stripped when there is no verified owner', async () => {
  const env = environment()
  const pending = observe(env.client.request('/public/catalog', { header: { authorization: 'Bearer stale-token' }, timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  assert.equal(Object.keys(env.requests[0].header).some((key) => key.toLowerCase() === 'authorization'), false)
  await env.requests[0].success({ statusCode: 200, data: { public: true } })
  assert.deepEqual((await pending).value, { public: true })
})

test('login keeps the new token unusable until permissions verify its owner', async () => {
  const env = environment()
  const permissions = deferred()
  env.auth.getPermissions = () => permissions.promise
  const loggingIn = env.session.login('A', 'fixture')
  await waitFor(() => env.accessToken === 'token-A')
  assert.equal(env.requestIdentity, null)
  const duringLogin = await observe(env.client.request('/protected/during-login', { timeout: 0 }))
  assertIdentityChanged(duringLogin)
  assert.equal(env.requests.length, 0)

  permissions.resolve({ principal: { subject: 'A', roles: [], permissions: [], adultGate: 'PASSED' }, adultGate: 'PASSED' })
  assert.equal(await loggingIn, true)
  assert.deepEqual(env.requestIdentity, { subject: 'A', revision: env.session.identityRevision })
})

test('restore publishes the verified owner snapshot before protected requests use the restored token', async () => {
  const env = environment()
  env.setRawToken('stale-restoring-token')
  env.setAuthSubject('A')
  env.auth.restoreSession = async () => ({ tokenPair: { accessToken: 'token-A-restored' } })
  const permissions = deferred()
  env.auth.getPermissions = () => permissions.promise
  const restoring = env.session.restore()
  await waitFor(() => env.accessToken === 'token-A-restored')
  assert.equal(env.requestIdentity, null)
  const duringRestore = await observe(env.client.request('/protected/during-restore', { timeout: 0 }))
  assertIdentityChanged(duringRestore)
  assert.equal(env.requests.length, 0)
  permissions.resolve({ principal: { subject: 'A', roles: [], permissions: [], adultGate: 'PASSED' }, adultGate: 'PASSED' })
  await restoring
  assert.deepEqual(env.requestIdentity, { subject: 'A', revision: env.session.identityRevision })
  const pending = observe(env.client.request('/gamification/me/rewards', { timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  assert.equal(env.requests[0].header.Authorization, 'Bearer token-A-restored')
  await env.requests[0].success({ statusCode: 200, data: { owner: 'A' } })
  assert.deepEqual((await pending).value, { owner: 'A' })
})

test('a switch between auth snapshot and transport dispatch cancels the old-owner request', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  let switched = false
  const header = Object.defineProperty({}, 'x-fixture', {
    enumerable: true,
    get() {
      if (!switched) {
        switched = true
        void env.session.login('B', 'fixture')
      }
      return 'value'
    },
  })
  const pending = observe(env.client.request('/protected/read', { header, timeout: 0 }))
  assertIdentityChanged(await pending)
  await waitFor(() => env.accessToken === 'token-B')
  assert.equal(env.requests.length, 0)
  assert.equal(env.requestIdentity.subject, 'B')
})

test('an A 401 arriving after B login is rejected before refresh or retry', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  const pending = observe(env.client.request('/gamification/me/rewards', { method: 'POST', data: { command: 'CLAIM' }, timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  const first = env.requests[0]
  assert.equal(first.header.Authorization, 'Bearer token-A')
  assert.equal(await env.session.login('B', 'fixture'), true)
  await first.success({ statusCode: 401, data: { code: 'expired' } })
  assertIdentityChanged(await pending)
  assert.equal(env.refreshCalls, 0)
  assert.equal(env.requests.length, 1)
  assert.equal(env.accessToken, 'token-B')
})

test('an A refresh already in flight cannot retry after a delayed switch to B', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  const delayedRefresh = deferred()
  env.setRefreshHandler(() => delayedRefresh.promise)
  const pending = observe(env.client.request('/protected/write', { method: 'POST', data: { value: 'A' }, timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  const refreshHandling = env.requests[0].success({ statusCode: 401, data: { code: 'expired' } })
  await waitFor(() => env.refreshCalls === 1)
  assert.equal(await env.session.login('B', 'fixture'), true)
  delayedRefresh.resolve({ accessToken: 'late-token-A' })
  await refreshHandling
  const result = await pending
  assert.ok(result.error)
  assert.equal(result.error.status, 401)
  assert.equal(env.requests.length, 1)
  assert.equal(env.accessToken, 'token-B')
  assert.equal(env.requestIdentity.subject, 'B')
})

test('late A read and write responses are withheld from B and do not trigger B error routing', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  let globalAuthErrors = 0
  env.apiModule.setMobileApiErrorHandler(() => { globalAuthErrors += 1 })
  const read = observe(env.client.request('/gamification/me/rewards', { method: 'GET', timeout: 0 }))
  const write = observe(env.client.request('/gamification/me/rewards/grant-1/claim', { method: 'POST', data: { command: 'CLAIM' }, timeout: 0 }))
  await waitFor(() => env.requests.length === 2)
  assert.ok(env.requests.every((request) => request.header.Authorization === 'Bearer token-A'))
  assert.equal(await env.session.login('B', 'fixture'), true)
  await env.requests[0].success({ statusCode: 200, data: { owner: 'A', grantId: 'A-grant' } })
  await env.requests[1].success({ statusCode: 403, data: { owner: 'A', message: 'forbidden' } })
  assertIdentityChanged(await read)
  assertIdentityChanged(await write)
  assert.equal(globalAuthErrors, 0)
  assert.equal(env.requests.length, 2)
  assert.equal(env.accessToken, 'token-B')
})

test('same-owner 401 refresh retries with the refreshed A token and original request', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  const pending = observe(env.client.request('/gamification/me/rewards/grant-1/claim', { method: 'POST', data: { command: 'CLAIM' }, timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  const first = env.requests[0]
  const refreshHandling = first.success({ statusCode: 401, data: { code: 'expired' } })
  await waitFor(() => env.requests.length === 2)
  const retry = env.requests[1]
  assert.equal(retry.header.Authorization, 'Bearer token-A-refreshed')
  assert.equal(retry.method, 'POST')
  assert.deepEqual(retry.data, { command: 'CLAIM' })
  await retry.success({ statusCode: 200, data: { owner: 'A', claimed: true } })
  await refreshHandling
  assert.deepEqual((await pending).value, { owner: 'A', claimed: true })
  assert.equal(env.refreshCalls, 1)
  assert.equal(env.requests.length, 2)
})

test('refresh clears the request owner until refreshed permissions verify the token owner', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  const permissions = deferred()
  let permissionCalls = 0
  env.auth.getPermissions = async () => {
    permissionCalls += 1
    return permissions.promise
  }

  const pending = observe(env.client.request('/protected/read', { timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  const refreshHandling = env.requests[0].success({ statusCode: 401, data: { code: 'expired' } })
  await waitFor(() => env.refreshCalls === 1 && env.accessToken === 'token-A-refreshed')

  assert.equal(permissionCalls, 1)
  assert.equal(env.requestIdentity, null)
  const duringVerification = await observe(env.client.request('/protected/while-refreshing', { timeout: 0 }))
  assertIdentityChanged(duringVerification)
  assert.equal(env.requests.length, 1)

  permissions.resolve({ principal: { subject: 'A', roles: [], permissions: [], adultGate: 'PASSED' }, adultGate: 'PASSED' })
  await waitFor(() => env.requests.length === 2)
  assert.deepEqual(env.requestIdentity, { subject: 'A', revision: env.session.identityRevision })
  assert.equal(env.requests[1].header.Authorization, 'Bearer token-A-refreshed')
  await env.requests[1].success({ statusCode: 200, data: { owner: 'A' } })
  await refreshHandling
  assert.deepEqual((await pending).value, { owner: 'A' })
  assert.equal(env.requests.length, 2)
})

test('logout removes the in-memory owner snapshot before protected calls can use the old token', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  assert.equal(env.requestIdentity.subject, 'A')
  const logout = env.session.logout()
  assert.equal(env.requestIdentity, null)
  const duringLogout = await observe(env.client.request('/protected/read', { timeout: 0 }))
  assertIdentityChanged(duringLogout)
  assert.equal(env.requests.length, 0)
  await logout
  assert.equal(env.accessToken, null)
  assert.equal(env.requestIdentity, null)
})

test('identity is checked again after refresh before a retry can use the global token', async () => {
  let env
  env = environment({ unauthorizedHandler: async (identity) => {
    const refreshed = await env.session.refreshSilentlyForIdentity(identity)
    assert.equal(refreshed, true)
    assert.equal(await env.session.login('B', 'fixture'), true)
    return true
  } })
  assert.equal(await env.session.login('A', 'fixture'), true)
  const pending = observe(env.client.request('/protected/write', { method: 'POST', data: { owner: 'A' }, timeout: 0 }))
  await waitFor(() => env.requests.length === 1)
  const refreshHandling = env.requests[0].success({ statusCode: 401, data: { code: 'expired' } })
  await refreshHandling
  assertIdentityChanged(await pending)
  assert.equal(env.requests.length, 1)
  assert.equal(env.accessToken, 'token-B')
})

test('session refuses to refresh for an obsolete identity snapshot', async () => {
  const env = environment()
  assert.equal(await env.session.login('A', 'fixture'), true)
  const oldIdentity = env.session.getMobileApiIdentity()
  assert.equal(await env.session.login('B', 'fixture'), true)
  assert.equal(await env.session.refreshSilentlyForIdentity(oldIdentity), false)
  assert.equal(env.refreshCalls, 0)
  assert.equal(env.session.getMobileApiIdentity().subject, 'B')
})
