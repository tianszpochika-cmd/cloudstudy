import { getUniRuntime, type UniRequestOptions } from '../platform/uni-runtime'
import { readAccessToken } from '../stores/session'
import { getGatewayBaseUrl } from '../platform/gateway'

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

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function createMobileApiClient(baseUrl: string, onUnauthorized?: () => Promise<boolean>): MobileApiClient {
  async function request<TResponse>(path: string, options: Omit<UniRequestOptions, 'url' | 'success' | 'fail'> & { skipAuthRetry?: boolean } = {}, retried = false): Promise<TResponse> {
    const { skipAuthRetry, ...requestOptions } = options
    return new Promise<TResponse>((resolve, reject) => {
      const headers = { ...(requestOptions.header ?? {}) }
      const accessToken = readAccessToken()
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`

      const uniRequest: UniRequestOptions = {
        ...requestOptions,
        url: joinUrl(baseUrl, path),
        header: headers,
        success: async (response) => {
          if (response.statusCode === 401 && !retried && !skipAuthRetry && onUnauthorized) {
            if (await onUnauthorized()) { resolve(await request(path, { ...options, skipAuthRetry: true }, true)); return }
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new MobileApiError(`请求失败（HTTP ${response.statusCode}）`, response.statusCode, response.data))
            return
          }
          resolve(response.data as TResponse)
        },
        fail: (error) => reject(new MobileApiError('网络暂时不可用，请稍后重试。', 0, error)),
      }

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
