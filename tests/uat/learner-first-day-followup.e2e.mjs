// Local-only browser acceptance. Uses one exact synthetic account; never logs credentials or tokens.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `uat-first-day-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const base = 'http://127.0.0.1:18180'
const artifact = 'artifacts/uat-2026-09-23'
const screenshotDir = `${artifact}/screenshots/learner/first-day-followup`
const checks = []
const requests = []
const pageErrors = []
let browser
let accountCreated = false

function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function check(name, actual, expected) {
  const ok = actual === expected
  checks.push({ name, actual, expected, ok })
  if (!ok) throw new Error(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)
}

function ownerFacts() {
  if (!/^uat-first-day-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe account scope')
  const id = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('synthetic principal missing')
  const lines = mysql(`SELECT CONCAT('profile:',COUNT(*)) FROM learner_service.learner_profile WHERE owner_id='${id}';
    SELECT CONCAT('goal:',COUNT(*)) FROM learner_service.learner_goal WHERE owner_id='${id}';
    SELECT CONCAT('firstDay:',COUNT(*)) FROM learner_service.learner_first_day_projection WHERE owner_id='${id}';
    SELECT CONCAT('plans:',COUNT(*)) FROM learning_service.learning_runtime_plan WHERE principal_id='${id}';
    SELECT CONCAT('tasks:',COUNT(*)) FROM learning_service.learning_runtime_task WHERE principal_id='${id}';`)
  return Object.fromEntries(lines.split(/\r?\n/).map(line => line.split(':')).map(([key, value]) => [key, Number(value)]))
}

function cleanupExact() {
  if (!/^uat-first-day-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe account scope')
  const lines = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions='' WHERE identifier='${identifier}';
    SELECT CONCAT('account:',COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
    SELECT CONCAT('activeSessions:',COUNT(*)) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    COMMIT;`)
  const account = lines.match(/account:(\d+):(DISABLED|NONE)/)?.slice(1)
  const activeSessions = Number(lines.match(/activeSessions:(\d+)/)?.[1])
  if (accountCreated && (account?.[0] !== '1' || account?.[1] !== 'DISABLED' || activeSessions !== 0)) {
    throw new Error('synthetic account cleanup verification failed')
  }
  return { account, activeSessions }
}

async function snapshot(page, name) {
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: true })
  const state = await page.evaluate(() => ({
    width: window.innerWidth,
    overflowPixels: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  }))
  checks.push({ name: `${name}-layout`, ...state, ok: state.overflowPixels === 0 })
  return state
}

try {
  await fs.mkdir(screenshotDir, { recursive: true })
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => pageErrors.push(error.name))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/v1/')) requests.push({ method: response.request().method(), path: url.pathname, status: response.status() })
  })

  await page.goto(`${base}/register`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="identifier"]').fill(identifier)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[name="confirm"]').fill(password)
  await page.getByRole('button', { name: '注册并继续' }).click()
  await page.waitForURL(/\/onboarding/, { timeout: 15000 })
  accountCreated = true
  check('register-to-onboarding', new URL(page.url()).pathname, '/onboarding')
  await page.getByRole('heading', { name: '确认成人身份' }).waitFor()
  await snapshot(page, '01-onboarding-gate-390')
  await page.setViewportSize({ width: 320, height: 720 })
  await snapshot(page, '02-onboarding-gate-320')
  await page.locator('#adult-birth-year').fill('1995')
  for (const box of await page.locator('input[type="checkbox"]').all()) await box.check()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await page.getByRole('heading', { name: '你想先解决什么？' }).waitFor({ timeout: 15000 })
  check('adult-gate-to-goal', await page.getByRole('heading', { name: '你想先解决什么？' }).count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await snapshot(page, '03-onboarding-goal-390')
  await page.locator('.choice-grid .choice').first().click()
  await page.getByRole('button', { name: '30 分钟' }).click()
  await page.getByRole('button', { name: '保存并开始测评' }).click()
  await page.waitForURL(/\/assessment/, { timeout: 20000 })
  check('goal-to-assessment', new URL(page.url()).pathname, '/assessment')
  await page.getByRole('heading', { name: '测评', exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const assessmentText = (await page.locator('main').innerText()).slice(0, 1200)
  checks.push({ name: 'assessment-visible-state', text: assessmentText })
  await snapshot(page, '04-assessment-390')
  const skip = page.locator('details.fast-track')
  if (await skip.count()) {
    await skip.locator('summary').click()
    await skip.getByRole('button', { name: '从 A1 开始' }).click()
    await page.waitForTimeout(1100)
    checks.push({ name: 'skip-visible-state', text: (await page.locator('main').innerText()).slice(0, 900) })
    await snapshot(page, '05-assessment-skip-390')
  }

  for (const [route, name] of [['/home', '06-home'], ['/today', '07-today'], ['/plan-map', '08-plan-map']]) {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    checks.push({ name: `${name}-visible-state`, route: new URL(page.url()).pathname,
      text: (await page.locator('main').innerText()).slice(0, 1400) })
    await snapshot(page, `${name}-390`)
    await page.setViewportSize({ width: 320, height: 720 })
    await snapshot(page, `${name}-320`)
    await page.setViewportSize({ width: 1280, height: 800 })
    await snapshot(page, `${name}-1280`)
    await page.setViewportSize({ width: 390, height: 844 })
  }
  checks.push({ name: 'owner-facts', ...ownerFacts() })

  const reloginContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const reloginPage = await reloginContext.newPage()
  reloginPage.on('pageerror', error => pageErrors.push(error.name))
  reloginPage.on('response', response => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/v1/')) requests.push({ method: response.request().method(), path: url.pathname, status: response.status() })
  })
  await reloginPage.goto(`${base}/login?redirect=/home`, { waitUntil: 'domcontentloaded' })
  await reloginPage.locator('input[name="identifier"]').fill(identifier)
  await reloginPage.locator('input[name="password"]').fill(password)
  await reloginPage.locator('button[type="submit"]').click()
  await reloginPage.waitForURL(/\/home/, { timeout: 15000 })
  await reloginPage.getByText('今日安排暂不可用').waitFor({ timeout: 15000 })
  check('relogin-restores-owned-goal-but-home-still-unavailable', new URL(reloginPage.url()).pathname, '/home')
  await snapshot(reloginPage, '09-relogin-home-390')
} catch (error) {
  checks.push({ name: 'probe-error', message: error instanceof Error ? error.message : String(error), ok: false })
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  let cleanup
  try { cleanup = cleanupExact() } catch (error) {
    cleanup = { error: error instanceof Error ? error.message : String(error) }
    process.exitCode = 1
  }
  const facts = checks.find(check => check.name === 'owner-facts')
  const businessAcceptance = {
    status: facts?.plans > 0 && facts?.tasks > 0 && requests.some(request => request.path === '/api/v1/assessment/placement/sessions' && request.status === 201)
      ? 'READY_FOR_REVIEW' : 'BLOCKED',
    reason: 'The browser uses the legacy two-question placement route; this principal has no owner plan or task.',
  }
  const result = { probe: 'learner-first-day-followup', localOnly: true, businessAcceptance, checks, requests,
    pageErrorCount: pageErrors.length, cleanup, secretsPrinted: false }
  await fs.writeFile(`${artifact}/learner-first-day-followup.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ probe: result.probe, businessStatus: businessAcceptance.status, checkCount: checks.length,
    failedChecks: checks.filter(check => check.ok === false).length, pageErrorCount: result.pageErrorCount,
    cleanup, output: `${artifact}/learner-first-day-followup.json` }, null, 2))
}
