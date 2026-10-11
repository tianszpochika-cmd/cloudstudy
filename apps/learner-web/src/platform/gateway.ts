export const DEFAULT_GATEWAY_BASE_URL = 'http://127.0.0.1:18070/api/v1'
export const DEFAULT_IAM_AUTH_BASE_URL = 'https://127.0.0.1:18087/api/v1'

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])
const IAM_AUTH_PATH = '/api/v1'

export interface GatewayEnvironment {
  readonly VITE_GATEWAY_BASE_URL?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_DOMAIN_FAMILIES?: string
  readonly VITE_IAM_AUTH_BASE_URL?: string
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

/** Password posts use IAM TLS. An http override, a relative path, or a non-/api/v1 path falls back to the fixed IAM entry. */
export function normalizeIamAuthBaseUrl(value: unknown, fallback = DEFAULT_IAM_AUTH_BASE_URL): string {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\') || candidate.includes('?') || candidate.includes('#')) return fallback
  try {
    const url = new URL(candidate)
    const path = url.pathname.replace(/\/+$/, '')
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || path !== IAM_AUTH_PATH) return fallback
    return `${url.origin}${IAM_AUTH_PATH}`
  } catch {
    return fallback
  }
}

export function requireIamAuthBaseUrl(value: unknown): string {
  const normalized = normalizeIamAuthBaseUrl(value, '')
  if (!normalized.startsWith('https://')) throw new Error('账号密码只能提交到 IAM 的 HTTPS 认证入口。')
  return normalized
}

export function getIamAuthBaseUrl(env: GatewayEnvironment = ((import.meta as ImportMeta & { readonly env?: GatewayEnvironment }).env ?? {})): string {
  return alignApiHostToPage(normalizeIamAuthBaseUrl(env.VITE_IAM_AUTH_BASE_URL), env.VITE_API_DOMAIN_FAMILIES, runtimePageHostname())
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
