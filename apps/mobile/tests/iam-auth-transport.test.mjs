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

test('mobile IAM auth base stays on TLS and rejects an http override', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  assert.equal(gateway.getIamAuthBaseUrl({}), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getGatewayBaseUrl({}), 'http://127.0.0.1:18070/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'http://127.0.0.1:18070/api/v1' }), 'https://127.0.0.1:18087/api/v1')
  assert.throws(() => gateway.requireIamAuthBaseUrl('http://127.0.0.1:18087/api/v1'), /HTTPS/)
})

test('mobile password posts and refresh use the IAM client; domain reads and logout stay on the Gateway client', async () => {
  const calls = []
  function client(name, url) {
    return {
      async request(path, options = {}) {
        calls.push({ name, url: `${url}${path}`, path, options })
        if (path.includes('password-reset')) return { accepted: true }
        return { accessToken: 'token-1', sessionId: 'session-1' }
      },
    }
  }
  const auth = loadCjs('src/auth/gateway-auth.ts', {
    '../api/client': {
      MobileApiError: class MobileApiError extends Error { constructor(message, status) { super(message); this.status = status } },
      mobileApiClient: client('gateway', 'http://127.0.0.1:18070/api/v1'),
      mobileIamAuthClient: client('iam', 'https://127.0.0.1:18087/api/v1'),
    },
    '../platform/gateway': { safeInternalReturnTo: (value, fallback) => (typeof value === 'string' ? value : fallback) },
  })
  const adapter = auth.createGatewayMobileAuthAdapter()
  const password = 'fixture-password'
  const credentials = { identifier: 'learner@example.com', password, device: { deviceType: 'MOBILE', clientVersion: 'test' } }
  await adapter.login(credentials)
  await adapter.register(credentials)
  await adapter.requestPasswordReset({ identifier: 'learner@example.com' })
  await adapter.confirmPasswordReset({ identifier: 'learner@example.com', resetToken: 'reset-token', newPassword: password })
  await adapter.getPermissions()
  await adapter.refresh()
  await adapter.logout()

  const passwordCalls = calls.slice(0, 4)
  assert.deepEqual(passwordCalls.map((call) => call.name), ['iam', 'iam', 'iam', 'iam'])
  assert.deepEqual(passwordCalls.map((call) => call.url), [
    'https://127.0.0.1:18087/api/v1/auth/login',
    'https://127.0.0.1:18087/api/v1/auth/register',
    'https://127.0.0.1:18087/api/v1/auth/password-reset/request',
    'https://127.0.0.1:18087/api/v1/auth/password-reset/confirm',
  ])
  assert.equal(calls[4].name, 'gateway')
  assert.equal(calls[4].url, 'http://127.0.0.1:18070/api/v1/iam/permissions')
  assert.equal(calls[5].name, 'iam')
  assert.equal(calls[5].url, 'https://127.0.0.1:18087/api/v1/auth/token/refresh')
  assert.equal(calls[6].name, 'gateway')
  assert.equal(calls[6].url, 'http://127.0.0.1:18070/api/v1/auth/logout')
  assert.equal(calls.some((call) => call.name === 'gateway' && JSON.stringify(call.options.data ?? {}).includes(password)), false)
})

test('mobile IAM client posts the password to TLS without the current bearer', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  const requests = []
  const api = loadCjs('src/api/client.ts', {
    '../platform/gateway': gateway,
    '../platform/uni-runtime': {
      getUniRuntime: () => ({
        request(options) {
          requests.push(options)
          options.success({ statusCode: 201, data: { accessToken: 'token-1' } })
        },
      }),
    },
    '../auth/access-token': {
      getInMemoryAuthRequestSnapshot: () => ({
        accessToken: 'stale-bearer',
        identity: { subject: 'A', revision: 3 },
        revision: 3,
      }),
    },
  })
  await api.mobileIamAuthClient.request('/auth/login', {
    method: 'POST',
    data: { identifier: 'learner@example.com', password: 'fixture-password' },
    skipAuthRetry: true,
  })
  assert.equal(requests[0].url, 'https://127.0.0.1:18087/api/v1/auth/login')
  assert.equal(requests[0].header.Authorization, undefined)
  assert.equal(requests[0].withCredentials, true)
  assert.equal(requests[0].data.password, 'fixture-password')

  requests.length = 0
  await api.mobileApiClient.request('/iam/permissions', { skipAuthRetry: true, authBootstrap: 'identity' })
  assert.equal(requests[0].url, 'http://127.0.0.1:18070/api/v1/iam/permissions')
  assert.equal(requests[0].header.Authorization, 'Bearer stale-bearer')
})
