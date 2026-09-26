/** Local-only B9 Gateway regression. Test credentials and tokens stay in memory. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const identifier = `uat-cas-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const contentCode = `uat-cas-${stamp}`
const gateway = 'http://127.0.0.1:18070'
const output = path.resolve('artifacts/uat-2026-09-23/content-cas-runtime.json')
const checks = []
const evidence = { scope: 'Local Gateway B9 content draft CAS and auto-validation idempotency, synthetic staff', contentCode, checks, cleanup: null }
let registered = false
let principalId = null

function mysql(sql) {
  return execFileSync('docker', [
    'exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1',
    'mysql', '-uroot', '--batch', '--skip-column-names', '-e', sql,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function record(name, observed, expected, ok) {
  checks.push({ name, observed, expected, ok })
  if (!ok) throw new Error(`${name}: observed ${JSON.stringify(observed)}, expected ${JSON.stringify(expected)}`)
}

async function call(method, pathname, { token, body, key } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (key) headers['Idempotency-Key'] = key
  const response = await fetch(`${gateway}${pathname}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, data: json?.data ?? null, meta: json?.meta ?? null, code: json?.error?.code ?? json?.code ?? null }
}

function cleanup() {
  assert.match(identifier, /^uat-cas-[a-z0-9]+@local\.invalid$/)
  assert.match(contentCode, /^uat-cas-[a-z0-9]+$/)
  if (principalId) assert.match(principalId, /^[0-9a-f-]{36}$/)
  const existing = Number(mysql(`SELECT COUNT(*) FROM content_service.content_definition WHERE content_code='${contentCode}'`))
  let removed = { definition: 0, versions: 0, receipts: 0 }
  if (existing) {
    assert.equal(existing, 1, 'unique test definition')
    const refs = mysql(`SELECT CONCAT(
      (SELECT COUNT(*) FROM content_service.content_public_projection WHERE content_id='${contentCode}'),':',
      (SELECT COUNT(*) FROM content_service.content_outbox_event WHERE aggregate_id='${contentCode}'),':',
      (SELECT COUNT(*) FROM content_service.scheduled_publish_task WHERE pack_code='${contentCode}'),':',
      (SELECT COUNT(*) FROM assessment_service.b10_assessment_session WHERE content_code='${contentCode}' OR alternative_content_code='${contentCode}'),':',
      (SELECT COUNT(*) FROM learning_service.learning_task WHERE content_id='${contentCode}'),':',
      (SELECT COUNT(*) FROM content_service.content_definition WHERE content_code='${contentCode}' AND current_published_version_id IS NOT NULL));`)
    assert.equal(refs, '0:0:0:0:0:0', 'draft has no downstream/published references')
    const owner = mysql(`SELECT created_by FROM content_service.content_definition WHERE content_code='${contentCode}'`)
    assert.equal(owner, principalId, 'only this synthetic staff owns probe')
    const result = mysql(`START TRANSACTION;
      DELETE FROM content_service.content_idempotency_record WHERE scope LIKE 'platform:${principalId}:content.%';
      SELECT CONCAT('receipts:',ROW_COUNT());
      DELETE FROM content_service.content_version WHERE content_id='${contentCode}';
      SELECT CONCAT('versions:',ROW_COUNT());
      DELETE FROM content_service.content_definition WHERE content_code='${contentCode}' AND created_by='${principalId}' AND current_published_version_id IS NULL;
      SELECT CONCAT('definition:',ROW_COUNT());
      COMMIT;`)
    removed = Object.fromEntries(result.split(/\r?\n/).filter(line => /^(receipts|versions|definition):\d+$/.test(line)).map(line => {
      const [key, value] = line.split(':'); return [key, Number(value)]
    }))
    assert.equal(removed.definition, 1)
  }
  const account = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
       SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
     WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions='' WHERE identifier='${identifier}';
    SELECT CONCAT(COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
    COMMIT;`)
  const activeSessions = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE'`))
  if (registered) assert.equal(account, '1:DISABLED')
  assert.equal(activeSessions, 0)
  return { removed, account, activeSessions }
}

try {
  const health = await fetch(`${gateway}/actuator/health/readiness`)
  assert.equal(health.status, 200)
  const device = { deviceType: 'WEB', clientVersion: 'uat-cas-1', deviceName: 'uat-cas' }
  const registration = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, key: `reg-${stamp}` })
  registered = registration.status === 201
  record('register', registration.status, 201, registered)
  principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principalId, /^[0-9a-f-]{36}$/)
  mysql(`UPDATE iam_service.iam_account SET roles='staff,content-editor', permissions='content:write,admin.content.read' WHERE identifier='${identifier}'`)
  const login = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, key: `login-${stamp}` })
  record('staff login', login.status, 200, login.status === 200)
  const token = login.data?.accessToken
  assert.equal(typeof token, 'string')

  const list1 = await call('GET', '/api/v1/admin/content-commands?pageSize=100', { token })
  record('list page 1', { status: list1.status, rows: list1.data?.length ?? null }, { status: 200, rows: 100 }, list1.status === 200 && list1.data?.length === 100)
  const cursor = list1.meta?.nextCursor
  record('list cursor', { hasMore: list1.meta?.hasMore, present: typeof cursor === 'string' }, { hasMore: true, present: true }, list1.meta?.hasMore === true && typeof cursor === 'string')
  if (cursor) {
    const list2 = await call('GET', `/api/v1/admin/content-commands?pageSize=100&cursor=${encodeURIComponent(cursor)}`, { token })
    record('list page 2', { status: list2.status, rows: list2.data?.length ?? null }, { status: 200, rows: 3 }, list2.status === 200 && list2.data?.length === 3)
  }

  const initial = { command: 'CREATE_DRAFT', contentCode, expectedStateVersion: 0,
    content: { contentType: 'COURSE_UNIT', title: 'UAT draft first revision', summary: 'Local regression only',
      contentLocale: 'en-US', targetLevel: 'A1', sourceCode: 'LOCAL_UAT', licenseCode: 'LOCAL_UAT_PENDING' } }
  const first = await call('POST', '/api/v1/admin/content-commands', { token, body: initial, key: `cas-${stamp}-create` })
  record('create draft', first.status, 202, first.status === 202)
  const replay = await call('POST', '/api/v1/admin/content-commands', { token, body: initial, key: `cas-${stamp}-create` })
  const replayFields = ['commandId', 'command', 'contentCode', 'contentVersionId', 'stateVersion', 'status', 'acceptedAt']
  const firstReceipt = Object.fromEntries(replayFields.map(field => [field, first.data?.[field] ?? null]))
  const replayReceipt = Object.fromEntries(replayFields.map(field => [field, replay.data?.[field] ?? null]))
  const sameReceipt = isDeepStrictEqual(firstReceipt, replayReceipt)
  record('same-key replay', { status: replay.status, sameReceipt, firstReceipt, replayReceipt }, { status: 202, sameReceipt: true }, replay.status === 202 && sameReceipt)
  const changed = await call('POST', '/api/v1/admin/content-commands', { token, body: { ...initial, content: { ...initial.content, title: 'Different request' } }, key: `cas-${stamp}-create` })
  record('different-body same-key conflict', { status: changed.status, code: changed.code }, { status: 409, code: 'IDEMPOTENCY_KEY_REUSE' }, changed.status === 409 && changed.code === 'IDEMPOTENCY_KEY_REUSE')

  const save = { command: 'SAVE_DRAFT', contentCode, expectedStateVersion: 1, targetVersionNumber: 1,
    content: { ...initial.content, title: 'UAT draft second revision' } }
  const second = await call('POST', '/api/v1/admin/content-commands', { token, body: save, key: `cas-${stamp}-save` })
  record('save version 2', second.status, 202, second.status === 202)
  const stale = await call('POST', '/api/v1/admin/content-commands', { token,
    body: { ...save, content: { ...save.content, title: 'Stale writer must lose' } }, key: `cas-${stamp}-stale` })
  record('stale save denied', { status: stale.status, code: stale.code }, { status: 409, code: 'VERSION_CONFLICT' }, stale.status === 409 && stale.code === 'VERSION_CONFLICT')
  const detail = await call('GET', `/api/v1/admin/content-commands/${contentCode}`, { token })
  record('detail after conflict', { status: detail.status, stateVersion: detail.data?.stateVersion }, { status: 200, stateVersion: 2 }, detail.status === 200 && detail.data?.stateVersion === 2)
  const validationBody = { contentCode }
  const noValidationKey = await call('POST', '/api/v1/admin/content-commands/validate/auto', { token, body: validationBody })
  record('validation requires idempotency key', noValidationKey.status, 400, noValidationKey.status === 400)
  const validationKey = `cas-${stamp}-validate`
  const validated = await call('POST', '/api/v1/admin/content-commands/validate/auto', { token, body: validationBody, key: validationKey })
  record('auto-validation report', { status: validated.status, ruleVersion: typeof validated.data?.ruleVersion, checkedAt: typeof validated.data?.checkedAt },
    { status: 200, ruleVersion: 'string', checkedAt: 'string' },
    validated.status === 200 && typeof validated.data?.ruleVersion === 'string' && typeof validated.data?.checkedAt === 'string')
  const validationReplay = await call('POST', '/api/v1/admin/content-commands/validate/auto', { token, body: validationBody, key: validationKey })
  record('auto-validation same-key report replay', { status: validationReplay.status, sameReport: isDeepStrictEqual(validationReplay.data, validated.data) },
    { status: 200, sameReport: true }, validationReplay.status === 200 && isDeepStrictEqual(validationReplay.data, validated.data))
  const validationConflict = await call('POST', '/api/v1/admin/content-commands/validate/auto', { token,
    body: { contentCode, content: { title: 'Changed validation request' } }, key: validationKey })
  record('auto-validation changed-body conflict', { status: validationConflict.status, code: validationConflict.code },
    { status: 409, code: 'IDEMPOTENCY_KEY_REUSE' },
    validationConflict.status === 409 && validationConflict.code === 'IDEMPOTENCY_KEY_REUSE')
  const validationReceipts = Number(mysql(`SELECT COUNT(*) FROM content_service.content_idempotency_record WHERE scope='platform:${principalId}:content.b9.validate'`))
  record('one durable validation receipt', validationReceipts, 1, validationReceipts === 1)
  const persisted = mysql(`SELECT CONCAT(COUNT(*),':',GROUP_CONCAT(version_no ORDER BY version_no),':',COUNT(DISTINCT content_version_id),':',COUNT(DISTINCT payload_hash)) FROM content_service.content_version WHERE content_id='${contentCode}'`)
  record('two immutable versions', persisted, '2:1,2:2:2', persisted === '2:1,2:2:2')
  const state = mysql(`SELECT CONCAT(state_version,':',COALESCE(current_published_version_id,'NONE')) FROM content_service.content_definition WHERE content_code='${contentCode}'`)
  record('definition revision unpublished', state, '2:NONE', state === '2:NONE')
  const listAgain = await call('GET', '/api/v1/admin/content-commands?pageSize=100', { token })
  record('list remains available', listAgain.status, 200, listAgain.status === 200)
  evidence.result = 'PASS'
} catch (error) {
  evidence.result = 'FAIL'
  evidence.failure = { name: error.name, message: String(error.message).slice(0, 350) }
  process.exitCode = 1
} finally {
  try { evidence.cleanup = cleanup() } catch (error) {
    evidence.cleanup = { error: String(error.message).slice(0, 350) }
    process.exitCode = 1
  }
  evidence.capturedAt = new Date().toISOString()
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify({ result: evidence.result, checks: checks.length, failure: evidence.failure ?? null, cleanup: evidence.cleanup, output }))
}
