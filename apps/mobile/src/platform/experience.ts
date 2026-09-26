import { computed, onBeforeUnmount, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { mobileExperienceVariables } from '@englishflow/design-tokens/mobile'
import { mobileExperienceMessages } from '@englishflow/i18n/mobile-experience'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { mobileI18n, mobileThemeController } from './v2-foundation'
import { getUniRuntime, openUniPage } from './uni-runtime'
import { resolveMobileMotion } from '../domain/experience'

for (const [locale, messages] of Object.entries(mobileExperienceMessages)) mobileI18n.registerMessages(locale, messages)
const uiLocale = ref(mobileI18n.locale)
mobileI18n.subscribe((state) => { uiLocale.value = state.locale })
export function mobileT(key: string): string { uiLocale.value; return mobileI18n.t(`mobile.${key}`) }

const storage = {
  getItem(key: string): string | null { try { return String(getUniRuntime().getStorageSync(key) || '') || null } catch { return null } },
  setItem(key: string, value: string): void { try { getUniRuntime().setStorageSync(key, value) } catch { /* Runtime not mounted yet. */ } },
  removeItem(key: string): void { getUniRuntime().removeStorageSync(key) },
}
export const mobileExperienceEngine = createAdaptivePerformanceEngine({ storage })
mobileExperienceEngine.restore()
export const mobileMotionMode = ref(storage.getItem('yx.mobile.motion') || 'FULL')
export function setMobileMotion(mode: string): void {
  const normalized = mode === 'REDUCED' || mode === 'OFF' ? mode : 'FULL'
  mobileMotionMode.value = normalized
  storage.setItem('yx.mobile.motion', normalized)
  mobileExperienceEngine.setMotionDisabled(normalized === 'OFF' || mobileExperienceEngine.state.reducedMotion)
}
export function setMobileQuality(level: PerformanceLevel): void { mobileExperienceEngine.setLevel(level, 'manual') }
export function restoreMobileQualityDefault(): PerformanceLevel {
  return mobileExperienceEngine.resetLevelToAutomatic().level
}
setMobileMotion(mobileMotionMode.value)

function syncMobileTabBar(): void {
  const theme = mobileThemeController.resolvedTheme
  const variables = mobileExperienceVariables(theme)
  uni.setTabBarStyle({ color: variables['--yx-text-secondary'], selectedColor: variables['--yx-brand'], backgroundColor: variables['--yx-surface-card'], borderStyle: theme === 'light' ? 'white' : 'black', fail: () => {} })
  const tabs = ['home', 'b2-practice', 'world', 'learn', 'profile']
  const icons = ['home', 'practice', 'world', 'learn', 'profile']
  tabs.forEach((page, index) => uni.setTabBarItem({ index, text: mobileT(`pages.${page}.short`), iconPath: `/static/navigation/${icons[index]}${theme === 'light' ? '' : '-dark'}.png`, selectedIconPath: `/static/navigation/${icons[index]}${theme === 'light' ? '-active' : '-dark-active'}.png`, fail: () => {} }))
}

/** Bind at each page root: native uni-app pages are not descendants of App.vue. */
export function useMobileExperience() {
  const theme = ref(mobileThemeController.resolvedTheme)
  const performance = ref(mobileExperienceEngine.state)
  const unsubscribeTheme = mobileThemeController.subscribe((state) => { theme.value = state.resolvedTheme; syncMobileTabBar() })
  const unsubscribePerformance = mobileExperienceEngine.subscribe((state) => { performance.value = state })
  onBeforeUnmount(() => { unsubscribeTheme(); unsubscribePerformance() })
  onShow(syncMobileTabBar)
  const experienceStyle = computed(() => mobileExperienceVariables(theme.value))
  const experienceMotion = computed(() => resolveMobileMotion(mobileMotionMode.value as 'FULL' | 'REDUCED' | 'OFF', performance.value))
  return { experienceStyle, experienceMotion }
}

export function backMobile(): void {
  if (typeof getCurrentPages === 'function' && getCurrentPages().length > 1) uni.navigateBack({ delta: 1 })
  else openUniPage('/pages/home/home')
}

/** uni-button is a custom element on H5; supply keyboard activation without affecting native taps. */
let keyboardInstalled = false
export function installMobileKeyboard(): void {
  if (typeof document === 'undefined' || keyboardInstalled) return
  keyboardInstalled = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!(target instanceof HTMLElement) || target.tagName !== 'UNI-BUTTON') return
    if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
    event.preventDefault()
    target.click()
  })
}
