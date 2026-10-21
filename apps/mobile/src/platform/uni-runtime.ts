export interface UniRequestResponse {
  statusCode: number
  data: unknown
}

export interface UniRequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  header?: Record<string, string>
  data?: unknown
  timeout?: number
  withCredentials?: boolean
  success?: (response: UniRequestResponse) => void
  fail?: (error: unknown) => void
}

/** Keychain/Keystore bridge. Refresh tokens may use this capability only; ordinary storage is never a refresh-token fallback. */
export interface UniSecureStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface UniLaunchOptions {
  path?: string
  query?: Record<string, string | undefined>
}

export interface UniAudioContext {
  src: string
  playbackRate?: number
  /** Optional native capability; playback must remain usable when absent. */
  preservesPitch?: boolean
  loop?: boolean
  play(): void
  pause(): void
  destroy(): void
}

/**
 * Enables pitch preservation only when the native audio adapter exposes the
 * optional capability. Unsupported platforms keep playback and let the caller
 * record the visible downgrade; this does not claim cross-platform support.
 */
export function enableUniAudioPitchPreservation(audio: UniAudioContext, onUnsupported?: () => void): boolean {
  try {
    if (!('preservesPitch' in audio)) {
      onUnsupported?.()
      return false
    }
    audio.preservesPitch = true
    if (audio.preservesPitch === true) return true
  } catch {
    // A native adapter may expose a read-only or unsupported capability.
  }
  onUnsupported?.()
  return false
}

export interface UniFileSystemManager {
  readFile(options: { filePath: string; success: (result: { data: ArrayBuffer | string }) => void; fail?: (error: unknown) => void }): void
}

/** Native Keychain/Keystore boundary; raw recording bytes never cross this API. */
export interface UniSecureRecordingVault {
  encryptFile(options: { filePath: string }): Promise<{ encryptedFilePath: string; contentHash: string }>
  createPlaybackSource(options: { encryptedFilePath: string }): Promise<string>
  deleteFile(options: { encryptedFilePath: string }): Promise<void>
}

export interface UniRuntime {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: string): void
  removeStorageSync(key: string): void
  request(options: UniRequestOptions): void
  navigateTo(options: { url: string }): void | Promise<unknown>
  redirectTo?(options: { url: string }): void | Promise<unknown>
  reLaunch?(options: { url: string }): void | Promise<unknown>
  switchTab(options: { url: string }): void | Promise<unknown>
  showToast(options: { title: string; icon?: 'none' | 'success' | 'error' }): void
  addInterceptor?(method: string, interceptor: { invoke?: (options: { url?: string; delta?: number }) => false | { url?: string; delta?: number } | void }): void
  getSecureStorage?: () => UniSecureStorage | undefined
  getSystemInfoSync?: () => { uniPlatform?: string; platform?: string; osName?: string }
  getLaunchOptionsSync?: () => UniLaunchOptions
  getEnterOptionsSync?: () => UniLaunchOptions
  openURL?: (url: string) => void
  createInnerAudioContext?: () => UniAudioContext
  getFileSystemManager?: () => UniFileSystemManager
  getSecureRecordingVault?: () => UniSecureRecordingVault
}

function isHttpBrowserPage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
      && (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  } catch {
    return false
  }
}

/** Native app builds must use the Keychain/Keystore bridge for Refresh Tokens. */
export function isNativeAppRuntime(runtime?: UniRuntime): boolean {
  try {
    if (Boolean((globalThis as typeof globalThis & { plus?: unknown }).plus)) return true
    const current = runtime ?? getUniRuntime()
    const info = current.getSystemInfoSync?.()
    const uniPlatform = String(info?.uniPlatform ?? '').toLowerCase()
    if (uniPlatform === 'app' || uniPlatform === 'app-plus') return true
    if (uniPlatform === 'h5') return false
    // A phone browser can report iOS/Android as its OS without being a native app.
    if (isHttpBrowserPage()) return false
    const platform = String(info?.uniPlatform ?? info?.platform ?? info?.osName ?? '').toLowerCase()
    return platform === 'app' || platform === 'app-plus' || platform === 'ios' || platform === 'android'
  } catch {
    return false
  }
}

const TAB_BAR_PATHS = new Set([
  '/pages/home/home',
  '/pages/b2-practice/b2-practice',
  '/pages/world/world',
  '/pages/learn/learn',
  '/pages/profile/profile',
])
const PENDING_NAVIGATION_QUERY_KEY = 'yx.navigation.query.v1'
const h5Adapters = new WeakMap<object, UniRuntime>()

function h5StorageRead(key: string): unknown {
  try { return window.localStorage.getItem(key) ?? '' } catch { return '' }
}
function h5StorageWrite(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* Storage can be disabled by the browser. */ }
}
function h5StorageRemove(key: string): void {
  try { window.localStorage.removeItem(key) } catch { /* Storage can be disabled by the browser. */ }
}
function h5Navigate({ url }: { url: string }): void {
  if (!/^\/pages\/[a-z0-9-]+\/[a-z0-9-]+(?:\?.*)?$/i.test(url)) {
    throw new Error('页面地址无效。')
  }
  window.location.hash = `#${url}`
}

export function getUniRuntime(): UniRuntime {
  const runtime = globalThis as typeof globalThis & { uni?: UniRuntime }
  if (!runtime.uni) {
    throw new Error('uni-app 运行时尚未就绪。')
  }
  const current = runtime.uni
  if (!isHttpBrowserPage() || isNativeAppRuntime(current)
    || (typeof current.navigateTo === 'function'
      && typeof current.switchTab === 'function'
      && typeof current.getStorageSync === 'function'
      && typeof current.setStorageSync === 'function'
      && typeof current.removeStorageSync === 'function')) return current

  // Production H5 bundles may expose only part of uni's synchronous storage
  // and navigation surface. The browser hash router provides the missing
  // navigation methods; authentication tokens remain in the session boundary.
  const cached = h5Adapters.get(current)
  if (cached) return cached
  const adapter = new Proxy(current, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (typeof value === 'function') return value.bind(target)
      if (property === 'navigateTo' || property === 'switchTab') return h5Navigate
      if (property === 'getStorageSync') return h5StorageRead
      if (property === 'setStorageSync') return h5StorageWrite
      if (property === 'removeStorageSync') return h5StorageRemove
      return value
    },
  })
  h5Adapters.set(current, adapter)
  return adapter
}

/** Use switchTab for tab-bar pages; navigateTo is rejected by uni-h5 for them. */
export function openUniPage(url: string): void | Promise<unknown> {
  const runtime = getUniRuntime()
  const path = url.split('?')[0]
  if (TAB_BAR_PATHS.has(path)) {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
    if (query) {
      const params = Object.fromEntries(new URLSearchParams(query).entries())
      runtime.setStorageSync(PENDING_NAVIGATION_QUERY_KEY, JSON.stringify({ path, params }))
    }
    return runtime.switchTab({ url: path })
  }
  return runtime.navigateTo({ url })
}

/** Read query parameters that had to cross a uni-app tab-bar switch. */
export function consumePendingNavigationQuery(path: string): Record<string, string> {
  const runtime = getUniRuntime()
  const raw = runtime.getStorageSync(PENDING_NAVIGATION_QUERY_KEY)
  runtime.removeStorageSync(PENDING_NAVIGATION_QUERY_KEY)
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw) as { path?: unknown; params?: unknown }
    if (parsed.path !== path || typeof parsed.params !== 'object' || parsed.params === null) return {}
    return Object.fromEntries(Object.entries(parsed.params).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}
