import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  authRunId as runId,
  decodeJwtPayload,
  fail,
  gatewayRequest,
  registerAccount,
  expectStatus,
} from './lib/self-owned-jwt-auth.mjs'

const contentCode = 'course-b25-basics'
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32)

function mysqlQuery(schema, sql) {
  const container = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1'
  const result = spawnSync('docker', ['exec', container, 'mysql', '-uroot', '-proot-local-only', schema, '-N', '-B', '-e', sql], {
    encoding: 'utf8', windowsHide: true,
  })
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? '').trim().slice(0, 500) }
  return { ok: true, value: (result.stdout ?? '').trim() }
}

function json(body) { return { method: 'POST', body } }

function record(checks, name, result, expected = 200) {
  expectStatus(result, expected, name)
  checks.push({ name, status: 'PASS', httpStatus: result.status, requestId: result.requestId, traceId: result.traceId })
  return result
}

const identifier = `${runId}-learner@example.invalid`
const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`
const session = await registerAccount({ identifier, password, platform: 'ANDROID', runId })
const token = session.accessToken
const claims = decodeJwtPayload(token)
if (claims.iss !== 'http://127.0.0.1:18087' || claims.aud !== 'yuxuexing-api' || claims.token_type !== 'access') {
  fail('B32 IAM JWT claim validation failed', { issuer: claims.iss, audience: claims.aud, tokenType: claims.token_type })
}
const checks = []

const startKey = `${runId}-assessment-start`
const start = record(checks, 'assessment start', await gatewayRequest(token, '/api/v1/assessment/placement/start', {
  ...json({ contentCode }), operation: 'assessment-start', traceId, idempotencyKey: startKey,
}))
const replayStart = record(checks, 'assessment start replay', await gatewayRequest(token, '/api/v1/assessment/placement/start', {
  ...json({ contentCode }), operation: 'assessment-start-replay', traceId, idempotencyKey: startKey,
}))
const sessionId = start.body?.sessionId
if (!sessionId || sessionId !== replayStart.body?.sessionId) fail('assessment idempotency did not preserve session')

let current = start.body?.currentQuestion
let completed = null
for (let index = 0; index < 10 && current; index += 1) {
  const answer = Array.isArray(current.options) && current.options[0]?.key ? current.options[0].key : 'A'
  const step = record(checks, `assessment answer ${index + 1}`, await gatewayRequest(token, '/api/v1/assessment/placement/submit-step', {
    ...json({ sessionId, questionId: current.questionId, selectedKey: answer }), operation: `assessment-answer-${index + 1}`, traceId,
    idempotencyKey: `${runId}-answer-${index + 1}`,
  }))
  if (step.body?.isCompleted || step.body?.status === 'COMPLETED') { completed = step.body; break }
  current = step.body?.currentQuestion ?? step.body?.nextQuestion ?? null
}
if (!completed) fail('assessment did not complete from the durable question set')
const report = record(checks, 'assessment report', await gatewayRequest(token, `/api/v1/assessment/placement/report/${encodeURIComponent(sessionId)}`, { operation: 'assessment-report', traceId }))
if (!report.body?.reportId && !completed.report?.reportId) fail('assessment report id is missing')

record(checks, 'learning plan read', await gatewayRequest(token, '/api/v1/learning/plan/current', { operation: 'learning-plan', traceId }))
record(checks, 'learning SRS review', await gatewayRequest(token, '/api/v1/learning/srs/reviews', {
  ...json({ itemId: `${runId}-item`, quality: 5 }), operation: 'learning-review', traceId, idempotencyKey: `${runId}-review`,
}))
const reviewReplay = record(checks, 'learning SRS replay', await gatewayRequest(token, '/api/v1/learning/srs/reviews', {
  ...json({ itemId: `${runId}-item`, quality: 5 }), operation: 'learning-review-replay', traceId, idempotencyKey: `${runId}-review`,
}))
if (reviewReplay.body?.reviewCount !== 1 && reviewReplay.body?.status !== 'DUPLICATE') fail('learning SRS replay changed durable state', reviewReplay.body)
const overview = record(checks, 'learning SRS overview', await gatewayRequest(token, '/api/v1/learning/srs/overview', { operation: 'learning-overview', traceId }))
record(checks, 'learning daily summary', await gatewayRequest(token, '/api/v1/learning/stats/daily-summary', { operation: 'learning-summary', traceId }))

record(checks, 'notification preferences read', await gatewayRequest(token, '/api/v1/notifications/preferences', { operation: 'notification-preferences', traceId }))
const preference = record(checks, 'notification preference write', await gatewayRequest(token, '/api/v1/notifications/preferences/learning.review.due/IN_APP', {
  method: 'PUT', operation: 'notification-preference-write', traceId, idempotencyKey: `${runId}-preference`,
  body: { enabled: true, locale: 'zh-CN', expectedVersion: -1 },
}))
const preferenceReplay = record(checks, 'notification preference replay', await gatewayRequest(token, '/api/v1/notifications/preferences/learning.review.due/IN_APP', {
  method: 'PUT', operation: 'notification-preference-replay', traceId, idempotencyKey: `${runId}-preference`,
  body: { enabled: true, locale: 'zh-CN', expectedVersion: -1 },
}))
if (preference.body?.version !== preferenceReplay.body?.version) fail('notification preference replay changed version')
const message = record(checks, 'notification message write', await gatewayRequest(token, '/api/v1/notifications/messages', {
  ...json({ notificationType: 'learning.review.due', channel: 'IN_APP', templateKey: 'local.review.due', templateVersion: 'v1',
    title: 'B32 local review', safeBody: 'A durable local review reminder.', contentVersion: 'b32-v1' }),
  operation: 'notification-message', traceId, idempotencyKey: `${runId}-message`,
}))
if (!message.body?.messageId) fail('notification message id is missing')
record(checks, 'notification messages read', await gatewayRequest(token, '/api/v1/notifications/messages', { operation: 'notification-messages', traceId }))

const db = {
  assessmentSessions: mysqlQuery('assessment_service', `SELECT COUNT(*) FROM b25_assessment_session WHERE principal_id='${session.subject}' AND idempotency_key LIKE '${runId}%'`),
  assessmentReports: mysqlQuery('assessment_service', `SELECT COUNT(*) FROM b25_assessment_report WHERE principal_id='${session.subject}'`),
  learningReviews: mysqlQuery('learning_service', `SELECT COUNT(*) FROM b25_learning_review WHERE principal_id='${session.subject}' AND idempotency_key LIKE '${runId}%'`),
  learningSrs: mysqlQuery('learning_service', `SELECT COUNT(*) FROM b25_learning_srs_state WHERE principal_id='${session.subject}' AND item_id='${runId}-item'`),
  notificationPreferences: mysqlQuery('notification_service', `SELECT COUNT(*) FROM notification_preference WHERE principal_id='${session.subject}' AND notification_type='learning.review.due'`),
  notificationMessages: mysqlQuery('notification_service', `SELECT COUNT(*) FROM notification_message WHERE subject_id='${session.subject}'`),
  notificationOutbox: mysqlQuery('notification_service', `SELECT COUNT(*) FROM notification_outbox_event WHERE principal_id='${session.subject}' AND request_id LIKE '${runId}%'`),
}
for (const [name, result] of Object.entries(db)) if (!result.ok) fail(`B32 MySQL evidence query failed: ${name}`, result.error)
const dbValues = Object.fromEntries(Object.entries(db).map(([name, result]) => [name, Number(result.value)]))
if (dbValues.assessmentSessions !== 1 || dbValues.assessmentReports !== 1 || dbValues.learningReviews !== 1
  || dbValues.learningSrs !== 1 || dbValues.notificationPreferences !== 1 || dbValues.notificationMessages !== 1 || dbValues.notificationOutbox < 1) fail('B32 MySQL domain evidence is incomplete', dbValues)
if (overview.body?.total < 1) fail('learning overview did not reflect the durable SRS state')
console.log(JSON.stringify({ result: 'PASS', runId, subjectBound: true, tokenValuesEmitted: false, credentialsPersisted: false, claims: { issuer: claims.iss, audience: claims.aud, tokenType: claims.token_type }, checks, db: dbValues }, null, 2))
