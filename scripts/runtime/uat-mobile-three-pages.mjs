/** Local-only real Gateway + Mobile H5 UAT. Never writes credentials or tokens to evidence. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../..')
const stamp = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
const identifier = `uat-mobile-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const accountTag = createHash('sha256').update(identifier).digest('hex').slice(0, 12)
const output = process.env.MOBILE_REAL_UAT_OUTPUT || path.join(root, 'artifacts', 'uat-2026-09-23', 'mobile-real-gateway', stamp)
const mobile = 'http://127.0.0.1:18183/#/'
const gateway = 'http://127.0.0.1:18070'
const evidence = { scope: 'Real local Gateway and Mobile H5, independent synthetic adult account', accountTag, stages: [], pages: [], consentCommands: [], network: [], requestFailures: [], browserErrors: [], cleanup: null }
let stage = 'preflight'
let registered = false
let browser
let availableCourseCode = null

function publicPath(url) {
  const pathname = new URL(url).pathname
  if (pathname === '/api/v1/content/learner/catalog') return pathname
  if (pathname.startsWith('/api/v1/content/learner/')) return '/api/v1/content/learner/:contentCode'
  if (pathname.startsWith('/api/v1/auth/sessions/')) return '/api/v1/auth/sessions/:sessionId/revoke'
  return pathname
}

function track(page) {
  page.on('request', request => {
    if (publicPath(request.url()) !== '/api/v1/iam/consents' || request.method() !== 'PUT') return
    try {
      const body = request.postDataJSON()
      evidence.consentCommands.push({ stage, type: body?.type, decision: body?.decision })
    } catch { evidence.consentCommands.push({ stage, type: 'unreadable', decision: 'unreadable' }) }
  })
  page.on('response', response => {
    if (!response.url().startsWith(gateway)) return
    const record = { stage, method: response.request().method(), path: publicPath(response.url()), status: response.status() }
    evidence.network.push(record)
    if (record.path === '/api/v1/content/learner/catalog' && response.status() === 200) void response.json().then(body => {
      let source = body
      for (let i = 0; i < 3 && !Array.isArray(source?.items); i++) source = source?.data
      const published = source?.items?.find(item => item?.availability === 'PUBLISHED' && typeof item?.contentCode === 'string')
      if (published) availableCourseCode = published.contentCode
    }).catch(() => {})
    if (response.status() >= 400) void response.json().then(body => {
      const code = body?.error?.code ?? body?.code
      if (typeof code === 'string' && /^[A-Z0-9_.-]{1,80}$/.test(code)) record.code = code
    }).catch(() => {})
  })
  page.on('requestfailed', request => {
    if (!request.url().startsWith(gateway)) return
    const aborted = request.failure()?.errorText?.includes('ERR_ABORTED') === true
    const requestPath = publicPath(request.url())
    const inScope = /^\/api\/v1\/(?:auth|iam|learner|learning|content)(?:\/|$)/.test(requestPath)
    evidence.requestFailures.push({ stage, method: request.method(), path: requestPath, scope: inScope ? 'three-page-uat' : 'adjacent-route', reason: aborted ? 'navigation-aborted' : 'network-failed', expected: aborted || stage.includes('controlled-failure') })
  })
  page.on('pageerror', error => evidence.browserErrors.push({ stage, kind: error.name || 'Error' }))
  page.on('console', message => {
    if (message.type() === 'error') evidence.browserErrors.push({ stage, kind: 'console.error' })
  })
}

async function gatewayResponse(page, pathname, action, method = 'POST') {
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === method, { timeout: 20000 })
  await action()
  const response = await responsePromise
  return response.status()
}

async function waitForPath(page, name) {
  if (name === 'home') {
    await page.waitForURL(url => /^#\/(?:pages\/home\/home)?(?:\?|$)/.test(url.hash), { timeout: 25000 })
    return
  }
  await page.waitForURL(new RegExp(`#\\/pages\\/${name}\\/${name}(?:\\?|$)`), { timeout: 25000 })
}

async function screenshots(page, name) {
  const widths = []
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForTimeout(120)
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    widths.push({ width, scrollWidth: dimensions.scrollWidth, overflow: dimensions.scrollWidth > dimensions.viewport + 1 })
    await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true })
  }
  assert.ok(widths.every(item => !item.overflow), `${name} has horizontal overflow`)
  return widths
}

function cleanupExactAccount() {
  assert.match(identifier, /^uat-mobile-[a-z0-9-]+@local\.invalid$/, 'unsafe local identifier')
  const sql = `START TRANSACTION;
UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
 WHERE identifier='${identifier}';
SELECT CONCAT('ACCOUNT:',COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
SELECT CONCAT('ACTIVE_SESSIONS:',COUNT(*)) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
COMMIT;`
  const result = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const account = result.match(/ACCOUNT:(\d+):(DISABLED|NONE)/)?.slice(1)
  const active = Number(result.match(/ACTIVE_SESSIONS:(\d+)/)?.[1])
  if (!account || !Number.isFinite(active)) throw new Error('cleanup verification unavailable')
  if (registered && (Number(account[0]) !== 1 || account[1] !== 'DISABLED' || active !== 0)) throw new Error('exact account cleanup failed')
  if (!registered && Number(account[0]) > 1) throw new Error('unexpected duplicate local account')
  return { accountCount: Number(account[0]), status: account[1], activeSessions: active, verified: Number(account[0]) === 0 || Number(account[0]) === 1 && account[1] === 'DISABLED' && active === 0 }
}

try {
  await fs.mkdir(output, { recursive: true })
  for (const url of ['http://127.0.0.1:18183/', `${gateway}/actuator/health`]) {
    const response = await fetch(url)
    assert.equal(response.status, 200, `preflight ${new URL(url).pathname}`)
  }
  browser = await chromium.launch({ headless: true })
  const registerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const registerPage = await registerContext.newPage()
  track(registerPage)

  stage = 'register'
  await registerPage.goto(`${mobile}pages/register/register`)
  await registerPage.locator('.yx-field input').nth(0).fill(identifier)
  await registerPage.locator('.yx-field input').nth(1).fill(password)
  await registerPage.locator('.yx-field input').nth(2).fill(password)
  const registrationStatus = await gatewayResponse(registerPage, '/api/v1/auth/register', () => registerPage.getByRole('button', { name: '注册并继续' }).click())
  registered = registrationStatus === 201
  evidence.stages.push({ name: stage, status: registrationStatus })
  assert.equal(registrationStatus, 201, 'registration must succeed')
  await waitForPath(registerPage, 'onboarding')

  stage = 'adult-gate'
  await registerPage.locator('.birth-year input').fill('1995')
  for (const checkbox of await registerPage.locator('.consent uni-checkbox').all()) await checkbox.click()
  const adultStatus = await gatewayResponse(registerPage, '/api/v1/iam/adult-gate', () => registerPage.getByRole('button', { name: '继续', exact: true }).click())
  evidence.stages.push({ name: stage, status: adultStatus })
  assert.equal(adultStatus, 200, 'local adult gate must pass')
  await registerPage.getByText('选择学习目标', { exact: true }).waitFor()

  stage = 'three-consents-and-onboarding'
  await registerPage.locator('.choice-list .choice').first().click()
  await registerPage.getByRole('button', { name: '15 分钟', exact: true }).click()
  await registerPage.getByRole('button', { name: '保存并开始测评' }).click()
  await waitForPath(registerPage, 'assessment')
  const consentResponses = evidence.network.filter(item => item.stage === stage && item.path === '/api/v1/iam/consents' && item.method === 'PUT')
  const consentTypes = evidence.consentCommands.filter(item => item.stage === stage).map(item => item.type).sort()
  evidence.stages.push({ name: stage, consentStatuses: consentResponses.map(item => item.status), targetWrite: evidence.network.find(item => item.stage === stage && item.path === '/api/v1/learner/targets' && item.method === 'PUT')?.status ?? null })
  assert.equal(consentResponses.length, 3, 'three consent writes are required')
  assert.deepEqual(consentTypes, ['ADULT_LEARNING', 'PRIVACY', 'TERMS'])
  assert.ok(consentResponses.every(item => item.status === 200), 'each consent must be accepted')
  await registerContext.close()

  stage = 'fresh-browser-login'
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  track(page)
  await page.goto(`${mobile}pages/login/login`)
  await page.locator('.yx-field input').nth(0).fill(identifier)
  await page.locator('.yx-field input').nth(1).fill(password)
  const loginStatus = await gatewayResponse(page, '/api/v1/auth/login', () => page.getByRole('button', { name: '登录并继续' }).click())
  evidence.stages.push({ name: stage, status: loginStatus })
  assert.equal(loginStatus, 200, 'fresh browser login must succeed')
  await waitForPath(page, 'home')

  stage = 'home-real'
  await page.locator('.task-row, .empty, .state-title').first().waitFor({ timeout: 20000 })
  const homeState = await page.locator('.task-row').count() ? 'tasks' : await page.locator('.empty').count() ? 'empty' : 'error'
  const homeWidths = await screenshots(page, 'home-real')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0))
  await page.waitForTimeout(120)
  const homeBottom = await page.evaluate(() => {
    const action = document.querySelector('.entry-grid > :last-child')?.getBoundingClientRect()
    const tab = document.querySelector('uni-tabbar .uni-tabbar')?.getBoundingClientRect()
    return { scrollY, actionBottom: action?.bottom ?? null, tabTop: tab?.top ?? null, actionClearOfTab: Boolean(action && tab && action.bottom <= tab.top - 8) }
  })
  await page.screenshot({ path: path.join(output, 'home-bottom-390.png') })
  evidence.pages.push({ name: 'home', state: homeState, taskRows: await page.locator('.task-row').count(), contentRows: await page.locator('.content-row').count(), progressShown: await page.locator('.progress-track').count() > 0, widths: homeWidths, bottomAction: homeBottom })
  assert.equal(homeBottom.actionClearOfTab, true, 'last home action must clear the fixed tab bar at maximum scroll')
  if (homeState === 'empty') assert.equal(await page.locator('.progress-track').count(), 0, 'empty home cannot show 0% progress')

  stage = 'home-course-entry'
  const published = page.locator('.content-row:not([disabled])').first()
  if (await published.count()) {
    await published.click()
    await waitForPath(page, 'learn')
    evidence.stages.push({ name: stage, route: 'learn', source: 'published-course' })
  } else if (availableCourseCode) {
    await page.goto(`${mobile}pages/learn/learn?contentCode=${encodeURIComponent(availableCourseCode)}`)
    await waitForPath(page, 'learn')
    evidence.stages.push({ name: stage, route: 'learn', source: 'gateway-catalog-deep-link' })
  } else {
    await page.goto(`${mobile}pages/learn/learn`)
    await waitForPath(page, 'learn')
    evidence.stages.push({ name: stage, route: 'learn', source: 'course-tab' })
  }

  stage = 'learn-real'
  await page.locator('.review-card').waitFor()
  await page.waitForFunction(() => !document.querySelector('.review-card')?.textContent?.includes('正在读取复习安排'), { timeout: 20000 })
  if (evidence.stages.at(-1)?.source !== 'course-tab') await page.locator('.content-card .content-title, .content-card [role="alert"]').first().waitFor({ timeout: 20000 })
  const learnAlert = await page.locator('.review-card [role="alert"]').count()
  const learnWidths = await screenshots(page, 'learn-real')
  evidence.pages.push({ name: 'learn', reviewAlertCount: learnAlert, reviewRows: await page.locator('.review-row').count(), contentTitle: await page.locator('.content-title').count(), widths: learnWidths })
  assert.ok(learnAlert <= 1, 'review failure must be shown once')
  if (learnAlert) assert.equal(await page.getByText('待复习 0 项', { exact: true }).count(), 0, 'unknown review count must not appear as zero')
  await page.setViewportSize({ width: 390, height: 844 })
  stage = 'learn-practice-entry'
  await page.locator('.b10-flow').getByRole('button', { name: '听力精练' }).click()
  await waitForPath(page, 'b11-listening')
  evidence.stages.push({ name: stage, route: 'b11-listening' })

  stage = 'profile-real'
  await page.goto(`${mobile}pages/profile/profile`)
  await page.locator('.mobile-profile-banner, .profile-state[role="alert"]').first().waitFor({ timeout: 20000 })
  const profileReady = await page.locator('.mobile-profile-banner').count() === 1
  const profileWidths = await screenshots(page, 'profile-real')
  evidence.pages.push({ name: 'profile', state: profileReady ? 'ready' : 'error', unsupportedSaveVisible: await page.getByRole('button', { name: '保存资料' }).count() > 0, widths: profileWidths })
  if (profileReady) {
    assert.equal(await page.getByRole('button', { name: '保存资料' }).count(), 0, 'unsupported nickname save must not appear')
    assert.equal(await page.getByText('尚未设置', { exact: true }).count(), 0, 'saved target must not appear unset')
    assert.match(await page.locator('.mobile-profile-caption').innerText(), /\d+ 分钟\/天/, 'saved daily target must be shown')
    stage = 'profile-goal-entry'
    await page.getByRole('button', { name: '修改学习目标' }).click()
    await waitForPath(page, 'onboarding')
    evidence.stages.push({ name: stage, route: 'onboarding' })
    await page.goto(`${mobile}pages/profile/profile`)
    await page.locator('.mobile-profile-banner').waitFor({ timeout: 20000 })
  }
  stage = 'profile-menu-entry'
  await page.locator('.mobile-menu-row').filter({ hasText: '设置' }).click()
  await waitForPath(page, 'settings')
  evidence.stages.push({ name: stage, route: 'settings' })

  if (learnAlert === 0) {
    stage = 'learn-controlled-failure'
    await context.route('**/api/v1/learning/review-queue*', route => route.abort('failed'))
    await page.goto(`${mobile}pages/learn/learn`)
    await page.locator('.review-card [role="alert"]').waitFor({ timeout: 20000 })
    assert.equal(await page.locator('.review-card [role="alert"]').count(), 1)
    assert.equal(await page.getByText('待复习 0 项', { exact: true }).count(), 0)
    await page.screenshot({ path: path.join(output, 'learn-controlled-failure-390.png'), fullPage: true })
    await context.unroute('**/api/v1/learning/review-queue*')
    stage = 'learn-retry-real'
    await page.locator('.review-card').getByRole('button', { name: '重试' }).click()
    await page.waitForFunction(() => !document.querySelector('.review-card [role="alert"]'), { timeout: 20000 })
    evidence.stages.push({ name: stage, recovered: true })
  }

  if (profileReady) {
    stage = 'profile-controlled-failure'
    await context.route('**/api/v1/learner/profile*', route => route.abort('failed'))
    await page.goto(`${mobile}pages/profile/profile`)
    await page.locator('.profile-state[role="alert"]').waitFor({ timeout: 20000 })
    assert.equal(await page.locator('.mobile-profile-banner').count(), 0)
    await page.screenshot({ path: path.join(output, 'profile-controlled-failure-390.png'), fullPage: true })
    await context.unroute('**/api/v1/learner/profile*')
    stage = 'profile-retry-real'
    await page.locator('.profile-state').getByRole('button', { name: '重试' }).click()
    await page.locator('.mobile-profile-banner').waitFor({ timeout: 20000 })
    evidence.stages.push({ name: stage, recovered: true })
  }
  await context.close()
} catch (error) {
  evidence.failure = { stage, kind: error instanceof Error ? error.name : 'Error' }
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { evidence.cleanup = cleanupExactAccount() }
  catch { evidence.cleanup = { verified: false, error: 'cleanup verification failed' }; process.exitCode = 1 }
  const expectedBoundary = new Set(['adult-gate', 'three-consents-and-onboarding'])
  const unexpectedNetwork = evidence.network.filter(item => item.status >= 400 && !item.stage.includes('controlled-failure') && !(expectedBoundary.has(item.stage) && (item.status === 403 || item.status === 404)))
  evidence.summary = { registered, pages: evidence.pages.length, unexpectedHttpErrors: unexpectedNetwork.length, pageExceptions: evidence.browserErrors.filter(item => item.kind !== 'console.error').length, consoleErrors: evidence.browserErrors.filter(item => item.kind === 'console.error').length, unexpectedRequestFailures: evidence.requestFailures.filter(item => !item.expected && item.scope === 'three-page-uat').length }
  evidence.summary.verdict = evidence.failure ? 'FAIL' : unexpectedNetwork.length ? 'BLOCKED_BY_OWNER' : evidence.summary.unexpectedRequestFailures || evidence.summary.pageExceptions ? 'FAIL' : 'PASS'
  if (evidence.summary.verdict !== 'PASS') process.exitCode = 1
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ output, accountTag, summary: evidence.summary, cleanup: evidence.cleanup, failure: evidence.failure ?? null }))
}
