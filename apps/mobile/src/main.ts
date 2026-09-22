import { createSSRApp } from 'vue'
import App from './App.vue'
import { installMobileKeyboard } from './platform/experience'
import { installUniPageLifecycle } from './compat/page-lifecycle'
import './uni.scss'
import { mobileI18nAdapter, mobileThemeAdapter, mobileThemeController } from './platform/v2-foundation'
import { pinia } from './stores/pinia'

export function createApp() {
  mobileI18nAdapter.restore()
  mobileThemeController.restore()
  installMobileKeyboard()
  const app = createSSRApp(App)
  // #ifdef H5
  installUniPageLifecycle(app)
  // #endif
  app.use(pinia)
  app.provide('i18n', mobileI18nAdapter)
  app.provide('theme', mobileThemeAdapter)
  return { app }
}
