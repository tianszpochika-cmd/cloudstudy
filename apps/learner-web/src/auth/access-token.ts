let accessToken: string | null = null
export interface InMemoryAuthSnapshot {
  accessToken: string | null
  subject: string | null
  generation: number
  authenticated: boolean
}

let authSnapshot: InMemoryAuthSnapshot = {
  accessToken: null,
  subject: null,
  generation: 0,
  authenticated: false,
}

/** Web Access Tokens are process memory only; Refresh Tokens stay in an HttpOnly cookie. */
export function getInMemoryAccessToken(): string | null {
  return accessToken
}

/** Returns one synchronous token and owner snapshot; it is never persisted. */
export function getInMemoryAuthSnapshot(): InMemoryAuthSnapshot {
  return { ...authSnapshot }
}

/** Publishes a token together with its verified owner and auth generation atomically. */
export function setInMemoryAuthSnapshot(value: InMemoryAuthSnapshot): void {
  accessToken = value.accessToken && value.accessToken.trim() ? value.accessToken.trim() : null
  const subject = value.subject?.trim() || null
  authSnapshot = {
    accessToken,
    subject,
    generation: value.generation,
    authenticated: Boolean(value.authenticated && accessToken && subject),
  }
}

export function setInMemoryAccessToken(value: string | null): void {
  accessToken = value && value.trim() ? value.trim() : null
  authSnapshot = {
    accessToken,
    subject: null,
    generation: authSnapshot.generation,
    authenticated: false,
  }
}
