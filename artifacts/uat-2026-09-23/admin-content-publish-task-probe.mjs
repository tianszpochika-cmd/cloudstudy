/** Local-only, single-route runtime probe. Secrets remain in process memory. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const identifier = `uat-publish-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const contentCode = `uat-publish-${stamp}`
const missingTaskId = `spt_uat_missing_${stamp}`
const base = 'http://127.0.0.1:18070'
const owner = 'http://127.0.0.1:18089'
const output = path.resolve('artifacts/uat-2026-09-23/admin-content-publish-task-runtime.json')
const evidence = { scope: 'GET /api/v1/admin/content-publish-tasks/{taskId}', account: identifier,
  contentCode, missingTaskId, capturedAt: null, checks: [], cleanup: null, result: 'PARTIAL' }
let registered = false
let principalId = null
let createdTaskId = null

function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '--batch', '--skip-column-names', '-e', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function check(name, observed, expected, ok) {
  evidence.checks.push({ name, observed, expected, ok })
  if (!ok) throw new Error(`${name}: ${JSON.stringify(observed)} != ${JSON.stringify(expected)}`)
}

async function request(host, method, pathname, { token, body, key } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (key) headers['Idempotency-Key'] = key
  const response = await fetch(`${host}${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, data: json?.data ?? null,
    code: json?.error?.code ?? json?.code ?? null,
    requestIdPresent: Boolean(response.headers.get('x-request-id')),
    traceIdPresent: Boolean(response.headers.get('x-trace-id')) }
}

function cleanup() {
  assert.match(identifier, /^uat-publish-[a-z0-9]+@local\.invalid$/)
  assert.match(contentCode, /^uat-publish-[a-z0-9]+$/)
  if (principalId) assert.match(principalId, /^[0-9a-f-]{36}$/)
  const result = { taskRowsRemoved: 0, draftVersionsRemoved: 0, draftDefinitionsRemoved: 0,
    idempotencyRowsRemoved: 0, accountDisabled: false, activeSessions: null, residualTaskRows: null, errors: [] }

  // A task may exist even when an HTTP response was lost. Discover only this unique synthetic owner+pack.
  if (principalId) {
    try {
      const rows = mysql(`SELECT CONCAT(task_id,'|',status,'|',target_type,'|',target_ref,'|',created_by)
        FROM content_service.scheduled_publish_task WHERE pack_code='${contentCode}' AND created_by='${principalId}'`)
      const taskRows = rows ? rows.split(/\r?\n/) : []
      assert.ok(taskRows.length <= 1, 'only one synthetic scheduled task expected')
      if (taskRows.length) {
        const [taskId, status, targetType, targetRef, createdBy] = taskRows[0].split('|')
        assert.match(taskId, /^spt_[0-9a-f]{12}$/)
        assert.equal(status, 'SCHEDULED')
        assert.equal(targetType, 'PACK')
        assert.equal(targetRef, contentCode)
        assert.equal(createdBy, principalId)
        if (createdTaskId) assert.equal(taskId, createdTaskId)
        result.taskRowsRemoved = Number(mysql(`DELETE FROM content_service.scheduled_publish_task
          WHERE task_id='${taskId}' AND pack_code='${contentCode}' AND target_ref='${contentCode}'
          AND created_by='${principalId}' AND status='SCHEDULED'; SELECT ROW_COUNT();`))
        assert.equal(result.taskRowsRemoved, 1)
      }
      result.residualTaskRows = Number(mysql(`SELECT COUNT(*) FROM content_service.scheduled_publish_task
        WHERE pack_code='${contentCode}' AND created_by='${principalId}'`))
      assert.equal(result.residualTaskRows, 0)
    } catch (error) { result.errors.push(`task cleanup: ${String(error.message).slice(0, 250)}`) }

    try {
      const definition = mysql(`SELECT CONCAT(created_by,'|',COALESCE(current_published_version_id,'NONE'))
        FROM content_service.content_definition WHERE content_code='${contentCode}'`)
      if (definition) {
        assert.equal(definition, `${principalId}|NONE`, 'only unpublished synthetic draft may be deleted')
        const refs = mysql(`SELECT CONCAT(
          (SELECT COUNT(*) FROM content_service.content_public_projection WHERE content_id='${contentCode}'),':',
          (SELECT COUNT(*) FROM content_service.content_outbox_event WHERE aggregate_id='${contentCode}'),':',
          (SELECT COUNT(*) FROM content_service.scheduled_publish_task WHERE pack_code='${contentCode}'),':',
          (SELECT COUNT(*) FROM assessment_service.b10_assessment_session WHERE content_code='${contentCode}' OR alternative_content_code='${contentCode}'),':',
          (SELECT COUNT(*) FROM learning_service.learning_task WHERE content_id='${contentCode}'));`)
        assert.equal(refs, '0:0:0:0:0', 'synthetic draft must have no downstream references')
        const deleted = mysql(`START TRANSACTION;
          DELETE FROM content_service.content_idempotency_record
           WHERE scope LIKE 'platform:${principalId}:%'; SELECT CONCAT('receipts:',ROW_COUNT());
          DELETE FROM content_service.content_version WHERE content_id='${contentCode}';
          SELECT CONCAT('versions:',ROW_COUNT());
          DELETE FROM content_service.content_definition WHERE content_code='${contentCode}'
            AND created_by='${principalId}' AND current_published_version_id IS NULL;
          SELECT CONCAT('definition:',ROW_COUNT()); COMMIT;`)
        const values = Object.fromEntries(deleted.split(/\r?\n/).filter(x => /^(receipts|versions|definition):\d+$/.test(x))
          .map(x => { const [key, value] = x.split(':'); return [key, Number(value)] }))
        result.idempotencyRowsRemoved = values.receipts ?? 0
        result.draftVersionsRemoved = values.versions ?? 0
        result.draftDefinitionsRemoved = values.definition ?? 0
        assert.equal(result.draftDefinitionsRemoved, 1)
      }
    } catch (error) { result.errors.push(`draft cleanup: ${String(error.message).slice(0, 250)}`) }
  }

  try {
    const account = mysql(`START TRANSACTION;
      UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
        SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
        WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
      UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions=''
        WHERE identifier='${identifier}';
      SELECT CONCAT(COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account
        WHERE identifier='${identifier}'; COMMIT;`)
    result.accountDisabled = account === '1:DISABLED'
    result.activeSessions = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_session s
      JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
      WHERE a.identifier='${identifier}' AND s.status='ACTIVE'`))
    if (registered) assert.equal(result.accountDisabled, true)
    assert.equal(result.activeSessions, 0)
  } catch (error) { result.errors.push(`IAM cleanup: ${String(error.message).slice(0, 250)}`) }
  return result
}

try {
  const health = await request(base, 'GET', '/actuator/health/readiness')
  check('gateway readiness', health.status, 200, health.status === 200)
  const ownerHealth = await request(owner, 'GET', '/actuator/health/readiness')
  check('content owner readiness', ownerHealth.status, 200, ownerHealth.status === 200)

  const taskPath = `/api/v1/admin/content-publish-tasks/${missingTaskId}`
  const anonymous = await request(base, 'GET', taskPath)
  check('anonymous exact route', { status: anonymous.status, code: anonymous.code },
    { status: 401 }, anonymous.status === 401)

  const device = { deviceType: 'WEB', clientVersion: 'uat-publish-1', deviceName: 'uat-publish' }
  const registration = await request(base, 'POST', '/api/v1/auth/register',
    { body: { identifier, password, device }, key: `reg-${stamp}` })
  registered = registration.status === 201
  check('register isolated synthetic account', registration.status, 201, registered)
  principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principalId, /^[0-9a-f-]{36}$/)
  const learnerToken = registration.data?.accessToken
  assert.equal(typeof learnerToken, 'string')
  const unauthorized = await request(base, 'GET', taskPath, { token: learnerToken })
  check('learner lacks content-admin permission', { status: unauthorized.status, code: unauthorized.code },
    { status: 403 }, unauthorized.status === 403)

  // Privileges are granted solely to this disposable account, then encoded in a fresh IAM JWT.
  mysql(`UPDATE iam_service.iam_account SET roles='staff,content-editor,content-publisher',
    permissions='content:write,content:publish,admin.content.read' WHERE identifier='${identifier}'`)
  const login = await request(base, 'POST', '/api/v1/auth/login',
    { body: { identifier, password, device }, key: `login-${stamp}` })
  check('synthetic content staff login', login.status, 200, login.status === 200)
  const staffToken = login.data?.accessToken
  assert.equal(typeof staffToken, 'string')

  const missing = await request(base, 'GET', taskPath, { token: staffToken })
  check('authorized nonexistent task via gateway', { status: missing.status, code: missing.code },
    { status: 404, code: 'SCHEDULE_NOT_FOUND' },
    missing.status === 404 && missing.code === 'SCHEDULE_NOT_FOUND')
  const missingOwner = await request(owner, 'GET',
    `/internal/v1/content/admin-commands/publish-tasks/${missingTaskId}`, { token: staffToken })
  check('same nonexistent task at content owner', { status: missingOwner.status, code: missingOwner.code },
    { status: 404, code: 'SCHEDULE_NOT_FOUND' },
    missingOwner.status === 404 && missingOwner.code === 'SCHEDULE_NOT_FOUND')

  const draft = await request(base, 'POST', '/api/v1/admin/content-commands', { token: staffToken,
    key: `draft-${stamp}`, body: { command: 'CREATE_DRAFT', contentCode, expectedStateVersion: 0,
      content: { contentType: 'COURSE_UNIT', title: 'UAT isolated publish-task draft',
        summary: 'Temporary route verification draft', contentLocale: 'en-US', targetLevel: 'A1',
        sourceCode: 'LOCAL_UAT', licenseCode: 'LOCAL_UAT_PENDING' } } })
  check('create isolated unpublished draft', draft.status, 202, draft.status === 202)
  const draftOwner = mysql(`SELECT CONCAT(created_by,'|',COALESCE(current_published_version_id,'NONE'))
    FROM content_service.content_definition WHERE content_code='${contentCode}'`)
  check('draft owner and unpublished state', draftOwner, `${principalId}|NONE`, draftOwner === `${principalId}|NONE`)

  const scheduledAt = '2035-01-01T00:00:00Z'
  const scheduled = await request(base, 'POST', '/api/v1/admin/content-commands', { token: staffToken,
    key: `schedule-${stamp}`, body: { command: 'SCHEDULE_PUBLISH', contentCode, targetType: 'PACK',
      expectedStateVersion: 1, reasonCode: 'LOCAL_UAT_ROUTE_PROBE', schedule: { scheduledAt } } })
  createdTaskId = scheduled.data?.scheduledPublishTaskId ?? null
  check('schedule synthetic far-future task', { status: scheduled.status, taskId: createdTaskId,
    statusField: scheduled.data?.scheduleStatus }, { status: 202, statusField: 'SCHEDULED' },
    scheduled.status === 202 && /^spt_[0-9a-f]{12}$/.test(createdTaskId ?? '')
      && scheduled.data?.scheduleStatus === 'SCHEDULED')
  const persisted = mysql(`SELECT CONCAT(tenant_id,'|',pack_code,'|',target_type,'|',target_ref,'|',status,'|',created_by)
    FROM content_service.scheduled_publish_task WHERE task_id='${createdTaskId}'`)
  check('content owner durable task facts', persisted,
    `platform|${contentCode}|PACK|${contentCode}|SCHEDULED|${principalId}`,
    persisted === `platform|${contentCode}|PACK|${contentCode}|SCHEDULED|${principalId}`)

  const routed = await request(base, 'GET', `/api/v1/admin/content-publish-tasks/${createdTaskId}`,
    { token: staffToken })
  const expectedFields = { taskId: createdTaskId, packCode: contentCode, targetType: 'PACK',
    targetRef: contentCode, status: 'SCHEDULED', createdBy: principalId }
  const actualFields = Object.fromEntries(Object.keys(expectedFields).map(x => [x, routed.data?.[x] ?? null]))
  check('positive GET through Gateway', { status: routed.status, fields: actualFields,
    requestIdPresent: routed.requestIdPresent, traceIdPresent: routed.traceIdPresent },
    { status: 200, fields: expectedFields },
    routed.status === 200 && Object.keys(expectedFields).every(x => actualFields[x] === expectedFields[x]))
  const direct = await request(owner, 'GET',
    `/internal/v1/content/admin-commands/publish-tasks/${createdTaskId}`, { token: staffToken })
  const directFields = Object.fromEntries(Object.keys(expectedFields).map(x => [x, direct.data?.[x] ?? null]))
  check('Gateway response matches content owner', { status: direct.status, fields: directFields },
    { status: 200, fields: expectedFields },
    direct.status === 200 && Object.keys(expectedFields).every(x => directFields[x] === expectedFields[x]))
  evidence.result = 'PASS'
} catch (error) {
  evidence.failure = { name: error.name, message: String(error.message).slice(0, 350) }
} finally {
  evidence.cleanup = cleanup()
  if (evidence.cleanup.errors.length || !evidence.cleanup.accountDisabled || evidence.cleanup.activeSessions !== 0
    || evidence.cleanup.residualTaskRows !== 0) evidence.result = 'FAIL_CLEANUP'
  evidence.capturedAt = new Date().toISOString()
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify({ result: evidence.result, checks: evidence.checks.length,
    failure: evidence.failure ?? null, cleanup: evidence.cleanup, output }))
  if (evidence.result !== 'PASS') process.exitCode = 1
}
