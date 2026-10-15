import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

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

const domain = load('src/domain/onboarding-resume.ts', {})

function facts({ adultGate = 'PASSED', adultLearningAccess = 'ELIGIBLE', consent = { readable: true, accepted: true, unsatisfiedPurposes: [] }, target = { readable: true, saved: false, goal: null, quota: null } } = {}) {
  return { adultGate, adultLearningAccess, consent, target }
}

test('mobile resume step matches the web facts: gate, consent, target, then placement entry', () => {
  assert.equal(domain.mapUiGoal('FOUNDATION'), 'ZERO_BASIS')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 },
  })), 'assessment')
  assert.equal(domain.selectOnboardingResumeStep(facts()), 'goal')
  assert.equal(domain.selectOnboardingResumeStep(facts({ adultGate: 'REJECTED' })), 'rejected')
  assert.equal(domain.selectOnboardingResumeStep(facts({ adultGate: 'NOT_EVALUATED' })), 'gate')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    consent: { readable: true, accepted: false, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] },
  })), 'consent')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    consent: { readable: true, accepted: true, unsatisfiedPurposes: ['PRODUCT_ANALYTICS'] },
    target: { readable: true, saved: true, goal: 'WORKPLACE_DAILY', quota: 15 },
  })), 'assessment')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    consent: { readable: false, accepted: null, unsatisfiedPurposes: [] },
  })), 'consent')
  const unreadableTarget = facts({ target: { readable: false, saved: false, goal: null, quota: null } })
  assert.equal(domain.selectOnboardingResumeStep(unreadableTarget), 'goal')
  assert.equal(domain.onboardingProgressLabel(unreadableTarget), '学习目标暂时无法读取')
  assert.equal(domain.ONBOARDING_GUIDE_ACTION, '继续设置，开始学习')
  const saved = facts({ target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 } })
  assert.equal(domain.showOnboardingGuide(saved, false), true)
  assert.equal(domain.showOnboardingGuide(saved, true), false)
  assert.equal(domain.showOnboardingGuide(facts({ adultGate: 'REQUIRED' }), false), true)
  assert.equal(domain.isPlacementSatisfied({ planId: 'plan-1' }), true)
  assert.equal(domain.showOnboardingGuide(saved, false, { serverPlacementUnknown: true }), false)
  assert.deepEqual(domain.onboardingRemainingStepLabels(saved, true), [])
})

test('a saved target cannot advance resume without explicit eligible adult access', () => {
  const saved = facts({ target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 } })
  const { adultLearningAccess: omitted, ...missingAccess } = saved
  assert.equal(domain.selectOnboardingResumeStep(missingAccess), 'gate')
  assert.equal(domain.selectOnboardingResumeStep({ ...saved, adultLearningAccess: 'RESTRICTED' }), 'gate')
})

class MobileApiError extends Error {
  constructor(status, details = {}) { super(`HTTP ${status}`); this.status = status; this.details = details }
}

function apiFor(request) {
  return load('src/api/learner-content.ts', {
    './client': { mobileApiClient: { request }, MobileApiError },
  }).mobileLearnerContentApi
}

function responder(routes) {
  const calls = []
  const request = async (path) => {
    calls.push(path)
    if (!(path in routes)) throw new Error(`unexpected ${path}`)
    const result = routes[path]
    if (result instanceof Error) throw result
    return result
  }
  return { calls, request }
}

const adultGate = {
  status: 'PASSED', learningAccess: 'ELIGIBLE', effectiveAt: '2026-10-15T00:00:00Z',
  policyVersion: 'b30-adult-v1', minimumAge: 18, evidenceStatus: 'SERVER_VERIFIED', retryAllowed: false,
}
const passedConsent = {
  principalId: '00000000-0000-4000-8000-00000000000a',
  tenantId: 'fixture-platform',
  sessionId: '00000000-0000-4000-8000-000000000010',
  deviceId: '00000000-0000-4000-8000-000000000020',
  roles: ['learner'], permissions: ['learning.plan.read'], authMode: 'self-owned-jwt', status: 'ACTIVE',
  adultGate,
  consentState: { accepted: true, unsatisfiedPurposes: [], version: 'b30-consent-v1' },
}

