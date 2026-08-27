import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { runMysql } from '../database/lib/mysql-client.mjs'

// Authenticated write-path probe for the same Gateway contracts used by the
// learner Web and Mobile H5 clients.  It creates a disposable local learner,
// keeps credentials/tokens in memory, and prints only status/evidence facts.
const gateway = process.env.B36_GATEWAY ?? 'http://127.0.0.1:18070'
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local'
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin'
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only'
const runId = process.env.B36_FRONTEND_WRITE_RUN_ID ?? `b36-frontend-write-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const issuer = process.env.OIDC_ISSUER_URI ?? 'http://127.0.0.1:18099/realms/yuxuexing-local'

function fail(message, details = undefined) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function bodyOf(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text.slice(0, 160) }
}

async function request(url, options = {}) {
  const response = await fetch(url, options)
  const body = await bodyOf(response)
  if (!response.ok) fail(`HTTP ${response.status}`, { status: response.status, url })
  return { status: response.status, body, headers: response.headers }
}

async function adminToken() {
  const form = new URLSearchParams({ username: adminUsername, password: adminPassword, grant_type: 'password', client_id: 'admin-cli' })
  const result = await request('http://127.0.0.1:18099/realms/master/protocol/openid-connect/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
  })
  if (!result.body?.access_token) fail('local OIDC admin token was not issued')
  return result.body.access_token
}

function adminHeaders(token) { return { authorization: `Bearer ${token}`, 'content-type': 'application/json' } }

async function ensureUser(token) {
  const username = `${runId}-learner`
  const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users`, {
    method: 'POST', headers: adminHeaders(token),
    body: JSON.stringify({ username, enabled: true, email: `${username}@local.invalid`, emailVerified: true,
      firstName: 'B36', lastName: 'FrontendWriteRuntime', credentials: [{ type: 'password', value: password, temporary: false }] }),
  })
  const found = await request(`http://127.0.0.1:18099/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`, { headers: adminHeaders(token) })
  const user = Array.isArray(found.body) ? found.body[0] : null
  if (!user?.id) fail('B36 disposable learner was not created')
  return { username, password }
}

function runNode(script, env = {}) {
  return spawnSync(process.execPath, [path.join(process.cwd(), script)], {
    cwd: process.cwd(), env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true,
  })
}

function lastJsonLine(stdout) {
  const line = String(stdout ?? '').trim().split(/\r?\n/).filter(Boolean).at(-1)
  if (!line) return null
  try { return JSON.parse(line) } catch { return null }
}

function provisionLocalUser(user) {
  const claims = runNode('scripts/runtime/ensure-local-oidc-test-user.mjs', {
    OIDC_TEST_USERNAME: user.username, OIDC_TEST_DEVICE_ID: 'local-browser',
  })
  if (claims.status !== 0) fail('local claims provisioning failed')
  const ready = lastJsonLine(claims.stdout)
  if (!ready?.subject) fail('local claims provisioning returned no subject')
  const fixture = runNode('scripts/database/seed-local-real-all.mjs', { LOCAL_TEST_SUBJECT: ready.subject })
  if (fixture.status !== 0) fail('local fixture provisioning failed')
  return { ...ready, fixture: lastJsonLine(fixture.stdout) }
}

class CookieJar {
  #cookies = new Map()
  accept(headers) {
    const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : (headers.get('set-cookie') ? [headers.get('set-cookie')] : [])
    for (const value of values) {
      const first = value.split(';', 1)[0]
      const index = first.indexOf('=')
      if (index > 0) this.#cookies.set(first.slice(0, index), first.slice(index + 1))
    }
  }
  header() { return [...this.#cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ') }
}

function htmlAttribute(tag, name) { return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null }
function htmlDecode(value) { return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&#39;', "'") }

function loginForm(html) {
  const match = html.match(/<form\b[^>]*id=["']kc-form-login["'][^>]*>[\s\S]*?<\/form>/i)
    ?? html.match(/<form\b[^>]*>[\s\S]*?<input[^>]+name=["']username["'][\s\S]*?<\/form>/i)
  if (!match) return null
  const formTag = match[0].match(/<form\b[^>]*>/i)?.[0]
  const action = formTag ? htmlDecode(htmlAttribute(formTag, 'action') ?? '') : ''
  if (!action) return null
  const fields = new URLSearchParams()
  for (const input of match[0].matchAll(/<input\b[^>]*>/gi)) {
    const tag = input[0]
    const name = htmlAttribute(tag, 'name')
    if (!name) continue
    const type = (htmlAttribute(tag, 'type') ?? 'text').toLowerCase()
    if (type === 'submit' || type === 'button') continue
    fields.set(name, htmlDecode(htmlAttribute(tag, 'value') ?? ''))
  }
  return { action, fields }
}

async function gatewayRequest(token, pathName, options = {}) {
  const headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), accept: 'application/json',
    'x-request-id': `${runId}-${options.operation ?? 'write'}`.slice(0, 120),
    'x-trace-id': crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32),
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}) }
  const response = await fetch(`${gateway}${pathName}`, { method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body) })
  return { status: response.status, body: await bodyOf(response), requestId: response.headers.get('x-request-id'), traceId: response.headers.get('x-trace-id') }
}

async function establishSession(user) {
  const redirectUri = 'http://127.0.0.1:18180/auth/callback'
  const query = new URLSearchParams({ intent: 'login', redirectUri, returnTo: '/home', uiLocale: 'zh-CN', theme: 'system' })
  const start = await gatewayRequest(null, `/api/v1/auth/oidc/standard-oidc/authorization/start?${query}`, { operation: 'authorization-start' })
  if (start.status !== 200 || typeof start.body?.authorizationUrl !== 'string') fail('authorization start did not return a local URL')
  const authUrl = start.body.authorizationUrl
  const state = new URL(authUrl).searchParams.get('state')
  const jar = new CookieJar()
  let url = authUrl
  let method = 'GET'
  let body
  let submitted = false
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const headers = { accept: 'text/html,application/xhtml+xml' }
    const cookie = jar.header()
    if (cookie) headers.cookie = cookie
    const response = await fetch(url, { method, headers, body, redirect: 'manual' })
    jar.accept(response.headers)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) fail('OIDC login redirect omitted location')
      const next = new URL(location, url)
      if (next.origin === 'http://127.0.0.1:18180' && next.pathname === '/auth/callback') {
        const callback = new URL(next)
        const result = await gatewayRequest(null, '/api/v1/auth/oidc/standard-oidc/callback', {
          method: 'POST', operation: 'authorization-callback', idempotencyKey: `${runId}-callback`,
          body: { code: callback.searchParams.get('code'), state, redirectUri },
        })
        if (result.status !== 200 || !result.body?.session?.accessToken) fail('OIDC callback did not return a session')
        return result.body.session.accessToken
      }
      url = next.toString(); method = 'GET'; body = undefined; continue
    }
    const html = await response.text()
    if (response.status !== 200) fail(`OIDC login form failed: HTTP ${response.status}`)
    const form = loginForm(html)
    if (!form || submitted) fail('OIDC login form was not accepted')
    form.fields.set('username', user.username); form.fields.set('password', user.password)
    url = new URL(form.action, url).toString(); method = 'POST'; body = form.fields; submitted = true
  }
  fail('OIDC authorization flow exceeded redirect limit')
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

const admin = await adminToken()
const user = await ensureUser(admin)
const localAuthority = provisionLocalUser(user)
const token = await establishSession(user)
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
