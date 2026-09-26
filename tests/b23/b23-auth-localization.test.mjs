import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

async function loadTypeScriptMessages(path) {
  const source = read(path)
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error)
  assert.deepEqual(errors, [], `${path} should transpile for locale assertions`)
  const encoded = Buffer.from(outputText).toString('base64')
  return import(`data:text/javascript;base64,${encoded}`)
}

const [learnerI18n, mobileI18n] = await Promise.all([
  loadTypeScriptMessages('packages/i18n/src/learner-base.ts'),
  loadTypeScriptMessages('packages/i18n/src/mobile-experience.ts'),
])
const [learnerFailureCopy, mobileFailureCopy] = await Promise.all([
  loadTypeScriptMessages('apps/learner-web/src/auth/auth-failure-copy.ts'),
  loadTypeScriptMessages('apps/mobile/src/auth/auth-failure-copy.ts'),
])

test('registration and password reset messages cover Chinese and English labels, states, and recovery copy', () => {
  const learner = learnerI18n.learnerBaseMessages
  const mobile = mobileI18n.mobileExperienceMessages
  const webGroups = ['register', 'passwordReset']
  const mobileGroups = ['register', 'resetPassword']

  for (const locale of ['zh-CN', 'en-US']) {
    for (const group of webGroups) {
      const messages = learner[locale].auth[group]
      assert.ok(messages && Object.values(messages).every((value) => typeof value === 'string' && value.length > 0), `${locale} web ${group} messages should be complete`)
    }
    for (const group of mobileGroups) {
      const messages = mobile[locale].mobile.auth[group]
      assert.ok(messages && Object.values(messages).every((value) => typeof value === 'string' && value.length > 0), `${locale} mobile ${group} messages should be complete`)
    }
  }

  assert.equal(learner['zh-CN'].auth.register.identifier, '账号')
  assert.equal(learner['en-US'].auth.register.identifier, 'Account')
  assert.match(learner['zh-CN'].auth.passwordReset.requestSent, /如果账号存在/)
  assert.match(learner['en-US'].auth.passwordReset.requestSent, /If the account exists/)
  assert.match(mobile['zh-CN'].mobile.auth.resetPassword.requiredFields, /重置口令/)
  assert.match(mobile['en-US'].mobile.auth.resetPassword.requiredFields, /reset code/)
  assert.match(learner['en-US'].auth.register.validationTitle, /Check your details/)
  assert.match(learner['en-US'].auth.passwordReset.validationTitle, /Check your details/)
  assert.match(learner['en-US'].auth.passwordReset.invalidCode, /invalid or expired/)
  assert.match(mobile['en-US'].mobile.auth.register.accountConflict, /already be registered/)
})

test('auth pages keep concise guidance while retaining password and account recovery requirements', () => {
  const learner = learnerI18n.learnerBaseMessages
  const mobile = mobileI18n.mobileExperienceMessages
  const registerPage = read('apps/learner-web/src/pages/RegisterPage.vue')
  const registerStyles = read('apps/learner-web/src/assets/styles/experience.css')
  const mobileRegisterPage = read('apps/mobile/src/pages/register/register.vue')

  assert.match(registerPage, /class="micro-copy__action"/)
  assert.match(registerStyles, /\.micro-copy__action\s*\{\s*margin-inline-start:/)
  assert.match(mobileRegisterPage, /mobileT\('auth\.register\.passwordHint'\)/)

  for (const locale of ['zh-CN', 'en-US']) {
    const webReset = learner[locale].auth.passwordReset
    const mobileMessages = mobile[locale].mobile
    const mobileReset = mobileMessages.auth.resetPassword
    assert.match(mobileMessages.auth.register.passwordHint, /12/)
    assert.doesNotMatch(mobileMessages.auth.register.password, /12/)
    assert.match(mobileMessages.auth.register.shortPassword, /12/)
    assert.notEqual(webReset.description, webReset.requestHint)
    assert.notEqual(mobileMessages.pages['reset-password'].description, mobileReset.requestHint)
    assert.match(webReset.requestSent, /账号存在|account exists/i)
  }
})

test('auth failure copy localizes known conflicts and rate limits and hides unknown diagnostics', () => {
  const web = learnerFailureCopy.learnerAuthFailureCopy
  const mobile = mobileFailureCopy.mobileAuthFailureCopy
  const t = (key) => key

  assert.equal(web('register', '该账号已存在，请直接登录或走密码重置。（iam.account.already_exists）', t), 'register.accountConflict')
  assert.equal(web('register', '请求过于频繁，请稍后再试。', t), 'register.rateLimited')
  assert.equal(web('resetConfirm', 'iam.password_reset.invalid', t), 'passwordReset.invalidCode')
  assert.equal(web('resetRequest', '数据库连接池异常：secret-token', t), 'passwordReset.requestFailed')
  assert.equal(mobile('register', '内容或进度已更新，请刷新后重试。', t), 'auth.register.failed')
  assert.equal(mobile('register', 'iam.account.already_exists', t), 'auth.register.accountConflict')
  assert.equal(mobile('resetRequest', '操作太频繁，请稍后重试。', t), 'auth.resetPassword.rateLimited')
  assert.equal(mobile('resetConfirm', 'network ECONNREFUSED', t), 'auth.resetPassword.failedConfirm')
})

test('all four auth page templates render their user copy through the locale adapters', () => {
  const pagePaths = [
    'apps/learner-web/src/pages/RegisterPage.vue',
    'apps/learner-web/src/pages/PasswordResetPage.vue',
    'apps/mobile/src/pages/register/register.vue',
    'apps/mobile/src/pages/reset-password/reset-password.vue',
  ]
  for (const path of pagePaths) {
    const source = read(path)
    const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1]
    assert.ok(template, `${path} should have a template`)
    const withoutBrand = template.replace(/<span>语学星<\/span>/g, '')
    assert.doesNotMatch(withoutBrand, /[\u3400-\u9fff]/, `${path} template should not contain hardcoded Chinese UI copy`)
    assert.match(template, /aria-label/, `${path} should expose localized input labels to assistive technology`)
  }
})