const { learningAccess: omittedAccess, ...adultGateWithoutAccess } = adultGate
for (const [name, wireAdultGate, expectedAccess] of [
  ['missing access', adultGateWithoutAccess, 'UNKNOWN'],
  ['restricted access', { ...adultGate, learningAccess: 'RESTRICTED' }, 'RESTRICTED'],
  ['legacy PASSED string', 'PASSED', 'UNKNOWN'],
]) {
  test(`mobile does not request targets for ${name}, despite accepted consent`, async () => {
    const denied = responder({
      '/iam/principal/me': { ...passedConsent, adultGate: wireAdultGate },
      '/learner/targets': { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15 },
    })
    const row = await apiFor(denied.request).readOnboardingResume()
    assert.equal(row.adultLearningAccess, expectedAccess)
    assert.equal(domain.selectOnboardingResumeStep(row), 'gate')
    assert.deepEqual(row.target, { readable: true, saved: false, goal: null, quota: null })
    assert.deepEqual(denied.calls, ['/iam/principal/me'])
  })
}

test('an unavailable IAM principal read fails before any learner target request', async () => {
  const unavailable = responder({
    '/iam/principal/me': new MobileApiError(503),
    '/learner/targets': { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15 },
  })
  await assert.rejects(apiFor(unavailable.request).readOnboardingResume(), { status: 503 })
  assert.deepEqual(unavailable.calls, ['/iam/principal/me'])
})

test('mobile GET target maps FOUNDATION and keeps a 404 distinct from a failed read', async () => {
  const saved = responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15 },
  })
  const row = await apiFor(saved.request).readOnboardingResume()
  assert.equal(row.target.goal, 'ZERO_BASIS')
  assert.equal(row.target.saved, true)
  assert.equal(domain.selectOnboardingResumeStep(row), 'assessment')

  const missing = await apiFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new MobileApiError(404),
  }).request).readOnboardingResume()
  assert.equal(missing.target.readable, true)
  assert.equal(missing.target.saved, false)
  assert.equal(domain.selectOnboardingResumeStep(missing), 'goal')

  const failed = await apiFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new Error('offline'),
  }).request).readOnboardingResume()
  assert.equal(failed.target.readable, false)
  assert.equal(domain.onboardingProgressLabel(failed), '学习目标暂时无法读取')
})

test('mobile does not read a target before the gate passes, and optional analytics do not block', async () => {
  const unevaluated = responder({
    '/iam/principal/me': { ...passedConsent, adultGate: { ...adultGate, status: 'NOT_EVALUATED', learningAccess: 'RESTRICTED', evidenceStatus: 'INSUFFICIENT' } },
    '/learner/targets': { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15 },
  })
  const gate = await apiFor(unevaluated.request).readOnboardingResume()
  assert.equal(gate.adultGate, 'REQUIRED')
  assert.deepEqual(unevaluated.calls, ['/iam/principal/me'])
  assert.equal(domain.selectOnboardingResumeStep(gate), 'gate')

  const rejected = await apiFor(responder({
    '/iam/principal/me': { ...passedConsent, adultGate: { ...adultGate, status: 'REJECTED', learningAccess: 'RESTRICTED', evidenceStatus: 'REJECTED' } },
  }).request).readOnboardingResume()
  assert.equal(domain.selectOnboardingResumeStep(rejected), 'rejected')

  const required = await apiFor(responder({
    '/iam/principal/me': { ...passedConsent, consentState: { ...passedConsent.consentState, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] } },
    '/learner/targets': new MobileApiError(403, { code: 'CONSENT_REQUIRED' }),
  }).request).readOnboardingResume()
  assert.equal(domain.selectOnboardingResumeStep(required), 'consent')

  const analytics = await apiFor(responder({
    '/iam/principal/me': { ...passedConsent, consentState: { ...passedConsent.consentState, unsatisfiedPurposes: ['PRODUCT_ANALYTICS'] } },
    '/learner/targets': { goalCode: 'COLLEGE_CET', dailyQuotaMinutes: 30 },
  }).request).readOnboardingResume()
  assert.equal(analytics.target.goal, 'CET_4_6')
  assert.equal(domain.selectOnboardingResumeStep(analytics), 'assessment')
})

test('a target consent 403 preserves IAM acceptance and pauses for session refresh', async () => {
  const staleSession = responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new MobileApiError(403, { code: 'CONSENT_REQUIRED' }),
  })
  const row = await apiFor(staleSession.request).readOnboardingResume()
  assert.deepEqual(row.consent, { readable: true, accepted: true, unsatisfiedPurposes: [] })
  assert.equal(row.sessionRefreshRequired, true)
  assert.deepEqual(row.target, { readable: false, saved: false, goal: null, quota: null })
  assert.equal(domain.selectOnboardingResumeStep(row), 'consent')
  assert.equal(domain.selectOnboardingResumeStep({
    ...row, target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 },
  }), 'consent', 'A cached saved target cannot authorize advancement while refresh is required')
  assert.deepEqual(staleSession.calls, ['/iam/principal/me', '/learner/targets'])
})

