import crypto from 'node:crypto'

import { runMysql } from '../database/lib/mysql-client.mjs'
import { decodeJwtPayload, gatewayRequest as jwtGatewayRequest, fail } from './lib/self-owned-jwt-auth.mjs'

// Authenticated write-path probe for the same Gateway contracts used by the
// learner Web and Mobile H5 clients.  It creates a disposable local learner,
// keeps credentials/tokens in memory, and prints only status/evidence facts.
const gateway = process.env.B36_GATEWAY ?? 'http://127.0.0.1:18070'
const runId = process.env.B36_FRONTEND_WRITE_RUN_ID ?? `b36-frontend-write-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

async function gatewayRequest(token, pathName, options = {}) {
  return jwtGatewayRequest(token, pathName, { ...options, origin: gateway, runId,
    traceId: crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32) })
}

async function establishSession() {
  const identifier = `${runId}-learner@example.invalid`
  const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`
  const result = await gatewayRequest(null, '/api/v1/auth/register', {
    method: 'POST', platform: 'ANDROID', operation: 'account-register', idempotencyKey: `${runId}-register`,
    body: { identifier, password, device: { deviceId: crypto.randomUUID(), deviceType: 'ANDROID', deviceName: 'b36-write', osVersion: 'test', clientVersion: 'local' } },
  })
  if (result.status !== 201 || !result.body?.accessToken) fail('IAM account registration did not return a JWT session')
  const claims = decodeJwtPayload(result.body.accessToken)
  if (claims.aud !== 'yuxuexing-api' || claims.token_type !== 'access') fail('IAM JWT claims did not satisfy the access-token contract')
  return { token: result.body.accessToken, subject: claims.sub }
}

function unwrap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}

function idOf(value, keys) {
  const source = unwrap(value)
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const key of keys) if (source[key] !== undefined && source[key] !== null) return String(source[key])
    for (const key of ['session', 'report', 'order', 'data', 'result']) if (source[key]) {
      const found = idOf(source[key], keys)
      if (found) return found
    }
  }
  if (Array.isArray(source)) for (const item of source) {
    const found = idOf(item, keys)
    if (found) return found
  }
  return null
}

