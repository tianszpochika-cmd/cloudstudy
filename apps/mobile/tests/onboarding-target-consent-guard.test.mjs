import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/api/learner-content.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
class MobileApiError extends Error { constructor(status) { super(`HTTP ${status}`); this.status = status } }
function setup(principal, invalidateOnRead = false, preferenceOverrides = {}, targetReadError = null) {
  let current = true, target = null, version = 1
  const calls = []
  const prefs = { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', ...preferenceOverrides }
  const request = async (url, options = {}) => {
    const path = url.split('?')[0], method = options.method ?? 'GET'
    calls.push({ path, method })
    if (path === '/iam/principal/me') { if (invalidateOnRead) current = false; if (principal instanceof Error) throw principal; return { data: principal } }
    if (path === '/iam/consents') throw new Error('Target editing must not sign consent')
    if (path === '/learner/profile') return { data: { stateVersion: version, status: 'ONBOARDING' } }
    if (path === '/learner/preferences' && method === 'PATCH') { assert.equal(options.data.expectedStateVersion, version); Object.assign(prefs, options.data, { stateVersion: ++version }); return { data: prefs } }
    if (path === '/learner/preferences') return { data: prefs }
    if (path === '/learner/targets' && method === 'GET') { if (targetReadError) throw targetReadError; if (!target) throw new MobileApiError(404); return { data: target } }
    if (path === '/learner/targets' && method === 'PUT') { assert.equal(options.data.expectedStateVersion, version); target = { ...options.data, stateVersion: ++version }; return { data: target } }
    if (path === '/onboarding/options') return { data: {} }
    throw new Error(`Unexpected ${method} ${path}`)
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => { assert.equal(name, './client'); return { mobileApiClient: { request }, MobileApiError } }, module, module.exports)
  return { api: module.exports.mobileLearnerContentApi, calls, preferences: prefs, isCurrent: () => current }
}
const complete = { adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' }, consentState: { accepted: true, unsatisfiedPurposes: [] } }
const input = { goal: 'ZERO_BASIS', quota: 15, consentsRecorded: true, clientEventId: 'mobile-target-guard-fixture-1' }
test('an already confirmed target edit reads current IAM facts and writes only learner owner', async () => {
  const s = setup(complete)
  await s.api.saveOnboarding(input, s.isCurrent)
  assert.deepEqual(s.calls[0], { path: '/iam/principal/me', method: 'GET' })
  assert.equal(s.calls.filter(x => x.path === '/iam/consents').length, 0)
  assert.equal(s.calls.filter(x => x.path === '/learner/targets' && x.method === 'PUT').length, 1)
})
for (const [name, facts] of [
  ['missing consent projection', { adultGate: complete.adultGate }],
  ['current version no longer accepted', { ...complete, consentState: { accepted: false, unsatisfiedPurposes: ['ACCOUNT_TERMS'] } }],
  ['inconsistent required purposes', { ...complete, consentState: { accepted: true, unsatisfiedPurposes: ['PRIVACY_NOTICE'] } }],
  ['adult gate not evaluated', { ...complete, adultGate: { status: 'NOT_EVALUATED', learningAccess: 'RESTRICTED' } }],
  ['passed status without eligibility', { ...complete, adultGate: { status: 'PASSED' } }],
  ['passed but explicitly restricted', { ...complete, adultGate: { status: 'PASSED', learningAccess: 'RESTRICTED' } }],
  ['transport failure', new MobileApiError(503)],
]) test(`${name} does not sign documents or write a target`, async () => {
  const s = setup(facts)
  await assert.rejects(s.api.saveOnboarding(input, s.isCurrent))
  assert.deepEqual(s.calls, [{ path: '/iam/principal/me', method: 'GET' }])
})
test('identity changed during the IAM read cannot write the previous owner target', async () => {
  const s = setup(complete, true)
  await assert.rejects(s.api.saveOnboarding(input, s.isCurrent))
  assert.equal(s.calls.length, 1)
})
test('changing a goal preserves existing interface and content language, theme, accessibility and motion preferences', async () => {
  const chosen = { uiLocale: 'en-US', contentLocale: 'en-US', timezone: 'UTC', themeMode: 'DARK', highContrast: true, motionMode: 'OFF' }
  const s = setup(complete, false, chosen)
  await s.api.saveOnboarding(input, s.isCurrent)
  assert.equal(s.calls.filter(x => x.path === '/learner/preferences' && x.method === 'PATCH').length, 0)
  for (const [key, value] of Object.entries(chosen)) assert.equal(s.preferences[key], value)
})
test('current IAM acceptance is preserved when an older protected read needs refreshed claims', async () => {
  const denied = new MobileApiError(403); denied.details = { code: 'CONSENT_REQUIRED' }
  const s = setup(complete, false, {}, denied)
  const facts = await s.api.readOnboardingResume()
  assert.equal(facts.consent.accepted, true)
  assert.equal(facts.sessionRefreshRequired, true)
  assert.equal(facts.target.readable, false)
  assert.deepEqual(s.calls, [{ path: '/iam/principal/me', method: 'GET' }, { path: '/learner/targets', method: 'GET' }])
})
test('missing current consent is not presented as a session refresh that could restore access', async () => {
  const denied = new MobileApiError(403); denied.details = { code: 'CONSENT_REQUIRED' }
  const s = setup({ ...complete, consentState: { accepted: false, unsatisfiedPurposes: ['ACCOUNT_TERMS'] } }, false, {}, denied)
  const facts = await s.api.readOnboardingResume()
  assert.equal(facts.consent.accepted, false)
  assert.equal(facts.sessionRefreshRequired, false)
  assert.equal(facts.target.readable, false)
})