test('mobile onboarding, home and guard stay aligned with the server resume', () => {
  const page = read('src/pages/onboarding/onboarding.vue')
  const home = read('src/pages/home/home.vue')
  const navigation = read('src/auth/navigation.ts')
  const assessment = read('src/pages/assessment/assessment.vue')
  const banned = [/3 击/, /3 分钟/, /已存本机/, /目标草稿已保存在本地/, /placement\/sessions/, /FIRST DAY/, /firstDay/, /registeredAt/]
  for (const source of [page, home, read('src/domain/onboarding-resume.ts')]) {
    for (const pattern of banned) assert.doesNotMatch(source, pattern)
  }
  assert.match(page, /loadOnboardingResume\(true\)/)
  assert.match(page, /prefillSavedTarget\(facts\.target\)/)
  assert.match(page, /store\.saveTarget\(/)
  assert.match(page, /goal\.value = null/)
  assert.match(page, /\/pages\/forbidden\/forbidden/)
  assert.match(page, /\/pages\/assessment\/assessment/)
  assert.doesNotMatch(page, /saveOnboarding|跳过测评|快速开始|每日提醒/)
  assert.match(home, /ONBOARDING_GUIDE_ACTION/)
  assert.match(home, /onboardingRemainingStepLabels/)
  assert.match(home, /剩余步骤/)
  assert.match(home, /ensureMobilePageAccess\('\/pages\/home\/home'\)/)
  assert.match(home, /store\.loadHome\(\)/)
  assert.doesNotMatch(home, /\/assessment\/placement\/start|快速开始|已存本机|目标草稿已保存在本地/)
  assert.match(navigation, /adultGate !== 'REJECTED'/)
  assert.match(navigation, /loadOnboardingResume/)
  assert.match(navigation, /facts\.target\.readable && !facts\.target\.saved/)
  assert.match(assessment, /markPlacementEntryReached/)
  assert.doesNotMatch(assessment, /placement\/sessions/)
})

test('mobile prefill uses the canonical target code and does not invent a goal', () => {
  assert.equal(domain.canonicalGoalCode('COLLEGE_CET'), 'COLLEGE_CET')
  assert.equal(domain.canonicalGoalCode('CET_4_6'), 'COLLEGE_CET')
  assert.equal(domain.canonicalGoalCode('WORKPLACE'), 'WORKPLACE_DAILY')
  assert.equal(domain.canonicalGoalCode('LANGUAGE_CERT'), null)
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'FOUNDATION', quota: 15 }), { goal: 'FOUNDATION', quota: 15 })
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'CET_4_6', quota: 45 }), { goal: 'COLLEGE_CET', quota: 45 })
  assert.deepEqual(domain.prefillSavedTarget({ saved: false, goal: null, quota: 15 }), { goal: null, quota: null })
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'DAILY_ENGLISH_FOUNDATION', quota: 15 }), { goal: null, quota: null })
  const shown = domain.canonicalGoalOptions([
    { value: 'ZERO_BASIS', label: 'ZERO_BASIS', description: 'ZERO_BASIS' },
    { value: 'WORKPLACE', label: 'WORKPLACE', description: '别名' },
  ])
  assert.deepEqual(shown.map((item) => item.value), ['FOUNDATION', 'WORKPLACE_DAILY'])
  assert.equal(shown.some((item) => item.label === 'ZERO_BASIS' || item.label === 'WORKPLACE' || item.value === 'CET_4_6'), false)
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts({ adultGate: 'REQUIRED' })), ['确认身份', '必要同意', '学习目标'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts()), ['学习目标'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts({
    target: { readable: true, saved: true, goal: 'WORKPLACE_DAILY', quota: 15 },
  })), ['定级'])
})

test('mobile form prefill follows GET canonical goalCode and does not keep a stored alias', async () => {
  const college = await apiFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': { goalCode: 'COLLEGE_CET', dailyQuotaMinutes: 30 },
  }).request).readOnboardingResume()
  assert.equal(college.target.goal, 'CET_4_6')
  assert.deepEqual(domain.prefillSavedTarget(college.target), { goal: 'COLLEGE_CET', quota: 30 })
  assert.equal(domain.selectOnboardingResumeStep(college), 'assessment')

  const alias = await apiFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': { goalCode: 'POSTGRADUATE', dailyQuotaMinutes: 45 },
  }).request).readOnboardingResume()
  assert.deepEqual(domain.prefillSavedTarget(alias.target), { goal: 'POSTGRADUATE_ENGLISH', quota: 45 })

  const missing = await apiFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new MobileApiError(404),
  }).request).readOnboardingResume()
  assert.deepEqual(domain.prefillSavedTarget(missing.target), { goal: null, quota: null })
})
