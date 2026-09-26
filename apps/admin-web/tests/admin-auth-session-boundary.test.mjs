import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import * as Pinia from 'pinia'

const appRoot = path.resolve(import.meta.dirname, '..')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }
}

function compile(relativePath, resolveImport) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(resolveImport, module, module.exports)
  return module.exports
}

function createWindow() {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  return { localStorage: storage, sessionStorage: storage, location: { pathname: '/audit', search: '', hash: '' } }
}

function runtime(fetchImpl) {
  const previousFetch = globalThis.fetch
  const previousWindow = globalThis.window
  globalThis.fetch = fetchImpl
  globalThis.window = createWindow()

  const routerCalls = []
  const router = {
    currentRoute: { value: { name: 'admin-audit', fullPath: '/audit', query: {} } },
    replaceStarted: deferred(),
    nextReplaceGate: null,
    async replace(target) {
      routerCalls.push(target)
      this.replaceStarted.resolve(target)
      const gate = this.nextReplaceGate
      this.nextReplaceGate = null
      if (gate) await gate.promise
      if (typeof target === 'string') {
        this.currentRoute.value = { name: null, fullPath: target, query: {} }
      } else {
        const fullPath = target.name === 'admin-forbidden'
          ? `/forbidden?from=${encodeURIComponent(target.query?.from ?? '')}`
          : `/login?redirect=${encodeURIComponent(target.query?.redirect ?? '')}&reason=${encodeURIComponent(target.query?.reason ?? '')}`
        this.currentRoute.value = { name: target.name, fullPath, query: target.query ?? {} }
      }
    },
  }

  const platformModule = {
    getGatewayBaseUrl: () => 'https://gateway.example.test',
    safeInternalReturnTo: (value, fallback = '/dashboard') => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback,
  }
  const accessTokenModule = compile('src/auth/access-token.ts', () => { throw new Error('access-token has no runtime imports') })
  let storeModule
  const clientModule = compile('src/api/client.ts', (name) => {
    if (name === '../platform/gateway') return platformModule
    if (name === '../platform/admin-i18n') return { adminT: key => key }
    if (name === '../auth/access-token') return accessTokenModule
    if (name === '../stores/admin') return storeModule
    if (name === '../router') return { router }
    throw new Error(`unexpected client dependency: ${name}`)
  })
  const gatewayAuthModule = compile('src/auth/gateway-auth.ts', (name) => {
    if (name === '../api/client') return clientModule
    if (name === '../platform/admin-i18n') return { adminT: key => key }
    if (name === '../platform/gateway') return platformModule
    throw new Error(`unexpected auth dependency: ${name}`)
  })
  storeModule = compile('src/stores/admin.ts', (name) => {
    if (name === 'pinia') return Pinia
    if (name === '../auth/gateway-auth') return gatewayAuthModule
    if (name === '../platform/admin-i18n') return { adminT: key => key }
    if (name === '../auth/access-token') return accessTokenModule
    if (name === '../api/client') return clientModule
    throw new Error(`unexpected store dependency: ${name}`)
  })
  Pinia.setActivePinia(storeModule.pinia)
  const store = storeModule.useAdminStore(storeModule.pinia)

  return {
    store,
    router,
    routerCalls,
    accessTokenModule,
    clientModule,
    restoreGlobals() {
      globalThis.fetch = previousFetch
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    },
  }
}

function requestRecord(url, init) {
  const headers = new Headers(init.headers)
  return {
    path: new URL(url).pathname,
    method: init.method,
    authorization: headers.get('Authorization'),
    idempotencyKey: headers.get('Idempotency-Key'),
    body: init.body,
    credentials: init.credentials,
  }
}

function loginAndPermissions(fetch, owner = 'A') {
  if (fetch.path === '/auth/login') return jsonResponse(200, { data: { accessToken: `token-${owner}-1` } })
  if (fetch.path === '/iam/permissions') return jsonResponse(200, {
    data: { principal: { subject: owner, roles: ['admin'], permissions: ['admin.audit.read'] }, permissions: ['admin.audit.read'] },
  })
  return null
}

