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

function facts({ adultGate = 'PASSED', consent = { readable: true, accepted: true, unsatisfiedPurposes: [] }, target = { readable: true, saved: false, goal: null, quota: null } } = {}) {
  return { adultGate, consent, target }
}

test('resume step follows the adult gate, required consents and a saved target', () => {
  assert.equal(domain.mapUiGoal('FOUNDATION'), 'ZERO_BASIS')
  assert.equal(domain.mapUiGoal('COLLEGE_CET'), 'CET_4_6')
  assert.equal(domain.mapUiGoal('POSTGRADUATE_ENGLISH'), 'POSTGRADUATE')
  assert.equal(domain.mapUiGoal('WORKPLACE_DAILY'), 'WORKPLACE_DAILY')
  assert.equal(domain.mapUiGoal('ZERO_BASIS'), 'ZERO_BASIS')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 },
  })), 'assessment')
  assert.equal(domain.selectOnboardingResumeStep(facts()), 'goal')
  assert.equal(domain.selectOnboardingResumeStep(facts({ adultGate: 'REJECTED' })), 'rejected')
  assert.equal(domain.selectOnboardingResumeStep(facts({ adultGate: 'NOT_EVALUATED' })), 'gate')
  assert.equal(domain.selectOnboardingResumeStep(facts({ adultGate: 'UNKNOWN' })), 'gate')
  assert.equal(domain.selectOnboardingResumeStep(facts({ adultGate: 'REQUIRED' })), 'gate')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    consent: { readable: true, accepted: true, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] },
    target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 },
  })), 'consent')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    consent: { readable: true, accepted: true, unsatisfiedPurposes: ['PRODUCT_ANALYTICS'] },
    target: { readable: true, saved: true, goal: 'CET_4_6', quota: 30 },
  })), 'assessment')
  assert.equal(domain.selectOnboardingResumeStep(facts({
    consent: { readable: false, accepted: null, unsatisfiedPurposes: [] },
  })), 'consent')
  const unreadableTarget = facts({ target: { readable: false, saved: false, goal: null, quota: null } })
  assert.equal(domain.selectOnboardingResumeStep(unreadableTarget), 'goal')
  assert.equal(domain.onboardingProgressLabel(unreadableTarget), '学习目标暂时无法读取')
  assert.equal(domain.onboardingProgressLabel(facts({ consent: { readable: false, accepted: null, unsatisfiedPurposes: [] } })), '必要同意暂时无法读取')
  assert.equal(domain.ONBOARDING_GUIDE_ACTION, '继续设置，开始学习')
  const saved = facts({ target: { readable: true, saved: true, goal: 'ZERO_BASIS', quota: 15 } })
  assert.equal(domain.showOnboardingGuide(saved, false), true)
  assert.equal(domain.showOnboardingGuide(saved, true), false)
  assert.equal(domain.showOnboardingGuide(facts({ adultGate: 'REJECTED' }), false), false)
  assert.equal(domain.showOnboardingGuide(facts(), false), true)
  assert.equal(domain.isPlacementSatisfied({ planId: 'plan-100012' }), true)
  assert.equal(domain.isPlacementSatisfied({ hasPlan: true }), true)
  assert.equal(domain.isPlacementSatisfied({ placementEntryReached: true }), true)
  assert.equal(domain.isPlacementSatisfied({}), false)
  assert.equal(domain.showOnboardingGuide(saved, false, { serverPlacementUnknown: true }), false)
  assert.deepEqual(domain.onboardingRemainingStepLabels(saved, true), [])
  assert.deepEqual(domain.onboardingRemainingStepLabels(saved, false), ['定级'])
  const storage = new Map()
  const session = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
  assert.equal(domain.hasPlacementEntryReached(session, 'learner-a'), false)
  domain.markPlacementEntryReached(session, 'learner-a')
  assert.equal(session.getItem('yx.onboarding.placement-entry.learner-a'), '1')
  assert.equal(domain.hasPlacementEntryReached(session, 'learner-a'), true)
  assert.equal(domain.hasPlacementEntryReached(session, 'learner-b'), false)
})

class ApiError extends Error {
  constructor(status, details = {}) { super(`HTTP ${status}`); this.status = status; this.details = details }
}

function portFor(request) {
  return load('src/api/learner-content.ts', {
    './client': { ApiError, apiClient: { request } },
    '../domain/learner-content': { LearnerContentReadModelError: class extends Error {} },
    '../domain/b1': { assessmentQuestions: [], createDefaultAssessment: () => ({}), createDefaultOnboarding: () => ({}), dailyQuotaOptions: [5, 15, 30, 45], targetGoals: [] },
  }).learnerContentPort
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

const passedConsent = {
  adultGate: 'PASSED',
  consentState: { accepted: true, unsatisfiedPurposes: [], version: 'b30-consent-v1' },
}

test('GET target maps a saved FOUNDATION row and does not invent a missing target', async () => {
  const { calls, request } = responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15 },
  })
  const facts = await portFor(request).readOnboardingResume()
  assert.equal(facts.target.saved, true)
  assert.equal(facts.target.goal, 'ZERO_BASIS')
  assert.equal(facts.target.quota, 15)
  assert.deepEqual(calls, ['/iam/principal/me', '/learner/targets'])
  assert.equal(domain.selectOnboardingResumeStep(facts), 'assessment')
})

