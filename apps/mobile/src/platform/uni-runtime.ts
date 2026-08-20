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

export interface UniRuntime {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: string): void
  removeStorageSync(key: string): void
  request(options: UniRequestOptions): void
  navigateTo(options: { url: string }): void
  switchTab(options: { url: string }): void
  showToast(options: { title: string; icon?: 'none' | 'success' | 'error' }): void
}

export function getUniRuntime(): UniRuntime {
  const runtime = globalThis as typeof globalThis & { uni?: UniRuntime }
  if (!runtime.uni) {
    throw new Error('uni-app 运行时尚未就绪。')
  }
  return runtime.uni
}
