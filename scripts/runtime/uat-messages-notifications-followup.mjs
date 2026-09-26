/** Local-only notification UAT. Synthetic accounts and owner rows are removed in finally. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../..')
const gateway = 'http://127.0.0.1:18070'
const notificationOwner = 'http://127.0.0.1:18093'
const web = 'http://127.0.0.1:18180'
const mobile = 'http://127.0.0.1:18183/#/'
const output = path.join(root, 'artifacts', 'uat-2026-09-23', 'messages-notifications-followup.json')
const screenshotDir = path.join(root, 'artifacts', 'uat-2026-09-23', 'screenshots', 'messages-followup')
const stamp = process.env.UAT_NOTIFICATION_STAMP ?? `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
assert.match(stamp, /^[a-z0-9-]{6,40}$/)
const accounts = [0, 1].map(index => ({
  identifier: `uat-notification-${stamp}-${index}@local.invalid`,
  password: `Uat!${randomBytes(20).toString('base64url')}a9`,
  principalId: null,
  registered: false,
}))
const evidence = {
  scope: 'Local Gateway, notification owner, learner Web, mobile H5; queue messages are synthetic fixtures, not domain events',
  capturedAt: new Date().toISOString(),
  accountTags: accounts.map(account => createHash('sha256').update(account.identifier).digest('hex').slice(0, 12)),
  checks: [],
  network: [],
  pages: [],
  browserErrors: [],
  cleanup: [],
  featureStatus: 'PARTIAL',
  knownGaps: ['mobile messages remain in the social page below fixture rooms', 'no trusted domain event or deep link verified', 'native app and iPad not verified'],
}
let counter = 0
let browser
let stage = 'preflight'
const idem = () => `uat-notification-${stamp}-${++counter}`
const check = (name, actual, expected) => {
  const pass = actual === expected
  evidence.checks.push({ name, actual, expected, pass })
  if (!pass) throw new Error(`${name}: expected ${expected}, observed ${actual}`)
}
const mysql = sql => execFileSync('docker', [
  'exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1',
  'mysql', '-uroot', '-D', 'notification_service', '-N', '-B', '-e', sql,
], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

async function call(base, method, pathname, { token, body, key } = {}) {
  const headers = { accept: 'application/json', origin: web, 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') headers['idempotency-key'] = key ?? idem()
  const response = await fetch(base + pathname, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  let json = null
  try { json = await response.json() } catch { /* body may be empty */ }
  evidence.network.push({ stage, method, path: pathname.replace(/\/messages\/[^/]+\/read$/, '/messages/:messageId/read'), status: response.status,
    code: json?.error?.code ?? json?.code ?? null })
  return { status: response.status, json, token: json?.data?.accessToken ?? null }
}

