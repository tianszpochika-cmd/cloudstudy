import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  }
}

function requestPath(url) {
  const path = new URL(url).pathname
  return path.startsWith('/api/v1/') ? path.slice('/api/v1'.length) : path
}

function sessionSnapshot(session) {
  const subject = session.principal?.subject?.trim() || null
  const ready = session.status === 'authenticated' || session.status === 'refreshing'
  return {
    accessToken: session.accessToken,
    subject,
    generation: session.authGeneration,
    authenticated: Boolean(ready && session.accessToken && subject && (!session.userId || session.userId === subject)),
  }
}

function loadApiClient(session, fetchImpl, snapshotReader = () => sessionSnapshot(session)) {
  const source = fs.readFileSync(path.join(appRoot, 'src/api/client.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const previousFetch = globalThis.fetch
  const piniaModule = { pinia: {} }
  globalThis.fetch = fetchImpl
  try {
    new Function('require', 'module', 'exports', compiled)(name => {
      if (name === '../platform/gateway') return { getGatewayBaseUrl: () => 'https://gateway.example.test' }
      if (name === '../auth/access-token') return {
        getInMemoryAccessToken: () => session.accessToken,
        getInMemoryAuthSnapshot: snapshotReader,
        setInMemoryAccessToken: () => {},
      }
      if (name === '../stores/pinia') return piniaModule
      if (name === '../stores/session') return { useSessionStore: () => session }
      throw new Error(`unexpected dependency: ${name}`)
    }, module, module.exports)
  } finally {
    globalThis.fetch = previousFetch
  }
  return module.exports
}

function authenticatedSession() {
  const session = {
    accessToken: 'token-A-1',
    userId: 'A',
    principal: { subject: 'A' },
    status: 'authenticated',
    authGeneration: 7,
    refreshCalls: 0,
    forbiddenCalls: 0,
    refreshImpl: async () => false,
    async refreshSilently() { this.refreshCalls += 1; return this.refreshImpl() },
    async handleUnauthorized() {},
    async handleForbidden() { this.forbiddenCalls += 1 },
  }
  return session
}

function switchToB(session) {
  session.authGeneration += 1
  session.status = 'authenticated'
  session.accessToken = 'token-B-1'
  session.userId = 'B'
  session.principal = { subject: 'B' }
}

function fetchRecorder(firstResponse) {
  const started = deferred()
  const calls = []
  const fetchImpl = async (url, init) => {
    const headers = new Headers(init.headers)
    calls.push({
      url,
      method: init.method,
      authorization: headers.get('Authorization'),
      idempotencyKey: headers.get('Idempotency-Key'),
      body: init.body,
    })
    if (calls.length === 1) {
      started.resolve()
      return firstResponse.promise
    }
    return jsonResponse(200, { data: { owner: 'A', retried: true } })
  }
  return { calls, fetchImpl, started, firstResponse }
}

test('learner api client retries the same owner write with its refreshed token', async () => {
  const session = authenticatedSession()
  session.refreshImpl = async () => {
    session.status = 'refreshing'
    session.accessToken = 'token-A-2'
    session.status = 'authenticated'
    return true
  }
  const fetch = async (url, init) => {
    const headers = new Headers(init.headers)
    calls.push({ method: init.method, authorization: headers.get('Authorization'), key: headers.get('Idempotency-Key'), body: init.body })
    if (calls.length === 1) return jsonResponse(401, { code: 'TOKEN_EXPIRED' })
    return jsonResponse(200, { data: { owner: 'A', claimed: true } })
  }
  const calls = []
  const { apiClient } = loadApiClient(session, fetch)

  const result = await apiClient.post('/gamification/me/rewards/grant-A/claim', { commandCode: 'CLAIM' }, {
    headers: { 'Idempotency-Key': 'claim-A-once' },
  })

  assert.deepEqual(result, { data: { owner: 'A', claimed: true } })
  assert.equal(session.refreshCalls, 1)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].authorization, 'Bearer token-A-1')
  assert.equal(calls[1].authorization, 'Bearer token-A-2')
  assert.equal(calls[0].key, 'claim-A-once')
  assert.equal(calls[1].key, 'claim-A-once')
  assert.equal(calls[0].body, calls[1].body)
})

