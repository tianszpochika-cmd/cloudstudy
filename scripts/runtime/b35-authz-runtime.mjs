import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

const gateway = process.env.B35_GATEWAY ?? 'http://127.0.0.1:18070'
const issuer = process.env.OIDC_ISSUER_URI ?? 'http://127.0.0.1:18099/realms/yuxuexing-local'
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local'
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin'
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only'
const runId = process.env.B35_AUTHZ_RUN_ID ?? `b35-authz-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32)
const mysqlContainer = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1'

function fail(message, details = undefined) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function bodyOf(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text.slice(0, 500) }
}

async function request(url, options = {}) {
  const response = await fetch(url, options)
  const body = await bodyOf(response)
  return { status: response.status, body, headers: response.headers }
}

function adminHeaders(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

async function adminToken() {
  const form = new URLSearchParams({
    username: adminUsername,
    password: adminPassword,
    grant_type: 'password',
    client_id: 'admin-cli',
  })
  const result = await request('http://127.0.0.1:18099/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (result.status !== 200 || !result.body?.access_token) fail('local IdP admin bootstrap failed')
  return result.body.access_token
}

async function createUser(token, label) {
  const headers = adminHeaders(token)
  const username = `${runId}-${label}`
  const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`
  const created = await request(`http://127.0.0.1:18099/admin/realms/${realm}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      enabled: true,
      email: `${username}@local.invalid`,
      emailVerified: true,
      firstName: 'B35',
      lastName: label,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  })
  if (created.status !== 201) fail('local synthetic user creation failed')
  const found = await request(`http://127.0.0.1:18099/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`, { headers })
  const user = Array.isArray(found.body) ? found.body[0] : null
  if (found.status !== 200 || !user?.id) fail('local synthetic user lookup failed')
  return { id: user.id, username, password }
}

async function deleteUser(token, user) {
  if (!user?.id) return
  await fetch(`http://127.0.0.1:18099/admin/realms/${realm}/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  })
}

class CookieJar {
  #cookies = new Map()

  accept(headers) {
    const values = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ? [headers.get('set-cookie')] : [])
    for (const value of values) {
      const first = value.split(';', 1)[0]
      const index = first.indexOf('=')
      if (index > 0) this.#cookies.set(first.slice(0, index), first.slice(index + 1))
    }
  }

  header() {
    return [...this.#cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}

function htmlAttribute(tag, name) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null
}

function htmlDecode(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'").replaceAll('&#39;', "'")
}

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
  const headers = {
    accept: 'application/json',
    'x-request-id': `${runId}-${options.operation ?? 'read'}`.slice(0, 120),
    'x-trace-id': traceId,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    ...(options.headers ?? {}),
  }
  const response = await fetch(`${gateway}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  return {
    status: response.status,
    body: await bodyOf(response),
    requestId: response.headers.get('x-request-id'),
    traceId: response.headers.get('x-trace-id'),
  }
}

function expectStatus(result, status, label) {
  if (result.status !== status) fail(`${label}: expected ${status}, got ${result.status}`, { status: result.status })
  if (!result.requestId || !result.traceId) fail(`${label}: request/trace correlation missing`)
  return result
}

async function startAuthorization(label) {
  const redirectUri = 'http://127.0.0.1:18180/auth/callback'
  const query = new URLSearchParams({ intent: 'login', redirectUri, returnTo: '/home', uiLocale: 'zh-CN', theme: 'system' })
  const result = await gatewayRequest(null, `/api/v1/auth/oidc/standard-oidc/authorization/start?${query}`, { operation: label })
  expectStatus(result, 200, `${label} authorization start`)
  const authUrl = result.body?.authorizationUrl
  if (typeof authUrl !== 'string' || !authUrl.startsWith('http://127.0.0.1:18099/')) fail('authorization start did not return local Keycloak URL')
  return { authUrl, state: new URL(authUrl).searchParams.get('state'), redirectUri }
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
      if (!location) fail('Keycloak login redirect omitted location')
      const next = new URL(location, url)
      if (next.origin === 'http://127.0.0.1:18180' && next.pathname === '/auth/callback') return next
      url = next.toString(); method = 'GET'; body = undefined; continue
    }
    const html = await response.text()
    if (response.status !== 200) fail(`Keycloak login form failed: HTTP ${response.status}`)
    const form = loginForm(html)
    if (!form) fail('Keycloak did not expose the expected login form')
    if (submitted) fail('Keycloak rejected the synthetic local credentials')
    form.fields.set('username', user.username)
    form.fields.set('password', user.password)
    url = new URL(form.action, url).toString(); method = 'POST'; body = form.fields; submitted = true
  }
  fail('Keycloak authorization flow exceeded redirect limit')
}

async function establishSession(user, label) {
  const start = await startAuthorization(`${label}-authorization-start`)
  const callbackUrl = await authorizationCode(start.authUrl, user)
  const callback = await gatewayRequest(null, '/api/v1/auth/oidc/standard-oidc/callback', {
    method: 'POST',
    operation: `${label}-authorization-callback`,
    idempotencyKey: `${runId}-${label}-callback`,
    body: { code: callbackUrl.searchParams.get('code'), state: start.state, redirectUri: start.redirectUri },
  })
  expectStatus(callback, 200, `${label} authorization callback`)
  if (!callback.body?.session?.accessToken) fail(`${label} callback did not return a session`)
  return callback.body.session
}

