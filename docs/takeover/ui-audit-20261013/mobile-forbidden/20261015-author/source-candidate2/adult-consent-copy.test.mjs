import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

function load(relativePath) {
  const source = read(relativePath)
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error(`unexpected import in ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

const copy = load('src/domain/onboarding-consent-copy.ts')
const page = read('src/pages/onboarding/onboarding.vue')
const forbidden = read('src/pages/forbidden/forbidden.vue')
const forbiddenMessages = load('../../packages/i18n/src/mobile-experience.ts').mobileExperienceMessages
const resume = read('src/domain/onboarding-resume.ts')
const webCopy = fs.readFileSync(path.resolve(appRoot, '../learner-web/src/domain/onboarding-consent-copy.ts'), 'utf8')

test('legacy consent-summary parser retains compatibility but does not supply wizard signing authority', () => {
  assert.equal(read('src/domain/onboarding-consent-copy.ts'), webCopy)
  assert.deepEqual(copy.requiredConsentItems.map((item) => [item.purpose, item.label]), [
    ['ACCOUNT_TERMS', '账号条款'],
    ['PRIVACY_NOTICE', '隐私说明'],
    ['ADULT_LEARNING_ELIGIBILITY', '成人学习资格'],
  ])
  assert.deepEqual(copy.emptyConsentChoices(), {
    ACCOUNT_TERMS: false,
    PRIVACY_NOTICE: false,
    ADULT_LEARNING_ELIGIBILITY: false,
  })
  assert.equal(copy.readPublishedConsentVersion({
    data: {
      consentState: {
        version: 'b30-consent-v2',
        requiredPurposes: ['PRIVACY_NOTICE', 'ACCOUNT_TERMS', 'ADULT_LEARNING_ELIGIBILITY'],
      },
    },
  }), 'b30-consent-v2')
  assert.equal(copy.readPublishedConsentVersion({
    data: { consentState: { version: 'b30-consent-v1', requiredPurposes: ['ACCOUNT_TERMS'] } },
  }), null)
  assert.equal(copy.readPublishedConsentVersion({ data: { consentState: { requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'] } } }), null)
})

test('the redesigned wizard keeps year-only collection and restricted exits without signing unseen documents', () => {
  // Rendering and translation are exercised by the actual H5 UI suite.
  // These boundaries protect against implicit acceptance in the current wizard.
  assert.match(page, /\/iam\/consents/)
  assert.doesNotMatch(page, /recordRequiredConsents\(/)
  assert.doesNotMatch(page, /readPublishedConsentVersion\(/)
  assert.doesNotMatch(page, /出生月|出生日|type="date"|bday-day|bday-month/)
  assert.doesNotMatch(page, /本隐私政策|隐私政策正文/)
  assert.doesNotMatch(page, /ACCOUNT_TERMS:\s*true|PRIVACY_NOTICE:\s*true|ADULT_LEARNING_ELIGIBILITY:\s*true/)
  assert.match(forbidden, /\/pages\/settings\/settings/)
  assert.match(forbidden, /\/pages\/support\/support/)
  assert.equal(forbiddenMessages['zh-CN'].mobile.forbidden.account, '管理账号')
  assert.equal(forbiddenMessages['zh-CN'].mobile.forbidden.help, '帮助与反馈')
  for (const locale of ['zh-CN', 'en-US']) {
    const resources = forbiddenMessages[locale].mobile.forbidden
    assert.doesNotMatch(resources.pausedDescription, /撤回|withdraw/i, 'Sticky marker cannot assert an owner withdrawal')
    assert.match(resources.adultDescription, /18/)
    assert.doesNotMatch(Object.values(resources).join(' '), /改年份|再注册|retry.{0,12}adult/i)
  }
  assert.doesNotMatch(Object.values(forbiddenMessages['en-US'].mobile.forbidden).join(' '), /[\u3400-\u9fff]/)
  assert.doesNotMatch(forbidden, /confirmAdultGate\(|recordRequiredConsents\(/)
  assert.match(forbidden, /async function logout/)
  assert.doesNotMatch(forbidden, /再试一次|改年份/)
})

test('mobile resume step order stays gate, consent, goal, then assessment', () => {
  const start = resume.indexOf('export function selectOnboardingResumeStep')
  const end = resume.indexOf('export function onboardingProgressLabel')
  const order = [...resume.slice(start, end).matchAll(/return '([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(order, ['rejected', 'gate', 'consent', 'goal', 'assessment'])
})