test('a 404 target is a readable empty goal, and a failed read is not an empty goal', async () => {
  const missing = responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new ApiError(404),
  })
  const absent = await portFor(missing.request).readOnboardingResume()
  assert.equal(absent.target.readable, true)
  assert.equal(absent.target.saved, false)
  assert.equal(domain.selectOnboardingResumeStep(absent), 'goal')
  assert.equal(domain.onboardingProgressLabel(absent), '还需要保存学习目标')

  const failed = responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new Error('offline'),
  })
  const unreadable = await portFor(failed.request).readOnboardingResume()
  assert.equal(unreadable.target.readable, false)
  assert.equal(unreadable.target.saved, false)
  assert.equal(domain.onboardingProgressLabel(unreadable), '学习目标暂时无法读取')
})

test('the adult gate and required consents are read before a target row', async () => {
  const unevaluated = responder({
    '/iam/principal/me': { adultGate: { status: 'NOT_EVALUATED' } },
    '/learner/targets': { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15 },
  })
  const gate = await portFor(unevaluated.request).readOnboardingResume()
  assert.equal(gate.adultGate, 'REQUIRED')
  assert.deepEqual(unevaluated.calls, ['/iam/principal/me'])
  assert.equal(domain.selectOnboardingResumeStep(gate), 'gate')

  const rejected = await portFor(responder({
    '/iam/principal/me': { adultGate: 'REJECTED' },
  }).request).readOnboardingResume()
  assert.equal(domain.selectOnboardingResumeStep(rejected), 'rejected')

  const consent = responder({
    '/iam/principal/me': { adultGate: 'PASSED', consentState: { accepted: true, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] } },
    '/learner/targets': new ApiError(403, { error: { code: 'CONSENT_REQUIRED' } }),
  })
  const blocked = await portFor(consent.request).readOnboardingResume()
  assert.equal(domain.selectOnboardingResumeStep(blocked), 'consent')
  assert.equal(blocked.consent.readable, true)
  assert.equal(blocked.consent.accepted, false)

  const analytics = await portFor(responder({
    '/iam/principal/me': { adultGate: 'PASSED', consentState: { accepted: true, unsatisfiedPurposes: ['PRODUCT_ANALYTICS'] } },
    '/learner/targets': { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 45 },
  }).request).readOnboardingResume()
  assert.equal(domain.selectOnboardingResumeStep(analytics), 'assessment')

  const unknownConsent = await portFor(responder({
    '/iam/principal/me': { adultGate: 'PASSED' },
    '/learner/targets': new ApiError(404),
  }).request).readOnboardingResume()
  assert.equal(unknownConsent.consent.readable, false)
  assert.equal(domain.selectOnboardingResumeStep(unknownConsent), 'consent')
})

