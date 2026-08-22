import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createGatewayAuthAdapter, safeReturnTo, type AdultGateStatus, type AuthSessionSnapshot, type AuthStatus, type AuthTokenPair, type LoginCallbackInput, type ProviderNeutralAuthAdapter, type PrincipalSnapshot } from '../auth/gateway-auth'
import { apiClient } from '../api/client'
import { getGatewayBaseUrl } from '../platform/gateway'
import { learnerI18nAdapter, learnerThemeController } from '../platform/v2-foundation'

const ACCESS_TOKEN_KEY = 'yx.session.access-token'
const RETURN_TO_KEY = 'yx.auth.return-to'
const DEVICE_ID_KEY = 'yx.auth.device-id'
const SESSION_ID_KEY = 'yx.auth.session-id'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  return token && token.trim().length > 0 ? token : null
}

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(key)
  return value && value.trim() ? value : null
}

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const deviceId = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const principal = ref<PrincipalSnapshot | null>(null)
  const permissions = ref<readonly string[]>([])
  const status = ref<AuthStatus>('unknown')
  const adultGate = ref<AdultGateStatus>('UNKNOWN')
  const lastError = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => Boolean(accessToken.value))
  let activeAdapter: ProviderNeutralAuthAdapter | null = null
  let restorePromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null

  function adapter(): ProviderNeutralAuthAdapter {
    if (!activeAdapter) {
      activeAdapter = createGatewayAuthAdapter({
        baseUrl: getGatewayBaseUrl(),
        getAccessToken: () => accessToken.value,
      })
    }
    return activeAdapter
  }

  function applySnapshot(snapshot: AuthSessionSnapshot | null): void {
    if (!snapshot) return
    if (snapshot.tokenPair) setTokenPair(snapshot.tokenPair)
    principal.value = snapshot.principal ?? principal.value
    permissions.value = snapshot.permissions ?? snapshot.principal?.permissions ?? permissions.value
    adultGate.value = snapshot.adultGate ?? snapshot.principal?.adultGate ?? adultGate.value
  }

  function setTokenPair(tokens: AuthTokenPair): void {
    const access = tokens.accessToken.trim()
    if (!access) throw new Error('认证服务没有返回访问凭证。')
    accessToken.value = access
    refreshToken.value = tokens.refreshToken?.trim() || null
    deviceId.value = tokens.deviceId?.trim() || deviceId.value
    sessionId.value = tokens.sessionId?.trim() || sessionId.value
    userId.value = tokens.userId?.trim() || userId.value
    adultGate.value = tokens.adultGate ?? adultGate.value
    status.value = 'authenticated'
    lastError.value = null
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, access)
      if (deviceId.value) window.sessionStorage.setItem(DEVICE_ID_KEY, deviceId.value)
      if (sessionId.value) window.sessionStorage.setItem(SESSION_ID_KEY, sessionId.value)
      window.sessionStorage.removeItem('yx.session.refresh-token')
      window.sessionStorage.removeItem('yx.session.user-id')
    }
  }

  async function restore(): Promise<void> {
    if (restored.value) return
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      status.value = 'restoring'
      accessToken.value = readStoredToken()
      deviceId.value = readStoredValue(DEVICE_ID_KEY)
      sessionId.value = readStoredValue(SESSION_ID_KEY)
      try {
        const snapshot = await adapter().restoreSession()
        applySnapshot(snapshot)
        if (snapshot?.tokenPair) setTokenPair(snapshot.tokenPair)
        if (accessToken.value) {
          const permissionSnapshot = await adapter().getPermissions()
          applySnapshot(permissionSnapshot)
        }
        if (accessToken.value) status.value = 'authenticated'
        else status.value = 'unauthenticated'
      } catch (error) {
        clear()
        status.value = 'unauthenticated'
        lastError.value = error instanceof Error ? error.message : 'RESTORE_FAILED'
      } finally {
        restored.value = true
        restorePromise = null
      }
    })()
    return restorePromise
  }

  function prepareLogin(returnTo: unknown): string {
    const safe = safeReturnTo(returnTo)
    setReturnTo(safe)
    return adapter().startLogin({
      returnTo: safe,
      locale: learnerI18nAdapter.state.locale,
      theme: learnerThemeController.resolvedTheme,
    })
  }

  async function completeLogin(input: LoginCallbackInput): Promise<boolean> {
    if (input.returnTo) setReturnTo(input.returnTo)
    status.value = 'restoring'
    try {
      const pair = await adapter().completeLogin(input)
      setTokenPair(pair)
      applySnapshot(await adapter().getPermissions())
      return true
    } catch (error) {
      clear()
      status.value = 'error'
      lastError.value = error instanceof Error ? error.message : 'LOGIN_FAILED'
      return false
    }
  }

  async function refreshSilently(): Promise<boolean> {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      if (!refreshToken.value) {
        status.value = 'unauthenticated'
        return false
      }
      status.value = 'refreshing'
      try {
        setTokenPair(await adapter().refresh({ refreshToken: refreshToken.value }))
        applySnapshot(await adapter().getPermissions())
        return true
      } catch (error) {
        clear()
        status.value = 'unauthenticated'
        lastError.value = error instanceof Error ? error.message : 'SESSION_EXPIRED'
        return false
      } finally {
        refreshPromise = null
      }
    })()
    return refreshPromise
  }

  async function logout(allDevices = false): Promise<boolean> {
    status.value = 'revoking'
    try {
      await adapter().logout({ allDevices })
      clear()
      return true
    } catch (error) {
      clear()
      lastError.value = error instanceof Error ? error.message : 'LOGOUT_FAILED'
      status.value = 'unauthenticated'
      return false
    }
  }

  async function revokeCurrentSession(): Promise<boolean> {
    if (!sessionId.value) { clear(); return false }
    status.value = 'revoking'
    try {
      await adapter().revoke(sessionId.value)
      clear()
      return true
    } catch (error) {
      clear()
      lastError.value = error instanceof Error ? error.message : 'REVOKE_FAILED'
      status.value = 'unauthenticated'
      return false
    }
  }

  async function confirmAdultGate(birthYear: number, policyVersion = 'v2-phase1'): Promise<boolean> {
    try {
      const snapshot = await adapter().confirmAdultGate({ birthYear, policyVersion, adultDeclaration: true })
      applySnapshot(snapshot)
      adultGate.value = snapshot?.adultGate === 'PASSED' ? 'PASSED' : 'REJECTED'
      return adultGate.value === 'PASSED'
    } catch (error) {
      adultGate.value = 'REJECTED'
      lastError.value = error instanceof Error ? error.message : 'ADULT_GATE_FAILED'
      return false
    }
  }

  function setReturnTo(value: unknown): void {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo(value))
  }

  function consumeReturnTo(): string {
    if (typeof window === 'undefined') return '/home'
    const value = safeReturnTo(window.sessionStorage.getItem(RETURN_TO_KEY))
    window.sessionStorage.removeItem(RETURN_TO_KEY)
    return value
  }

  function setAuthAdapter(next: ProviderNeutralAuthAdapter): void {
    activeAdapter = next
  }

  function clear(): void {
    accessToken.value = null
    refreshToken.value = null
    deviceId.value = null
    sessionId.value = null
    userId.value = null
    principal.value = null
    permissions.value = []
    adultGate.value = 'UNKNOWN'
    status.value = 'unauthenticated'
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      window.sessionStorage.removeItem(DEVICE_ID_KEY)
      window.sessionStorage.removeItem(SESSION_ID_KEY)
      window.sessionStorage.removeItem('yx.session.refresh-token')
      window.sessionStorage.removeItem('yx.session.user-id')
    }
  }

  return {
    accessToken,
    deviceId,
    sessionId,
    userId,
    principal,
    permissions,
    status,
    adultGate,
    lastError,
    restored,
    isAuthenticated,
    restore,
    prepareLogin,
    completeLogin,
    setTokenPair,
    refreshSilently,
    logout,
    revokeCurrentSession,
    confirmAdultGate,
    setReturnTo,
    consumeReturnTo,
    setAuthAdapter,
    clear,
  }
})

export function readAccessToken(): string | null {
  return readStoredToken()
}

export function readDeviceId(): string | null {
  return readStoredValue(DEVICE_ID_KEY)
}