const checks = []
async function call(token, name, pathName, options = {}, expected = [200, 201, 202, 204]) {
  const result = await gatewayRequest(token, pathName, {
    ...options,
    operation: name.replaceAll(' ', '-'),
    idempotencyKey: options.idempotencyKey ?? `${runId}-${name.replaceAll(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
  })
  if (!expected.includes(result.status)) {
    const body = result.body && typeof result.body === 'object' ? result.body : { message: String(result.body ?? '').slice(0, 160) }
    fail(`${name} returned HTTP ${result.status}`, { path: pathName, error: body.error ?? body.message ?? body.code ?? 'unknown' })
  }
  checks.push({ name, status: 'PASS', httpStatus: result.status })
  return result
}

function mysqlCount(schema, sql) {
  const output = runMysql({
    mysqlArgs: ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '-uroot', schema, '-N', '-B'],
    password: process.env.MYSQL_ROOT_PASSWORD ?? 'root-local-only', cwd: process.cwd(), input: `${sql}\n`,
  })
  const value = Number(output.split(/\r?\n/).filter(Boolean).at(-1))
  if (!Number.isFinite(value)) fail('MySQL evidence query returned a non-numeric value')
  return value
}

const localAuthority = await establishSession()
const token = localAuthority.token
const json = (body) => ({ body, method: 'POST' })

// Learner-owned onboarding, SRS, vocabulary and continuation writes.
const preferences = await call(token, 'learner preferences read', '/api/v1/learner/preferences')
await call(token, 'learner preferences write', '/api/v1/learner/preferences', {
  method: 'PATCH', body: { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
})
const ensuredTask = await call(token, 'daily task ensure', '/api/v1/onboarding/daily-tasks/ensure', json({ contentCode: 'course-b25-basics', title: 'Phase 1 Foundations', minutes: 15 }))
const taskId = idOf(ensuredTask.body, ['taskId', 'id'])
if (taskId) await call(token, 'daily task complete', `/api/v1/onboarding/daily-tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST' })
await call(token, 'SRS batch create', '/api/v1/learning/srs/batches', json({ localDate: new Date().toISOString().slice(0, 10), timezone: 'Asia/Shanghai', dailyNewTarget: 20, maxDailyReview: 50, scheduleType: 'DAILY' }))
await call(token, 'SRS review write', '/api/v1/learning/srs/reviews', json({ itemId: 'b25-item-001', quality: 4, clientEventId: `${runId}-review` }))
await call(token, 'continue context write', '/api/v1/learning/continue-context', {
  method: 'PUT', body: { moduleId: 'phase1-foundations', moduleLabel: 'Phase 1 Foundations', lessonId: 'lesson-1', lessonTitle: 'Small routines', stepIndex: 1, totalSteps: 3, elapsedTimeMs: 1200, status: 'ACTIVE', clientEventId: `${runId}-continue` },
})
const library = await call(token, 'vocabulary library add', '/api/v1/vocab/library/entries', json({ itemType: 'VOCAB', itemId: 'b25-item-001', sourceType: 'B36_WRITE', collectionStatus: 'SAVED' }))
const entryId = idOf(library.body, ['entryId', 'id'])
if (entryId) await call(token, 'vocabulary library remove', `/api/v1/vocab/library/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' })
const expression = await call(token, 'vocabulary expression create', '/api/v1/vocab/expressions', json({ sourceType: 'READING', sourceRef: '3501:block-1', sourceContentVersion: '301', sentenceText: 'Small routines help me learn.', translationCn: '小习惯帮助我学习。', selectedText: 'Small routines', rangeStart: 0, rangeEnd: 14, wantToSay: true, privateNote: 'B36 local write' }))
const expressionId = idOf(expression.body, ['expressionId', 'id'])
if (expressionId) {
  await call(token, 'vocabulary expression update', `/api/v1/vocab/expressions/${encodeURIComponent(expressionId)}`, { method: 'PATCH', body: { wantToSay: false, privateNote: 'B36 updated' } })
  await call(token, 'vocabulary expression delete', `/api/v1/vocab/expressions/${encodeURIComponent(expressionId)}`, { method: 'DELETE' })
}

// B3/B10/B11 learning interactions. Every command is persisted by the
// learning owner and uses a distinct idempotency key.
await call(token, 'grammar attempt', '/api/v1/grammar/practice/attempts', json({ exerciseId: '3103', answer: 'has', contentVersionId: 301 }))
await call(token, 'sentence blocks', '/api/v1/grammar/sentences/3201/blocks', json({ blockOrder: ['small', 'routines', 'help', 'me', 'learn'], contentVersionId: 301 }))
await call(token, 'sentence imitation', '/api/v1/grammar/sentences/3201/imitation', json({ slotValues: { subject: 'Small routines', verb: 'help' }, contentVersionId: 301 }))
await call(token, 'writing submission', '/api/v1/writing/submissions', json({ promptId: '3301', answer: 'Small routines help me learn.', contentVersionId: 301, mode: 'TRANSLATION' }))
await call(token, 'writing correction', '/api/v1/writing/corrections', json({ promptId: '3301', answer: 'Small routines help me learn.', contentVersionId: 301 }))
const listening = await call(token, 'listening session', '/api/v1/listening/sessions', json({ materialId: '3401', contentVersionId: 301, mode: 'LISTEN' }))
const listeningSessionId = idOf(listening.body, ['sessionId', 'id'])
if (!listeningSessionId) fail('listening session response did not contain a session id')
await call(token, 'listening dictation', `/api/v1/listening/sessions/${encodeURIComponent(listeningSessionId)}/dictation`, json({ segmentId: '340101', mode: 'SENTENCE', answer: 'good help', attemptNo: 1, contentVersionId: 301 }))
await call(token, 'listening progress', `/api/v1/listening/sessions/${encodeURIComponent(listeningSessionId)}/progress`, { method: 'PUT', body: { mediaPositionMs: 100, positionVersion: 1, playbackRate: 1, subtitleMode: 'EN', contentVersionId: 301 } })
await call(token, 'listening offline package', '/api/v1/listening/offline-packages', json({ materialIds: [3401], deviceId: 'b36-web' }))
await call(token, 'reading attempt', '/api/v1/reading/attempts', json({ questionId: '3601', answer: 'A', contentVersionId: 301 }))
await call(token, 'reading mining', '/api/v1/reading/mining', json({ articleId: '3501', blockId: 'block-1', contentVersionId: 301 }))
await call(token, 'reading progress', '/api/v1/reading/progress', { method: 'PUT', body: { articleId: '3501', blockId: 'block-1', progressPercent: 50, positionVersion: 1, contentVersionId: 301 } })
const recording = await call(token, 'speaking recording', '/api/v1/speaking/recordings', json({ sourceSegmentId: '340101', durationMs: 1200, contentHash: 'local-b36', storageMode: 'LOCAL_ENCRYPTED' }))
const recordingId = idOf(recording.body, ['recordingId', 'id'])
if (!recordingId) fail('speaking recording response did not contain a recording id')
await call(token, 'speaking self rating', `/api/v1/speaking/recordings/${encodeURIComponent(recordingId)}/self-rating`, json({ rating: 'GOOD' }))
const shadowing = await call(token, 'shadowing session', '/api/v1/speaking/shadowing/sessions', json({ sourceSegmentId: '340101', targetGapMs: 500, contentVersionId: 301 }))
const shadowingSessionId = idOf(shadowing.body, ['shadowingSessionId', 'sessionId', 'id'])
if (!shadowingSessionId) fail('shadowing session response did not contain a session id')
await call(token, 'shadowing progress', `/api/v1/speaking/shadowing/sessions/${encodeURIComponent(shadowingSessionId)}/progress`, json({ positionMs: 800, attemptNo: 1 }))
await call(token, 'shadowing completion', '/api/v1/speaking/shadowing/completions', json({ sourceSegmentId: '340101', recordingId, contentVersionId: 301 }))
await call(token, 'media progress', '/api/v1/learning/media-progress', { method: 'PUT', body: { assetId: 'b3-audio-3401', sessionId: listeningSessionId, positionMs: 100, durationMs: 1000, entityVersion: 1 } })
const roleplay = await call(token, 'roleplay session', '/api/v1/speaking/roleplay/sessions', json({ roleplayCode: 'COFFEE_SHOP_V1', contentVersionId: 301 }))
const roleplaySessionId = idOf(roleplay.body, ['roleplaySessionId', 'sessionId', 'id'])
if (roleplaySessionId) await call(token, 'roleplay turn', `/api/v1/speaking/roleplay/sessions/${encodeURIComponent(roleplaySessionId)}/turns`, json({ turnIndex: 0, recordingId, choiceCode: 'ORDER_COFFEE' }))
await call(token, 'offline sync push', '/api/v1/offline/sync/push', json({ deviceId: 'b36-web', clientBatchId: `${runId}-offline`, baseCursor: '0', changes: [{ changeId: `${runId}-change`, clientEventId: `${runId}-change`, entityType: 'LISTENING_PROGRESS', entityId: 'b3-audio-3401', operation: 'UPSERT', payload: { positionMs: 100 } }] }))

// Local feature writes used by the B4/B12 pages.
await call(token, 'streak settings', '/api/v1/gamification/streak/settings', { method: 'PUT', body: { timeZone: 'Asia/Shanghai', weekendProtectionEnabled: false } })
await call(token, 'avatar profile', '/api/v1/avatar/profile', { method: 'PUT', body: { renderMode: '2D_FALLBACK', resourceVersion: 'avatar-2026.08.1' } })
const game = await call(token, 'game session', '/api/v1/games/sessions', json({ gameCode: 'WORD_MATCH', performanceTier: 'Medium' }))
const gameSessionId = idOf(game.body, ['sessionId', 'id'])
if (gameSessionId) {
  await call(token, 'game event', `/api/v1/games/sessions/${encodeURIComponent(gameSessionId)}/events`, json({ seq: 1, responseToken: 'local', itemCode: 'WORD_MATCH_1' }))
  await call(token, 'game finish', `/api/v1/games/sessions/${encodeURIComponent(gameSessionId)}/finish`, { method: 'POST' })
}
const rooms = await call(token, 'social room list', '/api/v1/social/rooms?limit=20')
const roomId = idOf(rooms.body, ['roomId', 'id']) ?? 'room-local-foundations'
await call(token, 'social room join', `/api/v1/social/rooms/${encodeURIComponent(roomId)}/join`, { method: 'POST', body: {} })
const focus = await call(token, 'social focus start', `/api/v1/social/rooms/${encodeURIComponent(roomId)}/focus`, json({ durationMinutes: 25, focusTagCode: 'VOCABULARY' }))
const focusId = idOf(focus.body, ['focusId', 'sessionId', 'id'])
if (focusId) await call(token, 'social focus finish', `/api/v1/social/rooms/${encodeURIComponent(roomId)}/focus`, { method: 'PATCH', body: { focusId, action: 'FINISH' } })
await call(token, 'social interaction', `/api/v1/social/rooms/${encodeURIComponent(roomId)}/interactions`, json({ presetCode: 'CHEER_UP', targetSeatIndex: 1 }))
await call(token, 'social room report', `/api/v1/social/rooms/${encodeURIComponent(roomId)}/reports`, json({ targetSeatIndex: 1, reasonCode: 'OTHER', clientEventId: `${runId}-report` }))
await call(token, 'social room leave', `/api/v1/social/rooms/${encodeURIComponent(roomId)}/leave`, { method: 'POST', body: {} })

// Commerce write is intentionally limited to local order/payment-intent state;
// no provider callback or real payment is invoked.
const order = await call(token, 'commerce order create', '/api/v1/commerce/orders', json({ skuId: 'phase1-foundations' }), [201])
const orderId = idOf(order.body, ['orderId', 'id'])
if (orderId) {
  await call(token, 'commerce payment intent', `/api/v1/commerce/orders/${encodeURIComponent(orderId)}/payment-intents`, { method: 'POST', body: { provider: 'SANDBOX' } }, [202])
  await call(token, 'commerce order cancel', `/api/v1/commerce/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' })
}

const evidence = {
  result: 'PASS', runId, checkCount: checks.length, checks,
  source: 'authenticated-gateway-write-runtime', tokenValuesEmitted: false, credentialsPersisted: false,
  subjectBound: Boolean(localAuthority.subject),
  mysql: {
    learningInteractions: mysqlCount('learning_service', `SELECT COUNT(*) FROM b3_learning_interaction WHERE principal_id='${localAuthority.subject}' AND idempotency_key LIKE '${runId}%'`),
    reviews: mysqlCount('learning_service', `SELECT COUNT(*) FROM b25_learning_review WHERE principal_id='${localAuthority.subject}' AND idempotency_key LIKE '${runId}%'`),
    libraryRemoved: mysqlCount('learning_service', `SELECT COUNT(*) FROM b25_learning_library_entry WHERE principal_id='${localAuthority.subject}' AND item_id='b25-item-001' AND collection_status='REMOVED'`),
    socialReports: mysqlCount('social_service', `SELECT COUNT(*) FROM soc_report WHERE reporter_subject_id='${localAuthority.subject}' AND client_event_id='${runId}-report'`),
    commerceOrders: mysqlCount('commerce_service', `SELECT COUNT(*) FROM commerce_order WHERE subject_id='${localAuthority.subject}'`),
  },
}
console.log(JSON.stringify(evidence, null, 2))