test('real admin store keeps login, restore, refresh, and logout on the Gateway auth adapter flow', async () => {
  const calls = []
  const app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    calls.push(item)
    if (item.path === '/auth/login') return jsonResponse(200, { data: { accessToken: 'token-A-1' } })
    if (item.path === '/iam/permissions') return jsonResponse(200, {
      data: { principal: { subject: 'A', roles: ['auditor'], permissions: ['admin.audit.read'] }, permissions: ['admin.audit.read'] },
    })
    if (item.path === '/auth/logout') return jsonResponse(200, { data: { revoked: true } })
    return jsonResponse(404, { code: 'NOT_FOUND' })
  })
  try {
    assert.equal(await app.store.login('admin-a', 'test-password'), true)
    assert.equal(app.store.isAuthenticated, true)
    assert.equal(app.store.principal.subject, 'A')
    assert.deepEqual(calls.map(item => item.path), ['/auth/login', '/iam/permissions'])
    assert.equal(calls[1].authorization, 'Bearer token-A-1')
    assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().subject, 'A')

    assert.equal(await app.store.logout(), true)
    assert.equal(calls.at(-1).path, '/auth/logout')
    assert.equal(calls.at(-1).authorization, 'Bearer token-A-1')
    assert.equal(calls.at(-1).credentials, 'include')
    assert.deepEqual(app.accessTokenModule.getInMemoryAuthSnapshot(), {
      accessToken: null,
      subject: null,
      generation: app.store.authGeneration,
      authenticated: false,
    })
  } finally {
    app.restoreGlobals()
  }

  const restoreCalls = []
  const restoreApp = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    restoreCalls.push(item)
    if (item.path === '/auth/token/refresh') return jsonResponse(200, { data: { accessToken: 'token-A-restore', sessionId: 'session-A' } })
    if (item.path === '/iam/principal/me' || item.path === '/iam/permissions') return jsonResponse(200, {
      data: { principal: { subject: 'A', roles: ['auditor'], permissions: ['admin.audit.read'] }, permissions: ['admin.audit.read'] },
    })
    return jsonResponse(404, {})
  })
  try {
    globalThis.window.localStorage.setItem('englishflow.admin.session-hint', '1')
    await restoreApp.store.restore()
    assert.deepEqual(restoreCalls.map(item => item.path), ['/auth/token/refresh', '/iam/principal/me', '/iam/permissions'])
    assert.equal(restoreCalls[0].authorization, null)
    assert.deepEqual(restoreCalls.slice(1).map(item => item.authorization), [
      'Bearer token-A-restore', 'Bearer token-A-restore',
    ])
    assert.equal(restoreApp.store.isAuthenticated, true)
    assert.equal(restoreApp.accessTokenModule.getInMemoryAuthSnapshot().subject, 'A')
  } finally {
    restoreApp.restoreGlobals()
  }
})

test('login retains a safe return target when browser session storage is blocked', async () => {
  const app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    if (item.path === '/auth/login') return jsonResponse(200, { data: { accessToken: 'token-A-1' } })
    if (item.path === '/iam/permissions') return jsonResponse(200, {
      data: { principal: { subject: 'A', roles: ['auditor'], permissions: ['admin.audit.read'] } },
    })
    return jsonResponse(404, {})
  })
  try {
    globalThis.window.sessionStorage = {
      getItem() { throw new Error('SecurityError') },
      setItem() { throw new Error('SecurityError') },
      removeItem() { throw new Error('SecurityError') },
    }
    assert.doesNotThrow(() => app.store.setReturnTo('/audit?range=recent'))
    assert.equal(await app.store.login('admin-a', 'test-password'), true)
    assert.equal(app.store.consumeReturnTo(), '/audit?range=recent')
    assert.equal(app.store.consumeReturnTo(), '/dashboard')
  } finally {
    app.restoreGlobals()
  }
})

test('a stored return target is consumed once when storage removal fails', () => {
  const app = runtime(async () => jsonResponse(404, {}))
  try {
    const values = new Map()
    globalThis.window.sessionStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem() { throw new Error('SecurityError') },
    }
    app.store.setReturnTo('/audit?range=recent')
    assert.equal(app.store.consumeReturnTo(), '/audit?range=recent')
    assert.equal(app.store.consumeReturnTo(), '/dashboard')
  } finally {
    app.restoreGlobals()
  }
})

