/** Local UAT of the current checkpoint boundary; emits no credentials or tokens. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../..')
const gateway = 'http://127.0.0.1:18070'
const owner = 'http://127.0.0.1:18091'
const web = 'http://127.0.0.1:18180'
const run = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
const output = path.join(root, 'artifacts', 'uat-2026-09-23', 'p1-checkpoint-boundary', run)
const device = { deviceType: 'WEB', clientVersion: 'checkpoint-boundary-uat', deviceName: 'checkpoint-local-uat' }
const accounts = ['a', 'b'].map(tag => ({
  tag, identifier: `uat-checkpoint-${run}-${tag}@local.invalid`,
  password: `Uat!${randomBytes(20).toString('base64url')}a9`, token: null, registered: false,
}))
const evidence = {
  scope: 'Current local Gateway, assessment owner and learner browser checkpoint boundary',
  capturedAt: new Date().toISOString(), run, checks: [], browser: {}, cleanup: [],
  note: 'Canonical session checkpoint and ten-item placement require live content source and an owner implementation.',
}
let browser
let sequence = 0

function check(name, pass, observed, expected) {
  evidence.checks.push({ name, pass: Boolean(pass), observed, expected })
}
function key(label) { return `uat-checkpoint-${run}-${++sequence}-${label}`.slice(0, 100) }
function tag(value) { return createHash('sha256').update(String(value)).digest('hex').slice(0, 12) }
function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
async function call(base, method, pathname, { token, body, idempotencyKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey
  const response = await fetch(`${base}${pathname}`, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const json = await response.json().catch(() => null)
  return { status: response.status, code: json?.error?.code ?? json?.code ?? null,
    data: json?.data ?? json, token: json?.data?.accessToken ?? null }
}
async function registerAdult(account) {
  const registration = await call(gateway, 'POST', '/api/v1/auth/register', {
    body: { identifier: account.identifier, password: account.password, device }, idempotencyKey: key('register'),
  })
  account.registered = registration.status === 201
  check(`${account.tag}-registration`, account.registered && !!registration.token, registration.status, 201)
  assert.ok(account.registered && registration.token, 'synthetic registration failed')
  const gate = await call(gateway, 'POST', '/api/v1/iam/adult-gate', { token: registration.token,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idempotencyKey: key('adult') })
  check(`${account.tag}-adult-gate`, gate.status === 200, gate.status, 200)
  assert.equal(gate.status, 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call(gateway, 'PUT', '/api/v1/iam/consents', { token: registration.token,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idempotencyKey: key(`consent-${type}`) })
    check(`${account.tag}-${type.toLowerCase()}-consent`, consent.status === 200, consent.status, 200)
    assert.equal(consent.status, 200)
  }
  const login = await call(gateway, 'POST', '/api/v1/auth/login', {
    body: { identifier: account.identifier, password: account.password, device }, idempotencyKey: key('login'),
  })
  account.token = login.token
  check(`${account.tag}-login`, login.status === 200 && !!account.token, login.status, 200)
  assert.ok(account.token)
}
function cleanupAccount(account) {
  assert.match(account.identifier, /^uat-checkpoint-[a-z0-9-]+-[ab]@local\.invalid$/)
  const principals = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${account.identifier}'`).split('\n').filter(Boolean)
  if (!principals.length) return { tag: account.tag, accountCount: 0, verified: !account.registered }
  assert.equal(principals.length, 1, 'cleanup requires exactly one synthetic account')
  const principal = principals[0]
  assert.match(principal, /^[a-f0-9-]{36}$/i)
  const sql = `START TRANSACTION;
    DELETE FROM assessment_service.b10_assessment_checkpoint WHERE principal_id='${principal}';
    DELETE FROM assessment_service.b10_assessment_report WHERE principal_id='${principal}';
    DELETE FROM assessment_service.b10_assessment_attempt WHERE principal_id='${principal}';
    DELETE FROM assessment_service.b10_assessment_session WHERE principal_id='${principal}';
    DELETE FROM assessment_service.b25_assessment_report WHERE principal_id='${principal}';
    DELETE FROM assessment_service.b25_assessment_idempotency WHERE principal_id='${principal}';
    DELETE FROM assessment_service.b25_assessment_session WHERE principal_id='${principal}';
    DELETE FROM assessment_service.p1_placement_checkpoint WHERE principal_id='${principal}';
    DELETE FROM assessment_service.p1_placement_response WHERE principal_id='${principal}';
    DELETE FROM assessment_service.p1_placement_result WHERE principal_id='${principal}';
    DELETE FROM assessment_service.p1_placement_idempotency WHERE principal_id='${principal}';
    DELETE FROM assessment_service.p1_placement_session WHERE principal_id='${principal}';
    UPDATE iam_service.iam_session SET status='REVOKED', revoked_at=UTC_TIMESTAMP(6), revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE principal_id='${principal}' AND status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
      WHERE identifier='${account.identifier}' AND principal_id='${principal}';
    COMMIT;`
  mysql(sql)
  const counts = mysql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM assessment_service.b10_assessment_session WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM assessment_service.b25_assessment_session WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM assessment_service.p1_placement_session WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_session WHERE principal_id='${principal}' AND status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_account WHERE principal_id='${principal}' AND status='DISABLED'))`)
  assert.equal(counts, '0:0:0:0:1', 'synthetic cleanup verification failed')
  return { tag: account.tag, principalTag: tag(principal), remaining: counts, verified: true }
}

try {
  await fs.mkdir(output, { recursive: true })
  for (const base of [gateway, owner]) {
    const health = await fetch(`${base}/actuator/health`)
    check(`${new URL(base).port}-health`, health.status === 200, health.status, 200)
  }
  await Promise.all(accounts.map(registerAdult))
  const [a, b] = accounts

  const placementKey = key('canonical-placement')
  const placement = await call(gateway, 'POST', '/api/v1/assessment/placement/sessions',
    { token: a.token, body: {}, idempotencyKey: placementKey })
  check('canonical-placement-gateway', placement.status === 503,
    { status: placement.status, code: placement.code }, '503 source unavailable')
  const placementReplay = await call(gateway, 'POST', '/api/v1/assessment/placement/sessions',
    { token: a.token, body: {}, idempotencyKey: placementKey })
  check('canonical-placement-retry-blocked', placementReplay.status === 503,
    { status: placementReplay.status, code: placementReplay.code }, '503 before session creation')
  const placementOwner = await call(owner, 'POST', '/internal/v1/assessment/placement/sessions',
    { token: a.token, body: {}, idempotencyKey: key('owner-placement') })
  check('canonical-placement-owner', placementOwner.status === 503,
    { status: placementOwner.status, code: placementOwner.code }, '503 source unavailable')

  const fixtureKey = key('fixture-session')
  const fixture = await call(gateway, 'POST', '/api/v1/assessment/sessions', { token: a.token,
    body: { mode: 'PRACTICE', contentVersionId: 25001 }, idempotencyKey: fixtureKey })
  const sessionId = fixture.data?.sessionId
  check('historical-fixture-session', fixture.status === 200 && typeof sessionId === 'string',
    { status: fixture.status, sessionTag: sessionId ? tag(sessionId) : null }, '200 fixture session')
  if (typeof sessionId === 'string') {
    const same = await call(gateway, 'POST', '/api/v1/assessment/sessions', { token: a.token,
      body: { mode: 'PRACTICE', contentVersionId: 25001 }, idempotencyKey: fixtureKey })
    check('historical-session-same-key', same.status === 200 && same.data?.sessionId === sessionId,
      { status: same.status, sameId: same.data?.sessionId === sessionId }, 'same session')
    const restored = await call(gateway, 'GET', `/api/v1/assessment/sessions/${sessionId}`, { token: a.token })
    check('historical-session-recovery', restored.status === 200 && restored.data?.sessionId === sessionId,
      { status: restored.status, sameId: restored.data?.sessionId === sessionId }, '200 same session')
    const foreign = await call(gateway, 'GET', `/api/v1/assessment/sessions/${sessionId}`, { token: b.token })
    check('historical-session-cross-subject', [403, 404].includes(foreign.status),
      { status: foreign.status, code: foreign.code }, '403 or 404')
    const canonicalCheckpoint = await call(gateway, 'PUT', `/api/v1/assessment/sessions/${sessionId}/checkpoint`,
      { token: a.token, body: {}, idempotencyKey: key('checkpoint-gateway') })
    check('canonical-checkpoint-gateway-missing', ![200, 201].includes(canonicalCheckpoint.status),
      { status: canonicalCheckpoint.status, code: canonicalCheckpoint.code }, 'unavailable; no checkpoint saved')
    const directCheckpoint = await call(owner, 'PUT', `/internal/v1/assessment/sessions/${sessionId}/checkpoint`,
      { token: a.token, body: {}, idempotencyKey: key('checkpoint-owner') })
    check('canonical-checkpoint-owner-missing', ![200, 201].includes(directCheckpoint.status),
      { status: directCheckpoint.status, code: directCheckpoint.code }, 'no owner implementation')
    const changed = await call(gateway, 'POST', '/api/v1/assessment/sessions', { token: a.token,
      body: { mode: 'MOCK', contentVersionId: 25001 }, idempotencyKey: fixtureKey })
    check('historical-session-different-body-conflict', changed.status === 409,
      { status: changed.status, sameId: changed.data?.sessionId === sessionId }, '409 for same key and different request')
  }
  const missingSource = await call(gateway, 'POST', '/api/v1/assessment/sessions', { token: a.token,
    body: { mode: 'PRACTICE', contentVersionId: 999999999 }, idempotencyKey: key('missing-content') })
  check('historical-missing-content', [410, 503].includes(missingSource.status),
    { status: missingSource.status, code: missingSource.code }, '410 or 503; no fabricated assessment')

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const browserErrors = []
  page.on('pageerror', error => browserErrors.push(error.name))
  await page.goto(`${web}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByLabel(/账号|邮箱/i).first().fill(a.identifier)
  await page.getByLabel(/密码/i).first().fill(a.password)
  await page.getByRole('button', { name: /登录/i }).first().click()
  await page.waitForTimeout(1600)
  await page.goto(`${web}/assessment`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2200)
  const text = await page.locator('body').innerText()
  await page.screenshot({ path: path.join(output, 'learner-assessment.png'), fullPage: true })
  evidence.browser = { path: new URL(page.url()).pathname,
    legacyPractice: /历史两题|2\s*\/\s*2|1\s*\/\s*2/.test(text),
    unavailable: /测评暂时不可用|真实练习暂时不可用/.test(text),
    browserErrors, screenshot: 'learner-assessment.png' }
  check('browser-assessment-visible', evidence.browser.path === '/assessment',
    { path: evidence.browser.path, legacyPractice: evidence.browser.legacyPractice,
      unavailable: evidence.browser.unavailable }, '/assessment current state')
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  for (const account of accounts) {
    try { evidence.cleanup.push(cleanupAccount(account)) }
    catch (error) {
      evidence.cleanup.push({ tag: account.tag, verified: false,
        error: error instanceof Error ? String(error.stderr ?? error.message).slice(0, 300) : String(error) })
      process.exitCode = 1
    }
  }
  evidence.result = evidence.failure || evidence.checks.some(item => !item.pass)
    || evidence.cleanup.some(item => !item.verified) ? 'FAIL' : 'PARTIAL_BLOCKED'
  await fs.writeFile(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify({ output, result: evidence.result, checks: evidence.checks.length,
    failures: evidence.checks.filter(item => !item.pass).map(item => item.name),
    cleanup: evidence.cleanup.map(item => ({ tag: item.tag, verified: item.verified })),
    browser: evidence.browser, failure: evidence.failure ?? null }))
}
