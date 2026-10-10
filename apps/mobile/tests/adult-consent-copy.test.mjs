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
const resume = read('src/domain/onboarding-resume.ts')
const webCopy = fs.readFileSync(path.resolve(appRoot, '../learner-web/src/domain/onboarding-consent-copy.ts'), 'utf8')

const SENTENCES = [
  '只收集出生年份，用来判断是否已满 18 岁。现有成人门不需要月和日，所以不收集完整生日。',
  '如果没有通过，仍可前往账号设置、帮助与反馈或退出登录。这里不提供再试一次，也不提供改年份。',
  '账号条款、隐私说明和成人学习资格要逐项看见。开始时不勾选，也不默认全选。',
  '未勾选时，受影响的是学习资格，不是把账号设置、帮助与反馈和退出登录一起禁掉。',
  '版本未读到。已发布版本暂时读不到，这一步先不提交同意。',
]

test('mobile published consent version matches the web reader', () => {
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

test('mobile wizard shows the same three consent items and keeps the rejection exits', () => {
  for (const sentence of SENTENCES) assert.match(page, new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(page, /用途码 \{\{ item\.purpose \}\}/)
  assert.match(page, /<text>必要<\/text>/)
  assert.match(page, /已发布版本 \{\{ publishedConsentVersion \|\| '版本未读到' \}\}/)
  assert.match(page, /emptyConsentChoices\(\)/)
  assert.match(page, /requiredConsentsChecked\.value && Boolean\(publishedConsentVersion\.value\)/)
  assert.match(page, /recordRequiredConsents\(\)/)
  assert.match(page, /退出登录/)
  assert.match(page, /aria-label="出生年份"/)
  assert.doesNotMatch(page, /出生月|出生日|type="date"|bday-day|bday-month/)
  assert.doesNotMatch(page, /PRODUCT_ANALYTICS|VOICE_RECORDING|产品分析|语音录音|本隐私政策|隐私政策正文/)
  assert.doesNotMatch(page, />\s*再试一次\s*<|>\s*改年份\s*<|>\s*全选\s*</)
  assert.doesNotMatch(page, /ACCOUNT_TERMS:\s*true|PRIVACY_NOTICE:\s*true|ADULT_LEARNING_ELIGIBILITY:\s*true/)
  assert.doesNotMatch(page, /WITHDRAWN|再签/)
  assert.match(forbidden, /个人中心与设置/)
  assert.match(forbidden, /帮助与反馈/)
  assert.match(forbidden, /async function logout/)
  assert.doesNotMatch(forbidden, /再试一次|改年份/)
})

test('mobile resume step order stays gate, consent, goal, then assessment', () => {
  const start = resume.indexOf('export function selectOnboardingResumeStep')
  const end = resume.indexOf('export function onboardingProgressLabel')
  const order = [...resume.slice(start, end).matchAll(/return '([^']+)'/g)].map((match) => match[1])
  assert.deepEqual(order, ['rejected', 'gate', 'consent', 'goal', 'assessment'])
})
