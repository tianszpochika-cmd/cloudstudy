/** Read-only owner probe using one disposable local.invalid adult account. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const output = path.join(root, 'artifacts', 'uat-2026-09-23', 'offline-package-owner-boundary.json')
const gateway = 'http://127.0.0.1:18070'
const owner = 'http://127.0.0.1:18093'
const afterGatewayDeploy = process.argv.includes('--after-gateway-deploy')
const mobileOrigin = 'http://127.0.0.1:18183'
const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `uat-offline-read-${stamp}@local.invalid`
const secondIdentifier = `uat-offline-read-${stamp}-second@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const secondPassword = `Uat!${randomBytes(20).toString('base64url')}b8`
const device = { deviceType: 'WEB', clientVersion: 'offline-read-uat', deviceName: 'offline-read-uat' }
const evidence = { capturedAt: new Date().toISOString(), scope: afterGatewayDeploy
  ? 'Local Gateway to notification owner after route deployment'
  : 'Notification owner after fixture quarantine; Gateway deployment pending',
  accountTag: createHash('sha256').update(identifier).digest('hex').slice(0, 12), checks: [], cleanup: null,
  conclusion: afterGatewayDeploy
    ? 'The exact Gateway GET path returns a truthful empty offline catalog to an authorized adult.'
    : 'Owner returns a truthful empty offline catalog; current Gateway still needs the route deployment.' }
let token
let registered = false
let secondRegistered = false
let serial = 0
function key(label) { return `uat-offline-read-${stamp}-${++serial}-${label}` }
function check(name, actual, expected) {
  const pass = actual === expected
  evidence.checks.push({ name, actual, expected, pass })
  assert.ok(pass, `${name}: expected ${expected}, got ${actual}`)
}
function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
async function call(base, method, route, { credential, body, extraHeaders } = {}) {
  const headers = { accept: 'application/json', ...(extraHeaders ?? {}) }
  if (credential) headers.authorization = `Bearer ${credential}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') headers['idempotency-key'] = key(route.slice(1).replaceAll('/', '-'))
  const response = await fetch(base + route, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const json = await response.json().catch(() => null)
  return { status: response.status, data: json?.data ?? json, token: json?.data?.accessToken ?? null,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    allowCredentials: response.headers.get('access-control-allow-credentials') }
}
function cleanupAccount(targetIdentifier, wasRegistered) {
  assert.match(targetIdentifier, /^uat-offline-read-[a-z0-9-]+@local\.invalid$/)
  const principal = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${targetIdentifier}'`)
  if (!principal) return { verified: !wasRegistered, accountCount: 0 }
  assert.match(principal, /^[a-f0-9-]{36}$/i)
  const ownerRows = Number(mysql(`SELECT COUNT(*) FROM notification_service.notification_offline_download WHERE principal_id='${principal}'`))
  assert.equal(ownerRows, 0, 'Read-only test unexpectedly created a download')
  mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6),revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE principal_id='${principal}' AND status='ACTIVE';
    UPDATE iam_service.iam_device SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6),revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE principal_id='${principal}' AND status='ACTIVE';
    UPDATE iam_service.iam_principal SET status='DISABLED' WHERE principal_id='${principal}' AND status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions=''
      WHERE principal_id='${principal}' AND identifier='${targetIdentifier}';
    COMMIT;`)
  const counts = mysql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM iam_service.iam_session WHERE principal_id='${principal}' AND status='ACTIVE'),':',
    (SELECT COUNT(*) FROM iam_service.iam_device WHERE principal_id='${principal}' AND status='ACTIVE'),':',
    (SELECT COUNT(*) FROM iam_service.iam_principal WHERE principal_id='${principal}' AND status='ACTIVE'),':',
    (SELECT COUNT(*) FROM iam_service.iam_account WHERE principal_id='${principal}' AND status='DISABLED'),':',
    (SELECT COUNT(*) FROM notification_service.notification_offline_download WHERE principal_id='${principal}'))`)
  assert.equal(counts, '0:0:0:1:0')
  return { verified: true, remaining: counts }
}
function cleanup() {
  const primary = cleanupAccount(identifier, registered)
  const secondary = cleanupAccount(secondIdentifier, secondRegistered)
  return { verified: primary.verified && secondary.verified, primary, secondary }
}

try {
  check('anonymous owner', (await call(owner, 'GET', '/internal/v1/sync/offline-packages?limit=20')).status, 401)
  if (afterGatewayDeploy) {
    check('anonymous gateway', (await call(gateway, 'GET', '/api/v1/sync/offline-packages?limit=20')).status, 401)
    const preflight = await fetch(gateway + '/api/v1/sync/offline-packages?limit=20', {
      method: 'OPTIONS', headers: { origin: mobileOrigin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization' }, redirect: 'manual' })
    check('mobile preflight status', preflight.status, 200)
    check('mobile preflight origin', preflight.headers.get('access-control-allow-origin'), mobileOrigin)
    check('mobile preflight credentials', preflight.headers.get('access-control-allow-credentials'), 'true')
  }
  const register = await call(gateway, 'POST', '/api/v1/auth/register',
    { body: { identifier, password, device } })
  check('register', register.status, 201)
  token = register.token
  assert.ok(token)
  registered = true
  const preGate = await call(owner, 'GET', '/internal/v1/sync/offline-packages?limit=20', { credential: token })
  check('pre-gate owner permission', preGate.status, 403)
  if (afterGatewayDeploy) {
    check('pre-gate gateway permission', (await call(gateway, 'GET',
      '/api/v1/sync/offline-packages?limit=20', { credential: token })).status, 403)
  }
  const gate = await call(gateway, 'POST', '/api/v1/iam/adult-gate',
    { credential: token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } })
  check('adult gate', gate.status, 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call(gateway, 'PUT', '/api/v1/iam/consents',
      { credential: token, body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' } })
    check(`${type} consent`, consent.status, 200)
  }
  const login = await call(gateway, 'POST', '/api/v1/auth/login',
    { body: { identifier, password, device } })
  check('post-gate login', login.status, 200)
  token = login.token
  assert.ok(token)
  const publishedBefore = Number(mysql("SELECT COUNT(*) FROM notification_service.notification_offline_package WHERE state='PUBLISHED'"))
  const downloadsBefore = Number(mysql('SELECT COUNT(*) FROM notification_service.notification_offline_download'))
  const list = await call(owner, 'GET', '/internal/v1/sync/offline-packages?limit=20', { credential: token })
  check('adult owner list', list.status, 200)
  const items = list.data?.items
  assert.ok(Array.isArray(items))
  evidence.ownerList = { count: items.length,
    fixtureCount: items.filter(item => typeof item.packageId === 'string'
      && /^(bulk-100x-notification_offli-package-|local-10x-offline-package-)/.test(item.packageId)).length,
    realCount: items.filter(item => typeof item.packageId !== 'string'
      || !/^(bulk-100x-notification_offli-package-|local-10x-offline-package-)/.test(item.packageId)).length,
    signedUrlsReturned: items.reduce((sum, item) => sum + (Array.isArray(item.signedPartUrls) ? item.signedPartUrls.length : 0), 0) }
  check('owner truthful empty list', items.length, 0)
  check('published row count unchanged by read',
    Number(mysql("SELECT COUNT(*) FROM notification_service.notification_offline_package WHERE state='PUBLISHED'")), publishedBefore)
  check('download row count unchanged by read',
    Number(mysql('SELECT COUNT(*) FROM notification_service.notification_offline_download')), downloadsBefore)
  const gatewayList = await call(gateway, 'GET', '/api/v1/sync/offline-packages?limit=20',
    { credential: token, extraHeaders: { origin: mobileOrigin } })
  evidence.gatewayList = { status: gatewayList.status,
    count: Array.isArray(gatewayList.data?.items) ? gatewayList.data.items.length : null }
  check('gateway deployment state', gatewayList.status, afterGatewayDeploy ? 200 : 404)
  if (afterGatewayDeploy) {
    check('gateway truthful empty list', evidence.gatewayList.count, 0)
    check('mobile GET CORS origin', gatewayList.allowOrigin, mobileOrigin)
    check('mobile GET CORS credentials', gatewayList.allowCredentials, 'true')
    const withheldWrites = [
      ['POST', '/api/v1/sync/offline-packages/no-real-package/authorize'],
      ['PATCH', '/api/v1/sync/offline-downloads/no-real-download'],
      ['POST', '/api/v1/sync/offline-downloads/no-real-download/cleanup'],
      ['POST', '/api/v1/sync/events'],
      ['PUT', '/api/v1/sync/checkpoints/no-real-entity'],
    ]
    for (const [method, route] of withheldWrites) {
      check(`${method} ${route} remains withheld`,
        (await call(gateway, method, route, { credential: token, body: {} })).status, 404)
    }
    const writePreflight = await fetch(gateway + withheldWrites[0][1], {
      method: 'OPTIONS', headers: { origin: mobileOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,idempotency-key,content-type' }, redirect: 'manual' })
    check('mobile write preflight remains withheld', writePreflight.status, 403)

    const secondRegister = await call(gateway, 'POST', '/api/v1/auth/register',
      { body: { identifier: secondIdentifier, password: secondPassword, device } })
    check('second adult register', secondRegister.status, 201)
    secondRegistered = true
    let secondToken = secondRegister.token
    assert.ok(secondToken)
    check('second adult gate', (await call(gateway, 'POST', '/api/v1/iam/adult-gate',
      { credential: secondToken, body: { confirmed: true, birthYear: 1994, policyVersion: 'b30-adult-v1' } })).status, 200)
    for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
      check(`second ${type} consent`, (await call(gateway, 'PUT', '/api/v1/iam/consents',
        { credential: secondToken, body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' } })).status, 200)
    }
    const secondLogin = await call(gateway, 'POST', '/api/v1/auth/login',
      { body: { identifier: secondIdentifier, password: secondPassword, device } })
    check('second adult login', secondLogin.status, 200)
    secondToken = secondLogin.token
    assert.ok(secondToken)
    const firstPrincipal = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
    const secondPrincipal = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${secondIdentifier}'`)
    assert.match(firstPrincipal, /^[a-f0-9-]{36}$/i)
    assert.match(secondPrincipal, /^[a-f0-9-]{36}$/i)
    check('distinct adult principals', firstPrincipal !== secondPrincipal, true)
    const crossSubject = await call(gateway, 'GET', '/api/v1/sync/offline-packages?limit=20',
      { credential: secondToken, extraHeaders: {
        'x-subject-id': firstPrincipal, 'x-role': 'admin', 'x-tenant-id': 'platform',
      } })
    check('second adult with forged owner headers', crossSubject.status, 200)
    check('second adult cannot see withdrawn packages', crossSubject.data?.items?.length, 0)
    check('cross-subject probe created no download',
      Number(mysql(`SELECT COUNT(*) FROM notification_service.notification_offline_download WHERE principal_id IN ('${firstPrincipal}','${secondPrincipal}')`)), 0)
    check('withheld writes created no offline event', Number(mysql(`SELECT COUNT(*) FROM notification_service.notification_offline_event WHERE principal_id IN ('${firstPrincipal}','${secondPrincipal}')`)), 0)
    evidence.crossSubject = { distinctPrincipals: true, forgedAuthorityHeadersIgnored: true,
      catalogCount: crossSubject.data.items.length,
      note: 'No real published package exists, so positive download ownership cannot be exercised.' }
  }
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally {
  try { evidence.cleanup = cleanup() }
  catch (error) { evidence.cleanup = { verified: false, reason: error instanceof Error ? error.message : String(error) }; process.exitCode = 1 }
  evidence.status = evidence.checks.some(item => !item.pass) || !evidence.cleanup.verified
    ? 'FAIL' : afterGatewayDeploy ? 'PASS' : 'GATEWAY_DEPLOY_PENDING'
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ output, status: evidence.status, checks: evidence.checks.length,
    ownerList: evidence.ownerList, gatewayList: evidence.gatewayList,
    cleanup: evidence.cleanup }))
}
