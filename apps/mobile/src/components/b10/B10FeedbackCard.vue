<script setup lang="ts">
import type { B10RuleFeedback } from '../../domain/b10'
import { b10T } from '../../platform/b10-foundation'

defineProps<{ feedback: B10RuleFeedback | null }>()
</script>

<template>
  <view v-if="feedback" class="b10-feedback" role="alert">
    <text class="b10-feedback__title">{{ feedback.correct === true ? '规则命中' : feedback.correct === false ? '需要修复' : b10T('writing.feedback') }}</text>
    <text v-if="feedback.feedbackCode" class="b10-feedback__code">{{ feedback.feedbackCode }} · {{ feedback.ruleVersion ?? 'server-rule' }}</text>
    <text v-if="feedback.score !== null" class="b10-feedback__score">{{ Math.round(feedback.score) }}</text>
    <text v-if="feedback.nextAction" class="b10-feedback__next">{{ feedback.nextAction }}</text>
    <view v-if="feedback.errorCauses.length" class="b10-feedback__causes"><text v-for="cause in feedback.errorCauses" :key="cause">{{ cause }}</text></view>
    <view v-if="feedback.evidence.length" class="b10-feedback__evidence"><text class="b10-feedback__evidence-title">{{ b10T('report.reason') }}</text><view v-for="item in feedback.evidence" :key="`${item.label}-${item.explanation}`" class="b10-feedback__item"><text>{{ item.label }}</text><text>{{ item.explanation }}</text><text v-if="item.sourceText" class="b10-feedback__source">{{ item.sourceText }}</text></view></view>
    <text v-if="feedback.contentVersionStale" class="b10-feedback__stale">{{ b10T('common.stale') }}</text>
    <text class="b10-feedback__ai">{{ b10T('writing.aiOff') }}</text>
  </view>
</template>

<style scoped lang="scss">
.b10-feedback{display:grid;gap:10rpx;padding:22rpx;border:1rpx solid var(--yx-success);border-radius:16rpx;background:var(--yx-success-soft);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-feedback__title{color:var(--yx-success-strong);font-size:30rpx;font-weight:750}.b10-feedback__code{color:var(--yx-success-strong);font-size:22rpx}.b10-feedback__score{color:var(--yx-success-strong);font-size:44rpx;font-weight:800}.b10-feedback__causes,.b10-feedback__evidence{display:grid;gap:8rpx}.b10-feedback__evidence{padding-top:10rpx;border-top:1rpx solid var(--yx-success-border)}.b10-feedback__evidence-title{font-weight:700}.b10-feedback__item{display:grid;gap:4rpx;padding:12rpx;border-radius:10rpx;background:var(--yx-surface-card)}.b10-feedback__source{color:var(--yx-brand)}.b10-feedback__stale{color:var(--yx-warning-strong)}.b10-feedback__ai{color:var(--yx-text-tertiary);font-size:20rpx}
</style>
