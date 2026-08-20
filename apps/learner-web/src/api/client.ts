export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  method?: ApiMethod
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
}

export interface ApiClientConfig {
  baseUrl: string
  getAccessToken?: () => string | null
  fetchImpl?: typeof fetch
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

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? fetch

  async function request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
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
    })
    const details = await decodeBody(response)

    if (!response.ok) {
      const message = typeof details === 'object' && details !== null && 'message' in details
        ? String(details.message)
        : `请求失败（HTTP ${response.status}）`
      throw new ApiError(message, response.status, details)
    }

    return details as TResponse
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  }
}

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:18080/api/v1',
  getAccessToken: () => {
    if (typeof window === 'undefined') {
      return null
    }
    return window.sessionStorage.getItem('yx.session.access-token')
  },
})
