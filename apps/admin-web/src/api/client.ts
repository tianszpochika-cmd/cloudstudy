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

import { getGatewayBaseUrl, safeInternalReturnTo } from '../platform/gateway'
import { adminT } from '../platform/admin-i18n'
import { getInMemoryAccessToken } from '../auth/access-token'

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

function isAuthenticationPath(path: string): boolean { return path.startsWith('/auth/') || path.startsWith('/iam/') }

export function createAdminClient(baseUrl: string): AdminApiClient {
  const forbiddenHeaderNames = ['x-role', 'x-roles', 'x-tenant', 'x-tenant-id', 'x-owner', 'x-owner-id', 'x-user-id', 'x-permission', 'x-permissions', 'x-b5-role', 'x-authorization-context']
  let navigationPromise: Promise<void> | null = null

  async function redirectToLogin(): Promise<void> {
    if (typeof window === 'undefined' || navigationPromise) return navigationPromise ?? Promise.resolve()
    navigationPromise = (async () => {
      const [{ pinia, useAdminStore }, { router }] = await Promise.all([import('../stores/admin'), import('../router')])
      const session = useAdminStore(pinia)
      const current = router.currentRoute.value
      if (current.name === 'admin-login') return
      const returnTo = safeInternalReturnTo(current.fullPath, '/dashboard')
      session.markSessionExpired(returnTo)
      await router.replace({ name: 'admin-login', query: { redirect: returnTo, reason: 'expired' } })
    })().finally(() => { navigationPromise = null })
    return navigationPromise
  }

  async function redirectToForbidden(details: unknown): Promise<void> {
    if (typeof window === 'undefined' || navigationPromise) return navigationPromise ?? Promise.resolve()
    navigationPromise = (async () => {
      const [{ pinia, useAdminStore }, { router }] = await Promise.all([import('../stores/admin'), import('../router')])
      const session = useAdminStore(pinia)
      const current = router.currentRoute.value
      if (current.name === 'admin-forbidden') return
      session.markForbidden({ path: current.fullPath, reason: errorReason(details) ?? 'policy_denied' })
      await router.replace({ name: 'admin-forbidden', query: { from: safeInternalReturnTo(current.fullPath, '/dashboard') } })
    })().finally(() => { navigationPromise = null })
    return navigationPromise
  }

  async function request<T>(path: string, options: AdminRequestOptions = {}, retried = false): Promise<T> {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    for (const name of forbiddenHeaderNames) headers.delete(name)
    headers.delete('authorization')
    const token = getInMemoryAccessToken()
    if (token && token.trim()) headers.set('Authorization', `Bearer ${token.trim()}`)
    let body: BodyInit | undefined
    if (options.body !== undefined) { body = JSON.stringify(options.body); headers.set('Content-Type', 'application/json') }
    const response = await fetch(joinUrl(baseUrl, path), { method: options.method ?? 'GET', headers, body, signal: options.signal, credentials: options.credentials ?? 'include' })
    const text = await response.text()
    let details: unknown = undefined
    try { details = text ? JSON.parse(text) as unknown : undefined } catch { details = text }
    if (response.status === 401 && !retried && !options.skipAuthRetry) {
      const [{ pinia, useAdminStore }] = await Promise.all([import('../stores/admin')])
      if (await useAdminStore(pinia).refreshSilently()) return request(path, { ...options, skipAuthRetry: true }, true)
    }
    if (response.status === 401 && !isAuthenticationPath(path)) await redirectToLogin()
    if (response.status === 403 && !isAuthenticationPath(path)) await redirectToForbidden(details)
    if (!response.ok) throw new AdminApiError(errorMessage(response.status, details), response.status, details)
    return details as T
  }
  return {
    request,
  }
}

export const adminClient = createAdminClient(getGatewayBaseUrl())
