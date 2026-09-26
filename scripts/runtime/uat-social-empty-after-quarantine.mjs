/** Local-only social room UAT. Only a newly registered .invalid account is disabled. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../..')
const gateway = 'http://127.0.0.1:18070'
const socialOwner = 'http://127.0.0.1:18095'
const mobileOrigin = 'http://127.0.0.1:18183'
const stamp = process.env.UAT_SOCIAL_EMPTY_STAMP ?? `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
assert.match(stamp, /^[a-z0-9-]{6,40}$/)
if (process.argv.includes('--cleanup-existing') && !process.env.UAT_SOCIAL_EMPTY_STAMP) {
  throw new Error('Set UAT_SOCIAL_EMPTY_STAMP to the prior run before cleanup-existing')
}
const account = {
  identifier: `uat-social-empty-${stamp}@local.invalid`,
  password: `Uat!${randomBytes(20).toString('base64url')}a9`,
}
const output = path.join(root, 'artifacts', 'uat-2026-09-23', 'social-empty-after-quarantine.json')
const screenshotDir = path.join(root, 'artifacts', 'uat-2026-09-23', 'screenshots', `social-empty-${stamp}`)
const evidence = {
  scope: 'Local social room read through authenticated Gateway and mobile H5 browser after fixture quarantine',
  capturedAt: new Date().toISOString(),
  stamp,
  accountTag: createHash('sha256').update(account.identifier).digest('hex').slice(0, 12),
  checks: [],
  requests: [],
  pages: [],
  browserErrors: [],
  browserConsoleErrors: [],
  cleanup: null,
  featureStatus: 'PARTIAL',
  knownGaps: ['No real approved rooms or join/focus interaction to test', 'Native iOS/Android/iPad not tested'],
}
let browser
let stage = 'preflight'
let counter = 0

function check(name, actual, expected, required = false) {
  const pass = actual === expected
  evidence.checks.push({ name, actual, expected, pass })
  if (required && !pass) throw new Error(`${name}: expected ${expected}, observed ${actual}`)
  return pass
}

function mysql(sql) {
  return execFileSync('docker', [
    'exec', '-i', '-e', 'MYSQL_PWD', 'yuxuexing-local-mysql-1',
    'mysql', '-uroot', '-N', '-B', '-e', sql,
  ], { cwd: root, env: { ...process.env, MYSQL_PWD: process.env.UAT_LOCAL_MYSQL_PASSWORD ?? 'root-local-only' },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function roomCounts() {
  const rows = mysql("SELECT tenant_id, COUNT(*) FROM social_service.soc_study_room GROUP BY tenant_id ORDER BY tenant_id;")
  return Object.fromEntries(rows.split(/\r?\n/u).filter(Boolean).map(row => {
    const [tenant, count] = row.split('\t')
    return [tenant, Number(count)]
  }))
}

function cleanupAccount() {
  assert.match(account.identifier, /^uat-social-empty-[a-z0-9-]{6,40}@local\.invalid$/)
  const principal = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${account.identifier}'`)
  if (!principal) return { found: false, verified: true }
  assert.match(principal, /^[A-Za-z0-9-]{8,128}$/)
  mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${account.identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id
      SET d.status='REVOKED',d.revoked_at=UTC_TIMESTAMP(6),d.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${account.identifier}' AND d.status='ACTIVE';
    UPDATE iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id
      SET p.status='DISABLED' WHERE a.identifier='${account.identifier}' AND p.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions=''
      WHERE identifier='${account.identifier}';
    COMMIT;`)
  const state = mysql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${account.identifier}' AND status='DISABLED'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_principal p JOIN iam_service.iam_account a ON a.principal_id=p.principal_id WHERE a.identifier='${account.identifier}' AND p.status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${account.identifier}' AND s.status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_device d JOIN iam_service.iam_account a ON a.principal_id=d.principal_id WHERE a.identifier='${account.identifier}' AND d.status='ACTIVE'));`)
  assert.equal(state, '1:0:0:0', 'only this account must be disabled with no active principal/session/device')
  return { found: true, verified: true, accountDisabled: true, activePrincipal: 0, activeSessions: 0, activeDevices: 0 }
}

async function call(base, method, pathname, { token, body } = {}) {
  const headers = { accept: 'application/json', origin: mobileOrigin, 'x-client-platform': 'mobile' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') headers['idempotency-key'] = `uat-social-empty-${stamp}-${++counter}`
  const response = await fetch(base + pathname, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  let json = null
  try { json = await response.json() } catch { /* empty response */ }
  evidence.requests.push({ stage, source: base === gateway ? 'gateway' : 'social-owner', method, path: pathname,
    status: response.status, code: json?.error?.code ?? json?.code ?? null })
  return { status: response.status, json, token: json?.data?.accessToken ?? null }
}

