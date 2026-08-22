import { createSSRApp } from 'vue'
import App from './App.vue'
import './uni.scss'
import { mobileI18nAdapter, mobileThemeAdapter, mobileThemeController } from './platform/v2-foundation'
import { pinia } from './stores/pinia'

export function createApp() {
  mobileI18nAdapter.restore()
  mobileThemeController.restore()
  const app = createSSRApp(App)
  app.use(pinia)
  app.provide('i18n', mobileI18nAdapter)
  app.provide('theme', mobileThemeAdapter)
  return { app }
}
