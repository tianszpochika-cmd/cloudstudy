const SAFE_PROTOCOLS = new Set(['http:', 'https:'])
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

function normalizePath(path = '/') {
  const value = String(path || '/')
  if (value.includes('\\') || value.startsWith('//')) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

export function safePublicReturnTo(value, fallback = '/home') {
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

export function buildGatewayAuthLink(base, { returnTo = '/home', locale = 'zh-CN', theme = 'system', redirectUri, campaignParams = {} } = {}) {
  const path = '/auth/oidc/standard-oidc/authorization/start'
  if (typeof redirectUri !== 'string' || !/^https?:\/\//i.test(redirectUri)) throw new Error('A controlled absolute learner callback is required')
  const entries = [
    ['redirectUri', redirectUri],
    ['returnTo', safePublicReturnTo(returnTo)],
    ['uiLocale', String(locale)],
    ['theme', String(theme)],
  ]
  for (const [key, value] of Object.entries(preserveCampaignParams(campaignParams))) entries.push([key, value])
  if (String(base).startsWith('/')) {
    const query = new URLSearchParams(entries).toString()
    return `${String(base).replace(/\/$/, '')}${path}?${query}`
  }
  const url = new URL(String(base))
  if (!SAFE_PROTOCOLS.has(url.protocol)) throw new Error('Gateway auth links must use http or https')
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`
  url.search = new URLSearchParams(entries).toString()
  return url.toString()
}

export function buildLearnerLink(base, path = '/', params = {}) {
  const normalizedPath = normalizePath(path)
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')

  if (String(base).startsWith('/')) {
    const query = new URLSearchParams(entries).toString()
    return `${String(base).replace(/\/$/, '')}${normalizedPath}${query ? `?${query}` : ''}`
  }

  const url = new URL(String(base))
  if (!SAFE_PROTOCOLS.has(url.protocol)) {
    throw new Error('Learner deep links must use http or https')
  }

  url.pathname = `${url.pathname.replace(/\/$/, '')}${normalizedPath}`
  url.search = ''
  for (const [key, value] of entries) {
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export function preserveCampaignParams(query = {}) {
  return Object.fromEntries(CAMPAIGN_KEYS.flatMap((key) => {
    const raw = query?.[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.trim() && value.length <= 128 ? [[key, value.trim()]] : []
  }))
}

function absoluteOrigin(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null
  try {
    const url = new URL(value)
    return SAFE_PROTOCOLS.has(url.protocol) ? url.origin : null
  } catch {
    return null
  }
}

export function safePublicHref(value, { siteUrl, learnerWebUrl, allowedOrigins = [], fallback = null } = {}) {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  if (!candidate || candidate.includes('\\')) return fallback
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate

  try {
    const url = new URL(candidate)
    if (!SAFE_PROTOCOLS.has(url.protocol)) return fallback
    const origins = new Set([
      absoluteOrigin(siteUrl),
      absoluteOrigin(learnerWebUrl),
      ...allowedOrigins.map(absoluteOrigin),
    ].filter(Boolean))
    return origins.has(url.origin) ? url.toString() : fallback
  } catch {
    return fallback
  }
}

export function appendCampaignParams(href, query = {}) {
  const campaignParams = preserveCampaignParams(query)
  if (!href || Object.keys(campaignParams).length === 0) return href
  const isRelative = String(href).startsWith('/') && !String(href).startsWith('//')
  try {
    const url = new URL(String(href), 'https://englishflow-public.invalid')
    for (const [key, value] of Object.entries(campaignParams)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value)
    }
    return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString()
  } catch {
    return href
  }
}
