<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, ref } from 'vue'
import { bootstrapMobileAuth, currentMobilePagePath, installMobileNavigationGuard, normalizeMobilePagePath } from './auth/navigation'
import { useSessionStore } from './stores/session'
import { mobileExperienceVariables } from '@englishflow/design-tokens/mobile'
import { mobileThemeController } from './platform/v2-foundation'

const session = useSessionStore()
const bootstrapReady = ref(false)
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
const themeVariables = ref<Record<string, string>>({ ...mobileThemeController.getVariables() })
const themeClass = computed(() => `b10-theme--${resolvedTheme.value}`)
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
  void bootstrapMobileAuth(initialPath).finally(() => {
    bootstrapReady.value = true
  })
})

onBeforeUnmount(unsubscribeTheme)
</script>

<template>
  <view v-if="!bootstrapReady" class="yx-app-bootstrap" :class="themeClass" :style="themeVariables" aria-live="polite">
    <text class="yx-app-bootstrap__title">{{ session.status === 'restoring' ? '正在恢复安全会话…' : '正在准备学习空间…' }}</text>
    <text class="yx-app-bootstrap__description">正在为你打开学习空间，请稍候。</text>
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
.yx-app-bootstrap__description { margin-top: 16rpx; color: var(--yx-text-secondary, #666d80); font-size: 24rpx; line-height: 1.6; }
</style>
