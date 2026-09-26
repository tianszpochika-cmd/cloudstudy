/** Local Gateway/workflow regression. Only this script's synthetic saga and receipts are removed. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const identifier = `uat-workflow-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const sagaId = randomUUID()
const missingSagaId = randomUUID()
const base = 'http://127.0.0.1:18070'
const owner = 'http://127.0.0.1:18071'
const output = 'artifacts/uat-2026-09-23/workflow-security-runtime.json'
const checks = []
let principalId = null
let registered = false
let syntheticSagaInserted = false
let cleanupResult = null

function mysql(sql) {
  return execFileSync('docker', [
    'exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1',
    'mysql', '-uroot', '--batch', '--skip-column-names', '-e', sql,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function record(name, response, expected, ok) {
  const observed = { status: response.status, code: response.code ?? null }
  checks.push({ name, observed, expected, ok })
  if (!ok) throw new Error(`${name}: ${JSON.stringify(observed)} expected ${JSON.stringify(expected)}`)
}

async function call(host, method, route, { token, key, body } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (key) headers['Idempotency-Key'] = key
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${host}${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, data: json?.data ?? json, code: json?.error?.code ?? json?.code ?? null }
}

function cleanup() {
  assert.match(identifier, /^uat-workflow-[a-z0-9]+@local\.invalid$/)
  assert.match(sagaId, /^[0-9a-f-]{36}$/)
  if (principalId) assert.match(principalId, /^[0-9a-f-]{36}$/)
  const foundSaga = mysql(`SELECT saga_name FROM workflow_service.saga_instance WHERE saga_id='${sagaId}'`)
  if (foundSaga) assert.equal(foundSaga, 'UAT_WORKFLOW_SECURITY')
  const removed = mysql(`START TRANSACTION;
    DELETE FROM workflow_service.workflow_request_idempotency WHERE tenant_id='platform'
      AND actor_subject='${principalId}' AND idempotency_key LIKE 'uat-workflow-${stamp}-%';
    SELECT CONCAT('receipts:',ROW_COUNT());
    DELETE FROM workflow_service.saga_step WHERE saga_id='${sagaId}'; SELECT CONCAT('steps:',ROW_COUNT());
    DELETE FROM workflow_service.saga_instance WHERE saga_id='${sagaId}' AND saga_name='UAT_WORKFLOW_SECURITY';
    SELECT CONCAT('sagas:',ROW_COUNT()); COMMIT;`)
  const account = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
      WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions='' WHERE identifier='${identifier}';
    SELECT CONCAT(COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
    COMMIT;`)
  const activeSessions = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a
    ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE'`))
  if (registered) assert.equal(account, '1:DISABLED')
  if (syntheticSagaInserted) assert.match(removed, /sagas:1/)
  assert.equal(activeSessions, 0)
  return { removed, account, activeSessions }
}

let failure = null
try {
  const device = { deviceType: 'WEB', clientVersion: 'uat-workflow-1', deviceName: 'uat-workflow' }
  const registration = await call(base, 'POST', '/api/v1/auth/register', {
    body: { identifier, password, device }, key: `uat-workflow-${stamp}-register`,
  })
  registered = registration.status === 201
  record('synthetic registration', registration, 201, registered)
  principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principalId, /^[0-9a-f-]{36}$/)
  const earlyToken = registration.data?.accessToken
  assert.equal(typeof earlyToken, 'string')
  const gate = await call(base, 'POST', '/api/v1/iam/adult-gate', {
    token: earlyToken, key: `uat-workflow-${stamp}-gate`,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  })
  record('adult Gate', gate, 200, gate.status === 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const response = await call(base, 'PUT', '/api/v1/iam/consents', {
      token: earlyToken, key: `uat-workflow-${stamp}-${type.toLowerCase()}`,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
    })
    record(`${type} consent`, response, 200, response.status === 200)
  }
  async function login(permissions) {
    assert.match(permissions, /^[a-z.,]*$/)
    mysql(`UPDATE iam_service.iam_account SET roles='staff',permissions='${permissions}' WHERE identifier='${identifier}'`)
    const response = await call(base, 'POST', '/api/v1/auth/login', {
      body: { identifier, password, device }, key: `uat-workflow-${stamp}-login-${randomBytes(4).toString('hex')}`,
    })
    assert.equal(response.status, 200)
    assert.equal(typeof response.data?.accessToken, 'string')
    return response.data.accessToken
  }

  // Gateway rejects empty scope as an invalid JWT, so use an unrelated valid permission.
  const none = await login('learner.profile.read')
  const unfinished = '/api/v1/admin/recovery/sagas/unfinished'
  const directUnfinished = '/internal/v1/workflow/sagas/unfinished'
  let response = await call(owner, 'GET', directUnfinished, { token: none })
  record('owner denies staff without recovery read', response, 403, response.status === 403)
  response = await call(base, 'GET', unfinished, { token: none })
  record('Gateway denies staff without recovery read', response, 403, response.status === 403)

  const read = await login('admin.recovery.read')
  response = await call(base, 'GET', unfinished, { token: read })
  record('read permission opens saga list', response, 200,
    response.status === 200 && Array.isArray(response.data))
  const requestRoute = '/api/v1/admin/recovery/recoveries'
  response = await call(owner, 'POST', '/internal/v1/workflow/recoveries', { token: read,
    key: `uat-workflow-${stamp}-denied-request`,
    body: { subjectType: 'UAT', subjectId: sagaId, action: 'REOPEN', reason: 'permission probe' },
  })
  record('owner denies read-only recovery creation', response, 403, response.status === 403)
  response = await call(base, 'POST', `${requestRoute}/${missingSagaId}/execute`, { token: read,
    key: `uat-workflow-${stamp}-denied-command`, body: {},
  })
  record('read permission cannot execute', response, 403, response.status === 403)

  const command = await login('admin.recovery.command')
  response = await call(owner, 'GET', directUnfinished, { token: command })
  record('command permission cannot read', response, 403, response.status === 403)
  response = await call(owner, 'POST', '/internal/v1/workflow/recoveries', { token: command,
    key: `uat-workflow-${stamp}-denied-create`,
    body: { subjectType: 'UAT', subjectId: sagaId, action: 'REOPEN', reason: 'permission probe' },
  })
  record('command permission cannot create request', response, 403, response.status === 403)

  const missingRoute = `/api/v1/admin/recovery/sagas/${missingSagaId}/compensate`
  response = await call(base, 'POST', missingRoute, {
    key: `uat-workflow-${stamp}-anonymous`, body: {},
  })
  record('anonymous compensation denied', response, 401, response.status === 401)
  response = await call(base, 'POST', missingRoute, { token: command, body: {} })
  record('missing compensation key is 400', response, 400, response.status === 400)
  response = await call(base, 'POST', missingRoute, { token: command,
    key: `uat-workflow-${stamp}-missing-saga`, body: {},
  })
  record('unknown saga is 404', response, 404, response.status === 404)

  mysql(`INSERT INTO workflow_service.saga_instance
    (saga_id,saga_name,correlation_id,status,attempt_count,started_at)
    VALUES ('${sagaId}','UAT_WORKFLOW_SECURITY','${stamp}','COMPENSATING',0,UTC_TIMESTAMP(6));
    INSERT INTO workflow_service.saga_step
    (saga_id,step_name,step_order,status,compensation_name,compensation_state,attempt_count)
    VALUES ('${sagaId}','UAT_STEP',1,'COMPLETED','UAT_NO_TRANSPORT','PENDING',1);`)
  syntheticSagaInserted = true
  const route = `/api/v1/admin/recovery/sagas/${sagaId}/compensate`
  const key = `uat-workflow-${stamp}-compensate`
  const first = await call(base, 'POST', route, { token: command, key, body: {} })
  record('no transport stays failed', first, { status: 200, sagaStatus: 'COMPENSATION_FAILED' },
    first.status === 200 && first.data?.status === 'COMPENSATION_FAILED')
  const replay = await call(base, 'POST', route, { token: command, key, body: {} })
  record('same key replays saved response', replay, { status: 200, same: true },
    replay.status === 200 && isDeepStrictEqual(replay.data, first.data))
  const changedBodyDirect = await call(owner, 'POST',
    `/internal/v1/workflow/sagas/${sagaId}/compensate`,
    { token: command, key, body: { unexpected: true } })
  checks.push({ name: 'owner same-key changed-body status',
    observed: { status: changedBodyDirect.status, data: changedBodyDirect.data }, expected: 409,
    ok: changedBodyDirect.status === 409 })
  const changedBody = await call(base, 'POST', route,
    { token: command, key, body: { unexpected: true } })
  checks.push({ name: 'Gateway same-key changed-body status',
    observed: { status: changedBody.status, data: changedBody.data }, expected: 409,
    ok: changedBody.status === 409 })
  const changedDirect = await call(owner, 'POST',
    `/internal/v1/workflow/sagas/${missingSagaId}/compensate`, { token: command, key, body: {} })
  checks.push({ name: 'owner same-key different saga status',
    observed: { status: changedDirect.status, data: changedDirect.data }, expected: 409,
    ok: changedDirect.status === 409 })
  const changed = await call(base, 'POST', `/api/v1/admin/recovery/sagas/${missingSagaId}/compensate`,
    { token: command, key, body: {} })
  checks.push({ name: 'Gateway same-key different saga status',
    observed: { status: changed.status, data: changed.data }, expected: 409,
    ok: changed.status === 409 })
  const state = mysql(`SELECT CONCAT(s.status,':',t.compensation_state)
    FROM workflow_service.saga_instance s JOIN workflow_service.saga_step t ON t.saga_id=s.saga_id
    WHERE s.saga_id='${sagaId}'`)
  assert.equal(state, 'COMPENSATION_FAILED:FAILED')
  checks.push({ name: 'owner state remains failed', observed: state,
    expected: 'COMPENSATION_FAILED:FAILED', ok: true })
} catch (error) {
  failure = String(error?.message ?? error)
} finally {
  try { cleanupResult = cleanup() } catch (error) { failure = `${failure ?? ''}; cleanup: ${error?.message ?? error}` }
  const passed = checks.filter(check => check.ok).length
  const evidence = { scope: 'local Gateway and workflow owner permission/idempotency; synthetic data removed',
    capturedAt: new Date().toISOString(), result: !failure && passed === checks.length ? 'PASS' : 'FAIL',
    passed, total: checks.length, checks, cleanup: cleanupResult, failure }
  await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n')
  console.log(`workflow security ${passed}/${checks.length} ${evidence.result}`)
  if (failure) console.error(failure)
  if (evidence.result !== 'PASS') process.exitCode = 1
}
