<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { siteNavigation } from '~/utils/site-content.mjs'
import { officialI18n, officialI18nAdapter, officialThemeController } from '~/utils/v2-foundation'

const route = useRoute()
const { authLink } = useOfficialSiteLinks()
const isMenuOpen = ref(false)
const uiLocale = ref(officialI18nAdapter.state.locale)
// Keep the SSR first frame deterministic; the no-flash bootstrap and the
// mounted hook then apply the user's stored/system theme without hydration
// text or attribute mismatches.
const resolvedTheme = ref<'light' | 'dark' | 'high-contrast'>('light')
const isMounted = ref(false)
const unsubscribeLocale = officialI18nAdapter.subscribe((state) => { uiLocale.value = state.locale })
const unsubscribeTheme = officialThemeController.subscribe((state) => {
  if (isMounted.value) resolvedTheme.value = state.resolvedTheme
})

const loginLink = computed(() => authLink('/home'))
const loginLabel = computed(() => officialI18n.t('auth.login.start', undefined, { locale: uiLocale.value }))
const loginTitle = computed(() => officialI18n.t('auth.login.publicOnly', undefined, { locale: uiLocale.value }))
const themeLabel = computed(() => resolvedTheme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式')

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

function closeMenu() {
  isMenuOpen.value = false
}

function toggleTheme() {
  officialThemeController.setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark')
}

watch(() => route.fullPath, closeMenu)
onMounted(() => {
  isMounted.value = true
  resolvedTheme.value = officialThemeController.resolvedTheme
})
onBeforeUnmount(unsubscribeLocale)
onBeforeUnmount(unsubscribeTheme)
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <NuxtLink class="brand" to="/" aria-label="语学星首页" @click="closeMenu">
        <span class="brand-mark" aria-hidden="true">语</span>
        <span class="brand-copy">
          <strong>语学星</strong>
          <small>ENGLISHFLOW</small>
        </span>
      </NuxtLink>

      <button
        class="mobile-nav-toggle"
        type="button"
        :aria-expanded="isMenuOpen"
        aria-controls="official-site-nav"
        aria-label="打开导航菜单"
        @click="isMenuOpen = !isMenuOpen"
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </button>

      <nav id="official-site-nav" class="site-nav" :class="{ 'is-open': isMenuOpen }" aria-label="官网主导航">
        <NuxtLink
          v-for="item in siteNavigation"
          :key="item.to"
          class="nav-link"
          :class="{ 'is-active': isActive(item.to) }"
          :to="item.to"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          @click="closeMenu"
        >
          {{ item.label }}
        </NuxtLink>
        <button class="header-control" type="button" :aria-label="themeLabel" :title="themeLabel" @click="toggleTheme">
          <span class="header-control__icon" aria-hidden="true">{{ resolvedTheme === 'dark' ? '☀' : '◐' }}</span>
          <span>{{ resolvedTheme === 'dark' ? '浅色' : '深色' }}</span>
        </button>
        <a class="button button-small button-primary nav-cta" :href="loginLink" :title="loginTitle" @click="closeMenu">{{ loginLabel }}</a>
      </nav>
    </div>
  </header>
</template>
