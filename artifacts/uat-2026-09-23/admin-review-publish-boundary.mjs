// Local-only UAT. All credentials and JWTs stay in process memory.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const contentCode = `uat-review-${stamp}`
const editorId = `${contentCode}-editor@local.invalid`
const reviewerId = `${contentCode}-reviewer@local.invalid`
const editorPassword = `Uat!${randomBytes(24).toString('base64url')}9a`
const reviewerPassword = `Uat!${randomBytes(24).toString('base64url')}9a`
const gateway = 'http://127.0.0.1:18070'
const adminWeb = 'http://127.0.0.1:18181'
const output = 'artifacts/uat-2026-09-23/admin-review-publish-boundary'
const device = { deviceType: 'WEB', clientVersion: 'uat-admin-review-boundary', deviceName: 'local-uat' }
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4', '--batch', '--skip-column-names', '--raw']
const mysqlPassword = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only'
const evidence = { stamp, contentCode, localOnly: true, checks: [], browser: {},
  ownerFacts: {}, cleanup: {}, pageErrors: [], secretsRecorded: false }
let editorPrincipal = ''
let reviewerPrincipal = ''
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
async function call(method, path, { token, body, headers: extraHeaders } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', ...extraHeaders }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    headers['idempotency-key'] = `uat-review-${stamp}-${++sequence}`
  }
  const response = await fetch(`${gateway}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, code: json?.error?.code ?? json?.code ?? null,
    data: json?.data ?? null, token: json?.data?.accessToken ?? null }
}
function safe(response) {
  return { status: response.status, code: response.code }
}
async function register(identifier, password) {
  const response = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } })
  check(`register ${identifier === editorId ? 'editor' : 'reviewer'}`, safe(response), x => x.status === 201)
  assert.equal(typeof response.token, 'string')
  const principal = sql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principal, /^[0-9a-f-]{36}$/)
  return { principal, token: response.token }
}
async function login(identifier, password) {
  const response = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } })
  check(`login ${identifier === editorId ? 'editor' : 'reviewer'}`, safe(response), x => x.status === 200)
  assert.equal(typeof response.token, 'string')
  return response.token
}
function grant(identifier, roles, permissions) {
  const changed = sql(`UPDATE iam_service.iam_account SET roles='${roles}', permissions='${permissions}'
    WHERE identifier='${identifier}' AND status='ACTIVE'; SELECT ROW_COUNT();`)
  assert.equal(changed, '1')
}
function ownerFacts() {
  const definition = sql(`SELECT CONCAT(created_by,'|',COALESCE(current_published_version_id,'NONE'))
    FROM content_service.content_definition WHERE content_code='${contentCode}'`)
  const rows = sql(`SELECT CONCAT(version_no,'|',status,'|',copyright_status,'|',
    COALESCE(first_reviewer,'NONE'),'|',COALESCE(final_reviewer,'NONE'),'|',
    COALESCE(publisher,'NONE'),'|',COALESCE(rights_allows_learning,0),'|',
    COALESCE(authorization_evidence_ref,'NONE'))
    FROM content_service.content_version WHERE content_id='${contentCode}' ORDER BY version_no`)
  const refs = sql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM content_service.content_public_projection WHERE content_id='${contentCode}'),':',
    (SELECT COUNT(*) FROM content_service.content_outbox_event WHERE aggregate_id='${contentCode}'),':',
    (SELECT COUNT(*) FROM content_service.scheduled_publish_task WHERE pack_code='${contentCode}'),':',
    (SELECT COUNT(*) FROM assessment_service.b10_assessment_session WHERE content_code='${contentCode}' OR alternative_content_code='${contentCode}'),':',
    (SELECT COUNT(*) FROM learning_service.learning_task WHERE content_id='${contentCode}'));`)
  return { definition, versions: rows ? rows.split(/\r?\n/) : [], refs }
}
function cleanup() {
  const result = { definitionRemoved: 0, versionRowsRemoved: 0, receiptsRemoved: 0,
    accountsDisabled: [], refsBefore: null, residual: null }
  const facts = ownerFacts()
  result.refsBefore = facts.refs
  if (facts.definition) {
    assert.equal(facts.definition, `${editorPrincipal}|NONE`, 'only our unpublished draft can be removed')
    assert.equal(facts.refs, '0:0:0:0:0', 'cannot remove content referenced outside this UAT')
    assert.ok(facts.versions.length <= 1 && facts.versions.every(v => v === '1|DRAFT|PENDING|NONE|NONE|NONE|0|NONE'),
      'only our unreviewed draft version can be removed')
    const removed = sql(`START TRANSACTION;
      DELETE FROM content_service.content_idempotency_record
        WHERE scope LIKE 'platform:${editorPrincipal}:%' OR scope LIKE 'platform:${reviewerPrincipal}:%';
      SELECT CONCAT('receipts:',ROW_COUNT());
      DELETE FROM content_service.content_version WHERE content_id='${contentCode}';
      SELECT CONCAT('versions:',ROW_COUNT());
      DELETE FROM content_service.content_definition WHERE content_code='${contentCode}'
        AND created_by='${editorPrincipal}' AND current_published_version_id IS NULL;
      SELECT CONCAT('definition:',ROW_COUNT()); COMMIT;`)
    const counts = Object.fromEntries(removed.split(/\r?\n/).filter(v => /^(receipts|versions|definition):\d+$/.test(v))
      .map(v => { const [key, value] = v.split(':'); return [key, Number(value)] }))
    result.receiptsRemoved = counts.receipts ?? 0
    result.versionRowsRemoved = counts.versions ?? 0
    result.definitionRemoved = counts.definition ?? 0
    assert.equal(result.definitionRemoved, 1)
  }
  for (const identifier of [editorId, reviewerId]) {
    const exists = Number(sql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${identifier}'`))
    assert.ok(exists <= 1)
    if (!exists) continue
    sql(`START TRANSACTION;
      UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
        SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
      UPDATE iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id
        SET d.status='REVOKED',d.revoked_at=UTC_TIMESTAMP(6),d.revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE a.identifier='${identifier}' AND d.status='ACTIVE';
      UPDATE iam_service.iam_principal_role r JOIN iam_service.iam_account a ON a.principal_id=r.principal_id
        SET r.revoked_at=UTC_TIMESTAMP(6)
        WHERE a.identifier='${identifier}' AND r.revoked_at IS NULL;
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
    result.accountsDisabled.push(identifier)
  }
  result.residual = { definition: Number(sql(`SELECT COUNT(*) FROM content_service.content_definition WHERE content_code='${contentCode}'`)),
    versions: Number(sql(`SELECT COUNT(*) FROM content_service.content_version WHERE content_id='${contentCode}'`)),
    activeAccounts: Number(sql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier IN ('${editorId}','${reviewerId}') AND status='ACTIVE'`)) }
  assert.deepEqual(result.residual, { definition: 0, versions: 0, activeAccounts: 0 })
  return result
}
async function layout(page) {
  return page.evaluate(() => ({ width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }))
}

