import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createGatewayAuthAdapter, safeReturnTo, type AdultGateStatus, type AuthSessionSnapshot, type AuthStatus, type AuthTokenPair, type JwtAuthAdapter, type PrincipalSnapshot } from '../auth/gateway-auth'
import { getInMemoryAccessToken, getInMemoryAuthSnapshot, setInMemoryAuthSnapshot } from '../auth/access-token'
import { learnerAuthFailureMarker } from '../auth/auth-failure-copy'
import { ApiError, type ApiAuthBinding } from '../api/client'
import { getGatewayBaseUrl, getIamAuthBaseUrl } from '../platform/gateway'
import { B1_STORAGE_KEY } from '../domain/b1'

export type AuthErrorCode = 'AUTH_FAILED' | 'SESSION_EXPIRED' | 'LOGOUT_FAILED' | 'REVOKE_FAILED'

const RETURN_TO_KEY = 'yx.auth.return-to'
const SESSION_HINT_KEY = 'yx.auth.session-hint'
const B4_OFFLINE_STORAGE_KEY = 'yx.b4.learner-web.sync.v1'

function hasSessionHint(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1'
  } catch { return false }
}

function markSessionHint(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(SESSION_HINT_KEY, '1')
  } catch { /* storage is best-effort; cookies remain authoritative */ }
}

function clearSessionHint(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(SESSION_HINT_KEY)
  } catch { /* ignore */ }
}
function clearB1Snapshot(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(B1_STORAGE_KEY)
  } catch { /* the live B1 store also clears itself when identity changes */ }
}
function clearB4OfflineSnapshot(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(B4_OFFLINE_STORAGE_KEY)
  } catch { /* B4 also rejects unowned records when its store restores */ }
}

function getReturnToStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.sessionStorage ?? null
  } catch { return null }
}

