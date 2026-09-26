// Local-only, real-browser UAT. The generated credentials and tokens remain in memory.
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const gateway = 'http://127.0.0.1:18070'
const admin = 'http://127.0.0.1:18181'
const output = process.env.ADMIN_TWO_PAGE_UAT_OUTPUT || 'artifacts/uat-2026-09-23/admin-two-pages'
const runId = `adm2-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `${runId}@local.invalid`
const password = `Uat!${randomBytes(24).toString('base64url')}9a`
const device = { deviceType: 'WEB', clientVersion: 'admin-two-page-uat', deviceName: 'local-admin-uat' }
const permissions = 'admin.dashboard.read,admin.commerce.read,admin.projection.read,analytics.read'
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4',
  '--batch', '--skip-column-names', '--raw']
const mysqlPassword = process.env.MYSQL_ROOT_PASSWORD || 'root-local-only'
const evidence = { runId, capturedAt: new Date().toISOString(), localOnly: true,
  permissions: permissions.split(','), health: {}, setup: {}, pages: {}, requests: [],
  pageErrors: [], consoleErrors: [], cleanup: {}, secretsRecorded: false }
let sequence = 0
let browser

function assertLocal() {
  if (!/^adm2-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe synthetic identifier')
  if (new URL(gateway).hostname !== '127.0.0.1' || new URL(admin).hostname !== '127.0.0.1')
    throw new Error('local loopback only')
}
function sql(input) {
  return runMysql({ mysqlArgs, password: mysqlPassword, cwd: process.cwd(), input })
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
  const payload = await response.json().catch(() => null)
  return { status: response.status, token: payload?.data?.accessToken,
    code: payload?.error?.code ?? payload?.code ?? null }
}
async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/actuator/health`)
  return response.status
}
async function metricRange(token, from, to, metricId) {
  const params = new URLSearchParams({ from, to })
  if (metricId) params.set('metricId', metricId)
  const response = await fetch(`${gateway}/api/v1/admin/ops/metrics?${params}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    redirect: 'manual',
  })
  const payload = await response.json().catch(() => null)
  return { from, to, filteredMetric: !!metricId, status: response.status,
    owner: payload?.meta?.service ?? null,
    rowCount: Array.isArray(payload?.data) ? payload.data.length : null,
    errorCode: payload?.error?.code ?? null }
}
function grantExact() {
  if (sql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${identifier}';`).trim() !== '1')
    throw new Error('expected exactly one newly registered account')
  sql(`UPDATE iam_service.iam_account SET roles='staff', permissions='${permissions}'
       WHERE identifier='${identifier}' AND status='ACTIVE';`)
  const current = sql(`SELECT roles, permissions FROM iam_service.iam_account
                       WHERE identifier='${identifier}';`).trim()
  if (current !== `staff\t${permissions}`) throw new Error('read-only staff grant verification failed')
  evidence.setup.grantVerified = true
}
function cleanupExact() {
  const count = Number(sql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${identifier}';`).trim())
  if (count === 0) return { accountFound: false }
  if (count !== 1) throw new Error('cleanup target not unique')
  sql(`START TRANSACTION;
       UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
          SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
       UPDATE iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id
          SET d.status='REVOKED', d.revoked_at=UTC_TIMESTAMP(6), d.revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE a.identifier='${identifier}' AND d.status='ACTIVE';
       UPDATE iam_service.iam_principal_role r JOIN iam_service.iam_account a ON a.principal_id=r.principal_id
          SET r.revoked_at=UTC_TIMESTAMP(6)
        WHERE a.identifier='${identifier}' AND r.revoked_at IS NULL;
       UPDATE iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id
          SET p.status='DISABLED'
        WHERE a.identifier='${identifier}';
       UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
        WHERE identifier='${identifier}';
       COMMIT;`)
  const facts = sql(`SELECT a.status, a.roles, a.permissions, p.status,
      (SELECT COUNT(*) FROM iam_service.iam_session s WHERE s.principal_id=a.principal_id AND s.status='ACTIVE'),
      (SELECT COUNT(*) FROM iam_service.iam_device d WHERE d.principal_id=a.principal_id AND d.status='ACTIVE'),
      (SELECT COUNT(*) FROM iam_service.iam_principal_role r WHERE r.principal_id=a.principal_id AND r.revoked_at IS NULL)
    FROM iam_service.iam_account a JOIN iam_service.iam_principal p ON p.principal_id=a.principal_id
    WHERE a.identifier='${identifier}';`).trim().split('\t')
  const verified = facts.length === 7 && facts[0] === 'DISABLED' && facts[1] === ''
    && facts[2] === '' && facts[3] === 'DISABLED' && facts.slice(4).every(v => v === '0')
  if (!verified) throw new Error('synthetic staff cleanup verification failed')
  return { accountFound: true, disabled: true, permissionsCleared: true,
    activeSessions: 0, activeDevices: 0, activeRoles: 0 }
}
async function bodyState(page) {
  const text = await page.locator('body').innerText()
  return { skeletonVisible: await page.locator('.el-skeleton').count() > 0,
    hasUnavailable: text.includes('不可用'), hasEmpty: text.includes('暂无'),
    hasRefund: text.includes('退款操作') }
}
async function layout(page) {
  return page.evaluate(() => ({ viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }))
}
async function safeResponse(response) {
  const url = new URL(response.url())
  if (!url.pathname.startsWith('/api/v1/admin/ops/')) return
  const payload = await response.json().catch(() => null)
  const data = payload?.data
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  evidence.requests.push({ path: url.pathname, method: response.request().method(),
    status: response.status(), owner: payload?.meta?.service ?? null,
    rowCount: items.length, hasMeta: !!payload?.meta })
  if (url.pathname.endsWith('/commerce/orders') && items.length)
    firstOrderRef = typeof items[0].orderRef === 'string' ? items[0].orderRef : ''
}
let firstOrderRef = ''
let pagePhase = 'setup'
try {
  assertLocal()
  for (const [name, port] of Object.entries({ gateway: 18070, iam: 18087,
    adminOps: 18097, analytics: 18098, adminWeb: 18181 })) {
    evidence.health[name] = await health(port)
    if (evidence.health[name] !== 200) throw new Error(`${name} unhealthy`)
  }
  const registration = await call('POST', '/api/v1/auth/register', { identifier, password, device })
  evidence.setup.registrationStatus = registration.status
  if (registration.status !== 201 || !registration.token) throw new Error('synthetic registration failed')
  const adult = await call('POST', '/api/v1/iam/adult-gate',
    { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, registration.token)
  evidence.setup.adultGateStatus = adult.status
  if (adult.status !== 200) throw new Error('synthetic adult gate failed')
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents',
      { type, version: 'b30-consent-v1', decision: 'ACCEPTED' }, registration.token)
    evidence.setup[`${type.toLowerCase()}ConsentStatus`] = consent.status
    if (consent.status !== 200) throw new Error(`${type} synthetic consent failed`)
  }
  grantExact()
  const probeLogin = await call('POST', '/api/v1/auth/login', { identifier, password, device })
  evidence.setup.apiLoginStatus = probeLogin.status
  if (probeLogin.status !== 200 || !probeLogin.token) throw new Error('synthetic owner probe login failed')
  evidence.ownerRanges = [
    await metricRange(probeLogin.token, '2026-08-26', '2026-08-27'),
    await metricRange(probeLogin.token, '2026-09-18', '2026-09-23'),
    await metricRange(probeLogin.token, '2026-08-26', '2026-08-27', 'assessment_attempt'),
    await metricRange(probeLogin.token, '2026-09-18', '2026-09-23',
      'bulk-100x-analytics_metric_p-metric-0090'),
  ]
  await mkdir(output, { recursive: true })
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  // Delay the real owner responses briefly so the browser loading state can be observed.
  const delayRealGet = async route => {
    await new Promise(resolve => setTimeout(resolve, 500))
    await route.continue()
  }
  await page.route('**/api/v1/admin/ops/metrics*', delayRealGet)
  await page.route('**/api/v1/admin/ops/commerce/orders*', delayRealGet)
  page.on('response', response => { void safeResponse(response) })
  page.on('pageerror', error => evidence.pageErrors.push({ phase: pagePhase, message: String(error).slice(0, 160) }))
  page.on('console', message => {
    if (message.type() === 'error') evidence.consoleErrors.push({ phase: pagePhase,
      message: message.text().slice(0, 160) })
  })
  const uiCommands = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (pagePhase !== 'setup' && path.startsWith('/api/v1/admin/ops/') && request.method() !== 'GET')
      uiCommands.push({ phase: pagePhase, path, method: request.method() })
  })
  await page.goto(`${admin}/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/login**', { timeout: 10000 })
  evidence.setup.unauthenticatedRedirect = page.url().includes('/login')
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  pagePhase = 'dashboard'
  evidence.pages.dashboard = { loadingSkeletonSeen: await page.locator('.el-skeleton').first()
    .waitFor({ state: 'visible', timeout: 450 }).then(() => true).catch(() => false) }
  await page.waitForTimeout(1100)
  Object.assign(evidence.pages.dashboard, { url: new URL(page.url()).pathname,
    headingVisible: await page.locator('.dashboard-hero h2').count() > 0,
    state: await bodyState(page), layout1280: await layout(page),
    metricTableRows: await page.locator('.el-table__body tr').count() })
  await page.screenshot({ path: `${output}/dashboard-1280.png`, fullPage: true })
  await page.getByRole('button', { name: /刷新/ }).first().click()
  await page.waitForTimeout(700)
  evidence.pages.dashboard.refreshRequested = evidence.requests.filter(r => r.path.endsWith('/metrics')).length >= 2
  const commerceShortcut = page.locator('a[href="/commerce"]').first()
  if (await commerceShortcut.count()) await commerceShortcut.click()
  else await page.goto(`${admin}/commerce`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/commerce', { timeout: 15000 })
  pagePhase = 'commerce'
  evidence.pages.commerce = { loadingSkeletonSeen: await page.locator('.b13-ops .el-skeleton').first()
    .waitFor({ state: 'visible', timeout: 450 }).then(() => true).catch(() => false) }
  await page.waitForTimeout(1100)
  Object.assign(evidence.pages.commerce, { url: new URL(page.url()).pathname,
    state: await bodyState(page), layout1280: await layout(page),
    tableRows: await page.locator('.b13-ops > .el-card').first().locator('.el-table__body tr').count(),
    refundSectionVisible: await page.getByText('退款操作').count() > 0,
    refundActionVisible: await page.getByText('申请退款').count() > 0,
    supportStatVisible: await page.getByText('已加载工单').count() > 0,
    emptyMetricsTableVisible: await page.getByText('No Data').count() > 0 })
  const filter = page.locator('.list-toolbar input').first()
  await filter.fill(firstOrderRef || 'uat-no-matching-order')
  await page.waitForTimeout(250)
  evidence.pages.commerce.filter = { exercised: true, sourceHasRows: !!firstOrderRef,
    shownRows: await page.locator('.b13-ops > .el-card').first().locator('.el-table__body tr').count(),
    emptyVisible: await page.locator('.b13-ops > .el-card').first().locator('.el-empty').count() > 0 }
  await filter.clear()
  await page.screenshot({ path: `${output}/commerce-1280.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  evidence.pages.commerce.layout390 = await layout(page)
  await page.screenshot({ path: `${output}/commerce-390.png`, fullPage: true })
  await page.goto(`${admin}/dashboard`, { waitUntil: 'domcontentloaded' })
  pagePhase = 'dashboard-390'
  await page.waitForTimeout(850)
  evidence.pages.dashboard.layout390 = await layout(page)
  await page.screenshot({ path: `${output}/dashboard-390.png`, fullPage: true })
  pagePhase = 'dashboard-network-error'
  await page.route('**/api/v1/admin/ops/metrics*', route => route.abort('failed'))
  await page.getByRole('button', { name: /刷新/ }).first().click()
  await page.waitForTimeout(450)
  evidence.pages.dashboard.networkErrorVisible = await page.locator('.el-alert--warning').count() > 0
  await page.screenshot({ path: `${output}/dashboard-network-error.png`, fullPage: true })
  await page.unroute('**/api/v1/admin/ops/metrics*')
  pagePhase = 'commerce-network-error'
  await page.goto(`${admin}/commerce`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.route('**/api/v1/admin/ops/commerce/orders*', route => route.abort('failed'))
  await page.getByRole('button', { name: '刷新' }).first().click()
  await page.waitForTimeout(450)
  evidence.pages.commerce.networkErrorVisible = await page.locator('.el-alert--error').count() > 0
  await page.screenshot({ path: `${output}/commerce-network-error.png`, fullPage: true })
  await page.unroute('**/api/v1/admin/ops/commerce/orders*')
  evidence.pages.commerce.uiCommandRequests = uiCommands
  await context.close()
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanupExact() }
  catch (error) { evidence.cleanup = { failed: error instanceof Error ? error.message : String(error) }; process.exitCode = 1 }
  await mkdir(output, { recursive: true })
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ runId, health: evidence.health, setup: evidence.setup,
    ownerRanges: evidence.ownerRanges, pages: evidence.pages, requests: evidence.requests, pageErrors: evidence.pageErrors,
    consoleErrors: evidence.consoleErrors, cleanup: evidence.cleanup,
    failure: evidence.failure ?? null, secretsRecorded: false }, null, 2))
}
