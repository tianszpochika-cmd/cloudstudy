// Local candidate-only UI regression. Generated credentials and JWTs stay in memory.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const contentCode = `uat-review-button-${stamp}`
const identifier = `${contentCode}@local.invalid`
const password = `Uat!${randomBytes(24).toString('base64url')}9a`
const gateway = 'http://127.0.0.1:18070'
const adminWeb = 'http://127.0.0.1:18181'
const output = `artifacts/uat-2026-09-23/admin-review-submit-ui-postfix/${stamp}`
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw']
const mysqlPassword = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only'
const device = { deviceType: 'WEB', clientVersion: 'uat-review-button', deviceName: 'local-uat' }
const evidence = { capturedAt: '', localCandidateOnly: true, checks: [], browser: {}, cleanup: {}, pageErrors: [], secretsRecorded: false }
let principal = ''
let browser
let sequence = 0

function sql(input) {
  return runMysql({ mysqlArgs, password: mysqlPassword, cwd: process.cwd(), input }).trim()
}
function check(name, actual, predicate) {
  const ok = Boolean(predicate(actual))
  evidence.checks.push({ name, actual, ok })
  if (!ok) throw new Error(`${name}: ${JSON.stringify(actual)}`)
}
async function call(method, path, { token, body } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    headers['idempotency-key'] = `uat-review-button-${stamp}-${++sequence}`
  }
  const response = await fetch(`${gateway}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, data: json?.data ?? null, token: json?.data?.accessToken ?? null }
}
function refs() {
  return sql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM content_service.content_public_projection WHERE content_id='${contentCode}'),':',
    (SELECT COUNT(*) FROM content_service.content_outbox_event WHERE aggregate_id='${contentCode}'),':',
    (SELECT COUNT(*) FROM content_service.scheduled_publish_task WHERE pack_code='${contentCode}'),':',
    (SELECT COUNT(*) FROM assessment_service.b10_assessment_session WHERE content_code='${contentCode}' OR alternative_content_code='${contentCode}'),':',
    (SELECT COUNT(*) FROM learning_service.learning_task WHERE content_id='${contentCode}'));`)
}
function cleanup() {
  const result = { draftRemoved: false, accountDisabled: false, activeSessions: null, activeDevices: null, residualContent: null }
  const accountPrincipal = sql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  if (accountPrincipal) {
    assert.match(accountPrincipal, /^[0-9a-f-]{36}$/)
    assert.ok(!principal || accountPrincipal === principal)
  }
  const definition = sql(`SELECT CONCAT(created_by,'|',COALESCE(current_published_version_id,'NONE'))
    FROM content_service.content_definition WHERE content_code='${contentCode}'`)
  if (definition) {
    assert.equal(definition, `${accountPrincipal}|NONE`)
    assert.equal(refs(), '0:0:0:0:0')
    const version = sql(`SELECT CONCAT(version_no,'|',status,'|',copyright_status,'|',
      COALESCE(first_reviewer,'NONE'),'|',COALESCE(final_reviewer,'NONE'),'|',
      COALESCE(publisher,'NONE'),'|',COALESCE(rights_allows_learning,0),'|',
      COALESCE(authorization_evidence_ref,'NONE'))
      FROM content_service.content_version WHERE content_id='${contentCode}' ORDER BY version_no`)
    assert.equal(version, '1|DRAFT|PENDING|NONE|NONE|NONE|0|NONE')
    const removed = sql(`START TRANSACTION;
      DELETE FROM content_service.content_idempotency_record WHERE scope LIKE 'platform:${accountPrincipal}:%';
      DELETE FROM content_service.content_version WHERE content_id='${contentCode}';
      SELECT CONCAT('versions:',ROW_COUNT());
      DELETE FROM content_service.content_definition WHERE content_code='${contentCode}'
        AND created_by='${accountPrincipal}' AND current_published_version_id IS NULL;
      SELECT CONCAT('definition:',ROW_COUNT()); COMMIT;`)
    assert.match(removed, /versions:1/)
    assert.match(removed, /definition:1/)
    result.draftRemoved = true
  }
  if (accountPrincipal) {
    sql(`START TRANSACTION;
      UPDATE iam_service.iam_session SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6),revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE principal_id='${accountPrincipal}' AND status='ACTIVE';
      UPDATE iam_service.iam_device SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6),revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE principal_id='${accountPrincipal}' AND status='ACTIVE';
      UPDATE iam_service.iam_principal_role SET revoked_at=UTC_TIMESTAMP(6)
        WHERE principal_id='${accountPrincipal}' AND revoked_at IS NULL;
      UPDATE iam_service.iam_principal SET status='DISABLED' WHERE principal_id='${accountPrincipal}';
      UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions=''
        WHERE identifier='${identifier}' AND principal_id='${accountPrincipal}'; COMMIT;`)
    const status = sql(`SELECT CONCAT(a.status,'|',p.status,'|',
      (SELECT COUNT(*) FROM iam_service.iam_session WHERE principal_id=a.principal_id AND status='ACTIVE'),'|',
      (SELECT COUNT(*) FROM iam_service.iam_device WHERE principal_id=a.principal_id AND status='ACTIVE'),'|',
      (SELECT COUNT(*) FROM iam_service.iam_principal_role WHERE principal_id=a.principal_id AND revoked_at IS NULL))
      FROM iam_service.iam_account a JOIN iam_service.iam_principal p ON p.principal_id=a.principal_id
      WHERE a.identifier='${identifier}'`)
    assert.equal(status, 'DISABLED|DISABLED|0|0|0')
    result.accountDisabled = true
    result.activeSessions = 0
    result.activeDevices = 0
  }
  result.residualContent = Number(sql(`SELECT COUNT(*) FROM content_service.content_definition WHERE content_code='${contentCode}'`))
  assert.equal(result.residualContent, 0)
  return result
}
async function layout(page) {
  return page.evaluate(() => ({ width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }))
}

