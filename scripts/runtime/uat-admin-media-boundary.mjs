/** Read-only admin media page and safe Gateway boundary probe. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const identifier = `uat-admin-media-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const missingAssetId = randomUUID()
const gateway = 'http://127.0.0.1:18070'
const admin = 'http://127.0.0.1:18181'
const output = 'artifacts/uat-2026-09-23/admin-media-boundary.json'
const screenshotDir = 'artifacts/uat-2026-09-23/screenshots/admin-media-boundary'
const evidence = {
  scope: 'PAGE-P1-ADMIN-MEDIA, local browser and Gateway/media owner; no object upload, mutation or rights change',
  designRoute: '/admin/content/media', actualContentRoute: '/content', checks: [],
  browser: {}, gateway: {}, cleanup: null,
}
let browser = null
let principalId = null
let registered = false

function mysql(sql) {
  return execFileSync('docker', [
    'exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1',
    'mysql', '-uroot', '--batch', '--skip-column-names', '-e', sql,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function record(name, observed, expected, ok) {
  evidence.checks.push({ name, observed, expected, ok })
  if (!ok) throw new Error(`${name}: ${JSON.stringify(observed)}; expected ${JSON.stringify(expected)}`)
}

async function call(method, route, { token, body, key } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (key) headers['Idempotency-Key'] = key
  const response = await fetch(`${gateway}${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, code: json?.error?.code ?? json?.code ?? null,
    data: json?.data ?? json }
}

async function loginBrowser(page) {
  await page.goto(`${admin}/content`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button.login-submit').click()
  await page.waitForURL('**/content', { timeout: 30000 })
  await page.locator('.content-tabs').waitFor({ timeout: 30000 })
}

function cleanup() {
  assert.match(identifier, /^uat-admin-media-[a-z0-9]+@local\.invalid$/)
  if (principalId) assert.match(principalId, /^[0-9a-f-]{36}$/)
  const account = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
       SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
     WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions='' WHERE identifier='${identifier}';
    SELECT CONCAT(COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
    COMMIT;`)
  const activeSessions = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE'`))
  const syntheticAssetRows = principalId ? Number(mysql(`SELECT COUNT(*) FROM media_service.media_asset WHERE owner_subject='${principalId}'`)) : 0
  const syntheticWriteReceipts = principalId ? Number(mysql(`SELECT COUNT(*) FROM media_service.media_write_idempotency_record WHERE subject_id='${principalId}'`)) : 0
  if (registered) assert.equal(account, '1:DISABLED')
  assert.equal(activeSessions, 0)
  assert.equal(syntheticAssetRows, 0)
  assert.equal(syntheticWriteReceipts, 0)
  return { account, activeSessions, syntheticAssetRows, syntheticWriteReceipts }
}

