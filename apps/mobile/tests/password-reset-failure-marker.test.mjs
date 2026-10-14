import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const appRoot = path.resolve(import.meta.dirname, '..')
const vue = require('vue')
const pinia = require('pinia')

function load(relativePath, modules = {}) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

const failureCopy = load('src/auth/auth-failure-copy.ts')

function sessionWith(failure) {
  pinia.setActivePinia(pinia.createPinia())
  const reject = async () => { throw failure }
  const module = load('src/stores/session.ts', {
    vue, pinia,
    '../auth/access-token': {
      getInMemoryAccessToken: () => null,
      setInMemoryAccessToken: () => {},
      setInMemoryRequestIdentity: () => {},
    },
    '../auth/auth-failure-copy': failureCopy,
    '../auth/gateway-auth': {
      createGatewayMobileAuthAdapter: () => ({ requestPasswordReset: reject, confirmPasswordReset: reject }),
      safeMobileReturnTo: (value, fallback) => value ?? fallback,
    },
    '../platform/uni-runtime': { getUniRuntime: () => { throw new Error('No native runtime in this unit test') }, isNativeAppRuntime: () => false },
    './learning-cache': { removeAllLearningCaches: () => {} },
  })
  return module.useSessionStore()
}

for (const action of ['request', 'confirm']) {
  for (const item of [
    { name: 'invalid reset detail survives the generic 401 message', status: 401, code: 'iam.password_reset.invalid', marker: 'iam.password_reset.invalid', key: action === 'confirm' ? 'auth.resetPassword.invalidCode' : 'auth.resetPassword.failedRequest' },
    { name: '429 retains localized retry guidance', status: 429, code: 'RATE_LIMITED', marker: 'RATE_LIMITED', key: 'auth.resetPassword.rateLimited' },
    { name: 'unknown 401 does not imply an invalid reset code', status: 401, code: 'UNSPECIFIED_FAILURE', marker: 'iam.credentials.invalid', key: action === 'confirm' ? 'auth.resetPassword.failedConfirm' : 'auth.resetPassword.failedRequest' },
    { name: '503 retains no raw diagnostic text', status: 503, code: 'SERVICE_UNAVAILABLE', marker: 'UNKNOWN_AUTH_ERROR', key: action === 'confirm' ? 'auth.resetPassword.failedConfirm' : 'auth.resetPassword.failedRequest' },
  ]) {
    test(`${action}: ${item.name}`, async () => {
      const failure = Object.assign(new Error('Generic internal diagnostic should not reach the UI'), { status: item.status, details: { error: { code: item.code, message: 'Private diagnostic omitted' } } })
      const session = sessionWith(failure)
      const ok = action === 'request'
        ? await session.requestPasswordReset('synthetic@example.invalid')
        : await session.confirmPasswordReset('synthetic@example.invalid', 'synthetic-code', 'synthetic-new-password')
      assert.equal(ok, false)
      assert.equal(session.lastError, item.marker)
      assert.equal(failureCopy.mobileAuthFailureCopy(action === 'request' ? 'resetRequest' : 'resetConfirm', session.lastError, key => key), item.key)
      assert.equal(session.isAuthenticated, false)
      assert.equal(session.lastError.includes('diagnostic'), false)
    })
  }
}
