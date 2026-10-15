import {
  type B8AdultGateRequest,
  type B8AdultGateResponse,
  type B8AuthTokenResponse,
  type B8DeviceInput,
  type B8LoginRequest,
  type B8LogoutRequest,
  type B8RefreshRequest,
  type B8PasswordResetConfirmRequest,
} from '@englishflow/contracts'
import { MobileApiError, mobileApiClient, mobileIamAuthClient } from '../api/client'
import { safeInternalReturnTo } from '../platform/gateway'

export type MobileAdultGateStatus = 'UNKNOWN' | 'REQUIRED' | 'PASSED' | 'REJECTED'
export type MobileAdultLearningAccess = NonNullable<B8AdultGateResponse['learningAccess']> | 'UNKNOWN'

export interface MobileTokenPair {
  accessToken: B8AuthTokenResponse['accessToken']
  refreshToken?: B8AuthTokenResponse['refreshToken'] | null
  deviceId?: B8AuthTokenResponse['deviceId'] | null
  sessionId?: B8AuthTokenResponse['sessionId'] | null
  adultGate?: MobileAdultGateStatus
  adultLearningAccess?: MobileAdultLearningAccess
}

export interface MobilePrincipalSnapshot {
  subject: string
  roles: readonly string[]
  permissions: readonly string[]
  adultGate: MobileAdultGateStatus
  adultLearningAccess?: MobileAdultLearningAccess
}

export interface MobileAuthSnapshot {
  readonly principal?: MobilePrincipalSnapshot | null
  readonly permissions?: readonly string[]
  readonly roles?: readonly string[]
  readonly adultGate?: MobileAdultGateStatus
  readonly adultLearningAccess?: MobileAdultLearningAccess
  readonly tokenPair?: MobileTokenPair | null
}

export interface MobileLoginCredentials {
  readonly identifier: B8LoginRequest['identifier']
  readonly password: B8LoginRequest['password']
  readonly device: B8DeviceInput
}

export interface MobileAuthAdapter {
  login(input: MobileLoginCredentials): Promise<MobileTokenPair>
  register(input: MobileLoginCredentials): Promise<MobileTokenPair>
  requestPasswordReset(input: { identifier: string }): Promise<{ accepted: boolean }>
  confirmPasswordReset(input: B8PasswordResetConfirmRequest): Promise<void>
  restoreSession(): Promise<MobileAuthSnapshot | null>
  refresh(input?: B8RefreshRequest): Promise<MobileTokenPair>
  getPermissions(): Promise<MobileAuthSnapshot | null>
  confirmAdultGate(input: B8AdultGateRequest): Promise<MobileAuthSnapshot | null>
  logout(input?: B8LogoutRequest): Promise<void>
  revoke(sessionId: string): Promise<void>
}

export function safeMobileReturnTo(value: unknown, fallback = '/pages/home/home'): string {
  const path = safeInternalReturnTo(value, fallback)
  return /^\/pages\/[a-z0-9-]+\/[a-z0-9-]+(?:\?.*)?$/i.test(path) ? path : fallback
}

/** Uni H5 may encode a page query again when reLaunch serializes it. */
export function safeMobileRouteReturnTo(value: unknown, fallback = '/pages/home/home'): string {
  let candidate = value
  for (let attempt = 0; attempt < 2 && typeof candidate === 'string' && candidate.startsWith('%'); attempt += 1) {
    try { candidate = decodeURIComponent(candidate) } catch { return fallback }
  }
  return safeMobileReturnTo(candidate, fallback)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function list(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isRecord(value.data)) return value.data
  if (isRecord(value.result)) return value.result
  return value
}

function parseAdultGate(value: unknown): MobileAdultGateStatus {
  if (value === 'PASSED' || value === 'REQUIRED' || value === 'REJECTED') return value
  if (!isRecord(value)) return 'UNKNOWN'
  if (value.status === 'PASSED' || value.status === 'APPROVED') return 'PASSED'
  if (value.status === 'REQUIRED' || value.status === 'PENDING' || value.status === 'NOT_EVALUATED') return 'REQUIRED'
  if (value.status === 'REJECTED') return 'REJECTED'
  return 'UNKNOWN'
}

function parseAdultLearningAccess(value: unknown): MobileAdultLearningAccess {
  if (!isRecord(value)) return 'UNKNOWN'
  return value.learningAccess === 'ELIGIBLE' || value.learningAccess === 'RESTRICTED' ? value.learningAccess : 'UNKNOWN'
}

