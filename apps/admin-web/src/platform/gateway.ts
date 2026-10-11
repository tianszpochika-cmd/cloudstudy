export const DEFAULT_GATEWAY_BASE_URL = 'http://127.0.0.1:18070/api/v1'

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

export interface GatewayEnvironment {
  readonly VITE_GATEWAY_BASE_URL?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_DOMAIN_FAMILIES?: string
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '') || '/'
}

/**
 * Multi-domain deployments (e.g. clyunedev.com and clyune.com serving one build) list their
 * domain families at build time in VITE_API_DOMAIN_FAMILIES. When the page is served from an
 * allow-listed family and the baked API host is api.<other allow-listed family>, the API host is
 * moved to api.<page family> so cookies and CORS stay on the domain the user is on.
 */
export function alignApiHostToPage(baseUrl: string, families: unknown, pageHostname: unknown): string {
  if (typeof families !== 'string' || typeof pageHostname !== 'string' || !families.trim()) return baseUrl
  const list = families.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  const host = pageHostname.toLowerCase()
  const pageFamily = list.find((family) => host === family || host.endsWith(`.${family}`))
  if (!pageFamily) return baseUrl
  try {
    const url = new URL(baseUrl)
    const apiFamily = list.find((family) => url.hostname === `api.${family}`)
    if (!apiFamily || apiFamily === pageFamily) return baseUrl
    url.hostname = `api.${pageFamily}`
    return trimTrailingSlash(url.toString())
  } catch {
    return baseUrl
  }
}

function runtimePageHostname(): string | undefined {
  return typeof globalThis !== 'undefined' && (globalThis as { location?: { hostname?: string } }).location?.hostname || undefined
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
  return alignApiHostToPage(normalizeGatewayBaseUrl(env.VITE_GATEWAY_BASE_URL ?? env.VITE_API_BASE_URL), env.VITE_API_DOMAIN_FAMILIES, runtimePageHostname())
}

export function safeInternalReturnTo(value: unknown, fallback = '/dashboard', origin = 'https://englishflow-admin.invalid'): string {
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
