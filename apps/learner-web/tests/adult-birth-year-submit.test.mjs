import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const vue = createRequire(import.meta.url)('vue')
const minorYear = new Date().getFullYear() - 10

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTs(relativePath, modules = {}) {
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`unexpected import ${name} from ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

const birthYearModule = loadTs('src/domain/adult-birth-year.ts')

function loadSetup(relativePath, modules, exposed) {
  const script = read(relativePath).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, relativePath)
  const compiled = ts.transpileModule(`${script}\nmodule.exports.__fixture = { ${exposed.join(', ')} }\n`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      if (!(name in modules)) throw new Error(`unexpected import ${name} from ${relativePath}`)
      return modules[name]
    }, module, module.exports)
  })
  return { fixture: module.exports.__fixture, stop: () => scope.stop() }
}

test('a minor year is inside the submittable range and an under-18 cutoff is not', () => {
  const currentYear = 2026
  assert.equal(birthYearModule.isSubmittableBirthYear(2016, currentYear), true)
  assert.equal(birthYearModule.isSubmittableBirthYear(currentYear, currentYear), true)
  assert.equal(birthYearModule.isSubmittableBirthYear(1900, currentYear), true)
  assert.equal(birthYearModule.isSubmittableBirthYear(1899, currentYear), false)
  assert.equal(birthYearModule.isSubmittableBirthYear(currentYear + 1, currentYear), false)
  assert.equal(birthYearModule.isSubmittableBirthYear(2016.5, currentYear), false)
  assert.equal(birthYearModule.currentBirthYearMax(new Date('2026-10-11T00:00:00+08:00')), 2026)
})

test('AdultGatePage submits a minor year and opens the forbidden page', async () => {
  const page = read('src/pages/AdultGatePage.vue')
  assert.match(page, /:max="birthYearMax"/)
  assert.doesNotMatch(page, /getFullYear\(\)\s*-\s*18/)
  assert.doesNotMatch(page, /再试一次|改年份/)
  const calls = []
  const replaced = []
  const session = vue.reactive({
    adultGate: 'UNKNOWN',
    lastError: null,
    async confirmAdultGate(year) {
      calls.push(year)
      session.adultGate = 'REJECTED'
      return false
    },
    consumeReturnTo() { return '/home' },
    async logout() {},
  })
  const { fixture, stop } = loadSetup('src/pages/AdultGatePage.vue', {
    '../layouts/AuthLayout.vue': {},
    vue,
    'vue-router': { useRouter: () => ({ replace: async (target) => { replaced.push(target) } }) },
    '../auth/i18n': { authT: (key) => key },
    '../domain/adult-birth-year': birthYearModule,
    '../stores/b1': { useB1Store: () => ({ onboarding: { birthYear: null } }) },
    '../stores/session': { useSessionStore: () => session },
  }, ['birthYear', 'canConfirm', 'confirm'])
  try {
    fixture.birthYear.value = minorYear
    assert.equal(fixture.canConfirm.value, true)
    await fixture.confirm()
    assert.deepEqual(calls, [minorYear])
    assert.equal(session.adultGate, 'REJECTED')
    assert.deepEqual(replaced, [{ name: 'forbidden' }])
  } finally {
    stop()
  }
})

test('OnboardingPage submits a minor year and leaves for the forbidden page', async () => {
  const page = read('src/pages/OnboardingPage.vue')
  assert.match(page, /:max="birthYearMax"/)
  assert.doesNotMatch(page, /getFullYear\(\)\s*-\s*18/)
  assert.doesNotMatch(page, />\s*再试一次\s*<|>\s*改年份\s*</)
  const calls = []
  const replaced = []
  const session = vue.reactive({
    adultGate: 'UNKNOWN',
    lastError: null,
    async confirmAdultGate(year) {
      calls.push(year)
      session.adultGate = 'REJECTED'
      return false
    },
    async logout() {},
  })
  const { fixture, stop } = loadSetup('src/pages/OnboardingPage.vue', {
    '../components/AppIcon.vue': {},
    vue,
    'vue-router': { useRouter: () => ({ replace: async (target) => { replaced.push(target) } }) },
    '../api/client': { apiClient: { request: async () => ({}) } },
    '../domain/b1': { dailyQuotaOptions: [15], subTags: [], targetGoals: [] },
    '../domain/onboarding-consent-copy': {
      emptyConsentChoices: () => ({ ACCOUNT_TERMS: false, PRIVACY_NOTICE: false, ADULT_LEARNING_ELIGIBILITY: false }),
      readPublishedConsentVersion: () => null,
      requiredConsentItems: [],
    },
    '../domain/adult-birth-year': birthYearModule,
    '../domain/onboarding-resume': {
      canonicalGoalOptions: () => [],
      mapUiGoal: (value) => value,
      onboardingProgressLabel: () => '',
      prefillSavedTarget: () => ({ goal: null, quota: null }),
      selectOnboardingResumeStep: () => 'gate',
    },
    '../stores/learner-content': { useLearnerContentStore: () => ({ onboardingOptions: [], onboardingQuotas: [], onboardingResume: null, onboardingStatus: 'ready', lastError: null }) },
    '../stores/session': { useSessionStore: () => session },
    '../auth/gateway-auth': {},
    '../platform/user-facing-error': { userFacingError: (value) => value },
  }, ['birthYear', 'ageConfirmed', 'adultBirthYearValid', 'canContinue', 'step', 'next'])
  try {
    fixture.birthYear.value = minorYear
    fixture.ageConfirmed.value = true
    assert.equal(fixture.step.value, 'gate')
    assert.equal(fixture.adultBirthYearValid.value, true)
    assert.equal(fixture.canContinue.value, true)
    await fixture.next()
    assert.deepEqual(calls, [minorYear])
    assert.equal(session.adultGate, 'REJECTED')
    assert.deepEqual(replaced, [{ name: 'forbidden' }])
  } finally {
    stop()
  }
})
