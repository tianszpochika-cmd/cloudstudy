/** Real Mobile H5 + Gateway support-page UAT. The only ticket writes are browser fixtures. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

function certificateSpkiHash(pemPath) {
  const publicKeyPem = execFileSync('openssl', ['x509', '-in', pemPath, '-pubkey', '-noout'], { encoding: 'utf8' })
  const publicKeyDer = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: publicKeyPem })
  return createHash('sha256').update(publicKeyDer).digest('base64')
}

const iamSchema = process.env.SUPPORT_UAT_IAM_SCHEMA || 'iam_service'
assert.match(iamSchema, /^[A-Za-z0-9_]+$/, 'unsafe IAM schema name')

const root = path.resolve(import.meta.dirname, '../../..')
const stamp = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
const identifier = `uat-support-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const accountTag = createHash('sha256').update(identifier).digest('hex').slice(0, 12)
const output = process.env.MOBILE_SUPPORT_UAT_OUTPUT || path.join(root, 'artifacts', 'uat-2026-09-23', 'screenshots', 'mobile', `support-real-${stamp}`)
const mobile = 'http://127.0.0.1:18183/#/'
const gateway = 'http://127.0.0.1:18070'
const ticketPath = '/api/v1/support/tickets'
const evidence = { scope: 'Support page, real Gateway empty state plus labeled browser-only failure/list fixtures', accountTag, stages: [], authNetwork: [], supportNetwork: [], supportRequests: [], requestFailures: [], pageErrors: [], screenshots: [], cleanup: null }
let browser
let activePage
let stage = 'preflight'
let registered = false

function safePath(url) { return new URL(url).pathname }

function track(page) {
  page.on('request', request => {
    if (request.url().startsWith(gateway) && safePath(request.url()) === ticketPath) evidence.supportRequests.push({ stage, method: request.method() })
  })
  page.on('response', response => {
    if (!response.url().startsWith(gateway)) return
    if (['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/iam/adult-gate', '/api/v1/iam/consents'].includes(safePath(response.url()))) {
      evidence.authNetwork.push({ stage, method: response.request().method(), path: safePath(response.url()), status: response.status() })
    }
    if (safePath(response.url()) !== ticketPath) return
    evidence.supportNetwork.push({ stage, method: response.request().method(), status: response.status(), source: stage === 'controlled-failure' || stage === 'browser-list-fixture' ? 'browser-fixture' : 'gateway' })
  })
  page.on('pageerror', error => evidence.pageErrors.push({ stage, kind: error.name || 'Error' }))
  page.on('requestfailed', request => {
    if (safePath(request.url()) === ticketPath) evidence.requestFailures.push({ stage, method: request.method(), reason: request.failure()?.errorText || 'unknown' })
  })
}

async function statusAfter(page, pathname, action, method = 'POST') {
  const response = page.waitForResponse(item => safePath(item.url()) === pathname && item.request().method() === method, { timeout: 20000 })
    .then(item => ({ status: item.status() }), error => ({ error }))
  await action()
  const outcome = await response
  if (outcome.error) throw outcome.error
  return outcome.status
}

async function waitForPath(page, name) {
  await page.waitForURL(url => url.hash.startsWith(`#/pages/${name}/${name}`), { timeout: 25000 })
}

async function screenshot(page, name, width) {
  await page.setViewportSize({ width, height: 844 })
  await page.waitForTimeout(120)
  const widthState = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  assert.ok(widthState.scrollWidth <= widthState.viewport + 1, `${name}/${width}: horizontal overflow`)
  const file = `${name}-${width}.png`
  await page.screenshot({ path: path.join(output, file), fullPage: true })
  evidence.screenshots.push({ name: file, ...widthState })
}

function cleanupExactAccount() {
  assert.match(identifier, /^uat-support-[a-z0-9-]+@local\.invalid$/, 'unsafe local identifier')
  const sql = `START TRANSACTION;
UPDATE \`${iamSchema}\`.iam_session s JOIN \`${iamSchema}\`.iam_account a ON a.principal_id=s.principal_id
 SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
UPDATE \`${iamSchema}\`.iam_account SET status='DISABLED', roles='', permissions=''
 WHERE identifier='${identifier}';
SELECT CONCAT('ACCOUNT:',COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM \`${iamSchema}\`.iam_account WHERE identifier='${identifier}';
SELECT CONCAT('ACTIVE_SESSIONS:',COUNT(*)) FROM \`${iamSchema}\`.iam_session s JOIN \`${iamSchema}\`.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
COMMIT;`
  const result = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const account = result.match(/ACCOUNT:(\d+):(DISABLED|NONE)/)?.slice(1)
  const active = Number(result.match(/ACTIVE_SESSIONS:(\d+)/)?.[1])
  assert.ok(account && Number.isFinite(active), 'cleanup verification unavailable')
  assert.ok(!registered || Number(account[0]) === 1 && account[1] === 'DISABLED' && active === 0, 'exact account cleanup failed')
  return { accountCount: Number(account[0]), status: account[1], activeSessions: active, verified: true }
}

try {
  await fs.mkdir(output, { recursive: true })
  for (const url of ['http://127.0.0.1:18183/', `${gateway}/actuator/health`]) {
    assert.equal((await fetch(url)).status, 200, `preflight ${safePath(url)}`)
  }
  const launchArgs = []
  if (process.env.IAM_TEST_CA_PEM) launchArgs.push(`--ignore-certificate-errors-spki-list=${certificateSpkiHash(process.env.IAM_TEST_CA_PEM)}`)
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: launchArgs })
  const registration = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const registrationPage = await registration.newPage()
  track(registrationPage)

  stage = 'register'
  await registrationPage.goto(`${mobile}pages/register/register`)
  await registrationPage.locator('.yx-field input').nth(0).fill(identifier)
  await registrationPage.locator('.yx-field input').nth(1).fill(password)
  await registrationPage.locator('.yx-field input').nth(2).fill(password)
  const registrationStatus = await statusAfter(registrationPage, '/api/v1/auth/register', () => registrationPage.getByRole('button', { name: '注册并继续' }).click())
  registered = registrationStatus === 201
  assert.equal(registrationStatus, 201)
  evidence.stages.push({ name: stage, status: registrationStatus })
  await waitForPath(registrationPage, 'onboarding')
  await registrationPage.locator('.yx-onboarding[aria-busy="false"]').waitFor({ timeout: 20000 })

  stage = 'adult-gate'
  await registrationPage.locator('.birth-year input').fill('1995')
  await registrationPage.locator('.consent').filter({ hasText: '我确认自己已满 18 周岁' }).locator('.uni-checkbox-input, uni-checkbox').first().click()
  const continueButton = registrationPage.getByRole('button', { name: '继续', exact: true })
  evidence.stages.push({ name: 'adult-ui-ready', continueEnabled: await continueButton.isEnabled(), checkboxCount: await registrationPage.locator('.consent uni-checkbox').count() })
  assert.ok(await continueButton.isEnabled(), 'adult gate action is disabled after all inputs')
  const adultStatus = await statusAfter(registrationPage, '/api/v1/iam/adult-gate', () => continueButton.click())
  assert.equal(adultStatus, 200)
  evidence.stages.push({ name: stage, status: adultStatus })

  stage = 'consent'
  await registrationPage.getByText('完成必要同意', { exact: true }).waitFor()
  await registrationPage.waitForFunction(() => {
    const match = (document.body?.innerText || '').match(/已发布版本\s+(\S+)/)
    return Boolean(match && match[1] && match[1] !== '版本未读到')
  })
  const consentResponses = []
  registrationPage.on('response', response => {
    if (safePath(response.url()) === '/api/v1/iam/consents' && response.request().method() === 'PUT') consentResponses.push(response.status())
  })
  const consentRows = registrationPage.locator('.yx-onboarding-step .consent')
  const consentCount = await consentRows.count()
  for (let index = 0; index < consentCount; index += 1) {
    const box = consentRows.nth(index).locator('.uni-checkbox-input, uni-checkbox, input[type=checkbox]').first()
    if (await box.count()) await box.click()
    else await consentRows.nth(index).click()
  }
  const consentContinue = registrationPage.getByRole('button', { name: '继续', exact: true })
  assert.ok(await consentContinue.isEnabled(), 'consent continue stays disabled after every required row')
  await consentContinue.click()
  await registrationPage.getByText('选择学习目标', { exact: true }).waitFor()
  assert.deepEqual(consentResponses.sort(), [200, 200, 200])
  evidence.stages.push({ name: stage, consentStatuses: consentResponses })

  stage = 'consent-and-target'
  await registrationPage.locator('.choice-list .choice').first().click()
  await registrationPage.getByRole('button', { name: '15 分钟', exact: true }).click()
  await registrationPage.getByRole('button', { name: '保存并开始测评' }).click()
  await waitForPath(registrationPage, 'assessment')
  evidence.stages.push({ name: stage, arrived: 'assessment' })
  await registration.close()

  stage = 'fresh-login'
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  activePage = page
  track(page)
  await page.goto(`${mobile}pages/login/login`)
  await page.locator('.yx-field input').nth(0).fill(identifier)
  await page.locator('.yx-field input').nth(1).fill(password)
  const loginStatus = await statusAfter(page, '/api/v1/auth/login', () => page.getByRole('button', { name: '登录并继续' }).click())
  assert.equal(loginStatus, 200)
  evidence.stages.push({ name: stage, status: loginStatus })
  await page.waitForURL(url => !url.hash.startsWith('#/pages/login/login'), { timeout: 25000 })

  stage = 'home-copy-observation'
  await page.goto(`${mobile}pages/home/home`)
  await page.locator('.mobile-page-description').waitFor()
  const homeDescription = await page.locator('.mobile-page-description').innerText()
  evidence.stages.push({ name: stage, description: homeDescription, currentShortCopy: homeDescription === '查看任务，继续练习。' })
  await screenshot(page, 'home-copy-observation', 390)

  stage = 'profile-entry'
  await page.goto(`${mobile}pages/profile/profile`)
  const entry = page.locator('.mobile-menu-row').filter({ hasText: '帮助中心' })
  await entry.waitFor()
  const menuRows = await page.locator('.mobile-menu-row').count()
  const entryIndex = await entry.evaluate(el => Array.from(el.parentElement.children).indexOf(el))
  const entryVisible = await entry.isVisible()
  assert.ok(entryVisible, 'support entry must be visible')
  const supportResponse = page.waitForResponse(item => safePath(item.url()) === ticketPath && item.request().method() === 'GET', { timeout: 20000 })
  await entry.click()
  await waitForPath(page, 'support')
  evidence.stages.push({ name: stage, menuRows, entryIndex, entryVisible })

  stage = 'gateway-empty'
  const response = await supportResponse
  const supportStatus = response.status()
  const responseBody = supportStatus === 200 ? await response.json() : null
  const realItems = responseBody?.data?.items
  evidence.stages.push({ name: stage, status: supportStatus, realItemCount: Array.isArray(realItems) ? realItems.length : null })
  assert.equal(supportStatus, 200, 'real support list must be available')
  assert.equal(Array.isArray(realItems) ? realItems.length : -1, 0, 'fresh account must not see another account ticket')
  await page.getByText('暂无可见工单。', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '提交工单' }).count(), 0, 'no false submission action')
  assert.equal(await page.locator('textarea').count(), 0, 'no false submission form')
  assert.equal(await page.getByText('暂不能提交新工单，可查看已有工单。', { exact: true }).count(), 1)
  await screenshot(page, 'gateway-empty', 320)
  await screenshot(page, 'gateway-empty', 390)

  stage = 'controlled-failure'
  await context.route('**/api/v1/support/tickets*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SUPPORT_TEST_UNAVAILABLE' } }), headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true' } }))
  const failureStatus = await statusAfter(page, ticketPath, () => page.locator('.yx-card').last().locator('.yx-button').click(), 'GET')
  assert.equal(failureStatus, 503)
  await page.locator('[role="alert"]').filter({ hasText: '工单暂不可用' }).waitFor()
  assert.equal(await page.getByText('暂无可见工单。', { exact: true }).count(), 0, 'error must not appear empty')
  await screenshot(page, 'controlled-failure', 320)
  await screenshot(page, 'controlled-failure', 390)

  stage = 'gateway-retry'
  await context.unroute('**/api/v1/support/tickets*')
  const retryStatus = await statusAfter(page, ticketPath, () => page.locator('.yx-card').last().locator('.yx-button').click(), 'GET')
  assert.equal(retryStatus, 200)
  await page.getByText('暂无可见工单。', { exact: true }).waitFor()
  evidence.stages.push({ name: stage, status: retryStatus, recovered: true })

  stage = 'browser-list-fixture'
  await context.route('**/api/v1/support/tickets*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [
    { ticketId: 'fixture-101', categoryCode: 'TECHNICAL', state: 'OPEN', priority: 'NORMAL', slaState: null },
    { ticketId: 'fixture-102', categoryCode: 'CONTENT_CORRECTION', state: 'IN_PROGRESS', priority: 'NORMAL', slaState: null },
  ] } }) }))
  await page.locator('.yx-card').last().locator('.yx-button').click()
  await page.getByText('工单 fixture-101', { exact: true }).waitFor()
  assert.equal(await page.locator('.yx-ticket').count(), 2)
  assert.equal(await page.getByText('设备问题 · 已提交', { exact: true }).count(), 1)
  assert.equal(await page.getByText('内容纠错 · 处理中', { exact: true }).count(), 1)
  await screenshot(page, 'browser-list-fixture', 390)
  evidence.stages.push({ name: stage, source: 'browser-only fixture', visibleRows: 2 })
  await context.close()
} catch (error) {
  evidence.failure = { stage, kind: error instanceof Error ? error.name : 'Error', route: activePage ? new URL(activePage.url()).hash.split('?')[0] : null,
    visible: activePage ? {
      login: await activePage.locator('.yx-field input').count().catch(() => -1),
      profile: await activePage.locator('.mobile-profile-banner').count().catch(() => -1),
      support: await activePage.locator('.yx-ticket-list').count().catch(() => -1),
      onboarding: await activePage.locator('.yx-onboarding').count().catch(() => -1),
      forbidden: await activePage.locator('.yx-forbidden').count().catch(() => -1),
    } : null }
  if (activePage && new URL(activePage.url()).hash.includes('/pages/support/support')) {
    evidence.failure.supportText = await activePage.locator('.yx-card').last().innerText().catch(() => null)
    await activePage.screenshot({ path: path.join(output, 'failure-diagnostic.png'), fullPage: true }).catch(() => {})
  }
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanupExactAccount() }
  catch { evidence.cleanup = { verified: false }; process.exitCode = 1 }
  evidence.summary = { registered, actualSupportGet: evidence.stages.find(item => item.name === 'gateway-empty')?.status ?? null, noPageExceptions: evidence.pageErrors.length === 0, cleanupVerified: evidence.cleanup.verified === true, verdict: evidence.failure || !evidence.cleanup.verified || evidence.pageErrors.length ? 'FAIL' : 'PASS' }
  if (evidence.summary.verdict !== 'PASS') process.exitCode = 1
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ output, accountTag, summary: evidence.summary, cleanup: evidence.cleanup, failure: evidence.failure ?? null }))
}
