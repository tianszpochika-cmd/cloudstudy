let accessToken: string | null = null

/** Mobile Access Tokens are memory-only; native Refresh Tokens use Keychain/Keystore. */
export function getInMemoryAccessToken(): string | null { return accessToken }
export function setInMemoryAccessToken(value: string | null): void { accessToken = value && value.trim() ? value.trim() : null }
