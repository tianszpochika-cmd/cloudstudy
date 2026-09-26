export interface MobilePreferenceSyncStorage {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: string): void
  removeStorageSync(key: string): void
}

export interface MobilePreferenceIdentity {
  subject: string
  revision: number
}

const PENDING_SYNC_KEY_PREFIX = 'yx.mobile.account-preferences.pending-sync.v1'

function normalizeSubject(subject: string | null | undefined): string | null {
  const normalized = subject?.trim()
  return normalized || null
}

function pendingSyncKey(subject: string | null | undefined): string | null {
  const normalized = normalizeSubject(subject)
  return normalized ? `${PENDING_SYNC_KEY_PREFIX}:${encodeURIComponent(normalized)}` : null
}

export function hasPendingMobilePreferenceSync(subject: string | null | undefined, storage?: MobilePreferenceSyncStorage | null): boolean {
  const key = pendingSyncKey(subject)
  if (!key || !storage) return false
  try { return storage.getStorageSync(key) === '1' } catch { return false }
}

export function setPendingMobilePreferenceSync(subject: string | null | undefined, pending: boolean, storage?: MobilePreferenceSyncStorage | null): void {
  const key = pendingSyncKey(subject)
  if (!key || !storage) return
  try {
    if (pending) storage.setStorageSync(key, '1')
    else storage.removeStorageSync(key)
  } catch { /* Keep the current screen usable if local storage is unavailable. */ }
}

/** Clear an abandoned draft on identity change and read only the incoming subject's marker. */
export function transitionMobilePreferenceSubject(
  previousSubject: string | null | undefined,
  nextSubject: string | null | undefined,
  storage?: MobilePreferenceSyncStorage | null,
): { subject: string | null; pendingSync: boolean } {
  const previous = normalizeSubject(previousSubject)
  const next = normalizeSubject(nextSubject)
  if (previous && previous !== next) setPendingMobilePreferenceSync(previous, false, storage)
  return { subject: next, pendingSync: hasPendingMobilePreferenceSync(next, storage) }
}

export function sameMobilePreferenceIdentity(
  expected: MobilePreferenceIdentity | null | undefined,
  current: MobilePreferenceIdentity | null | undefined,
): boolean {
  return Boolean(expected && current && expected.subject === current.subject && expected.revision === current.revision)
}
