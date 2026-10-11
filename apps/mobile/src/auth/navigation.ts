import { setMobileApiErrorHandler } from '../api/client'
import { safeMobileReturnTo } from './gateway-auth'
import { selectOnboardingResumeStep } from '../domain/onboarding-resume'
import { getUniRuntime, openUniPage, type UniRuntime } from '../platform/uni-runtime'
import { pinia } from '../stores/pinia'
import { useLearnerContentStore } from '../stores/learner-content'
import { useSessionStore } from '../stores/session'

const LOGIN_PATH = '/pages/login/login'
const FORBIDDEN_PATH = '/pages/forbidden/forbidden'
const ONBOARDING_PATH = '/pages/onboarding/onboarding'
const HOME_PATH = '/pages/home/home'

const PUBLIC_PATHS = new Set([LOGIN_PATH, FORBIDDEN_PATH, '/pages/register/register', '/pages/reset-password/reset-password', '/pages/report-share/report-share'])
const AUTH_ONLY_PATHS = new Set([
  ONBOARDING_PATH,
  '/pages/devices/devices',
  '/pages/settings/settings',
  '/pages/profile/profile',
  '/pages/support/support',
  '/pages/b6-platform/b6-platform',
])

type RouteOptions = { url?: string; delta?: number }

function runtime(): UniRuntime { return getUniRuntime() }

