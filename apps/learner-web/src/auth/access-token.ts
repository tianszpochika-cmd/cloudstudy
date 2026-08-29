let accessToken: string | null = null

/** Web Access Tokens are process memory only; Refresh Tokens stay in an HttpOnly cookie. */
export function getInMemoryAccessToken(): string | null {
  return accessToken
}

export function setInMemoryAccessToken(value: string | null): void {
  accessToken = value && value.trim() ? value.trim() : null
}
