<script setup lang="ts">
import type { PerformanceLevel } from '@englishflow/performance'
import type { B11Status } from '../../domain/b11'
import { b11T } from '../../platform/b11-foundation'

const props = withDefaults(defineProps<{ status: B11Status; message?: string | null; queueCount?: number; performanceLevel?: PerformanceLevel; motionDisabled?: boolean }>(), { message: null, queueCount: 0, performanceLevel: 'High', motionDisabled: false })
const emit = defineEmits<{ retry: []; sync: []; performance: [level: PerformanceLevel]; motion: [disabled: boolean] }>()
const levels: PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Performance']
function label(): string { return b11T(`status.${props.status}`) }
function defaultMessage(): string { return props.status === 'offline' || props.status === 'recovering' ? b11T('common.pending') : props.status === 'empty' ? b11T('common.noSample') : '' }
</script>

<template>
  <view class="b11-status" :class="`b11-status--${status}`" role="status" aria-live="polite">
    <view class="b11-status__copy"><text class="b11-status__title">{{ label() }}</text><text class="b11-status__message">{{ message ?? defaultMessage() }}</text></view>
    <view class="b11-status__actions">
      <text v-if="queueCount" class="b11-status__queue">{{ queueCount }} · {{ b11T('common.pending') }}</text>
      <button tabindex="0" role="button" v-if="status === 'offline' || status === 'error' || status === 'expired' || status === 'forbidden'" class="b11-mini-button" type="button" @click="emit('retry')">{{ b11T('status.retry') }}</button>
      <button tabindex="0" role="button" v-if="queueCount" class="b11-mini-button" type="button" @click="emit('sync')">{{ b11T('status.sync') }}</button>
      <picker :range="levels" :value="levels.indexOf(performanceLevel)" @change="emit('performance', levels[Number($event.detail.value)] ?? 'High')"><view class="b11-quality">{{ performanceLevel }}</view></picker>
      <button tabindex="0" role="button" class="b11-mini-button" type="button" @click="emit('motion', !motionDisabled)">{{ motionDisabled ? b11T('status.motionOn') : b11T('status.motionOff') }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-status{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:24rpx;padding:24rpx;border:1rpx solid var(--yx-border);border-radius:18rpx;background:var(--yx-surface-card)}
.b11-status--offline,.b11-status--error,.b11-status--expired{border-color:var(--yx-danger);background:var(--yx-danger-soft)}
.b11-status--forbidden{border-color:var(--yx-warning);background:var(--yx-warning-soft)}
.b11-status__copy{display:grid;gap:8rpx;flex:1}.b11-status__title{font-size:28rpx;font-weight:700}.b11-status__message{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b11-status__actions{display:flex;align-items:center;gap:10rpx;flex-wrap:wrap;justify-content:flex-end}.b11-status__queue{color:var(--yx-warning-strong);font-size:21rpx;font-weight:700}.b11-mini-button,.b11-quality{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.b11-quality{color:var(--yx-text-secondary)}
@media(max-width:620px){.b11-status{display:grid}.b11-status__actions{justify-content:flex-start}}
</style>
