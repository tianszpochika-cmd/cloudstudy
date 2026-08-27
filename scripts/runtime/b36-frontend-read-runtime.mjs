import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// This probe exercises the same public Gateway paths used by the learner Web
// and Mobile H5 API wrappers. It keeps all credentials and token material in
// memory and only prints boolean/status evidence.
const gateway = process.env.B36_GATEWAY ?? 'http://127.0.0.1:18070'
const issuer = process.env.OIDC_ISSUER_URI ?? 'http://127.0.0.1:18099/realms/yuxuexing-local'
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local'
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin'
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only'
const runId = process.env.B36_FRONTEND_READ_RUN_ID ?? `b36-frontend-read-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

function fail(message, details = undefined) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function bodyOf(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text.slice(0, 200) }
}

async function request(url, options = {}) {
  const response = await fetch(url, options)
  const body = await bodyOf(response)
  if (!response.ok) fail(`HTTP ${response.status} ${url}`, { status: response.status, body })
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
      firstName: 'B36', lastName: 'FrontendReadRuntime', credentials: [{ type: 'password', value: password, temporary: false }] }),
  })
  const found = await request(`http://127.0.0.1:18099/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`, { headers: adminHeaders(token) })
  const user = Array.isArray(found.body) ? found.body[0] : null
  if (!user?.id) fail('B36 disposable learner was not created')
  return { username, password }
}

function runNode(script, env = {}) {
  return spawnSync(process.execPath, [path.join(process.cwd(), script)], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  })
}

function lastJsonLine(stdout) {
  const line = String(stdout ?? '').trim().split(/\r?\n/).filter(Boolean).at(-1)
  if (!line) return null
  try { return JSON.parse(line) } catch { return null }
}

function provisionLocalUser(user) {
  const claims = runNode('scripts/runtime/ensure-local-oidc-test-user.mjs', {
    OIDC_TEST_USERNAME: user.username,
    OIDC_TEST_DEVICE_ID: 'local-browser',
  })
  if (claims.status !== 0) fail(`local claims provisioning failed for ${user.username}`, String(claims.stderr ?? '').slice(-1000))
  const ready = lastJsonLine(claims.stdout)
  if (!ready?.subject) fail(`local claims provisioning returned no subject for ${user.username}`)

  const fixture = runNode('scripts/database/seed-local-real-all.mjs', { LOCAL_TEST_SUBJECT: ready.subject })
  if (fixture.status !== 0) fail(`local fixture provisioning failed for ${user.username}`, String(fixture.stderr ?? '').slice(-1000))
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

async function gatewayRequest(token, path, options = {}) {
  const headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), accept: 'application/json',
    'x-request-id': `${runId}-${options.operation ?? 'read'}`.slice(0, 120),
    'x-trace-id': crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32),
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}) }
  const response = await fetch(`${gateway}${path}`, { method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body) })
  return { status: response.status, body: await bodyOf(response), requestId: response.headers.get('x-request-id'), traceId: response.headers.get('x-trace-id') }
}

async function startAuthorization() {
  const redirectUri = 'http://127.0.0.1:18180/auth/callback'
  const query = new URLSearchParams({ intent: 'login', redirectUri, returnTo: '/home', uiLocale: 'zh-CN', theme: 'system' })
  const result = await gatewayRequest(null, `/api/v1/auth/oidc/standard-oidc/authorization/start?${query}`, { operation: 'authorization-start' })
  if (result.status !== 200 || typeof result.body?.authorizationUrl !== 'string') fail('authorization start did not return a local URL')
  return { authUrl: result.body.authorizationUrl, state: new URL(result.body.authorizationUrl).searchParams.get('state'), redirectUri }
}

async function authorizationCode(authUrl, user) {
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
      if (next.origin === 'http://127.0.0.1:18180' && next.pathname === '/auth/callback') return new URL(next)
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

async function establishSession(user) {
  const start = await startAuthorization()
  const callback = await authorizationCode(start.authUrl, user)
  const result = await gatewayRequest(null, '/api/v1/auth/oidc/standard-oidc/callback', {
    method: 'POST', operation: 'authorization-callback', idempotencyKey: `${runId}-callback`,
    body: { code: callback.searchParams.get('code'), state: start.state, redirectUri: start.redirectUri },
  })
  if (result.status !== 200 || !result.body?.session?.accessToken) fail('OIDC callback did not return a session')
  return result.body.session.accessToken
}

function unwrap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}

