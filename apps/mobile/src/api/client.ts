import { getUniRuntime, type UniRequestOptions } from '../platform/uni-runtime'
import { readAccessToken } from '../stores/session'

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
  request<TResponse>(path: string, options?: Omit<UniRequestOptions, 'url' | 'success' | 'fail'>): Promise<TResponse>
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function createMobileApiClient(baseUrl: string): MobileApiClient {
  return {
    request: <TResponse>(path: string, options: Omit<UniRequestOptions, 'url' | 'success' | 'fail'> = {}) => new Promise<TResponse>((resolve, reject) => {
      const headers = { ...(options.header ?? {}) }
      const accessToken = readAccessToken()
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
      }

      const request: UniRequestOptions = {
        ...options,
        url: joinUrl(baseUrl, path),
        header: headers,
        success: (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new MobileApiError(`请求失败（HTTP ${response.statusCode}）`, response.statusCode, response.data))
            return
          }
          resolve(response.data as TResponse)
        },
        fail: (error) => reject(new MobileApiError('网络暂时不可用，请稍后重试。', 0, error)),
      }

      getUniRuntime().request(request)
    }),
  }
}

export const mobileApiClient = createMobileApiClient(
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:18080/api/v1',
)