test('a failed storage write never revives an older readable return target', () => {
  const app = runtime(async () => jsonResponse(404, {}))
  try {
    globalThis.window.sessionStorage = {
      getItem: () => '/audit?range=old',
      setItem() { throw new Error('QuotaExceededError') },
      removeItem() { throw new Error('SecurityError') },
    }
    app.store.setReturnTo('/content?draft=current')
    assert.equal(app.store.consumeReturnTo(), '/content?draft=current')
    assert.equal(app.store.consumeReturnTo(), '/dashboard')
  } finally {
    app.restoreGlobals()
  }
})

test('a same-subject 401 refresh retries one write once with the rotated token', async () => {
  const calls = []
  const refreshPermissionStarted = deferred()
  const refreshPermissionGate = deferred()
  let writeCount = 0
  let permissionCount = 0
  const app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    calls.push(item)
    if (item.path === '/auth/login') return jsonResponse(200, { data: { accessToken: 'token-A-1' } })
    if (item.path === '/auth/token/refresh') return jsonResponse(200, { data: { accessToken: 'token-A-2' } })
    if (item.path === '/iam/permissions') {
      permissionCount += 1
      if (permissionCount === 2) {
        refreshPermissionStarted.resolve()
        return refreshPermissionGate.promise
      }
      return jsonResponse(200, { data: { principal: { subject: 'A', roles: ['admin'], permissions: ['admin.audit.read'] } } })
    }
    if (item.path === '/admin/write') {
      writeCount += 1
      return writeCount === 1
        ? jsonResponse(401, { code: 'TOKEN_EXPIRED' })
        : jsonResponse(200, { data: { owner: 'A', stored: true } })
    }
    if (item.path === '/admin/scope-probe') return jsonResponse(200, { data: { owner: 'A' } })
    return jsonResponse(404, {})
  })
  try {
    assert.equal(await app.store.login('admin-a', 'test-password'), true)
    const pendingWrite = app.clientModule.adminClient.request('/admin/write', {
      method: 'POST',
      body: { action: 'approve' },
      headers: { 'Idempotency-Key': 'approve-A-once' },
    })
    await refreshPermissionStarted.promise
    assert.equal(app.store.accessToken, 'token-A-1', 'the store keeps the committed token while IAM checks the candidate')
    assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().accessToken, 'token-A-1')
    const scopeProbe = await app.clientModule.adminClient.request('/admin/scope-probe')
    assert.deepEqual(scopeProbe, { data: { owner: 'A' } })
    assert.equal(calls.find(item => item.path === '/admin/scope-probe').authorization, 'Bearer token-A-1')
    refreshPermissionGate.resolve(jsonResponse(200, { data: { principal: { subject: 'A', roles: ['admin'], permissions: ['admin.audit.read'] } } }))
    const result = await pendingWrite
    assert.deepEqual(result, { data: { owner: 'A', stored: true } })
    assert.equal(permissionCount, 2)
    assert.deepEqual(calls.filter(item => item.path === '/admin/write').map(item => item.authorization), [
      'Bearer token-A-1', 'Bearer token-A-2',
    ])
    assert.ok(calls.filter(item => item.path === '/admin/write').every(item => item.idempotencyKey === 'approve-A-once'))
    assert.equal(calls.filter(item => item.path === '/auth/token/refresh').length, 1)
    assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().accessToken, 'token-A-2')
    assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().subject, 'A')
  } finally {
    app.restoreGlobals()
  }
})

