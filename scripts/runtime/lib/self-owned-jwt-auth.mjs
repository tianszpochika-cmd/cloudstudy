import crypto from 'node:crypto'

export const gatewayOrigin = process.env.AUTH_GATEWAY_ORIGIN ?? process.env.B31_GATEWAY ?? 'http://127.0.0.1:18070'
export const authRunId = process.env.AUTH_RUN_ID ?? `jwt-runtime-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
export const authTraceId = crypto.createHash('sha256').update(`${authRunId}:trace`).digest('hex').slice(0, 32)

export function fail(message, details = undefined) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function bodyOf(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text.slice(0, 500) }
}

export async function gatewayRequest(token, pathname, options = {}) {
  const operation = options.operation ?? 'request'
  const headers = {
    accept: 'application/json',
    'x-request-id': `${options.runId ?? authRunId}-${operation}`.slice(0, 120),
    'x-trace-id': options.traceId ?? authTraceId,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.platform ? { 'x-client-platform': options.platform } : {}),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.headers ?? {}),
  }
  const response = await fetch(`${options.origin ?? gatewayOrigin}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  return {
    status: response.status,
    body: await bodyOf(response),
    requestId: response.headers.get('x-request-id'),
    traceId: response.headers.get('x-trace-id'),
    headers: response.headers,
  }
}

export function expectStatus(result, expected, operation) {
  if (result.status !== expected) fail(`${operation}: expected HTTP ${expected}, got ${result.status}`, result.body)
  return result
}

export function decodeJwtPayload(accessToken) {
  const parts = String(accessToken ?? '').split('.')
  if (parts.length !== 3) fail('IAM response did not contain a compact JWT access token')
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) } catch { fail('IAM access token payload was not valid JSON') }
}

function deviceInput(deviceId = crypto.randomUUID(), deviceType = 'ANDROID') {
  return { deviceId, deviceType, deviceName: 'automated-auth-runtime', osVersion: 'test', clientVersion: 'local' }
}

function sessionFrom(result, identifier, password, deviceId) {
  const body = result.body
  if (!body?.accessToken || !body?.sessionId || !body?.deviceId) fail('IAM auth response did not contain an access token and session facts', body)
  const claims = decodeJwtPayload(body.accessToken)
  const expectedAudience = process.env.AUTH_JWT_AUDIENCE ?? 'yuxuexing-api'
  const expectedIssuer = process.env.AUTH_JWT_ISSUER ?? 'http://127.0.0.1:18087'
  if (claims.iss !== expectedIssuer || claims.aud !== expectedAudience || claims.token_type !== 'access') {
    fail('IAM JWT claims did not match the platform validation boundary', { issuer: claims.iss, audience: claims.aud, tokenType: claims.token_type })
  }
  for (const claim of ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'scope', 'permissions', 'roles', 'session_id']) {
    if (claims[claim] === undefined || claims[claim] === null || claims[claim] === '') fail(`IAM JWT is missing required claim ${claim}`)
  }
  return {
    identifier,
    password,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? null,
    sessionId: body.sessionId,
    deviceId: body.deviceId,
    subject: claims.sub,
    claims,
    refreshExpiresIn: body.refreshExpiresIn,
  }
}

export async function registerAccount({ identifier, password, deviceId = crypto.randomUUID(), platform = 'ANDROID', runId = authRunId } = {}) {
  const result = await gatewayRequest(null, '/api/v1/auth/register', {
    method: 'POST', platform, runId, operation: 'register', idempotencyKey: `${runId}-register`,
    body: { identifier, password, device: deviceInput(deviceId, platform) },
  })
  expectStatus(result, 201, 'account registration')
  return sessionFrom(result, identifier, password, deviceId)
}

export async function loginAccount({ identifier, password, deviceId = crypto.randomUUID(), platform = 'ANDROID', runId = authRunId } = {}) {
  const result = await gatewayRequest(null, '/api/v1/auth/login', {
    method: 'POST', platform, runId, operation: 'login', idempotencyKey: `${runId}-login-${deviceId}`,
    body: { identifier, password, device: deviceInput(deviceId, platform) },
  })
  expectStatus(result, 200, 'account login')
  return sessionFrom(result, identifier, password, deviceId)
}

export async function refreshAccount(session, { platform = 'ANDROID', runId = authRunId } = {}) {
  if (!session?.refreshToken) fail('native auth runtime requires an opaque refresh credential from IAM')
  const result = await gatewayRequest(null, '/api/v1/auth/token/refresh', {
    method: 'POST', platform, runId, operation: 'refresh', idempotencyKey: `${runId}-refresh-${session.deviceId}`,
    body: { refreshToken: session.refreshToken },
  })
  expectStatus(result, 200, 'refresh token rotation')
  return sessionFrom(result, session.identifier, session.password, session.deviceId)
}

export async function logoutAccount(session, { allDevices = false, runId = authRunId } = {}) {
  const result = await gatewayRequest(session?.accessToken, '/api/v1/auth/logout', {
    method: 'POST', platform: 'ANDROID', runId, operation: 'logout', idempotencyKey: `${runId}-logout-${session.sessionId}`,
    body: { allDevices },
  })
  expectStatus(result, 200, 'logout')
  return result
}

export async function revokeSession(session, { runId = authRunId } = {}) {
  const result = await gatewayRequest(session?.accessToken, `/api/v1/auth/sessions/${encodeURIComponent(session.sessionId)}/revoke`, {
    method: 'POST', platform: 'ANDROID', runId, operation: 'revoke-session', idempotencyKey: `${runId}-revoke-${session.sessionId}`,
  })
  expectStatus(result, 200, 'session revoke')
  return result
}
