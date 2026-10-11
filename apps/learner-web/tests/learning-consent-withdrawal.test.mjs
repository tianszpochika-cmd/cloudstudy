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

test('withdrawing ADULT_LEARNING sends WITHDRAWN and treats a learning 403 as success', async () => {
  const calls = []
  const result = await withdrawal.runLearningConsentWithdrawal(async (path, init) => {
    calls.push({ path, ...init })
    if (path === '/iam/principal/me') return { data: { consentState: { version: 'b30-consent-v1' } } }
    if (path === '/learner/targets') throw new withdrawal.ConsentHttpError(403)
    return { data: { decision: 'WITHDRAWN' } }
  }, 'withdraw-key')
  assert.equal(result.withdrawn, true)
  assert.equal(result.targetsStatus, 403)
  assert.equal(result.notice, withdrawal.WITHDRAW_DONE_COPY)
  assert.deepEqual(calls[1], {
    path: '/iam/consents',
    method: 'PUT',
    body: { type: 'ADULT_LEARNING', version: 'b30-consent-v1', decision: 'WITHDRAWN' },
    idempotencyKey: 'withdraw-key',
  })
  assert.equal(calls[2].path, '/learner/targets')
})

test('settings privacy stays on the page after the withdrawal notice', async () => {
  const page = read('src/pages/SettingsPage.vue')
  assert.equal(withdrawal.WITHDRAW_BUTTON_LABEL, '撤回学习同意')
  assert.match(page, /WITHDRAW_BUTTON_LABEL/)
  assert.match(page, /WITHDRAW_CONFIRM_COPY/)
  assert.match(page, /confirmWithdrawLearningConsent/)
  assert.doesNotMatch(page, /router\.(push|replace).*withdraw|再试一次|改年份/)
  const replaced = []
  const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  const compiled = ts.transpileModule(`function defineProps() { return { section: 'privacy' } }\n${script}\nmodule.exports.__fixture = { withdrawConfirming, withdrawing, withdrawNotice, confirmWithdrawLearningConsent }\n`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        'vue-router': { useRouter: () => ({ replace: async (target) => { replaced.push(target) } }), RouterLink: {} },
        '../stores/session': { useSessionStore: () => ({ logout: async () => {} }) },
        '../platform/experience-ui': { useExperienceText: () => (key) => key },
        '../components/ExperienceHeader.vue': {},
        '../components/NotificationPreferencesPanel.vue': {},
        vue,
        '../components/LearningPreferences.vue': {},
        '../stores/b1': { useB1Store: () => ({ profileStatus: 'idle', profile: { dailyQuotaMinutes: 15 }, deviceStatus: 'idle', devices: [], lastError: null, loadAccountData: async () => {}, refreshProfileTarget: async () => {}, saveDailyQuota: async () => false, removeDevice: async () => {}, removeOtherDevices: async () => {}, refreshDevices: async () => {} }) },
        '../domain/b1': { dailyQuotaOptions: [15] },
        '../domain/it7-closure': { privacyNotices: () => [] },
        '../api/support': { readClosureBoard: async () => null },
        '../api/learning-consent-withdrawal': {
          withdrawLearningConsent: async () => ({ withdrawn: true, targetsStatus: 403, notice: withdrawal.WITHDRAW_DONE_COPY, version: 'b30-consent-v1' }),
        },
        '../domain/learning-consent-withdrawal': withdrawal,
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, module, module.exports)
  })
  const fixture = module.exports.__fixture
  try {
    fixture.withdrawConfirming.value = true
    await fixture.confirmWithdrawLearningConsent()
    assert.equal(fixture.withdrawNotice.value, '学习同意已撤回。学习能力已收回，账号仍保留。')
    assert.equal(fixture.withdrawConfirming.value, false)
    assert.deepEqual(replaced, [])
  } finally {
    scope.stop()
  }
})
