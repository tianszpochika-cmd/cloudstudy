let sequence = 0

export function createClientId(prefix = 'client'): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`
  sequence = sequence >= 999999 ? 1 : sequence + 1
  return `${prefix}-${Date.now()}-${sequence}`
}
