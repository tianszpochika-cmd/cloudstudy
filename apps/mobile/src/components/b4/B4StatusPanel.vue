<script setup lang="ts">
import { B4_PERFORMANCE_LEVELS, type B4PerformanceLevel, type B4Status } from '../../domain/b4'

const props = withDefaults(defineProps<{
  status: B4Status
  online: boolean
  message?: string | null
  queueCount?: number
  performanceLevel: B4PerformanceLevel
}>(), { message: null, queueCount: 0 })

const emit = defineEmits<{
  retry: []
  sync: []
  performance: [level: B4PerformanceLevel]
}>()

function selectPerformance(event: { detail: { value: number } }): void {
  const level = B4_PERFORMANCE_LEVELS[event.detail.value]
  if (level) emit('performance', level)
}
</script>

<template>
  <view class="b4-mobile-status" :class="`b4-mobile-status--${status}`" role="status">
    <view class="b4-mobile-status__copy">
      <text class="b4-mobile-status__title">{{ online ? '网络可用' : '网络不可用' }} · {{ status === 'loading' ? '正在读取服务端数据' : 'B4 学习端状态' }}</text>
      <text class="b4-mobile-status__message">{{ message ?? (queueCount ? `本机有 ${queueCount} 条待同步事件；服务端确认前不会标记为完成。` : 'XP、游戏、房间和离线状态均以服务端响应为准。') }}</text>
    </view>
    <view class="b4-mobile-status__actions">
      <text v-if="queueCount" class="b4-mobile-status__queue">待同步 {{ queueCount }}</text>
      <button v-if="status === 'offline' || status === 'error'" class="b4-mini-button" type="button" @click="emit('retry')">重试</button>
      <button v-if="queueCount" class="b4-mini-button" type="button" @click="emit('sync')">同步</button>
      <picker :range="B4_PERFORMANCE_LEVELS" :value="B4_PERFORMANCE_LEVELS.indexOf(props.performanceLevel)" @change="selectPerformance">
        <view class="b4-quality-picker">{{ performanceLevel }}</view>
      </picker>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b4-mobile-status{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:24rpx;padding:22rpx;border:1rpx solid #e6e8f0;border-radius:18rpx;background:#fff}.b4-mobile-status--offline,.b4-mobile-status--error{border-color:#f3c7ce;background:#fff8f9}.b4-mobile-status__copy{display:grid;gap:8rpx;flex:1}.b4-mobile-status__title{font-size:27rpx;font-weight:700}.b4-mobile-status__message{color:#666d80;font-size:22rpx;line-height:1.55}.b4-mobile-status__actions{display:flex;align-items:center;justify-content:flex-end;gap:8rpx;flex-wrap:wrap}.b4-mobile-status__queue{color:#9b5b00;font-size:21rpx;font-weight:700}.b4-mini-button,.b4-quality-picker{min-height:60rpx;padding:0 16rpx;border:1rpx solid #d9dce7;border-radius:10rpx;color:#596bff;background:#fff;font-size:21rpx;line-height:60rpx}.b4-quality-picker{color:#666d80}@media(max-width:620px){.b4-mobile-status{display:grid}.b4-mobile-status__actions{justify-content:flex-start}}
</style>
