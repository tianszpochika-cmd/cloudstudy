import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { pinia } from '../stores/pinia'
import { useSessionStore } from '../stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    shell?: boolean
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
    meta: { requiresAuth: true, shell: true },
  },
  {
    path: '/learn',
    name: 'learn',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '学习', description: '学习任务与课程将在学习契约接入后呈现。' },
    meta: { requiresAuth: true, shell: true },
  },
  {
    path: '/practice',
    name: 'practice',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '练习', description: '练习中心将在题目契约接入后呈现。' },
    meta: { requiresAuth: true, shell: true },
  },
  {
    path: '/world',
    name: 'world',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '世界', description: '学习地图与成长空间将在对应模块接入后呈现。' },
    meta: { requiresAuth: true, shell: true },
  },
  {
    path: '/courses',
    name: 'courses',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '课程', description: '课程内容将在内容契约接入后呈现。' },
    meta: { requiresAuth: true, shell: true },
  },
  {
    path: '/me',
    name: 'me',
    component: () => import('../pages/EmptyPage.vue'),
    props: { title: '我的', description: '个人设置与学习报告将在用户服务接入后呈现。' },
    meta: { requiresAuth: true, shell: true },
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

  if (to.meta.requiresAuth && !session.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && session.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})