function parseTokenPair(value: unknown): MobileTokenPair {
  const source = unwrap(value)
  if (!isRecord(source)) throw new Error('认证服务没有返回有效移动会话。')
  const accessToken = text(source.accessToken)
  if (!accessToken) throw new Error('认证服务没有返回有效访问凭证。')
  return {
    accessToken,
    refreshToken: text(source.refreshToken),
    deviceId: text(source.deviceId),
    sessionId: text(source.sessionId),
    adultGate: parseAdultGate(source.adultGate ?? source.adultGateStatus),
    adultLearningAccess: parseAdultLearningAccess(source.adultGate),
  }
}

function parseSnapshot(value: unknown): MobileAuthSnapshot | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const principalSource = isRecord(source.principal) ? source.principal : source
  const subject = text(principalSource.subject ?? principalSource.sub ?? principalSource.principalId)
  const roles = list(source.roles ?? principalSource.roles)
  const permissions = list(source.permissions ?? principalSource.permissions)
  const adultFact = source.adultGate ?? source.adultGateStatus ?? principalSource.adultGate ?? principalSource.adultGateStatus ?? (source.learningAccess !== undefined || ['PASSED', 'REJECTED', 'NOT_EVALUATED'].includes(String(source.status)) ? source : undefined)
  const adultGate = parseAdultGate(adultFact)
  const adultLearningAccess = parseAdultLearningAccess(adultFact)
  return {
    principal: subject ? { subject, roles, permissions, adultGate, adultLearningAccess } : null,
    roles,
    permissions,
    adultGate,
    adultLearningAccess,
    tokenPair: source.accessToken ? parseTokenPair(source) : null,
  }
}

let loginSequence = 0

function authIdempotencyKey(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`
  loginSequence += 1
  return `${prefix}-${Date.now()}-${loginSequence}`
}

export function createGatewayMobileAuthAdapter(): MobileAuthAdapter {
  return {
    async login(input) {
      return parseTokenPair(await mobileIamAuthClient.request('/auth/login', {
        method: 'POST',
        data: input,
        header: { 'Idempotency-Key': authIdempotencyKey('login') },
        skipAuthRetry: true,
      }))
    },
    async register(input) {
      return parseTokenPair(await mobileIamAuthClient.request('/auth/register', {
        method: 'POST',
        data: input,
        header: { 'Idempotency-Key': authIdempotencyKey('register') },
        skipAuthRetry: true,
      }))
    },
    async requestPasswordReset(input) {
      await mobileIamAuthClient.request('/auth/password-reset/request', {
        method: 'POST',
        data: input,
        header: { 'Idempotency-Key': authIdempotencyKey('pwd-request') },
        skipAuthRetry: true,
      })
      return { accepted: true }
    },
    async confirmPasswordReset(input) {
      await mobileIamAuthClient.request('/auth/password-reset/confirm', {
        method: 'POST',
        data: input,
        header: { 'Idempotency-Key': authIdempotencyKey('pwd-confirm') },
        skipAuthRetry: true,
      })
    },
    async restoreSession() {
      try {
        return parseSnapshot(await mobileApiClient.request('/iam/principal/me', { skipAuthRetry: true, authBootstrap: 'identity' }))
      } catch (error) {
        if (error instanceof MobileApiError && (error.status === 401 || error.status === 404)) return null
        throw error
      }
    },
    async refresh(input) {
      // H5 refresh is the IAM Secure cookie. The HTTP Gateway never receives it.
      const data = input?.refreshToken ? input : undefined
      return parseTokenPair(await mobileIamAuthClient.request('/auth/token/refresh', {
        method: 'POST',
        data,
        header: { 'Idempotency-Key': authIdempotencyKey('refresh') },
        skipAuthRetry: true,
        authBootstrap: 'refresh',
      }))
    },
    async getPermissions() {
      try {
        // The principal contract includes current permissions and adult eligibility.
        return parseSnapshot(await mobileApiClient.request('/iam/principal/me', { skipAuthRetry: true, authBootstrap: 'identity' }))
      } catch (error) {
        if (error instanceof MobileApiError && (error.status === 401 || error.status === 404)) return null
        throw error
      }
    },
    async confirmAdultGate(input) {
      return parseSnapshot(await mobileApiClient.request('/iam/adult-gate', {
        method: 'POST',
        data: input,
        header: { 'Idempotency-Key': authIdempotencyKey('adult-gate') },
        skipAuthRetry: true,
      }))
    },
    async logout(input) {
      await mobileApiClient.request('/auth/logout', {
        method: 'POST',
        data: input ?? {},
        header: { 'Idempotency-Key': authIdempotencyKey('logout') },
        skipAuthRetry: true,
        authBootstrap: 'logout',
      })
    },
    async revoke(sessionId) {
      await mobileApiClient.request(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST',
        data: {},
        header: { 'Idempotency-Key': authIdempotencyKey('revoke') },
        skipAuthRetry: true,
        authBootstrap: 'revoke',
      })
    },
  }
}
