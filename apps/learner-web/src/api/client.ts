export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  method?: ApiMethod
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
  credentials?: RequestCredentials
  skipAuthRetry?: boolean
}

export interface ApiAuthSnapshot {
  accessToken: string | null
  subject: string | null
  generation: number
  authenticated: boolean
}

export interface ApiAuthBinding {
  subject: string
  generation: number
}

export interface ApiClientConfig {
  baseUrl: string
  getAccessToken?: () => string | null
  /** Must return the token and its owner/generation from one synchronous in-memory read. */
  getAuthSnapshot?: () => ApiAuthSnapshot | null
  /** Auth bootstrap routes may use a token before IAM has confirmed its subject. */
  isBootstrapAuthPath?: (path: string, method: ApiMethod) => boolean
  fetchImpl?: typeof fetch
  credentials?: RequestCredentials
  onUnauthorized?: (binding: ApiAuthBinding | null) => Promise<boolean>
  onForbidden?: (error: ApiError, binding: ApiAuthBinding | null) => Promise<void>
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

export class ApiAuthContextChangedError extends Error {
  readonly code = 'AUTH_CONTEXT_CHANGED'

  constructor() {
    super('认证身份已变化，请重新发起请求。')
    this.name = 'ApiAuthContextChangedError'
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

  type AuthContext = {
    mode: 'unbound' | 'anonymous' | 'verified' | 'bootstrap'
    binding: ApiAuthBinding | null
    accessToken: string | null
    generation: number | null
  }

  function matchesBinding(snapshot: ApiAuthSnapshot | null, binding: ApiAuthBinding): boolean {
    const subject = snapshot?.subject?.trim()
    return Boolean(snapshot?.authenticated && snapshot.accessToken && subject === binding.subject
      && snapshot.generation === binding.generation)
  }

  function captureContext(expected: ApiAuthBinding | null, path: string, method: ApiMethod): AuthContext {
    if (!config.getAuthSnapshot) return { mode: 'unbound', binding: expected, accessToken: config.getAccessToken?.() ?? null, generation: null }
    const snapshot = config.getAuthSnapshot()
    if (!snapshot) {
      if (expected || config.getAccessToken?.()) throw new ApiAuthContextChangedError()
      return { mode: 'anonymous', binding: null, accessToken: null, generation: null }
    }
    if (!Number.isSafeInteger(snapshot.generation)) throw new ApiAuthContextChangedError()

    if (snapshot.accessToken) {
      const subject = snapshot.subject?.trim()
      if (snapshot.authenticated && subject) {
        const binding = expected ?? { subject, generation: snapshot.generation }
        if (!matchesBinding(snapshot, binding)) throw new ApiAuthContextChangedError()
        return { mode: 'verified', binding, accessToken: snapshot.accessToken, generation: snapshot.generation }
      }
      if (!snapshot.authenticated && !subject && !expected && config.isBootstrapAuthPath?.(path, method)) {
        return { mode: 'bootstrap', binding: null, accessToken: snapshot.accessToken, generation: snapshot.generation }
      }
      throw new ApiAuthContextChangedError()
    }

    if (snapshot.authenticated || snapshot.subject?.trim() || expected || config.getAccessToken?.()) throw new ApiAuthContextChangedError()
    return {
      mode: config.isBootstrapAuthPath?.(path, method) ? 'bootstrap' : 'anonymous',
      binding: null,
      accessToken: null,
      generation: snapshot.generation,
    }
  }

  function assertCurrentContext(context: AuthContext, path: string, method: ApiMethod): void {
    if (!config.getAuthSnapshot || context.mode === 'unbound') return
    const snapshot = config.getAuthSnapshot()
    if (!snapshot || snapshot.generation !== context.generation) {
      throw new ApiAuthContextChangedError()
    }
    if (context.mode === 'verified') {
      if (!context.binding || !matchesBinding(snapshot, context.binding)) throw new ApiAuthContextChangedError()
      return
    }
    if (snapshot.accessToken !== context.accessToken) throw new ApiAuthContextChangedError()
    if (snapshot.authenticated || snapshot.subject?.trim()) throw new ApiAuthContextChangedError()
    if (context.mode === 'bootstrap' && !config.isBootstrapAuthPath?.(path, method)) throw new ApiAuthContextChangedError()
  }

  function matchesInitialContext(initial: AuthContext, current: AuthContext): boolean {
    if (initial.mode !== current.mode || initial.generation !== current.generation) return false
    if (initial.mode === 'verified') {
      return Boolean(initial.binding && current.binding && initial.binding.subject === current.binding.subject
        && initial.binding.generation === current.binding.generation)
    }
    return initial.accessToken === current.accessToken
  }

  async function request<TResponse>(path: string, options: ApiRequestOptions = {}, retried = false, expectedBinding: ApiAuthBinding | null = null): Promise<TResponse> {
    const method = options.method ?? 'GET'
    const initialAuth = captureContext(expectedBinding, path, method)
    const headers = new Headers(options.headers)
    // Callers cannot override the identity captured by this client (or smuggle
    // an old bearer token into an anonymous/bootstrap request).
    headers.delete('Authorization')
    headers.set('Accept', 'application/json')

    let body: BodyInit | undefined
    if (options.body !== undefined) {
      body = JSON.stringify(options.body)
      headers.set('Content-Type', 'application/json')
    }

    // This final synchronous snapshot check is deliberately adjacent to fetch:
    // an account switch during request preparation must never borrow its token.
    const auth = captureContext(initialAuth.binding, path, method)
    if (!matchesInitialContext(initialAuth, auth)) throw new ApiAuthContextChangedError()
    if (auth.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`)
    assertCurrentContext(auth, path, method)

    const response = await fetchImpl(joinUrl(config.baseUrl, path), {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: options.credentials ?? config.credentials,
    })
    const details = await decodeBody(response)
    assertCurrentContext(auth, path, method)

    if (response.status === 401 && !retried && !options.skipAuthRetry && config.onUnauthorized) {
      if (!config.getAuthSnapshot || auth.binding) {
        assertCurrentContext(auth, path, method)
        const refreshed = await config.onUnauthorized(auth.binding)
        assertCurrentContext(auth, path, method)
        if (refreshed) return request(path, { ...options, skipAuthRetry: true }, true, auth.binding)
      }
    }

    if (!response.ok) {
      const message = errorMessage(details, response.status)
      const error = new ApiError(message, response.status, details)
      if (response.status === 403 && config.onForbidden) {
        assertCurrentContext(auth, path, method)
        try {
          await config.onForbidden(error, auth.binding)
        } catch {
          // Navigation is best-effort; the original API error remains authoritative.
        }
        assertCurrentContext(auth, path, method)
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
import { getInMemoryAccessToken, getInMemoryAuthSnapshot } from '../auth/access-token'

export const apiClient = createApiClient({
  baseUrl: getGatewayBaseUrl(),
  credentials: 'include',
  getAccessToken: getInMemoryAccessToken,
  getAuthSnapshot: getInMemoryAuthSnapshot,
  onUnauthorized: async (binding) => {
    if (!binding) return false
    const [{ pinia }, { useSessionStore }] = await Promise.all([import('../stores/pinia'), import('../stores/session')])
    const session = useSessionStore(pinia)
    const subject = session.principal?.subject?.trim()
    const readyStatus = session.status === 'authenticated' || session.status === 'refreshing'
    if (!readyStatus || !session.accessToken || subject !== binding.subject || session.authGeneration !== binding.generation
      || (session.userId && session.userId !== subject)) return false
    const refreshed = await session.refreshSilently()
    if (!refreshed) await session.handleUnauthorized(binding)
    return refreshed
  },
  onForbidden: async (error, binding) => {
    if (!binding) return
    const [{ pinia }, { useSessionStore }] = await Promise.all([import('../stores/pinia'), import('../stores/session')])
    const session = useSessionStore(pinia)
    const subject = session.principal?.subject?.trim()
    const readyStatus = session.status === 'authenticated' || session.status === 'refreshing'
    if (!readyStatus || !session.accessToken || subject !== binding.subject || session.authGeneration !== binding.generation
      || (session.userId && session.userId !== subject)) return
    await session.handleForbidden(error, binding)
  },
})