test('refresh permissions for another subject expire A and never commit or retry with the candidate token', async () => {
  const calls = []
  const app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    calls.push(item)
    if (item.path === '/auth/login') return jsonResponse(200, { data: { accessToken: 'token-A-1' } })
    if (item.path === '/iam/permissions') {
      const subject = item.authorization?.includes('token-B') ? 'B' : 'A'
      return jsonResponse(200, { data: { principal: { subject, roles: [], permissions: [] } } })
    }
    if (item.path === '/auth/token/refresh') return jsonResponse(200, { data: { accessToken: 'token-B-from-refresh' } })
    if (item.path === '/admin/write') return jsonResponse(401, { code: 'TOKEN_EXPIRED' })
    return jsonResponse(200, {})
  })
  try {
    assert.equal(await app.store.login('admin-a', 'test-password'), true)
    await assert.rejects(
      () => app.clientModule.adminClient.request('/admin/write', { method: 'POST', body: { action: 'approve' } }),
      app.clientModule.AdminAuthContextChangedError,
    )
    assert.equal(calls.filter(item => item.path === '/admin/write').length, 1)
    assert.equal(calls.filter(item => item.path === '/iam/permissions').length, 2)
    assert.equal(calls.findLast(item => item.path === '/iam/permissions').authorization, 'Bearer token-B-from-refresh')
    assert.equal(app.store.accessToken, '')
    assert.equal(app.store.principal, null)
    assert.deepEqual(app.accessTokenModule.getInMemoryAuthSnapshot(), {
      accessToken: null,
      subject: null,
      generation: app.store.authGeneration,
      authenticated: false,
    })
    assert.equal(app.routerCalls.at(-1).name, 'admin-login')
  } finally {
    app.restoreGlobals()
  }
})

test('business requests stay closed while login has a token but IAM has not confirmed its subject', async () => {
  const permissionStarted = deferred()
  const permissionGate = deferred()
  const calls = []
  const app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    calls.push(item)
    if (item.path === '/auth/login') return jsonResponse(200, { data: { accessToken: 'token-A-1' } })
    if (item.path === '/iam/permissions') {
      permissionStarted.resolve()
      return permissionGate.promise
    }
    return jsonResponse(200, {})
  })
  try {
    const login = app.store.login('admin-a', 'test-password')
    await permissionStarted.promise
    assert.equal(calls[1].path, '/iam/permissions')
    assert.equal(calls[1].authorization, 'Bearer token-A-1')
    await assert.rejects(() => app.clientModule.adminClient.request('/admin/audit'), app.clientModule.AdminAuthContextChangedError)
    assert.equal(calls.length, 2)
    permissionGate.resolve(jsonResponse(200, { data: { principal: { subject: 'A', roles: [], permissions: [] } } }))
    assert.equal(await login, true)
    assert.equal(app.store.isAuthenticated, true)
  } finally {
    app.restoreGlobals()
  }
})

test('late A 200, 401, and 403 responses cannot refresh, return data, or navigate after B logs in', async () => {
  for (const status of [200, 401, 403]) {
    const responseGate = deferred()
    const requestStarted = deferred()
    const calls = []
    const app = runtime(async (url, init) => {
      const item = requestRecord(url, init)
      calls.push(item)
      if (item.path === '/auth/login') {
        const owner = JSON.parse(item.body).identifier === 'admin-b' ? 'B' : 'A'
        return jsonResponse(200, { data: { accessToken: `token-${owner}-1` } })
      }
      if (item.path === '/iam/permissions') {
        const owner = item.authorization?.includes('token-B') ? 'B' : 'A'
        return jsonResponse(200, { data: { principal: { subject: owner, roles: [], permissions: [] } } })
      }
      if (item.path === '/admin/read') {
        requestStarted.resolve()
        return responseGate.promise
      }
      if (item.path === '/auth/token/refresh') return jsonResponse(200, { data: { accessToken: 'token-A-2' } })
      return jsonResponse(200, {})
    })
    try {
      assert.equal(await app.store.login('admin-a', 'test-password'), true)
      const pending = app.clientModule.adminClient.request('/admin/read').then(value => ({ value }), error => ({ error }))
      await requestStarted.promise
      assert.equal(await app.store.login('admin-b', 'test-password'), true)
      responseGate.resolve(jsonResponse(status, { data: { owner: 'A' }, code: status === 401 ? 'TOKEN_EXPIRED' : undefined }))
      const outcome = await pending
      assert.ok(outcome.error instanceof app.clientModule.AdminAuthContextChangedError)
      assert.equal(app.store.principal.subject, 'B')
      assert.equal(app.store.forbiddenReason, '')
      assert.equal(app.routerCalls.length, 0)
      assert.equal(calls.filter(item => item.path === '/auth/token/refresh').length, 0)
      assert.equal(calls.filter(item => item.path === '/admin/read').length, 1)
      assert.equal(calls.find(item => item.path === '/admin/read').authorization, 'Bearer token-A-1')
      assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().subject, 'B')
    } finally {
      app.restoreGlobals()
    }
  }
})

