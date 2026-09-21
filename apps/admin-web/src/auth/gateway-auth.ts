import { AdminApiError, type AdminApiClient } from '../api/client'
import { adminT } from '../platform/admin-i18n'
import { safeInternalReturnTo } from '../platform/gateway'

export interface AdminTokenPair {
  accessToken: string
  refreshToken?: string | null
  deviceId?: string | null
  sessionId?: string | null
}

export interface AdminPrincipalSnapshot {
  subject: string
  roles: readonly string[]
  permissions: readonly string[]
}

export interface AdminAuthSnapshot {
  readonly principal?: AdminPrincipalSnapshot | null
  readonly roles?: readonly string[]
  readonly permissions?: readonly string[]
  readonly tokenPair?: AdminTokenPair | null
}

export interface AdminLoginCredentials {
  readonly identifier: string
  readonly password: string
  readonly device: {
    readonly deviceType: 'WEB'
    readonly clientVersion: string
    readonly deviceId?: string
    readonly deviceName?: string
  }
}

export interface AdminAuthAdapter {
  login(input: AdminLoginCredentials): Promise<AdminTokenPair>
  restoreSession(): Promise<AdminAuthSnapshot | null>
  refresh(input?: { refreshToken?: string }): Promise<AdminTokenPair>
  getPermissions(): Promise<AdminAuthSnapshot | null>
  logout(input?: { allDevices?: boolean }): Promise<void>
}

export function safeAdminReturnTo(value: unknown, fallback = '/dashboard'): string {
  return safeInternalReturnTo(value, fallback)
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown { return !record(value) ? value : record(value.data) ? value.data : record(value.result) ? value.result : value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function list(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []
}

let loginSequence = 0

function authIdempotencyKey(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`
  loginSequence += 1
  return `${prefix}-${Date.now()}-${loginSequence}`
}
function parsePair(value: unknown): AdminTokenPair {
  const source = unwrap(value)
  if (!record(source) || !text(source.accessToken)) throw new Error(adminT('gatewayAuth.invalidSession'))
  return { accessToken: text(source.accessToken) as string, refreshToken: text(source.refreshToken), deviceId: text(source.deviceId), sessionId: text(source.sessionId) }
}
function parseSnapshot(value: unknown): AdminAuthSnapshot | null {
  const source = unwrap(value)
  if (!record(source)) return null
  const principalSource = record(source.principal) ? source.principal : source
  const roles = list(source.roles ?? principalSource.roles)
  const permissions = list(source.permissions ?? principalSource.permissions)
  const subject = text(principalSource.subject ?? principalSource.sub ?? principalSource.userId ?? principalSource.principalId)
  return {
    principal: subject ? { subject, roles, permissions } : null,
    roles,
    permissions,
    tokenPair: source.accessToken ? parsePair(source) : null,
  }
}

export function createGatewayAdminAuthAdapter(options: { client: AdminApiClient }): AdminAuthAdapter {
  return {
    async login(input) {
      return parsePair(await options.client.request('/auth/login', {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': authIdempotencyKey('login') },
        skipAuthRetry: true,
      }))
    },
    async restoreSession() {
      try { return parseSnapshot(await options.client.request('/iam/principal/me', { skipAuthRetry: true })) }
      catch (error) { if (error instanceof AdminApiError && (error.status === 401 || error.status === 404)) return null; throw error }
    },
    async refresh(input) {
      return parsePair(await options.client.request('/auth/token/refresh', {
        method: 'POST',
        body: input?.refreshToken ? { refreshToken: input.refreshToken } : undefined,
        headers: { 'Idempotency-Key': authIdempotencyKey('refresh') },
        skipAuthRetry: true,
      }))
    },
    async getPermissions() {
      try { return parseSnapshot(await options.client.request('/iam/permissions', { skipAuthRetry: true })) }
      catch (error) { if (error instanceof AdminApiError && (error.status === 401 || error.status === 404)) return null; throw error }
    },
    async logout(input) {
      await options.client.request('/auth/logout', {
        method: 'POST',
        body: input ?? {},
        headers: { 'Idempotency-Key': authIdempotencyKey('logout') },
        skipAuthRetry: true,
      })
    },
  }
}
