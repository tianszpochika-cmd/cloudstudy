// Visible consent facts for the onboarding wizard. DEC-02 is not approved, so this
// module only names the server purpose codes and the one document version already
// published on principal/me. It does not author a privacy policy.

export const REQUIRED_CONSENT_PURPOSES = ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'] as const

export type RequiredConsentPurpose = typeof REQUIRED_CONSENT_PURPOSES[number]

export const requiredConsentItems: ReadonlyArray<{ purpose: RequiredConsentPurpose; label: string }> = [
  { purpose: 'ACCOUNT_TERMS', label: '账号条款' },
  { purpose: 'PRIVACY_NOTICE', label: '隐私说明' },
  { purpose: 'ADULT_LEARNING_ELIGIBILITY', label: '成人学习资格' },
]

export const CONSENT_VERSION_UNREAD = '版本未读到'

export function emptyConsentChoices(): Record<RequiredConsentPurpose, boolean> {
  return {
    ACCOUNT_TERMS: false,
    PRIVACY_NOTICE: false,
    ADULT_LEARNING_ELIGIBILITY: false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function purposeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** One published document version, or null when it cannot be read for all three purposes. */
export function readPublishedConsentVersion(payload: unknown): string | null {
  const root = isRecord(payload) && 'data' in payload ? payload.data : payload
  const record = isRecord(root) ? root : null
  if (!record) return null
  const principal = isRecord(record.principal) ? record.principal : record
  const consentState = isRecord(record.consentState)
    ? record.consentState
    : isRecord(principal.consentState)
      ? principal.consentState
      : null
  if (!consentState) return null
  const version = typeof consentState.version === 'string' ? consentState.version.trim() : ''
  if (!version) return null
  const purposes = purposeCodes(consentState.requiredPurposes)
  if (REQUIRED_CONSENT_PURPOSES.some((purpose) => !purposes.includes(purpose))) return null
  return version
}
