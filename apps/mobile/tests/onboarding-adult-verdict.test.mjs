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

function sessionWithResponse(response) {
  pinia.setActivePinia(pinia.createPinia())
  let inMemoryToken = 'synthetic-unit-value'
  const module = load('src/stores/session.ts', {
    vue, pinia,
    '../auth/access-token': { getInMemoryAccessToken: () => inMemoryToken, setInMemoryAccessToken: value => { inMemoryToken = value }, setInMemoryRequestIdentity: () => {} },
    '../auth/auth-failure-copy': failureCopy,
    '../auth/gateway-auth': { createGatewayMobileAuthAdapter: () => ({}), safeMobileReturnTo: (value, fallback) => value ?? fallback },
    '../platform/uni-runtime': { getUniRuntime: () => { throw new Error('No native runtime in this unit test') }, isNativeAppRuntime: () => false },
    './learning-cache': { removeAllLearningCaches: () => {} },
  })
  const store = module.useSessionStore()
  store.accessToken = 'synthetic-unit-value'; store.verifiedSubject = 'unit-adult-owner'
  store.status = 'authenticated'; store.adultGate = 'REQUIRED'; store.permissions = ['learning.plan.read']
  store.setAuthAdapter({
    confirmAdultGate: async () => { if (response instanceof Error) throw response; return response },
    refresh: async () => ({ accessToken: 'synthetic-refreshed-value' }),
    getPermissions: async () => ({ ...response, principal: { subject: 'unit-adult-owner' }, permissions: ['learning.plan.read'] }),
  })
  return store
}
for (const verdict of ['REQUIRED', 'UNKNOWN', 'REJECTED', 'PASSED']) test(`the UI preserves the explicit ${verdict} verdict`, async () => {
  const store = sessionWithResponse({ adultGate: verdict, adultLearningAccess: verdict === 'PASSED' ? 'ELIGIBLE' : 'RESTRICTED' })
  assert.equal(await store.confirmAdultGate(1995), verdict === 'PASSED')
  assert.equal(store.adultGate, verdict)
  assert.equal(store.isLearningReady, verdict === 'PASSED')
})
test('a missing verdict remains unknown and cannot enable learning', async () => {
  const store = sessionWithResponse(null)
  assert.equal(await store.confirmAdultGate(1995), false)
  assert.equal(store.adultGate, 'UNKNOWN')
  assert.equal(store.isLearningReady, false)
  assert.equal(store.adultLearningAccess, 'UNKNOWN')
})
test('a transport failure is not a rejected adult eligibility decision', async () => {
  const store = sessionWithResponse(new Error('HTTP 503'))
  assert.equal(await store.confirmAdultGate(1995), false)
  assert.equal(store.adultGate, 'UNKNOWN')
  assert.equal(store.isLearningReady, false)
})
test('a response after logout cannot restore adult or learning access', async () => {
  let finish
  const store = sessionWithResponse(null)
  store.setAuthAdapter({ confirmAdultGate: () => new Promise(resolve => { finish = resolve }) })
  const pending = store.confirmAdultGate(1995)
  store.clear(); finish({ adultGate: 'PASSED' })
  assert.equal(await pending, false)
  assert.equal(store.adultGate, 'UNKNOWN')
  assert.equal(store.isLearningReady, false)
})
for (const access of ['UNKNOWN', 'RESTRICTED', undefined]) test(`passed status with ${access ?? 'missing'} access cannot enable learning`, async () => {
  const store = sessionWithResponse({ adultGate: 'PASSED', adultLearningAccess: access })
  assert.equal(await store.confirmAdultGate(1995), false)
  assert.equal(store.adultGate, 'PASSED')
  assert.equal(store.isLearningReady, false)
})
for (const response of [null, new Error('HTTP 503')]) test(`an unreadable current gate invalidates readiness while preserving authentication`, async () => {
  const store = sessionWithResponse(null)
  store.adultGate = 'PASSED'; store.adultLearningAccess = 'ELIGIBLE'
  store.setAuthAdapter({ getPermissions: async () => { if (response instanceof Error) throw response; return response } })
  assert.equal(store.isLearningReady, true)
  await assert.rejects(store.refreshGateFromServer())
  assert.equal(store.isAuthenticated, true)
  assert.equal(store.adultGate, 'UNKNOWN')
  assert.equal(store.adultLearningAccess, 'UNKNOWN')
  assert.equal(store.isLearningReady, false)
})
