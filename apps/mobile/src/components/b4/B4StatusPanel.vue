<script setup lang="ts">
import { computed } from 'vue'
import { B4_PERFORMANCE_LEVELS, type B4PerformanceLevel, type B4Status } from '../../domain/b4'
import { mobileT } from '../../platform/experience'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileI18n } from '../../platform/v2-foundation'

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

const qualityKeys: Record<B4PerformanceLevel, string> = {
  Ultra: 'qualityUltra', High: 'qualityHigh', Medium: 'qualityMedium', Performance: 'qualityPerformance',
}
const qualityFallbacks: Record<'zh-CN' | 'en-US', Record<B4PerformanceLevel, string>> = {
  'zh-CN': { Ultra: '精致', High: '舒适', Medium: '轻量', Performance: '省资源' },
  'en-US': { Ultra: 'Detailed', High: 'Balanced', Medium: 'Light', Performance: 'Efficient' },
}
function qualityLabel(level: B4PerformanceLevel): string {
  const key = `mobile.${qualityKeys[level]}`
  const translated = mobileT(qualityKeys[level])
  return translated === key ? qualityFallbacks[mobileI18n.locale.startsWith('en') ? 'en-US' : 'zh-CN'][level] : translated
}
const qualityLabels = computed(() => B4_PERFORMANCE_LEVELS.map(qualityLabel))

function selectPerformance(event: { detail: { value: number } }): void {
  const level = B4_PERFORMANCE_LEVELS[event.detail.value]
  if (level) emit('performance', level)
}

function openLogin(): void { openUniPage('/pages/login/login') }
</script>

<template>
  <view class="b4-mobile-status" :class="`b4-mobile-status--${status}`" role="status">
    <view class="b4-mobile-status__copy">
      <text class="b4-mobile-status__title">{{ online ? '网络可用' : '网络不可用' }} · {{ status === 'loading' ? '正在加载成长记录' : '学习同步状态' }}</text>
      <text class="b4-mobile-status__message">{{ message ?? (queueCount ? `本机有 ${queueCount} 条待同步记录，联网后可继续同步。` : '成长记录会随学习进度更新。') }}</text>
    </view>
    <view class="b4-mobile-status__actions">
      <text v-if="queueCount" class="b4-mobile-status__queue">待同步 {{ queueCount }}</text>
      <button tabindex="0" role="button" v-if="status === 'offline' || status === 'error'" class="b4-mini-button" type="button" @click="emit('retry')">重试</button>
      <button tabindex="0" role="button" v-if="status === 'permission'" class="b4-mini-button" type="button" @click="openLogin">去登录</button>
      <button tabindex="0" role="button" v-if="queueCount" class="b4-mini-button" type="button" @click="emit('sync')">同步</button>
      <picker :range="qualityLabels" :value="B4_PERFORMANCE_LEVELS.indexOf(props.performanceLevel)" @change="selectPerformance">
        <view class="b4-quality-picker">{{ qualityLabel(performanceLevel) }}</view>
      </picker>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b4-mobile-status{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:24rpx;padding:22rpx;border:1rpx solid var(--yx-border);border-radius:18rpx;background:var(--yx-surface-card)}.b4-mobile-status--offline,.b4-mobile-status--error{border-color:var(--yx-danger);background:var(--yx-surface-page)}.b4-mobile-status__copy{display:grid;gap:8rpx;flex:1}.b4-mobile-status__title{font-size:27rpx;font-weight:700}.b4-mobile-status__message{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.b4-mobile-status__actions{display:flex;align-items:center;justify-content:flex-end;gap:8rpx;flex-wrap:wrap}.b4-mobile-status__queue{color:var(--yx-warning);font-size:21rpx;font-weight:700}.b4-mini-button,.b4-quality-picker{min-height:60rpx;padding:0 16rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:21rpx;line-height:60rpx}.b4-quality-picker{color:var(--yx-text-secondary)}@media(max-width:620px){.b4-mobile-status{display:grid}.b4-mobile-status__actions{justify-content:flex-start}}
</style>
