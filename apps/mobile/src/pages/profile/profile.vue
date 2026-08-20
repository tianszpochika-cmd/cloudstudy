<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '../../components/EmptyState.vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

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
    <EmptyState title="个人服务等待接入" description="报告、设置、隐私和同步状态会从用户服务契约加载。" />
  </view>
</template>
