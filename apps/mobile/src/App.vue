<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, ref } from 'vue'
import { bootstrapMobileAuth, currentMobilePagePath, installMobileNavigationGuard, normalizeMobilePagePath } from './auth/navigation'
import { safeMobileReturnTo } from './auth/gateway-auth'
import { useSessionStore } from './stores/session'
import { mobileExperienceVariables } from '@englishflow/design-tokens/mobile'
import { mobileI18nAdapter, mobileThemeController } from './platform/v2-foundation'
import { applyMobilePublicAuthHandoff, mobilePublicAuthQuery, resolveMobilePublicAuthHandoff } from './platform/public-auth-handoff.mjs'

const session = useSessionStore()
const bootstrapReady = ref(false)
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
const themeVariables = ref<Record<string, string>>({ ...mobileThemeController.getVariables() })
const themeClass = computed(() => `b10-theme--${resolvedTheme.value}`)
const unsubscribeDocumentLocale = mobileI18nAdapter.subscribe(({ locale }) => {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
})
function syncTheme(state = mobileThemeController.state): void {
  resolvedTheme.value = state.resolvedTheme
  themeVariables.value = { ...state.variables, ...mobileExperienceVariables(state.resolvedTheme) }
  uni.setTabBarStyle?.({ color: themeVariables.value['--yx-text-secondary'], selectedColor: themeVariables.value['--yx-brand'], backgroundColor: themeVariables.value['--yx-surface-card'], borderStyle: state.resolvedTheme === 'light' ? 'white' : 'black', fail: () => { /* Public auth pages have no tab bar. */ } })
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = state.resolvedTheme
    for (const [name, value] of Object.entries(themeVariables.value)) document.documentElement.style.setProperty(name, value)
  }
}
syncTheme()
const unsubscribeTheme = mobileThemeController.subscribe(syncTheme)

onLaunch((options) => {
  installMobileNavigationGuard()
  const launchPath = normalizeMobilePagePath(options?.path, '/pages/home/home')
  const initialPath = currentMobilePagePath(launchPath)
  const query = mobilePublicAuthQuery({
    launchQuery: options?.query,
    search: typeof window !== 'undefined' ? window.location.search : '',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
  })
  const handoff = resolveMobilePublicAuthHandoff(initialPath, query)
  applyMobilePublicAuthHandoff(handoff, {
    setUiLocale: (locale) => mobileI18nAdapter.setLocale(locale),
    setTheme: (theme) => mobileThemeController.setTheme(theme),
  })
  const returnTo = safeMobileReturnTo(handoff?.returnTo, '')
  if (returnTo) session.setReturnTo(returnTo)
  void bootstrapMobileAuth(initialPath).finally(() => {
    bootstrapReady.value = true
  })
})

onBeforeUnmount(() => {
  unsubscribeTheme()
  unsubscribeDocumentLocale()
})
</script>

<template>
  <view v-if="!bootstrapReady" class="yx-app-bootstrap" :class="themeClass" :style="themeVariables" aria-live="polite">
    <text class="yx-app-bootstrap__title">{{ session.status === 'restoring' ? '正在恢复安全会话…' : '正在准备学习空间…' }}</text>
  </view>
  <view v-else class="yx-app" :class="themeClass" :style="themeVariables">
    <slot />
  </view>
</template>

<style scoped>
.yx-app-bootstrap {
  display: flex;
  min-height: 100vh;
  box-sizing: border-box;
  flex-direction: column;
  justify-content: center;
  padding: calc(48rpx + env(safe-area-inset-top)) 48rpx calc(48rpx + env(safe-area-inset-bottom));
  color: var(--yx-text-primary, #202332);
  background: var(--yx-surface-page, #f7f8fc);
}
.yx-app {
  min-height: 100vh;
  color: var(--yx-text-primary, #202332);
  background: var(--yx-surface-page, #f7f8fc);
}
.yx-app-bootstrap__title { font-size: 34rpx; font-weight: 700; }
</style>

<style lang="scss">
/* Consistent "coming soon" treatment: a visible badge plus a concrete reason.
   A closed practice card replaces the page body, so the dead player/status UI after it is hidden. */
.yx-soon-badge{display:inline-block;margin-left:12rpx;padding:2rpx 14rpx;border-radius:999rpx;background:var(--yx-warning-soft, rgba(245,158,11,.16));color:var(--yx-warning, #b45309);font-size:22rpx;font-weight:700;vertical-align:middle}
.yx-soon-reason{display:block;margin-top:8rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.55}
[data-closed-practice] ~ *{display:none !important}

@import "./theme/v2-tokens.scss";
</style>