test('learner api client does not refresh or replay A 401 as B after a delayed response', async () => {
  const session = authenticatedSession()
  const firstResponse = deferred()
  const fetch = fetchRecorder(firstResponse)
  const { apiClient, ApiAuthContextChangedError } = loadApiClient(session, fetch.fetchImpl)

  const pending = apiClient.post('/protected/write', { owner: 'A' }).then(
    value => ({ value }),
    error => ({ error }),
  )
  await fetch.started.promise
  switchToB(session)
  fetch.firstResponse.resolve(jsonResponse(401, { code: 'TOKEN_EXPIRED' }))
  const outcome = await pending

  assert.ok(outcome.error instanceof ApiAuthContextChangedError)
  assert.equal(session.refreshCalls, 0, 'A response must not trigger a refresh for the current B session')
  assert.equal(fetch.calls.length, 1, 'the rejected A request must not be replayed with B credentials')
  assert.equal(fetch.calls[0].authorization, 'Bearer token-A-1')
})

test('learner api client rejects a switch during refresh before retrying with another account token', async () => {
  const session = authenticatedSession()
  const firstResponse = deferred()
  const refreshGate = deferred()
  const refreshStarted = deferred()
  session.refreshImpl = async () => {
    refreshStarted.resolve()
    return refreshGate.promise
  }
  const fetch = fetchRecorder(firstResponse)
  const { apiClient, ApiAuthContextChangedError } = loadApiClient(session, fetch.fetchImpl)

  const pending = apiClient.post('/protected/write', { owner: 'A' }).then(
    value => ({ value }),
    error => ({ error }),
  )
  await fetch.started.promise
  fetch.firstResponse.resolve(jsonResponse(401, { code: 'TOKEN_EXPIRED' }))
  await refreshStarted.promise
  switchToB(session)
  refreshGate.resolve(true)
  const outcome = await pending

  assert.ok(outcome.error instanceof ApiAuthContextChangedError)
  assert.equal(session.refreshCalls, 1)
  assert.equal(fetch.calls.length, 1, 'retry validation must stop before any B-token request is sent')
  assert.equal(fetch.calls[0].authorization, 'Bearer token-A-1')
})

test('learner api client suppresses late A success and forbidden effects after an account switch', async () => {
  for (const status of [200, 403]) {
    const session = authenticatedSession()
    const firstResponse = deferred()
    const fetch = fetchRecorder(firstResponse)
    const { apiClient, ApiAuthContextChangedError } = loadApiClient(session, fetch.fetchImpl)

    const pending = apiClient.get('/protected/read').then(
      value => ({ value }),
      error => ({ error }),
    )
    await fetch.started.promise
    switchToB(session)
    fetch.firstResponse.resolve(jsonResponse(status, { data: { owner: 'A' } }))
    const outcome = await pending

    assert.ok(outcome.error instanceof ApiAuthContextChangedError)
    assert.equal(session.forbiddenCalls, 0, 'A 403 must not navigate the current B session')
    assert.equal(fetch.calls.length, 1)
  }
})

test('learner api client fails closed when a token has no verified matching subject', async () => {
  const session = authenticatedSession()
  session.principal = { subject: 'A' }
  session.userId = 'B'
  session.accessToken = 'token-B-1'
  let fetchCalls = 0
  const { apiClient, ApiAuthContextChangedError } = loadApiClient(session, async () => {
    fetchCalls += 1
    return jsonResponse(200, { data: {} })
  })

  await assert.rejects(() => apiClient.get('/protected/read'), ApiAuthContextChangedError)
  assert.equal(fetchCalls, 0)
})