try {
  assert.match(contentCode, /^uat-review-[a-z0-9]+$/)
  assert.equal(new URL(gateway).hostname, '127.0.0.1')
  assert.equal(new URL(adminWeb).hostname, '127.0.0.1')
  for (const [name, url] of Object.entries({ gateway: `${gateway}/actuator/health/readiness`,
    admin: adminWeb, owner: 'http://127.0.0.1:18089/actuator/health/readiness' })) {
    const response = await fetch(url)
    check(`${name} ready`, response.status, x => x === 200)
  }
  check('no contentCode collision', Number(sql(`SELECT COUNT(*) FROM content_service.content_definition
    WHERE content_code='${contentCode}'`)), x => x === 0)
  const path = `/api/v1/admin/content-commands/${contentCode}`
  check('anonymous admin read', safe(await call('GET', path)), x => x.status === 401)
  const editor = await register(editorId, editorPassword)
  editorPrincipal = editor.principal
  check('learner admin read', safe(await call('GET', path, { token: editor.token })), x => x.status === 403)
  const forged = await call('POST', '/api/v1/admin/content-commands', { token: editor.token,
    headers: { 'x-role': 'content-publisher', 'x-b5-role': 'content-publisher' },
    body: { command: 'PUBLISH', contentCode, expectedStateVersion: 1, targetVersionNumber: 1 } })
  check('learner forged role headers do not create missing content', safe(forged),
    x => x.status === 403)
  grant(editorId, 'staff,content-editor,content-publisher,review-l1,review-l2',
    'admin.content.read,admin.content.write,admin.content.review.l1,admin.content.review.l2,admin.content.publish,admin.content.rollback,admin.release.read,content:write,content:publish,content:review:first,content:review:final')
  const editorToken = await login(editorId, editorPassword)
  const reviewer = await register(reviewerId, reviewerPassword)
  reviewerPrincipal = reviewer.principal
  grant(reviewerId, 'staff,review-l1,review-l2',
    'admin.content.read,admin.content.review.l1,admin.content.review.l2,content:review:first,content:review:final')
  const reviewerToken = await login(reviewerId, reviewerPassword)

  const created = await call('POST', '/api/v1/admin/content-commands', { token: editorToken,
    body: { command: 'CREATE_DRAFT', contentCode, expectedStateVersion: 0,
      content: { contentType: 'COURSE_UNIT', title: 'UAT temporary review boundary draft',
        summary: 'Unpublished synthetic data for negative gate tests', contentLocale: 'en-US',
        targetLevel: 'A1', sourceCode: 'LOCAL_UAT', licenseCode: 'LOCAL_UAT_PENDING' } } })
  check('new isolated draft', safe(created), x => x.status === 202)
  const state = await call('GET', path, { token: editorToken })
  check('owner readback', { status: state.status, statusField: state.data?.latestStatus,
    rightsStatus: state.data?.rightsStatus, stages: state.data?.reviewStages },
  x => x.status === 200 && x.statusField === 'DRAFT' && x.rightsStatus === 'PENDING'
    && Array.isArray(x.stages) && x.stages.length === 0)
  evidence.ownerFacts.initial = ownerFacts()
  check('unpublished pending rights DB', evidence.ownerFacts.initial,
    x => x.definition === `${editorPrincipal}|NONE` && x.refs === '0:0:0:0:0'
      && x.versions.length === 1 && x.versions[0] === '1|DRAFT|PENDING|NONE|NONE|NONE|0|NONE')

  const forgedExisting = await call('POST', '/api/v1/admin/content-commands', { token: editor.token,
    headers: { 'x-role': 'content-publisher', 'x-b5-role': 'content-publisher' },
    body: { command: 'PUBLISH', contentCode, expectedStateVersion: 1, targetVersionNumber: 1 } })
  check('learner forged role headers cannot publish existing draft', safe(forgedExisting),
    x => x.status === 403)

  const baseCommand = { contentCode, expectedStateVersion: Number(state.data.stateVersion), targetVersionNumber: 1 }
  const selfFirst = await call('POST', '/api/v1/admin/content-commands', { token: editorToken,
    body: { command: 'REVIEW_FIRST', ...baseCommand, reviewDecision: 'APPROVED' } })
  check('author self review blocked', safe(selfFirst), x => x.status === 409)
  const prematureFinal = await call('POST', '/api/v1/admin/content-commands', { token: reviewerToken,
    body: { command: 'REVIEW_FINAL', ...baseCommand, reviewDecision: 'APPROVED' } })
  check('independent final review before first blocked', safe(prematureFinal), x => x.status === 409)
  const prematurePublish = await call('POST', '/api/v1/admin/content-commands', { token: editorToken,
    body: { command: 'PUBLISH', ...baseCommand } })
  check('publish without dual approval blocked', safe(prematurePublish), x => x.status === 409)
  const prematureRollback = await call('POST', '/api/v1/admin/content-commands', { token: editorToken,
    body: { command: 'ROLLBACK', ...baseCommand, reasonCode: 'LOCAL_UAT_INVALID_TARGET' } })
  check('rollback without current publication blocked', safe(prematureRollback), x => x.status === 409)
  evidence.ownerFacts.afterNegativeCommands = ownerFacts()
  check('negative commands made no owner mutation', evidence.ownerFacts.afterNegativeCommands,
    x => JSON.stringify(x) === JSON.stringify(evidence.ownerFacts.initial))

  await mkdir(output, { recursive: true })
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', error => evidence.pageErrors.push(String(error).slice(0, 200)))
  await page.goto(`${adminWeb}/content`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/login**', { timeout: 10000 })
  evidence.browser.loginRedirect = true
  await page.locator('input[name="identifier"]').fill(editorId)
  await page.locator('input[name="password"]').fill(editorPassword)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/content', { timeout: 15000 })
  await page.getByRole('tab', { name: /内容库/ }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.list-toolbar input').fill(contentCode)
  await page.getByRole('button', { name: '打开' }).first().click()
  await page.getByRole('tab', { name: '内容编辑' }).waitFor({ state: 'visible' })
  const publishButton = page.getByRole('button', { name: '发布', exact: true })
  evidence.browser.content = { path: new URL(page.url()).pathname,
    draftVisible: await page.getByText('UAT temporary review boundary draft').count() > 0,
    publishDisabled: await publishButton.isDisabled(), layout1280: await layout(page) }
  await page.screenshot({ path: `${output}/content-draft-1280.png`, fullPage: true })
  await page.getByRole('tab', { name: /发布回滚/ }).click()
  evidence.browser.content.rollbackDisabled = await page.getByRole('button', { name: '确认回滚' }).isDisabled()
  await page.screenshot({ path: `${output}/content-rollback-1280.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  evidence.browser.content.layout390 = await layout(page)
  await page.screenshot({ path: `${output}/content-rollback-390.png`, fullPage: true })
  await page.goto(`${adminWeb}/release`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/release', { timeout: 10000 })
  await page.getByText('本页为既有代码基线摘要', { exact: false })
    .waitFor({ state: 'visible', timeout: 12000 })
  evidence.browser.release = { path: new URL(page.url()).pathname,
    qualityWarningVisible: await page.getByText('本页为既有代码基线摘要', { exact: false }).count() > 0,
    contentPublishControls: await page.getByRole('button', { name: /发布|下线|回滚/ }).count(),
    layout390: await layout(page) }
  await page.screenshot({ path: `${output}/release-quality-390.png`, fullPage: true })
  await context.close()
  check('browser draft action guards', evidence.browser.content,
    x => x.path === '/content' && x.publishDisabled && x.rollbackDisabled
      && !x.layout1280.overflow && !x.layout390.overflow)
  check('release page is quality evidence, not content publishing', evidence.browser.release,
    x => x.path === '/release' && x.qualityWarningVisible && x.contentPublishControls === 0
      && !x.layout390.overflow)
  check('no browser page errors', evidence.pageErrors.length, x => x === 0)
  evidence.result = 'NEGATIVE_BOUNDARIES_PASS_FULL_PUBLISH_UNVERIFIED'
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
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ result: evidence.result, checks: evidence.checks.length,
    failure: evidence.failure ?? null, cleanup: evidence.cleanup, output }, null, 2))
}
