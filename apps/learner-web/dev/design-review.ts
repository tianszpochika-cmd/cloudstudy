/** Development-only visual review. Never included by the production index.html.
 * No tokens, real accounts, durable learning records, or external writes.
 */
import { installReviewTransport } from './review-fixtures'
if (!import.meta.env.DEV) throw new Error('Design review is development-only')
installReviewTransport()
const [{ createApp, h }, { createRouter, createWebHashHistory }, { routes }, { pinia }, { default: App }, foundation, { experiencePerformance }] = await Promise.all([
  import('vue'), import('vue-router'), import('../src/router'), import('../src/stores/pinia'), import('../src/App.vue'), import('../src/platform/v2-foundation'), import('../src/platform/experience-ui'),
])
await import('../src/assets/styles/base.css')
await import('../src/assets/styles/theme.css')
await import('../src/assets/styles/experience.css')
const router = createRouter({ history: createWebHashHistory(), routes, scrollBehavior: () => ({ top: 0 }) })
foundation.learnerThemeController.setTheme(new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light')
const syncMotion = () => { document.documentElement.dataset.motion = experiencePerformance.state.motionDisabled || experiencePerformance.level === 'Performance' ? 'off' : 'on' }
experiencePerformance.subscribe(syncMotion); syncMotion()
createApp({ render: () => h('div', [h('div', { class: 'design-review-note', role: 'note' }, [h('strong', '界面预览 · 示例数据'), h('span', '操作不写入真实账号'), h('a', { href: '/' }, '前往真实应用 →')]), h(App)]) }).use(pinia).use(router).mount('#app')
if (!location.hash || location.hash === '#/') await router.replace('/home')
