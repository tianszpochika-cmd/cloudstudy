import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadEsm(relativePath) {
  const filename = path.join(appRoot, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const transpiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true },
  }).outputText
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`)
}

function loadCjs(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`unexpected import ${name} from ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }
}

test('IAM auth base stays on TLS and rejects an http override', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  assert.equal(gateway.DEFAULT_IAM_AUTH_BASE_URL, 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.DEFAULT_GATEWAY_BASE_URL, 'http://127.0.0.1:18070/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({}), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'http://127.0.0.1:18087/api/v1' }), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'http://127.0.0.1:18070/api/v1' }), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'https://127.0.0.1:18087' }), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'https://user:secret@127.0.0.1:18087/api/v1' }), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'https://iam.internal.example/api/v1/' }), 'https://iam.internal.example/api/v1')
  assert.throws(() => gateway.requireIamAuthBaseUrl('http://127.0.0.1:18070/api/v1'), /HTTPS/)
})

test('password posts use IAM TLS and domain reads stay on the Gateway', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({
      url: String(url),
      method: init.method,
      body: init.body,
      authorization: new Headers(init.headers).get('Authorization'),
      credentials: init.credentials,
    })
    const pathname = new URL(url).pathname
    if (pathname.endsWith('/auth/login') || pathname.endsWith('/auth/register') || pathname.endsWith('/auth/token/refresh')) {
      return jsonResponse(201, { accessToken: 'token-1' })
    }
    if (pathname.includes('/auth/password-reset/')) return jsonResponse(202, { accepted: true })
    return jsonResponse(200, { principal: { subject: 'A', roles: [], permissions: [] }, permissions: [], adultGate: 'PASSED' })
  }
  const client = loadCjs('src/api/client.ts', {
    '../platform/gateway': gateway,
    '../auth/access-token': {
      getInMemoryAccessToken: () => null,
      getInMemoryAuthSnapshot: () => null,
    },
  })
  const auth = loadCjs('src/auth/gateway-auth.ts', {
    '../api/client': client,
    '../platform/gateway': gateway,
  })
  const adapter = auth.createGatewayAuthAdapter({
    baseUrl: gateway.getGatewayBaseUrl({}),
    iamAuthBaseUrl: gateway.getIamAuthBaseUrl({}),
    getAccessToken: () => 'stale-bearer',
    getAuthSnapshot: () => ({ accessToken: 'stale-bearer', subject: 'A', generation: 1, authenticated: true }),
    fetchImpl,
  })
  const password = 'fixture-password'
  await adapter.login({ identifier: 'learner@example.com', password, device: { deviceType: 'WEB', clientVersion: 'test' } })
  await adapter.register({ identifier: 'learner@example.com', password, device: { deviceType: 'WEB', clientVersion: 'test' } })
  await adapter.requestPasswordReset({ identifier: 'learner@example.com' })
  await adapter.confirmPasswordReset({ identifier: 'learner@example.com', resetToken: 'reset-token', newPassword: password })
  await adapter.restoreSession()
  await adapter.refresh()

  const passwordCalls = calls.filter((call) => String(call.body ?? '').includes(password) || String(call.url).includes('/auth/password-reset/request'))
  assert.equal(passwordCalls.length, 4)
  for (const call of passwordCalls) {
    assert.equal(call.url.startsWith('https://127.0.0.1:18087/api/v1/'), true, call.url)
    assert.equal(call.url.includes('18070'), false, call.url)
    assert.equal(call.authorization, null)
    assert.equal(call.credentials, 'include')
  }
  assert.deepEqual(passwordCalls.map((call) => new URL(call.url).pathname), [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/password-reset/request',
    '/api/v1/auth/password-reset/confirm',
  ])
  const domain = calls.slice(4)
  assert.equal(domain[0].url, 'http://127.0.0.1:18070/api/v1/iam/principal/me')
  assert.equal(domain[0].authorization, 'Bearer stale-bearer')
  assert.equal(domain[1].url, 'https://127.0.0.1:18087/api/v1/auth/token/refresh')
  assert.equal(domain[1].authorization, null)
  assert.equal(domain[1].credentials, 'include')
  assert.equal(calls.some((call) => call.url.startsWith('http://127.0.0.1:18070/') && String(call.body ?? '').includes(password)), false)
})

test('session keeps the Gateway for domain calls and passes the IAM auth base beside it', () => {
  const session = fs.readFileSync(path.join(appRoot, 'src/stores/session.ts'), 'utf8')
  assert.match(session, /baseUrl: getGatewayBaseUrl\(\)/)
  assert.match(session, /iamAuthBaseUrl: getIamAuthBaseUrl\(\)/)
})
