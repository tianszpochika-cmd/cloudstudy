import { getInMemoryAuthRequestSnapshot } from '../auth/access-token'
import { getUniRuntime, type UniRequestOptions } from '../platform/uni-runtime'
import { getGatewayBaseUrl, getIamAuthBaseUrl, requireIamAuthBaseUrl } from '../platform/gateway'

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
  request<TResponse>(path: string, options?: Omit<UniRequestOptions, 'url' | 'success' | 'fail'> & { skipAuthRetry?: boolean; authBootstrap?: MobileAuthBootstrapPurpose }): Promise<TResponse>
}

export interface MobileRequestIdentity { subject: string; revision: number }
type MobileAuthBootstrapPurpose = 'identity' | 'refresh' | 'logout' | 'revoke'
type MobileAuthRequestSnapshot = { accessToken: string | null; identity: MobileRequestIdentity | null; revision: number }
type MobileAuthRequestSnapshotProvider = () => MobileAuthRequestSnapshot
type MobileUnauthorizedHandler = (identity: MobileRequestIdentity) => Promise<boolean>
type MobileApiErrorHandler = (status: 401 | 403, details: unknown) => void
let mobileApiErrorHandler: MobileApiErrorHandler | undefined

/** Installed by the App shell so every protected API failure has one routing policy. */
export function setMobileApiErrorHandler(handler: MobileApiErrorHandler | undefined): void {
  mobileApiErrorHandler = handler
}

