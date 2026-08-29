import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  authRunId,
  decodeJwtPayload,
  expectStatus,
  fail,
  gatewayRequest,
  registerAccount,
} from './lib/self-owned-jwt-auth.mjs'

const gateway = process.env.B35_GATEWAY ?? 'http://127.0.0.1:18070'
const runId = process.env.B35_AUTHZ_RUN_ID ?? `b35-authz-${authRunId}`
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32)
const mysqlContainer = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1'

function dataOf(body) { return body?.data?.data ?? body?.data ?? body ?? {} }
function sqlString(value) { return `'${String(value).replaceAll("'", "''")}'` }

function mysqlNumber(schema, sql) {
  const result = spawnSync('docker', ['exec', mysqlContainer, 'mysql', '-uroot', '-proot-local-only', schema, '-N', '-B', '-e', sql], {
    encoding: 'utf8', windowsHide: true,
  })
  if (result.status !== 0) fail('MySQL owner evidence query failed')
  const value = Number((result.stdout ?? '').trim())
  if (!Number.isFinite(value)) fail('MySQL owner evidence was not numeric')
  return value
}

function record(checks, name, result, status) {
  expectStatus(result, status, name)
  if (!result.requestId || !result.traceId) fail(`${name}: request/trace correlation missing`)
  checks.push({ name, status: 'PASS', httpStatus: result.status, requestId: result.requestId, traceId: result.traceId })
  return result
}

const checks = []
const aliceIdentifier = `${runId}-alice@example.invalid`
const bobIdentifier = `${runId}-bob@example.invalid`
const alice = await registerAccount({ identifier: aliceIdentifier, password: `${crypto.randomBytes(18).toString('base64url')}Aa9!`, platform: 'ANDROID', runId: `${runId}-alice`, })
const bob = await registerAccount({ identifier: bobIdentifier, password: `${crypto.randomBytes(18).toString('base64url')}Aa9!`, platform: 'ANDROID', runId: `${runId}-bob`, })
const aliceClaims = decodeJwtPayload(alice.accessToken)
const bobClaims = decodeJwtPayload(bob.accessToken)
if (aliceClaims.aud !== 'yuxuexing-api' || bobClaims.aud !== 'yuxuexing-api' || aliceClaims.token_type !== 'access' || bobClaims.token_type !== 'access') {
  fail('self-owned JWT audience or token type is invalid')
}

const aliceProfile = record(checks, 'alice owner write', await gatewayRequest(alice.accessToken, '/api/v1/learner/profile', {
  origin: gateway, method: 'PATCH', operation: 'alice-profile', traceId, idempotencyKey: `${runId}-alice-profile`,
  body: { expectedStateVersion: 0, uiLocale: 'en-US', contentLocale: 'en-US', timezone: 'UTC' },
}), 200)
const aliceTarget = record(checks, 'alice target write', await gatewayRequest(alice.accessToken, '/api/v1/learner/targets', {
  origin: gateway, method: 'PUT', operation: 'alice-target', traceId, idempotencyKey: `${runId}-alice-target`,
  body: { expectedStateVersion: 0, goalCode: 'WORKPLACE', targetLevel: 'A1', dailyQuotaMinutes: 15, status: 'ACTIVE' },
}), 200)

const bobProfile = record(checks, 'cross-user profile isolation', await gatewayRequest(bob.accessToken, '/api/v1/learner/profile', {
  origin: gateway, operation: 'bob-profile-read', traceId,
}), 200)
const bobProfileData = dataOf(bobProfile.body)
if (bobProfileData.principalId === alice.subject || bobProfileData.principal_id === alice.subject) fail('bob profile resolved to alice subject')
if ((bobProfileData.uiLocale ?? bobProfileData.ui_locale) === 'en-US') fail('bob profile inherited alice preference')

const bobTarget = await gatewayRequest(bob.accessToken, '/api/v1/learner/targets', { origin: gateway, operation: 'bob-target-read-before-write', traceId })
expectStatus(bobTarget, 404, 'cross-user target isolation')
checks.push({ name: 'cross-user target isolation', status: 'PASS', httpStatus: bobTarget.status, requestId: bobTarget.requestId, traceId: bobTarget.traceId })

const forged = record(checks, 'forged owner/tenant/role headers ignored', await gatewayRequest(bob.accessToken, '/api/v1/learner/profile', {
  origin: gateway, operation: 'bob-forged-owner-header', traceId,
  headers: { 'x-owner-id': alice.subject, 'x-tenant-id': 'tenant-attacker', 'x-role': 'admin', 'x-b5-role': 'admin', 'x-permission': 'admin.content.write' },
}), 200)
const forgedData = dataOf(forged.body)
if ((forgedData.principalId ?? forgedData.principal_id) === alice.subject) fail('forged owner header changed resolved subject')

const learnerAdmin = await gatewayRequest(bob.accessToken, '/api/v1/admin/content-commands', {
  origin: gateway, method: 'POST', operation: 'learner-admin-forbidden', traceId, idempotencyKey: `${runId}-forbidden-admin`,
  body: { command: 'CREATE_DRAFT', contentCode: `${runId}-forbidden-content`, content: { contentType: 'COURSE_UNIT', title: 'B35 authorization negative probe', summary: 'This command must be rejected before any owner write.', contentLocale: 'en-US', targetLevel: 'A1', sourceCode: 'B35_AUTHZ_NEGATIVE', licenseCode: 'LOCAL_DEV_LICENSE', items: [] } },
})
expectStatus(learnerAdmin, 403, 'valid learner token receives admin 403')
checks.push({ name: 'valid learner token receives admin 403', status: 'PASS', httpStatus: learnerAdmin.status, requestId: learnerAdmin.requestId, traceId: learnerAdmin.traceId })

const db = {
  aliceProfile: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_profile WHERE principal_id=${sqlString(alice.subject)} AND ui_locale='en-US' AND timezone='UTC'`),
  aliceGoal: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_goal WHERE principal_id=${sqlString(alice.subject)} AND goal_code='WORKPLACE'`),
  bobProfile: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_profile WHERE principal_id=${sqlString(bob.subject)}`),
  bobGoal: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_goal WHERE principal_id=${sqlString(bob.subject)}`),
}
if (db.aliceProfile !== 1 || db.aliceGoal !== 1 || db.bobProfile !== 0 || db.bobGoal !== 0) fail('owner facts were not isolated as expected', db)
console.log(JSON.stringify({ result: 'PASS', runId, checks, db, claims: { audience: 'yuxuexing-api', tokenType: 'access' }, subjectValuesEmitted: false, tokenValuesEmitted: false, credentialsPersisted: false }, null, 2))