try {
  await mkdir(screenshotDir, { recursive: true })
  const health = await Promise.all([
    fetch(`${gateway}/actuator/health/readiness`), fetch(`${admin}/content`),
  ])
  record('fixed Gateway and admin frontend healthy', health.map(r => r.status), [200, 200], health.every(r => r.status === 200))
  const metadataCounts = mysql("SELECT COUNT(*),SUM(asset_status='ACTIVE'),SUM(asset_status='UPLOADING'),SUM(checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$'),SUM(asset_status='ACTIVE' AND checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$'),SUM(object_version IS NOT NULL AND object_version<>'') FROM media_service.media_asset")
    .split('\t').map(Number)
  evidence.mediaMetadataAggregate = Object.fromEntries(
    ['total', 'active', 'uploading', 'sha256FormatValid', 'activeSha256FormatValid', 'nonemptyObjectVersion'].map((key, i) => [key, metadataCounts[i]]))

  const device = { deviceType: 'WEB', clientVersion: 'uat-admin-media-1', deviceName: 'uat-admin-media' }
  const registration = await call('POST', '/api/v1/auth/register', {
    body: { identifier, password, device }, key: `reg-${stamp}`,
  })
  registered = registration.status === 201
  record('synthetic account registered', registration.status, 201, registered)
  principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principalId, /^[0-9a-f-]{36}$/)
  mysql(`UPDATE iam_service.iam_account SET roles='staff,content-editor', permissions='admin.dashboard.read,admin.content.read,admin.content.write' WHERE identifier='${identifier}'`)
  const preGateToken = registration.data?.accessToken
  assert.equal(typeof preGateToken, 'string')
  const gate = await call('POST', '/api/v1/iam/adult-gate', { token: preGateToken,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, key: `uat-admin-media-${stamp}-gate` })
  record('adult Gate', gate.status, 200, gate.status === 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', { token: preGateToken,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' }, key: `uat-admin-media-${stamp}-${type.toLowerCase()}` })
    record(`${type} consent`, consent.status, 200, consent.status === 200)
  }

  const noMediaLogin = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, key: `login-no-media-${stamp}` })
  record('staff login', noMediaLogin.status, 200, noMediaLogin.status === 200)
  const contentOnlyToken = noMediaLogin.data?.accessToken
  assert.equal(typeof contentOnlyToken, 'string')
  const route = `/api/v1/media/assets/${missingAssetId}`
  evidence.gateway.anonymousAsset = await call('GET', route)
  evidence.gateway.contentStaffAsset = await call('GET', route, { token: contentOnlyToken })
  const existingAssetId = mysql("SELECT asset_id FROM media_service.media_asset WHERE asset_status='ACTIVE' AND checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$' ORDER BY asset_id LIMIT 1")
  assert.match(existingAssetId, /^[0-9a-f-]{36}$/)
  const existingRead = await call('GET', `/api/v1/media/assets/${existingAssetId}`, { token: contentOnlyToken })
  evidence.gateway.contentStaffExistingAsset = { status: existingRead.status, code: existingRead.code }
  record('anonymous media metadata denied', evidence.gateway.anonymousAsset.status, 401, evidence.gateway.anonymousAsset.status === 401)
  record('unknown media metadata is not disclosed', evidence.gateway.contentStaffAsset.status, 404, evidence.gateway.contentStaffAsset.status === 404)
  record('existing media denied without media permission', existingRead.status, '403 or 404', [403, 404].includes(existingRead.status))

  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 180)))
  await page.goto(`${admin}/content`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/login?**', { timeout: 15000 })
  evidence.browser.anonymousRoute = new URL(page.url()).pathname
  await page.screenshot({ path: `${screenshotDir}/anonymous-login.png`, fullPage: true })
  await loginBrowser(page)
  await page.waitForTimeout(2500)
  evidence.browser.contentLoaded = await page.locator('.content-tabs').count() === 1
  evidence.browser.contentError = await page.getByText('内容服务暂时不可用').count() > 0
  if (evidence.browser.contentError) {
    await page.getByRole('button', { name: '刷新' }).click()
    await page.waitForTimeout(2500)
    evidence.browser.contentErrorAfterRetry = await page.getByText('内容服务暂时不可用').count() > 0
  }
  evidence.browser.mediaControls = {
    uploadInputs: await page.locator('#admin-main input[type="file"]').count(),
    mediaTabs: await page.locator('#admin-main [role="tab"]').filter({ hasText: /媒体/ }).count(),
    uploadButtons: await page.locator('#admin-main button').filter({ hasText: /上传|转码|隔离|处理任务/ }).count(),
  }
  await page.screenshot({ path: `${screenshotDir}/content-1280.png`, fullPage: true })
  evidence.browser.desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${screenshotDir}/content-390.png`, fullPage: true })
  evidence.browser.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  record('content shell has no media workbench controls', evidence.browser.mediaControls,
    { uploadInputs: 0, mediaTabs: 0, uploadButtons: 0 }, Object.values(evidence.browser.mediaControls).every(v => v === 0))
  record('content shell no document overflow at 1280/390', [evidence.browser.desktopOverflow, evidence.browser.mobileOverflow],
    [false, false], !evidence.browser.desktopOverflow && !evidence.browser.mobileOverflow)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('tab', { name: '内容编辑' }).click()
  evidence.browser.editorShowsLicenseCode = await page.getByText('版权编码').count() > 0
  evidence.browser.editorUploadInputs = await page.locator('#admin-main input[type="file"]').count()
  await page.screenshot({ path: `${screenshotDir}/content-editor-1280.png`, fullPage: true })
  await page.goto(`${admin}/admin/content/media`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/dashboard', { timeout: 20000 })
  evidence.browser.canonicalRouteResult = new URL(page.url()).pathname
  await page.screenshot({ path: `${screenshotDir}/canonical-route-redirect.png`, fullPage: true })

  const isContentListUrl = url => url.pathname === '/api/v1/admin/content-commands'
  let simulatedErrorHits = 0
  await page.route(isContentListUrl, r => {
    simulatedErrorHits += 1
    return r.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'CONTENT_UNAVAILABLE', message: '服务暂时不可用' } }) })
  })
  await page.goto(`${admin}/content`, { waitUntil: 'domcontentloaded' })
  await page.getByText('内容操作需要恢复').waitFor({ timeout: 20000 })
  evidence.browser.errorStateVisible = true
  evidence.browser.simulatedErrorHits = simulatedErrorHits
  await page.screenshot({ path: `${screenshotDir}/content-error-simulated.png`, fullPage: true })
  await page.unroute(isContentListUrl)
  await page.getByRole('button', { name: '刷新' }).click()
  await page.waitForTimeout(3000)
  evidence.browser.errorStateRecovered = await page.getByText('内容操作需要恢复').count() === 0

  await page.route(isContentListUrl, r => r.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ data: { items: [] }, requestId: 'uat-ui-empty' }) }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('暂无内容').waitFor({ timeout: 20000 })
  evidence.browser.emptyStateVisible = true
  await page.screenshot({ path: `${screenshotDir}/content-empty-simulated.png`, fullPage: true })
  await page.unroute(isContentListUrl)
  evidence.browser.pageErrors = pageErrors
  await context.close()

  // The nonexistent asset path does not write object metadata or grant bytes.
  mysql(`UPDATE iam_service.iam_account SET roles='staff,content-editor,media-editor', permissions='admin.dashboard.read,admin.content.read,admin.content.write,media:read,media:write' WHERE identifier='${identifier}'`)
  const mediaLogin = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, key: `login-media-${stamp}` })
  record('media staff login', mediaLogin.status, 200, mediaLogin.status === 200)
  const mediaToken = mediaLogin.data?.accessToken
  assert.equal(typeof mediaToken, 'string')
  evidence.gateway.authorizedMissingAsset = await call('GET', route, { token: mediaToken })
  evidence.gateway.authorizedMissingTasks = await call('GET', `${route}/tasks`, { token: mediaToken })
  evidence.gateway.authorizedMissingUploadIntent = await call('POST', `${route}/upload-url`, { token: mediaToken, body: {} })
  record('authorized missing metadata is not fabricated', evidence.gateway.authorizedMissingAsset.status, 404, evidence.gateway.authorizedMissingAsset.status === 404)
  record('authorized missing processing task is not fabricated', evidence.gateway.authorizedMissingTasks.status, 404, evidence.gateway.authorizedMissingTasks.status === 404)
  record('authorized missing upload intent cannot issue grant', evidence.gateway.authorizedMissingUploadIntent.status, 404, evidence.gateway.authorizedMissingUploadIntent.status === 404)

  mysql(`UPDATE iam_service.iam_account SET roles='staff', permissions='admin.dashboard.read' WHERE identifier='${identifier}'`)
  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
  const deniedPage = await deniedContext.newPage()
  await deniedPage.goto(`${admin}/content`, { waitUntil: 'domcontentloaded' })
  await deniedPage.locator('input[name="identifier"]').fill(identifier)
  await deniedPage.locator('input[name="password"]').fill(password)
  await deniedPage.locator('button.login-submit').click()
  await deniedPage.waitForURL('**/dashboard', { timeout: 30000 })
  await deniedPage.goto(`${admin}/content`, { waitUntil: 'domcontentloaded' })
  await deniedPage.waitForURL('**/forbidden?**', { timeout: 20000 })
  evidence.browser.permissionRoute = new URL(deniedPage.url()).pathname
  await deniedPage.screenshot({ path: `${screenshotDir}/content-permission-390.png`, fullPage: true })
  await deniedContext.close()
  evidence.result = 'BLOCKED'
} catch (error) {
  evidence.result = 'INCONCLUSIVE'
  evidence.failure = { name: error.name, message: String(error.message).slice(0, 500) }
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanup() } catch (error) {
    evidence.cleanup = { error: String(error.message).slice(0, 400) }
    process.exitCode = 1
  }
  evidence.capturedAt = new Date().toISOString()
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify({ result: evidence.result, checks: evidence.checks.length,
    failure: evidence.failure ?? null, cleanup: evidence.cleanup, output }))
}
