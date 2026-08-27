import { mobileApiClient, MobileApiError } from '../api/client'
import { getGatewayBaseUrl, safeInternalReturnTo } from '../platform/gateway'
import { getUniRuntime, openUniPage } from '../platform/uni-runtime'

export type MobileAdultGateStatus = 'UNKNOWN' | 'REQUIRED' | 'PASSED' | 'REJECTED'
export interface MobileTokenPair { accessToken: string; refreshToken?: string | null; deviceId?: string | null; sessionId?: string | null; userId?: string | null; adultGate?: MobileAdultGateStatus }
export interface MobileAuthSnapshot { readonly subject?: string; readonly permissions?: readonly string[]; readonly roles?: readonly string[]; readonly adultGate?: MobileAdultGateStatus; readonly tokenPair?: MobileTokenPair | null }
export interface MobileCallbackInput { code?: string; state?: string; error?: string; errorDescription?: string; errorUri?: string; returnTo?: string }
export interface MobileAuthAdapter {
  startLogin(input: { returnTo: string; locale: string; theme: string }): string | Promise<string>
  completeLogin(input: MobileCallbackInput): Promise<MobileTokenPair>
  restoreSession(): Promise<MobileAuthSnapshot | null>
  refresh(input: { refreshToken: string }): Promise<MobileTokenPair>
  getPermissions(): Promise<MobileAuthSnapshot | null>
  confirmAdultGate(input: { birthYear: number; policyVersion: string; adultDeclaration: true }): Promise<MobileAuthSnapshot | null>
  logout(): Promise<void>
  revoke(sessionId: string): Promise<void>
}

const OIDC_PROVIDER = 'standard-oidc'
const MOBILE_OIDC_TRANSACTION_TTL_MS = 5 * 60 * 1000

// The login page starts a restore request and an OIDC request in parallel. Keep
// a short-lived in-memory marker so a 401 from restore cannot erase the state
// that prepareLogin is about to persist. This marker never authenticates a
// session and expires on its own.
let pendingOidcTransactionStartedAt = 0

function markPendingOidcTransaction(): void { pendingOidcTransactionStartedAt = Date.now() }
function clearPendingOidcTransaction(): void { pendingOidcTransactionStartedAt = 0 }
function hasPendingOidcTransaction(): boolean {
  return pendingOidcTransactionStartedAt > 0
    && Date.now() - pendingOidcTransactionStartedAt < MOBILE_OIDC_TRANSACTION_TTL_MS
}

interface MobileAuthorizationStartResponse { authorizationUrl?: string; transactionId?: string; provider?: string; expiresAt?: string }

function configuredRedirectUri(): string | null {
  const env = (import.meta as ImportMeta & { readonly env?: Record<string, unknown> }).env ?? {}
  const value = env.VITE_MOBILE_OIDC_REDIRECT_URI
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The redirect URI is a platform boundary; it never contains an access token or a client secret. */
export function getMobileOidcRedirectUri(): string {
  const configured = configuredRedirectUri()
  if (configured) return configured
  if (typeof window !== 'undefined' && window.location?.origin) {
    // OIDC redirect URIs cannot contain a URL fragment. The H5 app bridges
    // this path back into the uni-app callback page after the IdP redirects.
    return `${window.location.origin}/auth/callback`
  }
  return 'englishflow://auth/callback'
}

export function safeMobileReturnTo(value: unknown, fallback = '/pages/home/home'): string {
  return safeInternalReturnTo(value, fallback)
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown { if (!record(value)) return value; return record(value.data) ? value.data : record(value.result) ? value.result : value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function list(value: unknown): readonly string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : [] }
function adult(value: unknown): MobileAdultGateStatus { if (value === 'PASSED' || value === 'REQUIRED' || value === 'REJECTED') return value; if (!record(value)) return 'UNKNOWN'; if (value.status === 'APPROVED') return 'PASSED'; if (value.status === 'PENDING') return 'REQUIRED'; if (value.status === 'REJECTED') return 'REJECTED'; return 'UNKNOWN' }
function pair(value: unknown): MobileTokenPair { const source = unwrap(value); const session = record(source) && record(source.session) ? source.session : source; if (!record(session) || !text(session.accessToken ?? session.access_token)) throw new Error('认证服务没有返回有效移动会话。'); return { accessToken: text(session.accessToken ?? session.access_token) as string, refreshToken: text(session.refreshToken ?? session.refresh_token), deviceId: text(session.deviceId ?? session.device_id), sessionId: text(session.sessionId ?? session.session_id), userId: session.userId === undefined || session.userId === null ? null : String(session.userId), adultGate: adult(record(source) ? source.adultGate ?? source.adultGateStatus : undefined) } }
function snapshot(value: unknown): MobileAuthSnapshot | null { const source = unwrap(value); if (!record(source)) return null; const principal = record(source.principal) ? source.principal : source; return { subject: text(principal.subject ?? principal.sub ?? principal.userId ?? principal.principalId) ?? undefined, permissions: list(source.permissions ?? principal.permissions), roles: list(source.roles ?? principal.roles), adultGate: adult(source.adultGate ?? source.adultGateStatus ?? principal.adultGate ?? source), tokenPair: source.accessToken || record(source.session) ? pair(source) : null } }

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

function scheduleMobileLogoutRedirect(): void {
  setTimeout(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
        window.location.assign(`${window.location.origin}/#/pages/login/login`)
        return
      }
      const runtime = getUniRuntime()
      if (runtime.reLaunch) runtime.reLaunch({ url: '/pages/login/login' })
      else if (runtime.redirectTo) runtime.redirectTo({ url: '/pages/login/login' })
      else openUniPage('/pages/login/login')
    } catch {
      // The session store has already cleared local credentials; a later app
      // bootstrap will apply the normal unauthenticated navigation guard.
    }
  }, 0)
}

