import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { router } from './router'
import { pinia } from './stores/admin'
import App from './App.vue'
import './styles.css'
import { adminI18nAdapter, adminThemeAdapter, adminThemeController } from './platform/v2-foundation'

adminI18nAdapter.restore()
adminThemeController.restore()

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.provide('i18n', adminI18nAdapter)
app.provide('theme', adminThemeAdapter)
void router.isReady().then(() => app.mount('#app'))