function cleanupAccount(account) {
  assert.match(account.identifier, /^uat-notification-[a-z0-9-]+-[01]@local\.invalid$/)
  const principal = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${account.identifier}'`)
  if (!principal) return { accountCount: 0, ownerRows: 0, activeSessions: 0 }
  assert.match(principal, /^[A-Za-z0-9-]{8,128}$/)
  const before = mysql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM notification_service.notification_message WHERE subject_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_preference WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_idempotency WHERE scope_key IN ('preference:platform:${principal}','message:platform:${principal}') OR scope_key LIKE 'delivery:platform:${principal}:%'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_outbox_event WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_workflow_task WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_audit_event WHERE principal_id='${principal}'));`)
  mysql(`START TRANSACTION;
    DELETE a FROM notification_service.notification_delivery_attempt a JOIN notification_service.notification_message m ON a.message_id=m.notification_id WHERE m.subject_id='${principal}';
    DELETE FROM notification_service.notification_workflow_task WHERE principal_id='${principal}';
    DELETE FROM notification_service.notification_outbox_event WHERE principal_id='${principal}';
    DELETE FROM notification_service.notification_audit_event WHERE principal_id='${principal}';
    DELETE FROM notification_service.notification_idempotency WHERE scope_key IN ('preference:platform:${principal}','message:platform:${principal}') OR scope_key LIKE 'delivery:platform:${principal}:%';
    DELETE FROM notification_service.notification_message WHERE subject_id='${principal}';
    DELETE FROM notification_service.notification_preference WHERE principal_id='${principal}';
    DELETE FROM notification_service.notification_subscription WHERE principal_id='${principal}';
    DELETE FROM notification_service.notification_consent_fact WHERE principal_id='${principal}';
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${account.identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id
      SET d.status='REVOKED',d.revoked_at=UTC_TIMESTAMP(6),d.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${account.identifier}' AND d.status='ACTIVE';
    UPDATE iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id
      SET p.status='DISABLED' WHERE a.identifier='${account.identifier}' AND p.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions='' WHERE identifier='${account.identifier}';
    COMMIT;`)
  const after = mysql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM notification_service.notification_message WHERE subject_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_preference WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_idempotency WHERE scope_key IN ('preference:platform:${principal}','message:platform:${principal}') OR scope_key LIKE 'delivery:platform:${principal}:%'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_outbox_event WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_workflow_task WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM notification_service.notification_audit_event WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${account.identifier}' AND s.status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id WHERE a.identifier='${account.identifier}' AND d.status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id WHERE a.identifier='${account.identifier}' AND p.status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id WHERE a.identifier='${account.identifier}' AND p.status='DISABLED'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${account.identifier}' AND status='DISABLED'));`)
  assert.equal(after, '0:0:0:0:0:0:0:0:0:1:1', `cleanup residue for ${principal}`)
  return { before, after, verified: true }
}

if (process.argv.includes('--cleanup-existing')) {
  for (const account of accounts) {
    try { evidence.cleanup.push(cleanupAccount(account)) }
    catch (error) { evidence.cleanup.push({ verified: false, error: error instanceof Error ? String(error.stderr ?? error.message).slice(0, 500) : String(error) }); process.exitCode = 1 }
  }
  console.log(JSON.stringify({ run: stamp, cleanup: evidence.cleanup }))
  process.exit(process.exitCode ?? 0)
}

function track(page, surface) {
  page.on('pageerror', error => evidence.browserErrors.push({ stage, surface, kind: error.name || 'Error' }))
  page.on('response', response => {
    if (!response.url().startsWith(gateway) || !new URL(response.url()).pathname.startsWith('/api/v1/notifications/')) return
    evidence.network.push({ stage, surface, method: response.request().method(), path: new URL(response.url()).pathname.replace(/\/messages\/[^/]+\/read$/, '/messages/:messageId/read'), status: response.status() })
  })
}

async function layout(page, surface, widths) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForTimeout(150)
    const measure = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    evidence.pages.push({ stage, surface, width, ...measure, overflow: measure.scrollWidth > measure.viewport + 1 })
    await page.screenshot({ path: path.join(screenshotDir, `${surface}-${width}.png`), fullPage: true })
    check(`${surface} ${width}px no overflow`, measure.scrollWidth > measure.viewport + 1, false)
  }
}

