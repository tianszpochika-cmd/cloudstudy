let accessToken: string | null = null
let requestIdentity: { subject: string; revision: number } | null = null
let requestRevision = 0

export interface MobileAuthRequestSnapshot {
  accessToken: string | null
  identity: { subject: string; revision: number } | null
  revision: number
}

/** Mobile Access Tokens are memory-only; native Refresh Tokens use Keychain/Keystore. */
export function getInMemoryAccessToken(): string | null { return accessToken }
export function setInMemoryAccessToken(value: string | null): void {
  accessToken = value && value.trim() ? value.trim() : null
  if (!accessToken) requestIdentity = null
}
/** Synchronous owner snapshot paired with the in-memory token for request and retry guards. */
export function getInMemoryRequestIdentity(): { subject: string; revision: number } | null { return requestIdentity }
export function setInMemoryRequestIdentity(value: { subject: string; revision: number } | null, revision = requestRevision): void {
  requestIdentity = value ? { subject: value.subject, revision: value.revision } : null
  requestRevision = revision
}
/** Read the token and verified owner together so request construction cannot pair different sessions. */
export function getInMemoryAuthRequestSnapshot(): MobileAuthRequestSnapshot {
  return {
    accessToken,
    identity: requestIdentity ? { subject: requestIdentity.subject, revision: requestIdentity.revision } : null,
    revision: requestRevision,
  }
}
