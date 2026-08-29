import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getInMemoryAccessToken, setInMemoryAccessToken } from '../auth/access-token'
import { createGatewayMobileAuthAdapter, safeMobileReturnTo, type MobileAdultGateStatus, type MobileAuthAdapter, type MobileAuthSnapshot, type MobileLoginCredentials, type MobileTokenPair } from '../auth/gateway-auth'
import { getUniRuntime, isNativeAppRuntime, type UniSecureStorage, type UniRuntime } from '../platform/uni-runtime'

const REFRESH_TOKEN_KEY = 'yx.auth.mobile.refresh-token'
const RETURN_TO_KEY = 'yx.auth.mobile.return-to'

function runtimeOrNull(): UniRuntime | null { try { return getUniRuntime() } catch { return null } }
function secureStorage(): UniSecureStorage | undefined { return runtimeOrNull()?.getSecureStorage?.() }
function secureValue(key: string): string | null { try { const value = secureStorage()?.getItem(key); return typeof value === 'string' && value.trim() ? value.trim() : null } catch { return null } }
function deviceType(): MobileLoginCredentials['device']['deviceType'] {
  const platform = String(runtimeOrNull()?.getSystemInfoSync?.().osName ?? runtimeOrNull()?.getSystemInfoSync?.().platform ?? '').toLowerCase()
  if (platform === 'ios') return 'IOS'
  if (platform === 'android') return 'ANDROID'
  return isNativeAppRuntime() ? 'IPAD' : 'H5'
}

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const deviceId = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const permissions = ref<readonly string[]>([])
  const status = ref<'unknown' | 'restoring' | 'authenticated' | 'refreshing' | 'revoking' | 'unauthenticated' | 'error'>('unknown')
  const adultGate = ref<MobileAdultGateStatus>('UNKNOWN')
  const lastError = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => status.value === 'authenticated' && Boolean(accessToken.value))
  const isLearningReady = computed(() => isAuthenticated.value && adultGate.value === 'PASSED')
  let activeAdapter: MobileAuthAdapter | null = null
  let restorePromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null

  function adapter(): MobileAuthAdapter { if (!activeAdapter) activeAdapter = createGatewayMobileAuthAdapter(); return activeAdapter }
  function applySnapshot(snapshot: MobileAuthSnapshot | null): void { if (!snapshot) return; if (snapshot.tokenPair) setTokenPair(snapshot.tokenPair); permissions.value = snapshot.permissions ?? permissions.value; adultGate.value = snapshot.adultGate ?? adultGate.value }
  function setTokenPair(pair: MobileTokenPair): void {
    if (!pair.accessToken.trim()) throw new Error('认证服务没有返回访问凭证。')
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
    setInMemoryAccessToken(accessToken.value)
    status.value = 'authenticated'
    lastError.value = null
  }
  async function restore(): Promise<void> {
    if (restored.value) return
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      status.value = 'restoring'
      accessToken.value = getInMemoryAccessToken()
      refreshToken.value = isNativeAppRuntime() ? secureValue(REFRESH_TOKEN_KEY) : null
      try {
        let restoredSession = false
        if (accessToken.value) {
          const snapshot = await adapter().restoreSession()
          if (snapshot) { applySnapshot(snapshot); restoredSession = true }
        }
        if (!restoredSession && (isNativeAppRuntime() ? Boolean(refreshToken.value) : true)) restoredSession = await refreshSilently()
        if (!restoredSession) clear()
        if (accessToken.value) applySnapshot(await adapter().getPermissions())
        status.value = accessToken.value ? 'authenticated' : 'unauthenticated'
      } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'SESSION_RESTORE_FAILED' } finally { restored.value = true; restorePromise = null }
    })()
    return restorePromise
  }
  async function login(identifier: string, password: string): Promise<boolean> {
    status.value = 'restoring'
    lastError.value = null
    try {
      setTokenPair(await adapter().login({
        identifier: identifier.trim(),
        password,
        device: { deviceType: deviceType(), clientVersion: 'local-dev', deviceName: '语学星移动端' },
      }))
      applySnapshot(await adapter().getPermissions())
      status.value = 'authenticated'
      restored.value = true
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
      const native = isNativeAppRuntime()
      const nativeRefreshToken = native ? refreshToken.value : null
      if (native && !nativeRefreshToken) { clear(); return false }
      status.value = 'refreshing'
      try {
        setTokenPair(await adapter().refresh(nativeRefreshToken ? { refreshToken: nativeRefreshToken } : undefined))
        applySnapshot(await adapter().getPermissions())
        return true
      } catch (error) {
        clear()
        lastError.value = error instanceof Error ? error.message : 'SESSION_EXPIRED'
        return false
      } finally { refreshPromise = null }
    })()
    return refreshPromise
  }
  async function logout(): Promise<boolean> { status.value = 'revoking'; try { await adapter().logout(); clear(); return true } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'LOGOUT_FAILED'; return false } }
  async function revokeCurrentSession(): Promise<boolean> { if (!sessionId.value) { clear(); return false } status.value = 'revoking'; try { await adapter().revoke(sessionId.value); clear(); return true } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'REVOKE_FAILED'; return false } }
  async function confirmAdultGate(birthYear: number, policyVersion = 'v2-phase1'): Promise<boolean> { try { const snapshot = await adapter().confirmAdultGate({ confirmed: true, birthYear, policyVersion }); applySnapshot(snapshot); adultGate.value = snapshot?.adultGate === 'PASSED' ? 'PASSED' : 'REJECTED'; return adultGate.value === 'PASSED' } catch (error) { adultGate.value = 'REJECTED'; lastError.value = error instanceof Error ? error.message : 'ADULT_GATE_FAILED'; return false } }
  function setReturnTo(value: unknown): void { runtimeOrNull()?.setStorageSync(RETURN_TO_KEY, safeMobileReturnTo(value)) }
  function peekReturnTo(): string { const value = runtimeOrNull()?.getStorageSync(RETURN_TO_KEY); return safeMobileReturnTo(typeof value === 'string' ? value : null) }
  function consumeReturnTo(): string { const value = peekReturnTo(); runtimeOrNull()?.removeStorageSync(RETURN_TO_KEY); return value }
  function setAuthAdapter(next: MobileAuthAdapter): void { activeAdapter = next }
  function clear(): void {
    accessToken.value = null
    refreshToken.value = null
    deviceId.value = null
    sessionId.value = null
    permissions.value = []
    adultGate.value = 'UNKNOWN'
    status.value = 'unauthenticated'
    setInMemoryAccessToken(null)
    try { secureStorage()?.removeItem(REFRESH_TOKEN_KEY) } catch { /* best effort */ }
  }

  return { accessToken, deviceId, sessionId, permissions, status, adultGate, lastError, restored, isAuthenticated, isLearningReady, restore, login, refreshSilently, logout, revokeCurrentSession, confirmAdultGate, setReturnTo, peekReturnTo, consumeReturnTo, setAuthAdapter, clear }
})

export function readAccessToken(): string | null { return getInMemoryAccessToken() }
export function hasSecureSessionStorage(): boolean { return Boolean(secureStorage()) }
export function readSecureRefreshToken(): string | null { return secureValue(REFRESH_TOKEN_KEY) }
