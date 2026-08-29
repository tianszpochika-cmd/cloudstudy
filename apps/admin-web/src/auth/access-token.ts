let accessToken: string | null = null

/** Admin Web Access Tokens are memory-only; the IAM Refresh Token is an HttpOnly cookie. */
export function getInMemoryAccessToken(): string | null { return accessToken }
export function setInMemoryAccessToken(value: string | null): void { accessToken = value && value.trim() ? value.trim() : null }
