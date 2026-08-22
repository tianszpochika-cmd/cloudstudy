import { mobileApiClient, MobileApiError } from '../api/client'
import { getGatewayBaseUrl, safeInternalReturnTo } from '../platform/gateway'

export type MobileAdultGateStatus = 'UNKNOWN' | 'REQUIRED' | 'PASSED' | 'REJECTED'
export interface MobileTokenPair { accessToken: string; refreshToken?: string | null; deviceId?: string | null; sessionId?: string | null; userId?: string | null; adultGate?: MobileAdultGateStatus }
export interface MobileAuthSnapshot { readonly subject?: string; readonly permissions?: readonly string[]; readonly roles?: readonly string[]; readonly adultGate?: MobileAdultGateStatus; readonly tokenPair?: MobileTokenPair | null }
export interface MobileCallbackInput { code?: string; state?: string; error?: string; errorDescription?: string; returnTo?: string }
export interface MobileAuthAdapter {
  startLogin(input: { returnTo: string; locale: string; theme: string }): string
  completeLogin(input: MobileCallbackInput): Promise<MobileTokenPair>
  restoreSession(): Promise<MobileAuthSnapshot | null>
  refresh(input: { refreshToken: string }): Promise<MobileTokenPair>
  getPermissions(): Promise<MobileAuthSnapshot | null>
  confirmAdultGate(input: { birthYear: number; policyVersion: string; adultDeclaration: true }): Promise<MobileAuthSnapshot | null>
  logout(): Promise<void>
  revoke(sessionId: string): Promise<void>
}

const OIDC_PROVIDER = 'standard-oidc'

export function safeMobileReturnTo(value: unknown, fallback = '/pages/home/home'): string {
  return safeInternalReturnTo(value, fallback)
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown { if (!record(value)) return value; return record(value.data) ? value.data : record(value.result) ? value.result : value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function list(value: unknown): readonly string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : [] }
function adult(value: unknown): MobileAdultGateStatus { if (value === 'PASSED' || value === 'REQUIRED' || value === 'REJECTED') return value; if (!record(value)) return 'UNKNOWN'; if (value.status === 'APPROVED') return 'PASSED'; if (value.status === 'PENDING') return 'REQUIRED'; if (value.status === 'REJECTED') return 'REJECTED'; return 'UNKNOWN' }
function pair(value: unknown): MobileTokenPair { const source = unwrap(value); const session = record(source) && record(source.session) ? source.session : source; if (!record(session) || !text(session.accessToken)) throw new Error('认证服务没有返回有效移动会话。'); return { accessToken: text(session.accessToken) as string, refreshToken: text(session.refreshToken), deviceId: text(session.deviceId), sessionId: text(session.sessionId), userId: session.userId === undefined || session.userId === null ? null : String(session.userId), adultGate: adult(record(source) ? source.adultGate ?? source.adultGateStatus : undefined) } }
function snapshot(value: unknown): MobileAuthSnapshot | null { const source = unwrap(value); if (!record(source)) return null; const principal = record(source.principal) ? source.principal : source; return { subject: text(principal.subject ?? principal.sub ?? principal.userId ?? principal.principalId) ?? undefined, permissions: list(source.permissions ?? principal.permissions), roles: list(source.roles ?? principal.roles), adultGate: adult(source.adultGate ?? source.adultGateStatus ?? principal.adultGate), tokenPair: source.accessToken || record(source.session) ? pair(source) : null } }

export function createGatewayMobileAuthAdapter(baseUrl: string = getGatewayBaseUrl()): MobileAuthAdapter {
  return {
    startLogin(input) {
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/auth/oidc/${OIDC_PROVIDER}/authorization/start`)
      url.searchParams.set('redirectUri', 'englishflow://auth/callback')
      url.searchParams.set('returnTo', safeMobileReturnTo(input.returnTo))
      url.searchParams.set('uiLocale', input.locale)
      url.searchParams.set('theme', input.theme)
      return url.toString()
    },
    async completeLogin(input) { if (input.error) throw new Error(input.errorDescription || input.error); if (!input.code || !input.state) throw new Error('认证回调缺少 code 或 state，未建立移动会话。'); return pair(await mobileApiClient.request(`/auth/oidc/${OIDC_PROVIDER}/callback`, { method: 'POST', data: { code: input.code, state: input.state, redirectUri: 'englishflow://auth/callback' }, skipAuthRetry: true })) },
    async restoreSession() { try { return snapshot(await mobileApiClient.request('/iam/principal/me', { skipAuthRetry: true })) } catch (error) { if (error instanceof MobileApiError && (error.status === 401 || error.status === 404)) return null; throw error } },
    async refresh(input) { return pair(await mobileApiClient.request('/iam/session/refresh', { method: 'POST', data: input, skipAuthRetry: true })) },
    async getPermissions() { try { return snapshot(await mobileApiClient.request('/iam/permissions', { skipAuthRetry: true })) } catch (error) { if (error instanceof MobileApiError && (error.status === 401 || error.status === 404)) return null; throw error } },
    async confirmAdultGate(input) { return snapshot(await mobileApiClient.request('/iam/adult-gate', { method: 'POST', data: input, skipAuthRetry: true })) },
    async logout() { await mobileApiClient.request('/iam/session/logout', { method: 'POST', data: {}, skipAuthRetry: true }) },
    async revoke(sessionId) { await mobileApiClient.request(`/iam/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST', data: {}, skipAuthRetry: true }) },
  }
}