async function browserWidth(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => evidence.browserErrors.push({ width, kind: error.name || 'Error', message: error.message.slice(0, 200) }))
  page.on('console', message => {
    if (message.type() === 'error') evidence.browserConsoleErrors.push({ width, message: message.text().slice(0, 350) })
  })
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === gateway && url.pathname.startsWith('/api/v1/')) {
      evidence.requests.push({ stage: `mobile-${width}`, source: 'browser', method: response.request().method(),
        path: url.pathname, status: response.status() })
    }
  })
  page.on('requestfailed', request => {
    let pathname = null
    try { pathname = new URL(request.url()).pathname } catch { /* invalid URL */ }
    if (pathname?.startsWith('/api/v1/')) evidence.requests.push({ stage: `mobile-${width}`, source: 'browser',
      method: request.method(), path: pathname, failed: request.failure()?.errorText ?? 'unknown' })
  })
  try {
    stage = `mobile-${width}-login`
    await page.goto(`${mobileOrigin}/#/pages/login/login`, { waitUntil: 'domcontentloaded' })
    await page.locator('.yx-field input').nth(0).fill(account.identifier)
    await page.locator('.yx-field input').nth(1).fill(account.password)
    await page.getByRole('button', { name: '登录并继续' }).click()
    await page.waitForURL(url => !url.hash.includes('/login/'), { timeout: 25000 })
    check(`mobile ${width} login navigates`, true, true)

    stage = `mobile-${width}-social`
    const roomResponse = page.waitForResponse(response => {
      const url = new URL(response.url())
      return url.origin === gateway && url.pathname === '/api/v1/social/rooms' && response.request().method() === 'GET'
    }, { timeout: 30000 })
    await page.goto(`${mobileOrigin}/#/pages/b4-social/b4-social`, { waitUntil: 'domcontentloaded' })
    const response = await roomResponse
    let json = null
    try { json = await response.json() } catch { /* captured as non-array */ }
    const items = json?.data?.items
    evidence.requests.push({ stage, source: 'mobile-browser', method: 'GET', path: '/api/v1/social/rooms',
      status: response.status(), itemCount: Array.isArray(items) ? items.length : null })
    check(`mobile ${width} browser rooms HTTP`, response.status(), 200)
    check(`mobile ${width} browser rooms actual empty array`, Array.isArray(items) ? items.length : -1, 0)
    await page.getByText('暂时没有可加入的自习室。', { exact: true }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    const pageState = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      emptyRoomVisible: [...document.querySelectorAll('.empty-copy')].some(element => element.textContent?.trim() === '暂时没有可加入的自习室。'),
      renderedRooms: document.querySelectorAll('.room-list .room').length,
      containsFixtureRoomName: document.body.innerText.includes('bulk-10x') || document.body.innerText.includes('local-10x-room'),
      syncStatusTitle: document.querySelector('.b4-mobile-status__title')?.textContent?.trim() ?? null,
      syncStatusMessage: document.querySelector('.b4-mobile-status__message')?.textContent?.trim() ?? null,
    }))
    const screenshot = path.join(screenshotDir, `mobile-social-empty-${width}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    evidence.pages.push({ width, ...pageState, screenshot: path.relative(root, screenshot).replaceAll('\\', '/') })
    check(`mobile ${width} visible empty state`, pageState.emptyRoomVisible, true)
    check(`mobile ${width} no rendered room`, pageState.renderedRooms, 0)
    check(`mobile ${width} no fixture name`, pageState.containsFixtureRoomName, false)
    check(`mobile ${width} no horizontal overflow`, Math.max(pageState.scrollWidth, pageState.bodyScrollWidth) <= width + 1, true)
    check(`mobile ${width} partial failure does not claim total network loss`,
      pageState.syncStatusTitle?.startsWith('网络可用'), true)
    check(`mobile ${width} retains scoped unavailability hint`,
      pageState.syncStatusMessage?.includes('部分功能暂不可用'), true)
  } catch (error) {
    evidence.pages.push({ width, failure: error instanceof Error ? error.message.slice(0, 350) : String(error).slice(0, 350) })
    check(`mobile ${width} browser flow`, false, true)
  } finally {
    await context.close()
  }
}

if (process.argv.includes('--cleanup-existing')) {
  evidence.cleanup = cleanupAccount()
  console.log(JSON.stringify({ stamp, cleanup: evidence.cleanup }))
  process.exit(0)
}

try {
  await fs.mkdir(screenshotDir, { recursive: true })
  const before = roomCounts()
  evidence.socialTenantCountsBefore = before
  check('platform owner has no published rooms', before.platform ?? 0, 0)
  for (const [name, base, pathName] of [
    ['gateway', gateway, '/actuator/health'],
    ['social-owner', socialOwner, '/actuator/health'],
    ['mobile-h5', mobileOrigin, '/'],
  ]) {
    const response = await fetch(base + pathName)
    check(`${name} reachable`, response.status, 200, true)
  }

  stage = 'register'
  const device = { deviceType: 'WEB', clientVersion: 'uat-social-empty', deviceName: 'uat-social-empty' }
  const registration = await call(gateway, 'POST', '/api/v1/auth/register', {
    body: { identifier: account.identifier, password: account.password, device },
  })
  check('new adult registration', registration.status, 201, true)
  assert.ok(registration.token, 'registration must return a private in-memory access token')
  stage = 'adult-gate'
  check('adult gate', (await call(gateway, 'POST', '/api/v1/iam/adult-gate', {
    token: registration.token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  })).status, 200, true)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    check(`${type} consent`, (await call(gateway, 'PUT', '/api/v1/iam/consents', {
      token: registration.token, body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
    })).status, 200, true)
  }
  stage = 'fresh-login'
  const login = await call(gateway, 'POST', '/api/v1/auth/login', {
    body: { identifier: account.identifier, password: account.password, device },
  })
  check('fresh authenticated login', login.status, 200, true)
  assert.ok(login.token, 'login must return a private in-memory access token')

  stage = 'gateway-rooms'
  const rooms = await call(gateway, 'GET', '/api/v1/social/rooms?limit=20', { token: login.token })
  check('Gateway rooms HTTP', rooms.status, 200)
  check('Gateway rooms contains actual items array', Array.isArray(rooms.json?.data?.items), true)
  check('Gateway rooms actual empty array', Array.isArray(rooms.json?.data?.items) ? rooms.json.data.items.length : -1, 0)
  stage = 'owner-rooms'
  const ownerRooms = await call(socialOwner, 'GET', '/api/v1/social/rooms?limit=20', { token: login.token })
  check('social owner rooms HTTP', ownerRooms.status, 200)
  check('social owner actual empty array', Array.isArray(ownerRooms.json?.data?.items) ? ownerRooms.json.data.items.length : -1, 0)
  stage = 'related-offline-package-boundary'
  const offlinePackages = await call(gateway, 'GET', '/api/v1/sync/offline-packages?limit=20', { token: login.token })
  evidence.relatedOfflinePackageStatus = offlinePackages.status

  stage = 'mobile-browser'
  browser = await chromium.launch({ headless: true })
  for (const width of [320, 390]) await browserWidth(width)
  evidence.socialTenantCountsAfter = roomCounts()
  check('platform room count unchanged', evidence.socialTenantCountsAfter.platform ?? 0, before.platform ?? 0)
  check('quarantined fixture room count unchanged', evidence.socialTenantCountsAfter['local-social-fixture'] ?? 0,
    before['local-social-fixture'] ?? 0)
} catch (error) {
  evidence.failure = { stage, kind: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400) }
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanupAccount() } catch (error) {
    evidence.cleanup = { verified: false, error: error instanceof Error ? String(error.stderr ?? error.message).slice(0, 350) : String(error).slice(0, 350) }
    process.exitCode = 1
  }
  evidence.result = evidence.failure || evidence.cleanup?.verified === false || evidence.checks.some(item => !item.pass)
    || evidence.browserErrors.length ? 'FAIL' : 'PASS'
  if (evidence.result === 'FAIL') process.exitCode = 1
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ result: evidence.result, stage, checks: evidence.checks.length,
    failedChecks: evidence.checks.filter(item => !item.pass).map(item => item.name),
    browserErrors: evidence.browserErrors.length, cleanup: evidence.cleanup, failure: evidence.failure ?? null }))
}
