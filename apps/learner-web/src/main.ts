import { createApp } from 'vue'
import { router } from './router'
import { pinia } from './stores/pinia'
import App from './App.vue'
import './assets/styles/base.css'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.config.errorHandler = (error, _instance, info) => {
  console.error(`[语学星] 未捕获的 Vue 错误：${info}`, error)
}

void router.isReady().then(() => {
  app.mount('#app')
})
