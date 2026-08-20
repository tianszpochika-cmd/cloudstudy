<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useB1Store } from '../../stores/b1'

const b1 = useB1Store()

onShow(() => b1.restore())
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">ACCOUNT & PRIVACY</text>
    <text class="yx-title">设置</text>
    <view class="yx-card">
      <text class="setting-row">学习目标 <text>{{ b1.state.goal || '尚未设置' }}</text></text>
      <text class="setting-row">每日目标 <text>{{ b1.state.quota }} 分钟</text></text>
      <text class="setting-row">学习数据 <text>本地优先保存</text></text>
    </view>
  </view>
</template>

<style scoped>
.setting-row {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #e6e8f0;
  color: #666d80;
}

.setting-row text {
  color: #202332;
}
</style>
