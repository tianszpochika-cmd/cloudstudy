export type AuthFailureAction = 'login' | 'register' | 'resetRequest' | 'resetConfirm'
export type AuthFailureMarker =
  | 'iam.consent.version_unavailable'
  | 'iam.credentials.invalid'
  | 'iam.account.locked'
  | 'iam.account.already_exists'
  | 'iam.login.rate_limited'
  | 'iam.password_reset.invalid'
  | 'RATE_LIMITED'
  | 'UNKNOWN_AUTH_ERROR'

type Translate = (key: string) => string
type FailureDetails = { status: number | null; values: string[]; rawText: string }

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function failureDetails(failure: unknown): FailureDetails {
  if (typeof failure === 'string') return { status: null, values: [failure.trim()], rawText: failure.trim() }
  const source = record(failure)
  if (!source) return { status: null, values: [], rawText: '' }
  const details = record(source.details)
  const nested = record(details?.error)
  const status = typeof source.status === 'number' && Number.isInteger(source.status) ? source.status : null
  const values = [
    text(source.message), text(source.code),
    text(nested?.message), text(nested?.code),
    text(details?.message), text(details?.code),
  ].filter((value): value is string => Boolean(value))
  return { status, values, rawText: values.join(' ') }
}

function hasExact(values: string[], marker: string): boolean {
  return values.some((value) => value === marker || value.startsWith(`${marker}（`) || value.startsWith(`${marker} (`))
}

/** Reduce an API/runtime failure to a small allowlist before it enters the session store. */
export function learnerAuthFailureMarker(failure: unknown): AuthFailureMarker {
  const { status, values, rawText } = failureDetails(failure)
  if (hasExact(values, 'iam.consent.version_unavailable')) return 'iam.consent.version_unavailable'
  if (hasExact(values, 'iam.credentials.invalid')) return 'iam.credentials.invalid'
  if (hasExact(values, 'iam.account.locked')) return 'iam.account.locked'
  if (hasExact(values, 'iam.account.already_exists')) return 'iam.account.already_exists'
  if (hasExact(values, 'iam.password_reset.invalid')) return 'iam.password_reset.invalid'
  if (status === 429 || hasExact(values, 'RATE_LIMITED') || hasExact(values, 'iam.login.rate_limited')) return 'RATE_LIMITED'
  if (status === 401) return 'iam.credentials.invalid'
  if (status === 423) return 'iam.account.locked'

  // Keep compatibility with the existing localized rate/conflict copy paths. These values
  // can only choose a localized message; they are never returned to the user verbatim.
  if (/(?:\b429\b|TOO_MANY_REQUESTS|RATE_LIMIT|too many requests|请求过于频繁|操作太频繁)/i.test(rawText)) return 'RATE_LIMITED'
  if (/iam\.account\.already_exists|账号已存在|account (?:may )?already (?:be )?(?:registered|exist)/i.test(rawText)) return 'iam.account.already_exists'
  if (/iam\.password_reset\.invalid|PASSWORD_RESET_INVALID|password.?reset.*(?:invalid|expired)|(?:invalid|expired).*(?:reset|token)|重置.*(?:无效|过期|已失效)/i.test(rawText)) return 'iam.password_reset.invalid'
  return 'UNKNOWN_AUTH_ERROR'
}

/** Render only concise localized auth copy; never return raw server/runtime diagnostics. */
export function learnerAuthFailureCopy(action: AuthFailureAction, failure: unknown, t: Translate): string {
  const marker = learnerAuthFailureMarker(failure)
  if (action === 'login') {
    if (marker === 'iam.consent.version_unavailable') return t('login.accountUnavailable')
    if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('login.rateLimited')
    if (marker === 'iam.credentials.invalid') return t('login.invalidCredentials')
    if (marker === 'iam.account.locked') return t('login.accountLocked')
    return t('login.retry')
  }
  if (action === 'register') {
    if (marker === 'iam.consent.version_unavailable') return t('register.temporarilyUnavailable')
    if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('register.rateLimited')
    if (marker === 'iam.account.already_exists') return t('register.accountConflict')
    return t('register.failed')
  }
  if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('passwordReset.rateLimited')
  if (action === 'resetConfirm' && marker === 'iam.password_reset.invalid') return t('passwordReset.invalidCode')
  return t(action === 'resetRequest' ? 'passwordReset.requestFailed' : 'passwordReset.confirmFailed')
}
