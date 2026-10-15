import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getInMemoryAccessToken, setInMemoryAccessToken, setInMemoryRequestIdentity } from '../auth/access-token'
import { mobileAuthFailureMarker } from '../auth/auth-failure-copy'
import { createGatewayMobileAuthAdapter, safeMobileReturnTo, type MobileAdultGateStatus, type MobileAdultLearningAccess, type MobileAuthAdapter, type MobileAuthSnapshot, type MobileLoginCredentials, type MobileTokenPair } from '../auth/gateway-auth'
import { getUniRuntime, isNativeAppRuntime, type UniSecureStorage, type UniRuntime } from '../platform/uni-runtime'
import { removeAllLearningCaches } from './learning-cache'

const REFRESH_TOKEN_KEY = 'yx.auth.mobile.refresh-token'
const RETURN_TO_KEY = 'yx.auth.mobile.return-to'
const MOBILE_SESSION_HINT_KEY = 'yx.auth.mobile.session-hint'

function hasMobileSessionHint(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(MOBILE_SESSION_HINT_KEY) === '1'
  } catch { /* ignore */ }
  return false
}

function markMobileSessionHint(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(MOBILE_SESSION_HINT_KEY, '1')
  } catch { /* ignore */ }
}

function clearMobileSessionHint(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(MOBILE_SESSION_HINT_KEY)
  } catch { /* ignore */ }
}

/**
 * The consent policy version the adult gate attests against.
 *
 * The server accepts exactly one value, checked literally in IamProviderBoundaryController's
 * POST /iam/adult-gate; anything else is rejected with iam.adult_gate.policy_version_invalid and the
 * gate stays closed. This constant previously read 'v2-phase1', which the server has never accepted,
 * so no mobile learner could pass the adult gate and onboarding could not complete.
 * The contract test beside this store pins the value against the server's own literal.
 */
export const ADULT_GATE_POLICY_VERSION = 'b30-adult-v1'

