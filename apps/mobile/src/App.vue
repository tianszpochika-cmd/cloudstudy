<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { bootstrapMobileAuth, bridgeMobileH5OidcCallback, currentMobilePagePath, installMobileNavigationGuard, normalizeMobilePagePath } from './auth/navigation'
import { useSessionStore } from './stores/session'

const session = useSessionStore()
const bootstrapReady = ref(false)

onLaunch((options) => {
  installMobileNavigationGuard()
  if (bridgeMobileH5OidcCallback()) {
    bootstrapReady.value = true
    return
  }
  const launchPath = normalizeMobilePagePath(options?.path, '/pages/home/home')
  const initialPath = currentMobilePagePath(launchPath)
  void bootstrapMobileAuth(initialPath).finally(() => {
    bootstrapReady.value = true
  })
})
</script>

<template>
  <view v-if="!bootstrapReady" class="yx-app-bootstrap" aria-live="polite">
    <text class="yx-app-bootstrap__title">{{ session.status === 'restoring' ? '正在恢复安全会话…' : '正在准备学习空间…' }}</text>
    <text class="yx-app-bootstrap__description">未完成身份校验前不会渲染受保护学习内容。</text>
  </view>
  <slot v-else />
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
.yx-app-bootstrap__title { font-size: 34rpx; font-weight: 700; }
.yx-app-bootstrap__description { margin-top: 16rpx; color: var(--yx-text-secondary, #666d80); font-size: 24rpx; line-height: 1.6; }
</style>