export function createGatewayMobileAuthAdapter(baseUrl: string = getGatewayBaseUrl()): MobileAuthAdapter {
  return {
    async startLogin(input) {
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/auth/oidc/${OIDC_PROVIDER}/authorization/start`)
      url.searchParams.set('redirectUri', getMobileOidcRedirectUri())
      url.searchParams.set('returnTo', safeMobileReturnTo(input.returnTo))
      url.searchParams.set('uiLocale', input.locale)
      url.searchParams.set('theme', input.theme)
      const response = await mobileApiClient.request<MobileAuthorizationStartResponse>(`/auth/oidc/${OIDC_PROVIDER}/authorization/start${url.search}`, { skipAuthRetry: true })
      const source = unwrap(response)
      const authorizationUrl = validAuthorizationUrl(record(source) ? source.authorizationUrl : undefined)
      markPendingOidcTransaction()
      return authorizationUrl
    },
    async completeLogin(input) { clearPendingOidcTransaction(); if (input.error) throw new Error(input.errorDescription || input.error); if (!input.code || !input.state) throw new Error('认证回调缺少 code 或 state，未建立移动会话。'); return pair(await mobileApiClient.request(`/auth/oidc/${OIDC_PROVIDER}/callback`, { method: 'POST', data: { code: input.code, state: input.state, redirectUri: getMobileOidcRedirectUri(), ...(input.errorUri ? { errorUri: input.errorUri } : {}) }, skipAuthRetry: true })) },
    async restoreSession() { try { return snapshot(await mobileApiClient.request('/iam/principal/me', { skipAuthRetry: true })) } catch (error) { if (error instanceof MobileApiError && (error.status === 401 || error.status === 404)) return hasPendingOidcTransaction() ? {} : null; throw error } },
    async refresh(input) { return pair(await mobileApiClient.request('/iam/session/refresh', { method: 'POST', data: input, skipAuthRetry: true })) },
    async getPermissions() { try { return snapshot(await mobileApiClient.request('/iam/permissions', { skipAuthRetry: true })) } catch (error) { if (error instanceof MobileApiError && (error.status === 401 || error.status === 404)) return null; throw error } },
    async confirmAdultGate(input) { return snapshot(await mobileApiClient.request('/iam/adult-gate', { method: 'POST', data: input, skipAuthRetry: true })) },
    async logout() {
      try { await mobileApiClient.request('/iam/session/logout', { method: 'POST', data: {}, skipAuthRetry: true }) }
      finally { scheduleMobileLogoutRedirect() }
    },
    async revoke(sessionId) { await mobileApiClient.request(`/iam/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST', data: {}, skipAuthRetry: true }) },
  }
}