function runtimeOrNull(): UniRuntime | null { try { return getUniRuntime() } catch { return null } }
function secureStorage(): UniSecureStorage | undefined { return runtimeOrNull()?.getSecureStorage?.() }
function secureValue(key: string): string | null { try { const value = secureStorage()?.getItem(key); return typeof value === 'string' && value.trim() ? value.trim() : null } catch { return null } }
function deviceType(): MobileLoginCredentials['device']['deviceType'] {
  if (!isNativeAppRuntime()) return 'H5'
  const platform = String(runtimeOrNull()?.getSystemInfoSync?.().osName ?? runtimeOrNull()?.getSystemInfoSync?.().platform ?? '').toLowerCase()
  if (platform === 'ios') return 'IOS'
  if (platform === 'android') return 'ANDROID'
  return 'IPAD'
}

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const deviceId = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const verifiedSubject = ref<string | null>(null)
  const identityRevision = ref(0)
  const permissions = ref<readonly string[]>([])
  const status = ref<'unknown' | 'restoring' | 'authenticated' | 'refreshing' | 'revoking' | 'unauthenticated' | 'error'>('unknown')
  const adultGate = ref<MobileAdultGateStatus>('UNKNOWN')
  const adultLearningAccess = ref<MobileAdultLearningAccess>('UNKNOWN')
  const learningConsentWithdrawn = ref(false)
  const withdrawnMarkerKey = 'yx.auth.learning-consent-withdrawn'
  const lastError = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => status.value === 'authenticated' && Boolean(accessToken.value) && Boolean(verifiedSubject.value))
  const isLearningReady = computed(() => isAuthenticated.value && adultGate.value === 'PASSED' && adultLearningAccess.value === 'ELIGIBLE' && permissions.value.includes('learning.plan.read'))
  let activeAdapter: MobileAuthAdapter | null = null
  let restorePromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null
  let transientReturnTo: string | null = null
  let authEpoch = 0

  function adapter(): MobileAuthAdapter { if (!activeAdapter) activeAdapter = createGatewayMobileAuthAdapter(); return activeAdapter }
  function applySnapshot(snapshot: MobileAuthSnapshot | null): void { if (!snapshot) return; if (snapshot.tokenPair) setTokenPair(snapshot.tokenPair); permissions.value = snapshot.permissions ?? permissions.value; adultGate.value = snapshot.adultGate ?? 'UNKNOWN'; adultLearningAccess.value = snapshot.adultLearningAccess ?? 'UNKNOWN' }
  function acceptPermissions(snapshot: MobileAuthSnapshot | null): void {
    const subject = snapshot?.principal?.subject?.trim()
    if (!subject) throw new Error('认证服务未返回可核验的账号身份。')
    applySnapshot(snapshot)
    if (verifiedSubject.value !== subject) {
      if (verifiedSubject.value) removeAllLearningCaches()
      verifiedSubject.value = subject
      identityRevision.value += 1
    }
    setInMemoryRequestIdentity(getMobileApiIdentity(), identityRevision.value)
  }
  function getMobileApiIdentity(): { subject: string; revision: number } | null {
    const subject = verifiedSubject.value
    return subject ? { subject, revision: identityRevision.value } : null
  }
  function hasMobileApiIdentity(identity: { subject: string; revision: number }): boolean {
    return verifiedSubject.value === identity.subject && identityRevision.value === identity.revision
  }
  function setTokenPair(pair: MobileTokenPair): void {
    if (!pair.accessToken.trim()) throw new Error('认证服务没有返回访问凭证。')
    setInMemoryRequestIdentity(null, identityRevision.value)
    const native = isNativeAppRuntime()
    const nextRefresh = pair.refreshToken?.trim() || null
    if (native) {
      const secure = secureStorage()
      if (!secure) throw new Error('移动端安全存储不可用，未建立可恢复会话。')
      if (!nextRefresh) throw new Error('认证服务没有返回移动端 Refresh Token。')
      try { secure.setItem(REFRESH_TOKEN_KEY, nextRefresh) } catch { throw new Error('移动端安全存储写入失败，未建立可恢复会话。') }
    }
    accessToken.value = pair.accessToken.trim()
    refreshToken.value = native ? nextRefresh : null
    deviceId.value = pair.deviceId?.trim() || deviceId.value
    sessionId.value = pair.sessionId?.trim() || sessionId.value
    adultGate.value = pair.adultGate ?? adultGate.value
    adultLearningAccess.value = pair.adultLearningAccess ?? 'UNKNOWN'
    setInMemoryAccessToken(accessToken.value)
    markMobileSessionHint()
    lastError.value = null
  }
  async function restore(): Promise<void> {
    // Navigation must wait for the current refresh verdict, without granting
    // authenticated access while that refresh is still pending.
    if (refreshPromise) await refreshPromise
    if (restored.value) return
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      const epoch = authEpoch
      // A same-account H5 reload comes back through the IAM cookie. The
      // placement checkpoint lives in the subject-scoped learning cache, so
      // this path only drops the in-memory identity. Logout and clear still
      // delete that cache; a different subject is dropped when the cache is read.
      forgetInMemoryLearningIdentity()
      status.value = 'restoring'
      accessToken.value = getInMemoryAccessToken()
      refreshToken.value = isNativeAppRuntime() ? secureValue(REFRESH_TOKEN_KEY) : null
      try {
        let restoredSession = false
        if (accessToken.value) {
          const snapshot = await adapter().restoreSession()
          if (epoch !== authEpoch) return
          if (snapshot) { applySnapshot(snapshot); restoredSession = true }
        }
        if (!restoredSession && (isNativeAppRuntime() ? Boolean(refreshToken.value) : hasMobileSessionHint())) restoredSession = await refreshSilently()
        if (epoch !== authEpoch) return
        if (!restoredSession) { clear(); return }
        const snapshot = await adapter().getPermissions()
        if (epoch !== authEpoch) return
        acceptPermissions(snapshot)
        status.value = 'authenticated'
      } catch (error) { if (epoch === authEpoch) { clear(); lastError.value = error instanceof Error ? error.message : 'SESSION_RESTORE_FAILED' } } finally { restored.value = true; restorePromise = null }
    })()
    return restorePromise
  }
  function withdrawnMarker(): boolean {
    if (learningConsentWithdrawn.value) return true
    try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(withdrawnMarkerKey) === '1' } catch { return false }
  }
  function rememberWithdrawn(): void {
    learningConsentWithdrawn.value = true
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(withdrawnMarkerKey, '1') } catch { /* Private mode keeps the in-memory flag. */ }
  }
  function dropWithdrawnMarker(): void {
    learningConsentWithdrawn.value = false
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(withdrawnMarkerKey) } catch { /* The in-memory flag is already clear. */ }
  }
  async function login(identifier: string, password: string): Promise<boolean> {
    dropWithdrawnMarker()
    clear()
    const epoch = authEpoch
    status.value = 'restoring'
    lastError.value = null
    try {
      const pair = await adapter().login({
        identifier: identifier.trim(),
        password,
        device: { deviceType: deviceType(), clientVersion: 'local-dev', deviceName: '语学星移动端' },
      })
      if (epoch !== authEpoch) return false
      setTokenPair(pair)
      const snapshot = await adapter().getPermissions()
      if (epoch !== authEpoch) return false
      acceptPermissions(snapshot)
      status.value = 'authenticated'
      restored.value = true
      return true
    } catch (error) {
      if (epoch !== authEpoch) return false
      clear()
      status.value = 'error'
      lastError.value = mobileAuthFailureMarker(error)
      return false
    }
  }
  async function register(identifier: string, password: string): Promise<boolean> {
    dropWithdrawnMarker()
    clear()
    const epoch = authEpoch
    status.value = 'restoring'
    lastError.value = null
    try {
      const pair = await adapter().register({
        identifier: identifier.trim(),
        password,
        device: { deviceType: deviceType(), clientVersion: 'local-dev', deviceName: '语学星移动端' },
      })
      if (epoch !== authEpoch) return false
      setTokenPair(pair)
      const snapshot = await adapter().getPermissions()
      if (epoch !== authEpoch) return false
      acceptPermissions(snapshot)
      status.value = 'authenticated'
      restored.value = true
      return true
    } catch (error) {
      if (epoch !== authEpoch) return false
      clear()
      status.value = 'error'
      lastError.value = mobileAuthFailureMarker(error)
      return false
    }
  }
  async function requestPasswordReset(identifier: string): Promise<boolean> {
    lastError.value = null
    try {
      await adapter().requestPasswordReset({ identifier: identifier.trim() })
      return true
    } catch (error) {
      lastError.value = mobileAuthFailureMarker(error)
      return false
    }
  }
  async function confirmPasswordReset(identifier: string, token: string, newPassword: string): Promise<boolean> {
    lastError.value = null
    try {
      await adapter().confirmPasswordReset({ identifier: identifier.trim(), resetToken: token.trim(), newPassword })
      return true
    } catch (error) {
      lastError.value = mobileAuthFailureMarker(error)
      return false
    }
  }
  async function refreshSilently(): Promise<boolean> {
    if (status.value === 'revoking') return false
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      const epoch = authEpoch
      const verifiedSubjectAtRefresh = verifiedSubject.value
      const native = isNativeAppRuntime()
      const nativeRefreshToken = native ? refreshToken.value : null
      if (native && !nativeRefreshToken) { clear(); return false }
      if (!native && !hasMobileSessionHint() && !getInMemoryAccessToken()) { clear(); return false }
      status.value = 'refreshing'
      try {
        const pair = await adapter().refresh(nativeRefreshToken ? { refreshToken: nativeRefreshToken } : undefined)
        if (epoch !== authEpoch) return false
        setTokenPair(pair)
        const snapshot = await adapter().getPermissions()
        if (epoch !== authEpoch) return false
        const refreshedSubject = snapshot?.principal?.subject?.trim()
        if (verifiedSubjectAtRefresh && refreshedSubject !== verifiedSubjectAtRefresh) {
          throw new Error('刷新后的账号身份与当前账号不一致，请重新登录。')
        }
        acceptPermissions(snapshot)
        status.value = 'authenticated'
        return true
      } catch (error) {
        if (epoch !== authEpoch) return false
        clear()
        lastError.value = error instanceof Error ? error.message : 'SESSION_EXPIRED'
        return false
      } finally { refreshPromise = null }
    })()
    return refreshPromise
  }
  async function refreshSilentlyForIdentity(identity: { subject: string; revision: number }): Promise<boolean> {
    if (!hasMobileApiIdentity(identity)) return false
    const refreshed = await refreshSilently()
    return refreshed && hasMobileApiIdentity(identity) && isAuthenticated.value
  }
  async function logout(): Promise<boolean> {
    authEpoch += 1
    invalidateLearningIdentity()
    const epoch = authEpoch
    status.value = 'revoking'
    try { await adapter().logout(); if (epoch === authEpoch) clear(); return true }
    catch (error) { if (epoch === authEpoch) { clear(); lastError.value = error instanceof Error ? error.message : 'LOGOUT_FAILED' } return false }
  }
  async function revokeCurrentSession(): Promise<boolean> {
    if (!sessionId.value) { clear(); return false }
    authEpoch += 1
    invalidateLearningIdentity()
    const epoch = authEpoch
    const currentSessionId = sessionId.value
    status.value = 'revoking'
    try { await adapter().revoke(currentSessionId); if (epoch === authEpoch) clear(); return true }
    catch (error) { if (epoch === authEpoch) { clear(); lastError.value = error instanceof Error ? error.message : 'REVOKE_FAILED' } return false }
  }
  async function confirmAdultGate(birthYear: number, policyVersion = ADULT_GATE_POLICY_VERSION): Promise<boolean> {
    const epoch = authEpoch
    const subject = verifiedSubject.value
    const revision = identityRevision.value
    if (!subject || !isAuthenticated.value) return false
    try {
      const snapshot = await adapter().confirmAdultGate({ confirmed: true, birthYear, policyVersion })
      if (epoch !== authEpoch || subject !== verifiedSubject.value) return false
      if (snapshot?.principal?.subject && snapshot.principal.subject !== subject) throw new Error('账号身份已变化，请重新登录。')
      applySnapshot(snapshot)
      adultGate.value = snapshot?.adultGate ?? 'UNKNOWN'
      adultLearningAccess.value = snapshot?.adultLearningAccess ?? 'UNKNOWN'
      if (adultGate.value !== 'PASSED' || adultLearningAccess.value !== 'ELIGIBLE') return false
      // The adult fact is not a new JWT. Refresh existing IAM claims before learner operations.
      if (!await refreshSilentlyForIdentity({ subject, revision })) return false
      return adultGate.value === 'PASSED' && adultLearningAccess.value === 'ELIGIBLE'
    } catch (error) {
      if (epoch !== authEpoch || subject !== verifiedSubject.value) return false
      adultGate.value = 'UNKNOWN'; adultLearningAccess.value = 'UNKNOWN'; lastError.value = error instanceof Error ? error.message : 'ADULT_GATE_FAILED'; return false
    }
  }
  function setReturnTo(value: unknown): void {
    transientReturnTo = safeMobileReturnTo(value)
    try {
      const runtime = runtimeOrNull()
      if (typeof runtime?.setStorageSync === 'function') runtime.setStorageSync(RETURN_TO_KEY, transientReturnTo)
    } catch { /* H5 can mount before its storage bridge is ready. */ }
  }
  function peekReturnTo(): string {
    try {
      const runtime = runtimeOrNull()
      const stored = typeof runtime?.getStorageSync === 'function' ? runtime.getStorageSync(RETURN_TO_KEY) : null
      return safeMobileReturnTo(typeof stored === 'string' ? stored : transientReturnTo)
    } catch { return safeMobileReturnTo(transientReturnTo) }
  }
  function consumeReturnTo(): string {
    const value = peekReturnTo()
    transientReturnTo = null
    try {
      const runtime = runtimeOrNull()
      if (typeof runtime?.removeStorageSync === 'function') runtime.removeStorageSync(RETURN_TO_KEY)
    } catch { /* In-memory return path has already been consumed. */ }
    return value
  }
  function setAuthAdapter(next: MobileAuthAdapter): void { activeAdapter = next }
  function forgetInMemoryLearningIdentity(): void {
    verifiedSubject.value = null
    identityRevision.value += 1
    setInMemoryRequestIdentity(getMobileApiIdentity(), identityRevision.value)
  }
  function invalidateLearningIdentity(): void {
    forgetInMemoryLearningIdentity()
    removeAllLearningCaches()
  }
  function markLearningConsentWithdrawn(): void {
    rememberWithdrawn()
    permissions.value = permissions.value.filter((item) => item !== 'learning.plan.read')
  }
  async function refreshGateFromServer(): Promise<void> {
    if (status.value !== 'authenticated' || !accessToken.value) return
    const epoch = authEpoch, subject = verifiedSubject.value
    try {
      const snapshot = await adapter().getPermissions()
      if (epoch !== authEpoch || subject !== verifiedSubject.value) return
      if (snapshot?.principal?.subject?.trim() !== subject) throw new Error('资格读取未返回当前账号身份。')
      acceptPermissions(snapshot)
      if (learningConsentWithdrawn.value) permissions.value = permissions.value.filter((item) => item !== 'learning.plan.read')
    } catch (error) {
      if (epoch === authEpoch && subject === verifiedSubject.value) { adultGate.value = 'UNKNOWN'; adultLearningAccess.value = 'UNKNOWN' }
      throw error
    }
  }
  function clear(): void {
    const withdrawn = withdrawnMarker()
    authEpoch += 1
    invalidateLearningIdentity()
    accessToken.value = null
    refreshToken.value = null
    deviceId.value = null
    sessionId.value = null
    permissions.value = []
    adultGate.value = 'UNKNOWN'
    adultLearningAccess.value = 'UNKNOWN'
    learningConsentWithdrawn.value = false
    status.value = 'unauthenticated'
    setInMemoryAccessToken(null)
    clearMobileSessionHint()
    try { secureStorage()?.removeItem(REFRESH_TOKEN_KEY) } catch { /* best effort */ }
    if (withdrawn) learningConsentWithdrawn.value = true
  }

  return { accessToken, deviceId, sessionId, verifiedSubject, identityRevision, permissions, status, adultGate, adultLearningAccess, learningConsentWithdrawn, lastError, restored, isAuthenticated, isLearningReady, getMobileApiIdentity, restore, login, register, requestPasswordReset, confirmPasswordReset, refreshSilently, refreshSilentlyForIdentity, logout, revokeCurrentSession, confirmAdultGate, setReturnTo, peekReturnTo, consumeReturnTo, setAuthAdapter, markLearningConsentWithdrawn, refreshGateFromServer, clear }
})

export function readAccessToken(): string | null { return getInMemoryAccessToken() }
export function hasSecureSessionStorage(): boolean { return Boolean(secureStorage()) }
export function readSecureRefreshToken(): string | null { return secureValue(REFRESH_TOKEN_KEY) }
