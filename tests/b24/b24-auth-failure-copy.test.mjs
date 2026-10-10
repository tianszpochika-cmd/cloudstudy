import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

async function loadTypeScript(path) {
  const source = read(path)
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.deepEqual(diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error), [], `${path} should transpile`)
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

function apiError(status, message, code) {
  const error = new Error('INTERNAL_DIAGNOSTIC database=private-secret')
  error.status = status
  error.details = { error: { code, message }, requestId: 'private-trace-id' }
  return error
}

function getPath(value, path) {
  return path.split('.').reduce((current, part) => current?.[part], value)
}

const [learnerHelpers, mobileHelpers, learnerMessages, mobileMessages] = await Promise.all([
  loadTypeScript('apps/learner-web/src/auth/auth-failure-copy.ts'),
  loadTypeScript('apps/mobile/src/auth/auth-failure-copy.ts'),
  loadTypeScript('packages/i18n/src/learner-base.ts'),
  loadTypeScript('packages/i18n/src/mobile-experience.ts'),
])

test('real API Error objects map to concise bilingual login and registration copy', () => {
  const unavailable = apiError(503, 'iam.consent.version_unavailable', 'POLICY_UNAVAILABLE')
  const generic503 = apiError(503, 'service temporarily unavailable', 'POLICY_UNAVAILABLE')
  const generic409 = apiError(409, 'A request with this idempotency key is still pending.', 'IDEMPOTENCY_CONFLICT')
  const accountConflict = apiError(409, 'iam.account.already_exists', 'ACCOUNT_CONFLICT')
  const invalidCredentials = apiError(401, 'iam.credentials.invalid', 'AUTH_REQUIRED')
  const rateLimited = apiError(429, 'iam.login.rate_limited', 'RATE_LIMITED')
  const unknown = apiError(500, 'Database pool exhausted', 'INTERNAL_ERROR')

  for (const locale of ['zh-CN', 'en-US']) {
    const learner = learnerMessages.learnerBaseMessages[locale].auth
    const mobile = mobileMessages.mobileExperienceMessages[locale].mobile
    const tWeb = (key) => getPath(learner, key)
    const tMobile = (key) => getPath(mobile, key)

    assert.equal(learnerHelpers.learnerAuthFailureMarker(unavailable), 'iam.consent.version_unavailable')
    assert.equal(learnerHelpers.learnerAuthFailureCopy('register', unavailable, tWeb), learner.register.temporarilyUnavailable)
    assert.equal(learnerHelpers.learnerAuthFailureCopy('login', unavailable, tWeb), learner.login.accountUnavailable)
    assert.equal(mobileHelpers.mobileAuthFailureMarker(unavailable), 'iam.consent.version_unavailable')
    assert.equal(mobileHelpers.mobileAuthFailureCopy('register', unavailable, tMobile), mobile.auth.register.temporarilyUnavailable)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('login', unavailable, tMobile), mobile.auth.login.accountUnavailable)

    assert.equal(learnerHelpers.learnerAuthFailureCopy('register', generic503, tWeb), learner.register.failed)
    assert.equal(learnerHelpers.learnerAuthFailureCopy('login', generic503, tWeb), learner.login.retry)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('register', generic503, tMobile), mobile.auth.register.failed)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('login', generic503, tMobile), mobile.auth.login.retry)
    assert.equal(learnerHelpers.learnerAuthFailureCopy('register', generic409, tWeb), learner.register.failed)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('register', generic409, tMobile), mobile.auth.register.failed)
    assert.equal(learnerHelpers.learnerAuthFailureCopy('register', accountConflict, tWeb), learner.register.failed)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('register', accountConflict, tMobile), mobile.auth.register.accountConflict)

    assert.equal(learnerHelpers.learnerAuthFailureCopy('login', invalidCredentials, tWeb), learner.login.invalidCredentials)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('login', invalidCredentials, tMobile), mobile.auth.login.invalidCredentials)
    assert.equal(learnerHelpers.learnerAuthFailureCopy('login', rateLimited, tWeb), learner.login.rateLimited)
    assert.equal(mobileHelpers.mobileAuthFailureCopy('login', rateLimited, tMobile), mobile.auth.login.rateLimited)

    const learnerUnknown = learnerHelpers.learnerAuthFailureCopy('login', unknown, tWeb)
    const mobileUnknown = mobileHelpers.mobileAuthFailureCopy('login', unknown, tMobile)
    assert.equal(learnerUnknown, learner.login.retry)
    assert.equal(mobileUnknown, mobile.auth.login.retry)
    for (const copy of [learnerUnknown, mobileUnknown, learner.login.accountUnavailable, mobile.auth.login.accountUnavailable]) {
      assert.doesNotMatch(copy, /INTERNAL_DIAGNOSTIC|private-secret|private-trace-id|Database pool/)
    }
  }
})

test('session stores keep only allowlisted auth markers and login views render localized copy', () => {
  const consentFailure = apiError(503, 'iam.consent.version_unavailable', 'POLICY_UNAVAILABLE')
  const secretFailure = apiError(503, 'database connection string hidden', 'INTERNAL_ERROR')
  assert.equal(learnerHelpers.learnerAuthFailureMarker(consentFailure), 'iam.consent.version_unavailable')
  assert.equal(mobileHelpers.mobileAuthFailureMarker(consentFailure), 'iam.consent.version_unavailable')
  assert.equal(learnerHelpers.learnerAuthFailureMarker(secretFailure), 'UNKNOWN_AUTH_ERROR')
  assert.equal(mobileHelpers.mobileAuthFailureMarker(secretFailure), 'UNKNOWN_AUTH_ERROR')

  const learnerStore = read('apps/learner-web/src/stores/session.ts')
  const mobileStore = read('apps/mobile/src/stores/session.ts')
  const learnerLogin = read('apps/learner-web/src/pages/LoginPage.vue')
  const mobileLogin = read('apps/mobile/src/pages/login/login.vue')
  assert.match(learnerStore, /lastError\.value\s*=\s*learnerAuthFailureMarker\(error\)/)
  assert.match(mobileStore, /lastError\.value\s*=\s*mobileAuthFailureMarker\(error\)/)
  assert.match(learnerLogin, /learnerAuthFailureCopy\('login',\s*session\.lastError,\s*authT\)/)
  assert.match(mobileLogin, /mobileAuthFailureCopy\('login',\s*session\.lastError,\s*mobileT\)/)

  const adminLogin = read('apps/admin-web/src/views/AdminLoginView.vue')
  assert.match(adminLogin, /errorMessage\.value\s*=\s*ui\("login\.failed"\)/)
  assert.doesNotMatch(adminLogin, /session\.lastError/)
})
