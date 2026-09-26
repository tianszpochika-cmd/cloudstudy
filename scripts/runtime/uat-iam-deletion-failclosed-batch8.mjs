/** Local Gateway/IAM account deletion safety UAT. Only this run's synthetic data is removed. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'

const stamp = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
const prefix = `uat-iam-del-${stamp}`
const identifier = `${prefix}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const peerIdentifier = `${prefix}-peer@local.invalid`
const peerPassword = `Uat!${randomBytes(20).toString('base64url')}a9`
const historicalId = `del_${stamp}history`
const historicalKey = `${prefix}-historical-row`
const gateway = 'http://127.0.0.1:18070'
const iam = 'http://127.0.0.1:18087'
const output = 'artifacts/uat-2026-09-23/iam-account-deletion-runtime-batch8.json'
const device = { deviceType: 'WEB', clientVersion: 'iam-deletion-uat-1', deviceName: 'iam-deletion-uat' }
const checks = []
let principalId = null
let peerPrincipalId = null
let cleanupResult = null
let failure = null
let sequence = 0

function key(label) { return `${prefix}-${++sequence}-${label}` }
function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function record(name, observed, expected, ok) {
  checks.push({ name, observed, expected, ok: Boolean(ok) })
  if (!ok) throw new Error(`${name}: observed ${JSON.stringify(observed)}, expected ${JSON.stringify(expected)}`)
}
async function call(base, method, route, { token, body, idempotencyKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${base}${route}`, { method, headers, redirect: 'manual',
    body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await response.json().catch(() => null)
  return { status: response.status, code: json?.error?.code ?? json?.code ?? null,
    token: json?.data?.accessToken ?? null, deletionStatus: json?.data?.status ?? null }
}
function ownerCounts(principal) {
  assert.match(principal, /^[0-9a-f-]{36}$/i)
  const result = mysql(`SELECT CONCAT(
    (SELECT COUNT(*) FROM iam_service.iam_account_deletion WHERE principal_id='${principal}'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_account WHERE principal_id='${principal}' AND status='ACTIVE'), ':',
    (SELECT COUNT(*) FROM iam_service.iam_session WHERE principal_id='${principal}' AND status='ACTIVE'))`)
  const values = result.split(':').map(Number)
  assert.equal(values.length, 3)
  assert.ok(values.every(Number.isSafeInteger))
  return { deletionRequests: values[0], activeAccounts: values[1], activeSessions: values[2] }
}
function cleanupAccount(targetIdentifier, expectedPrincipal) {
  assert.ok(targetIdentifier === identifier || targetIdentifier === peerIdentifier)
  assert.match(prefix, /^uat-iam-del-[a-z0-9]+$/)
  const principal = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${targetIdentifier}'`)
  let sessionIds = []
  if (principal) {
    assert.match(principal, /^[0-9a-f-]{36}$/i)
    if (expectedPrincipal) assert.equal(principal, expectedPrincipal)
    sessionIds = mysql(`SELECT session_id FROM iam_service.iam_session WHERE principal_id='${principal}'`)
      .split('\n').filter(Boolean)
    for (const sessionId of sessionIds) assert.match(sessionId, /^[0-9a-f-]{36}$/i)
    // Every principal-scoped delete is limited to the exact freshly registered account.
    mysql(`START TRANSACTION;
      DELETE FROM iam_service.iam_refresh_token_history WHERE session_id IN
        (SELECT session_id FROM iam_service.iam_session WHERE principal_id='${principal}');
      DELETE FROM iam_service.iam_session WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_device WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_consent_current WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_consent_lock WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_consent WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_account_deletion WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_password_reset_challenge WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_decision_audit WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_principal_role WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_policy_control_contributor WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_policy_control_audit WHERE actor_principal_id='${principal}';
      DELETE FROM iam_service.iam_account WHERE principal_id='${principal}' AND identifier='${targetIdentifier}';
      DELETE FROM iam_service.iam_principal WHERE principal_id='${principal}';
      DELETE FROM iam_service.iam_idempotency_record WHERE idempotency_key LIKE '${prefix}-%';
      COMMIT;`)
  } else {
    mysql(`DELETE FROM iam_service.iam_idempotency_record WHERE idempotency_key LIKE '${prefix}-%'`)
  }
  const accountRows = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_account WHERE identifier='${targetIdentifier}'`))
  const keyRows = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_idempotency_record WHERE idempotency_key LIKE '${prefix}-%'`))
  const historyRows = sessionIds.length ? Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_refresh_token_history
    WHERE session_id IN (${sessionIds.map(sessionId => `'${sessionId}'`).join(',')})`)) : 0
  let principalRows = 0
  if (principal) {
    principalRows = Number(mysql(`SELECT
      (SELECT COUNT(*) FROM iam_service.iam_principal WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_session WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_device WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_consent WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_consent_current WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_consent_lock WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_account_deletion WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_decision_audit WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_password_reset_challenge WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_principal_role WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_policy_control_contributor WHERE principal_id='${principal}')+
      (SELECT COUNT(*) FROM iam_service.iam_policy_control_audit WHERE actor_principal_id='${principal}')`))
  }
  assert.deepEqual({ accountRows, keyRows, principalRows, historyRows },
    { accountRows: 0, keyRows: 0, principalRows: 0, historyRows: 0 })
  return { account: targetIdentifier === identifier ? 'owner' : 'peer',
    accountRows, keyRows, principalRows, historyRows, verified: true }
}

try {
  const health = await fetch(`${gateway}/actuator/health`)
  record('Gateway healthy', health.status, 200, health.status === 200)
  const iamHealth = await fetch(`${iam}/actuator/health`)
  record('IAM healthy', iamHealth.status, 200, iamHealth.status === 200)

  const registration = await call(gateway, 'POST', '/api/v1/auth/register', {
    body: { identifier, password, device }, idempotencyKey: key('register'),
  })
  record('synthetic account registration', registration.status, 201,
    registration.status === 201 && typeof registration.token === 'string')
  principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principalId, /^[0-9a-f-]{36}$/i)
  const registerToken = registration.token

  const adult = await call(gateway, 'POST', '/api/v1/iam/adult-gate', {
    token: registerToken, idempotencyKey: key('adult-gate'),
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  })
  record('synthetic adult Gate', adult.status, 200, adult.status === 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call(gateway, 'PUT', '/api/v1/iam/consents', {
      token: registerToken, idempotencyKey: key(`consent-${type.toLowerCase()}`),
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
    })
    record(`${type} consent`, consent.status, 200, consent.status === 200)
  }
  const login = await call(gateway, 'POST', '/api/v1/auth/login', {
    body: { identifier, password, device }, idempotencyKey: key('login'),
  })
  record('synthetic account login', login.status, 200,
    login.status === 200 && typeof login.token === 'string')
  const before = ownerCounts(principalId)
  record('no preexisting synthetic deletion request', before.deletionRequests, 0,
    before.deletionRequests === 0)

  const deletionBody = {
    reauthenticationRef: `reauth_${stamp}synthetic`,
    confirmation: 'DELETE_ACCOUNT', reasonCode: 'USER_REQUEST',
  }
  const anonymous = await call(gateway, 'POST', '/api/v1/iam/account-deletions', {
    body: deletionBody, idempotencyKey: key('anonymous'),
  })
  record('anonymous deletion request denied', anonymous.status, 401, anonymous.status === 401)
  const requestKey = key('deletion-request')
  const authenticated = await call(gateway, 'POST', '/api/v1/iam/account-deletions', {
    token: login.token, body: deletionBody, idempotencyKey: requestKey,
  })
  record('authenticated deletion request fails closed',
    { status: authenticated.status, code: authenticated.code }, 503,
    authenticated.status === 503)
  const replay = await call(gateway, 'POST', '/api/v1/iam/account-deletions', {
    token: login.token, body: deletionBody, idempotencyKey: requestKey,
  })
  record('retry remains unavailable', { status: replay.status, code: replay.code }, 503,
    replay.status === 503)
  const after = ownerCounts(principalId)
  record('no deletion row or account/session mutation', after, before,
    after.deletionRequests === 0 && after.activeAccounts === before.activeAccounts
      && after.activeSessions === before.activeSessions)

  // Historical compatibility check. This row is owned by the new synthetic subject
  // and has a future execute_at; no execution path is called.
  const peerRegistration = await call(gateway, 'POST', '/api/v1/auth/register', {
    body: { identifier: peerIdentifier, password: peerPassword, device },
    idempotencyKey: key('peer-register'),
  })
  record('synthetic peer registration', peerRegistration.status, 201,
    peerRegistration.status === 201 && typeof peerRegistration.token === 'string')
  peerPrincipalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${peerIdentifier}'`)
  assert.match(peerPrincipalId, /^[0-9a-f-]{36}$/i)
  assert.notEqual(peerPrincipalId, principalId)
  const peerAdult = await call(gateway, 'POST', '/api/v1/iam/adult-gate', {
    token: peerRegistration.token, idempotencyKey: key('peer-adult-gate'),
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  })
  record('synthetic peer adult Gate', peerAdult.status, 200, peerAdult.status === 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call(gateway, 'PUT', '/api/v1/iam/consents', {
      token: peerRegistration.token, idempotencyKey: key(`peer-consent-${type.toLowerCase()}`),
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
    })
    record(`peer ${type} consent`, consent.status, 200, consent.status === 200)
  }
  const peerLogin = await call(gateway, 'POST', '/api/v1/auth/login', {
    body: { identifier: peerIdentifier, password: peerPassword, device },
    idempotencyKey: key('peer-login'),
  })
  record('synthetic peer login', peerLogin.status, 200,
    peerLogin.status === 200 && typeof peerLogin.token === 'string')

  assert.match(historicalId, /^del_[a-z0-9]{12,}history$/)
  assert.equal(ownerCounts(principalId).deletionRequests, 0)
  const existingId = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_account_deletion
    WHERE deletion_request_id='${historicalId}'`))
  assert.equal(existingId, 0)
  mysql(`INSERT INTO iam_service.iam_account_deletion
    (deletion_request_id,principal_id,tenant_id,status,execute_at,idempotency_key,receipt_json)
    SELECT '${historicalId}',a.principal_id,p.tenant_id,'REQUESTED',
      DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 7 DAY),'${historicalKey}',NULL
    FROM iam_service.iam_account a
    JOIN iam_service.iam_principal p ON p.principal_id=a.principal_id
    WHERE a.identifier='${identifier}' AND a.principal_id='${principalId}' AND a.status='ACTIVE'`)
  const fixtureState = mysql(`SELECT CONCAT(COUNT(*),':',MIN(status),':',
    MIN(execute_at>UTC_TIMESTAMP(6))) FROM iam_service.iam_account_deletion
    WHERE deletion_request_id='${historicalId}' AND principal_id='${principalId}'`)
  record('future historical row belongs only to synthetic owner', fixtureState,
    '1:REQUESTED:1', fixtureState === '1:REQUESTED:1')

  const route = `/api/v1/iam/account-deletions/${historicalId}`
  const ownRead = await call(gateway, 'GET', route, { token: login.token })
  record('historical own status read',
    { status: ownRead.status, deletionStatus: ownRead.deletionStatus },
    { status: 200, deletionStatus: 'REQUESTED' },
    ownRead.status === 200 && ownRead.deletionStatus === 'REQUESTED')
  const peerRead = await call(gateway, 'GET', route, { token: peerLogin.token })
  record('historical cross-subject status denied', peerRead.status, '403 or 404',
    [403, 404].includes(peerRead.status))
  const cancelBody = { reauthenticationRef: `reauth_${stamp}synthetic` }
  const peerCancel = await call(gateway, 'POST', `${route}/cancel`, {
    token: peerLogin.token, idempotencyKey: key('peer-cancel'), body: cancelBody,
  })
  record('historical cross-subject cancel denied', peerCancel.status, '403 or 404',
    [403, 404].includes(peerCancel.status))
  const noKey = await call(gateway, 'POST', `${route}/cancel`, {
    token: login.token, body: cancelBody,
  })
  record('historical cancel requires idempotency key', noKey.status, 400,
    noKey.status === 400)
  const cancelKey = key('owner-cancel')
  const ownCancel = await call(gateway, 'POST', `${route}/cancel`, {
    token: login.token, idempotencyKey: cancelKey, body: cancelBody,
  })
  record('historical own cancel',
    { status: ownCancel.status, deletionStatus: ownCancel.deletionStatus },
    { status: 200, deletionStatus: 'CANCELLED' },
    ownCancel.status === 200 && ownCancel.deletionStatus === 'CANCELLED')
  const repeatCancel = await call(gateway, 'POST', `${route}/cancel`, {
    token: login.token, idempotencyKey: cancelKey, body: cancelBody,
  })
  record('historical own cancel repeat',
    { status: repeatCancel.status, deletionStatus: repeatCancel.deletionStatus },
    { status: 200, deletionStatus: 'CANCELLED' },
    repeatCancel.status === 200 && repeatCancel.deletionStatus === 'CANCELLED')
  const finalRead = await call(gateway, 'GET', route, { token: login.token })
  record('historical own status after cancel',
    { status: finalRead.status, deletionStatus: finalRead.deletionStatus },
    { status: 200, deletionStatus: 'CANCELLED' },
    finalRead.status === 200 && finalRead.deletionStatus === 'CANCELLED')
  const decided = mysql(`SELECT CONCAT(status,':',IF(decided_at IS NULL,0,1))
    FROM iam_service.iam_account_deletion WHERE deletion_request_id='${historicalId}'
    AND principal_id='${principalId}'`)
  record('historical owner row persisted cancelled', decided, 'CANCELLED:1',
    decided === 'CANCELLED:1')
  const historicalCounts = ownerCounts(principalId)
  record('historical cancel leaves account and sessions intact', historicalCounts,
    { deletionRequests: 1, activeAccounts: before.activeAccounts,
      activeSessions: before.activeSessions },
    historicalCounts.deletionRequests === 1
      && historicalCounts.activeAccounts === before.activeAccounts
      && historicalCounts.activeSessions === before.activeSessions)
} catch (error) {
  failure = error instanceof Error ? error.message : String(error)
} finally {
  cleanupResult = { accounts: [], historicalRows: null }
  for (const [targetIdentifier, expectedPrincipal] of [
    [identifier, principalId], [peerIdentifier, peerPrincipalId],
  ]) {
    try { cleanupResult.accounts.push(cleanupAccount(targetIdentifier, expectedPrincipal)) }
    catch (error) {
      cleanupResult.accounts.push({ account: targetIdentifier === identifier ? 'owner' : 'peer',
        verified: false })
      failure = `${failure ?? ''}; cleanup: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  try {
    cleanupResult.historicalRows = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_account_deletion
      WHERE deletion_request_id='${historicalId}'`))
    if (cleanupResult.historicalRows !== 0) throw new Error('synthetic historical row remains')
  } catch (error) {
    failure = `${failure ?? ''}; cleanup: ${error instanceof Error ? error.message : String(error)}`
  }
  const passed = checks.filter(check => check.ok).length
  const evidence = { scope: 'Local Gateway and IAM owner deletion safety and historical self-service boundary',
    capturedAt: new Date().toISOString(), result: !failure && passed === checks.length ? 'PASS' : 'FAIL',
    passed, total: checks.length, checks, cleanup: cleanupResult,
    note: 'The reauthentication reference is synthetic and historical cancel does not verify it. This does not establish a complete deletion flow.',
    failure }
  await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(`IAM deletion safety ${passed}/${checks.length} ${evidence.result}`)
  if (failure) console.error(failure)
  if (evidence.result !== 'PASS') process.exitCode = 1
}
