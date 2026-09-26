export type AdminMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface AdminRequestOptions {
  method?: AdminMethod
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
  credentials?: RequestCredentials
  skipAuthRetry?: boolean
}

export interface AdminApiClient { request<T>(path: string, options?: AdminRequestOptions): Promise<T> }

export class AdminApiError extends Error {
  readonly status: number
  readonly details: unknown
  constructor(message: string, status: number, details: unknown) { super(message); this.name = 'AdminApiError'; this.status = status; this.details = details }
}

export class AdminAuthContextChangedError extends Error {
  readonly code = 'AUTH_CONTEXT_CHANGED'
  constructor() { super('认证身份已变化，请重新发起请求。'); this.name = 'AdminAuthContextChangedError' }
}

import { getGatewayBaseUrl, safeInternalReturnTo } from '../platform/gateway'
import { adminT } from '../platform/admin-i18n'
import { getInMemoryAdminAuthContext } from '../auth/access-token'

function joinUrl(baseUrl: string, path: string): string { const base = baseUrl.replace(/\/$/, ''); return path.startsWith('/') ? `${base}${path}` : `${base}/${path}` }

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function errorMessage(status: number, details: unknown): string {
  const envelope = record(details) && record(details.error) ? details.error : details
  if (record(envelope)) {
    for (const key of ['message', 'reason', 'code']) {
      const value = envelope[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return adminT('apiClient.requestFailed', { status })
}

function errorReason(details: unknown): string | null {
  const envelope = record(details) && record(details.error) ? details.error : details
  if (!record(envelope)) return null
  for (const key of ['message', 'reason', 'code']) {
    const value = envelope[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

type AuthContext = {
  mode: 'public' | 'bootstrap' | 'verified'
  token: string | null
  subject: string | null
  generation: number
  pendingToken: boolean
}

const IDENTITY_PATHS = new Set(['/iam/principal/me', '/iam/permissions'])
const SESSION_PATHS = new Set(['/auth/login', '/auth/token/refresh', '/auth/logout'])

function pathname(path: string): string { return path.split('?', 1)[0].replace(/\/$/, '') || '/' }
function isAuthenticationPath(path: string): boolean { return IDENTITY_PATHS.has(pathname(path)) || SESSION_PATHS.has(pathname(path)) }
function isLoginPath(path: string): boolean { return pathname(path) === '/auth/login' }
function isRefreshPath(path: string): boolean { return pathname(path) === '/auth/token/refresh' }
function isLogoutPath(path: string): boolean { return pathname(path) === '/auth/logout' }

function captureContext(path: string): AuthContext {
  const auth = getInMemoryAdminAuthContext()
  const pathName = pathname(path)
  if (isLoginPath(path) || isRefreshPath(path)) {
    if (auth.authenticated && auth.accessToken && auth.subject) {
      return { mode: 'verified', token: isLoginPath(path) ? null : auth.accessToken, subject: auth.subject, generation: auth.generation, pendingToken: false }
    }
    return { mode: 'public', token: null, subject: null, generation: auth.generation, pendingToken: false }
  }
  if (IDENTITY_PATHS.has(pathName) || isLogoutPath(path)) {
    if (auth.pendingAccessToken) {
      return { mode: 'bootstrap', token: auth.pendingAccessToken, subject: null, generation: auth.generation, pendingToken: true }
    }
    if (auth.authenticated && auth.accessToken && auth.subject) {
      return { mode: 'verified', token: auth.accessToken, subject: auth.subject, generation: auth.generation, pendingToken: false }
    }
    if (isLogoutPath(path)) return { mode: 'public', token: null, subject: null, generation: auth.generation, pendingToken: false }
    throw new AdminAuthContextChangedError()
  }
  if (!auth.authenticated || !auth.accessToken || !auth.subject) throw new AdminAuthContextChangedError()
  return { mode: 'verified', token: auth.accessToken, subject: auth.subject, generation: auth.generation, pendingToken: false }
}

function sameBeforeDispatch(initial: AuthContext, current: AuthContext): boolean {
  if (initial.mode !== current.mode || initial.generation !== current.generation) return false
  if (initial.mode === 'verified') return initial.subject === current.subject
  return initial.token === current.token && initial.pendingToken === current.pendingToken
}

function assertCurrentContext(context: AuthContext): void {
  const auth = getInMemoryAdminAuthContext()
  if (auth.generation !== context.generation) throw new AdminAuthContextChangedError()
  if (context.mode === 'verified') {
    if (!auth.authenticated || !auth.accessToken || auth.subject !== context.subject) throw new AdminAuthContextChangedError()
    return
  }
  if (context.mode === 'bootstrap') {
    if (context.pendingToken && auth.pendingAccessToken !== context.token) throw new AdminAuthContextChangedError()
    if (!context.pendingToken && auth.accessToken !== context.token) throw new AdminAuthContextChangedError()
    return
  }
  if (auth.authenticated || auth.subject || auth.accessToken || auth.pendingAccessToken) throw new AdminAuthContextChangedError()
}

type NavigationKind = 'login' | 'forbidden'
let navigationPromise: { kind: NavigationKind; generation: number; promise: Promise<void> } | null = null

function runNavigation(kind: NavigationKind, generation: number, task: () => Promise<void>): Promise<void> {
  if (navigationPromise?.kind === kind && navigationPromise.generation === generation) return navigationPromise.promise
  const promise = task().finally(() => {
    if (navigationPromise?.promise === promise) navigationPromise = null
  })
  navigationPromise = { kind, generation, promise }
  return promise
}

async function redirectToLogin(context: AuthContext, expiredGeneration?: number): Promise<void> {
  if (typeof window === 'undefined') return
  await runNavigation('login', context.generation, async () => {
    const [{ pinia, useAdminStore }, { router }] = await Promise.all([import('../stores/admin'), import('../router')])
    const session = useAdminStore(pinia)
    let navigationGeneration = expiredGeneration
    if (session.lastExpiredGeneration === context.generation && !session.isAuthenticated) {
      navigationGeneration = session.authGeneration
    } else if (context.mode === 'verified' && context.subject && session.isAuthContextCurrent(context.generation, context.subject)) {
      const current = router.currentRoute.value
      navigationGeneration = session.markSessionExpired(safeInternalReturnTo(current.fullPath, '/dashboard'), context.generation, context.subject) ?? undefined
    } else {
      return
    }
    if (navigationGeneration === undefined || session.authGeneration !== navigationGeneration
      || session.lastExpiredGeneration !== context.generation || session.isAuthenticated) return
    const current = router.currentRoute.value
    if (current.name === 'admin-login') return
    const originalPath = current.fullPath
    const returnTo = safeInternalReturnTo(originalPath, '/dashboard')
    await router.replace({ name: 'admin-login', query: { redirect: returnTo, reason: 'expired' } })
    if ((session.authGeneration !== navigationGeneration || session.lastExpiredGeneration !== context.generation)
      && router.currentRoute.value.name === 'admin-login') {
      await router.replace(originalPath)
    }
  })
}

async function redirectToForbidden(details: unknown, context: AuthContext): Promise<void> {
  if (typeof window === 'undefined') return
  await runNavigation('forbidden', context.generation, async () => {
    const [{ pinia, useAdminStore }, { router }] = await Promise.all([import('../stores/admin'), import('../router')])
    const session = useAdminStore(pinia)
    if (!context.subject || !session.isAuthContextCurrent(context.generation, context.subject)) return
    const current = router.currentRoute.value
    if (current.name === 'admin-forbidden') return
    const from = safeInternalReturnTo(current.fullPath, '/dashboard')
    session.markForbidden({ path: current.fullPath, reason: errorReason(details) ?? 'policy_denied' })
    await router.replace({ name: 'admin-forbidden', query: { from } })
    if (!session.isAuthContextCurrent(context.generation, context.subject)
      && router.currentRoute.value.name === 'admin-forbidden'
      && router.currentRoute.value.query?.from === from) {
      await router.replace(current.fullPath)
    }
  })
}

export function createAdminClient(baseUrl: string): AdminApiClient {
  const forbiddenHeaderNames = ['x-role', 'x-roles', 'x-tenant', 'x-tenant-id', 'x-owner', 'x-owner-id', 'x-user-id', 'x-permission', 'x-permissions', 'x-b5-role', 'x-authorization-context']

  async function request<T>(path: string, options: AdminRequestOptions = {}, retried = false): Promise<T> {
    const initialContext = captureContext(path)
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    for (const name of forbiddenHeaderNames) headers.delete(name)
    headers.delete('authorization')
    let body: BodyInit | undefined
    if (options.body !== undefined) { body = JSON.stringify(options.body); headers.set('Content-Type', 'application/json') }

    // Re-read the token/subject/generation together immediately before dispatch.
    const context = captureContext(path)
    if (!sameBeforeDispatch(initialContext, context)) throw new AdminAuthContextChangedError()
    if (context.token) headers.set('Authorization', `Bearer ${context.token}`)
    assertCurrentContext(context)

    const response = await fetch(joinUrl(baseUrl, path), { method: options.method ?? 'GET', headers, body, signal: options.signal, credentials: options.credentials ?? 'include' })
    const text = await response.text()
    let details: unknown = undefined
    try { details = text ? JSON.parse(text) as unknown : undefined } catch { details = text }
    assertCurrentContext(context)

    if (response.status === 401 && !retried && !options.skipAuthRetry && !isAuthenticationPath(path)
      && context.mode === 'verified' && context.subject) {
      const [{ pinia, useAdminStore }] = await Promise.all([import('../stores/admin')])
      const session = useAdminStore(pinia)
      if (!session.isAuthContextCurrent(context.generation, context.subject)) throw new AdminAuthContextChangedError()
      const refreshed = await session.refreshSilently(context.generation, context.subject)
      if (refreshed) {
        if (!session.isAuthContextCurrent(context.generation, context.subject)) throw new AdminAuthContextChangedError()
        return request(path, { ...options, skipAuthRetry: true }, true)
      }
      if (session.lastExpiredGeneration === context.generation) {
        const expiredGeneration = session.authGeneration
        await redirectToLogin(context, expiredGeneration)
      } else {
        throw new AdminAuthContextChangedError()
      }
    }
    if (response.status === 401 && !isAuthenticationPath(path)) await redirectToLogin(context)
    if (response.status === 403 && !isAuthenticationPath(path)) await redirectToForbidden(details, context)
    assertCurrentContext(context)
    if (!response.ok) throw new AdminApiError(errorMessage(response.status, details), response.status, details)
    return details as T
  }
  return { request }
}

export const adminClient = createAdminClient(getGatewayBaseUrl())