function notifyMobileApiError(status: number, details: unknown, skipAuthRetry: boolean, retried: boolean): void {
  if ((skipAuthRetry && !retried) || !mobileApiErrorHandler || (status === 401 && !retried)) return
  if (status === 401 || status === 403) mobileApiErrorHandler(status, details)
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

function sameIdentity(expected: MobileRequestIdentity | null, current: MobileRequestIdentity | null): boolean {
  return Boolean(expected && current && expected.subject === current.subject && expected.revision === current.revision)
}

function sameAuthSnapshot(expected: MobileAuthRequestSnapshot, current: MobileAuthRequestSnapshot): boolean {
  return expected.accessToken === current.accessToken && expected.revision === current.revision && (
    expected.identity === null
      ? current.identity === null
      : sameIdentity(expected.identity, current.identity)
  )
}

function isAllowedAuthBootstrap(path: string, method: string, purpose: MobileAuthBootstrapPurpose | undefined, skipAuthRetry: boolean): boolean {
  if (!purpose || !skipAuthRetry) return false
  if (purpose === 'identity') return method === 'GET' && (path === '/iam/principal/me' || path === '/iam/permissions')
  if (purpose === 'refresh') return method === 'POST' && path === '/auth/token/refresh'
  if (purpose === 'logout') return method === 'POST' && path === '/auth/logout'
  return method === 'POST' && /^\/auth\/sessions\/[^/?#]+\/revoke$/.test(path)
}

function identityChangedError(): MobileApiError {
  return new MobileApiError('账号已切换，已取消原请求。', 401, { code: 'SESSION_IDENTITY_CHANGED' })
}

function messageForStatus(path: string, status: number): string {
  if (status === 401) return path === '/auth/login' ? '账号或密码有误，请重试。' : '登录已过期，请重新登录。'
  if (status === 403) return '当前账号没有执行此操作的权限。'
  if (status === 404) return '当前内容暂不可用，请返回上一页。'
  if (status === 409) return '内容或进度已更新，请刷新后重试。'
  if (status === 429) return '操作太频繁，请稍后重试。'
  if (status >= 500) return '服务暂时不可用，请稍后重试。'
  return '操作未完成，请检查输入后重试。'
}

export function createMobileApiClient(baseUrl: string, onUnauthorized?: MobileUnauthorizedHandler, getAuthSnapshot?: MobileAuthRequestSnapshotProvider): MobileApiClient {
  const readAuthSnapshot = getAuthSnapshot ?? getInMemoryAuthRequestSnapshot
  async function request<TResponse>(path: string, options: Omit<UniRequestOptions, 'url' | 'success' | 'fail'> & { skipAuthRetry?: boolean; authBootstrap?: MobileAuthBootstrapPurpose } = {}, retried = false, expectedIdentity?: MobileRequestIdentity | null): Promise<TResponse> {
    const authSnapshot = readAuthSnapshot()
    const requestIdentity = authSnapshot.identity
    if (expectedIdentity !== undefined && !sameIdentity(expectedIdentity, requestIdentity)) throw identityChangedError()
    if (requestIdentity && requestIdentity.revision !== authSnapshot.revision) throw identityChangedError()
    const { skipAuthRetry, authBootstrap, ...requestOptions } = options
    const method = String(requestOptions.method ?? 'GET').toUpperCase()
    const allowedAuthBootstrap = isAllowedAuthBootstrap(path, method, authBootstrap, Boolean(skipAuthRetry))
    if (authBootstrap && !allowedAuthBootstrap) throw identityChangedError()
    if (requestIdentity && !authSnapshot.accessToken) throw identityChangedError()
    if (authSnapshot.accessToken && !requestIdentity && !allowedAuthBootstrap) throw identityChangedError()
    if ((authBootstrap === 'identity' || authBootstrap === 'revoke') && !authSnapshot.accessToken) throw identityChangedError()
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
      const notifyIfCurrentIdentity = async (status: number, details: unknown, skipRetry: boolean, wasRetried: boolean): Promise<void> => {
        if (status !== 401 && status !== 403) return
        if (!requestIdentity || !sameIdentity(requestIdentity, readAuthSnapshot().identity)) return
        notifyMobileApiError(status, details, skipRetry, wasRetried)
      }
      const headers = { ...(requestOptions.header ?? {}) }
      for (const key of Object.keys(headers)) if (key.toLowerCase() === 'authorization') delete headers[key]
      if (authSnapshot.accessToken) headers.Authorization = `Bearer ${authSnapshot.accessToken}`

      const uniRequest: UniRequestOptions = {
        ...requestOptions,
        url: joinUrl(baseUrl, path),
        header: headers,
        timeout: timeoutMs,
        withCredentials: true,
        success: async (response) => {
          try {
            const responseSnapshot = readAuthSnapshot()
            if (allowedAuthBootstrap ? !sameAuthSnapshot(authSnapshot, responseSnapshot) : requestIdentity && !sameIdentity(requestIdentity, responseSnapshot.identity)) {
              rejectOnce(identityChangedError())
              return
            }
            let authRetryAttempted = false
            if (response.statusCode === 401 && !retried && !skipAuthRetry && onUnauthorized && requestIdentity) {
              if (!sameIdentity(requestIdentity, readAuthSnapshot().identity)) {
                rejectOnce(identityChangedError())
                return
              }
              authRetryAttempted = true
              if (await onUnauthorized(requestIdentity)) {
                if (!sameIdentity(requestIdentity, readAuthSnapshot().identity)) {
                  rejectOnce(identityChangedError())
                  return
                }
                resolveOnce(await request(path, { ...options, skipAuthRetry: true }, true, requestIdentity))
                return
              }
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
              await notifyIfCurrentIdentity(response.statusCode, response.data, Boolean(skipAuthRetry), retried || authRetryAttempted)
              rejectOnce(new MobileApiError(messageForStatus(path, response.statusCode), response.statusCode, response.data))
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
      if (!sameAuthSnapshot(authSnapshot, readAuthSnapshot())) {
        rejectOnce(identityChangedError())
        return
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
  async (identity) => {
    const [{ pinia }, { useSessionStore }] = await Promise.all([import('../stores/pinia'), import('../stores/session')])
    return useSessionStore(pinia).refreshSilentlyForIdentity(identity)
  },
)

/** Password posts and the refresh cookie. No bearer. Domain calls and bearer logout stay on mobileApiClient. */
export const mobileIamAuthClient = createMobileApiClient(
  requireIamAuthBaseUrl(getIamAuthBaseUrl()),
  undefined,
  () => ({ accessToken: null, identity: null, revision: 0 }),
)
