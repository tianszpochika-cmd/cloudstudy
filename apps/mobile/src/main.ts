import { createSSRApp } from 'vue'
import App from './App.vue'
import { installMobileKeyboard } from './platform/experience'
import { installUniPageLifecycle } from './compat/page-lifecycle'
import './uni.scss'
import { mobileI18nAdapter, mobileThemeAdapter, mobileThemeController } from './platform/v2-foundation'
import { pinia } from './stores/pinia'
// #ifdef H5
import { uni as h5Uni } from '@dcloudio/uni-h5'
// #endif

export function createApp() {
  // #ifdef H5
  // The production global can be empty while the dev global already has
  // read-only getters. Add only missing official APIs before app setup.
  const browserRuntime = globalThis as typeof globalThis & { uni?: Record<string, unknown> }
  const existingUni = browserRuntime.uni ?? {}
  for (const [name, value] of Object.entries(h5Uni)) {
    if (existingUni[name] !== undefined) continue
    const descriptor = Object.getOwnPropertyDescriptor(existingUni, name)
    if (descriptor && !descriptor.configurable) continue
    Object.defineProperty(existingUni, name, { value, writable: true, enumerable: true, configurable: true })
  }
  browserRuntime.uni = existingUni
  // #endif
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
