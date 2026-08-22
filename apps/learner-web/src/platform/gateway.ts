export const DEFAULT_GATEWAY_BASE_URL = 'http://127.0.0.1:18070/api/v1'

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

export interface GatewayEnvironment {
  readonly VITE_GATEWAY_BASE_URL?: string
  readonly VITE_API_BASE_URL?: string
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '') || '/'
}

export function normalizeGatewayBaseUrl(value: unknown, fallback = DEFAULT_GATEWAY_BASE_URL): string {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\') || candidate.includes('?') || candidate.includes('#')) return fallback
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return trimTrailingSlash(candidate)
  try {
    const url = new URL(candidate)
    if (!SAFE_PROTOCOLS.has(url.protocol) || url.username || url.password || url.search || url.hash) return fallback
    return trimTrailingSlash(url.toString())
  } catch {
    return fallback
  }
}

export function getGatewayBaseUrl(env: GatewayEnvironment = ((import.meta as ImportMeta & { readonly env?: GatewayEnvironment }).env ?? {})): string {
  return normalizeGatewayBaseUrl(env.VITE_GATEWAY_BASE_URL ?? env.VITE_API_BASE_URL)
}

export function safeInternalReturnTo(value: unknown, fallback = '/home', origin = 'https://englishflow.invalid'): string {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\') || /%(?:2f|5c)/i.test(candidate) || /[\u0000-\u001f]/.test(candidate) || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback
  try {
    const url = new URL(candidate, origin)
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch {
    return fallback
  }
}
