import { createPinia, defineStore } from 'pinia'
import { createGatewayAdminAuthAdapter, safeAdminReturnTo, type AdminAuthAdapter, type AdminAuthSnapshot, type AdminTokenPair, type AdminPrincipalSnapshot } from '../auth/gateway-auth'
import { adminClient } from '../api/client'
import { getGatewayBaseUrl } from '../platform/gateway'
import { adminI18nAdapter, adminThemeController } from '../platform/v2-foundation'

export const pinia = createPinia()

const ACCESS_TOKEN_KEY = 'englishflow.admin.access-token'
const DEVICE_ID_KEY = 'englishflow.admin.device-id'
const SESSION_ID_KEY = 'englishflow.admin.session-id'
const RETURN_TO_KEY = 'englishflow.admin.return-to'
let activeAdapter: AdminAuthAdapter | null = null
let refreshPromise: Promise<boolean> | null = null
let restorePromise: Promise<void> | null = null

function stored(key: string): string | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(key)
  return value && value.trim() ? value.trim() : null
}
function adapter(): AdminAuthAdapter {
  if (!activeAdapter) activeAdapter = createGatewayAdminAuthAdapter({ baseUrl: getGatewayBaseUrl(), client: adminClient, getAccessToken: () => stored(ACCESS_TOKEN_KEY) })
  return activeAdapter
}