test('late login, restore, and refresh completions cannot replace the newer B session', async () => {
  {
    const loginAResponse = deferred()
    const loginAStarted = deferred()
    const calls = []
    const app = runtime(async (url, init) => {
      const item = requestRecord(url, init)
      calls.push(item)
      if (item.path === '/auth/login') {
        const owner = JSON.parse(item.body).identifier === 'admin-b' ? 'B' : 'A'
        if (owner === 'A') {
          loginAStarted.resolve()
          return loginAResponse.promise
        }
        return jsonResponse(200, { data: { accessToken: 'token-B-1' } })
      }
      if (item.path === '/iam/permissions') return jsonResponse(200, {
        data: { principal: { subject: item.authorization?.includes('token-B') ? 'B' : 'A', roles: [], permissions: [] } },
      })
      return jsonResponse(200, {})
    })
    try {
      const loginA = app.store.login('admin-a', 'test-password')
      await loginAStarted.promise
      assert.equal(await app.store.login('admin-b', 'test-password'), true)
      loginAResponse.resolve(jsonResponse(200, { data: { accessToken: 'token-A-1' } }))
      assert.equal(await loginA, false)
      assert.equal(app.store.principal.subject, 'B')
      assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().subject, 'B')
      assert.equal(calls.filter(item => item.path === '/iam/permissions' && item.authorization?.includes('token-A')).length, 0)
    } finally {
      app.restoreGlobals()
    }
  }

  {
    const principalResponse = deferred()
    const principalStarted = deferred()
    const calls = []
    const app = runtime(async (url, init) => {
      const item = requestRecord(url, init)
      calls.push(item)
      if (item.path === '/auth/token/refresh') return jsonResponse(200, { data: { accessToken: 'token-A-restore' } })
      if (item.path === '/iam/principal/me') {
        principalStarted.resolve()
        return principalResponse.promise
      }
      if (item.path === '/auth/login') return jsonResponse(200, { data: { accessToken: 'token-B-1' } })
      if (item.path === '/iam/permissions') return jsonResponse(200, {
        data: { principal: { subject: item.authorization?.includes('token-B') ? 'B' : 'A', roles: [], permissions: [] } },
      })
      return jsonResponse(200, {})
    })
    try {
      globalThis.window.localStorage.setItem('englishflow.admin.session-hint', '1')
      const restore = app.store.restore()
      await principalStarted.promise
      assert.equal(await app.store.login('admin-b', 'test-password'), true)
      principalResponse.resolve(jsonResponse(200, { data: { principal: { subject: 'A', roles: [], permissions: [] } } }))
      await restore
      assert.equal(app.store.principal.subject, 'B')
      assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().subject, 'B')
      assert.equal(calls.filter(item => item.path === '/iam/permissions' && item.authorization?.includes('token-A')).length, 0)
    } finally {
      app.restoreGlobals()
    }
  }

  {
    const refreshPermissions = deferred()
    const refreshPermissionsStarted = deferred()
    const calls = []
    const app = runtime(async (url, init) => {
      const item = requestRecord(url, init)
      calls.push(item)
      if (item.path === '/auth/login') {
        const owner = JSON.parse(item.body).identifier === 'admin-b' ? 'B' : 'A'
        return jsonResponse(200, { data: { accessToken: `token-${owner}-1` } })
      }
      if (item.path === '/iam/permissions') {
        if (item.authorization?.includes('token-A-2')) {
          refreshPermissionsStarted.resolve()
          return refreshPermissions.promise
        }
        return jsonResponse(200, {
          data: { principal: { subject: item.authorization?.includes('token-B') ? 'B' : 'A', roles: [], permissions: [] } },
        })
      }
      if (item.path === '/auth/token/refresh') return jsonResponse(200, { data: { accessToken: 'token-A-2' } })
      if (item.path === '/admin/read') return jsonResponse(401, { code: 'TOKEN_EXPIRED' })
      return jsonResponse(200, {})
    })
    try {
      assert.equal(await app.store.login('admin-a', 'test-password'), true)
      const pending = app.clientModule.adminClient.request('/admin/read').then(value => ({ value }), error => ({ error }))
      await refreshPermissionsStarted.promise
      assert.equal(await app.store.login('admin-b', 'test-password'), true)
      refreshPermissions.resolve(jsonResponse(200, { data: { principal: { subject: 'A', roles: [], permissions: [] } } }))
      const outcome = await pending
      assert.ok(outcome.error instanceof app.clientModule.AdminAuthContextChangedError)
      assert.equal(app.store.principal.subject, 'B')
      assert.equal(app.accessTokenModule.getInMemoryAuthSnapshot().subject, 'B')
      assert.equal(calls.filter(item => item.path === '/admin/read').length, 1)
      assert.equal(calls.filter(item => item.path === '/auth/token/refresh').length, 1)
      assert.equal(calls.filter(item => item.path === '/admin/read')[0].authorization, 'Bearer token-A-1')
    } finally {
      app.restoreGlobals()
    }
  }
})

