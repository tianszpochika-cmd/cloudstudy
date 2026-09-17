import { createApp } from 'vue'
import { router } from './router'
import { pinia } from './stores/pinia'
import App from './App.vue'
import './assets/styles/base.css'
import './assets/styles/theme.css'
import { learnerI18nAdapter, learnerThemeAdapter, learnerThemeController } from './platform/v2-foundation'

learnerI18nAdapter.restore()
learnerThemeController.restore()

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
