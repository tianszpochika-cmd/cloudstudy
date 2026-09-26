export interface InMemoryAdminAuthSnapshot {
  accessToken: string | null
  subject: string | null
  generation: number
  authenticated: boolean
}

export interface InMemoryAdminAuthContext extends InMemoryAdminAuthSnapshot {
  pendingAccessToken: string | null
}

let accessToken: string | null = null
let pendingAccessToken: string | null = null
let authSnapshot: InMemoryAdminAuthSnapshot = {
  accessToken: null,
  subject: null,
  generation: 0,
  authenticated: false,
}

function normalizeToken(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Admin Web Access Tokens are memory-only; the IAM Refresh Token is an HttpOnly cookie. */
export function getInMemoryAccessToken(): string | null { return accessToken }

/** Returns the committed token and its verified subject/generation in one synchronous read. */
export function getInMemoryAuthSnapshot(): InMemoryAdminAuthSnapshot { return { ...authSnapshot } }

/** Includes the unverified candidate only for the two controlled IAM identity reads. */
export function getInMemoryAdminAuthContext(): InMemoryAdminAuthContext {
  return { ...authSnapshot, pendingAccessToken }
}

/** Starts a new identity epoch and fences every response from the previous session. */
export function beginInMemoryAuthGeneration(candidateToken?: string | null): number {
  const generation = authSnapshot.generation + 1
  accessToken = null
  pendingAccessToken = normalizeToken(candidateToken)
  authSnapshot = { accessToken: null, subject: null, generation, authenticated: false }
  return generation
}

/** Holds a newly issued token in memory until IAM confirms its subject. */
export function stageInMemoryAccessToken(value: string, generation: number): boolean {
  const token = normalizeToken(value)
  if (!token || authSnapshot.generation !== generation) return false
  pendingAccessToken = token
  return true
}

/** Commits the staged token and server-confirmed subject atomically. */
export function confirmInMemoryAdminIdentity(subjectValue: string, generation: number): boolean {
  const subject = subjectValue.trim()
  const token = pendingAccessToken ?? accessToken
  if (!subject || !token || authSnapshot.generation !== generation) return false
  accessToken = token
  pendingAccessToken = null
  authSnapshot = { accessToken, subject, generation, authenticated: true }
  return true
}

/** Publishes a complete token/subject/generation snapshot atomically. */
export function setInMemoryAuthSnapshot(value: InMemoryAdminAuthSnapshot): void {
  accessToken = normalizeToken(value.accessToken)
  pendingAccessToken = null
  const subject = value.subject?.trim() || null
  authSnapshot = {
    accessToken,
    subject,
    generation: value.generation,
    authenticated: Boolean(value.authenticated && accessToken && subject),
  }
}

/** Retains the old low-level API while making unbound tokens fail closed. */
export function setInMemoryAccessToken(value: string | null): void {
  accessToken = normalizeToken(value)
  pendingAccessToken = null
  authSnapshot = {
    accessToken,
    subject: null,
    generation: authSnapshot.generation,
    authenticated: false,
  }
}
