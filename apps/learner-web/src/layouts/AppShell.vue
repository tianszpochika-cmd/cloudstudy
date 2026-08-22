<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { useSessionStore } from '../stores/session'
import { authT } from '../auth/i18n'

const route = useRoute()
const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const showPerformanceMenu = ref(false)
const unsubscribe = engine.subscribe((state) => {
  performanceLevel.value = state.level
})

const navItems = [
  { name: 'home', label: '学习', icon: '⌂' },
  { name: 'vocabulary', label: '词汇', icon: 'Aa' },
  { name: 'b2-practice', label: '练习', icon: '✓' },
  { name: 'b2-report', label: '报告', icon: '▥' },
  { name: 'b3-grammar', label: '语法', icon: '⌘' },
  { name: 'b3-writing', label: '写作', icon: '✎' },
  { name: 'b3-listening', label: '听力', icon: '◖' },
  { name: 'b3-reading', label: '阅读', icon: '▥' },
  { name: 'b3-speaking', label: '口语', icon: '◌' },
  { name: 'world', label: '世界', icon: '✧' },
  { name: 'commerce', label: '权益', icon: '◈' },
  { name: 'courses', label: '课程', icon: '▤' },
  { name: 'me', label: '我的', icon: '◎' },
] as const

const pageTitle = computed(() => String(route.meta.title ?? navItems.find((item) => item.name === route.name)?.label ?? '学习'))

function choosePerformance(level: PerformanceLevel): void {
  engine.setLevel(level, 'manual')
  showPerformanceMenu.value = false
}

async function signOut(): Promise<void> {
  await session.logout()
}

onMounted(() => {
  engine.restore()
})

onUnmounted(() => {
  unsubscribe()
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
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          class="nav-item"
          :to="{ name: item.name }"
          :aria-label="item.label"
        >
          <span class="nav-item__icon" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
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
        <button class="sign-out" type="button" @click="signOut">{{ authT('session.logout') }}</button>
      </div>
    </aside>

    <main class="app-shell__main">
      <header class="topbar">
        <div>
          <p class="eyebrow">LEARNING SPACE</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar__status" aria-label="当前会话状态">
          <span class="status-dot status-dot--success" aria-hidden="true"></span>
          <span>{{ session.status === 'authenticated' ? authT('session.restored') : authT('session.restoring') }}</span>
        </div>
      </header>

      <div class="app-shell__content">
        <RouterView v-slot="{ Component }">
          <KeepAlive>
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </div>
    </main>

    <nav class="mobile-tabbar" aria-label="移动端主导航">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        class="mobile-tabbar__item"
        :to="{ name: item.name }"
        :aria-label="item.label"
      >
        <span aria-hidden="true">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
