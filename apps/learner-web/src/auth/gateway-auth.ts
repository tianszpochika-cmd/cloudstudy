import { ApiError, createApiClient, type ApiAuthSnapshot, type ApiClient, type ApiMethod } from '../api/client'
import { safeInternalReturnTo } from '../platform/gateway'

export type AuthStatus = 'unknown' | 'restoring' | 'unauthenticated' | 'authenticated' | 'refreshing' | 'revoking' | 'error'
export type AdultGateStatus = 'UNKNOWN' | 'REQUIRED' | 'PASSED' | 'REJECTED'

export interface AuthTokenPair {
  accessToken: string
  refreshToken?: string | null
  deviceId?: string | null
  sessionId?: string | null
  userId?: string | null
  accessTokenExpiresAt?: string | null
  refreshTokenExpiresAt?: string | null
  adultGate?: AdultGateStatus
}

export interface PrincipalSnapshot {
  subject: string
  roles: readonly string[]
  permissions: readonly string[]
  adultGate: AdultGateStatus
}

export interface AuthSessionSnapshot {
  readonly principal?: PrincipalSnapshot | null
  readonly permissions?: readonly string[]
  readonly roles?: readonly string[]
  readonly adultGate?: AdultGateStatus
  readonly tokenPair?: AuthTokenPair | null
}

export interface LoginCredentials {
  readonly identifier: string
  readonly password: string
  readonly device: {
    readonly deviceType: 'WEB'
    readonly clientVersion: string
    readonly deviceId?: string
    readonly deviceName?: string
  }
}

export interface JwtAuthAdapter {
  login(input: LoginCredentials): Promise<AuthTokenPair>
  register(input: LoginCredentials): Promise<AuthTokenPair>
  requestPasswordReset(input: { identifier: string }): Promise<{ accepted: boolean }>
  confirmPasswordReset(input: { identifier: string; resetToken: string; newPassword: string }): Promise<void>
  restoreSession(): Promise<AuthSessionSnapshot | null>
  refresh(input?: { refreshToken?: string }): Promise<AuthTokenPair>
  getPermissions(): Promise<AuthSessionSnapshot | null>
  confirmAdultGate(input: { confirmed: true; birthYear: number; policyVersion: string }): Promise<AuthSessionSnapshot | null>
  logout(input: { allDevices?: boolean }): Promise<void>
  revoke(sessionId: string): Promise<void>
}

export function safeReturnTo(value: unknown, fallback = '/home'): string {
  return safeInternalReturnTo(value, fallback)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : typeof value === 'string'
      ? value.split(/\s+/).filter(Boolean)
      : []
}

let loginSequence = 0

