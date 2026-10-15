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

function loadTs(relativePath) {
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error(`unexpected import in ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

const birthYearModule = loadTs('src/domain/adult-birth-year.ts')

test('mobile onboarding submits a minor year and opens the no-access page', async () => {
  const page = read('src/pages/onboarding/onboarding.vue')
  assert.match(page, /:max="birthYearMax"/)
  assert.match(page, /min="1900"/)
  assert.doesNotMatch(page, /getFullYear\(\)\s*-\s*18/)
  assert.match(page, /这里不提供再试一次，也不提供改年份/)
  assert.doesNotMatch(page, />\s*再试一次\s*<|>\s*改年份\s*</)
  const calls = []
  const opened = []
  const session = vue.reactive({
    adultGate: 'UNKNOWN',
    identityRevision: 1,
    isAuthenticated: true,
    isLearningReady: false,
    lastError: null,
    async confirmAdultGate(year) {
      calls.push(year)
      session.adultGate = 'REJECTED'
      return false
    },
    async restore() {},
    async logout() {},
  })
  const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const compiled = ts.transpileModule(`${script}\nmodule.exports.__fixture = { birthYear, ageConfirmed, adultBirthYearValid, canContinue, step, next }\n`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        '../../components/MobilePageHeader.vue': {},
        '../../platform/experience': { useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'FULL' }) },
        vue,
        '@dcloudio/uni-app': { onHide() {}, onShow() {} },
        '../../api/client': { mobileApiClient: { request: async () => ({}) } },
        '../../platform/uni-runtime': { getUniRuntime: () => ({ navigateTo() {}, reLaunch() {} }), openUniPage: (url) => { opened.push(url) } },
        '../../domain/adult-birth-year': birthYearModule,
        '../../domain/onboarding-consent-copy': {
          emptyConsentChoices: () => ({ ACCOUNT_TERMS: false, PRIVACY_NOTICE: false, ADULT_LEARNING_ELIGIBILITY: false }),
          readPublishedConsentVersion: () => null,
          requiredConsentItems: [],
        },
        '../../domain/onboarding-resume': {
          canonicalGoalOptions: () => [],
          mapUiGoal: (value) => value,
          onboardingProgressLabel: () => '',
          prefillSavedTarget: () => ({ goal: null, quota: null }),
          selectOnboardingResumeStep: () => 'gate',
        },
        '../../stores/learner-content': { useLearnerContentStore: () => ({ goals: [], quotas: [], onboardingResume: null, onboardingStatus: 'ready', lastError: null }) },
        '../../stores/session': { useSessionStore: () => session },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, module, module.exports)
  })
  const fixture = module.exports.__fixture
  try {
    assert.equal(birthYearModule.isSubmittableBirthYear(minorYear), true)
    fixture.birthYear.value = minorYear
    fixture.ageConfirmed.value = true
    assert.equal(fixture.adultBirthYearValid.value, true)
    assert.equal(fixture.canContinue.value, true)
    await fixture.next()
    assert.deepEqual(calls, [minorYear])
    assert.equal(session.adultGate, 'REJECTED')
    assert.deepEqual(opened, ['/pages/forbidden/forbidden'])
  } finally {
    scope.stop()
  }
})
