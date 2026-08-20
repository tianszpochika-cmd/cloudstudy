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
    <text class="yx-eyebrow">PRACTICE HUB</text>
    <text class="yx-title">练习</text>
    <EmptyState title="练习中心等待题目契约" description="题目组件、评分和复习反馈会在对应契约与服务完成后接入。" />
  </view>
</template>
