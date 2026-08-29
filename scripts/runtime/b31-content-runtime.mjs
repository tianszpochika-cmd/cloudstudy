import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  authRunId as runId,
  decodeJwtPayload,
  fail,
  gatewayRequest,
  loginAccount,
  expectStatus,
} from './lib/self-owned-jwt-auth.mjs'

const contentCode = `b31-live-${Date.now().toString(36)}`
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32)

function commandBody(command, extra = {}) { return { command, contentCode, ...extra } }

function mysqlQuery(sql) {
  const container = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1'
  const result = spawnSync('docker', [
    'exec', container, 'mysql', '-usvc_content', '-plocal-owner-only', 'content_service', '-N', '-B', '-e', sql,
  ], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? '').trim().slice(0, 500) }
  return { ok: true, value: (result.stdout ?? '').trim() }
}

function requiredCredential(name) {
  const value = process.env[name]
  if (!value) fail(`B31 content runtime requires pre-provisioned IAM credential ${name}`)
  return value
}

async function main() {
  // Roles and permissions are IAM-owned account facts. This runner only logs in
  // with pre-provisioned test accounts and never submits authority overrides.
  const accounts = {
    editor: { identifier: process.env.B31_EDITOR_IDENTIFIER ?? 'b31-editor@example.invalid', password: requiredCredential('B31_EDITOR_PASSWORD') },
    reviewer1: { identifier: process.env.B31_REVIEWER1_IDENTIFIER ?? 'b31-reviewer1@example.invalid', password: requiredCredential('B31_REVIEWER1_PASSWORD') },
    reviewer2: { identifier: process.env.B31_REVIEWER2_IDENTIFIER ?? 'b31-reviewer2@example.invalid', password: requiredCredential('B31_REVIEWER2_PASSWORD') },
    publisher: { identifier: process.env.B31_PUBLISHER_IDENTIFIER ?? 'b31-publisher@example.invalid', password: requiredCredential('B31_PUBLISHER_PASSWORD') },
  }
  const sessions = {}
  for (const [name, account] of Object.entries(accounts)) {
    sessions[name] = await loginAccount({ ...account, platform: 'ANDROID', runId: `${runId}-${name}` })
  }
  const claims = Object.fromEntries(Object.entries(sessions).map(([name, session]) => [name, decodeJwtPayload(session.accessToken)]))
  for (const [name, claim] of Object.entries(claims)) {
    if (claim.iss !== 'http://127.0.0.1:18087' || claim.aud !== 'yuxuexing-api' || claim.token_type !== 'access') {
      fail(`IAM JWT claims invalid for ${name}`, { issuer: claim.iss, audience: claim.aud, tokenType: claim.token_type })
    }
  }
  const tokens = Object.fromEntries(Object.entries(sessions).map(([name, session]) => [name, session.accessToken]))
  const checks = []
  const record = (name, result, expected) => {
    expectStatus(result, expected, name)
    checks.push({ name, status: 'PASS', httpStatus: result.status, requestId: result.requestId, traceId: result.traceId })
    return result
  }
  const content = {
    contentType: 'COURSE_UNIT',
    title: 'B31 本地真实内容',
    summary: '由后台内容命令写入 MySQL，再从学习端读取。',
    contentLocale: 'en-US',
    targetLevel: 'A1',
    sourceCode: 'LOCAL_B31_SOURCE',
    licenseCode: 'LOCAL_DEV_LICENSE',
    items: [{ itemCode: `${contentCode}:item-1`, itemType: 'PHRASE', displayOrder: 0, displayText: 'This item is served from MySQL.' }],
  }
  record('create draft', await gatewayRequest(tokens.editor, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'create', traceId, idempotencyKey: `${runId}-create`, body: commandBody('CREATE_DRAFT', { content }),
  }), 202)
  record('submit review', await gatewayRequest(tokens.editor, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'submit', traceId, idempotencyKey: `${runId}-submit`, body: commandBody('SUBMIT_REVIEW', { targetVersionNumber: 1 }),
  }), 202)
  record('first review', await gatewayRequest(tokens.reviewer1, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'review1', traceId, idempotencyKey: `${runId}-review1`, body: commandBody('REVIEW_FIRST', { targetVersionNumber: 1, reviewDecision: 'APPROVED' }),
  }), 202)
  record('final review', await gatewayRequest(tokens.reviewer2, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'review2', traceId, idempotencyKey: `${runId}-review2`, body: commandBody('REVIEW_FINAL', { targetVersionNumber: 1, reviewDecision: 'APPROVED' }),
  }), 202)
  const published = record('publish', await gatewayRequest(tokens.publisher, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'publish', traceId, idempotencyKey: `${runId}-publish`, body: commandBody('PUBLISH', { targetVersionNumber: 1 }),
  }), 202)
  const replay = record('publish replay', await gatewayRequest(tokens.publisher, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'publish-replay', traceId, idempotencyKey: `${runId}-publish`, body: commandBody('PUBLISH', { targetVersionNumber: 1 }),
  }), 202)
  const catalog = record('learner catalog reads published content', await gatewayRequest(tokens.editor, `/api/v1/content/learner/catalog?contentLocale=en-US&targetLevel=A1`, { operation: 'catalog', traceId }), 200)
  const learnerContent = record('learner content reads same version', await gatewayRequest(tokens.editor, `/api/v1/content/learner/${encodeURIComponent(contentCode)}`, { operation: 'content', traceId }), 200)
  record('unpublish', await gatewayRequest(tokens.publisher, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'unpublish', traceId, idempotencyKey: `${runId}-unpublish`, body: commandBody('UNPUBLISH', { targetVersionNumber: 1 }),
  }), 202)
  const afterUnpublish = await gatewayRequest(tokens.editor, `/api/v1/content/learner/${encodeURIComponent(contentCode)}`, { operation: 'after-unpublish', traceId })
  expectStatus(afterUnpublish, 404, 'learner content is unavailable after unpublish')
  checks.push({ name: 'unpublish reflected by learner read', status: 'PASS', httpStatus: afterUnpublish.status, requestId: afterUnpublish.requestId, traceId: afterUnpublish.traceId })

  const db = {
    definition: mysqlQuery(`SELECT COUNT(*) FROM content_definition WHERE content_code='${contentCode}'`),
    versions: mysqlQuery(`SELECT COUNT(*) FROM content_version v JOIN content_definition d ON d.content_id=v.content_id WHERE d.content_code='${contentCode}'`),
    projectionsAfterUnpublish: mysqlQuery(`SELECT COUNT(*) FROM content_public_projection WHERE content_id='${contentCode}'`),
    outbox: mysqlQuery(`SELECT COUNT(*) FROM content_outbox_event WHERE request_id LIKE '${runId}%'`),
    idempotency: mysqlQuery(`SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key LIKE '${runId}%'`),
  }
  for (const [name, result] of Object.entries(db)) if (!result.ok) fail(`MySQL evidence query failed: ${name}`, result.error)
  const dbValues = Object.fromEntries(Object.entries(db).map(([name, result]) => [name, Number(result.value)]))
  if (dbValues.definition !== 1 || dbValues.versions !== 1 || dbValues.projectionsAfterUnpublish !== 0 || dbValues.outbox < 7 || dbValues.idempotency < 6) fail('B31 MySQL lifecycle evidence is incomplete', dbValues)
  const publishedCode = published.body?.data?.contentCode ?? contentCode
  const publishedVersion = learnerContent.body?.data?.contentVersionId ?? learnerContent.body?.data?.content?.contentVersionId ?? null
  const replayCommandId = replay.body?.data?.commandId ?? null
  const firstCommandId = published.body?.data?.commandId ?? null
  const result = {
    result: 'PASS', runId, contentCode: publishedCode, publishedVersion,
    idempotentReplay: Boolean(firstCommandId && replayCommandId && firstCommandId === replayCommandId),
    catalogContainsContent: Boolean(catalog.body?.data?.data?.items?.some?.(item => item.contentCode === contentCode) || catalog.body?.data?.items?.some?.(item => item.contentCode === contentCode)),
    learnerSource: learnerContent.body?.source ?? learnerContent.body?.data?.source ?? 'mysql',
    db: dbValues, checks, credentialsPersisted: false, tokenValuesEmitted: false,
  }
  if (!result.idempotentReplay || !result.catalogContainsContent) fail('B31 API/read/idempotency assertions failed', result)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', runId, message: error.message, details: error.details ?? null }, null, 2))
  process.exitCode = 1
})