test('learner api client rechecks the synchronous owner snapshot immediately before dispatch', async () => {
  const session = authenticatedSession()
  let fetchCalls = 0
  const { apiClient, ApiAuthContextChangedError } = loadApiClient(session, async () => {
    fetchCalls += 1
    return jsonResponse(200, { ok: true })
  })

  const body = {
    toJSON() {
      switchToB(session)
      return { owner: 'A' }
    },
  }

  await assert.rejects(() => apiClient.post('/protected/write', body), ApiAuthContextChangedError)
  assert.equal(fetchCalls, 0, 'identity must be checked again after request serialization and before fetch')
})

test('learner api client strips caller-supplied bearer headers and uses only its captured token', async () => {
  const session = authenticatedSession()
  const authorizations = []
  const { apiClient } = loadApiClient(session, async (_url, init) => {
    authorizations.push(new Headers(init.headers).get('Authorization'))
    return jsonResponse(200, { ok: true })
  })

  await apiClient.get('/protected/read', { headers: { Authorization: 'Bearer forged-B-token' } })
  session.accessToken = null
  session.principal = null
  session.userId = null
  session.status = 'unauthenticated'
  await apiClient.get('/public/read', { headers: { Authorization: 'Bearer stale-A-token' } })

  assert.deepEqual(authorizations, ['Bearer token-A-1', null])
})

function compileTypeScript(relativePath, resolveImport) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(resolveImport, module, module.exports)
  return module.exports
}

function loadActualLearnerRuntime(fetchImpl) {
  const previousFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  const routerCalls = []
  let sessionModule
  const piniaModule = { pinia: {} }
  const platformModule = {
    getGatewayBaseUrl: () => 'https://gateway.example.test',
    getIamAuthBaseUrl: () => 'https://iam.example.test/api/v1',
    requireIamAuthBaseUrl: (value) => {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.pathname.replace(/\/+$/, '') !== '/api/v1') {
        throw new Error('账号密码只能提交到 IAM 的 HTTPS 认证入口。')
      }
      return `${url.origin}/api/v1`
    },
    safeInternalReturnTo: (value, fallback = '/home') => typeof value === 'string' && value.startsWith('/') ? value : fallback,
  }
  const accessTokenModule = compileTypeScript('src/auth/access-token.ts', () => {
    throw new Error('access-token module has no runtime imports')
  })
  const clientModule = compileTypeScript('src/api/client.ts', name => {
    if (name === '../platform/gateway') return platformModule
    if (name === '../auth/access-token') return accessTokenModule
    if (name === '../stores/pinia') return piniaModule
    if (name === '../stores/session') return {
      useSessionStore: () => new Proxy(sessionModule.useSessionStore(), {
        get(target, key) {
          const value = target[key]
          return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')
            ? value.value
            : value
        },
        set(target, key, value) {
          const current = target[key]
          if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, 'value')) {
            current.value = value
          } else target[key] = value
          return true
        },
      }),
    }
    throw new Error(`unexpected client dependency: ${name}`)
  })
  const gatewayAuthModule = compileTypeScript('src/auth/gateway-auth.ts', name => {
    if (name === '../api/client') return clientModule
    if (name === '../platform/gateway') return platformModule
    throw new Error(`unexpected gateway-auth dependency: ${name}`)
  })
  const vueModule = {
    ref: value => ({ value }),
    computed: getter => Object.defineProperty({}, 'value', { get: getter }),
  }
  const piniaRuntime = {
    defineStore: (_name, setup) => {
      let store
      return () => (store ??= setup())
    },
  }
  const routerModule = {
    router: {
      currentRoute: { value: { name: 'home' } },
      async replace(target) { routerCalls.push(target) },
    },
  }
  sessionModule = compileTypeScript('src/stores/session.ts', name => {
    if (name === 'vue') return vueModule
    if (name === 'pinia') return piniaRuntime
    if (name === '../auth/gateway-auth') return gatewayAuthModule
    if (name === '../auth/access-token') return accessTokenModule
    if (name === '../api/client') return clientModule
    if (name === '../platform/gateway') return platformModule
    if (name === '../auth/auth-failure-copy') return { learnerAuthFailureMarker: () => 'failed' }
    if (name === '../domain/b1') return { B1_STORAGE_KEY: 'yx.b1.test' }
    if (name === '../router') return routerModule
    throw new Error(`unexpected session dependency: ${name}`)
  })

  return {
    accessTokenModule,
    clientModule,
    gatewayAuthModule,
    sessionModule,
    routerCalls,
    restoreGlobals() { globalThis.fetch = previousFetch },
  }
}

