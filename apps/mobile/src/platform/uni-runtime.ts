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
  loop?: boolean
  play(): void
  pause(): void
  destroy(): void
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
  navigateTo(options: { url: string }): void
  redirectTo?(options: { url: string }): void
  reLaunch?(options: { url: string }): void
  switchTab(options: { url: string }): void
  showToast(options: { title: string; icon?: 'none' | 'success' | 'error' }): void
  addInterceptor?(method: string, interceptor: { invoke?: (options: { url?: string; delta?: number }) => false | { url?: string; delta?: number } | void }): void
  getSecureStorage?: () => UniSecureStorage | undefined
  getLaunchOptionsSync?: () => UniLaunchOptions
  getEnterOptionsSync?: () => UniLaunchOptions
  openURL?: (url: string) => void
  createInnerAudioContext?: () => UniAudioContext
  getFileSystemManager?: () => UniFileSystemManager
  getSecureRecordingVault?: () => UniSecureRecordingVault
}

const TAB_BAR_PATHS = new Set([
  '/pages/home/home',
  '/pages/b2-practice/b2-practice',
  '/pages/world/world',
  '/pages/learn/learn',
  '/pages/profile/profile',
])
const PENDING_NAVIGATION_QUERY_KEY = 'yx.navigation.query.v1'

export function getUniRuntime(): UniRuntime {
  const runtime = globalThis as typeof globalThis & { uni?: UniRuntime }
  if (!runtime.uni) {
    throw new Error('uni-app 运行时尚未就绪。')
  }
  return runtime.uni
}

/** Use switchTab for tab-bar pages; navigateTo is rejected by uni-h5 for them. */
export function openUniPage(url: string): void {
  const runtime = getUniRuntime()
  const path = url.split('?')[0]
  if (TAB_BAR_PATHS.has(path)) {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
    if (query) {
      const params = Object.fromEntries(new URLSearchParams(query).entries())
      runtime.setStorageSync(PENDING_NAVIGATION_QUERY_KEY, JSON.stringify({ path, params }))
    }
    runtime.switchTab({ url: path })
  }
  else runtime.navigateTo({ url })
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
