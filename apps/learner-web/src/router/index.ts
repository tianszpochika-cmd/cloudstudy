import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { pinia } from '../stores/pinia'
import { useSessionStore } from '../stores/session'
import { isFeatureEnabled } from '../platform/feature-gates'
import { safeReturnTo } from '../auth/gateway-auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    shell?: boolean
    title?: string
    requiresAdultGate?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'welcome',
    redirect: { name: 'login' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../pages/HomePage.vue'),
    meta: { requiresAuth: true, shell: true, title: '学习首页' },
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('../pages/OnboardingPage.vue'),
    meta: { requiresAuth: true, title: '新手引导' },
  },
  {
    path: '/assessment',
    name: 'assessment',
    component: () => import('../pages/AssessmentPage.vue'),
    meta: { requiresAuth: true, title: '规则化测评' },
  },
  {
    path: '/today',
    name: 'today',
    component: () => import('../pages/TodayPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '今日任务' },
  },
  {
    path: '/vocabulary',
    name: 'vocabulary',
    component: () => import('../pages/VocabularyPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '词汇与 SRS' },
  },
  {
    path: '/learn/session',
    name: 'learn-session',
    component: () => import('../pages/LearnPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '继续学习' },
  },
  {
    path: '/learn',
    name: 'learn',
    component: () => import('../pages/LearningLoopPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '学习' },
  },
  {
    path: '/practice',
    name: 'b2-practice',
    component: () => import('../pages/B2PracticePage.vue'),
    meta: { requiresAuth: true, shell: true, title: '练习' },
  },
  {
    path: '/b2/report',
    name: 'b2-report',
    component: () => import('../pages/B2ReportPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '学习报告' },
  },
  {
    path: '/reports/weakness',
    name: 'weakness-report',
    component: () => import('../pages/B2ReportPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '错题与学习报告' },
  },
  {
    path: '/grammar',
    name: 'b3-grammar',
    component: () => import('../pages/B3GrammarPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '语法 X 光机' },
  },
  {
    path: '/writing',
    name: 'b3-writing',
    component: () => import('../pages/B3WritingPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '写作规则评测' },
  },
  {
    path: '/writing/practice',
    name: 'writing-practice',
    component: () => import('../pages/B3WritingPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '规则写作练习' },
  },
  {
    path: '/listening',
    name: 'b3-listening',
    component: () => import('../pages/B11ListeningPage.vue'),
    alias: ['/courses/listening', '/practice/listening', '/reports/listening', '/clips'],
    meta: { requiresAuth: true, shell: true, title: '听力精练' },
  },
  {
    path: '/reading',
    name: 'b3-reading',
    component: () => import('../pages/B11ReadingPage.vue'),
    alias: ['/courses/reading', '/practice/reading', '/reports/reading'],
    meta: { requiresAuth: true, shell: true, title: '分级阅读' },
  },
  {
    path: '/reader',
    name: 'reader',
    component: () => import('../pages/B11ReadingPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '沉浸阅读器' },
  },
  {
    path: '/speaking',
    name: 'b3-speaking',
    component: () => import('../pages/B11SpeakingPage.vue'),
    alias: ['/courses/speaking', '/phonetics', '/recording', '/practice/shadowing'],
    meta: { requiresAuth: true, shell: true, title: '口语自练' },
  },
  {
    path: '/world',
    name: 'world',
    component: () => import('../pages/B4WorldPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '世界' },
  },
  // Kept as a compatibility URL for old bookmarks. The visible first-run
  // experience is the single onboarding flow, not a separate gate page.
  { path: '/adult-gate', name: 'adult-gate', redirect: { name: 'onboarding' }, meta: { requiresAuth: true, title: '开始设置' } },
  { path: '/forbidden', name: 'forbidden', component: () => import('../pages/ForbiddenPage.vue'), meta: { requiresAuth: true, title: '访问权限' } },
  {
    path: '/commerce',
    name: 'commerce',
    component: () => import('../pages/B5CommercePage.vue'),
    meta: { requiresAuth: true, shell: true, title: '学习权益' },
  },
  {
    path: '/platform',
    name: 'platform',
    component: () => import('../pages/B6PlatformPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '端与性能' },
  },
  {
    path: '/courses',
    name: 'courses',
    component: () => import('../pages/CoursesPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '课程' },
  },
  {
    path: '/me',
    name: 'me',
    redirect: { name: 'settings', params: { section: 'profile' } },
    meta: { requiresAuth: true, shell: true, title: '我的' },
  },
  {
    path: '/settings',
    name: 'settings-root',
    redirect: { name: 'settings', params: { section: 'profile' } },
    meta: { requiresAuth: true, shell: true, title: '设置' },
  },
  {
    path: '/settings/:section',
    name: 'settings',
    component: () => import('../pages/SettingsPage.vue'),
    props: (route) => ({ section: typeof route.params.section === 'string' ? route.params.section : 'profile' }),
    meta: { requiresAuth: true, shell: true, title: '设置' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '页面不存在', description: '请返回学习首页，或从导航中选择一个可用入口。' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const session = useSessionStore(pinia)
  await session.restore()

  const preview = to.query.preview === '1' && isFeatureEnabled('learner.preview')

  if (to.meta.requiresAuth && !session.isAuthenticated && !preview) {
    session.setReturnTo(to.fullPath)
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && session.isAuthenticated) {
    return session.consumeReturnTo()
  }

  const adultGateExempt = new Set(['adult-gate', 'onboarding', 'forbidden'])
  if (to.meta.requiresAuth && !adultGateExempt.has(String(to.name)) && session.adultGate !== 'PASSED') {
    session.setReturnTo(to.fullPath)
    return { name: 'onboarding', query: { redirect: safeReturnTo(to.fullPath) } }
  }

  if (to.name === 'adult-gate' && session.adultGate === 'PASSED') return session.consumeReturnTo()

  return true
})
