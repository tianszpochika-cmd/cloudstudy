import { createApp } from 'vue'
import { router } from './router'
import { pinia } from './stores/pinia'
import { useSessionStore } from './stores/session'
import { safeReturnTo } from './auth/gateway-auth'
import App from './App.vue'
import './theme/v2-tokens.scss'
import './assets/styles/base.css'
import './assets/styles/theme.css'
import './assets/styles/experience.css'
import './theme/v2-pages.scss'
import { experiencePerformance } from './platform/experience-ui'
import { learnerI18nAdapter, learnerThemeAdapter, learnerThemeController } from './platform/v2-foundation'
import { applyPublicAuthHandoff, resolvePublicAuthHandoff } from './platform/public-auth-handoff.mjs'

learnerI18nAdapter.restore()
learnerThemeController.restore()
if (typeof window !== 'undefined') {
  const handoff = resolvePublicAuthHandoff(window.location.pathname, window.location.search)
  applyPublicAuthHandoff(handoff, {
    setUiLocale: (locale) => learnerI18nAdapter.setLocale(locale),
    setTheme: (theme) => learnerThemeController.setTheme(theme),
  })
  const returnTo = safeReturnTo(handoff?.returnTo, '')
  if (returnTo) useSessionStore(pinia).setReturnTo(returnTo)
}
learnerI18nAdapter.subscribe(({ locale }) => {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
})
experiencePerformance.restore()
const syncPerformance = () => {
  document.documentElement.dataset.quality = experiencePerformance.level
  document.documentElement.dataset.motion = experiencePerformance.state.motionDisabled || experiencePerformance.level === 'Performance' ? 'off' : 'on'
}
experiencePerformance.subscribe(syncPerformance)
syncPerformance()

const app = createApp(App)

app.use(pinia)
app.use(router)
app.provide('i18n', learnerI18nAdapter)
app.provide('theme', learnerThemeAdapter)
app.config.errorHandler = (error, _instance, info) => {
  console.error(`[语学星] 未捕获的 Vue 错误：${info}`, error)
}

// Mount immediately so a slow/offline session restore never leaves a blank
// browser viewport. App.vue displays an accessible startup state until the
// router's guarded initial navigation settles.
app.mount('#app')
void router.isReady().catch((error) => {
  console.error('[语学星] 初始路由恢复失败。', error)
})
