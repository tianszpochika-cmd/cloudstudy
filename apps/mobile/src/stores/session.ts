import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getUniRuntime, type UniSecureStorage, type UniRuntime } from '../platform/uni-runtime'
import { createGatewayMobileAuthAdapter, safeMobileReturnTo, type MobileAdultGateStatus, type MobileAuthAdapter, type MobileAuthSnapshot, type MobileCallbackInput, type MobileTokenPair } from '../auth/gateway-auth'
import { mobileI18nAdapter, mobileThemeController } from '../platform/v2-foundation'

const ACCESS_TOKEN_KEY = 'yx.auth.mobile.access-token'
const REFRESH_TOKEN_KEY = 'yx.auth.mobile.refresh-token'
const DEVICE_ID_KEY = 'yx.auth.mobile.device-id'
const SESSION_ID_KEY = 'yx.auth.mobile.session-id'
const RETURN_TO_KEY = 'yx.auth.mobile.return-to'

function runtimeOrNull(): UniRuntime | null { try { return getUniRuntime() } catch { return null } }
function ordinaryValue(key: string): string | null { const value = runtimeOrNull()?.getStorageSync(key); return typeof value === 'string' && value.trim() ? value.trim() : null }
function secureStorage(): UniSecureStorage | undefined { return runtimeOrNull()?.getSecureStorage?.() }
function secureValue(key: string): string | null { try { return secureStorage()?.getItem(key) ?? null } catch { return null } }

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
  const isAuthenticated = computed(() => Boolean(accessToken.value))
  let activeAdapter: MobileAuthAdapter | null = null
  let restorePromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null

  function adapter(): MobileAuthAdapter { if (!activeAdapter) activeAdapter = createGatewayMobileAuthAdapter(); return activeAdapter }
  function applySnapshot(snapshot: MobileAuthSnapshot | null): void { if (!snapshot) return; if (snapshot.tokenPair) setTokenPair(snapshot.tokenPair); permissions.value = snapshot.permissions ?? permissions.value; adultGate.value = snapshot.adultGate ?? adultGate.value }
  function setTokenPair(pair: MobileTokenPair): void {
    if (!pair.accessToken.trim()) throw new Error('认证服务没有返回访问凭证。')
    accessToken.value = pair.accessToken.trim(); refreshToken.value = pair.refreshToken?.trim() || null; deviceId.value = pair.deviceId?.trim() || deviceId.value; sessionId.value = pair.sessionId?.trim() || sessionId.value; adultGate.value = pair.adultGate ?? adultGate.value; status.value = 'authenticated'; lastError.value = null
    const runtime = runtimeOrNull()
    runtime?.setStorageSync(ACCESS_TOKEN_KEY, accessToken.value)
    if (deviceId.value) runtime?.setStorageSync(DEVICE_ID_KEY, deviceId.value)
    if (sessionId.value) runtime?.setStorageSync(SESSION_ID_KEY, sessionId.value)
    const secure = secureStorage()
    if (secure && refreshToken.value) { try { secure.setItem(REFRESH_TOKEN_KEY, refreshToken.value) } catch { /* keep the token in memory only */ } }
    runtime?.removeStorageSync('yx.session.refresh-token')
  }
  async function restore(): Promise<void> {
    if (restored.value) return
    if (restorePromise) return restorePromise
    restorePromise = (async () => {
      status.value = 'restoring'; accessToken.value = ordinaryValue(ACCESS_TOKEN_KEY); refreshToken.value = secureValue(REFRESH_TOKEN_KEY); deviceId.value = ordinaryValue(DEVICE_ID_KEY); sessionId.value = ordinaryValue(SESSION_ID_KEY)
      try { const snapshot = await adapter().restoreSession(); applySnapshot(snapshot); if (accessToken.value) applySnapshot(await adapter().getPermissions()); status.value = accessToken.value ? 'authenticated' : 'unauthenticated' } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'SESSION_RESTORE_FAILED' } finally { restored.value = true; restorePromise = null }
    })()
    return restorePromise
  }
  function prepareLogin(returnTo: unknown): string { const safe = safeMobileReturnTo(returnTo); setReturnTo(safe); return adapter().startLogin({ returnTo: safe, locale: mobileI18nAdapter.state.locale, theme: mobileThemeController.resolvedTheme }) }
  async function completeLogin(input: MobileCallbackInput): Promise<boolean> { if (input.returnTo) setReturnTo(input.returnTo); status.value = 'restoring'; try { setTokenPair(await adapter().completeLogin(input)); applySnapshot(await adapter().getPermissions()); return true } catch (error) { clear(); status.value = 'error'; lastError.value = error instanceof Error ? error.message : 'LOGIN_FAILED'; return false } }
  async function refreshSilently(): Promise<boolean> {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => { if (!refreshToken.value) { clear(); return false } status.value = 'refreshing'; try { setTokenPair(await adapter().refresh({ refreshToken: refreshToken.value })); applySnapshot(await adapter().getPermissions()); return true } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'SESSION_EXPIRED'; return false } finally { refreshPromise = null } })()
    return refreshPromise
  }
  async function logout(): Promise<boolean> { status.value = 'revoking'; try { await adapter().logout(); clear(); return true } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'LOGOUT_FAILED'; return false } }
  async function revokeCurrentSession(): Promise<boolean> { if (!sessionId.value) { clear(); return false } status.value = 'revoking'; try { await adapter().revoke(sessionId.value); clear(); return true } catch (error) { clear(); lastError.value = error instanceof Error ? error.message : 'REVOKE_FAILED'; return false } }
  async function confirmAdultGate(birthYear: number, policyVersion = 'v2-phase1'): Promise<boolean> { try { const snapshot = await adapter().confirmAdultGate({ birthYear, policyVersion, adultDeclaration: true }); applySnapshot(snapshot); adultGate.value = snapshot?.adultGate === 'PASSED' ? 'PASSED' : 'REJECTED'; return adultGate.value === 'PASSED' } catch (error) { adultGate.value = 'REJECTED'; lastError.value = error instanceof Error ? error.message : 'ADULT_GATE_FAILED'; return false } }
  function setReturnTo(value: unknown): void { runtimeOrNull()?.setStorageSync(RETURN_TO_KEY, safeMobileReturnTo(value)) }
  function consumeReturnTo(): string { const value = safeMobileReturnTo(ordinaryValue(RETURN_TO_KEY)); runtimeOrNull()?.removeStorageSync(RETURN_TO_KEY); return value }
  function setAuthAdapter(next: MobileAuthAdapter): void { activeAdapter = next }
  function readLaunchCallback(): MobileCallbackInput | null { const runtime = runtimeOrNull(); const options = runtime?.getEnterOptionsSync?.() ?? runtime?.getLaunchOptionsSync?.(); const query = options?.query; if (!query || (!query.code && !query.error)) return null; return { code: query.code, state: query.state, error: query.error, errorDescription: query.error_description } }
  function clear(): void { accessToken.value = null; refreshToken.value = null; deviceId.value = null; sessionId.value = null; permissions.value = []; adultGate.value = 'UNKNOWN'; status.value = 'unauthenticated'; const runtime = runtimeOrNull(); runtime?.removeStorageSync(ACCESS_TOKEN_KEY); runtime?.removeStorageSync(DEVICE_ID_KEY); runtime?.removeStorageSync(SESSION_ID_KEY); runtime?.removeStorageSync('yx.session.refresh-token'); try { secureStorage()?.removeItem(REFRESH_TOKEN_KEY) } catch { /* best effort */ } }

  return { accessToken, deviceId, sessionId, permissions, status, adultGate, lastError, restored, isAuthenticated, restore, prepareLogin, completeLogin, refreshSilently, logout, revokeCurrentSession, confirmAdultGate, setReturnTo, consumeReturnTo, setAuthAdapter, readLaunchCallback, clear }
})

export function readAccessToken(): string | null { return ordinaryValue(ACCESS_TOKEN_KEY) }
export function hasSecureSessionStorage(): boolean { return Boolean(secureStorage()) }
export function readSecureRefreshToken(): string | null { return secureValue(REFRESH_TOKEN_KEY) }
