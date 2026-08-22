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

import { getGatewayBaseUrl } from '../platform/gateway'

function joinUrl(baseUrl: string, path: string): string { const base = baseUrl.replace(/\/$/, ''); return path.startsWith('/') ? `${base}${path}` : `${base}/${path}` }

export function createAdminClient(baseUrl: string): AdminApiClient {
  const forbiddenHeaderNames = ['x-role', 'x-tenant', 'x-owner', 'x-b5-role']
  async function request<T>(path: string, options: AdminRequestOptions = {}, retried = false): Promise<T> {
      const headers = new Headers(options.headers)
      headers.set('Accept', 'application/json')
      for (const name of forbiddenHeaderNames) headers.delete(name)
      const token = typeof window === 'undefined' ? null : window.sessionStorage.getItem('englishflow.admin.access-token')
      if (token) headers.set('Authorization', `Bearer ${token}`)
      let body: BodyInit | undefined
      if (options.body !== undefined) { body = JSON.stringify(options.body); headers.set('Content-Type', 'application/json') }
      const response = await fetch(joinUrl(baseUrl, path), { method: options.method ?? 'GET', headers, body, signal: options.signal, credentials: options.credentials ?? 'include' })
      const text = await response.text()
      let details: unknown = undefined
      try { details = text ? JSON.parse(text) as unknown : undefined } catch { details = text }
      if (response.status === 401 && !retried && !options.skipAuthRetry) {
        const [{ pinia }, { useAdminStore }] = await Promise.all([import('../stores/admin'), import('../stores/admin')])
        if (await useAdminStore(pinia).refreshSilently()) return request(path, { ...options, skipAuthRetry: true }, true)
      }
      if (!response.ok) throw new AdminApiError(`请求失败（HTTP ${response.status}）`, response.status, details)
      return details as T
  }
  return {
    request,
  }
}

export const adminClient = createAdminClient(getGatewayBaseUrl())