function installSessionHint() {
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: key => key === 'yx.auth.session-hint' ? '1' : null,
      removeItem() {},
      setItem() {},
    },
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    location: { pathname: '/home', search: '', hash: '' },
  }
  return () => {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('actual learner session and gateway-auth client allow only verified IAM bootstrap and discard a switched response', async () => {
  const permissionStarted = deferred()
  const permissionGate = deferred()
  const requests = []
  const fetch = async (url, init) => {
    const path = requestPath(url)
    const authorization = new Headers(init.headers).get('Authorization')
    requests.push({ path, origin: new URL(url).origin, method: init.method, authorization })
    if (path === '/auth/login') return jsonResponse(200, { accessToken: 'token-A-1', userId: 'A' })
    if (path === '/iam/permissions') {
      permissionStarted.resolve()
      return permissionGate.promise
    }
    return jsonResponse(200, {})
  }
  const runtime = loadActualLearnerRuntime(fetch)
  const store = runtime.sessionModule.useSessionStore()
  try {
    const login = store.login('learner-a', 'not-a-real-password')
    await permissionStarted.promise

    const unverified = runtime.accessTokenModule.getInMemoryAuthSnapshot()
    assert.deepEqual(unverified, {
      accessToken: 'token-A-1',
      subject: null,
      generation: store.authGeneration.value,
      authenticated: false,
    })
    assert.equal(requests[0].path, '/auth/login')
    assert.equal(requests[0].origin, 'https://iam.example.test')
    assert.equal(requests[1].path, '/iam/permissions')
    assert.equal(requests[1].origin, 'https://gateway.example.test')
    assert.equal(requests[1].authorization, 'Bearer token-A-1')
    await assert.rejects(() => runtime.clientModule.apiClient.get('/learning/plans'), runtime.clientModule.ApiAuthContextChangedError)
    assert.equal(requests.length, 2, 'the business client must stay closed until IAM confirms the owner')

    store.clear()
    store.setTokenPair({ accessToken: 'token-B-1', userId: 'B' })
    permissionGate.resolve(jsonResponse(200, {
      principal: { subject: 'A', roles: [], permissions: [] },
      permissions: [],
      adultGate: 'PASSED',
    }))
    assert.equal(await login, false)
    assert.equal(store.principal.value, null, 'late A identity data must not bind to the current B session')
    assert.equal(store.userId.value, 'B')
    assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().subject, null)
  } finally {
    runtime.restoreGlobals()
  }
})

