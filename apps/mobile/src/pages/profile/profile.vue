<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '../../components/EmptyState.vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { authT } from '../../auth/i18n'

const session = useSessionStore()

onShow(() => {
  session.restore()
  if (!session.isAuthenticated) {
    getUniRuntime().navigateTo({ url: '/pages/login/login' })
  }
})
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">PROFILE</text>
    <text class="yx-title">我的</text>
    <navigator class="yx-card b6-profile-entry" url="/pages/b6-platform/b6-platform"><text>端与性能验收</text><text class="b6-profile-entry__hint">跨端矩阵、画质降级和无障碍基线</text></navigator>
    <EmptyState title="个人服务等待接入" description="报告、设置、隐私和同步状态会从用户服务契约加载。" />
    <button v-if="session.isAuthenticated" class="yx-button" type="button" @click="session.logout">{{ authT('session.logout') }}</button>
  </view>
</template>

<style scoped>
.b6-profile-entry{display:flex;flex-direction:column;gap:8rpx;color:#202332;font-size:30rpx;font-weight:600}.b6-profile-entry__hint{color:#666d80;font-size:24rpx;font-weight:400}
</style>
