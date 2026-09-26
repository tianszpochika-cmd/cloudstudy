// Local-only UI recheck. No content commands or content DB writes.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const runId = `uat-release-copy-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const identifier = `${runId}@local.invalid`
const password = `Uat!${randomBytes(24).toString('base64url')}9a`
const gateway = 'http://127.0.0.1:18070'
const admin = 'http://127.0.0.1:18181'
const output = 'artifacts/uat-2026-09-23/admin-review-publish-boundary'
const evidence = { runId, page: {}, pageErrors: [], consoleErrors: [], cleanup: null,
  contentCommands: 0, secretsRecorded: false }
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw']
const mysqlPassword = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only'
let browser

function sql(input) {
  return runMysql({ mysqlArgs, password: mysqlPassword, cwd: process.cwd(), input }).trim()
}
async function auth(method, path, body) {
  const response = await fetch(`${gateway}${path}`, { method,
    headers: { accept: 'application/json', 'content-type': 'application/json',
      'idempotency-key': `${runId}-${method}-${path.includes('register') ? 'register' : 'login'}` },
    body: JSON.stringify(body), redirect: 'manual' })
  const payload = await response.json().catch(() => null)
  return { status: response.status, token: payload?.data?.accessToken }
}
function cleanup() {
  const count = Number(sql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${identifier}'`))
  assert.ok(count <= 1)
  if (count === 0) return { accountFound: false }
  sql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id
      SET d.status='REVOKED',d.revoked_at=UTC_TIMESTAMP(6),d.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${identifier}' AND d.status='ACTIVE';
    UPDATE iam_service.iam_principal_role r JOIN iam_service.iam_account a ON a.principal_id=r.principal_id
      SET r.revoked_at=UTC_TIMESTAMP(6) WHERE a.identifier='${identifier}' AND r.revoked_at IS NULL;
    UPDATE iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id
      SET p.status='DISABLED' WHERE a.identifier='${identifier}';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions=''
      WHERE identifier='${identifier}'; COMMIT;`)
  const state = sql(`SELECT CONCAT(a.status,'|',p.status,'|',
      (SELECT COUNT(*) FROM iam_service.iam_session s WHERE s.principal_id=a.principal_id AND s.status='ACTIVE'),'|',
      (SELECT COUNT(*) FROM iam_service.iam_device d WHERE d.principal_id=a.principal_id AND d.status='ACTIVE'),'|',
      (SELECT COUNT(*) FROM iam_service.iam_principal_role r WHERE r.principal_id=a.principal_id AND r.revoked_at IS NULL))
    FROM iam_service.iam_account a JOIN iam_service.iam_principal p ON p.principal_id=a.principal_id
    WHERE a.identifier='${identifier}'`)
  assert.equal(state, 'DISABLED|DISABLED|0|0|0')
  return { accountFound: true, disabled: true, activeSessions: 0, activeDevices: 0, activeRoles: 0 }
}

try {
  assert.match(identifier, /^uat-release-copy-[a-z0-9]+@local\.invalid$/)
  const registration = await auth('POST', '/api/v1/auth/register', {
    identifier, password, device: { deviceType: 'WEB', clientVersion: 'uat-release-copy', deviceName: 'local-uat' },
  })
  assert.equal(registration.status, 201)
  assert.equal(sql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${identifier}'`), '1')
  const updated = sql(`UPDATE iam_service.iam_account SET roles='staff',permissions='admin.release.read'
    WHERE identifier='${identifier}' AND status='ACTIVE'; SELECT ROW_COUNT();`)
  assert.equal(updated, '1')
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.on('pageerror', error => evidence.pageErrors.push(String(error).slice(0, 180)))
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text().slice(0, 180)) })
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/admin/content-commands') && request.method() !== 'GET')
      evidence.contentCommands++
  })
  await page.goto(`${admin}/release`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/login**', { timeout: 10000 })
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/release', { timeout: 15000 })
  await page.getByText('暂无平台记录', { exact: true }).waitFor({ state: 'visible', timeout: 12000 })
  const text = await page.locator('body').innerText()
  evidence.page = { path: new URL(page.url()).pathname,
    emptyTextPresent: text.includes('暂无平台记录'),
    statusTextPresent: text.includes('待实际验收'),
    englishNoDataPresent: text.includes('No Data'),
    rawEnumPresent: text.includes('READY_FOR_TEST_STAGE'),
    qualityCaveatPresent: text.includes('本页为既有代码基线摘要'),
    layout: await page.evaluate(() => ({ width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1 })) }
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: `${output}/release-quality-postfix-390.png`, fullPage: true })
  await context.close()
  assert.equal(evidence.page.path, '/release')
  assert.equal(evidence.page.emptyTextPresent, true)
  assert.equal(evidence.page.statusTextPresent, true)
  assert.equal(evidence.page.englishNoDataPresent, false)
  assert.equal(evidence.page.rawEnumPresent, false)
  assert.equal(evidence.page.qualityCaveatPresent, true)
  assert.equal(evidence.page.layout.overflow, false)
  assert.equal(evidence.pageErrors.length, 0)
  assert.equal(evidence.consoleErrors.length, 0)
  assert.equal(evidence.contentCommands, 0)
  evidence.result = 'PASS'
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error)
  evidence.result = 'FAIL'
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanup() }
  catch (error) { evidence.cleanup = { failure: error instanceof Error ? error.message : String(error) }
    evidence.result = 'FAIL_CLEANUP'; process.exitCode = 1 }
  evidence.capturedAt = new Date().toISOString()
  await mkdir(output, { recursive: true })
  await writeFile(`${output}/release-quality-postfix.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ result: evidence.result, page: evidence.page,
    pageErrors: evidence.pageErrors.length, consoleErrors: evidence.consoleErrors.length,
    contentCommands: evidence.contentCommands, cleanup: evidence.cleanup, failure: evidence.failure ?? null }, null, 2))
}
