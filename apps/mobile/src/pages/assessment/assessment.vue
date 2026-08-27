<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'

const store = useLearnerContentStore()
const selectedKey = ref('')
const startedAt = ref(Date.now())
const question = computed(() => store.placement.currentQuestion)
const report = computed(() => store.placement.report)
const scorePercent = computed(() => Math.round((report.value?.score ?? 0) * 100))

async function load(): Promise<void> {
  await store.loadPlacement()
  // The H5 callback can finish one event-loop turn after the first page
  // onShow. Re-run a legitimate server read once when the first response is
  // an empty projection; this removes the need for a user to press Reload and
  // still never fabricates a question or report locally.
  if (!store.placement.report && !store.placement.currentQuestion) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    await store.loadPlacement()
  }
  selectedKey.value = ''
  startedAt.value = Date.now()
}

async function submit(): Promise<void> {
  if (!selectedKey.value) return
  const answer = selectedKey.value
  selectedKey.value = ''
  await store.submitPlacementAnswer(answer, (Date.now() - startedAt.value) / 1000)
  startedAt.value = Date.now()
}

function openToday(): void { getUniRuntime().navigateTo({ url: '/pages/today/today' }) }

onShow(async () => { if (await ensureMobilePageAccess('/pages/assessment/assessment')) await load() })
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">RULE-BASED PLACEMENT · CONTENT PIN</text>
    <text class="yx-title">用规则化测评找到今天的起点。</text>
    <view v-if="report" class="yx-card result-card">
      <text class="question-count">测评完成</text>
      <text class="result-title">{{ report.cefrLevel }} · {{ scorePercent }} 分</text>
      <text class="question">结果来自 assessment-service 的服务端判分，并已写入本地 MySQL owner 表。</text>
      <button class="yx-button" type="button" @click="openToday">查看今日任务</button>
    </view>
    <view v-else-if="question" class="yx-card question-card">
      <view class="question-meta"><text>{{ question.dimension }}</text><text>{{ question.stepIndex }} / {{ question.totalSteps }}</text></view>
      <text class="question">{{ question.stemText }}</text>
      <view class="options"><button v-for="option in question.options" :key="option.key" class="option" :class="{ selected: selectedKey === option.key }" type="button" @click="selectedKey = option.key"><text class="option-key">{{ option.key }}</text><text>{{ option.text }}</text></button></view>
      <button class="yx-button" type="button" :disabled="!selectedKey || store.placementStatus === 'loading'" @click="submit">{{ store.placementStatus === 'loading' ? '正在记录…' : '提交答案' }}</button>
    </view>
    <view v-else class="yx-card">
      <text class="question-count">首日测评</text>
      <text class="question">题目和版本由 content-service 提供，答案规则只在 assessment-service 服务端判定，不会下发到页面。</text>
      <text v-if="store.placementStatus === 'loading'" class="hint">正在读取真实测评…</text>
      <text v-else class="hint">{{ store.lastError || '当前没有可用的测评题目。' }}</text>
      <button class="yx-button" type="button" :disabled="store.placementStatus === 'loading'" @click="load">{{ store.placementStatus === 'loading' ? '读取中…' : '重新读取' }}</button>
    </view>
  </view>
</template>

<style scoped>
.question-count{color:#596bff;font-size:24rpx;font-weight:700}.question{display:block;margin:28rpx 0;font-size:34rpx;line-height:1.45}.hint{display:block;margin-top:18rpx;color:#666d80;font-size:22rpx}.result-title{display:block;margin-top:16rpx;color:#27304a;font-size:48rpx;font-weight:800}.question-meta{display:flex;justify-content:space-between;color:#596bff;font-size:23rpx;font-weight:700}.options{display:grid;gap:14rpx;margin-bottom:22rpx}.option{display:flex;align-items:center;gap:14rpx;width:100%;padding:20rpx;border:1rpx solid #d9deeb;border-radius:14rpx;color:#27304a;background:#fff;text-align:left;font-size:28rpx}.option.selected{border-color:#596bff;background:#eef0ff}.option-key{color:#596bff;font-weight:800}
</style>
