<script setup lang="ts">
import { computed } from 'vue'
import type { PerformanceLevel } from '@englishflow/performance'
import type { B11Status } from '../../domain/b11'
import { b11T } from '../../platform/b11-foundation'

const props = withDefaults(defineProps<{ status: B11Status; message?: string | null; queueCount?: number; performanceLevel?: PerformanceLevel; motionDisabled?: boolean }>(), { message: null, queueCount: 0, performanceLevel: 'High', motionDisabled: false })
const emit = defineEmits<{ retry: []; sync: []; performance: [level: PerformanceLevel]; motion: [disabled: boolean] }>()
const levels: PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Performance']
const qualityKeys: Record<PerformanceLevel, string> = { Ultra: 'qualityUltra', High: 'qualityHigh', Medium: 'qualityMedium', Performance: 'qualityPerformance' }
const qualityLabels = computed(() => levels.map((level) => b11T(`status.${qualityKeys[level]}`)))
const qualityLabel = computed(() => qualityLabels.value[levels.indexOf(props.performanceLevel)] ?? qualityLabels.value[1])
const canRetry = computed(() => ['empty', 'offline', 'error', 'expired', 'forbidden'].includes(props.status))
function label(): string { return b11T(`status.${props.status}`) }
function defaultMessage(): string { return props.status === 'recovering' ? b11T('common.recovery') : props.status === 'empty' ? b11T('common.noSample') : '' }
const displayMessage = computed(() => {
  const message = props.message ?? defaultMessage()
  if (props.status === 'offline' && /^((网络|服务)暂时不可用|请求超时)，?请稍后重试。?$/.test(message)) return ''
  if (props.status === 'error' && /^服务暂时不可用，?请稍后重试。?$/.test(message)) return ''
  return message
})
</script>

<template>
  <view class="b11-status" :class="`b11-status--${status}`" role="status" aria-live="polite">
    <view v-if="status !== 'ready'" class="b11-status__state">
      <view class="b11-status__copy"><text class="b11-status__title">{{ label() }}</text><text v-if="displayMessage" class="b11-status__message">{{ displayMessage }}</text></view>
      <view v-if="queueCount || canRetry" class="b11-status__actions">
        <text v-if="queueCount" class="b11-status__queue">{{ b11T('common.pending') }} {{ queueCount }}</text>
        <button v-if="canRetry" tabindex="0" role="button" class="b11-mini-button" type="button" @click="emit('retry')">{{ b11T('status.retry') }}</button>
        <button v-if="queueCount" tabindex="0" role="button" class="b11-mini-button" type="button" @click="emit('sync')">{{ b11T('status.sync') }}</button>
      </view>
    </view>
    <view v-else class="b11-status__settings">
      <text v-if="message" class="b11-status__message">{{ message }}</text>
      <text v-if="queueCount" class="b11-status__queue">{{ b11T('common.pending') }} {{ queueCount }}</text>
      <button v-if="queueCount" tabindex="0" role="button" class="b11-mini-button" type="button" @click="emit('sync')">{{ b11T('status.sync') }}</button>
      <picker :range="qualityLabels" :value="levels.indexOf(performanceLevel)" @change="emit('performance', levels[Number($event.detail.value)] ?? 'High')"><view class="b11-quality">{{ b11T('status.quality') }}：{{ qualityLabel }} ▾</view></picker>
      <button tabindex="0" role="button" class="b11-mini-button" type="button" @click="emit('motion', !motionDisabled)">{{ motionDisabled ? b11T('status.motionOn') : b11T('status.motionOff') }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-status{margin-top:24rpx;padding:24rpx;border:1rpx solid var(--yx-border);border-radius:18rpx;background:var(--yx-surface-card)}
.b11-status--offline,.b11-status--error,.b11-status--expired{border-color:var(--yx-danger);background:var(--yx-danger-soft)}
.b11-status--forbidden{border-color:var(--yx-warning);background:var(--yx-warning-soft)}
.b11-status__state{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.b11-status__copy{display:grid;gap:8rpx;flex:1}.b11-status__title{font-size:28rpx;font-weight:700}.b11-status__message{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b11-status__actions,.b11-status__settings{display:flex;align-items:center;gap:10rpx;flex-wrap:wrap;justify-content:flex-end}.b11-status__queue{color:var(--yx-warning-strong);font-size:21rpx;font-weight:700}.b11-mini-button,.b11-quality{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.b11-quality{color:var(--yx-text-secondary)}
@media(max-width:620px){.b11-status__state{display:grid}.b11-status__actions,.b11-status__settings{justify-content:flex-start}}
</style>
