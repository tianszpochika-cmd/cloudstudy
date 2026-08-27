import { getUniRuntime, type UniRequestOptions } from '../platform/uni-runtime'
import { readAccessToken } from '../stores/session'
import { getGatewayBaseUrl } from '../platform/gateway'

const DEFAULT_MOBILE_REQUEST_TIMEOUT_MS = 8000

export class MobileApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = 'MobileApiError'
    this.status = status
    this.details = details
  }
}

export interface MobileApiClient {
  request<TResponse>(path: string, options?: Omit<UniRequestOptions, 'url' | 'success' | 'fail'> & { skipAuthRetry?: boolean }): Promise<TResponse>
}

type MobileApiErrorHandler = (status: 401 | 403) => void
let mobileApiErrorHandler: MobileApiErrorHandler | undefined

/** Installed by the App shell so every protected API failure has one routing policy. */
export function setMobileApiErrorHandler(handler: MobileApiErrorHandler | undefined): void {
  mobileApiErrorHandler = handler
}

function notifyMobileApiError(status: number, skipAuthRetry: boolean, retried: boolean): void {
  if ((skipAuthRetry && !retried) || !mobileApiErrorHandler || (status === 401 && !retried)) return
  if (status === 401 || status === 403) mobileApiErrorHandler(status)
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function createMobileApiClient(baseUrl: string, onUnauthorized?: () => Promise<boolean>): MobileApiClient {
  async function request<TResponse>(path: string, options: Omit<UniRequestOptions, 'url' | 'success' | 'fail'> & { skipAuthRetry?: boolean } = {}, retried = false): Promise<TResponse> {
    const { skipAuthRetry, ...requestOptions } = options
    return new Promise<TResponse>((resolve, reject) => {
      const timeoutMs = requestOptions.timeout ?? DEFAULT_MOBILE_REQUEST_TIMEOUT_MS
      let settled = false
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined
      const resolveOnce = (value: TResponse): void => {
        if (settled) return
        settled = true
        if (timeoutHandle) clearTimeout(timeoutHandle)
        resolve(value)
      }
      const rejectOnce = (error: unknown): void => {
        if (settled) return
        settled = true
        if (timeoutHandle) clearTimeout(timeoutHandle)
        reject(error)
      }
      const headers = { ...(requestOptions.header ?? {}) }
      const accessToken = readAccessToken()
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`

      const uniRequest: UniRequestOptions = {
        ...requestOptions,
        url: joinUrl(baseUrl, path),
        header: headers,
        timeout: timeoutMs,
        success: async (response) => {
          try {
            let authRetryAttempted = false
            if (response.statusCode === 401 && !retried && !skipAuthRetry && onUnauthorized) {
              authRetryAttempted = true
              if (await onUnauthorized()) { resolveOnce(await request(path, { ...options, skipAuthRetry: true }, true)); return }
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
              notifyMobileApiError(response.statusCode, Boolean(skipAuthRetry), retried || authRetryAttempted)
              rejectOnce(new MobileApiError(`请求失败（HTTP ${response.statusCode}）`, response.statusCode, response.data))
              return
            }
            resolveOnce(response.data as TResponse)
          } catch (error) {
            rejectOnce(error)
          }
        },
        fail: (error) => rejectOnce(new MobileApiError('网络暂时不可用，请稍后重试。', 0, error)),
      }

      if (timeoutMs > 0) timeoutHandle = setTimeout(() => rejectOnce(new MobileApiError('请求超时，请稍后重试。', 0, { timeoutMs })), timeoutMs)
      getUniRuntime().request(uniRequest)
    })
  }
  return {
    request,
  }
}

export const mobileApiClient = createMobileApiClient(
  getGatewayBaseUrl(),
  async () => {
    const [{ pinia }, { useSessionStore }] = await Promise.all([import('../stores/pinia'), import('../stores/session')])
    return useSessionStore(pinia).refreshSilently()
  },
)
