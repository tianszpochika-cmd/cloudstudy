import { ApiError, createApiClient, type ApiClient } from '../api/client'
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

export interface LoginStartOptions {
  readonly returnTo: string
  readonly locale: string
  readonly theme: string
}

export interface LoginCallbackInput {
  readonly code?: string
  readonly state?: string
  readonly returnTo?: string
  readonly error?: string
  readonly errorDescription?: string
}

export interface ProviderNeutralAuthAdapter {
  startLogin(options: LoginStartOptions): string
  completeLogin(input: LoginCallbackInput): Promise<AuthTokenPair & { adultGate?: AdultGateStatus }>
  restoreSession(): Promise<AuthSessionSnapshot | null>
  refresh(input: { refreshToken: string }): Promise<AuthTokenPair>
  getPermissions(): Promise<AuthSessionSnapshot | null>
  confirmAdultGate(input: { birthYear: number; policyVersion: string; adultDeclaration: true }): Promise<AuthSessionSnapshot | null>
  logout(input: { allDevices?: boolean }): Promise<void>
  revoke(sessionId: string): Promise<void>
}

const OIDC_PROVIDER = 'standard-oidc'

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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : []
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
  if (value.status === 'APPROVED') return 'PASSED'
  if (value.status === 'PENDING') return 'REQUIRED'
  if (value.status === 'REJECTED') return 'REJECTED'
  return 'UNKNOWN'
}

function parseTokenPair(value: unknown): AuthTokenPair {
  const source = unwrap(value)
  if (!isRecord(source)) throw new Error('认证服务没有返回有效会话。')
  const session = isRecord(source.session) ? source.session : source
  const accessToken = stringValue(session.accessToken)
  if (!accessToken) throw new Error('认证服务没有返回有效访问凭证。')
  return {
    accessToken,
    refreshToken: stringValue(session.refreshToken),
    deviceId: stringValue(session.deviceId),
    sessionId: stringValue(session.sessionId),
    userId: session.userId === undefined || session.userId === null ? null : String(session.userId),
    accessTokenExpiresAt: stringValue(session.accessTokenExpiresAt),
    refreshTokenExpiresAt: stringValue(session.refreshTokenExpiresAt),
    adultGate: parseAdultGate(source.adultGate ?? source.adultGateStatus ?? session.adultGate),
  }
}

function parseSnapshot(value: unknown): AuthSessionSnapshot | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const principalSource = isRecord(source.principal) ? source.principal : source
  const permissions = stringList(source.permissions ?? principalSource.permissions)
  const roles = stringList(source.roles ?? principalSource.roles)
  const subject = stringValue(principalSource.subject ?? principalSource.sub ?? principalSource.userId ?? principalSource.principalId)
  const adultGate = parseAdultGate(source.adultGate ?? source.adultGateStatus ?? principalSource.adultGate)
  const principal = subject ? { subject, roles, permissions, adultGate } : null
  return {
    principal,
    permissions,
    roles,
    adultGate,
    tokenPair: source.accessToken || isRecord(source.session) ? parseTokenPair(source) : null,
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export interface GatewayAuthAdapterOptions {
  readonly baseUrl: string
  readonly getAccessToken?: () => string | null
  readonly fetchImpl?: typeof fetch
  readonly clientId?: string
  readonly redirectUri?: string
}

export function createGatewayAuthAdapter(options: GatewayAuthAdapterOptions): ProviderNeutralAuthAdapter {
  const client: ApiClient = createApiClient({
    baseUrl: options.baseUrl,
    getAccessToken: options.getAccessToken,
    fetchImpl: options.fetchImpl,
    credentials: 'include',
  })

  return {
    startLogin(input) {
      const url = new URL(joinUrl(options.baseUrl, `/auth/oidc/${OIDC_PROVIDER}/authorization/start`))
      url.searchParams.set('redirectUri', options.redirectUri ?? `${window.location.origin}/auth/callback`)
      url.searchParams.set('returnTo', safeReturnTo(input.returnTo))
      url.searchParams.set('uiLocale', input.locale)
      url.searchParams.set('theme', input.theme)
      return url.toString()
    },
    async completeLogin(input) {
      if (input.error) throw new Error(input.errorDescription || input.error)
      if (!input.code || !input.state) throw new Error('认证回调缺少 code 或 state，未建立会话。')
      return parseTokenPair(await client.post(`/auth/oidc/${OIDC_PROVIDER}/callback`, {
        code: input.code,
        state: input.state,
        redirectUri: options.redirectUri ?? `${window.location.origin}/auth/callback`,
      }, { skipAuthRetry: true }))
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
      return parseTokenPair(await client.post('/iam/session/refresh', input, { skipAuthRetry: true }))
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
      return parseSnapshot(await client.post('/iam/adult-gate', input, { skipAuthRetry: true }))
    },
    async logout(input) {
      await client.post('/iam/session/logout', input, { skipAuthRetry: true })
    },
    async revoke(sessionId) {
      await client.post(`/iam/sessions/${encodeURIComponent(sessionId)}/revoke`, {}, { skipAuthRetry: true })
    },
  }
}