function removePersistedReturnTo(storage: Storage | null): void {
  try { storage?.removeItem(RETURN_TO_KEY) } catch { /* the in-memory target remains authoritative */ }
}

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
  const learningConsentWithdrawn = ref(false)
  const lastError = ref<string | null>(null)
  const authErrorCode = ref<AuthErrorCode | null>(null)
  const forbiddenReason = ref<string | null>(null)
  const restored = ref(false)
  const authEpoch = ref(0)
  const authGeneration = computed(() => authEpoch.value)
  const isAuthenticated = computed(() => Boolean(accessToken.value))
  const isLearningReady = computed(() => isAuthenticated.value && adultGate.value === 'PASSED' && permissions.value.includes('learning.plan.read'))
  const isAdultGateRejected = computed(() => adultGate.value === 'REJECTED')
  let activeAdapter: JwtAuthAdapter | null = null
  let restorePromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null
  let memoryReturnTo: string | null = null
  let preferMemoryReturnTo = false
  let consumedPersistedReturnTo: string | null = null

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
        iamAuthBaseUrl: getIamAuthBaseUrl(),
        getAccessToken: () => accessToken.value,
        getAuthSnapshot: getInMemoryAuthSnapshot,
      })
    }
    return activeAdapter
  }

  function applySnapshot(snapshot: AuthSessionSnapshot | null): void {
    if (!snapshot) return
    if (snapshot.tokenPair) setTokenPair(snapshot.tokenPair)
    const verifiedSubject = snapshot.principal?.subject?.trim()
    if (verifiedSubject && userId.value && verifiedSubject !== userId.value) {
      clear()
      lastError.value = '认证主体不一致，请重新登录。'
      throw new Error(lastError.value)
    }
    if (verifiedSubject && principal.value?.subject && verifiedSubject !== principal.value.subject) clearB1Snapshot()
    principal.value = snapshot.principal ?? principal.value
    if (verifiedSubject) userId.value = verifiedSubject
    permissions.value = snapshot.permissions ?? snapshot.principal?.permissions ?? permissions.value
    adultGate.value = snapshot.adultGate ?? snapshot.principal?.adultGate ?? adultGate.value
    if (verifiedSubject && accessToken.value) {
      const readyStatus = status.value === 'authenticated' || status.value === 'refreshing'
      setInMemoryAuthSnapshot({
        accessToken: accessToken.value,
        subject: verifiedSubject,
        generation: authEpoch.value,
        authenticated: Boolean(readyStatus && (!userId.value || userId.value === verifiedSubject)),
      })
    }
  }

  function setTokenPair(tokens: AuthTokenPair): void {
    const access = tokens.accessToken.trim()
    if (!access) throw new Error('认证服务没有返回访问凭证。')
    // Remove the previous verified owner before replacing its token. The new
    // token remains bootstrap-only until IAM confirms the principal below.
    setInMemoryAuthSnapshot({ accessToken: null, subject: null, generation: authEpoch.value, authenticated: false })
    const nextSubject = tokens.userId?.trim() || null
    const previousSubject = principal.value?.subject ?? userId.value
    // IAM refresh returns no userId. Preserve the verified subject only while a
    // refresh/restore is in flight; the subsequent principal read must match it.
    const preserveUnknownSubject = !nextSubject && (status.value === 'refreshing' || status.value === 'restoring')
    if (previousSubject && previousSubject !== nextSubject && !preserveUnknownSubject) {
      clearB1Snapshot()
      principal.value = null
      permissions.value = []
      adultGate.value = 'UNKNOWN'
    }
    accessToken.value = access
    deviceId.value = tokens.deviceId?.trim() || deviceId.value
    memoryDeviceId = deviceId.value
    sessionId.value = tokens.sessionId?.trim() || sessionId.value
    userId.value = nextSubject ?? (preserveUnknownSubject ? userId.value : null)
    adultGate.value = tokens.adultGate ?? adultGate.value
    status.value = 'authenticated'
    authErrorCode.value = null
    forbiddenReason.value = null
    lastError.value = null
    setInMemoryAuthSnapshot({ accessToken: access, subject: null, generation: authEpoch.value, authenticated: false })
    markSessionHint()
  }

  async function restore(): Promise<void> {
    if (restored.value) return
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      const generation = authEpoch.value
      status.value = 'restoring'
      try {
        if (!accessToken.value && !hasSessionHint()) {
          clear()
          status.value = 'unauthenticated'
          return
        }
        if (!accessToken.value) {
          const pair = await adapter().refresh()
          if (generation !== authEpoch.value) return
          setTokenPair(pair)
        }
        const snapshot = await adapter().restoreSession()
        if (generation !== authEpoch.value) return
        if (!snapshot?.principal) {
          clear()
          status.value = 'unauthenticated'
          return
        }
        applySnapshot(snapshot)
        if (accessToken.value) {
          const permissionSnapshot = await adapter().getPermissions()
          if (generation !== authEpoch.value) return
          if (!permissionSnapshot?.principal) throw new Error('认证服务未确认当前主体。')
          applySnapshot(permissionSnapshot)
        }
        if (accessToken.value) status.value = 'authenticated'
        else status.value = 'unauthenticated'
      } catch (error) {
        if (generation !== authEpoch.value) return
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
    clear()
    const generation = authEpoch.value
    status.value = 'restoring'
    authErrorCode.value = null
    lastError.value = null
    try {
      const pair = await adapter().login({
        identifier: identifier.trim(),
        password,
        device: { deviceType: 'WEB', clientVersion: 'local-dev', deviceName: '浏览器' },
      })
      if (generation !== authEpoch.value) return false
      setTokenPair(pair)
      const snapshot = await adapter().getPermissions()
      if (generation !== authEpoch.value) return false
      if (!snapshot?.principal) throw new Error('认证服务未确认当前主体。')
      applySnapshot(snapshot)
      return true
    } catch (error) {
      if (generation !== authEpoch.value) return false
      clear()
      status.value = 'error'
      authErrorCode.value = 'AUTH_FAILED'
      // Anti-enumeration + rate-limit surfacing: the message never says whether the
      // identifier exists; 429/423 keep their own recoverable wording from the server.
      lastError.value = learnerAuthFailureMarker(error)
      return false
    }
  }

  async function register(identifier: string, password: string): Promise<boolean> {
    clear()
    const generation = authEpoch.value
    status.value = 'restoring'
    authErrorCode.value = null
    lastError.value = null
    try {
      const pair = await adapter().register({
        identifier: identifier.trim(),
        password,
        device: { deviceType: 'WEB', clientVersion: 'local-dev', deviceName: '浏览器' },
      })
      if (generation !== authEpoch.value) return false
      setTokenPair(pair)
      const snapshot = await adapter().getPermissions()
      if (generation !== authEpoch.value) return false
      if (!snapshot?.principal) throw new Error('认证服务未确认当前主体。')
      applySnapshot(snapshot)
      return true
    } catch (error) {
      if (generation !== authEpoch.value) return false
      clear()
      status.value = 'error'
      authErrorCode.value = 'AUTH_FAILED'
      lastError.value = learnerAuthFailureMarker(error)
      return false
    }
  }

  async function requestPasswordReset(identifier: string): Promise<boolean> {
    lastError.value = null
    try {
      await adapter().requestPasswordReset({ identifier: identifier.trim() })
      // Anti-enumeration: identical success wording whether or not the account exists.
      return true
    } catch (error) {
      lastError.value = error instanceof ApiError && error.status === 429
        ? '请求过于频繁，请稍后再试。'
        : error instanceof Error ? error.message : 'RESET_REQUEST_FAILED'
      return false
    }
  }

  async function confirmPasswordReset(identifier: string, resetToken: string, newPassword: string): Promise<boolean> {
    lastError.value = null
    try {
      await adapter().confirmPasswordReset({ identifier: identifier.trim(), resetToken: resetToken.trim(), newPassword })
      return true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'RESET_CONFIRM_FAILED'
      return false
    }
  }

  async function refreshSilently(options: { clearOnFailure?: boolean } = {}): Promise<boolean> {
    const clearOnFailure = options.clearOnFailure !== false
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      if (!accessToken.value && !hasSessionHint()) return false
      const generation = authEpoch.value
      status.value = 'refreshing'
      try {
        const pair = await adapter().refresh()
        if (generation !== authEpoch.value) return false
        setTokenPair(pair)
        status.value = 'refreshing'
        const snapshot = await adapter().getPermissions()
        if (generation !== authEpoch.value) return false
        if (!snapshot?.principal) throw new Error('认证服务未确认当前主体。')
        applySnapshot(snapshot)
        status.value = 'authenticated'
        return true
      } catch (error) {
        if (generation !== authEpoch.value) return false
        lastError.value = error instanceof Error ? error.message : 'SESSION_EXPIRED'
        authErrorCode.value = 'SESSION_EXPIRED'
        if (clearOnFailure) {
          clear()
          status.value = 'unauthenticated'
        } else if (accessToken.value) {
          // Keep the still-valid access token so onboarding can show the error
          // instead of looking like a dead "继续" button after consents already saved.
          status.value = 'authenticated'
        } else {
          status.value = 'unauthenticated'
        }
        return false
      } finally {
        refreshPromise = null
      }
    })()
    return refreshPromise
  }

  async function logout(allDevices = false): Promise<boolean> {
    const revokingToken = accessToken.value
    authEpoch.value += 1
    setInMemoryAuthSnapshot({ accessToken: revokingToken, subject: null, generation: authEpoch.value, authenticated: false })
    clearB4OfflineSnapshot()
    const generation = authEpoch.value
    status.value = 'revoking'
    try {
      await adapter().logout({ allDevices })
      if (generation !== authEpoch.value) return false
      clear()
      // The session is dead from here on: never leave the user on a now-unauthorized
      // page waiting for a guard that only runs on navigation.
      await navigateToLogin('/home').catch(() => {})
      return true
    } catch (error) {
      if (generation !== authEpoch.value) return false
      clear()
      lastError.value = error instanceof Error ? error.message : 'LOGOUT_FAILED'
      authErrorCode.value = 'LOGOUT_FAILED'
      status.value = 'unauthenticated'
      await navigateToLogin('/home').catch(() => {})
      return false
    }
  }

  async function revokeCurrentSession(): Promise<boolean> {
    if (!sessionId.value) { clear(); return false }
    const revokingToken = accessToken.value
    authEpoch.value += 1
    setInMemoryAuthSnapshot({ accessToken: revokingToken, subject: null, generation: authEpoch.value, authenticated: false })
    clearB4OfflineSnapshot()
    const generation = authEpoch.value
    const revokingSessionId = sessionId.value
    status.value = 'revoking'
    try {
      await adapter().revoke(revokingSessionId)
      if (generation !== authEpoch.value) return false
      clear()
      return true
    } catch (error) {
      if (generation !== authEpoch.value) return false
      clear()
      lastError.value = error instanceof Error ? error.message : 'REVOKE_FAILED'
      authErrorCode.value = 'REVOKE_FAILED'
      status.value = 'unauthenticated'
      return false
    }
  }

  // P1-LIVE-014: the server only accepts b30-adult-v1; the old v2-phase1 default
  // made every UI gate confirmation fail with policy_version_invalid.
  async function confirmAdultGate(birthYear: number, policyVersion = 'b30-adult-v1'): Promise<boolean> {
    const generation = authEpoch.value
    try {
      const snapshot = await adapter().confirmAdultGate({ confirmed: true, birthYear, policyVersion })
      if (generation !== authEpoch.value) return false
      applySnapshot(snapshot)
      adultGate.value = snapshot?.adultGate === 'PASSED' ? 'PASSED' : 'REJECTED'
      return adultGate.value === 'PASSED'
    } catch (error) {
      if (generation !== authEpoch.value) return false
      adultGate.value = 'REJECTED'
      lastError.value = error instanceof Error ? error.message : 'ADULT_GATE_FAILED'
      return false
    }
  }

  function setReturnTo(value: unknown): void {
    const returnTo = safeReturnTo(value)
    memoryReturnTo = returnTo
    preferMemoryReturnTo = false
    consumedPersistedReturnTo = null

    const storage = getReturnToStorage()
    if (!storage) {
      preferMemoryReturnTo = true
      return
    }
    try {
      storage.setItem(RETURN_TO_KEY, returnTo)
    } catch {
      // If a previous value cannot be replaced, ignore it until a later write
      // succeeds so it cannot override this navigation's in-memory target.
      preferMemoryReturnTo = true
      removePersistedReturnTo(storage)
    }
  }

  function consumeReturnTo(): string {
    if (preferMemoryReturnTo) {
      const value = safeReturnTo(memoryReturnTo ?? '/home')
      memoryReturnTo = null
      return value
    }

    const storage = getReturnToStorage()
    if (!storage) {
      preferMemoryReturnTo = true
      const value = safeReturnTo(memoryReturnTo ?? '/home')
      memoryReturnTo = null
      return value
    }

    try {
      const persistedReturnTo = storage.getItem(RETURN_TO_KEY)
      if (persistedReturnTo !== null && persistedReturnTo !== consumedPersistedReturnTo) {
        memoryReturnTo = null
        try {
          storage.removeItem(RETURN_TO_KEY)
        } catch {
          // Keep a one-shot marker when storage refuses removal.
          consumedPersistedReturnTo = persistedReturnTo
        }
        return safeReturnTo(persistedReturnTo)
      }
      if (persistedReturnTo !== null) removePersistedReturnTo(storage)
      const value = safeReturnTo(memoryReturnTo ?? '/home')
      memoryReturnTo = null
      return value
    } catch {
      preferMemoryReturnTo = true
      removePersistedReturnTo(storage)
      const value = safeReturnTo(memoryReturnTo ?? '/home')
      memoryReturnTo = null
      return value
    }
  }

  function peekReturnTo(): string {
    if (preferMemoryReturnTo) return safeReturnTo(memoryReturnTo ?? '/home')

    const storage = getReturnToStorage()
    if (!storage) {
      preferMemoryReturnTo = true
      return safeReturnTo(memoryReturnTo ?? '/home')
    }

    try {
      const persistedReturnTo = storage.getItem(RETURN_TO_KEY)
      if (persistedReturnTo !== null && persistedReturnTo !== consumedPersistedReturnTo) {
        return safeReturnTo(persistedReturnTo)
      }
      if (persistedReturnTo !== null) removePersistedReturnTo(storage)
      return safeReturnTo(memoryReturnTo ?? '/home')
    } catch {
      preferMemoryReturnTo = true
      removePersistedReturnTo(storage)
      return safeReturnTo(memoryReturnTo ?? '/home')
    }
  }

  async function handleUnauthorized(binding?: ApiAuthBinding | null): Promise<void> {
    const stillBound = !binding || matchesAuthBinding(binding)
    const alreadyExpired = Boolean(binding && authEpoch.value > binding.generation && !accessToken.value
      && !principal.value && status.value === 'unauthenticated')
    if (binding && !stillBound && !alreadyExpired) return
    const current = currentInternalPath()
    const returnTo = current === '/login' || current === '/forbidden' ? '/home' : current
    setReturnTo(returnTo)
    if (stillBound) clear()
    status.value = 'unauthenticated'
    authErrorCode.value = 'SESSION_EXPIRED'
    lastError.value = 'SESSION_EXPIRED'
    await navigateToLogin(returnTo)
  }

  function matchesAuthBinding(binding: ApiAuthBinding): boolean {
    const subject = principal.value?.subject?.trim()
    const readyStatus = status.value === 'authenticated' || status.value === 'refreshing'
    return Boolean(readyStatus && accessToken.value && subject === binding.subject
      && authEpoch.value === binding.generation && (!userId.value || userId.value === subject))
  }

  async function handleForbidden(error: ApiError, binding?: ApiAuthBinding | null): Promise<void> {
    if (binding && !matchesAuthBinding(binding)) return
    forbiddenReason.value = forbiddenMessage(error)
    const attemptedPath = currentInternalPath()
    const { router } = await import('../router')
    if (binding && !matchesAuthBinding(binding)) return
    // Onboarding is the only place where an adult can grant the missing IAM
    // consents. Owner PEPs may use a generic 403 before consent; keep the form
    // available and let it show the local error instead of stranding the user.
    if (router.currentRoute.value.name === 'onboarding') return
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

  function markLearningConsentWithdrawn(): void {
    learningConsentWithdrawn.value = true
    permissions.value = permissions.value.filter((item) => item !== 'learning.plan.read')
  }
  function clear(): void {
    authEpoch.value += 1
    setInMemoryAuthSnapshot({ accessToken: null, subject: null, generation: authEpoch.value, authenticated: false })
    clearB1Snapshot()
    clearB4OfflineSnapshot()
    accessToken.value = null
    deviceId.value = null
    memoryDeviceId = null
    sessionId.value = null
    userId.value = null
    principal.value = null
    permissions.value = []
    adultGate.value = 'UNKNOWN'
    learningConsentWithdrawn.value = false
    status.value = 'unauthenticated'
    lastError.value = null
    authErrorCode.value = null
    forbiddenReason.value = null
    clearSessionHint()
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
    learningConsentWithdrawn,
    lastError,
    authErrorCode,
    forbiddenReason,
    restored,
    authGeneration,
    isAuthenticated,
    isLearningReady,
    isAdultGateRejected,
    markLearningConsentWithdrawn,
    restore,
    prepareLogin,
    login,
    register,
    requestPasswordReset,
    confirmPasswordReset,
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
