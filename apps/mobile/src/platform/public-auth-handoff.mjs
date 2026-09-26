const PUBLIC_AUTH_PATHS = new Set([
  '/pages/login/login',
  '/pages/register/register',
  '/pages/reset-password/reset-password',
])
const PUBLIC_UI_LOCALES = new Set(['zh-CN', 'en-US'])
const PUBLIC_THEMES = new Set(['system', 'light', 'dark', 'high-contrast'])

function addQuery(target, source) {
  if (typeof source === 'string') {
    for (const [key, value] of new URLSearchParams(source.replace(/^\?/, ''))) target.set(key, value)
    return
  }
  if (source instanceof URLSearchParams) {
    for (const [key, value] of source) target.set(key, value)
    return
  }
  if (typeof source === 'object' && source !== null) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string') target.set(key, value)
    }
  }
}

/** Builds the effective uni launch query, including official H5 hash links. */
export function mobilePublicAuthQuery({ launchQuery, search = '', hash = '' } = {}) {
  const query = new URLSearchParams()
  addQuery(query, search)
  const question = String(hash).indexOf('?')
  if (question >= 0) addQuery(query, String(hash).slice(question + 1))
  addQuery(query, launchQuery)
  return query
}

/** Reads only allowlisted UI preferences and the untouched navigation target on auth routes. */
export function resolveMobilePublicAuthHandoff(pathname, query) {
  const path = String(pathname ?? '').split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/'
  if (!PUBLIC_AUTH_PATHS.has(path)) return null
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(String(query ?? '').replace(/^\?/, ''))
  const rawLocale = params.get('uiLocale')
  const rawTheme = params.get('theme')
  const returnTo = params.get('returnTo')
  const handoff = {}
  if (PUBLIC_UI_LOCALES.has(rawLocale)) handoff.uiLocale = rawLocale
  if (PUBLIC_THEMES.has(rawTheme)) handoff.theme = rawTheme
  if (returnTo !== null) handoff.returnTo = returnTo
  return Object.keys(handoff).length ? handoff : null
}

/** Applies explicit handoff values after persisted preferences have been restored. */
export function applyMobilePublicAuthHandoff(handoff, { setUiLocale, setTheme } = {}) {
  if (!handoff) return null
  if (handoff.uiLocale) setUiLocale?.(handoff.uiLocale)
  if (handoff.theme) setTheme?.(handoff.theme)
  return handoff
}
