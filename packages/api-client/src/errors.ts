/**
 * Stable UI-facing categories for errors crossing the Gateway boundary.
 *
 * The category is deliberately independent from any framework-specific ApiError
 * class so browser, uni-app, SSR and test doubles can share the same decision.
 */
export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'offline' | 'retry' | 'empty' | 'unknown'

export interface ApiErrorClassification {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: string | null
  readonly retryable: boolean
  readonly authenticated: boolean
  readonly hasPermission: boolean
}

export interface ApiResponseLike {
  readonly status: number
  readonly ok?: boolean
  readonly body?: unknown
  readonly data?: unknown
}

const RETRYABLE_STATUS_MIN = 500
const RETRYABLE_STATUS_MAX = 599
const RETRYABLE_STATUSES = new Set([408, 425, 429])
const OFFLINE_CODES = new Set([
  'ERR_NETWORK',
  'ERR_INTERNET_DISCONNECTED',
  'ENETUNREACH',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'NETWORK_ERROR',
  'OFFLINE',
])
const RETRYABLE_CODES = new Set([
  'TIMEOUT',
  'REQUEST_TIMEOUT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'IDP_UNAVAILABLE',
  'TEMPORARILY_UNAVAILABLE',
])

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStatus(value: unknown): number | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const direct = readNumber(record.status) ?? readNumber(record.statusCode)
  if (direct !== undefined) return direct
  return readStatus(record.response)
}

function readCode(value: unknown): string | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const direct = readString(record.code) ?? readString(record.errorCode)
  if (direct) return direct.toUpperCase()
  const nested = asRecord(record.error)
  return readString(nested?.code ?? nested?.errorCode)?.toUpperCase()
}

function isRetryableStatus(status: number | undefined): boolean {
  return status !== undefined && (RETRYABLE_STATUSES.has(status) || (status >= RETRYABLE_STATUS_MIN && status <= RETRYABLE_STATUS_MAX))
}

function isOfflineError(value: unknown, code: string | undefined, status: number | undefined): boolean {
  if (status === 0) return true
  if (code && OFFLINE_CODES.has(code)) return true
  const record = asRecord(value)
  const name = readString(record?.name)?.toUpperCase()
  if (name === 'TYPEERROR' && /fetch|network|load failed|failed to fetch/i.test(String(record?.message ?? value))) return true
  return name === 'NETWORKERROR' || name === 'OFFLINE'
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (Array.isArray(value)) return value.length === 0
  const record = asRecord(value)
  if (!record) return false
  if (record.items !== undefined) return Array.isArray(record.items) && record.items.length === 0
  if (record.data !== undefined) return Array.isArray(record.data) && record.data.length === 0
  return false
}

function result(status: number | undefined, code: string | undefined, kind: ApiErrorKind): ApiErrorClassification {
  return {
    kind,
    status: status ?? null,
    code: code ?? null,
    retryable: kind === 'offline' || kind === 'retry',
    authenticated: kind !== 'unauthorized',
    hasPermission: kind !== 'unauthorized' && kind !== 'forbidden',
  }
}

/** Classify a thrown response/error without treating an authorization failure as empty data. */
export function classifyApiError(error: unknown): ApiErrorClassification {
  const status = readStatus(error)
  const code = readCode(error)

  if (status === 401 || code === 'UNAUTHORIZED' || code === 'AUTH_REQUIRED') return result(status, code, 'unauthorized')
  if (status === 403 || code === 'FORBIDDEN' || code === 'POLICY_DENIED') return result(status, code, 'forbidden')
  if (isOfflineError(error, code, status)) return result(status, code, 'offline')
  if (isRetryableStatus(status) || (code !== undefined && RETRYABLE_CODES.has(code))) return result(status, code, 'retry')
  return result(status, code, 'unknown')
}

/**
 * Classify an HTTP-like result. Empty is only returned for a successful/no-content
 * result; 401 and 403 are checked first and can never be downgraded to empty.
 */
export function classifyApiResponse(response: ApiResponseLike): ApiErrorClassification {
  const status = readNumber(response.status)
  const code = readCode(response)
  if (status === 401 || code === 'UNAUTHORIZED' || code === 'AUTH_REQUIRED') return result(status, code, 'unauthorized')
  if (status === 403 || code === 'FORBIDDEN' || code === 'POLICY_DENIED') return result(status, code, 'forbidden')
  if (status === 0) return result(status, code, 'offline')
  if (isRetryableStatus(status) || (code !== undefined && RETRYABLE_CODES.has(code))) return result(status, code, 'retry')
  const body = response.body === undefined ? response.data : response.body
  if (status === 204 || (status !== undefined && status >= 200 && status < 300 && isEmptyValue(body))) return result(status, code, 'empty')
  return result(status, code, 'unknown')
}

export function isApiErrorKind(error: unknown, kind: ApiErrorKind): boolean {
  return classifyApiError(error).kind === kind
}

export function isEmptyApiResponse(response: ApiResponseLike): boolean {
  return classifyApiResponse(response).kind === 'empty'
}