test('onboarding and home copy stays on server facts and does not promise a local draft', () => {
  const page = read('src/pages/OnboardingPage.vue')
  const home = read('src/pages/HomePage.vue')
  const router = read('src/router/index.ts')
  const banned = [/3 击/, /3 分钟/, /已存本机/, /目标草稿已保存在本地/, /placement\/sessions/, /FIRST DAY/, /firstDay/, /registeredAt/]
  for (const source of [page, home, read('src/domain/onboarding-resume.ts')]) {
    for (const pattern of banned) assert.doesNotMatch(source, pattern)
  }
  assert.match(page, /await store\.loadOnboardingResume\(true\)/)
  assert.match(page, /await store\.loadOnboarding\(\)/)
  assert.match(page, /离开后不会保留/)
  assert.match(page, /开始定级/)
  assert.match(page, /prefillSavedTarget\(facts\.target\)/)
  assert.match(page, /canonicalGoalOptions\(/)
  assert.match(page, /targetGoal\.value = null/)
  assert.match(page, /data-primary-action="step === 'assessment' \? 'assessment' : 'save-target'"/)
  assert.match(page, /name: 'forbidden'/)
  assert.match(page, /name: 'assessment'/)
  assert.doesNotMatch(page, /saveOnboarding|setConsent|跳过测评|快速开始|每日提醒/)
  assert.match(home, /ONBOARDING_GUIDE_ACTION/)
  assert.match(home, /onboardingRemainingStepLabels/)
  assert.match(home, /剩余步骤/)
  assert.match(home, /store\.loadHome\(\)/)
  assert.match(home, /showOnboardingGuide/)
  assert.doesNotMatch(home, /\/assessment\/placement\/start|快速开始|已存本机|目标草稿已保存在本地/)
  assert.match(router, /loadOnboardingResume/)
  assert.match(router, /facts\.target\.readable && !facts\.target\.saved/)
  assert.match(router, /markPlacementEntryReached/)
})

test('saved target prefills the canonical code and the primary action stays assessment', () => {
  assert.equal(domain.canonicalGoalCode('FOUNDATION'), 'FOUNDATION')
  assert.equal(domain.canonicalGoalCode('COLLEGE_CET'), 'COLLEGE_CET')
  assert.equal(domain.canonicalGoalCode('POSTGRADUATE_ENGLISH'), 'POSTGRADUATE_ENGLISH')
  assert.equal(domain.canonicalGoalCode('WORKPLACE_DAILY'), 'WORKPLACE_DAILY')
  assert.equal(domain.canonicalGoalCode('CET_4_6'), 'COLLEGE_CET')
  assert.equal(domain.canonicalGoalCode('ZERO_BASIS'), 'FOUNDATION')
  assert.equal(domain.canonicalGoalCode('POSTGRADUATE'), 'POSTGRADUATE_ENGLISH')
  assert.equal(domain.canonicalGoalCode('WORKPLACE'), 'WORKPLACE_DAILY')
  assert.equal(domain.canonicalGoalCode('LANGUAGE_CERT'), null)
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'COLLEGE_CET', quota: 30 }), { goal: 'COLLEGE_CET', quota: 30 })
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'CET_4_6', quota: 30 }), { goal: 'COLLEGE_CET', quota: 30 })
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'FOUNDATION', quota: 15 }), { goal: 'FOUNDATION', quota: 15 })
  assert.deepEqual(domain.prefillSavedTarget({ saved: false, goal: null, quota: null }), { goal: null, quota: null })
  assert.deepEqual(domain.prefillSavedTarget({ saved: false, goal: 'FOUNDATION', quota: 15 }), { goal: null, quota: null })
  assert.deepEqual(domain.prefillSavedTarget({ saved: true, goal: 'LANGUAGE_CERT', quota: 15 }), { goal: null, quota: null })
  const options = domain.canonicalGoalOptions([
    { value: 'CET_4_6', label: 'CET_4_6', description: 'CET_4_6' },
    { value: 'COLLEGE_CET', label: '四六级备考', description: '服务端说明' },
    { value: 'LANGUAGE_CERT', label: '语言考试', description: '不应出现' },
  ])
  assert.deepEqual(options, [{ value: 'COLLEGE_CET', label: '四六级备考', description: '服务端说明' }])
  assert.equal(domain.canonicalGoalOptions([]).some((item) => item.value === 'CET_4_6' || item.label === 'CET_4_6'), false)
  assert.deepEqual(domain.canonicalGoalOptions([]).map((item) => item.value), ['FOUNDATION', 'COLLEGE_CET', 'POSTGRADUATE_ENGLISH', 'WORKPLACE_DAILY'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts({ adultGate: 'REQUIRED' })), ['确认身份', '必要同意', '学习目标'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts({
    consent: { readable: true, accepted: false, unsatisfiedPurposes: ['ACCOUNT_TERMS'] },
  })), ['必要同意', '学习目标'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts()), ['学习目标'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts({
    target: { readable: true, saved: true, goal: 'FOUNDATION', quota: 15 },
  })), ['定级'])
  assert.deepEqual(domain.onboardingRemainingStepLabels(facts({ adultGate: 'REJECTED' })), [])
})

test('form prefill follows GET canonical goalCode and does not keep a stored alias', async () => {
  const college = await portFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': { goalCode: 'COLLEGE_CET', dailyQuotaMinutes: 30 },
  }).request).readOnboardingResume()
  assert.equal(college.target.goal, 'CET_4_6')
  assert.deepEqual(domain.prefillSavedTarget(college.target), { goal: 'COLLEGE_CET', quota: 30 })
  assert.equal(domain.selectOnboardingResumeStep(college), 'assessment')

  const alias = await portFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': { goalCode: 'CET_4_6', dailyQuotaMinutes: 30 },
  }).request).readOnboardingResume()
  assert.deepEqual(domain.prefillSavedTarget(alias.target), { goal: 'COLLEGE_CET', quota: 30 })
  assert.notEqual(domain.prefillSavedTarget(alias.target).goal, 'CET_4_6')

  const missing = await portFor(responder({
    '/iam/principal/me': passedConsent,
    '/learner/targets': new ApiError(404),
  }).request).readOnboardingResume()
  assert.deepEqual(domain.prefillSavedTarget(missing.target), { goal: null, quota: null })
})
