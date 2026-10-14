export type AuthFailureAction = 'login' | 'register' | 'resetRequest' | 'resetConfirm'
export type AuthFailureMarker =
  | 'iam.consent.version_unavailable'
  | 'iam.consent.withdrawn'
  | 'iam.eligibility.insufficient'
  | 'iam.credentials.invalid'
  | 'iam.account.locked'
  | 'iam.account.already_exists'
  | 'iam.login.rate_limited'
  | 'iam.password_reset.invalid'
  | 'RATE_LIMITED'
  | 'UNKNOWN_AUTH_ERROR'

export type LearnerLoginArrival = 'consent_withdrawn' | 'eligibility_insufficient'

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

function hasAnyExact(values: string[], markers: readonly string[]): boolean {
  return markers.some((marker) => hasExact(values, marker))
}

const CONSENT_WITHDRAWN_MARKERS = ['iam.consent.withdrawn', 'consent_withdrawn', 'CONSENT_WITHDRAWN', 'REQUIRED_CONSENT_WITHDRAWN'] as const
const ELIGIBILITY_INSUFFICIENT_MARKERS = ['iam.eligibility.insufficient', 'eligibility_insufficient', 'ELIGIBILITY_INSUFFICIENT', 'LEARNING_ELIGIBILITY_INSUFFICIENT'] as const

/** A login arrival notice is not a credential failure. Unknown reasons stay silent. */
export function learnerLoginArrival(reason: unknown): LearnerLoginArrival | null {
  const value = Array.isArray(reason) ? reason[0] : reason
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  if (text === '同意撤回' || (CONSENT_WITHDRAWN_MARKERS as readonly string[]).includes(text)) return 'consent_withdrawn'
  if (text === '资格不足' || (ELIGIBILITY_INSUFFICIENT_MARKERS as readonly string[]).includes(text)) return 'eligibility_insufficient'
  return null
}

/** Reduce an API/runtime failure to a small allowlist before it enters the session store. */
export function learnerAuthFailureMarker(failure: unknown): AuthFailureMarker {
  const { status, values, rawText } = failureDetails(failure)
  if (hasExact(values, 'iam.consent.version_unavailable')) return 'iam.consent.version_unavailable'
  if (hasAnyExact(values, CONSENT_WITHDRAWN_MARKERS) || /同意撤回|consent[._-]withdrawn|REQUIRED_CONSENT_WITHDRAWN/i.test(rawText)) return 'iam.consent.withdrawn'
  if (hasAnyExact(values, ELIGIBILITY_INSUFFICIENT_MARKERS) || /资格不足|eligibility[._-]insufficient|ELIGIBILITY_INSUFFICIENT/i.test(rawText)) return 'iam.eligibility.insufficient'
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
    if (marker === 'iam.consent.withdrawn') return t('login.consentWithdrawn')
    if (marker === 'iam.eligibility.insufficient') return t('login.eligibilityInsufficient')
    if (marker === 'iam.consent.version_unavailable') return t('login.accountUnavailable')
    if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('login.rateLimited')
    if (marker === 'iam.credentials.invalid') return t('login.invalidCredentials')
    if (marker === 'iam.account.locked') return t('login.accountLocked')
    return t('login.retry')
  }
  if (action === 'register') {
    if (marker === 'iam.consent.version_unavailable') return t('register.temporarilyUnavailable')
    if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('register.rateLimited')
    return t('register.failed')
  }
  if (action === 'resetRequest') {
    if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('passwordReset.rateLimited')
    return t('passwordReset.requestFailed')
  }
  if (marker === 'RATE_LIMITED' || marker === 'iam.login.rate_limited') return t('passwordReset.rateLimited')
  if (marker === 'iam.password_reset.invalid') return t('passwordReset.invalidCode')
  return t('passwordReset.confirmFailed')
}
