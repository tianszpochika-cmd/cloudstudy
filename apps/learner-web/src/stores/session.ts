import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createGatewayAuthAdapter, safeReturnTo, type AdultGateStatus, type AuthSessionSnapshot, type AuthStatus, type AuthTokenPair, type JwtAuthAdapter, type PrincipalSnapshot } from '../auth/gateway-auth'
import { getInMemoryAccessToken, setInMemoryAccessToken } from '../auth/access-token'
import { ApiError } from '../api/client'
import { getGatewayBaseUrl } from '../platform/gateway'

export type AuthErrorCode = 'AUTH_FAILED' | 'SESSION_EXPIRED' | 'LOGOUT_FAILED' | 'REVOKE_FAILED'

const RETURN_TO_KEY = 'yx.auth.return-to'
let memoryDeviceId: string | null = null

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const deviceId = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const principal = ref<PrincipalSnapshot | null>(null)
  const permissions = ref<readonly string[]>([])
  const status = ref<AuthStatus>('unknown')
  const adultGate = ref<AdultGateStatus>('UNKNOWN')
  const lastError = ref<string | null>(null)
  const authErrorCode = ref<AuthErrorCode | null>(null)
  const forbiddenReason = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => Boolean(accessToken.value))
  let activeAdapter: JwtAuthAdapter | null = null
  let restorePromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null

  function currentInternalPath(): string {
    if (typeof window === 'undefined') return '/home'
    return safeReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`)
  }

  function forbiddenMessage(error: ApiError): string {
    const details = error.details
    if (typeof details === 'object' && details !== null) {
      for (const key of ['reason', 'reasonMessage', 'message', 'detail']) {
        const value = (details as Record<string, unknown>)[key]
        if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 240)
      }
    }
    return error.message || '服务端权限策略拒绝了当前资源。'
  }

  async function navigateToLogin(returnTo: string): Promise<void> {
    const { router } = await import('../router')
    if (router.currentRoute.value.name === 'login') return
    await router.replace({ name: 'login', query: { redirect: safeReturnTo(returnTo) } })
  }

  function adapter(): JwtAuthAdapter {
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
    deviceId.value = tokens.deviceId?.trim() || deviceId.value
    memoryDeviceId = deviceId.value
    sessionId.value = tokens.sessionId?.trim() || sessionId.value
    userId.value = tokens.userId?.trim() || userId.value
    adultGate.value = tokens.adultGate ?? adultGate.value
    status.value = 'authenticated'
    authErrorCode.value = null
    forbiddenReason.value = null
    lastError.value = null
    setInMemoryAccessToken(access)
  }

  async function restore(): Promise<void> {
    if (restored.value) return
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      status.value = 'restoring'
      try {
        if (!accessToken.value) {
          setTokenPair(await adapter().refresh())
        }
        const snapshot = await adapter().restoreSession()
        if (!snapshot) {
          clear()
          status.value = 'unauthenticated'
          return
        }
        applySnapshot(snapshot)
        if (accessToken.value) {
          const permissionSnapshot = await adapter().getPermissions()
          applySnapshot(permissionSnapshot)
        }
        if (accessToken.value) status.value = 'authenticated'
        else status.value = 'unauthenticated'
      } catch (error) {
        clear()
        status.value = 'unauthenticated'
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return
        lastError.value = error instanceof Error ? error.message : 'RESTORE_FAILED'
      } finally {
        restored.value = true
        restorePromise = null
      }
    })()
    return restorePromise
  }

  async function prepareLogin(returnTo: unknown): Promise<string> {
    const safe = safeReturnTo(returnTo)
    setReturnTo(safe)
    return safe
  }

  async function login(identifier: string, password: string): Promise<boolean> {
    status.value = 'restoring'
    authErrorCode.value = null
    lastError.value = null
    try {
      const pair = await adapter().login({
        identifier: identifier.trim(),
        password,
        device: { deviceType: 'WEB', clientVersion: 'local-dev', deviceName: '浏览器' },
      })
      setTokenPair(pair)
      applySnapshot(await adapter().getPermissions())
      return true
    } catch (error) {
      clear()
      status.value = 'error'
      authErrorCode.value = 'AUTH_FAILED'
      lastError.value = error instanceof Error ? error.message : 'LOGIN_FAILED'
      return false
    }
  }

  async function refreshSilently(): Promise<boolean> {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      status.value = 'refreshing'
      try {
        setTokenPair(await adapter().refresh())
        applySnapshot(await adapter().getPermissions())
        return true
      } catch (error) {
        clear()
        status.value = 'unauthenticated'
        authErrorCode.value = 'SESSION_EXPIRED'
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
      authErrorCode.value = 'LOGOUT_FAILED'
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
      authErrorCode.value = 'REVOKE_FAILED'
      status.value = 'unauthenticated'
      return false
    }
  }

  async function confirmAdultGate(birthYear: number, policyVersion = 'v2-phase1'): Promise<boolean> {
    try {
      const snapshot = await adapter().confirmAdultGate({ confirmed: true, birthYear, policyVersion })
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

  function peekReturnTo(): string {
    if (typeof window === 'undefined') return '/home'
    return safeReturnTo(window.sessionStorage.getItem(RETURN_TO_KEY))
  }

  async function handleUnauthorized(): Promise<void> {
    const current = currentInternalPath()
    const returnTo = current === '/login' || current === '/forbidden' ? '/home' : current
    setReturnTo(returnTo)
    clear()
    status.value = 'unauthenticated'
    authErrorCode.value = 'SESSION_EXPIRED'
    lastError.value = 'SESSION_EXPIRED'
    await navigateToLogin(returnTo)
  }

  async function handleForbidden(error: ApiError): Promise<void> {
    forbiddenReason.value = forbiddenMessage(error)
    const attemptedPath = currentInternalPath()
    const { router } = await import('../router')
    // A learner who has not given consent yet is not forbidden: the learner service answers
    // CONSENT_REQUIRED for profile, targets and preferences until the onboarding consents are given,
    // and every other code in LearnerDecisionCode is a real denial. Treating this one as a denial
    // sent a freshly registered learner to the forbidden page from the onboarding page they were
    // already on, which strands the first-run journey with no way forward.
    if (decisionCode(error) === 'CONSENT_REQUIRED') {
      if (router.currentRoute.value.name !== 'onboarding') {
        await router.replace({ name: 'onboarding', query: { redirect: safeReturnTo(attemptedPath) } })
      }
      return
    }
    if (router.currentRoute.value.name !== 'forbidden') {
      await router.replace({ name: 'forbidden', query: { from: safeReturnTo(attemptedPath) } })
    }
  }

  /** The domain decision code the service returns, for example CONSENT_REQUIRED. */
  function decisionCode(error: ApiError): string | null {
    const details = error.details
    if (typeof details !== 'object' || details === null) return null
    const envelope = (details as { error?: unknown }).error
    const source = typeof envelope === 'object' && envelope !== null ? envelope : details
    const code = (source as Record<string, unknown>).code
    return typeof code === 'string' && code.trim() ? code.trim() : null
  }

  function setAuthAdapter(next: JwtAuthAdapter): void {
    activeAdapter = next
  }

  function clear(): void {
    accessToken.value = null
    deviceId.value = null
    memoryDeviceId = null
    sessionId.value = null
    userId.value = null
    principal.value = null
    permissions.value = []
    adultGate.value = 'UNKNOWN'
    status.value = 'unauthenticated'
    lastError.value = null
    authErrorCode.value = null
    forbiddenReason.value = null
    setInMemoryAccessToken(null)
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
    authErrorCode,
    forbiddenReason,
    restored,
    isAuthenticated,
    restore,
    prepareLogin,
    login,
    setTokenPair,
    refreshSilently,
    logout,
    revokeCurrentSession,
    confirmAdultGate,
    setReturnTo,
    peekReturnTo,
    consumeReturnTo,
    handleUnauthorized,
    handleForbidden,
    setAuthAdapter,
    clear,
  }
})

export function readAccessToken(): string | null {
  return getInMemoryAccessToken()
}

export function readDeviceId(): string | null {
  return memoryDeviceId
}
