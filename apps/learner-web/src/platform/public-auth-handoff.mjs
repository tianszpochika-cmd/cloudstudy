const PUBLIC_AUTH_PATHS = new Set(['/login', '/register', '/reset-password'])
const PUBLIC_UI_LOCALES = new Set(['zh-CN', 'en-US'])
const PUBLIC_THEMES = new Set(['system', 'light', 'dark', 'high-contrast'])

function queryValue(query, key) {
  if (typeof query === 'string') {
    return new URLSearchParams(query.replace(/^\?/, '')).get(key)
  }
  if (query instanceof URLSearchParams) return query.get(key)
  if (typeof query === 'object' && query !== null) {
    const value = query[key]
    return typeof value === 'string' ? value : null
  }
  return null
}

/** Reads only the public preference fields on the fixed anonymous auth routes. */
export function resolvePublicAuthHandoff(pathname, query) {
  const path = String(pathname ?? '').split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  if (!PUBLIC_AUTH_PATHS.has(path)) return null

  const rawLocale = queryValue(query, 'uiLocale')
  const rawTheme = queryValue(query, 'theme')
  const returnTo = queryValue(query, 'returnTo')
  const handoff = {}
  if (PUBLIC_UI_LOCALES.has(rawLocale)) handoff.uiLocale = rawLocale
  if (PUBLIC_THEMES.has(rawTheme)) handoff.theme = rawTheme
  if (returnTo !== null) handoff.returnTo = returnTo
  return Object.keys(handoff).length ? handoff : null
}

/** Applies explicit handoff values after persisted preferences have been restored. */
export function applyPublicAuthHandoff(handoff, { setUiLocale, setTheme } = {}) {
  if (!handoff) return null
  if (handoff.uiLocale) setUiLocale?.(handoff.uiLocale)
  if (handoff.theme) setTheme?.(handoff.theme)
  return handoff
}
