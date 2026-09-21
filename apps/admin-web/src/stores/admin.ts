import { createPinia, defineStore } from 'pinia'
import { createGatewayAdminAuthAdapter, safeAdminReturnTo, type AdminAuthAdapter, type AdminAuthSnapshot, type AdminTokenPair, type AdminPrincipalSnapshot } from '../auth/gateway-auth'
import { adminT } from '../platform/admin-i18n'
import { getInMemoryAccessToken, setInMemoryAccessToken } from '../auth/access-token'
import { adminClient } from '../api/client'

export const pinia = createPinia()

const RETURN_TO_KEY = 'englishflow.admin.return-to'
const ADMIN_SESSION_HINT_KEY = 'englishflow.admin.session-hint'

function hasAdminSessionHint(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    return window.localStorage.getItem(ADMIN_SESSION_HINT_KEY) === '1'
  } catch { return false }
}

function markAdminSessionHint(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(ADMIN_SESSION_HINT_KEY, '1')
  } catch { /* ignore */ }
}

function clearAdminSessionHint(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(ADMIN_SESSION_HINT_KEY)
  } catch { /* ignore */ }
}
let memoryDeviceId = ''
let memorySessionId = ''
let activeAdapter: AdminAuthAdapter | null = null
let refreshPromise: Promise<boolean> | null = null
let restorePromise: Promise<void> | null = null

function adapter(): AdminAuthAdapter {
  if (!activeAdapter) activeAdapter = createGatewayAdminAuthAdapter({ client: adminClient })
  return activeAdapter
}

export const useAdminStore = defineStore('admin-session', {
  state: () => ({
    accessToken: '',
    deviceId: '',
    sessionId: '',
    principal: null as AdminPrincipalSnapshot | null,
    permissions: [] as string[],
    status: 'unknown' as 'unknown' | 'restoring' | 'authenticated' | 'refreshing' | 'revoking' | 'unauthenticated' | 'error',
    restored: false,
    lastError: null as string | null,
    forbiddenPath: '',
    forbiddenPermission: '',
    forbiddenReason: '',
  }),
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
        try {
          if (!this.accessToken && !hasAdminSessionHint()) { this.clear(); this.status = 'unauthenticated'; return }
          if (!this.accessToken) this.setTokenPair(await adapter().refresh())
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
          this.status = 'unauthenticated'
        } finally {
          this.restored = true
        }
      })().finally(() => { restorePromise = null })
      return restorePromise
    },
    async login(identifier: string, password: string): Promise<boolean> {
      this.status = 'restoring'
      this.lastError = null
      try {
        this.setTokenPair(await adapter().login({
          identifier: identifier.trim(),
          password,
          device: { deviceType: 'WEB', clientVersion: 'local-dev', deviceName: adminT('storeAdmin.deviceName') },
        }))
        const permissions = await adapter().getPermissions()
        if (!permissions) throw new Error('SESSION_EXPIRED')
        this.applySnapshot(permissions)
        this.status = 'authenticated'
        this.restored = true
        return true
      } catch (error) {
        this.clear()
        this.status = 'error'
        this.lastError = error instanceof Error ? error.message : 'LOGIN_FAILED'
        return false
      }
    },
    applySnapshot(snapshot: AdminAuthSnapshot | null): void {
      if (!snapshot) return
      if (snapshot.tokenPair) this.setTokenPair(snapshot.tokenPair)
      if (snapshot.principal) this.principal = snapshot.principal
      this.permissions = [...(snapshot.permissions ?? snapshot.principal?.permissions ?? [])]
    },
    setTokenPair(pair: AdminTokenPair): void {
      const access = pair.accessToken.trim()
      if (!access) throw new Error(adminT('storeAdmin.missingCredential'))
      this.accessToken = access
      this.deviceId = pair.deviceId?.trim() || this.deviceId
      this.sessionId = pair.sessionId?.trim() || this.sessionId
      memoryDeviceId = this.deviceId
      memorySessionId = this.sessionId
      setInMemoryAccessToken(access)
      markAdminSessionHint()
      this.status = 'authenticated'
      this.lastError = null
    },
    async refreshSilently(): Promise<boolean> {
      if (refreshPromise) return refreshPromise
      refreshPromise = (async () => {
        if (!this.accessToken && !hasAdminSessionHint()) return false
        this.status = 'refreshing'
        try {
          this.setTokenPair(await adapter().refresh())
          const permissions = await adapter().getPermissions()
          if (!permissions) throw new Error('SESSION_EXPIRED')
          this.applySnapshot(permissions)
          this.status = 'authenticated'
          return true
        } catch (error) {
          this.clear()
          this.lastError = error instanceof Error ? error.message : 'SESSION_EXPIRED'
          this.status = 'unauthenticated'
          return false
        } finally { refreshPromise = null }
      })()
      return refreshPromise
    },
    async logout(allDevices = false): Promise<boolean> {
      this.status = 'revoking'
      try { await adapter().logout({ allDevices }); this.clear(); return true }
      catch (error) { this.clear(); this.lastError = error instanceof Error ? error.message : 'LOGOUT_FAILED'; return false }
    },
    setReturnTo(value: unknown): void {
      if (typeof window !== 'undefined') window.sessionStorage.setItem(RETURN_TO_KEY, safeAdminReturnTo(value))
    },
    consumeReturnTo(): string {
      if (typeof window === 'undefined') return '/dashboard'
      const value = safeAdminReturnTo(window.sessionStorage.getItem(RETURN_TO_KEY))
      window.sessionStorage.removeItem(RETURN_TO_KEY)
      return value
    },
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
      this.accessToken = ''
      this.deviceId = ''
      this.sessionId = ''
      this.principal = null
      this.permissions = []
      this.status = 'unauthenticated'
      this.lastError = null
      this.forbiddenPath = ''
      this.forbiddenPermission = ''
      this.forbiddenReason = ''
      memoryDeviceId = ''
      memorySessionId = ''
      setInMemoryAccessToken(null)
      clearAdminSessionHint()
    },
  },
})

export function readAdminAccessToken(): string | null { return getInMemoryAccessToken() }
export function readAdminDeviceId(): string | null { return memoryDeviceId || null }
export function readAdminSessionId(): string | null { return memorySessionId || null }
