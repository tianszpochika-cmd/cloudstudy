<script setup lang="ts">
import type { B10PerformanceLevel, B10Status } from '../../domain/b10'
import { b10T } from '../../platform/b10-foundation'
import { openUniPage } from '../../platform/uni-runtime'

const props = withDefaults(defineProps<{
  status: B10Status
  message?: string | null
  queueCount?: number
  performanceLevel?: B10PerformanceLevel
  stale?: boolean
}>(), { message: null, queueCount: 0, performanceLevel: 'High', stale: false })

const emit = defineEmits<{ retry: []; sync: []; performance: [level: B10PerformanceLevel] }>()
const levels: B10PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Performance']
const statusLabel = (): string => b10T(`status.${props.status}`)
const statusMessage = (): string => props.message ?? (props.status === 'offline' ? b10T('status.pending') : props.status === 'stale' || props.stale ? b10T('common.stale') : b10T('status.noSample'))
function openLogin(): void { openUniPage('/pages/login/login') }
</script>

<template>
  <view class="b10-status" :class="`b10-status--${status}`" role="status" aria-live="polite">
    <view class="b10-status__copy">
      <text class="b10-status__title">{{ statusLabel() }}</text>
      <text class="b10-status__message">{{ statusMessage() }}</text>
    </view>
    <view class="b10-status__actions">
      <text v-if="queueCount" class="b10-status__queue">{{ queueCount }} · {{ b10T('status.pending') }}</text>
      <button v-if="status === 'offline' || status === 'error' || status === 'stale'" class="b10-mini-button" type="button" @click="emit('retry')">{{ b10T('status.retry') }}</button>
      <button v-if="status === 'forbidden'" class="b10-mini-button" type="button" @click="openLogin">{{ b10T('status.login') }}</button>
      <button v-if="queueCount" class="b10-mini-button" type="button" @click="emit('sync')">{{ b10T('status.sync') }}</button>
      <picker :range="levels" :value="levels.indexOf(performanceLevel)" @change="emit('performance', levels[Number($event.detail.value)] ?? 'High')">
        <view class="b10-quality" :aria-label="`${b10T('common.performance')}: ${performanceLevel}`">{{ performanceLevel }}</view>
      </picker>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-status{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:24rpx;padding:24rpx;border:1rpx solid var(--yx-border);border-radius:18rpx;background:var(--yx-surface-card)}
.b10-status--offline,.b10-status--error{border-color:var(--yx-danger);background:var(--yx-danger-soft)}
.b10-status--forbidden{border-color:var(--yx-warning);background:var(--yx-warning-soft)}
.b10-status--stale{border-color:var(--yx-warning);background:var(--yx-warning-soft)}
.b10-status__copy{display:grid;gap:8rpx;flex:1}.b10-status__title{font-size:28rpx;font-weight:700}.b10-status__message{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-status__actions{display:flex;align-items:center;gap:10rpx;flex-wrap:wrap;justify-content:flex-end}.b10-status__queue{color:var(--yx-warning-strong);font-size:21rpx;font-weight:700}.b10-mini-button,.b10-quality{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.b10-quality{color:var(--yx-text-secondary)}
@media(max-width:620px){.b10-status{display:grid}.b10-status__actions{justify-content:flex-start}}
</style>