test('actual learner API client refreshes then retries a same-owner write with the new bound token', async () => {
  const requests = []
  let protectedCalls = 0
  let permissionCalls = 0
  const fetch = async (url, init) => {
    const path = requestPath(url)
    const authorization = new Headers(init.headers).get('Authorization')
    requests.push({ path, method: init.method, authorization, idempotencyKey: new Headers(init.headers).get('Idempotency-Key'), body: init.body })
    if (path === '/auth/login') return jsonResponse(200, { accessToken: 'token-A-1', userId: 'A' })
    if (path === '/auth/token/refresh') return jsonResponse(200, { accessToken: 'token-A-2' })
    if (path === '/iam/permissions') {
      permissionCalls += 1
      return jsonResponse(200, { principal: { subject: 'A', roles: [], permissions: [] }, permissions: [] })
    }
    if (path === '/protected/write') {
      protectedCalls += 1
      return protectedCalls === 1
        ? jsonResponse(401, { code: 'TOKEN_EXPIRED' })
        : jsonResponse(200, { data: { owner: 'A', claimed: true } })
    }
    return jsonResponse(200, {})
  }
  const runtime = loadActualLearnerRuntime(fetch)
  const store = runtime.sessionModule.useSessionStore()
  try {
    assert.equal(await store.login('learner-a', 'not-a-real-password'), true)
    const result = await runtime.clientModule.apiClient.post('/protected/write', { rewardId: 'reward-A' }, {
      headers: { 'Idempotency-Key': 'claim-A-once' },
    })

    assert.deepEqual(result, { data: { owner: 'A', claimed: true } })
    assert.equal(permissionCalls, 2)
    const writes = requests.filter(request => request.path === '/protected/write')
    assert.deepEqual(writes.map(request => request.authorization), ['Bearer token-A-1', 'Bearer token-A-2'])
    assert.deepEqual(writes.map(request => request.idempotencyKey), ['claim-A-once', 'claim-A-once'])
    assert.equal(writes[0].body, writes[1].body)
    assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().subject, 'A')
  } finally {
    runtime.restoreGlobals()
  }
})

test('actual learner API client rejects delayed A responses and never refreshes or navigates B', async () => {
  for (const status of [200, 401, 403]) {
    const firstResponse = deferred()
    const requestStarted = deferred()
    const requests = []
    const fetch = async (url, init) => {
      const path = requestPath(url)
      const authorization = new Headers(init.headers).get('Authorization')
      requests.push({ path, method: init.method, authorization })
      if (path === '/auth/login') {
        const input = JSON.parse(init.body)
        const owner = input.identifier === 'learner-b' ? 'B' : 'A'
        return jsonResponse(200, { accessToken: `token-${owner}-1`, userId: owner })
      }
      if (path === '/iam/permissions') {
        const owner = authorization?.includes('token-B') ? 'B' : 'A'
        return jsonResponse(200, { principal: { subject: owner, roles: [], permissions: [] }, permissions: [] })
      }
      if (path === '/protected/read') {
        requestStarted.resolve()
        return firstResponse.promise
      }
      if (path === '/auth/token/refresh') return jsonResponse(200, { accessToken: 'token-A-2' })
      return jsonResponse(200, {})
    }
    const runtime = loadActualLearnerRuntime(fetch)
    const store = runtime.sessionModule.useSessionStore()
    try {
      assert.equal(await store.login('learner-a', 'not-a-real-password'), true)
      const pending = runtime.clientModule.apiClient.get('/protected/read').then(
        value => ({ value }),
        error => ({ error }),
      )
      await requestStarted.promise
      assert.equal(await store.login('learner-b', 'not-a-real-password'), true)
      firstResponse.resolve(jsonResponse(status, { data: { owner: 'A' } }))
      const outcome = await pending

      assert.ok(outcome.error instanceof runtime.clientModule.ApiAuthContextChangedError)
      assert.equal(store.principal.value.subject, 'B')
      assert.equal(store.forbiddenReason.value, null)
      assert.equal(runtime.routerCalls.length, 0)
      assert.equal(requests.filter(request => request.path === '/auth/token/refresh').length, 0)
      assert.equal(requests.filter(request => request.path === '/protected/read').length, 1)
      assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().subject, 'B')
    } finally {
      runtime.restoreGlobals()
    }
  }
})

