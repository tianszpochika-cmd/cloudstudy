import { createApp } from 'vue'
import { router } from './router'
import { pinia } from './stores/pinia'
import App from './App.vue'
import './assets/styles/base.css'
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

void router.isReady().then(() => {
  app.mount('#app')
})
