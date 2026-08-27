export * from './generated'
export * from './errors'
export * from './gateway-test-double'

export interface ApiClientRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
}

export interface ApiClient {
  request<TResponse>(path: string, options?: ApiClientRequestOptions): Promise<TResponse>
}