test('registration keeps local validation before registration and preserves return-to navigation', () => {
  const web = read('apps/learner-web/src/pages/RegisterPage.vue')
  const mobile = read('apps/mobile/src/pages/register/register.vue')
  for (const [source, adapter] of [[web, 'authT'], [mobile, 'mobileT']]) {
    const script = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    assert.match(script, /identifier\.value\.trim\(\)\s*\|\|\s*!password\.value/)
    assert.match(script, /password\.value\.length\s*<\s*12/)
    assert.match(script, /password\.value\s*!==\s*confirm\.value/)
    assert.ok(script.indexOf(`${adapter}('register.required')`) < script.indexOf('session.register('))
    assert.ok(script.indexOf(`${adapter}('register.shortPassword')`) < script.indexOf('session.register('))
    assert.ok(script.indexOf(`${adapter}('register.mismatch')`) < script.indexOf('session.register('))
  }

  assert.match(web, /safeReturnTo\(route\.query\.redirect \?\? session\.peekReturnTo\(\)\)/)
  assert.match(web, /query: \{ redirect: redirectTarget \}/)
  assert.match(web, /session\.consumeReturnTo\(\)/)
  assert.match(mobile, /safeMobileReturnTo\(options\?\.returnTo \?\? options\?\.redirect \?\? session\.peekReturnTo\(\)\)/)
  assert.match(mobile, /session\.setReturnTo\(returnTo\.value\)/)
  assert.match(mobile, /continueAfterLogin\(session\.consumeReturnTo\(\)\)/)
  assert.match(web, /errorKind === 'validation' \? 'register\.validationTitle' : 'register\.errorTitle'/)
})

test('password reset keeps request and confirmation route behavior with localized local validation', () => {
  const web = read('apps/learner-web/src/pages/PasswordResetPage.vue')
  const mobile = read('apps/mobile/src/pages/reset-password/reset-password.vue')
  for (const [source, adapter] of [[web, 'authT'], [mobile, 'mobileT']]) {
    const script = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    assert.match(script, /if \(!identifier\.value\.trim\(\)[\s\S]{0,90}!token\.value\.trim\(\)/)
    assert.match(script, /!token\.value\.trim\(\)/)
    assert.match(script, /newPassword\.value\.length\s*<\s*12/)
    assert.ok([
      `${adapter}('passwordReset.requiredFields')`,
      `${adapter}('resetPassword.requiredFields')`,
      `${adapter}('auth.resetPassword.requiredFields')`,
    ].some((key) => script.includes(key)))
    assert.ok(script.indexOf('session.confirmPasswordReset(identifier.value, token.value, newPassword.value)') > script.indexOf('newPassword.value.length < 12'))
  }

  assert.match(web, /safeReturnTo\(route\.query\.redirect \?\? session\.peekReturnTo\(\)\)/)
  assert.match(web, /router\.replace\(\{ name: 'login', query: \{ redirect: redirectTarget\.value \} \}\)/)
  assert.match(web, /session\.requestPasswordReset\(identifier\.value\)/)
  assert.match(mobile, /function initialize\(options\?: \{ token\?: string \}\)/)
  assert.match(mobile, /token\.value = options\.token\s+step\.value = 'confirm'/)
  assert.match(mobile, /session\.requestPasswordReset\(identifier\.value\)/)
  assert.match(web, /errorKind === 'validation' \? 'passwordReset\.validationTitle' : 'passwordReset\.errorTitle'/)
  assert.match(mobile, /!resetCompleted && !\(done && step === 'request'\)/)
})