test('actual learner API client refuses an A refresh result after B logs in and does not replay the write', async () => {
  const refreshStarted = deferred()
  const refreshGate = deferred()
  const requests = []
  let protectedCalls = 0
  const fetch = async (url, init) => {
    const path = requestPath(url)
    const authorization = new Headers(init.headers).get('Authorization')
    requests.push({ path, method: init.method, authorization })
    if (path === '/auth/login') {
      const input = JSON.parse(init.body)
      const owner = input.identifier === 'learner-b' ? 'B' : 'A'
      return jsonResponse(200, { accessToken: `token-${owner}-1`, userId: owner })
    }
    if (path === '/iam/permissions') {
      const owner = authorization?.includes('token-B') ? 'B' : 'A'
      return jsonResponse(200, { principal: { subject: owner, roles: [], permissions: [] }, permissions: [] })
    }
    if (path === '/auth/token/refresh') {
      refreshStarted.resolve()
      return refreshGate.promise
    }
    if (path === '/protected/write') {
      protectedCalls += 1
      return protectedCalls === 1
        ? jsonResponse(401, { code: 'TOKEN_EXPIRED' })
        : jsonResponse(200, { data: { owner: 'A' } })
    }
    return jsonResponse(200, {})
  }
  const runtime = loadActualLearnerRuntime(fetch)
  const store = runtime.sessionModule.useSessionStore()
  try {
    assert.equal(await store.login('learner-a', 'not-a-real-password'), true)
    const pending = runtime.clientModule.apiClient.post('/protected/write', { owner: 'A' }).then(
      value => ({ value }),
      error => ({ error }),
    )
    await refreshStarted.promise
    assert.equal(requests.at(-1).path, '/auth/token/refresh')
    assert.equal(requests.at(-1).authorization, null, 'IAM refresh uses the Secure cookie and must not attach the access token')
    assert.equal(await store.login('learner-b', 'not-a-real-password'), true)
    refreshGate.resolve(jsonResponse(200, { accessToken: 'token-A-2' }))
    const outcome = await pending

    assert.ok(outcome.error instanceof runtime.clientModule.ApiAuthContextChangedError)
    assert.equal(store.principal.value.subject, 'B')
    assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().subject, 'B')
    assert.equal(protectedCalls, 1, 'the old A write must never be retried with B credentials')
    assert.equal(runtime.routerCalls.length, 0, 'an old A refresh must not send B to login')
  } finally {
    runtime.restoreGlobals()
  }
})

test('actual session restore verifies principal/me before enabling business requests and preserves logout/revoke auth routes', async () => {
  const restoreWindow = installSessionHint()
  try {
    for (const terminalAction of ['logout', 'revoke']) {
      const requests = []
      const fetch = async (url, init) => {
        const path = requestPath(url)
        const authorization = new Headers(init.headers).get('Authorization')
        requests.push({ path, method: init.method, authorization })
        if (path === '/auth/token/refresh') {
          return jsonResponse(200, { accessToken: 'token-A-restore', userId: 'A', sessionId: 'session-A' })
        }
        if (path === '/iam/principal/me' || path === '/iam/permissions') {
          return jsonResponse(200, {
            principal: { subject: 'A', roles: [], permissions: ['learning.plan.read'] },
            permissions: ['learning.plan.read'],
            adultGate: 'PASSED',
          })
        }
        return jsonResponse(200, {})
      }
      const runtime = loadActualLearnerRuntime(fetch)
      const store = runtime.sessionModule.useSessionStore()
      try {
        await store.restore()
        assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().subject, 'A')
        assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().authenticated, true)
        assert.deepEqual(requests.slice(0, 3).map(request => request.path), [
          '/auth/token/refresh', '/iam/principal/me', '/iam/permissions',
        ])
        assert.equal(requests[0].authorization, null)
        assert.equal(requests[1].authorization, 'Bearer token-A-restore')
        assert.equal(requests[2].authorization, 'Bearer token-A-restore')

        const result = terminalAction === 'logout'
          ? await store.logout()
          : await store.revokeCurrentSession()
        assert.equal(result, true)
        const terminalRequest = requests.at(-1)
        assert.equal(terminalRequest.path, terminalAction === 'logout' ? '/auth/logout' : '/auth/sessions/session-A/revoke')
        assert.equal(terminalRequest.authorization, 'Bearer token-A-restore')
        assert.equal(runtime.accessTokenModule.getInMemoryAuthSnapshot().accessToken, null)
      } finally {
        runtime.restoreGlobals()
      }
    }
  } finally {
    restoreWindow()
  }
})
