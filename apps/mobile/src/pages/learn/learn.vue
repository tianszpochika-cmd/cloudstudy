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
    <text class="yx-eyebrow">LEARNING FLOW</text>
    <text class="yx-title">学习流</text>
    <EmptyState title="学习内容等待接入" description="这里将承载目标、练习、反馈和复习的连续学习流。" />
  </view>
</template>
