// Local-only authenticated browser probe. Credentials and tokens stay in memory.
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const gateway = 'http://127.0.0.1:18070'
const learnerWeb = 'http://127.0.0.1:18180'
const runId = `display-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `${runId}@local.invalid`
const password = `Uat!${randomBytes(24).toString('base64url')}9a`
const device = { deviceType: 'WEB', clientVersion: 'display-uat', deviceName: 'local-display-uat' }
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4',
  '--batch', '--skip-column-names', '--raw']
const evidence = { runId, capturedAt: new Date().toISOString(), localOnly: true,
  setup: {}, ui: {}, server: {}, browserWrites: [], cleanup: {}, secretsRecorded: false }
let sequence = 0
let browser

function sql(input) {
  return runMysql({ mysqlArgs, password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only',
    cwd: process.cwd(), input })
}
async function call(method, path, body, token) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    headers['idempotency-key'] = `${runId}-${++sequence}`
  }
  const response = await fetch(`${gateway}${path}`, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  return { status: response.status, payload: await response.json().catch(() => null) }
}
function data(result) { return result.payload?.data?.data ?? result.payload?.data ?? null }
function preferenceFacts(result) {
  const value = data(result)
  return { status: result.status, uiLocale: value?.uiLocale ?? value?.ui_locale ?? null,
    contentLocale: value?.contentLocale ?? value?.content_locale ?? null,
    themeMode: value?.themeMode ?? value?.theme_mode ?? null,
    motionMode: value?.motionMode ?? value?.motion_mode ?? null }
}
function cleanupExact() {
  const row = sql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}';`).trim()
  if (!row) return { accountFound: false }
  if (row.includes('\n') || !/^[a-zA-Z0-9-]{20,128}$/.test(row)) throw new Error('synthetic cleanup target is not unique')
  const subject = row
  sql(`START TRANSACTION;
       DELETE FROM learner_service.learner_first_day_projection WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_goal WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_preference WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_idempotency_record WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_outbox_event WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_profile WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.b25_learner_goal WHERE principal_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.b25_learner_profile WHERE principal_id='${subject}' AND tenant_id='platform';
       UPDATE iam_service.iam_session SET status='REVOKED', revoked_at=UTC_TIMESTAMP(6), revoke_reason='LOCAL_UAT_CLEANUP'
         WHERE principal_id='${subject}' AND status='ACTIVE';
       UPDATE iam_service.iam_device SET status='REVOKED', revoked_at=UTC_TIMESTAMP(6), revoke_reason='LOCAL_UAT_CLEANUP'
         WHERE principal_id='${subject}' AND status='ACTIVE';
       UPDATE iam_service.iam_principal_role SET revoked_at=UTC_TIMESTAMP(6)
         WHERE principal_id='${subject}' AND revoked_at IS NULL;
       UPDATE iam_service.iam_principal SET status='DISABLED' WHERE principal_id='${subject}';
       UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
         WHERE identifier='${identifier}' AND principal_id='${subject}';
       COMMIT;`)
  const fields = sql(`SELECT a.status, p.status,
       (SELECT COUNT(*) FROM iam_service.iam_session s WHERE s.principal_id=a.principal_id AND s.status='ACTIVE'),
       (SELECT COUNT(*) FROM iam_service.iam_device d WHERE d.principal_id=a.principal_id AND d.status='ACTIVE'),
       (SELECT COUNT(*) FROM learner_service.b25_learner_goal g WHERE g.principal_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.b25_learner_profile r WHERE r.principal_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.learner_profile r WHERE r.owner_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.learner_goal g WHERE g.owner_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.learner_preference p2 WHERE p2.owner_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.learner_first_day_projection f WHERE f.owner_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.learner_idempotency_record i WHERE i.owner_id=a.principal_id),
       (SELECT COUNT(*) FROM learner_service.learner_outbox_event o WHERE o.owner_id=a.principal_id)
       FROM iam_service.iam_account a JOIN iam_service.iam_principal p ON p.principal_id=a.principal_id
       WHERE a.identifier='${identifier}';`).trim().split('\t')
  if (fields.length !== 12 || fields[0] !== 'DISABLED' || fields[1] !== 'DISABLED'
    || fields.slice(2).some(value => value !== '0')) throw new Error('synthetic cleanup verification failed')
  return { accountDisabled: true, principalDisabled: true, activeSessions: 0, activeDevices: 0,
    ownerRows: 0 }
}

