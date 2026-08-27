<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { siteNavigation } from '~/utils/site-content.mjs'
import { officialI18n, officialI18nAdapter } from '~/utils/v2-foundation'

const route = useRoute()
const { authLink } = useOfficialSiteLinks()
const isMenuOpen = ref(false)
const uiLocale = ref(officialI18nAdapter.state.locale)
const unsubscribeLocale = officialI18nAdapter.subscribe((state) => { uiLocale.value = state.locale })

const loginLink = computed(() => authLink('/home'))
const loginLabel = computed(() => officialI18n.t('auth.login.start', undefined, { locale: uiLocale.value }))
const loginTitle = computed(() => officialI18n.t('auth.login.publicOnly', undefined, { locale: uiLocale.value }))

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

function closeMenu() {
  isMenuOpen.value = false
}

watch(() => route.fullPath, closeMenu)
onBeforeUnmount(unsubscribeLocale)
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
        <a class="button button-small button-primary nav-cta" :href="loginLink" :title="loginTitle" @click="closeMenu">{{ loginLabel }}</a>
      </nav>
    </div>
  </header>
</template>