function authIdempotencyKey(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`
  loginSequence += 1
  return `${prefix}-${Date.now()}-${loginSequence}`
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isRecord(value.data)) return value.data
  if (isRecord(value.result)) return value.result
  return value
}

function parseAdultGate(value: unknown): AdultGateStatus {
  if (value === 'PASSED' || value === 'REQUIRED' || value === 'REJECTED') return value
  if (!isRecord(value)) return 'UNKNOWN'
  if (value.status === 'APPROVED' || value.status === 'PASSED') return 'PASSED'
  if (value.status === 'PENDING' || value.status === 'REQUIRED') return 'REQUIRED'
  if (value.status === 'REJECTED') return 'REJECTED'
  return 'UNKNOWN'
}

function parseTokenPair(value: unknown): AuthTokenPair {
  const source = unwrap(value)
  if (!isRecord(source)) throw new Error('认证服务没有返回有效会话。')
  const accessToken = stringValue(source.accessToken)
  if (!accessToken) throw new Error('认证服务没有返回有效访问凭证。')
  return {
    accessToken,
    refreshToken: stringValue(source.refreshToken),
    deviceId: stringValue(source.deviceId),
    sessionId: stringValue(source.sessionId),
    userId: stringValue(source.userId),
    accessTokenExpiresAt: stringValue(source.accessTokenExpiresAt),
    refreshTokenExpiresAt: stringValue(source.refreshTokenExpiresAt),
    adultGate: parseAdultGate(source.adultGate ?? source.adultGateStatus),
  }
}

function parseSnapshot(value: unknown): AuthSessionSnapshot | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const principalSource = isRecord(source.principal) ? source.principal : source
  const permissions = stringList(source.permissions ?? principalSource.permissions)
  const roles = stringList(source.roles ?? principalSource.roles)
  const subject = stringValue(principalSource.subject ?? principalSource.sub ?? principalSource.userId ?? principalSource.principalId)
  const adultGate = parseAdultGate(source.adultGate ?? source.adultGateStatus ?? principalSource.adultGate ?? principalSource.adultGateStatus)
  return {
    principal: subject ? { subject, roles, permissions, adultGate } : null,
    permissions,
    roles,
    adultGate,
    tokenPair: source.accessToken ? parseTokenPair(source) : null,
  }
}

export interface GatewayAuthAdapterOptions {
  readonly baseUrl: string
  readonly getAccessToken?: () => string | null
  readonly getAuthSnapshot?: () => ApiAuthSnapshot | null
  readonly fetchImpl?: typeof fetch
}

export function createGatewayAuthAdapter(options: GatewayAuthAdapterOptions): JwtAuthAdapter {
  const client: ApiClient = createApiClient({
    baseUrl: options.baseUrl,
    getAccessToken: options.getAccessToken,
    getAuthSnapshot: options.getAuthSnapshot,
    isBootstrapAuthPath: (path: string, method: ApiMethod) =>
      (method === 'GET' && (path === '/iam/principal/me' || path === '/iam/permissions'))
      || (method === 'POST' && (path === '/auth/token/refresh' || path === '/auth/logout'
        || /^\/auth\/sessions\/[^/]+\/revoke$/.test(path))),
    fetchImpl: options.fetchImpl,
    credentials: 'include',
  })

  return {
    async login(input) {
      return parseTokenPair(await client.post('/auth/login', input, {
        headers: { 'Idempotency-Key': authIdempotencyKey('login') },
        skipAuthRetry: true,
      }))
    },
    async register(input) {
      return parseTokenPair(await client.post('/auth/register', input, {
        headers: { 'Idempotency-Key': authIdempotencyKey('register') },
        skipAuthRetry: true,
      }))
    },
    async requestPasswordReset(input) {
      const raw = await client.post('/auth/password-reset/request', input, {
        headers: { 'Idempotency-Key': authIdempotencyKey('pwd-request') },
        skipAuthRetry: true,
      })
      const data = unwrap(raw);
      return { accepted: true, ...((data && typeof data === 'object' ? data : {}) as object) };
    },
    async confirmPasswordReset(input) {
      await client.post('/auth/password-reset/confirm', input, {
        headers: { 'Idempotency-Key': authIdempotencyKey('pwd-confirm') },
        skipAuthRetry: true,
      })
    },
    async restoreSession() {
      try {
        return parseSnapshot(await client.get('/iam/principal/me', { skipAuthRetry: true }))
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return null
        throw error
      }
    },
    async refresh(input) {
      const body = input?.refreshToken ? { refreshToken: input.refreshToken } : undefined
      return parseTokenPair(await client.post('/auth/token/refresh', body, {
        headers: { 'Idempotency-Key': authIdempotencyKey('refresh') },
        skipAuthRetry: true,
      }))
    },
    async getPermissions() {
      try {
        return parseSnapshot(await client.get('/iam/permissions', { skipAuthRetry: true }))
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return null
        throw error
      }
    },
    async confirmAdultGate(input) {
      const raw = await client.post('/iam/adult-gate', input, {
        headers: { 'Idempotency-Key': authIdempotencyKey('adult-gate') },
        skipAuthRetry: true,
      })
      const snapshot = parseSnapshot(raw)
      // P1-LIVE-014: the adult-gate endpoint returns {status: 'PASSED'|...},
      // not an adultGate field. Map it explicitly; parseSnapshot alone yields
      // UNKNOWN and the onboarding flow stalls on step 1.
      const gate = parseAdultGate(isRecord(unwrap(raw)) ? (unwrap(raw) as Record<string, unknown>).status : undefined)
      if (gate === 'UNKNOWN') return snapshot
      return {
        principal: snapshot?.principal ? { ...snapshot.principal, adultGate: gate } : snapshot?.principal ?? null,
        permissions: snapshot?.permissions ?? [],
        roles: snapshot?.roles ?? [],
        adultGate: gate,
        tokenPair: snapshot?.tokenPair ?? null,
      }
    },
    async logout(input) {
      await client.post('/auth/logout', input, {
        headers: { 'Idempotency-Key': authIdempotencyKey('logout') },
        skipAuthRetry: true,
      })
    },
    async revoke(sessionId) {
      await client.post(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {}, {
        headers: { 'Idempotency-Key': authIdempotencyKey('revoke') },
        skipAuthRetry: true,
      })
    },
  }
}