let failure = null
try {
  if (!/^display-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe synthetic identifier')
  for (const [name, port] of Object.entries({ gateway: 18070, iam: 18087, learnerWeb: 18180 })) {
    const response = await fetch(`http://127.0.0.1:${port}/actuator/health`)
    evidence.setup[`${name}Health`] = response.status
    if (response.status !== 200) throw new Error(`${name} unavailable`)
  }
  const registered = await call('POST', '/api/v1/auth/register', { identifier, password, device })
  evidence.setup.registrationStatus = registered.status
  const registrationToken = data(registered)?.accessToken
  if (registered.status !== 201 || !registrationToken) throw new Error('registration failed')
  const adult = await call('POST', '/api/v1/iam/adult-gate',
    { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, registrationToken)
  evidence.setup.adultGateStatus = adult.status
  if (adult.status !== 200) throw new Error('adult gate failed')
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents',
      { type, version: 'b30-consent-v1', decision: 'ACCEPTED' }, registrationToken)
    evidence.setup[`${type.toLowerCase()}ConsentStatus`] = consent.status
    if (consent.status !== 200) throw new Error(`${type} consent failed`)
  }
  const login = await call('POST', '/api/v1/auth/login', { identifier, password, device })
  evidence.setup.apiLoginStatus = login.status
  const token = data(login)?.accessToken
  if (login.status !== 200 || !token) throw new Error('login failed')
  const profile = await call('PATCH', '/api/v1/learner/profile',
    { expectedStateVersion: 0, proficiencyLevel: 'B2' }, token)
  evidence.setup.profileWriteStatus = profile.status
  if (profile.status !== 200) throw new Error('profile setup failed')
  const target = await call('PUT', '/api/v1/learner/targets',
    { expectedStateVersion: 1, goalCode: 'WORKPLACE_DAILY', targetLevel: 'B2',
      dailyQuotaMinutes: 30 }, token)
  evidence.setup.targetWriteStatus = target.status
  if (target.status !== 200) throw new Error('target setup failed')
  evidence.server.before = preferenceFacts(await call('GET', '/api/v1/learner/preferences', undefined, token))

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 180)))
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if ((path === '/api/v1/learner/profile' || path === '/api/v1/learner/targets'
      || path === '/api/v1/learner/preferences') && request.method() !== 'GET') {
      evidence.browserWrites.push({ method: request.method(), path })
    }
  })
  await page.goto(`${learnerWeb}/login?redirect=%2Fsettings%2Fprofile`)
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/settings\/profile/, { timeout: 15000 })
  const selectors = page.locator('.learning-preferences select')
  await selectors.first().waitFor()
  evidence.ui.initial = { values: await selectors.evaluateAll(items => items.map(item => item.value)),
    theme: await page.locator('html').getAttribute('data-theme'),
    quota: Number(await page.locator('article.form-card > label select').inputValue()) }
  await selectors.nth(0).selectOption('en-US')
  await selectors.nth(1).selectOption('zh-CN')
  const englishUiLabel = await page.locator('.learning-preferences label').first().innerText()
  await selectors.nth(2).selectOption('dark')
  const darkTheme = await page.locator('html').getAttribute('data-theme')
  await selectors.nth(2).selectOption('high-contrast')
  evidence.ui.highContrast = { theme: await page.locator('html').getAttribute('data-theme'),
    values: await selectors.evaluateAll(items => items.map(item => item.value)), englishUiLabel }
  evidence.ui.englishPageCopy = {
    profileHeading: await page.locator('article.form-card h3').first().innerText(),
    localOnly: await page.getByText('Language and theme are saved in this browser as soon as you choose them.').count() > 0,
  }
  await mkdir('artifacts/uat-2026-09-23', { recursive: true })
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'artifacts/uat-2026-09-23/learner-display-390.png', fullPage: true })
  await selectors.nth(2).selectOption('system')
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  const systemDark = await page.locator('html').getAttribute('data-theme')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  const systemLight = await page.locator('html').getAttribute('data-theme')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await selectors.nth(2).selectOption('high-contrast')
  evidence.ui.themeModes = { darkTheme, systemDark, systemLight }

  await page.locator('a[href="/platform"]').first().click()
  await page.waitForURL(/\/platform/, { timeout: 10000 })
  const motion = page.locator('.display-motion input[type="checkbox"]')
  evidence.ui.motionBefore = { checked: await motion.isChecked(),
    dataMotion: await page.locator('html').getAttribute('data-motion') }
  await motion.uncheck()
  evidence.ui.motionAfter = { checked: await motion.isChecked(),
    dataMotion: await page.locator('html').getAttribute('data-motion') }
  await page.reload()
  await motion.waitFor()
  evidence.ui.afterReload = { path: new URL(page.url()).pathname,
    values: await page.locator('.learning-preferences select').evaluateAll(items => items.map(item => item.value)),
    theme: await page.locator('html').getAttribute('data-theme'),
    motionChecked: await motion.isChecked(),
    dataMotion: await page.locator('html').getAttribute('data-motion') }
  await page.goto(`${learnerWeb}/settings`)
  await page.locator('article.form-card > label select').waitFor()
  evidence.ui.settingsRootPath = new URL(page.url()).pathname
  await page.setViewportSize({ width: 320, height: 700 })
  evidence.ui.at320 = await page.evaluate(() => ({ width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > innerWidth + 1 }))
  evidence.ui.at320.values = await page.locator('.learning-preferences select').evaluateAll(items => items.map(item => item.value))
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'artifacts/uat-2026-09-23/learner-display-320.png', fullPage: true })
  await page.locator('a[href="/platform"]').first().click()
  await page.waitForURL(/\/platform/, { timeout: 10000 })
  await page.locator('.quality-option').last().click()
  evidence.ui.qualityAt320 = { selected: await page.locator('.quality-option').last().getAttribute('aria-pressed'),
    dataQuality: await page.locator('html').getAttribute('data-quality'),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'artifacts/uat-2026-09-23/learner-display-platform-320.png', fullPage: true })
  await page.reload()
  await page.locator('.quality-option').last().waitFor()
  evidence.ui.qualityAfterReload = { selected: await page.locator('.quality-option').last().getAttribute('aria-pressed'),
    dataQuality: await page.locator('html').getAttribute('data-quality') }
  await page.goto(`${learnerWeb}/settings/profile`)
  await page.locator('article.form-card > label select').waitFor()

  await page.route('**/api/v1/learner/targets', route => route.fulfill({ status: 503,
    contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE',
      message: 'synthetic fault injection' } }) }))
  await page.reload()
  await page.getByText('Learning goal is temporarily unavailable.').waitFor({ timeout: 10000 })
  evidence.ui.injectedTargetFailure = { errorVisible: true,
    quotaSelectVisible: await page.locator('article.form-card > label select').count() > 0,
    fakeSavedVisible: await page.getByText('Daily goal saved.').count() > 0,
    duplicateRawErrorVisible: await page.locator('.page-stack > p.error-text').count() > 0 }
  await page.screenshot({ path: 'artifacts/uat-2026-09-23/learner-display-error-320.png', fullPage: true })
  await page.locator('article.form-card .error-text').evaluate(element => element.scrollIntoView({ block: 'center' }))
  evidence.ui.injectedTargetFailure.visibleAfterScroll = await page.evaluate(() => {
    const alert = document.querySelector('article.form-card .error-text')?.getBoundingClientRect()
    const navigation = document.querySelector('.mobile-tabbar')?.getBoundingClientRect()
    return Boolean(alert && navigation && alert.top >= 66 && alert.bottom < navigation.top)
  })
  await page.screenshot({ path: 'artifacts/uat-2026-09-23/learner-display-error-viewport-320.png' })
  await page.unroute('**/api/v1/learner/targets')
  await page.getByRole('button', { name: 'Reload' }).click()
  await page.locator('article.form-card > label select').waitFor()
  evidence.ui.recoveredQuota = Number(await page.locator('article.form-card > label select').inputValue())
  evidence.ui.pageErrors = pageErrors
  evidence.server.after = preferenceFacts(await call('GET', '/api/v1/learner/preferences', undefined, token))
  if (evidence.ui.initial.quota !== 30 || evidence.ui.highContrast.theme !== 'high-contrast'
    || evidence.ui.themeModes.darkTheme !== 'dark' || evidence.ui.themeModes.systemDark !== 'dark'
    || evidence.ui.themeModes.systemLight !== 'light'
    || evidence.ui.englishPageCopy.profileHeading !== 'Learning profile' || !evidence.ui.englishPageCopy.localOnly
    || evidence.ui.afterReload.values.join(',') !== 'en-US,zh-CN,high-contrast'
    || evidence.ui.afterReload.motionChecked || evidence.ui.afterReload.dataMotion !== 'off'
    || evidence.ui.settingsRootPath !== '/settings/profile'
    || evidence.ui.at320.overflow || evidence.ui.qualityAt320.overflow
    || evidence.ui.qualityAt320.selected !== 'true' || evidence.ui.qualityAt320.dataQuality !== 'Performance'
    || evidence.ui.qualityAfterReload.selected !== 'true' || evidence.ui.qualityAfterReload.dataQuality !== 'Performance'
    || evidence.ui.injectedTargetFailure.quotaSelectVisible
    || evidence.ui.injectedTargetFailure.fakeSavedVisible || evidence.ui.injectedTargetFailure.duplicateRawErrorVisible
    || !evidence.ui.injectedTargetFailure.visibleAfterScroll
    || evidence.ui.recoveredQuota !== 30
    || evidence.browserWrites.length !== 0
    || JSON.stringify(evidence.server.before) !== JSON.stringify(evidence.server.after)) {
    throw new Error('display preference/browser assertion failed')
  }
  await context.close()
} catch (error) {
  failure = error instanceof Error ? error.message : String(error)
} finally {
  if (browser) await browser.close()
  try { evidence.cleanup = cleanupExact() }
  catch (error) { evidence.cleanup = { error: error instanceof Error ? error.message : String(error) } }
  if (failure) evidence.failure = failure
  await mkdir('artifacts/uat-2026-09-23', { recursive: true })
  await writeFile('artifacts/uat-2026-09-23/learner-display.json', JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence))
  if (failure || evidence.cleanup.error) process.exitCode = 1
}
