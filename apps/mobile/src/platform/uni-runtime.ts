export interface UniRequestResponse {
  statusCode: number
  data: unknown
}

export interface UniRequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  header?: Record<string, string>
  data?: unknown
  success?: (response: UniRequestResponse) => void
  fail?: (error: unknown) => void
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
  switchTab(options: { url: string }): void
  showToast(options: { title: string; icon?: 'none' | 'success' | 'error' }): void
  createInnerAudioContext?: () => UniAudioContext
  getFileSystemManager?: () => UniFileSystemManager
  getSecureRecordingVault?: () => UniSecureRecordingVault
}

export function getUniRuntime(): UniRuntime {
  const runtime = globalThis as typeof globalThis & { uni?: UniRuntime }
  if (!runtime.uni) {
    throw new Error('uni-app 运行时尚未就绪。')
  }
  return runtime.uni
}
