<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { useSessionStore } from '../stores/session'
import { authT } from '../auth/i18n'
import AppIcon, { type AppIconName } from '../components/AppIcon.vue'
import { learnerThemeController } from '../platform/v2-foundation'

const route = useRoute()
const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const showPerformanceMenu = ref(false)
const showNotifications = ref(false)
const resolvedTheme = ref(learnerThemeController.resolvedTheme)
const unsubscribe = engine.subscribe((state) => {
  performanceLevel.value = state.level
})
const unsubscribeTheme = learnerThemeController.subscribe((state) => {
  resolvedTheme.value = state.resolvedTheme
})

const navGroups: Array<{ label: string; items: Array<{ name: string; label: string; icon: AppIconName }> }> = [
  { label: '学习', items: [{ name: 'home', label: '学习首页', icon: 'home' }, { name: 'today', label: '今日任务', icon: 'target' }, { name: 'learn', label: '学习流', icon: 'book' }, { name: 'messages', label: '消息中心', icon: 'help' }] },
  { label: '练习', items: [{ name: 'b2-practice', label: '练习中心', icon: 'check' }, { name: 'vocabulary', label: '词汇与 SRS', icon: 'star' }, { name: 'mistakes', label: '错题本', icon: 'search' }, { name: 'mastery', label: '掌握度', icon: 'chart' }, { name: 'plan-map', label: '计划地图', icon: 'target' }, { name: 'b2-report', label: '学习报告', icon: 'chart' }, { name: 'b3-grammar', label: '语法 X 光机', icon: 'spark' }, { name: 'b3-writing', label: '规则写作', icon: 'pen' }, { name: 'b3-listening', label: '听力精练', icon: 'headphones' }, { name: 'b3-reading', label: '分级阅读', icon: 'book' }, { name: 'b3-speaking', label: '口语自练', icon: 'mic' }] },
  { label: '探索', items: [{ name: 'world', label: '世界', icon: 'globe' }, { name: 'courses', label: '课程', icon: 'book' }, { name: 'commerce', label: '学习权益', icon: 'wallet' }, { name: 'support', label: '客服与帮助', icon: 'help' }] },
]
const navItems = navGroups.flatMap((group) => group.items)
const mobileNavItems = [
  { name: 'home', label: '学习', icon: 'home' as AppIconName },
  { name: 'b2-practice', label: '练习', icon: 'check' as AppIconName },
  { name: 'world', label: '世界', icon: 'globe' as AppIconName },
  { name: 'courses', label: '课程', icon: 'book' as AppIconName },
  { name: 'me', label: '我的', icon: 'user' as AppIconName },
]

const pageTitle = computed(() => String(route.meta.title ?? navItems.find((item) => item.name === route.name)?.label ?? '学习'))
const themeLabel = computed(() => resolvedTheme.value === 'dark' ? '切换到浅色' : '切换到深色')
const themeIcon = computed<AppIconName>(() => resolvedTheme.value === 'dark' ? 'spark' : 'moon')

function choosePerformance(level: PerformanceLevel): void {
  engine.setLevel(level, 'manual')
  showPerformanceMenu.value = false
}

function toggleTheme(): void {
  learnerThemeController.setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark')
}

async function signOut(): Promise<void> {
  await session.logout()
}

onMounted(() => {
  engine.restore()
})

onUnmounted(() => {
  unsubscribe()
  unsubscribeTheme()
  engine.dispose()
})
</script>

<template>
  <div class="app-shell">
    <aside class="app-shell__sidebar" aria-label="主导航">
      <RouterLink class="brand" to="/home" aria-label="语学星学习首页">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </RouterLink>

      <nav class="nav-list">
        <div v-for="group in navGroups" :key="group.label" class="nav-group">
          <p class="nav-group__label">{{ group.label }}</p>
          <RouterLink v-for="item in group.items" :key="item.name" class="nav-item" :to="{ name: item.name }" :aria-label="item.label">
            <span class="nav-item__icon"><AppIcon :name="item.icon" /></span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="performance-control" type="button" @click="showPerformanceMenu = !showPerformanceMenu">
          <span class="status-dot" aria-hidden="true"></span>
          <span>画质 {{ performanceLevel }}</span>
          <span aria-hidden="true">⌄</span>
        </button>
        <div v-if="showPerformanceMenu" class="performance-menu" role="menu">
          <button
            v-for="level in ['Ultra', 'High', 'Medium', 'Performance'] as PerformanceLevel[]"
            :key="level"
            class="performance-menu__item"
            type="button"
            role="menuitem"
            :aria-pressed="performanceLevel === level"
            @click="choosePerformance(level)"
          >
            {{ level }}
          </button>
        </div>
        <button class="sign-out" type="button" @click="signOut">{{ authT('session.logoutAction') }}</button>
      </div>
    </aside>

    <main class="app-shell__main">
      <header class="topbar">
        <div class="topbar__title">
          <p class="eyebrow">LEARNING SPACE</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar__actions">
          <label class="topbar-search">
            <AppIcon name="search" :size="17" />
            <input type="search" placeholder="搜索课程、练习或词汇" aria-label="搜索课程、练习或词汇" />
          </label>
          <button class="icon-button" type="button" :aria-label="themeLabel" @click="toggleTheme"><AppIcon :name="themeIcon" :size="18" /></button>
          <button class="icon-button icon-button--notification" type="button" aria-label="查看通知" :aria-expanded="showNotifications" @click="showNotifications = !showNotifications"><span class="notification-dot"></span><span class="icon-button__glyph"><AppIcon name="spark" :size="18" /></span></button>
          <RouterLink class="profile-chip" :to="{ name: 'settings', params: { section: 'profile' } }" aria-label="打开我的设置"><span class="profile-chip__avatar">语</span><span class="profile-chip__copy"><strong>学习者</strong><small>{{ session.status === 'authenticated' ? '状态正常' : '恢复中' }}</small></span></RouterLink>
        </div>
        <div v-if="showNotifications" class="notification-popover" role="status">
          <div><strong>学习提醒</strong><span>你的下一次复习会在完成今日任务后出现。</span></div>
          <button type="button" @click="showNotifications = false">知道了</button>
        </div>
      </header>

      <div class="app-shell__content">
        <!-- AppShell wraps top-level routes; the page component is supplied by
             App.vue's outer RouterView and must be rendered through the slot. -->
        <slot />
      </div>
    </main>

    <nav class="mobile-tabbar" aria-label="移动端主导航">
      <RouterLink
        v-for="item in mobileNavItems"
        :key="item.name"
        class="mobile-tabbar__item"
        :to="{ name: item.name }"
        :aria-label="item.label"
      >
        <AppIcon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
