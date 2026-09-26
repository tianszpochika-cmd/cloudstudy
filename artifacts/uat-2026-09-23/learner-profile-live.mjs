// Local-only browser/Gateway probe. Generated credentials and tokens stay in memory.
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const gateway = 'http://127.0.0.1:18070'
const learnerWeb = 'http://127.0.0.1:18180'
const afterFix = process.argv.includes('--after')
const runId = `profile-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `${runId}@local.invalid`
const password = `Uat!${randomBytes(24).toString('base64url')}9a`
const device = { deviceType: 'WEB', clientVersion: 'learner-profile-uat', deviceName: 'local-profile-uat' }
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4',
  '--batch', '--skip-column-names', '--raw']
const evidence = { runId, capturedAt: new Date().toISOString(), localOnly: true,
  setup: {}, owner: {}, browser: {}, cleanup: {}, secretsRecorded: false }
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
function data(result) {
  const payload = result.payload
  return payload?.data?.data ?? payload?.data ?? null
}
function profileFacts(result) {
  const value = data(result)
  return { status: result.status, source: value?.source ?? null, nickname: value?.nickname ?? null,
    accentPref: value?.accent_pref ?? value?.accentPref ?? null,
    stateVersion: value?.state_version ?? value?.stateVersion ?? null,
    goalCode: value?.goal?.goal_code ?? value?.goal?.goalCode ?? null,
    dailyQuotaMinutes: value?.goal?.daily_quota_minutes ?? value?.goal?.dailyQuotaMinutes ?? null }
}
function targetFacts(result) {
  const value = data(result)
  return { status: result.status, goalCode: value?.goal_code ?? value?.goalCode ?? null,
    targetLevel: value?.target_level ?? value?.targetLevel ?? null,
    dailyQuotaMinutes: value?.daily_quota_minutes ?? value?.dailyQuotaMinutes ?? null }
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
  return { accountDisabled: true, principalDisabled: true, activeSessions: 0,
    activeDevices: 0, learnerProfileRows: 0, learnerGoalRows: 0,
    b9ProfileRows: 0, b9GoalRows: 0, b9PreferenceRows: 0,
    b9FirstDayRows: 0, b9IdempotencyRows: 0, b9OutboxRows: 0 }
}

let failure = null
try {
  if (!/^profile-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe synthetic identifier')
  for (const [name, port] of Object.entries({ gateway: 18070, iam: 18087, learnerWeb: 18180 })) {
    const response = await fetch(`http://127.0.0.1:${port}/actuator/health`)
    evidence.setup[`${name}Health`] = response.status
    if (response.status !== 200) throw new Error(`${name} unavailable`)
  }
  const registered = await call('POST', '/api/v1/auth/register', { identifier, password, device })
  evidence.setup.registrationStatus = registered.status
  const registrationToken = data(registered)?.accessToken
  if (registered.status !== 201 || !registrationToken) throw new Error('synthetic registration failed')
  const adult = await call('POST', '/api/v1/iam/adult-gate',
    { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, registrationToken)
  evidence.setup.adultGateStatus = adult.status
  if (adult.status !== 200) throw new Error('synthetic adult gate failed')
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents',
      { type, version: 'b30-consent-v1', decision: 'ACCEPTED' }, registrationToken)
    evidence.setup[`${type.toLowerCase()}ConsentStatus`] = consent.status
    if (consent.status !== 200) throw new Error(`${type} synthetic consent failed`)
  }
  const login = await call('POST', '/api/v1/auth/login', { identifier, password, device })
  evidence.setup.apiLoginStatus = login.status
  const token = data(login)?.accessToken
  if (login.status !== 200 || !token) throw new Error('synthetic login failed')
  const profileWrite = await call('PATCH', '/api/v1/learner/profile',
    afterFix ? { expectedStateVersion: 0, proficiencyLevel: 'B2' }
      : { expectedStateVersion: 0, nickname: '档案验收', accentPref: 'UK' }, token)
  evidence.setup.profileWriteStatus = profileWrite.status
  if (profileWrite.status !== 200) throw new Error('synthetic profile setup failed')
  const targetWrite = await call('PUT', '/api/v1/learner/targets',
    { expectedStateVersion: 1, goalCode: afterFix ? 'WORKPLACE_DAILY' : 'WORKPLACE', targetLevel: 'B2', dailyQuotaMinutes: 30,
      status: 'ACTIVE' }, token)
  evidence.setup.targetWriteStatus = targetWrite.status
  if (targetWrite.status !== 200) evidence.setup.targetWriteError = {
    code: targetWrite.payload?.error?.code ?? targetWrite.payload?.code ?? null,
    message: String(targetWrite.payload?.error?.message ?? targetWrite.payload?.message ?? '').slice(0, 160),
  }
  if (targetWrite.status !== 200) throw new Error('synthetic target setup failed')
  evidence.owner.profile = profileFacts(await call('GET', '/api/v1/learner/profile', undefined, token))
  evidence.owner.target = targetFacts(await call('GET', '/api/v1/learner/targets', undefined, token))
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const requests = []
  page.on('response', response => {
    const path = new URL(response.url()).pathname
    if (path === '/api/v1/learner/profile' || path === '/api/v1/learner/targets')
      requests.push({ method: response.request().method(), path, status: response.status() })
  })
  await page.goto(`${learnerWeb}/login?redirect=%2Fsettings%2Fprofile`)
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/settings\/profile/, { timeout: 15000 })
  await page.waitForTimeout(900)
  const quotaSelect = page.locator('article.form-card label').filter({ hasText: '每日目标' }).locator('select')
  evidence.browser = { urlPath: new URL(page.url()).pathname,
    nicknameEditable: await page.locator('article.form-card label').filter({ hasText: '昵称' }).locator('input').count() > 0,
    accentEditable: await page.locator('article.form-card label').filter({ hasText: '发音偏好' }).locator('select').count() > 0,
    dailyQuotaMinutes: Number(await quotaSelect.inputValue()),
    hasError: await page.getByRole('alert').count() > 0,
    requests }
  if (afterFix) {
    await quotaSelect.selectOption('45')
    await page.getByRole('button', { name: '保存每日目标' }).click()
    await page.waitForFunction(() => {
      const text = document.body.innerText
      return text.includes('每日目标已保存。') || text.includes('学习目标暂不可用。')
    }, null, { timeout: 10000 })
  } else {
    await page.locator('article.form-card input').first().fill('浏览器已改')
    await page.locator('article.form-card select').first().selectOption('UK')
    await page.locator('article.form-card select').nth(1).selectOption('45')
    await page.getByRole('button', { name: '保存修改' }).click()
  }
  if (!afterFix) await page.waitForTimeout(650)
  evidence.browser.afterSave = {
    successShown: await page.getByText(afterFix ? '每日目标已保存。' : '资料已保存。').count() > 0,
    errorShown: await page.getByRole('alert').count() > 0,
    inputQuota: Number(await quotaSelect.inputValue()),
  }
  if (afterFix) {
    const screenshot = 'artifacts/uat-2026-09-23/learner-profile-after.png'
    await page.screenshot({ path: screenshot, fullPage: true })
    evidence.browser.screenshot = screenshot
    await page.setViewportSize({ width: 390, height: 844 })
    evidence.browser.mobileViewport = await page.evaluate(() => ({ width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }))
    const mobileScreenshot = 'artifacts/uat-2026-09-23/learner-profile-after-mobile.png'
    await page.screenshot({ path: mobileScreenshot, fullPage: true })
    evidence.browser.mobileScreenshot = mobileScreenshot
  }
  evidence.owner.afterSaveProfile = profileFacts(await call('GET', '/api/v1/learner/profile', undefined, token))
  evidence.owner.afterSaveTarget = targetFacts(await call('GET', '/api/v1/learner/targets', undefined, token))
  if (afterFix && (!evidence.browser.afterSave.successShown || evidence.browser.afterSave.errorShown
    || evidence.browser.dailyQuotaMinutes !== 30 || evidence.browser.afterSave.inputQuota !== 45
    || evidence.browser.nicknameEditable || evidence.browser.accentEditable
    || evidence.browser.mobileViewport.overflow
    || evidence.owner.afterSaveTarget.dailyQuotaMinutes !== 45
    || evidence.browser.requests.some(request => request.method === 'PATCH'))) {
    throw new Error('browser target save did not verify')
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
  await writeFile(`artifacts/uat-2026-09-23/learner-profile-${afterFix ? 'after' : 'before'}.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence))
  if (failure || evidence.cleanup.error) process.exitCode = 1
}
