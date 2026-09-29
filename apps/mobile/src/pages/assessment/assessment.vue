<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
const selectedKey = ref('')
const startedAt = ref(Date.now())
/** IC-058 定级引导：首次空白先讲题量与目的，不承诺用时。 */
const guideSeen = ref(false)
watch(() => session.identityRevision, () => { selectedKey.value = ''; startedAt.value = Date.now() }, { flush: 'sync' })
const question = computed(() => store.placement.currentQuestion)
const report = computed(() => store.placement.report)
const isSkipped = computed(() => report.value?.resultKind === 'SKIPPED' || store.placement.status === 'SKIPPED')
const scorePercent = computed(() => report.value?.score === null || report.value?.score === undefined ? null : Math.round(report.value.score * 100))

async function load(): Promise<void> {
  await store.loadPlacement()
  // The H5 response can finish one event-loop turn after the first page
  // onShow. Re-run a legitimate server read once when the first response is
  // an empty projection; this removes the need for a user to press Reload and
  // still never fabricates a question or report locally.
  if (store.placementStatus === 'empty' && !store.placement.report && !store.placement.currentQuestion) {
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
function openHome(): void { getUniRuntime().switchTab({ url: '/pages/home/home' }) }

onShow(async () => { if (await ensureMobilePageAccess('/pages/assessment/assessment')) await load() })
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="assessment" />

    <view v-if="report" class="yx-card result-card">
      <text class="question-count">{{ isSkipped ? '已跳过测评' : '历史两题练习结果' }}</text>
      <text v-if="!isSkipped && report.cefrLevel && scorePercent !== null" class="result-title">{{ report.cefrLevel }} · {{ scorePercent }} 分</text>
      <text v-if="isSkipped" class="question">自选起点{{ report.requestedStartingLevel ? ` ${report.requestedStartingLevel}` : '' }}，水平尚未验证。</text>
      <text v-else class="question">旧版练习仅供参考，不能代替四维定级。</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="openToday">查看今日状态</button>
    </view>
    <view v-else-if="question" class="yx-card question-card">
      <view class="question-meta"><text>{{ question.dimension }}</text><text>{{ question.stepIndex }} / {{ question.totalSteps }}</text></view>
      <text class="question">{{ question.stemText }}</text>
      <view class="options"><button tabindex="0" role="button" v-for="option in question.options" :key="option.key" class="option" :class="{ selected: selectedKey === option.key }" type="button" @click="selectedKey = option.key"><text class="option-key">{{ option.key }}</text><text>{{ option.text }}</text></button></view>
      <text v-if="store.placementStatus === 'offline'" class="hint" role="alert">答案状态尚未确认，请重新读取后继续。</text>
      <button v-if="store.placementStatus === 'offline'" tabindex="0" role="button" class="yx-button" type="button" @click="load">重新读取</button>
      <button v-else tabindex="0" role="button" class="yx-button" type="button" :disabled="!selectedKey || store.placementStatus === 'loading'" @click="submit">{{ store.placementStatus === 'loading' ? '正在记录…' : '提交答案' }}</button>
    </view>
    <view v-else class="yx-card">
      <text class="question-count">首日测评</text>
      <text v-if="store.placementStatus === 'loading' || store.placementStatus === 'idle'" class="question" role="status">正在准备测评…</text>
      <text v-else-if="store.placementStatus === 'offline' || store.placementStatus === 'error'" class="question" role="alert">测评暂时不可用，请稍后重试。</text>
      <text v-else-if="store.placementStatus === 'forbidden'" class="question" role="alert">当前账号没有测评权限。</text>
      <text v-else-if="!guideSeen" class="question">共 10 道题，测出你的起点，约几分钟。准备好就开始。</text>
      <text v-else class="question">目前没有可用题目，可以稍后重试。</text>
      <button v-if="!guideSeen && store.placementStatus !== 'loading' && store.placementStatus !== 'idle' && store.placementStatus !== 'offline' && store.placementStatus !== 'error' && store.placementStatus !== 'forbidden'" tabindex="0" role="button" class="yx-button" type="button" @click="guideSeen = true; load()">开始测评</button>
      <button v-else-if="store.placementStatus !== 'loading' && store.placementStatus !== 'idle'" tabindex="0" role="button" class="yx-button" type="button" @click="load">重新读取</button>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="openHome">返回学习首页</button>
    </view>
  </view>
</template>

<style scoped>
.question-count{color:var(--yx-brand);font-size:24rpx;font-weight:700}.question{display:block;margin:28rpx 0;font-size:34rpx;line-height:1.45}.hint{display:block;margin-top:18rpx;color:var(--yx-text-secondary);font-size:22rpx}.result-title{display:block;margin-top:16rpx;color:var(--yx-text-primary);font-size:48rpx;font-weight:800}.question-meta{display:flex;justify-content:space-between;color:var(--yx-brand);font-size:23rpx;font-weight:700}.options{display:grid;gap:14rpx;margin-bottom:22rpx}.option{display:flex;align-items:center;gap:14rpx;width:100%;padding:20rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);text-align:left;font-size:28rpx}.option.selected{border-color:var(--yx-brand);background:var(--yx-brand-soft)}.option-key{color:var(--yx-brand);font-weight:800}
.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
</style>
