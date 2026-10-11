import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const vue = createRequire(import.meta.url)('vue')

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

const withdrawal = loadTs('src/domain/learning-consent-withdrawal.ts')

test('mobile withdrawal marks ADULT_LEARNING withdrawn and keeps the settings notice', async () => {
  const page = read('src/pages/settings/settings.vue')
  const api = read('src/api/learning-consent-withdrawal.ts')
  assert.equal(withdrawal.WITHDRAW_BUTTON_LABEL, '撤回学习同意')
  assert.match(page, /WITHDRAW_BUTTON_LABEL/)
  assert.match(page, /WITHDRAW_CONFIRM_COPY/)
  assert.match(page, /confirmWithdrawLearningConsent/)
  assert.match(api, /skipAuthRetry: true/)
  assert.match(api, /\/iam\/consents|runLearningConsentWithdrawal/)
  const calls = []
  const result = await withdrawal.runLearningConsentWithdrawal(async (path, init) => {
    calls.push({ path, body: init.body, method: init.method })
    if (path === '/iam/principal/me') return { data: { principal: { consentState: { version: 'ctl-consent-doc-v1' } } } }
    if (path === '/learner/targets') throw new withdrawal.ConsentHttpError(403)
    return {}
  }, 'mobile-withdraw')
  assert.equal(calls[1].body.type, 'ADULT_LEARNING')
  assert.equal(calls[1].body.decision, 'WITHDRAWN')
  assert.equal(calls[1].body.version, 'ctl-consent-doc-v1')
  assert.equal(result.targetsStatus, 403)
  assert.equal(result.notice, withdrawal.WITHDRAW_DONE_COPY)

  const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  const compiled = ts.transpileModule(`${script}\nmodule.exports.__fixture = { withdrawConfirming, withdrawNotice, confirmWithdrawLearningConsent }\n`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const scope = vue.effectScope()
  const opened = []
  const gateMarks = []
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        '../../components/MobilePageHeader.vue': {},
        '../../platform/v2-foundation': { mobileThemeController: { theme: 'light', setTheme() {} } },
        '../../platform/b10-foundation': { b10ContentLocale: { value: 'en-US' }, b10UiLocale: { value: 'zh-CN' } },
        '../../platform/experience': {
          mobileExperienceEngine: { state: { level: 'High' }, subscribe() { return () => {} } },
          mobileMotionMode: { value: 'FULL' }, restoreMobileQualityDefault() {}, setMobileMotion() {}, setMobileQuality() {},
          useMobileExperience() { return { experienceStyle: {}, experienceMotion: 'FULL' } },
        },
        vue,
        '@dcloudio/uni-app': { onHide() {}, onShow() {} },
        '../../auth/navigation': { ensureMobilePageAccess: async () => true },
        '../../domain/it7-closure': { privacyNotices: () => [] },
        '../../api/support': { readMobileClosureBoard: async () => null },
        '../../api/learning-consent-withdrawal': {
          withdrawLearningConsent: async () => result,
        },
        '../../domain/learning-consent-withdrawal': withdrawal,
        '../../stores/learner-content': { useLearnerContentStore: () => ({ accountStatus: 'idle', lastError: null, account: {}, loadAccount: async () => {}, forgetOnboardingResume() { gateMarks.push('resume') } }) },
        '../../stores/session': { useSessionStore: () => vue.reactive({ verifiedSubject: 'learner-a', identityRevision: 1, getMobileApiIdentity: () => null, markLearningConsentWithdrawn() { gateMarks.push('withdrawn') } }) },
        '../../api/b12': {},
        '../../domain/notification-preferences': {
          DEFAULT_NOTIFICATION_DND_WINDOW: { startLocalTime: '22:00', endLocalTime: '07:00' },
          NOTIFICATION_CATEGORIES: [],
          NOTIFICATION_DND_OFF: { startLocalTime: '00:00', endLocalTime: '00:00' },
          isNotificationDndEnabled: () => false,
          makeNotificationPreferenceCommand: () => ({}),
          notificationPreferenceMatchesCommand: () => false,
        },
        '@englishflow/contracts': {},
        '../../platform/uni-runtime': { getUniRuntime: () => ({ navigateTo() { opened.push('nav') } }) },
        '../../domain/mobile-preference-sync': {
          hasPendingMobilePreferenceSync: () => false,
          sameMobilePreferenceIdentity: () => true,
          setPendingMobilePreferenceSync() {},
          transitionMobilePreferenceSubject: (_previous, next) => ({ subject: next ?? null, pendingSync: false }),
        },
        '@englishflow/performance': {},
        '../../domain/learner-content': {},
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, module, module.exports)
  })
  const fixture = module.exports.__fixture
  try {
    fixture.withdrawConfirming.value = true
    await fixture.confirmWithdrawLearningConsent()
    assert.equal(fixture.withdrawNotice.value, withdrawal.WITHDRAW_DONE_COPY)
    assert.equal(fixture.withdrawConfirming.value, false)
    assert.deepEqual(opened, [])
    assert.deepEqual(gateMarks, ['withdrawn', 'resume'])
  } finally {
    scope.stop()
  }
})