function dataOf(body) {
  return body?.data?.data ?? body?.data ?? body ?? {}
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function mysqlNumber(schema, sql) {
  const result = spawnSync('docker', ['exec', mysqlContainer, 'mysql', '-uroot', '-proot-local-only', schema, '-N', '-B', '-e', sql], {
    encoding: 'utf8', windowsHide: true,
  })
  if (result.status !== 0) fail('MySQL owner evidence query failed')
  const value = Number((result.stdout ?? '').trim())
  if (!Number.isFinite(value)) fail('MySQL owner evidence was not numeric')
  return value
}

const checks = []
const admin = await adminToken()
const users = []
try {
  const alice = await createUser(admin, 'alice')
  const bob = await createUser(admin, 'bob')
  users.push(alice, bob)
  const aliceSession = await establishSession(alice, 'alice')
  const bobSession = await establishSession(bob, 'bob')

  const aliceProfile = expectStatus(await gatewayRequest(aliceSession.accessToken, '/api/v1/learner/profile', {
    method: 'PATCH', operation: 'alice-profile', idempotencyKey: `${runId}-alice-profile`,
    body: { expectedStateVersion: 0, uiLocale: 'en-US', contentLocale: 'en-US', timezone: 'UTC' },
  }), 200, 'alice profile write')
  checks.push({ name: 'alice owner write', status: 'PASS', httpStatus: aliceProfile.status })

  const aliceTarget = expectStatus(await gatewayRequest(aliceSession.accessToken, '/api/v1/learner/targets', {
    method: 'PUT', operation: 'alice-target', idempotencyKey: `${runId}-alice-target`,
    body: { expectedStateVersion: 0, goalCode: 'WORKPLACE', targetLevel: 'A1', dailyQuotaMinutes: 15, status: 'ACTIVE' },
  }), 200, 'alice target write')
  checks.push({ name: 'alice target write', status: 'PASS', httpStatus: aliceTarget.status })

  const bobProfile = expectStatus(await gatewayRequest(bobSession.accessToken, '/api/v1/learner/profile', {
    operation: 'bob-profile-read',
  }), 200, 'bob profile read')
  const bobProfileData = dataOf(bobProfile.body)
  if (bobProfileData.principalId === alice.id || bobProfileData.principal_id === alice.id) fail('bob profile resolved to alice subject')
  if ((bobProfileData.uiLocale ?? bobProfileData.ui_locale) === 'en-US') fail('bob profile inherited alice preference')
  checks.push({ name: 'cross-user profile isolation', status: 'PASS', httpStatus: bobProfile.status })

  const bobTarget = await gatewayRequest(bobSession.accessToken, '/api/v1/learner/targets', { operation: 'bob-target-read-before-write' })
  expectStatus(bobTarget, 404, 'bob cannot read alice target')
  checks.push({ name: 'cross-user target isolation', status: 'PASS', httpStatus: bobTarget.status })

  const forged = expectStatus(await gatewayRequest(bobSession.accessToken, '/api/v1/learner/profile', {
    operation: 'bob-forged-owner-header',
    headers: { 'x-owner-id': alice.id, 'x-tenant-id': 'tenant-attacker', 'x-role': 'admin', 'x-b5-role': 'admin' },
  }), 200, 'forged owner headers')
  const forgedData = dataOf(forged.body)
  if ((forgedData.principalId ?? forgedData.principal_id) === alice.id) fail('forged owner header changed resolved subject')
  checks.push({ name: 'forged owner/tenant/role headers ignored', status: 'PASS', httpStatus: forged.status })

  const learnerAdmin = await gatewayRequest(bobSession.accessToken, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'learner-admin-forbidden', idempotencyKey: `${runId}-forbidden-admin`,
    body: {
      command: 'CREATE_DRAFT',
      contentCode: `${runId}-forbidden-content`,
      content: {
        contentType: 'COURSE_UNIT',
        title: 'B35 authorization negative probe',
        summary: 'This command must be rejected before any owner write.',
        contentLocale: 'en-US',
        targetLevel: 'A1',
        sourceCode: 'B35_AUTHZ_NEGATIVE',
        licenseCode: 'LOCAL_DEV_LICENSE',
        items: [],
      },
    },
  })
  expectStatus(learnerAdmin, 403, 'learner cannot use admin content command')
  checks.push({ name: 'valid learner token receives admin 403', status: 'PASS', httpStatus: learnerAdmin.status })

  const db = {
    aliceProfile: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_profile WHERE principal_id=${sqlString(alice.id)} AND ui_locale='en-US' AND timezone='UTC'`),
    aliceGoal: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_goal WHERE principal_id=${sqlString(alice.id)} AND goal_code='WORKPLACE'`),
    bobProfile: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_profile WHERE principal_id=${sqlString(bob.id)}`),
    bobGoal: mysqlNumber('learner_service', `SELECT COUNT(*) FROM b25_learner_goal WHERE principal_id=${sqlString(bob.id)}`),
  }
  if (db.aliceProfile !== 1 || db.aliceGoal !== 1 || db.bobProfile !== 0 || db.bobGoal !== 0) fail('owner facts were not isolated as expected', db)

  console.log(JSON.stringify({ result: 'PASS', runId, checks, db, subjectValuesEmitted: false, tokenValuesEmitted: false, credentialsPersisted: false }, null, 2))
} finally {
  for (const user of users) await deleteUser(admin, user)
}
