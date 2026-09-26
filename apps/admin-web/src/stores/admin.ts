import { createPinia, defineStore } from 'pinia'
import { createGatewayAdminAuthAdapter, safeAdminReturnTo, type AdminAuthAdapter, type AdminAuthSnapshot, type AdminTokenPair, type AdminPrincipalSnapshot } from '../auth/gateway-auth'
import { adminT } from '../platform/admin-i18n'
import {
  beginInMemoryAuthGeneration,
  confirmInMemoryAdminIdentity,
  getInMemoryAccessToken,
  getInMemoryAuthSnapshot,
  setInMemoryAccessToken,
  stageInMemoryAccessToken,
} from '../auth/access-token'
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
let pendingDeviceId = ''
let pendingSessionId = ''
let memoryReturnTo: string | null = null
let consumedPersistedReturnTo: string | null = null
let preferMemoryReturnTo = false
let activeAdapter: AdminAuthAdapter | null = null
let refreshPromise: { generation: number; promise: Promise<boolean> } | null = null
let restorePromise: { generation: number; promise: Promise<void> } | null = null

function adapter(): AdminAuthAdapter {
  if (!activeAdapter) activeAdapter = createGatewayAdminAuthAdapter({ client: adminClient })
  return activeAdapter
}

function verifiedSubject(snapshot: AdminAuthSnapshot | null): string | null {
  return snapshot?.principal?.subject.trim() || null
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
    authGeneration: 0,
    lastExpiredGeneration: null as number | null,
    lastError: null as string | null,
    forbiddenPath: '',
    forbiddenPermission: '',
    forbiddenReason: '',
  }),
  getters: {
    isAuthenticated: (state) => {
      const auth = getInMemoryAuthSnapshot()
      const subject = state.principal?.subject.trim()
      return Boolean(auth.authenticated && auth.generation === state.authGeneration && state.accessToken === auth.accessToken
        && subject && auth.subject === subject)
    },
    roles: (state): readonly string[] => state.principal?.roles ?? [],
    primaryRole: (state): string => state.principal?.roles[0] ?? '—',
    can: (state) => (permission: string): boolean => state.permissions.includes(permission),
  },
  actions: {
    isAuthGenerationCurrent(generation: number): boolean {
      return this.authGeneration === generation && getInMemoryAuthSnapshot().generation === generation
    },
    isAuthContextCurrent(generation: number, subject: string): boolean {
      const auth = getInMemoryAuthSnapshot()
      return this.isAuthGenerationCurrent(generation) && auth.authenticated && auth.subject === subject.trim()
        && this.accessToken === auth.accessToken && this.principal?.subject.trim() === subject.trim()
    },
    beginAuthTransition(candidateToken?: string | null): number {
      const generation = beginInMemoryAuthGeneration(candidateToken)
      this.authGeneration = generation
      this.accessToken = ''
      this.deviceId = ''
      this.sessionId = ''
      this.principal = null
      this.permissions = []
      this.status = 'unknown'
      this.restored = false
      this.lastExpiredGeneration = null
      this.lastError = null
      this.forbiddenPath = ''
      this.forbiddenPermission = ''
      this.forbiddenReason = ''
      memoryDeviceId = ''
      memorySessionId = ''
      pendingDeviceId = ''
      pendingSessionId = ''
      return generation
    },
    applySnapshot(snapshot: AdminAuthSnapshot | null, generation?: number, expectedSubject?: string): string | null {
      const authGeneration = generation ?? this.authGeneration
      generation = authGeneration
      if (!snapshot || !this.isAuthGenerationCurrent(generation)) return null
      if (snapshot.tokenPair && !this.setTokenPair(snapshot.tokenPair, generation)) return null
      const subject = verifiedSubject(snapshot)
      if (subject && expectedSubject && subject !== expectedSubject.trim()) throw new Error('AUTH_SUBJECT_MISMATCH')
      if (subject) this.principal = snapshot.principal ?? this.principal
      this.permissions = [...(snapshot.permissions ?? snapshot.principal?.permissions ?? this.permissions)]
      return subject ?? expectedSubject?.trim() ?? this.principal?.subject.trim() ?? null
    },
    confirmIdentity(subject: string, generation?: number): boolean {
      generation = generation ?? this.authGeneration
      const normalizedSubject = subject.trim()
      if (!normalizedSubject || !this.isAuthGenerationCurrent(generation)) return false
      if (this.principal && this.principal.subject.trim() !== normalizedSubject) return false
      if (!confirmInMemoryAdminIdentity(normalizedSubject, generation)) return false
      this.principal ??= { subject: normalizedSubject, roles: [], permissions: this.permissions }
      this.accessToken = getInMemoryAccessToken() ?? this.accessToken
      this.deviceId = pendingDeviceId || this.deviceId
      this.sessionId = pendingSessionId || this.sessionId
      memoryDeviceId = this.deviceId
      memorySessionId = this.sessionId
      pendingDeviceId = ''
      pendingSessionId = ''
      return true
    },
    setTokenPair(pair: AdminTokenPair, generation?: number): boolean {
      generation = generation ?? this.authGeneration
      const access = pair.accessToken.trim()
      if (!access) throw new Error(adminT('storeAdmin.missingCredential'))
      if (!this.isAuthGenerationCurrent(generation) || !stageInMemoryAccessToken(access, generation)) return false
      pendingDeviceId = pair.deviceId?.trim() || this.deviceId
      pendingSessionId = pair.sessionId?.trim() || this.sessionId
      markAdminSessionHint()
      this.lastError = null
      return true
    },
    expireAuthGeneration(generation: number, error: unknown): void {
      if (!this.isAuthGenerationCurrent(generation)) return
      const message = error instanceof Error ? error.message : 'SESSION_EXPIRED'
      this.clear()
      this.lastExpiredGeneration = generation
      this.lastError = message
      this.status = 'unauthenticated'
    },
    async restore(): Promise<void> {
      if (this.restored) return
      if (restorePromise?.generation === this.authGeneration) return restorePromise.promise
      const hadSessionHint = hasAdminSessionHint()
      const existingToken = this.accessToken || getInMemoryAccessToken()
      const generation = this.beginAuthTransition(existingToken)
      const currentAdapter = adapter()
      this.status = 'restoring'
      const operation = (async () => {
        try {
          if (!existingToken && !hadSessionHint) {
            this.status = 'unauthenticated'
            return
          }
          if (!existingToken) {
            const pair = await currentAdapter.refresh()
            if (!this.isAuthGenerationCurrent(generation)) return
            if (!this.setTokenPair(pair, generation)) return
          }
          const principalSnapshot = await currentAdapter.restoreSession()
          if (!this.isAuthGenerationCurrent(generation)) return
          const subject = verifiedSubject(principalSnapshot)
          if (!principalSnapshot || !subject) {
            this.markSessionExpired(undefined, generation)
            return
          }
          this.applySnapshot(principalSnapshot, generation)
          const permissionsSnapshot = await currentAdapter.getPermissions()
          if (!this.isAuthGenerationCurrent(generation)) return
          if (!permissionsSnapshot) {
            this.markSessionExpired(undefined, generation)
            return
          }
          const permissionsSubject = verifiedSubject(permissionsSnapshot)
          if (permissionsSubject && permissionsSubject !== subject) throw new Error('AUTH_SUBJECT_MISMATCH')
          this.applySnapshot(permissionsSnapshot, generation, subject)
          if (!this.confirmIdentity(subject, generation)) throw new Error('AUTH_CONTEXT_CHANGED')
          this.status = 'authenticated'
          this.lastError = null
        } catch (error) {
          if (!this.isAuthGenerationCurrent(generation)) return
          this.expireAuthGeneration(generation, error)
        } finally {
          if (this.isAuthGenerationCurrent(generation)) this.restored = true
        }
      })()
      const tracked = operation.finally(() => {
        if (restorePromise?.promise === tracked) restorePromise = null
      })
      restorePromise = { generation, promise: tracked }
      return tracked
    },
    async login(identifier: string, password: string): Promise<boolean> {
      const generation = this.beginAuthTransition()
      const currentAdapter = adapter()
      this.status = 'restoring'
      try {
        const pair = await currentAdapter.login({
          identifier: identifier.trim(),
          password,
          device: { deviceType: 'WEB', clientVersion: 'local-dev', deviceName: adminT('storeAdmin.deviceName') },
        })
        if (!this.isAuthGenerationCurrent(generation) || !this.setTokenPair(pair, generation)) return false
        const permissions = await currentAdapter.getPermissions()
        if (!this.isAuthGenerationCurrent(generation)) return false
        const subject = verifiedSubject(permissions)
        if (!permissions || !subject) throw new Error('SESSION_EXPIRED')
        this.applySnapshot(permissions, generation)
        if (!this.confirmIdentity(subject, generation)) throw new Error('AUTH_CONTEXT_CHANGED')
        this.status = 'authenticated'
        this.restored = true
        this.lastError = null
        return true
      } catch (error) {
        if (!this.isAuthGenerationCurrent(generation)) return false
        this.clear()
        this.status = 'error'
        this.lastError = error instanceof Error ? error.message : 'LOGIN_FAILED'
        return false
      }
    },
    async refreshSilently(expectedGeneration?: number, expectedSubject?: string): Promise<boolean> {
      expectedGeneration = expectedGeneration ?? this.authGeneration
      const auth = getInMemoryAuthSnapshot()
      const subject = expectedSubject?.trim() || auth.subject?.trim() || ''
      if (!subject || !this.isAuthContextCurrent(expectedGeneration, subject)) return false
      const existingRefresh = refreshPromise
      if (existingRefresh?.generation === expectedGeneration) return existingRefresh.promise
      const currentAdapter = adapter()
      this.status = 'refreshing'
      const operation = (async () => {
        try {
          const pair = await currentAdapter.refresh()
          if (!this.isAuthContextCurrent(expectedGeneration, subject)) return false
          if (!this.setTokenPair(pair, expectedGeneration)) return false
          const permissions = await currentAdapter.getPermissions()
          if (!this.isAuthContextCurrent(expectedGeneration, subject)) return false
          const refreshedSubject = verifiedSubject(permissions)
          if (!permissions || !refreshedSubject || refreshedSubject !== subject) throw new Error('AUTH_SUBJECT_MISMATCH')
          this.applySnapshot(permissions, expectedGeneration, subject)
          if (!this.confirmIdentity(subject, expectedGeneration)) throw new Error('AUTH_CONTEXT_CHANGED')
          this.status = 'authenticated'
          this.lastError = null
          return true
        } catch (error) {
          if (!this.isAuthContextCurrent(expectedGeneration, subject)) return false
          this.expireAuthGeneration(expectedGeneration, error)
          return false
        }
      })()
      const tracked = operation.finally(() => {
        if (refreshPromise?.promise === tracked) refreshPromise = null
      })
      refreshPromise = { generation: expectedGeneration, promise: tracked }
      return tracked
    },
    async logout(allDevices = false): Promise<boolean> {
      const candidateToken = getInMemoryAccessToken() || this.accessToken || null
      const generation = this.beginAuthTransition(candidateToken)
      const currentAdapter = adapter()
      this.status = 'revoking'
      try {
        await currentAdapter.logout({ allDevices })
        if (!this.isAuthGenerationCurrent(generation)) return false
        this.clear()
        return true
      } catch (error) {
        if (!this.isAuthGenerationCurrent(generation)) return false
        this.clear()
        this.lastError = error instanceof Error ? error.message : 'LOGOUT_FAILED'
        return false
      }
    },
    setReturnTo(value: unknown): void {
      const safeReturnTo = safeAdminReturnTo(value)
      memoryReturnTo = safeReturnTo
      consumedPersistedReturnTo = null
      preferMemoryReturnTo = false
      try {
        if (typeof window !== 'undefined') window.sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo)
      } catch {
        preferMemoryReturnTo = true
        try { window.sessionStorage.removeItem(RETURN_TO_KEY) } catch { /* Ignore any stale persisted target. */ }
      }
    },
    consumeReturnTo(): string {
      if (preferMemoryReturnTo) {
        const value = safeAdminReturnTo(memoryReturnTo ?? '/dashboard')
        memoryReturnTo = null
        return value
      }
      let persistedReturnTo: string | null = null
      try {
        if (typeof window !== 'undefined') persistedReturnTo = window.sessionStorage.getItem(RETURN_TO_KEY)
      } catch { /* Fall back to the current page's in-memory target. */ }
      if (persistedReturnTo !== null && persistedReturnTo !== consumedPersistedReturnTo) {
        try {
          window.sessionStorage.removeItem(RETURN_TO_KEY)
        } catch {
          consumedPersistedReturnTo = persistedReturnTo
        }
        memoryReturnTo = null
        return safeAdminReturnTo(persistedReturnTo)
      }
      const value = safeAdminReturnTo(memoryReturnTo ?? '/dashboard')
      memoryReturnTo = null
      return value
    },
    setAuthAdapter(next: AdminAuthAdapter): void { activeAdapter = next },
    markForbidden(input: { path?: string; permission?: string; reason?: string } = {}): void {
      this.forbiddenPath = safeAdminReturnTo(input.path, this.forbiddenPath || '/dashboard')
      this.forbiddenPermission = input.permission?.trim() || this.forbiddenPermission
      this.forbiddenReason = input.reason?.trim() || 'policy_denied'
      this.lastError = 'FORBIDDEN'
    },
    markSessionExpired(returnTo?: unknown, expectedGeneration?: number, expectedSubject?: string): number | null {
      expectedGeneration = expectedGeneration ?? this.authGeneration
      if (expectedSubject ? !this.isAuthContextCurrent(expectedGeneration, expectedSubject) : !this.isAuthGenerationCurrent(expectedGeneration)) return null
      if (returnTo !== undefined) this.setReturnTo(returnTo)
      this.clear()
      this.lastExpiredGeneration = expectedGeneration
      this.lastError = 'SESSION_EXPIRED'
      return this.authGeneration
    },
    clear(): void {
      this.authGeneration = beginInMemoryAuthGeneration()
      this.accessToken = ''
      this.deviceId = ''
      this.sessionId = ''
      this.principal = null
      this.permissions = []
      this.status = 'unauthenticated'
      this.restored = true
      this.lastExpiredGeneration = null
      this.lastError = null
      this.forbiddenPath = ''
      this.forbiddenPermission = ''
      this.forbiddenReason = ''
      memoryDeviceId = ''
      memorySessionId = ''
      pendingDeviceId = ''
      pendingSessionId = ''
      setInMemoryAccessToken(null)
      clearAdminSessionHint()
    },
  },
})

export function readAdminAccessToken(): string | null { return getInMemoryAccessToken() }
export function readAdminDeviceId(): string | null { return memoryDeviceId || null }
export function readAdminSessionId(): string | null { return memorySessionId || null }
