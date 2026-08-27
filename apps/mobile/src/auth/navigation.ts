import { setMobileApiErrorHandler } from '../api/client'
import { safeMobileReturnTo } from './gateway-auth'
import { getUniRuntime, openUniPage, type UniRuntime } from '../platform/uni-runtime'
import { pinia } from '../stores/pinia'
import { useSessionStore } from '../stores/session'

const LOGIN_PATH = '/pages/login/login'
const CALLBACK_PATH = '/pages/auth-callback/auth-callback'
const FORBIDDEN_PATH = '/pages/forbidden/forbidden'
const ONBOARDING_PATH = '/pages/onboarding/onboarding'
const HOME_PATH = '/pages/home/home'
const H5_OIDC_CALLBACK_PATH = '/auth/callback'

const PUBLIC_PATHS = new Set([LOGIN_PATH, CALLBACK_PATH, FORBIDDEN_PATH])

type RouteOptions = { url?: string; delta?: number }

function runtime(): UniRuntime { return getUniRuntime() }

export function normalizeMobilePagePath(value: unknown, fallback = HOME_PATH): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const raw = value.trim().replace(/^https?:\/\/[^/]+/i, '')
  const path = raw.split(/[?#]/, 1)[0] || fallback
  return path.startsWith('/') ? path : `/${path}`
}

export function currentMobilePagePath(fallback = HOME_PATH): string {
  if (typeof window !== 'undefined' && window.location) {
    const hashPath = normalizeMobilePagePath(window.location.hash.replace(/^#/, ''), '')
    if (hashPath) return hashPath
  }
  const getPages = (globalThis as typeof globalThis & { getCurrentPages?: () => Array<{ route?: string }> }).getCurrentPages
  const pages = getPages?.() ?? []
  return normalizeMobilePagePath(pages.at(-1)?.route, fallback)
}

/**
 * H5 cannot use a hash fragment as an OIDC redirect URI. The IdP therefore
 * returns to /auth/callback, and this bridge forwards only the callback
 * parameters into the real uni-app callback page.
 */
export function bridgeMobileH5OidcCallback(): boolean {
  if (typeof window === 'undefined' || !window.location) return false
  if (normalizeMobilePagePath(window.location.pathname, '') !== H5_OIDC_CALLBACK_PATH) return false
  const hashPath = normalizeMobilePagePath(window.location.hash.replace(/^#/, ''), '')
  if (hashPath === CALLBACK_PATH) return false
  const input = new URLSearchParams(window.location.search)
  if (!input.has('code') && !input.has('state') && !input.has('error')) return false

  const output = new URLSearchParams()
  for (const key of ['code', 'state', 'error', 'error_description', 'error_uri', 'returnTo']) {
    const value = input.get(key)
    if (value) output.set(key, value)
  }
  const target = `${CALLBACK_PATH}${output.toString() ? `?${output.toString()}` : ''}`
  try {
    relaunchOrNavigate(target)
    return true
  } catch {
    return false
  }
}

export function isMobilePublicPath(path: unknown): boolean { return PUBLIC_PATHS.has(normalizeMobilePagePath(path)) }
export function isMobileProtectedPath(path: unknown): boolean { return !isMobilePublicPath(path) }
export function isMobileLearningPath(path: unknown): boolean {
  const normalized = normalizeMobilePagePath(path)
  return isMobileProtectedPath(normalized) && normalized !== ONBOARDING_PATH
}

function loginUrl(returnTo: string): string { return `${LOGIN_PATH}?returnTo=${encodeURIComponent(safeMobileReturnTo(returnTo))}` }

function relaunchOrNavigate(target: string): void {
  const app = runtime()
  if (app.reLaunch) app.reLaunch({ url: target })
  else app.navigateTo({ url: target })
}

function showLogin(returnTo: string): void {
  const session = useSessionStore(pinia)
  const safe = safeMobileReturnTo(returnTo)
  session.setReturnTo(safe)
  if (currentMobilePagePath() === LOGIN_PATH) return
  relaunchOrNavigate(loginUrl(safe))
}

function showOnboarding(returnTo: string): void {
  const session = useSessionStore(pinia)
  session.setReturnTo(safeMobileReturnTo(returnTo))
  if (currentMobilePagePath() === ONBOARDING_PATH) return
  relaunchOrNavigate(ONBOARDING_PATH)
}

/** Continue from the OIDC handoff without making the navigation guard flash. */
export function continueAfterLogin(returnTo: string): void {
  const session = useSessionStore(pinia)
  const safe = safeMobileReturnTo(returnTo)
  if (!session.isLearningReady) {
    showOnboarding(safe)
    return
  }
  openUniPage(safe)
}

let redirectPromise: Promise<void> | null = null

async function resolveBlockedNavigation(target: string): Promise<void> {
  if (redirectPromise) return redirectPromise
  redirectPromise = (async () => {
    const session = useSessionStore(pinia)
    try { await session.restore() } catch { /* the session store closes the gate on restore failure */ }
    if (!session.isAuthenticated) { showLogin(target); return }
    if (isMobileLearningPath(target) && !session.isLearningReady) { showOnboarding(target); return }
    openUniPage(target)
  })().finally(() => { redirectPromise = null })
  return redirectPromise
}

function interceptNavigation(options: RouteOptions): false | RouteOptions {
  const target = normalizeMobilePagePath(options.url)
  if (!isMobileProtectedPath(target)) return options
  const session = useSessionStore(pinia)
  if (session.isAuthenticated && (!isMobileLearningPath(target) || session.isLearningReady)) return options
  void resolveBlockedNavigation(target)
  return false
}

export function installMobileNavigationGuard(): void {
  const app = runtime()
  setMobileApiErrorHandler((status) => handleMobileApiError(status))
  if (app.addInterceptor) {
    for (const method of ['navigateTo', 'redirectTo', 'switchTab', 'reLaunch']) {
      app.addInterceptor(method, { invoke: (options) => interceptNavigation(options) })
    }
  }
}

export async function bootstrapMobileAuth(initialPath: unknown): Promise<void> {
  const target = normalizeMobilePagePath(initialPath)
  const session = useSessionStore(pinia)
  try { await session.restore() } catch { /* restore has already cleared the local session */ }
  if (!isMobileProtectedPath(target)) return
  if (!session.isAuthenticated) { showLogin(target); return }
  if (isMobileLearningPath(target) && !session.isLearningReady) showOnboarding(target)
}

/** Page-level fallback for direct deep links and first render on runtimes without route interception. */
export async function ensureMobilePageAccess(target: string): Promise<boolean> {
  const normalized = normalizeMobilePagePath(target)
  const session = useSessionStore(pinia)
  try { await session.restore() } catch { /* restore has already closed the session */ }
  if (!session.isAuthenticated) { showLogin(normalized); return false }
  if (isMobileLearningPath(normalized) && !session.isLearningReady) { showOnboarding(normalized); return false }
  return true
}

export function handleMobileApiError(status: 401 | 403): void {
  const session = useSessionStore(pinia)
  const current = currentMobilePagePath()
  if (status === 401) {
    session.clear()
    if (isMobileProtectedPath(current)) showLogin(current)
    return
  }
  if (current === FORBIDDEN_PATH) return
  session.setReturnTo(safeMobileReturnTo(current))
  relaunchOrNavigate(`${FORBIDDEN_PATH}?returnTo=${encodeURIComponent(safeMobileReturnTo(current))}`)
}

export { CALLBACK_PATH, FORBIDDEN_PATH, H5_OIDC_CALLBACK_PATH, HOME_PATH, LOGIN_PATH, ONBOARDING_PATH }
