export const DEFAULT_GATEWAY_BASE_URL = '/api/v1'

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '') || '/'
}

export function resolveGatewayBaseUrl(value: unknown, fallback = DEFAULT_GATEWAY_BASE_URL): string {
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

export function safeOfficialReturnTo(value: unknown, fallback = '/home'): string {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\') || /%(?:2f|5c)/i.test(candidate) || /[\u0000-\u001f]/.test(candidate) || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback
  try {
    const url = new URL(candidate, 'https://englishflow-public.invalid')
    return url.origin === 'https://englishflow-public.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch {
    return fallback
  }
}
