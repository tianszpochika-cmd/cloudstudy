import type { AdminApiClient } from '../api/client'
import { safeInternalReturnTo } from '../platform/gateway'

export interface AdminTokenPair {
  accessToken: string
  refreshToken?: string | null
  deviceId?: string | null
  sessionId?: string | null
}

export interface AdminPrincipalSnapshot {
  subject: string
  roles: readonly string[]
  permissions: readonly string[]
}

export interface AdminAuthSnapshot {
  readonly principal?: AdminPrincipalSnapshot | null
  readonly roles?: readonly string[]
  readonly permissions?: readonly string[]
  readonly tokenPair?: AdminTokenPair | null
}

export interface AdminAuthAdapter {
  startLogin(options: { returnTo: string; locale: string; theme: string }): Promise<string>
  completeLogin(input: { code?: string; state?: string; error?: string; errorDescription?: string }): Promise<AdminTokenPair>
  restoreSession(): Promise<AdminAuthSnapshot | null>
  refresh(input: { refreshToken: string }): Promise<AdminTokenPair>
  getPermissions(): Promise<AdminAuthSnapshot | null>
  logout(): Promise<void>
}

const OIDC_PROVIDER = 'standard-oidc'

export function safeAdminReturnTo(value: unknown, fallback = '/dashboard'): string {
  return safeInternalReturnTo(value, fallback)
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown { if (!record(value)) return value; return record(value.data) ? value.data : record(value.result) ? value.result : value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function list(value: unknown): readonly string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : [] }
function parsePair(value: unknown): AdminTokenPair {
  const source = unwrap(value)
  const session = record(source) && record(source.session) ? source.session : source
  if (!record(session) || !text(session.accessToken)) throw new Error('认证服务没有返回有效管理员会话。')
  return { accessToken: text(session.accessToken) as string, refreshToken: text(session.refreshToken), deviceId: text(session.deviceId), sessionId: text(session.sessionId) }
}
function parseSnapshot(value: unknown): AdminAuthSnapshot | null {
  const source = unwrap(value)
  if (!record(source)) return null
  const principalSource = record(source.principal) ? source.principal : source
  const roles = list(source.roles ?? principalSource.roles)
  const permissions = list(source.permissions ?? principalSource.permissions)
  const subject = text(principalSource.subject ?? principalSource.sub ?? principalSource.userId ?? principalSource.principalId)
  return {
    principal: subject ? { subject, roles, permissions } : null,
    roles,
    permissions,
    tokenPair: source.accessToken || record(source.session) ? parsePair(source) : null,
  }
}
function joinUrl(baseUrl: string, path: string): string { const base = baseUrl.replace(/\/$/, ''); return path.startsWith('/') ? `${base}${path}` : `${base}/${path}` }

function validAuthorizationUrl(value: unknown): string {
  const candidate = text(value)
  if (!candidate) throw new Error('认证服务没有返回授权地址。')
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('认证服务返回了不安全的授权地址。')
    return url.toString()
  } catch (error) {
    if (error instanceof Error && error.message.includes('不安全')) throw error
    throw new Error('认证服务返回了无效的授权地址。')
  }
}

export function createGatewayAdminAuthAdapter(options: { baseUrl: string; client: AdminApiClient; getAccessToken?: () => string | null }): AdminAuthAdapter {
  return {
    async startLogin(input) {
      const url = new URL(joinUrl(options.baseUrl, `/auth/oidc/${OIDC_PROVIDER}/authorization/start`))
      url.searchParams.set('redirectUri', `${window.location.origin}/auth/callback`)
      url.searchParams.set('returnTo', safeAdminReturnTo(input.returnTo))
      url.searchParams.set('uiLocale', input.locale)
      url.searchParams.set('theme', input.theme)
      const response = await options.client.request<{ authorizationUrl?: string }>(`/auth/oidc/${OIDC_PROVIDER}/authorization/start${url.search}`, { method: 'GET', skipAuthRetry: true })
      const source = unwrap(response)
      return validAuthorizationUrl(record(source) ? source.authorizationUrl : undefined)
    },
    async completeLogin(input) {
      if (input.error) throw new Error(input.errorDescription || input.error)
      if (!input.code || !input.state) throw new Error('认证回调缺少 code 或 state，未建立管理员会话。')
      return parsePair(await options.client.request(`/auth/oidc/${OIDC_PROVIDER}/callback`, { method: 'POST', body: { code: input.code, state: input.state, redirectUri: `${window.location.origin}/auth/callback` }, skipAuthRetry: true }))
    },
    async restoreSession() {
      try { return parseSnapshot(await options.client.request('/iam/principal/me', { skipAuthRetry: true })) } catch (error) { if (error instanceof Error && 'status' in error && ((error as { status?: number }).status === 401 || (error as { status?: number }).status === 404)) return null; throw error }
    },
    async refresh(input) { return parsePair(await options.client.request('/iam/session/refresh', { method: 'POST', body: input, skipAuthRetry: true })) },
    async getPermissions() {
      try { return parseSnapshot(await options.client.request('/iam/permissions', { skipAuthRetry: true })) } catch (error) { if (error instanceof Error && 'status' in error && ((error as { status?: number }).status === 401 || (error as { status?: number }).status === 404)) return null; throw error }
    },
    async logout() { await options.client.request('/iam/session/logout', { method: 'POST', body: {}, skipAuthRetry: true }) },
  }
}