function list(value) {
  const source = unwrap(value)
  if (Array.isArray(source)) return source
  if (source && typeof source === 'object') {
    for (const key of ['items', 'records', 'content', 'tasks', 'messages', 'data']) if (Array.isArray(source[key])) return source[key]
  }
  return []
}

function firstId(value, keys) {
  const item = list(value)[0] ?? (unwrap(value) && typeof unwrap(value) === 'object' ? unwrap(value) : {})
  for (const key of keys) if (item && item[key] !== undefined && item[key] !== null) return String(item[key])
  return null
}

const checks = []
async function probe(token, name, path, options = {}, expected = [200]) {
  const result = await gatewayRequest(token, path, { ...options, operation: name.replaceAll(' ', '-'), idempotencyKey: options.idempotencyKey ?? `${runId}-${name.replaceAll(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}` })
  const pass = expected.includes(result.status)
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', httpStatus: result.status, requestId: result.requestId, traceId: result.traceId })
  return result
}

const admin = await adminToken()
const user = await ensureUser(admin)
const localAuthority = provisionLocalUser(user)
const token = await establishSession(user)
const query = (path, values) => `${path}?${new URLSearchParams(values).toString()}`

// Auth, learner read models and published course/content projections.
await probe(token, 'iam principal', '/api/v1/iam/principal/me')
await probe(token, 'iam permissions', '/api/v1/iam/permissions')
await probe(token, 'learner profile', '/api/v1/learner/profile')
await probe(token, 'learner targets', '/api/v1/learner/targets')
await probe(token, 'learner preferences', '/api/v1/learner/preferences')
const home = await probe(token, 'learner home', '/api/v1/learner/home')
await probe(token, 'learner first day', '/api/v1/learner/first-day')
await probe(token, 'onboarding options', '/api/v1/onboarding/options')
await probe(token, 'daily tasks today', '/api/v1/onboarding/daily-tasks/today')
const catalog = await probe(token, 'learner catalog', query('/api/v1/content/learner/catalog', { contentLocale: 'en-US', targetLevel: 'A1' }))
await probe(token, 'learner course detail', '/api/v1/content/learner/course-b25-basics')

// Core learning, assessment and B3/B10/B11 read models used by the pages.
await probe(token, 'continue context', '/api/v1/learning/continue-context')
await probe(token, 'current plan', '/api/v1/learning/plan/current')
await probe(token, 'today stream', '/api/v1/learning/stream/today')
await probe(token, 'srs overview', '/api/v1/learning/srs/overview')
await probe(token, 'srs states', '/api/v1/learning/srs/states')
await probe(token, 'review queue', '/api/v1/learning/review-queue')
await probe(token, 'daily summary', '/api/v1/learning/stats/daily-summary')
await probe(token, 'daily report', query('/api/v1/learning/stats/daily-report', { date: new Date().toISOString().slice(0, 10) }))
await probe(token, 'weekly report', query('/api/v1/learning/stats/weekly-report', { weekStart: new Date().toISOString().slice(0, 10) }))
await probe(token, 'assessment daily stream', query('/api/v1/assessment/daily-stream', { contentLocale: 'en-US' }))
await probe(token, 'mastery overview', '/api/v1/mastery/overview')
await probe(token, 'mastery mistakes', '/api/v1/mastery/mistakes')
await probe(token, 'mastery verifications', '/api/v1/mastery/verifications')

