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
    <text class="yx-eyebrow">WORLD</text>
    <text class="yx-title">世界</text>
    <EmptyState title="成长空间等待接入" description="学习地图、成长反馈与轻社交入口会在后续模块中接入。" />
  </view>
</template>