test('a write serialized during A to B switching is stopped before fetch instead of borrowing B token', async () => {
  const calls = []
  let app
  app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    calls.push(item)
    if (item.path === '/auth/login') {
      const owner = JSON.parse(item.body).identifier === 'admin-b' ? 'B' : 'A'
      return jsonResponse(200, { data: { accessToken: `token-${owner}-1` } })
    }
    if (item.path === '/iam/permissions') {
      const owner = item.authorization?.includes('token-B') ? 'B' : 'A'
      return jsonResponse(200, { data: { principal: { subject: owner, roles: [], permissions: [] } } })
    }
    return jsonResponse(200, {})
  })
  try {
    assert.equal(await app.store.login('admin-a', 'test-password'), true)
    let loginB
    const body = {
      toJSON() {
        loginB = app.store.login('admin-b', 'test-password')
        return { target: 'A' }
      },
    }
    await assert.rejects(() => app.clientModule.adminClient.request('/admin/write', { method: 'POST', body }), app.clientModule.AdminAuthContextChangedError)
    assert.equal(await loginB, true)
    assert.equal(app.store.principal.subject, 'B')
    assert.equal(calls.filter(item => item.path === '/admin/write').length, 0)
    assert.deepEqual(calls.filter(item => item.path === '/auth/login').map(item => item.authorization), [null, null])
  } finally {
    app.restoreGlobals()
  }
})

test('an A 403 navigation that was already waiting is rolled back after B becomes current', async () => {
  const navigationGate = deferred()
  const calls = []
  const app = runtime(async (url, init) => {
    const item = requestRecord(url, init)
    calls.push(item)
    const owner = item.path === '/auth/login'
      ? JSON.parse(item.body).identifier === 'admin-b' ? 'B' : 'A'
      : item.authorization?.includes('token-B') ? 'B' : 'A'
    const authResponse = loginAndPermissions(item, owner)
    if (authResponse) return authResponse
    if (item.path === '/admin/read') return jsonResponse(403, { code: 'POLICY_DENIED' })
    return jsonResponse(200, {})
  })
  try {
    assert.equal(await app.store.login('admin-a', 'test-password'), true)
    app.router.nextReplaceGate = navigationGate
    const pending = app.clientModule.adminClient.request('/admin/read').then(value => ({ value }), error => ({ error }))
    await app.router.replaceStarted.promise
    assert.equal(app.routerCalls.length, 1)
    assert.equal(await app.store.login('admin-b', 'test-password'), true)
    navigationGate.resolve()
    const outcome = await pending
    assert.ok(outcome.error instanceof app.clientModule.AdminAuthContextChangedError)
    assert.equal(app.store.principal.subject, 'B')
    assert.equal(app.router.currentRoute.value.fullPath, '/audit')
    assert.equal(app.routerCalls.length, 2)
    assert.equal(app.routerCalls[0].name, 'admin-forbidden')
    assert.equal(app.routerCalls[1], '/audit')
  } finally {
    app.restoreGlobals()
  }
})
