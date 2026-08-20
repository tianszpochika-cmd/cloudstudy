import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { pinia } from '../stores/pinia'
import { useSessionStore } from '../stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    shell?: boolean
    title?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'welcome',
    component: () => import('../pages/WelcomePage.vue'),
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
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '学习', description: '学习任务与课程将在学习契约接入后呈现。' },
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
    path: '/listening',
    name: 'b3-listening',
    component: () => import('../pages/B3ListeningPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '听力精练' },
  },
  {
    path: '/reading',
    name: 'b3-reading',
    component: () => import('../pages/B3ReadingPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '分级阅读' },
  },
  {
    path: '/speaking',
    name: 'b3-speaking',
    component: () => import('../pages/B3SpeakingPage.vue'),
    meta: { requiresAuth: true, shell: true, title: '口语自练' },
  },
  {
    path: '/world',
    name: 'world',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '世界', description: '学习地图与成长空间将在对应模块接入后呈现。' },
    meta: { requiresAuth: true, shell: true, title: '世界' },
  },
  {
    path: '/courses',
    name: 'courses',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '课程', description: '课程内容将在内容契约接入后呈现。' },
    meta: { requiresAuth: true, shell: true, title: '课程' },
  },
  {
    path: '/me',
    name: 'me',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '我的', description: '个人设置与学习报告将在用户服务接入后呈现。' },
    meta: { requiresAuth: true, shell: true, title: '我的' },
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

router.beforeEach((to) => {
  const session = useSessionStore(pinia)
  session.restore()

  const preview = to.query.preview === '1'

  if (to.meta.requiresAuth && !session.isAuthenticated && !preview) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && session.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})
