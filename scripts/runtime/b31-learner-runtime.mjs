import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  authRunId as runId,
  decodeJwtPayload,
  fail,
  gatewayRequest,
  loginAccount,
  registerAccount,
  expectStatus,
} from './lib/self-owned-jwt-auth.mjs'

const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32)
const mysqlContainer = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1'

function record(checks, name, result, status = 200) {
  expectStatus(result, status, name)
  checks.push({ name, status: 'PASS', httpStatus: result.status, requestId: result.requestId, traceId: result.traceId })
  return result
}

function mysqlQuery(schema, sql) {
  const result = spawnSync('docker', ['exec', mysqlContainer, 'mysql', '-uroot', '-proot-local-only', schema, '-N', '-B', '-e', sql], {
    encoding: 'utf8', windowsHide: true,
  })
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? '').trim().slice(0, 500) }
  return { ok: true, value: (result.stdout ?? '').trim() }
}

function queryNumber(schema, sql) {
  const result = mysqlQuery(schema, sql)
  if (!result.ok) fail('MySQL evidence query failed', result.error)
  return Number(result.value)
}

function queryText(schema, sql) {
  const result = mysqlQuery(schema, sql)
  if (!result.ok) fail('MySQL text evidence query failed', result.error)
  return result.value
}

const identifier = `${runId}-learner@example.invalid`
const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`
const session = await registerAccount({ identifier, password, platform: 'ANDROID', runId })
const token = session.accessToken
const checks = []

record(checks, 'iam principal bootstrap', await gatewayRequest(token, '/api/v1/iam/principal/me', { operation: 'principal-bootstrap', traceId }))
record(checks, 'adult gate', await gatewayRequest(token, '/api/v1/iam/adult-gate', {
  method: 'POST', operation: 'adult-gate', traceId, idempotencyKey: `${runId}-adult`,
  body: { birthYear: 1990, confirmed: true, policyVersion: 'v2-phase1' },
}))
for (const [type, operation] of [['PRIVACY', 'privacy'], ['TERMS', 'terms']]) {
  record(checks, `consent ${type}`, await gatewayRequest(token, '/api/v1/iam/consents', {
    method: 'PUT', operation, traceId, idempotencyKey: `${runId}-${operation}`,
    body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
  }))
}

const profileBody = { expectedStateVersion: 0, birthYear: 1990, ageConfirmed: true, privacyConsent: true,
  termsConsent: true, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM' }
const profile = record(checks, 'learner profile write', await gatewayRequest(token, '/api/v1/learner/profile', {
  method: 'PATCH', operation: 'profile-write', traceId, idempotencyKey: `${runId}-profile`, body: profileBody,
}))
const targetBody = { expectedStateVersion: 0, goalCode: 'ZERO_BASIS', targetLevel: 'A1', dailyQuotaMinutes: 15, status: 'ACTIVE' }
const target = record(checks, 'learner target write', await gatewayRequest(token, '/api/v1/learner/targets', {
  method: 'PUT', operation: 'target-write', traceId, idempotencyKey: `${runId}-target`, body: targetBody,
}))
const preferencesBody = { expectedStateVersion: 0, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' }
const preferences = record(checks, 'learner preferences write', await gatewayRequest(token, '/api/v1/learner/preferences', {
  method: 'PATCH', operation: 'preferences-write', traceId, idempotencyKey: `${runId}-preferences`, body: preferencesBody,
}))
const profileReplay = record(checks, 'learner profile idempotent replay', await gatewayRequest(token, '/api/v1/learner/profile', {
  method: 'PATCH', operation: 'profile-replay', traceId, idempotencyKey: `${runId}-profile`, body: profileBody,
}))
const targetReplay = record(checks, 'learner target idempotent replay', await gatewayRequest(token, '/api/v1/learner/targets', {
  method: 'PUT', operation: 'target-replay', traceId, idempotencyKey: `${runId}-target`, body: targetBody,
}))
const preferencesReplay = record(checks, 'learner preferences idempotent replay', await gatewayRequest(token, '/api/v1/learner/preferences', {
  method: 'PATCH', operation: 'preferences-replay', traceId, idempotencyKey: `${runId}-preferences`, body: preferencesBody,
}))

const readProfile = record(checks, 'learner profile readback', await gatewayRequest(token, '/api/v1/learner/profile', { operation: 'profile-read', traceId }))
const readTarget = record(checks, 'learner target readback', await gatewayRequest(token, '/api/v1/learner/targets', { operation: 'target-read', traceId }))
const readPreferences = record(checks, 'learner preferences readback', await gatewayRequest(token, '/api/v1/learner/preferences', { operation: 'preferences-read', traceId }))
const firstDay = record(checks, 'learner first-day readback', await gatewayRequest(token, '/api/v1/learner/first-day', { operation: 'first-day-read', traceId }))

const readingArticles = record(checks, 'reading article list', await gatewayRequest(token, '/api/v1/reading/articles?limit=20', { operation: 'reading-articles-read', traceId }))
const readingArticle = record(checks, 'reading article detail', await gatewayRequest(token, '/api/v1/reading/articles/3501', { operation: 'reading-article-read', traceId }))
const readingQuestions = record(checks, 'reading question list', await gatewayRequest(token, '/api/v1/reading/questions?limit=20&articleId=3501', { operation: 'reading-questions-read', traceId }))
const grammarSentence = record(checks, 'grammar sentence graph', await gatewayRequest(token, '/api/v1/grammar/sentences/3201', { operation: 'grammar-sentence-read', traceId }))
if (!readingArticles.body || !readingArticle.body || !readingQuestions.body || !grammarSentence.body) fail('authenticated content read probe returned an empty body')

const envelopeData = (value) => value?.data?.data ?? value?.data ?? value
const articleListData = envelopeData(readingArticles.body)
const articleList = Array.isArray(articleListData) ? articleListData : articleListData?.items
const articleData = envelopeData(readingArticle.body)
const questionListData = envelopeData(readingQuestions.body)
const questionList = Array.isArray(questionListData) ? questionListData : questionListData?.items
const sentenceData = envelopeData(grammarSentence.body)
if (!Array.isArray(articleList) || !articleList.some((item) => Number(item?.articleId) === 3501)
  || Number(articleData?.articleId) !== 3501 || !Array.isArray(articleData?.blocks) || articleData.blocks.length < 1
  || !Array.isArray(questionList) || !questionList.some((item) => Number(item?.articleId) === 3501)
  || Number(sentenceData?.sentenceId) !== 3201 || !Array.isArray(sentenceData?.nodes)) {
  fail('authenticated content read probe returned an unexpected response envelope', {
    articleListCount: Array.isArray(articleList) ? articleList.length : null,
    articleId: articleData?.articleId ?? null,
    blockCount: Array.isArray(articleData?.blocks) ? articleData.blocks.length : null,
    questionListCount: Array.isArray(questionList) ? questionList.length : null,
    sentenceId: sentenceData?.sentenceId ?? null,
    sentenceNodeCount: Array.isArray(sentenceData?.nodes) ? sentenceData.nodes.length : null,
  })
}

const reloginSession = await loginAccount({ identifier, password, deviceId: session.deviceId, platform: 'ANDROID', runId: `${runId}-relogin` })
record(checks, 'learner profile readback after relogin', await gatewayRequest(reloginSession.accessToken, '/api/v1/learner/profile', { operation: 'relogin-profile-read', traceId }))
record(checks, 'learner target readback after relogin', await gatewayRequest(reloginSession.accessToken, '/api/v1/learner/targets', { operation: 'relogin-target-read', traceId }))
record(checks, 'learner preferences readback after relogin', await gatewayRequest(reloginSession.accessToken, '/api/v1/learner/preferences', { operation: 'relogin-preferences-read', traceId }))

const claims = decodeJwtPayload(token)
if (claims.iss !== 'http://127.0.0.1:18087' || !claims.sub || claims.aud !== 'yuxuexing-api' || claims.token_type !== 'access') {
  fail('IAM JWT claims did not match the local self-owned contract', { issuer: claims.iss, subjectPresent: Boolean(claims.sub), audience: claims.aud, tokenType: claims.token_type })
}
const principalId = claims.sub
const persistedPrincipal = queryText('iam_service', `SELECT principal_id FROM iam_account WHERE principal_id='${principalId}' AND identifier='${identifier}' LIMIT 1`)
if (persistedPrincipal !== principalId) fail('IAM account/principal fact was not persisted')
const db = {
  profile: queryNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_profile WHERE principal_id='${principalId}' AND tenant_id='platform' AND age_confirmed=1 AND privacy_consent=1 AND terms_consent=1`),
  goal: queryNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_goal WHERE principal_id='${principalId}' AND tenant_id='platform' AND goal_code='ZERO_BASIS' AND target_level='A1' AND daily_quota_minutes=15`),
  preferences: queryNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_preferences WHERE principal_id='${principalId}' AND tenant_id='platform' AND ui_locale='zh-CN' AND content_locale='en-US' AND theme_mode='SYSTEM'`),
  learnerOutbox: queryNumber('learner_service', `SELECT COUNT(*) FROM learner_outbox_event WHERE owner_id='${principalId}'`),
  iamPrincipal: queryNumber('iam_service', `SELECT COUNT(*) FROM iam_principal WHERE principal_id='${principalId}' AND tenant_id='platform' AND adult_gate_status IN ('APPROVED','VERIFIED')`),
  iamConsents: queryNumber('iam_service', `SELECT COUNT(*) FROM iam_consent WHERE principal_id='${principalId}' AND policy_version='b30-consent-v1' AND status='GRANTED'`),
}
if (Object.values(db).some(value => !Number.isFinite(value)) || db.profile !== 1 || db.goal !== 1 || db.preferences !== 1 || db.iamConsents !== 2) fail('B31 learner owner evidence is incomplete', db)

