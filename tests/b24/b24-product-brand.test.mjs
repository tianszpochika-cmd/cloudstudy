import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

async function loadMessages(path) {
  const { outputText, diagnostics = [] } = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.deepEqual(diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error), [], `${path} should transpile`)
  const encoded = Buffer.from(outputText).toString('base64')
  return import(`data:text/javascript;base64,${encoded}`)
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value)
  else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collectStrings(nested, output)
  }
  return output
}

const [learner, admin, mobile, learnerBase, official] = await Promise.all([
  loadMessages('packages/i18n/src/learner-experience.ts'),
  loadMessages('packages/i18n/src/admin-experience.ts'),
  loadMessages('packages/i18n/src/mobile-experience.ts'),
  loadMessages('packages/i18n/src/learner-base.ts'),
  loadMessages('packages/i18n/src/official-site.ts'),
])

test('four user-facing surfaces use the approved Chinese product name in English copy', () => {
  const locale = 'en-US'
  const learnerMessages = learner.learnerExperienceMessages[locale].experience
  const adminMessages = admin.adminExperienceMessages[locale]
  const mobileMessages = mobile.mobileExperienceMessages[locale].mobile
  const authMessages = learnerBase.learnerBaseMessages[locale].auth
  const learningMessages = learnerBase.learnerBaseMessages[locale].learning
  const officialFooter = official.officialWebsiteMessages[locale].official

  assert.equal(learnerMessages.brand, '语学星')
  assert.equal(learnerMessages.backOfficial, 'About 语学星')
  assert.equal(authMessages.login.description.includes('语学星'), true)
  assert.equal(authMessages.login.formHint.includes('语学星'), true)
  assert.equal(learningMessages.onboarding.welcome, 'Welcome to 语学星')
  assert.equal(adminMessages.brand, '语学星')
  assert.equal(adminMessages.login.description.includes('语学星'), true)
  assert.equal(mobileMessages.brand, '语学星')
  assert.equal(official.officialWebsiteMessages['zh-CN'].official.cf7ce229f6, '© 2026 语学星')
  assert.equal(officialFooter.cf7ce229f6, '© 2026 语学星')

  for (const messages of [learnerMessages, adminMessages, mobileMessages, authMessages]) {
    assert.doesNotMatch(collectStrings(messages).join('\n'), /EnglishFlow|Yuxuexing/i)
  }
})

test('admin login diagnostics and mobile adult guidance use the approved brand', () => {
  const adminFoundation = read('apps/admin-web/src/platform/v2-foundation.ts')
  const adminBatchCopy = read('apps/admin-web/src/platform/i18n-batch-c.ts')
  const mobileFoundation = read('apps/mobile/src/platform/v2-foundation.ts')

  assert.match(adminFoundation, /Your account and password are checked by the 语学星 authentication center\./)
  assert.match(adminBatchCopy, /\[语学星管理端\] Failed to restore the initial route\./)
  assert.match(mobileFoundation, /description: '语学星 is currently for people aged 18 and over\.'/)
  assert.doesNotMatch(`${adminFoundation}\n${adminBatchCopy}\n${mobileFoundation}`, /Yuxuexing|EnglishFlow/)
})