try {
  await fs.mkdir(screenshotDir, { recursive: true })
  for (const url of [gateway + '/actuator/health', notificationOwner + '/actuator/health', web, 'http://127.0.0.1:18183/']) {
    const response = await fetch(url)
    check(`health ${new URL(url).port}`, response.status, 200)
  }
  stage = 'anonymous'
  check('anonymous inbox denied', (await call(gateway, 'GET', '/api/v1/notifications/messages')).status, 401)
  check('anonymous preferences denied', (await call(gateway, 'GET', '/api/v1/notifications/preferences')).status, 401)

  const setup = []
  for (const [index, account] of accounts.entries()) {
    stage = `account-${index}-register`
    const device = { deviceType: 'WEB', clientVersion: 'uat-notification', deviceName: `uat-notification-${index}` }
    const registration = await call(gateway, 'POST', '/api/v1/auth/register', { body: { identifier: account.identifier, password: account.password, device } })
    account.registered = registration.status === 201
    check(`account ${index} register`, registration.status, 201)
    account.principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${account.identifier}'`)
    assert.match(account.principalId, /^[A-Za-z0-9-]{8,128}$/)
    check(`account ${index} pre-gate inbox denied`, (await call(gateway, 'GET', '/api/v1/notifications/messages', { token: registration.token })).status, 403)
    check(`account ${index} adult gate`, (await call(gateway, 'POST', '/api/v1/iam/adult-gate', { token: registration.token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } })).status, 200)
    for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
      check(`account ${index} ${type} consent`, (await call(gateway, 'PUT', '/api/v1/iam/consents', { token: registration.token, body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' } })).status, 200)
    }
    const login = await call(gateway, 'POST', '/api/v1/auth/login', { body: { identifier: account.identifier, password: account.password, device } })
    check(`account ${index} fresh login`, login.status, 200)
    setup.push(login.token)
  }
  const [ownerToken, otherToken] = setup
  stage = 'empty-owner'
  const emptyMessages = await call(gateway, 'GET', '/api/v1/notifications/messages', { token: ownerToken })
  check('new account inbox GET', emptyMessages.status, 200)
  check('new account inbox empty', Array.isArray(emptyMessages.json?.data) ? emptyMessages.json.data.length : Array.isArray(emptyMessages.json) ? emptyMessages.json.length : -1, 0)
  const emptyPrefs = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: ownerToken })
  check('new account preferences GET', emptyPrefs.status, 200)

  stage = 'preference-cas'
  const key = idem()
  const prefPath = '/api/v1/notifications/preferences/REVIEW_DUE/IN_APP'
  const first = await call(gateway, 'PUT', prefPath, { token: ownerToken, key, body: { enabled: true, locale: 'zh-CN', expectedVersion: 0 } })
  check('preference create', first.status, 200)
  check('preference version 1', first.json?.data?.version ?? first.json?.version, 1)
  const replay = await call(gateway, 'PUT', prefPath, { token: ownerToken, key, body: { enabled: true, locale: 'zh-CN', expectedVersion: 0 } })
  check('preference same-key replay', replay.status, 200)
  check('preference replay version stable', replay.json?.data?.version ?? replay.json?.version, 1)
  check('preference same-key changed body conflicts', (await call(gateway, 'PUT', prefPath, { token: ownerToken, key, body: { enabled: false, locale: 'zh-CN', expectedVersion: 0 } })).status, 409)
  check('preference stale version conflicts', (await call(gateway, 'PUT', prefPath, { token: ownerToken, body: { enabled: false, locale: 'zh-CN', expectedVersion: 0 } })).status, 409)
  const afterPref = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: ownerToken })
  const prefRows = Array.isArray(afterPref.json?.data) ? afterPref.json.data : afterPref.json
  check('preference readback count', Array.isArray(prefRows) ? prefRows.length : -1, 1)
  check('preference readback enabled', prefRows?.[0]?.enabled, true)
  const otherPref = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: otherToken })
  check('other account preferences isolated', (otherPref.json?.data ?? otherPref.json)?.length, 0)

  stage = 'synthetic-owner-message-fixture'
  const fixtureIds = []
  for (const [index, title] of ['今日复习提醒（验收）', '学习计划更新（验收）'].entries()) {
    const queued = await call(notificationOwner, 'POST', '/internal/v1/notifications/messages', { token: ownerToken,
      body: { notificationType: index === 0 ? 'REVIEW_DUE' : 'LEARNING_PLAN', channel: 'IN_APP', templateKey: `uat-notification-${stamp}-${index}`, templateVersion: 'v1', title, safeBody: index === 0 ? '有一项复习任务等待处理。' : '学习计划已更新，请在今日任务中查看。', contentVersion: 'uat-v1' } })
    check(`fixture message ${index} queued`, queued.status, 200)
    const id = queued.json?.messageId ?? queued.json?.data?.messageId
    assert.match(id, /^[A-Za-z0-9-]{8,160}$/)
    fixtureIds.push(id)
  }
  const inbox = await call(gateway, 'GET', '/api/v1/notifications/messages', { token: ownerToken })
  const inboxRows = Array.isArray(inbox.json?.data) ? inbox.json.data : inbox.json
  check('two fixture messages visible through Gateway', inboxRows?.length, 2)
  check('two fixture messages unread', inboxRows?.filter(item => item.read === false).length, 2)
  const otherInbox = await call(gateway, 'GET', '/api/v1/notifications/messages', { token: otherToken })
  check('other account inbox isolated', (otherInbox.json?.data ?? otherInbox.json)?.length, 0)
  check('other account cannot mark owner message', (await call(gateway, 'PUT', `/api/v1/notifications/messages/${fixtureIds[0]}/read`, { token: otherToken, body: {} })).status, 404)

  stage = 'web-browser-login'
  browser = await chromium.launch({ headless: true })
  const webContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const webPage = await webContext.newPage()
  track(webPage, 'web')
  await webPage.goto(web + '/login')
  await webPage.locator('input[name=identifier]').fill(accounts[0].identifier)
  await webPage.locator('input[name=password]').fill(accounts[0].password)
  await webPage.getByRole('button', { name: /登录/ }).last().click()
  await webPage.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 })
  await webPage.goto(web + '/messages')
  await webPage.getByText('今日复习提醒（验收）').waitFor({ timeout: 20000 })
  const webText = await webPage.locator('body').innerText()
  check('web shows two unread count', webText.includes('2 未读'), true)
  check('web shows saved preference', webText.includes('复习提醒 · 站内'), true)
  await layout(webPage, 'web-messages', [1280, 390, 320])
  await webPage.getByRole('button', { name: '标为已读', exact: true }).first().click()
  await webPage.getByText('1 未读').waitFor({ timeout: 20000 })
  const readback = await call(gateway, 'GET', '/api/v1/notifications/messages', { token: ownerToken })
  const readRows = readback.json?.data ?? readback.json
  check('web single-read persisted', readRows.filter(item => item.read === true).length, 1)
  await webPage.getByRole('button', { name: '全部标为已读' }).click()
  await webPage.getByText('0 未读').waitFor({ timeout: 20000 })
  const allRead = await call(gateway, 'GET', '/api/v1/notifications/messages', { token: ownerToken })
  check('web all-read persisted', (allRead.json?.data ?? allRead.json).filter(item => item.read === true).length, 2)
  const webSaveResponse = webPage.waitForResponse(response => new URL(response.url()).pathname === prefPath && response.request().method() === 'PUT', { timeout: 20000 })
  await webPage.getByRole('button', { name: '关闭', exact: true }).last().click()
  const webSave = await webSaveResponse
  check('Web preference save HTTP', webSave.status(), 200)
  check('Web preference save carries expectedVersion', webSave.request().postDataJSON()?.expectedVersion, 1)
  await webPage.getByRole('button', { name: '打开', exact: true }).waitFor({ timeout: 20000 })
  const webPref = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: ownerToken })
  check('web preference write persisted', (webPref.json?.data ?? webPref.json)?.[0]?.enabled, false)
  await webPage.reload()
  await webPage.getByRole('button', { name: '打开', exact: true }).waitFor({ timeout: 20000 })
  check('web preference restored after reload', await webPage.getByRole('button', { name: '打开', exact: true }).count(), 1)

  stage = 'mobile-message-fixture'
  const mobileFixture = await call(notificationOwner, 'POST', '/internal/v1/notifications/messages', { token: ownerToken,
    body: { notificationType: 'REVIEW_DUE', channel: 'IN_APP', templateKey: `uat-notification-${stamp}-mobile`, templateVersion: 'v1', title: '晚间复习提醒（验收）', safeBody: '今晚有一项待复习内容。', contentVersion: 'uat-v1' } })
  check('mobile fixture message queued', mobileFixture.status, 200)
  const mobileFixtureId = mobileFixture.json?.messageId ?? mobileFixture.json?.data?.messageId
  assert.match(mobileFixtureId, /^[A-Za-z0-9-]{8,160}$/)

  stage = 'mobile-browser-login'
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const mobilePage = await mobileContext.newPage()
  track(mobilePage, 'mobile')
  await mobilePage.goto(`${mobile}pages/login/login`)
  await mobilePage.locator('.yx-field input').nth(0).fill(accounts[0].identifier)
  await mobilePage.locator('.yx-field input').nth(1).fill(accounts[0].password)
  await mobilePage.getByRole('button', { name: '登录并继续' }).click()
  await mobilePage.waitForURL(url => !url.hash.includes('/login/'), { timeout: 25000 })
  const mobilePreferencesResponse = mobilePage.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/notifications/preferences' && response.status() === 200, { timeout: 25000 })
  await mobilePage.goto(`${mobile}pages/b4-social/b4-social`)
  const mobilePreferences = await (await mobilePreferencesResponse).json()
  check('mobile browser reads saved Web preference', (mobilePreferences.data ?? mobilePreferences).find(item => item.notificationType === 'REVIEW_DUE')?.enabled, false)
  await mobilePage.getByText('今日复习提醒（验收）').waitFor({ timeout: 25000 })
  const mobileText = await mobilePage.locator('body').innerText()
  check('mobile renders server safeBody', mobileText.includes('有一项复习任务等待处理。'), true)
  check('mobile labels server notificationType', mobileText.includes('复习提醒'), true)
  check('mobile unread count', mobileText.includes('1 未读'), true)
  await layout(mobilePage, 'mobile-notifications', [390, 320])
  await mobilePage.locator('.notice').filter({ hasText: '晚间复习提醒（验收）' }).getByRole('button', { name: '已读' }).click()
  await mobilePage.locator('.notice').filter({ hasText: '晚间复习提醒（验收）' }).getByRole('button', { name: '已读' }).waitFor({ state: 'detached', timeout: 20000 })
  check('mobile unread count updates', await mobilePage.getByText('0 未读', { exact: true }).count(), 1)
  const mobileRead = await call(gateway, 'GET', '/api/v1/notifications/messages', { token: ownerToken })
  check('mobile read persisted', (mobileRead.json?.data ?? mobileRead.json).find(item => item.messageId === mobileFixtureId)?.read, true)
  await mobilePage.goto(`${mobile}pages/settings/settings`)
  await mobilePage.locator('.notification-row').first().waitFor({ timeout: 15000 })
  const settingsText = await mobilePage.locator('body').innerText()
  check('mobile settings has notification preference entry', settingsText.includes('站内通知偏好'), true)
  const reviewPreference = mobilePage.locator('.notification-row').filter({ hasText: '复习提醒' })
  check('mobile restores Web preference off', await reviewPreference.getByRole('button', { name: '开启' }).count(), 1)
  await reviewPreference.getByRole('button', { name: '开启' }).click()
  await reviewPreference.getByRole('button', { name: '关闭' }).waitFor({ timeout: 20000 })
  const mobileSavedPref = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: ownerToken })
  check('mobile preference write persisted', (mobileSavedPref.json?.data ?? mobileSavedPref.json).find(item => item.notificationType === 'REVIEW_DUE')?.enabled, true)
  await mobilePage.reload()
  await mobilePage.locator('.notification-row').filter({ hasText: '复习提醒' }).getByRole('button', { name: '关闭' }).waitFor({ timeout: 20000 })
  check('mobile preference restored after reload', await mobilePage.locator('.notification-row').filter({ hasText: '复习提醒' }).getByRole('button', { name: '关闭' }).count(), 1)
  await layout(mobilePage, 'mobile-settings', [390, 320])

  stage = 'mobile-preference-controlled-error'
  await mobileContext.route('**/api/v1/notifications/preferences', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"TEMP_UNAVAILABLE"}' }))
  await mobilePage.reload()
  await mobilePage.getByText('通知偏好暂时无法读取。').waitFor({ timeout: 20000 })
  check('mobile preference failure hides stale toggles', await mobilePage.locator('.notification-row').count(), 0)
  await mobileContext.unroute('**/api/v1/notifications/preferences')
  await mobilePage.getByRole('button', { name: '重试', exact: true }).click()
  await mobilePage.locator('.notification-row').first().waitFor({ timeout: 20000 })
  check('mobile preference retry recovers', await mobilePage.locator('.notification-row').count(), 5)
  await mobilePage.getByText('查看消息', { exact: true }).click()
  await mobilePage.waitForURL(url => url.hash.includes('/pages/b4-social/b4-social'), { timeout: 15000 })
  await mobilePage.getByText('晚间复习提醒（验收）').waitFor({ timeout: 20000 })
  const mobileMessagePosition = await mobilePage.evaluate(() => ({ notice: document.querySelector('.notice-list')?.getBoundingClientRect().top, rooms: document.querySelector('.room-list')?.getBoundingClientRect().top }))
  check('settings message entry leads above rooms', typeof mobileMessagePosition.notice === 'number' && typeof mobileMessagePosition.rooms === 'number' && mobileMessagePosition.notice < mobileMessagePosition.rooms, true)

  stage = 'controlled-error'
  await webContext.route('**/api/v1/notifications/preferences', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"TEMP_UNAVAILABLE"}' }))
  await webPage.reload()
  await webPage.getByRole('button', { name: '重试', exact: true }).waitFor({ timeout: 20000 })
  const errorText = await webPage.locator('body').innerText()
  check('web error has retry', errorText.includes('重试'), true)
  await webContext.unroute('**/api/v1/notifications/preferences')
  await webPage.getByRole('button', { name: '重试', exact: true }).click()
  await webPage.getByText('今日复习提醒（验收）').waitFor({ timeout: 20000 })
  check('web retry sees mobile preference change', await webPage.getByRole('button', { name: '关闭', exact: true }).count(), 1)

  stage = 'web-preference-stale-conflict'
  const latestBeforeConflict = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: ownerToken })
  const currentPref = (latestBeforeConflict.json?.data ?? latestBeforeConflict.json).find(item => item.notificationType === 'REVIEW_DUE' && item.channel === 'IN_APP')
  check('Web stale scenario starts enabled', currentPref.enabled, true)
  const externalChange = await call(gateway, 'PUT', prefPath, { token: ownerToken, body: { enabled: false, locale: currentPref.locale, expectedVersion: currentPref.version } })
  check('external version advance', externalChange.status, 200)
  check('external version increment', externalChange.json?.data?.version ?? externalChange.json?.version, currentPref.version + 1)
  const staleResponse = webPage.waitForResponse(response => new URL(response.url()).pathname === prefPath && response.request().method() === 'PUT', { timeout: 20000 })
  await webPage.getByRole('button', { name: '关闭', exact: true }).click()
  const staleWrite = await staleResponse
  check('Web stale write sends old version', staleWrite.request().postDataJSON()?.expectedVersion, currentPref.version)
  check('Web stale write rejected', staleWrite.status(), 409)
  await webPage.getByText('偏好已更新，请确认后再试。').waitFor({ timeout: 20000 })
  await webPage.getByRole('button', { name: '打开', exact: true }).waitFor({ timeout: 20000 })
  const serverAfterConflict = await call(gateway, 'GET', '/api/v1/notifications/preferences', { token: ownerToken })
  check('Web conflict leaves external state intact', (serverAfterConflict.json?.data ?? serverAfterConflict.json).find(item => item.notificationType === 'REVIEW_DUE')?.enabled, false)
  const retrySaveResponse = webPage.waitForResponse(response => new URL(response.url()).pathname === prefPath && response.request().method() === 'PUT', { timeout: 20000 })
  await webPage.getByRole('button', { name: '打开', exact: true }).click()
  const retrySave = await retrySaveResponse
  check('Web retry uses refreshed version', retrySave.request().postDataJSON()?.expectedVersion, currentPref.version + 1)
  check('Web retry save HTTP', retrySave.status(), 200)
  await webPage.getByRole('button', { name: '关闭', exact: true }).waitFor({ timeout: 20000 })
  await webPage.reload()
  await webPage.getByRole('button', { name: '关闭', exact: true }).waitFor({ timeout: 20000 })
  check('Web CAS state persists after reload', await webPage.getByRole('button', { name: '关闭', exact: true }).count(), 1)
  stage = 'web-empty'
  const emptyWebContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const emptyWebPage = await emptyWebContext.newPage()
  track(emptyWebPage, 'web-empty')
  await emptyWebPage.goto(web + '/login')
  await emptyWebPage.locator('input[name=identifier]').fill(accounts[1].identifier)
  await emptyWebPage.locator('input[name=password]').fill(accounts[1].password)
  await emptyWebPage.getByRole('button', { name: /登录/ }).last().click()
  await emptyWebPage.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 })
  await emptyWebPage.goto(web + '/messages')
  await emptyWebPage.getByText('暂无消息，也没有可调的通知偏好。').waitFor({ timeout: 20000 })
  check('Web empty inbox shown as empty', await emptyWebPage.getByText('暂无消息，也没有可调的通知偏好。').count(), 1)
  await emptyWebContext.close()

  stage = 'mobile-empty'
  const emptyMobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const emptyMobilePage = await emptyMobileContext.newPage()
  track(emptyMobilePage, 'mobile-empty')
  await emptyMobilePage.goto(`${mobile}pages/login/login`)
  await emptyMobilePage.locator('.yx-field input').nth(0).fill(accounts[1].identifier)
  await emptyMobilePage.locator('.yx-field input').nth(1).fill(accounts[1].password)
  await emptyMobilePage.getByRole('button', { name: '登录并继续' }).click()
  await emptyMobilePage.waitForURL(url => !url.hash.includes('/login/'), { timeout: 25000 })
  await emptyMobilePage.goto(`${mobile}pages/b4-social/b4-social`)
  await emptyMobilePage.getByText('暂无通知。').waitFor({ timeout: 25000 })
  check('mobile empty inbox shown as empty', await emptyMobilePage.getByText('暂无通知。').count(), 1)
  await emptyMobileContext.close()

  stage = 'mobile-controlled-error'
  await mobileContext.route('**/api/v1/notifications/messages*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"TEMP_UNAVAILABLE"}' }))
  await mobilePage.goto(`${mobile}pages/b4-social/b4-social`)
  await mobilePage.reload()
  await mobilePage.getByText('通知暂时无法读取。', { exact: false }).waitFor({ timeout: 25000 })
  check('mobile message failure not presented as empty', await mobilePage.getByText('暂无通知。', { exact: true }).count(), 0)
  await mobileContext.unroute('**/api/v1/notifications/messages*')
  await mobilePage.locator('.yx-card').filter({ hasText: 'NOTIFICATIONS' }).getByRole('button', { name: '重试' }).click()
  await mobilePage.getByText('晚间复习提醒（验收）').waitFor({ timeout: 25000 })
  check('mobile notification retry recovers', await mobilePage.getByText('晚间复习提醒（验收）').count(), 1)

  await webContext.close()
  await mobileContext.close()
} catch (error) {
  evidence.failure = { stage, kind: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400) }
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  for (const account of accounts) {
    try { evidence.cleanup.push(cleanupAccount(account)) }
    catch (error) { evidence.cleanup.push({ verified: false, error: error instanceof Error ? String(error.stderr ?? error.message).slice(0, 500) : String(error) }); process.exitCode = 1 }
  }
  evidence.result = evidence.failure || evidence.cleanup.some(item => item.verified === false) ? 'FAIL' : evidence.checks.some(item => !item.pass) ? 'PARTIAL' : 'PASS'
  if (evidence.result === 'FAIL') process.exitCode = 1
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ result: evidence.result, stage, checks: evidence.checks.length, failure: evidence.failure ?? null, cleanup: evidence.cleanup }))
}
