<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'

const store = useLearnerContentStore()
onShow(() => { void store.loadFirstDay() })
function start(): void { getUniRuntime().navigateTo({ url: '/pages/practice/practice' }) }
</script>

<template>
  <view class="yx-page"><text class="yx-eyebrow">RULE-BASED PLACEMENT · CONTENT PIN</text><text class="yx-title">用规则化测评找到今天的起点。</text><view class="yx-card"><text class="question-count">首日状态：{{ store.firstDay?.state || '加载中' }}</text><text class="question">测评题目和版本由 content-service 提供，答案规则只在服务端判定，不会下发到页面。</text><text class="hint">测评入口：{{ store.firstDay?.placementStatus || 'NOT_STARTED' }} · 投影版本 {{ store.firstDay?.projectionVersion ?? 0 }}</text><button class="yx-button" :disabled="store.firstDayStatus === 'loading'" @click="start">进入测评</button><text v-if="store.lastError" class="error">{{ store.lastError }}</text></view></view>
</template>
<style scoped>.question-count{color:#596bff;font-size:24rpx;font-weight:700}.question{display:block;margin:28rpx 0;font-size:34rpx;line-height:1.45}.hint{display:block;margin-bottom:22rpx;color:#666d80;font-size:22rpx}.error{display:block;margin-top:16rpx;color:#b54747;font-size:22rpx}</style>