export function normalizeMobilePagePath(value: unknown, fallback = HOME_PATH): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const raw = value.trim().replace(/^https?:\/\/[^/]+/i, '')
  const path = raw.split(/[?#]/, 1)[0] || fallback
  if (path === '/') return fallback
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

export function isMobilePublicPath(path: unknown): boolean { return PUBLIC_PATHS.has(normalizeMobilePagePath(path)) }
export function isMobileProtectedPath(path: unknown): boolean { return !isMobilePublicPath(path) }
export function isMobileLearningPath(path: unknown): boolean {
  const normalized = normalizeMobilePagePath(path)
  return isMobileProtectedPath(normalized) && !AUTH_ONLY_PATHS.has(normalized)
}

function loginUrl(returnTo: string): string { return `${LOGIN_PATH}?returnTo=${encodeURIComponent(safeMobileReturnTo(returnTo))}` }

let pendingAuthNavigation: string | null = null

function relaunchOrNavigate(target: string): void {
  if (pendingAuthNavigation === target) return
  pendingAuthNavigation = target
  let navigation: void | Promise<unknown>
  try {
    const app = runtime()
    navigation = app.reLaunch ? app.reLaunch({ url: target }) : app.navigateTo({ url: target })
  } catch (error) {
    pendingAuthNavigation = null
    throw error
  }
  void Promise.resolve(navigation).catch(() => {
    // The app bootstrap and the page hook can both request the public route.
    // If one navigation loses that race, keep the intended destination.
    if (typeof window !== 'undefined' && currentMobilePagePath() !== normalizeMobilePagePath(target)) {
      window.location.hash = `#${target}`
    }
  }).finally(() => {
    if (pendingAuthNavigation === target) pendingAuthNavigation = null
  })
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

function rejectedAwayFromAccount(target: string): boolean {
  const session = useSessionStore(pinia)
  if (session.adultGate !== 'REJECTED') return false
  const normalized = normalizeMobilePagePath(target)
  return normalized === ONBOARDING_PATH || isMobileLearningPath(normalized)
}

async function redirectIfResumeBlocksLearning(target: string): Promise<boolean> {
  if (!isMobileLearningPath(target)) return false
  const session = useSessionStore(pinia)
  if (session.adultGate !== 'PASSED' || !session.isLearningReady) return false
  const content = useLearnerContentStore(pinia)
  if (typeof content.loadOnboardingResume !== 'function') return false
  try {
    const facts = await content.loadOnboardingResume()
    const step = selectOnboardingResumeStep(facts)
    if (step === 'rejected') {
      openUniPage(FORBIDDEN_PATH)
      return true
    }
    if (step === 'gate' || step === 'consent' || (step === 'goal' && facts.target.readable && !facts.target.saved)) {
      showOnboarding(target)
      return true
    }
    return false
  } catch {
    return false
  }
}

async function hydrateContentLocale(): Promise<boolean> {
  const session = useSessionStore(pinia)
  if (!session.isLearningReady) return false
  const identity = session.getMobileApiIdentity()
  if (!identity) return false
  const content = useLearnerContentStore(pinia)
  // The settings page deliberately performs a fresh GET whenever it opens.
  // Other learning routes reuse the current identity's verified preference.
  if (content.accountStatus === 'ready') {
    const current = session.getMobileApiIdentity()
    return Boolean(current && current.subject === identity.subject && current.revision === identity.revision)
  }
  await content.loadAccount()
  const current = session.getMobileApiIdentity()
  return Boolean(current && current.subject === identity.subject && current.revision === identity.revision)
}

/** Continue from the account-password login without making the navigation guard flash. */
export async function continueAfterLogin(returnTo: string): Promise<void> {
  const session = useSessionStore(pinia)
  const safe = safeMobileReturnTo(returnTo)
  if (rejectedAwayFromAccount(safe)) {
    openUniPage(FORBIDDEN_PATH)
    return
  }
  if (isMobileLearningPath(safe) && !session.isLearningReady) {
    showOnboarding(safe)
    return
  }
  if (isMobileLearningPath(safe) && await redirectIfResumeBlocksLearning(safe)) return
  if (isMobileLearningPath(safe) && !await hydrateContentLocale()) return
  openUniPage(safe)
}

let redirectPromise: Promise<void> | null = null

async function resolveBlockedNavigation(target: string): Promise<void> {
  if (redirectPromise) return redirectPromise
  redirectPromise = (async () => {
    const session = useSessionStore(pinia)
    try { await session.restore() } catch { /* the session store closes the gate on restore failure */ }
    if (!session.isAuthenticated) { showLogin(target); return }
    if (rejectedAwayFromAccount(target)) {
      openUniPage(FORBIDDEN_PATH)
      return
    }
    if (isMobileLearningPath(target) && !session.isLearningReady) {
      showOnboarding(target)
      return
    }
    if (isMobileLearningPath(target) && await redirectIfResumeBlocksLearning(target)) return
    if (isMobileLearningPath(target) && !await hydrateContentLocale()) {
      if (!session.isAuthenticated) showLogin(target)
      return
    }
    openUniPage(target)
  })().finally(() => { redirectPromise = null })
  return redirectPromise
}

function interceptNavigation(options: RouteOptions): false | RouteOptions {
  const target = normalizeMobilePagePath(options.url)
  if (!isMobileProtectedPath(target)) return options
  const session = useSessionStore(pinia)
  if (session.isAuthenticated && rejectedAwayFromAccount(target)) {
    void resolveBlockedNavigation(target)
    return false
  }
  if (session.isAuthenticated && (!isMobileLearningPath(target) || session.isLearningReady)) return options
  void resolveBlockedNavigation(target)
  return false
}

let gateTail: Promise<void> = Promise.resolve()

function installHashRevalidation(): void {
  if (typeof window === 'undefined') return
  const holder = window as Window & { __yxHashGateInstalled?: boolean }
  if (holder.__yxHashGateInstalled) return
  holder.__yxHashGateInstalled = true
  window.addEventListener('hashchange', () => {
    void revalidateMobileAccess(currentMobilePagePath())
  })
}

function sendForbidden(): void {
  if (currentMobilePagePath() === FORBIDDEN_PATH) return
  openUniPage(FORBIDDEN_PATH)
}

async function revalidateProtected(normalized: string): Promise<boolean> {
  const session = useSessionStore(pinia)
  try { await session.restore() } catch { /* restore has already closed the session */ }
  if (!session.isAuthenticated) { showLogin(normalized); return false }
  const wasReady = session.isLearningReady === true
  if (typeof session.refreshGateFromServer === 'function') {
    try { await session.refreshGateFromServer() } catch { /* keep the last verified snapshot */ }
  }
  if (rejectedAwayFromAccount(normalized)) {
    sendForbidden()
    return false
  }
  const withdrawn = session.learningConsentWithdrawn === true
  if (!isMobileLearningPath(normalized) && normalized !== ONBOARDING_PATH) return true
  let resumeStep: ReturnType<typeof selectOnboardingResumeStep> | null = null
  let targetSavedGap = false
  const content = useLearnerContentStore(pinia)
  if (typeof content.loadOnboardingResume === 'function') {
    try {
      const facts = await content.loadOnboardingResume(true)
      resumeStep = selectOnboardingResumeStep(facts)
      targetSavedGap = facts.target.readable && !facts.target.saved
    } catch { resumeStep = null }
  }
  if (resumeStep === 'rejected') {
    sendForbidden()
    return false
  }
  const consentIncomplete = resumeStep === 'gate' || resumeStep === 'consent'
  if (withdrawn || (wasReady && consentIncomplete)) {
    sendForbidden()
    return false
  }
  if (!session.isLearningReady || consentIncomplete || (resumeStep === 'goal' && targetSavedGap)) {
    showOnboarding(normalized)
    return false
  }
  if (isMobileLearningPath(normalized) && !await hydrateContentLocale()) {
    if (!session.isAuthenticated) showLogin(normalized)
    return false
  }
  return true
}

/** Re-read the adult gate and consent on every navigation, including a hash change that does not reload. */
export async function revalidateMobileAccess(target: string): Promise<boolean> {
  const normalized = normalizeMobilePagePath(target)
  if (!isMobileProtectedPath(normalized)) return true
  const run = gateTail.catch(() => undefined).then(() => revalidateProtected(normalized))
  gateTail = run.then(() => undefined, () => undefined)
  return run
}

export function installMobileNavigationGuard(): void {
  const app = runtime()
  setMobileApiErrorHandler((status, details) => handleMobileApiError(status, details))
  installHashRevalidation()
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
  if (rejectedAwayFromAccount(target)) { openUniPage(FORBIDDEN_PATH); return }
  if (isMobileLearningPath(target) && !session.isLearningReady) { showOnboarding(target); return }
  if (isMobileLearningPath(target) && await redirectIfResumeBlocksLearning(target)) return
  if (isMobileLearningPath(target) && !await hydrateContentLocale()) return
}

/** Page-level fallback for direct deep links and first render on runtimes without route interception. */
export async function ensureMobilePageAccess(target: string): Promise<boolean> {
  return revalidateMobileAccess(target)
}

function decisionCode(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null
  const envelope = (details as { error?: unknown }).error
  const source = typeof envelope === 'object' && envelope !== null ? envelope : details
  const code = (source as Record<string, unknown>).code
  return typeof code === 'string' ? code.trim() : null
}

export function handleMobileApiError(status: 401 | 403, details?: unknown): void {
  const session = useSessionStore(pinia)
  const current = currentMobilePagePath()
  if (status === 401) {
    session.clear()
    if (isMobileProtectedPath(current)) showLogin(current)
    return
  }
  // The onboarding page owns its permission and consent errors. A global
  // redirect here strands a new account before the required consents exist.
  if (current === ONBOARDING_PATH) return
  // A new adult account can read IAM but cannot read learner facts until the
  // onboarding consents have been recorded and its access token has rotated.
  if (decisionCode(details) === 'CONSENT_REQUIRED') {
    showOnboarding(current)
    return
  }
  if (current === FORBIDDEN_PATH) return
  session.setReturnTo(safeMobileReturnTo(current))
  relaunchOrNavigate(`${FORBIDDEN_PATH}?returnTo=${encodeURIComponent(safeMobileReturnTo(current))}`)
}

export { FORBIDDEN_PATH, HOME_PATH, LOGIN_PATH, ONBOARDING_PATH }