const grammarPoints = await probe(token, 'grammar points', query('/api/v1/grammar/points', { limit: 20 }))
await probe(token, 'grammar tree', '/api/v1/grammar/tree')
await probe(token, 'grammar exercises', query('/api/v1/grammar/exercises', { limit: 20, grammarPointId: 3103 }))
await probe(token, 'grammar mastery', query('/api/v1/grammar/mastery', { grammarPointId: 3103 }))
await probe(token, 'grammar sentence', '/api/v1/grammar/sentences/3201')
await probe(token, 'grammar sentence xray', '/api/v1/grammar/sentences/3201/xray')
await probe(token, 'grammar sentence blocks', '/api/v1/grammar/sentences/3201/blocks')
await probe(token, 'writing prompts', query('/api/v1/writing/prompts', { limit: 20 }))
await probe(token, 'writing templates', query('/api/v1/writing/templates', { limit: 20 }))
await probe(token, 'writing materials', query('/api/v1/writing/materials', { limit: 20 }))
await probe(token, 'proofreading exercises', query('/api/v1/writing/proofreading/exercises', { limit: 20 }))
await probe(token, 'writing history', query('/api/v1/writing/history', { limit: 20 }))
const listening = await probe(token, 'listening materials', query('/api/v1/listening/materials', { limit: 20, contentLocale: 'en-US' }))
await probe(token, 'listening material detail', '/api/v1/listening/materials/3401')
await probe(token, 'listening clips', query('/api/v1/listening/clips', { materialId: 3401, limit: 20 }))
await probe(token, 'listening offline packages', query('/api/v1/listening/offline-packages', { limit: 20 }))
const article = await probe(token, 'reading articles', query('/api/v1/reading/articles', { limit: 20, contentLocale: 'en-US' }))
await probe(token, 'reading article detail', '/api/v1/reading/articles/3501')
await probe(token, 'reading dictionary', query('/api/v1/reading/articles/3501/dictionary', { tokenId: 'small' }))
await probe(token, 'reading story', '/api/v1/reading/articles/3501/story')
await probe(token, 'reading questions', query('/api/v1/reading/questions', { limit: 20, articleId: 3501 }))
await probe(token, 'phonetics catalog', query('/api/v1/phonetics/catalog', { setCode: 'EN_48_PHASE1', contentLocale: 'en-US' }))
await probe(token, 'phonetics minimal pairs', query('/api/v1/phonetics/minimal-pairs', { limit: 20 }))

// B2/B4/B11/B12/B13 reads.
await probe(token, 'vocabulary library', '/api/v1/vocab/library')
await probe(token, 'vocabulary expressions', '/api/v1/vocab/expressions')
await probe(token, 'vocabulary detail', '/api/v1/content/learner/vocabulary/b25-item-001')
await probe(token, 'media asset', '/api/v1/media/assets/b3-audio-3401')
await probe(token, 'media manifest', '/api/v1/media/assets/b3-audio-3401/manifest')
await probe(token, 'media signed url', '/api/v1/media/assets/b3-audio-3401/signed-url', { method: 'POST', body: { renditionId: 'low', contentVersionId: 301 } }, [200, 201])
await probe(token, 'media notifications', '/api/v1/notifications/messages?limit=20')
await probe(token, 'notification preferences', '/api/v1/notifications/preferences')
await probe(token, 'offline changes', '/api/v1/sync/changes?cursor=0&limit=50')
await probe(token, 'offline packages', '/api/v1/sync/offline-packages?limit=20')
await probe(token, 'gamification summary', '/api/v1/gamification/me/summary')
await probe(token, 'gamification ledger', '/api/v1/gamification/me/ledger')
await probe(token, 'gamification rewards', '/api/v1/gamification/me/rewards')
await probe(token, 'quests', '/api/v1/gamification/quests')
await probe(token, 'achievements', '/api/v1/gamification/achievements')
await probe(token, 'collection', '/api/v1/gamification/collection')
await probe(token, 'game catalog', '/api/v1/games/catalog')
const rooms = await probe(token, 'social rooms', '/api/v1/social/rooms?limit=20')
const roomId = firstId(rooms.body, ['roomId', 'id']) ?? 'room-local-001'
await probe(token, 'social room detail', `/api/v1/social/rooms/${encodeURIComponent(roomId)}`)
await probe(token, 'social leaderboard', query('/api/v1/social/leaderboards', { roomId, kind: 'FOCUS_MINUTES', period: 'DAY' }))
await probe(token, 'commerce skus', '/api/v1/commerce/skus')
await probe(token, 'commerce orders', '/api/v1/commerce/orders?limit=20')
await probe(token, 'commerce entitlements', '/api/v1/commerce/entitlements/me')

const failures = checks.filter((check) => check.status === 'FAIL')
const evidence = { result: failures.length ? 'FAIL' : 'PASS', runId, checks, passCount: checks.length - failures.length, failCount: failures.length,
  source: 'authenticated-gateway-read-runtime', tokenValuesEmitted: false, credentialsPersisted: false,
  localAuthority: { subjectProvisioned: Boolean(localAuthority.subject), permissionCount: localAuthority.permissionCount ?? null },
  fixtureHints: { contentCode: firstId(catalog.body, ['contentCode', 'code']) ?? 'course-b25-basics', grammarPointId: firstId(grammarPoints.body, ['grammarPointId', 'id']) ?? '3103', materialId: firstId(listening.body, ['materialId', 'id']) ?? '3401', articleId: firstId(article.body, ['articleId', 'id']) ?? '3501', homeTasks: list(home.body).length } }
console.log(JSON.stringify(evidence, null, 2))
if (failures.length) process.exitCode = 1