export const useAdminStore = defineStore('admin-session', {
  state: () => ({ accessToken: '', refreshToken: null as string | null, deviceId: '', sessionId: '', principal: null as AdminPrincipalSnapshot | null, permissions: [] as string[], status: 'unknown' as 'unknown' | 'restoring' | 'authenticated' | 'refreshing' | 'revoking' | 'unauthenticated' | 'error', restored: false, lastError: null as string | null, forbiddenPath: '', forbiddenPermission: '', forbiddenReason: '' }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken),
    roles: (state): readonly string[] => state.principal?.roles ?? [],
    primaryRole: (state): string => state.principal?.roles[0] ?? '—',
    can: (state) => (permission: string): boolean => state.permissions.includes(permission),
  },
  actions: {
    async restore(): Promise<void> {
      if (this.restored) return
      if (restorePromise) return restorePromise
      restorePromise = (async () => {
        this.status = 'restoring'
        this.accessToken = stored(ACCESS_TOKEN_KEY) ?? ''
        this.deviceId = stored(DEVICE_ID_KEY) ?? ''
        this.sessionId = stored(SESSION_ID_KEY) ?? ''
        try {
          if (!this.accessToken) { this.clear(); return }
          const snapshot = await adapter().restoreSession()
          if (!snapshot) { this.markSessionExpired(); return }
          this.applySnapshot(snapshot)
          const permissions = await adapter().getPermissions()
          if (!permissions) { this.markSessionExpired(); return }
          this.applySnapshot(permissions)
          this.status = 'authenticated'
        } catch (error) {
          this.clear()
          this.lastError = error instanceof Error ? error.message : 'SESSION_RESTORE_FAILED'
          this.status = 'error'
        } finally { this.restored = true }
      })().finally(() => { restorePromise = null })
      return restorePromise
    },
    applySnapshot(snapshot: AdminAuthSnapshot | null): void {
      if (!snapshot) return
      if (snapshot.tokenPair) this.setTokenPair(snapshot.tokenPair)
      if (snapshot.principal) this.principal = snapshot.principal
      this.permissions = [...(snapshot.permissions ?? snapshot.principal?.permissions ?? [])]
    },
    setTokenPair(pair: AdminTokenPair): void {
      if (!pair.accessToken.trim()) throw new Error('认证服务没有返回访问凭证。')
      this.accessToken = pair.accessToken.trim()
      this.refreshToken = pair.refreshToken?.trim() || null
      this.deviceId = pair.deviceId?.trim() || this.deviceId
      this.sessionId = pair.sessionId?.trim() || this.sessionId
      this.status = 'authenticated'
      this.lastError = null
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ACCESS_TOKEN_KEY, this.accessToken)
        if (this.deviceId) window.sessionStorage.setItem(DEVICE_ID_KEY, this.deviceId)
        if (this.sessionId) window.sessionStorage.setItem(SESSION_ID_KEY, this.sessionId)
        window.sessionStorage.removeItem('englishflow.admin.refresh-token')
        window.sessionStorage.removeItem('englishflow.admin.role')
      }
    },
      async prepareLogin(returnTo: unknown): Promise<string> {
        const safe = safeAdminReturnTo(returnTo)
        this.setReturnTo(safe)
        return adapter().startLogin({ returnTo: safe, locale: adminI18nAdapter.state.locale, theme: adminThemeController.resolvedTheme })
      },
    async completeLogin(input: { code?: string; state?: string; error?: string; errorDescription?: string; returnTo?: string }): Promise<boolean> {
      if (input.returnTo) this.setReturnTo(input.returnTo)
      this.status = 'restoring'
      try {
        this.setTokenPair(await adapter().completeLogin(input))
        const permissions = await adapter().getPermissions()
        if (!permissions) throw new Error('SESSION_EXPIRED')
        this.applySnapshot(permissions)
        this.status = 'authenticated'
        this.restored = true
        return true
      } catch (error) { this.clear(); this.status = 'error'; this.lastError = error instanceof Error ? error.message : 'LOGIN_FAILED'; return false }
    },
    async refreshSilently(): Promise<boolean> {
      if (refreshPromise) return refreshPromise
      refreshPromise = (async () => {
        if (!this.refreshToken) { this.clear(); return false }
        this.status = 'refreshing'
        try {
          this.setTokenPair(await adapter().refresh({ refreshToken: this.refreshToken }))
          const permissions = await adapter().getPermissions()
          if (!permissions) throw new Error('SESSION_EXPIRED')
          this.applySnapshot(permissions)
          this.status = 'authenticated'
          return true
        } catch (error) { this.clear(); this.lastError = error instanceof Error ? error.message : 'SESSION_EXPIRED'; return false } finally { refreshPromise = null }
      })()
      return refreshPromise
    },
    async logout(): Promise<boolean> {
      this.status = 'revoking'
      try { await adapter().logout(); this.clear(); return true } catch (error) { this.clear(); this.lastError = error instanceof Error ? error.message : 'LOGOUT_FAILED'; return false }
    },
    setReturnTo(value: unknown): void { if (typeof window !== 'undefined') window.sessionStorage.setItem(RETURN_TO_KEY, safeAdminReturnTo(value)) },
    consumeReturnTo(): string { if (typeof window === 'undefined') return '/dashboard'; const value = safeAdminReturnTo(window.sessionStorage.getItem(RETURN_TO_KEY)); window.sessionStorage.removeItem(RETURN_TO_KEY); return value },
    setAuthAdapter(next: AdminAuthAdapter): void { activeAdapter = next },
    markForbidden(input: { path?: string; permission?: string; reason?: string } = {}): void {
      this.forbiddenPath = safeAdminReturnTo(input.path, this.forbiddenPath || '/dashboard')
      this.forbiddenPermission = input.permission?.trim() || this.forbiddenPermission
      this.forbiddenReason = input.reason?.trim() || 'policy_denied'
      this.lastError = 'FORBIDDEN'
    },
    markSessionExpired(returnTo?: unknown): void {
      if (returnTo !== undefined) this.setReturnTo(returnTo)
      this.clear()
      this.lastError = 'SESSION_EXPIRED'
    },
    clear(): void {
      this.accessToken = ''; this.refreshToken = null; this.deviceId = ''; this.sessionId = ''; this.principal = null; this.permissions = []; this.status = 'unauthenticated'; this.lastError = null; this.forbiddenPath = ''; this.forbiddenPermission = ''; this.forbiddenReason = ''
      if (typeof window !== 'undefined') { window.sessionStorage.removeItem(ACCESS_TOKEN_KEY); window.sessionStorage.removeItem(DEVICE_ID_KEY); window.sessionStorage.removeItem(SESSION_ID_KEY); window.sessionStorage.removeItem('englishflow.admin.refresh-token'); window.sessionStorage.removeItem('englishflow.admin.role') }
    },
  },
})
