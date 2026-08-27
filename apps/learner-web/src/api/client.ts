export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  method?: ApiMethod
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
  credentials?: RequestCredentials
  skipAuthRetry?: boolean
}

export interface ApiClientConfig {
  baseUrl: string
  getAccessToken?: () => string | null
  fetchImpl?: typeof fetch
  credentials?: RequestCredentials
  onUnauthorized?: () => Promise<boolean>
  onForbidden?: (error: ApiError) => Promise<void>
}

export class ApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export interface ApiClient {
  request<TResponse>(path: string, options?: ApiRequestOptions): Promise<TResponse>
  get<TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<TResponse>
  post<TResponse>(path: string, body: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<TResponse>
  put<TResponse>(path: string, body: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<TResponse>
  patch<TResponse>(path: string, body: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<TResponse>
}

async function decodeBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

function errorMessage(details: unknown, status: number): string {
  if (typeof details === 'object' && details !== null) {
    const source = details as Record<string, unknown>
    const nested = typeof source.error === 'object' && source.error !== null
      ? source.error as Record<string, unknown>
      : null
    const message = nested?.message ?? source.message
    const code = nested?.code ?? source.code
    if (typeof message === 'string' && message.trim()) {
      return typeof code === 'string' && code.trim() ? `${message.trim()}（${code.trim()}）` : message.trim()
    }
    if (typeof code === 'string' && code.trim()) return code.trim()
  }
  return `请求失败（HTTP ${status}）`
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? fetch

  async function request<TResponse>(path: string, options: ApiRequestOptions = {}, retried = false): Promise<TResponse> {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')

    const accessToken = config.getAccessToken?.()
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    let body: BodyInit | undefined
    if (options.body !== undefined) {
      body = JSON.stringify(options.body)
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetchImpl(joinUrl(config.baseUrl, path), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
      credentials: options.credentials ?? config.credentials,
    })
    const details = await decodeBody(response)

    if (response.status === 401 && !retried && !options.skipAuthRetry && config.onUnauthorized) {
      const refreshed = await config.onUnauthorized()
      if (refreshed) return request(path, { ...options, skipAuthRetry: true }, true)
    }

    if (!response.ok) {
      const message = errorMessage(details, response.status)
      const error = new ApiError(message, response.status, details)
      if (response.status === 403 && config.onForbidden) {
        try {
          await config.onForbidden(error)
        } catch {
          // Navigation is best-effort; the original API error remains authoritative.
        }
      }
      throw error
    }

    return details as TResponse
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  }
}

import { getGatewayBaseUrl } from '../platform/gateway'

export const apiClient = createApiClient({
  baseUrl: getGatewayBaseUrl(),
  credentials: 'include',
  getAccessToken: () => {
    if (typeof window === 'undefined') {
      return null
    }
    return window.sessionStorage.getItem('yx.session.access-token')
  },
  onUnauthorized: async () => {
    const [{ pinia }, { useSessionStore }] = await Promise.all([import('../stores/pinia'), import('../stores/session')])
    const session = useSessionStore(pinia)
    const refreshed = await session.refreshSilently()
    if (!refreshed) await session.handleUnauthorized()
    return refreshed
  },
  onForbidden: async (error) => {
    const [{ pinia }, { useSessionStore }] = await Promise.all([import('../stores/pinia'), import('../stores/session')])
    await useSessionStore(pinia).handleForbidden(error)
  },
})
