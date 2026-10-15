import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../src/auth/gateway-auth.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function adapter(response) {
  const calls = [], module = { exports: {} }
  const client = { request: async (path, options = {}) => { calls.push({ path, method: options.method ?? 'GET' }); return { data: response } } }
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === '../api/client') return { mobileApiClient: client, mobileIamAuthClient: client, MobileApiError: class extends Error {} }
    if (name === '../platform/gateway') return { safeInternalReturnTo: (_value, fallback) => fallback }
    throw new Error(`Unexpected import ${name}`)
  }, module, module.exports)
  return { adapter: module.exports.createGatewayMobileAuthAdapter(), calls }
}
for (const access of ['ELIGIBLE', 'RESTRICTED', undefined]) test(`current principal preserves ${access ?? 'missing'} eligibility independently of permissions`, async () => {
  const s = adapter({ principalId: 'unit-owner', roles: ['LEARNER'], permissions: ['learning.plan.read'], adultGate: { status: 'PASSED', learningAccess: access } })
  const actual = await s.adapter.getPermissions()
  assert.deepEqual(s.calls, [{ path: '/iam/principal/me', method: 'GET' }])
  assert.equal(actual.principal.subject, 'unit-owner')
  assert.equal(actual.adultGate, 'PASSED')
  assert.equal(actual.adultLearningAccess, access ?? 'UNKNOWN')
})
for (const [status, access, expected] of [['PASSED', 'ELIGIBLE', 'PASSED'], ['PASSED', undefined, 'PASSED'], ['REJECTED', 'RESTRICTED', 'REJECTED'], ['NOT_EVALUATED', 'RESTRICTED', 'REQUIRED']]) test(`adult POST ${status}/${access ?? 'missing'} does not invent qualification or rejection`, async () => {
  const s = adapter({ status, learningAccess: access })
  const actual = await s.adapter.confirmAdultGate({ confirmed: true, birthYear: 1995, policyVersion: 'unit-policy' })
  assert.equal(actual.adultGate, expected)
  assert.equal(actual.adultLearningAccess, access ?? 'UNKNOWN')
  assert.deepEqual(s.calls, [{ path: '/iam/adult-gate', method: 'POST' }])
})
