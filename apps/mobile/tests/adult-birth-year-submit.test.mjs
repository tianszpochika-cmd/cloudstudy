import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const vue = createRequire(import.meta.url)('vue')
const minorYear = 2016

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTs(relativePath, modules = {}) {
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

const birthYearModule = loadTs('src/domain/adult-birth-year.ts')
const resumeModule = loadTs('src/domain/onboarding-resume.ts')

test('birth year validation accepts integer year bounds without deciding adulthood', () => {
  const maxYear = birthYearModule.currentBirthYearMax(new Date('2026-10-15T00:00:00Z'))
  assert.equal(maxYear, 2026)
  for (const year of [1900, minorYear, maxYear]) assert.equal(birthYearModule.isSubmittableBirthYear(year, maxYear), true)
  for (const year of [1899, maxYear + 1, 2016.5, '2016', null, undefined, NaN, Infinity]) {
    assert.equal(birthYearModule.isSubmittableBirthYear(year, maxYear), false)
  }
})

test('mobile onboarding submits a minor year and opens the no-access page', async () => {
  const page = read('src/pages/onboarding/onboarding.vue')
  const calls = []
  const opened = []
  const lifecycle = {}
  const vuePort = { ...vue, onMounted() {}, onUnmounted() {} }
  let restoreCalls = 0
  let resumeReads = 0
  let targetSaves = 0
  const pendingFacts = {
    adultGate: 'REQUIRED', adultLearningAccess: 'RESTRICTED',
    consent: { readable: true, accepted: false, unsatisfiedPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'] },
    target: { readable: true, saved: false, goal: null, quota: null },
  }
  const store = vue.reactive({
    onboardingResume: null, onboardingStatus: 'ready', lastError: null,
    async loadOnboardingResume() { resumeReads += 1; store.onboardingResume = pendingFacts; return pendingFacts },
    async saveTarget() { targetSaves += 1; throw new Error('A rejected adult must not save a target') },
  })
  const session = vue.reactive({
    adultGate: 'REQUIRED',
    adultLearningAccess: 'RESTRICTED',
    verifiedSubject: '00000000-0000-4000-8000-00000000000a',
    permissions: [],
    identityRevision: 1,
    isAuthenticated: true,
    isLearningReady: false,
    lastError: null,
    async confirmAdultGate(year) {
      calls.push(year)
      session.adultGate = 'REJECTED'
      session.adultLearningAccess = 'RESTRICTED'
      return false
    },
    async restore() { restoreCalls += 1 },
    async logout() {},
  })
  const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const compiled = ts.transpileModule(`${script}\nmodule.exports.__fixture = { birthYear, ageConfirmed, yearValid, busy, changeAge, step, next }\n`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        '../../components/AppIcon.vue': {},
        '../../platform/experience': { mobileT: (key) => key, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'FULL' }) },
        vue: vuePort,
        '@dcloudio/uni-app': { onHide(callback) { lifecycle.hide = callback }, onShow(callback) { lifecycle.show = callback } },
        '@englishflow/i18n': { interpolate: (value) => value },
        '../../platform/v2-foundation': { mobileI18n: { formatNumber: (value) => String(value) } },
        '../../api/client': { mobileApiClient: { request: async () => { throw new Error('A rejected gate must not read consent records') } } },
        '../../platform/uni-runtime': { getUniRuntime: () => ({ async navigateTo({ url }) { opened.push(url) }, async reLaunch({ url }) { opened.push(url) } }) },
        '../../platform/pointer-feedback': loadTs('src/platform/pointer-feedback.ts', { vue: vuePort }),
        '../../domain/adult-birth-year': birthYearModule,
        '../../domain/onboarding-resume': resumeModule,
        '../../stores/learner-content': { useLearnerContentStore: () => store },
        '../../stores/session': { useSessionStore: () => session },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, module, module.exports)
  })
  const fixture = module.exports.__fixture
  try {
    assert.equal(typeof lifecycle.show, 'function')
    await lifecycle.show()
    assert.equal(restoreCalls, 1)
    assert.equal(resumeReads, 1)
    assert.equal(fixture.step.value, 'gate')
    assert.equal(fixture.busy.value, false)
    assert.equal(birthYearModule.isSubmittableBirthYear(minorYear), true)
    fixture.birthYear.value = String(minorYear)
    assert.equal(fixture.yearValid.value, true)
    await fixture.next()
    assert.deepEqual(calls, [], 'An explicit age confirmation is required before IAM submission')
    fixture.changeAge({ detail: { value: ['adult-confirmed'] } })
    assert.equal(fixture.ageConfirmed.value, true)
    await fixture.next()
    assert.deepEqual(calls, [minorYear])
    assert.equal(session.adultGate, 'REJECTED')
    assert.equal(fixture.birthYear.value, '2016', 'The client must not rewrite the rejected birth year')
    assert.equal(fixture.step.value, 'gate')
    assert.equal(resumeReads, 1, 'A rejected adult must not advance to resume learning facts')
    assert.equal(targetSaves, 0)
    assert.deepEqual(opened, ['/pages/forbidden/forbidden'])
  } finally {
    lifecycle.hide?.()
    scope.stop()
  }
})