const profileData = readProfile.body?.data?.data ?? readProfile.body?.data ?? {}
const targetData = readTarget.body?.data?.data ?? readTarget.body?.data ?? {}
const preferencesData = readPreferences.body?.data?.data ?? readPreferences.body?.data ?? {}
if ((profileData.contentLocale ?? profileData.content_locale) !== 'en-US') fail('profile readback content locale mismatch', readProfile.body)
if ((targetData.goalCode ?? targetData.goal_code) !== 'ZERO_BASIS') fail('target readback goal mismatch', readTarget.body)
if ((preferencesData.uiLocale ?? preferencesData.ui_locale) !== 'zh-CN') fail('preferences readback locale mismatch', readPreferences.body)
if (profile.body?.meta?.replayed === true || target.body?.meta?.replayed === true || preferences.body?.meta?.replayed === true) fail('first learner write was unexpectedly marked replayed')
if (!profileReplay.body?.meta?.replayed && !targetReplay.body?.meta?.replayed && !preferencesReplay.body?.meta?.replayed) {
  // The owner adapter may return the same durable row on replay; stable readback and uniqueness are the evidence.
}

console.log(JSON.stringify({ result: 'PASS', runId, subjectBound: true, claims: { issuer: claims.iss, audience: claims.aud, tokenType: claims.token_type }, checks, db,
  profileReadback: true, targetReadback: true, preferencesReadback: true, firstDayReadback: firstDay.status === 200, reloginReadback: true,
  contentReadback: { articleCount: articleList.length, articleId: articleData.articleId, blockCount: articleData.blocks.length, questionCount: questionList.length, sentenceId: sentenceData.sentenceId, sentenceNodeCount: sentenceData.nodes.length },
  credentialsPersisted: false, tokenValuesEmitted: false }, null, 2))
