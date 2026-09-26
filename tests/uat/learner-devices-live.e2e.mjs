// Real local Gateway and browser acceptance of IAM-backed device sessions.
// Credentials and tokens stay in memory; the exact synthetic account is disabled in finally.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `uat-devices-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const gateway = 'http://127.0.0.1:18070'
const screenshotDir = 'artifacts/uat-2026-09-23/screenshots/learner/devices-live'
let sequence = 0
let browser
const checks = []

async function call(method, path, { token, body } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    headers['idempotency-key'] = `uat-devices-${stamp}-${++sequence}`
  }
  const response = await fetch(gateway + path, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const payload = await response.json().catch(() => null)
  return { status: response.status, token: payload?.data?.accessToken }
}

function requireStatus(response, expected, name) {
  checks.push({ name, status: response.status, expected })
  if (response.status !== expected) throw new Error(`${name}: HTTP ${response.status}`)
}

function cleanupExact() {
  if (!/^uat-devices-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe identifier')
  const sql = `START TRANSACTION;
UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
 WHERE identifier='${identifier}';
SELECT status FROM iam_service.iam_account WHERE identifier='${identifier}';
SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
COMMIT;`
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function durableCounts() {
  if (!/^uat-devices-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe identifier')
  const sql = `SELECT
 (SELECT COUNT(*) FROM iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id WHERE a.identifier='${identifier}' AND d.status='ACTIVE'),
 (SELECT COUNT(*) FROM iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id WHERE a.identifier='${identifier}' AND d.status='REVOKED'),
 (SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE');`
  const output = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const [activeDevices, revokedDevices, activeSessions] = output.split(/\s+/).map(Number)
  return { activeDevices, revokedDevices, activeSessions }
}

let cleanup = 'not-run'
try {
  const firstDevice = { deviceType: 'WEB', clientVersion: 'uat-device-a', deviceName: '设备甲' }
  const secondDevice = { deviceType: 'WEB', clientVersion: 'uat-device-b', deviceName: '设备乙' }
  const registration = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device: firstDevice } })
  requireStatus(registration, 201, 'register')
  if (!registration.token) throw new Error('registration token missing')
  requireStatus(await call('POST', '/api/v1/iam/adult-gate', { token: registration.token,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } }), 200, 'adult-gate')
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    requireStatus(await call('PUT', '/api/v1/iam/consents', { token: registration.token,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' } }), 200, `consent-${type}`)
  }
  requireStatus(await call('POST', '/api/v1/auth/login', {
    body: { identifier, password, device: secondDevice } }), 200, 'second-device-login')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:18180/login?redirect=/settings/devices')
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/settings\/devices/, { timeout: 15000 })
  await page.getByRole('heading', { name: '设备会话', exact: true }).waitFor()
  await page.locator('.device').first().waitFor()
  const before = await page.locator('.device').count()
  const current = await page.getByText('当前设备', { exact: true }).count()
  const activeOthers = await page.getByRole('button', { name: '退出此设备' }).count()
  checks.push({ name: 'iam-device-list-on-browser', before, current, activeOthers, pageErrors })
  if (before < 2 || current !== 1 || activeOthers < 1 || pageErrors.length) {
    throw new Error('IAM device list not rendered correctly')
  }
  mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: `${screenshotDir}/devices-before-390.png`, fullPage: true })
  await page.setViewportSize({ width: 320, height: 720 })
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  checks.push({ name: 'devices-320-layout', horizontalOverflow })
  await page.screenshot({ path: `${screenshotDir}/devices-before-320.png`, fullPage: true })
  if (horizontalOverflow) throw new Error('devices page overflows at 320px')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '退出其他设备' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.device button').length === 0,
    null, { timeout: 15000 })
  const afterActiveOthers = await page.getByRole('button', { name: '退出此设备' }).count()
  const counts = durableCounts()
  checks.push({ name: 'kick-other-devices', afterActiveOthers, ...counts })
  if (afterActiveOthers !== 0 || counts.activeDevices !== 1 || counts.revokedDevices < 2 || counts.activeSessions !== 1) {
    throw new Error('other device revocation did not persist')
  }
  await page.screenshot({ path: `${screenshotDir}/devices-after-390.png`, fullPage: true })

  await page.goto('http://127.0.0.1:18180/settings/privacy')
  await page.getByText('隐私范围设置与数据导出暂不可用。').waitFor()
  const falseControls = await page.getByRole('button', { name: /保存偏好|申请导出我的数据/ }).count()
  checks.push({ name: 'unavailable-privacy-controls-closed', falseControls })
  if (falseControls) throw new Error('misleading privacy write control remains')
  await page.screenshot({ path: `${screenshotDir}/privacy-390.png`, fullPage: true })
} catch (error) {
  checks.push({ name: 'probe-error', message: error instanceof Error ? error.message : String(error) })
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  try { cleanup = cleanupExact() } catch (error) {
    cleanup = `FAILED: ${error instanceof Error ? error.message : String(error)}`
    process.exitCode = 1
  }
  console.log(JSON.stringify({ probe: 'learner-devices-live', checks, cleanup, secretsPrinted: false }, null, 2))
}