try {
  assert.match(contentCode, /^uat-review-button-[a-z0-9]+$/)
  for (const [name, url] of Object.entries({ gateway: `${gateway}/actuator/health/readiness`, admin: adminWeb })) {
    check(`${name} ready`, (await fetch(url)).status, value => value === 200)
  }
  check('unique synthetic code', Number(sql(`SELECT COUNT(*) FROM content_service.content_definition WHERE content_code='${contentCode}'`)), value => value === 0)
  const registered = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } })
  check('synthetic adult register', registered.status, value => value === 201)
  principal = sql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principal, /^[0-9a-f-]{36}$/)
  const granted = sql(`UPDATE iam_service.iam_account SET roles='staff,content-editor',
    permissions='admin.content.read,admin.content.write,content:write'
    WHERE identifier='${identifier}' AND status='ACTIVE'; SELECT ROW_COUNT();`)
  assert.equal(granted, '1')
  const loggedIn = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } })
  check('synthetic staff login', loggedIn.status, value => value === 200)
  assert.equal(typeof loggedIn.token, 'string')
  const created = await call('POST', '/api/v1/admin/content-commands', { token: loggedIn.token,
    body: { command: 'CREATE_DRAFT', contentCode, expectedStateVersion: 0,
      content: { contentType: 'COURSE_UNIT', title: 'UAT temporary review button draft',
        summary: 'Unpublished synthetic UI gate only', contentLocale: 'en-US',
        targetLevel: 'A1', sourceCode: 'LOCAL_UAT', licenseCode: 'LOCAL_UAT_PENDING' } } })
  check('pending synthetic draft created', created.status, value => value === 202)
  const owner = await call('GET', `/api/v1/admin/content-commands/${contentCode}`, { token: loggedIn.token })
  check('owner draft pending', { status: owner.status, state: owner.data?.latestStatus, rights: owner.data?.rightsStatus },
    value => value.status === 200 && value.state === 'DRAFT' && value.rights === 'PENDING')
  evidence.ownerRuntimeReviewSubmissionReady = owner.data?.reviewSubmissionReady ?? null
  await mkdir(output, { recursive: true })
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', error => evidence.pageErrors.push(String(error).slice(0, 200)))
  await page.goto(`${adminWeb}/content`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/login**', { timeout: 10000 })
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/content', { timeout: 15000 })
  try {
    await page.getByRole('tab', { name: /内容库/ }).waitFor({ state: 'visible', timeout: 10000 })
  } catch (error) {
    evidence.browser.diagnostic = { path: new URL(page.url()).pathname,
      headings: await page.locator('h1,h2').allInnerTexts(),
      alerts: await page.getByRole('alert').allInnerTexts() }
    await page.screenshot({ path: `${output}/unavailable.png`, fullPage: true })
    throw error
  }
  await page.locator('.list-toolbar input').fill(contentCode)
  await page.getByRole('button', { name: '打开' }).first().click()
  await page.getByRole('tab', { name: '内容编辑' }).waitFor({ state: 'visible' })
  const submit = page.getByRole('button', { name: '提交双审' })
  const warning = page.getByText('版权、校验或媒体材料未就绪，暂不能提交。', { exact: true })
  evidence.browser.width1280 = { submitDisabled: await submit.isDisabled(), warningVisible: await warning.count() > 0,
    layout: await layout(page) }
  await page.screenshot({ path: `${output}/review-button-1280.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  evidence.browser.width390 = { submitDisabled: await submit.isDisabled(), warningVisible: await warning.count() > 0,
    layout: await layout(page) }
  await page.screenshot({ path: `${output}/review-button-390.png`, fullPage: true })
  await context.close()
  check('PENDING draft review button disabled at both widths', evidence.browser,
    value => value.width1280.submitDisabled && value.width390.submitDisabled
      && value.width1280.warningVisible && value.width390.warningVisible
      && !value.width1280.layout.overflow && !value.width390.layout.overflow)
  check('browser page errors', evidence.pageErrors.length, value => value === 0)
  evidence.result = 'CANDIDATE_UI_NEGATIVE_BOUNDARY_PASS'
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error)
  evidence.result = 'FAIL'
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanup() }
  catch (error) {
    evidence.cleanup = { failure: error instanceof Error ? error.message : String(error) }
    evidence.result = 'FAIL_CLEANUP'
    process.exitCode = 1
  }
  evidence.capturedAt = new Date().toISOString()
  await mkdir(output, { recursive: true })
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ result: evidence.result, checks: evidence.checks.length,
    failure: evidence.failure ?? null, cleanup: evidence.cleanup, output }, null, 2))
}
