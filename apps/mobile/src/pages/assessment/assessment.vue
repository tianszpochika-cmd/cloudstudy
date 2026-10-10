<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { markPlacementEntryReached, selectOnboardingResumeStep } from '../../domain/onboarding-resume'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
const selectedKey = ref('')
const startedAt = ref(Date.now())
const guidePending = ref(false)
const guideChecked = ref(false)
const startRequested = ref(false)
const retestPending = ref(false)
watch(() => session.identityRevision, () => { selectedKey.value = ''; startedAt.value = Date.now(); guidePending.value = false; guideChecked.value = false; startRequested.value = false }, { flush: 'sync' })
const question = computed(() => store.placement.currentQuestion)
const report = computed(() => store.placement.report)
const isSkipped = computed(() => report.value?.resultKind === 'SKIPPED' || store.placement.status === 'SKIPPED')
const heldCheckpoint = computed(() => Boolean(store.placement.sessionId?.startsWith('asess_') && !question.value && !report.value && store.placementStatus !== 'loading' && store.placementStatus !== 'idle' && store.placementStatus !== 'offline' && store.placementStatus !== 'error' && store.placementStatus !== 'forbidden'))
const scorePercent = computed(() => report.value?.score === null || report.value?.score === undefined ? null : Math.round(report.value.score * 100))
const countedReport = computed(() => {
  const full = report.value?.fullCount
  const total = report.value?.itemCount
  return report.value?.resultKind === 'ASSESSED' && typeof full === 'number' && typeof total === 'number' ? { full, total } : null
})
const feedbackText = computed(() => {
  if (store.placement.reconciledWithoutReceipt) return ''
  if (store.placement.responseOutcome === 'FULL') return '刚才提交的这题答对了。'
  if (store.placement.responseOutcome === 'ZERO') return '刚才提交的这题没有答对。'
  return ''
})

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

function begin(): void {
  if (startRequested.value) return
  startRequested.value = true
  guidePending.value = false
  void load()
}

async function retest(): Promise<void> {
  if (retestPending.value) return
  retestPending.value = true
  selectedKey.value = ''
  try {
    await store.retestPlacement()
    startedAt.value = Date.now()
  } finally {
    retestPending.value = false
  }
}

function openToday(): void { getUniRuntime().navigateTo({ url: '/pages/today/today' }) }
function openHome(): void { getUniRuntime().switchTab({ url: '/pages/home/home' }) }

onShow(async () => {
  if (!(await ensureMobilePageAccess('/pages/assessment/assessment'))) return
  try {
    const facts = await store.loadOnboardingResume()
    if (selectOnboardingResumeStep(facts) === 'assessment') {
      const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
      markPlacementEntryReached(storage, session.verifiedSubject)
    }
  } catch { /* an unread resume does not count as reaching the placement entry */ }
  store.restore()
  if (store.placement.sessionId?.startsWith('asess_') || startRequested.value) {
    guidePending.value = false
    guideChecked.value = true
    await load()
    return
  }
  guidePending.value = true
  guideChecked.value = true
})
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="assessment" />

    <view v-if="isSkipped" class="yx-card result-card">
      <text class="question-count">已跳过测评</text>
      <text class="result-title">水平尚未验证</text>
      <text data-placement-card>这次跳过不是正式测评分数。</text>
      <text v-if="report?.requestedStartingLevel" class="question">你选择了 {{ report.requestedStartingLevel }} 作为起点；这不是测评等级。</text>
      <text v-else class="question">自选起点，水平尚未验证。</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="openToday">查看今日状态</button>
    </view>
    <view v-else-if="report" class="yx-card result-card">
      <text class="question-count">报告已生成</text>
      <text data-placement-card>这份报告和快照是同一版本。</text>
      <text v-if="report.cefrLevel && scorePercent !== null" class="result-title">{{ report.cefrLevel }} · {{ scorePercent }} 分</text>
      <text v-if="countedReport" class="question">答对 {{ countedReport.full }} 题，共 {{ countedReport.total }} 题。</text>
      <text v-if="feedbackText" class="question" role="status">{{ feedbackText }}</text>
      <text class="question">重测会另开一套题，这份报告会保留。是否调整已有计划需要另外确认。</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="openToday">查看今日状态</button>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" :disabled="retestPending" @click="retest">重测</button>
    </view>
    <view v-else-if="question" class="yx-card question-card">
      <view class="question-meta"><text>第 {{ question.stepIndex }} 题，共 {{ question.totalSteps }} 题</text></view>
      <text v-if="store.placement.acceptedSequence > 0" class="hint">服务端已接收 {{ store.placement.acceptedSequence }} 题。</text>
      <text class="question">{{ question.stemText }}</text>
      <text v-if="feedbackText" class="hint" role="status">{{ feedbackText }}</text>
      <view class="options"><button tabindex="0" role="button" v-for="option in question.options" :key="option.key" class="option" :class="{ selected: selectedKey === option.key }" type="button" @click="selectedKey = option.key"><text class="option-key">{{ option.key }}</text><text>{{ option.text }}</text></button></view>
      <text class="hint">当前选择只留在这一页。离开后，还没提交的选择不会保留。</text>
      <text v-if="store.placementStatus === 'offline'" class="hint" role="alert">{{ store.lastError || '答案状态尚未确认。请先重新读取，不会因此新开一套题。' }}</text>
      <button v-if="store.placementStatus === 'offline'" tabindex="0" role="button" class="yx-button" type="button" @click="load">重新读取</button>
      <button v-else tabindex="0" role="button" class="yx-button" type="button" :disabled="!selectedKey || store.placementStatus === 'loading'" @click="submit">{{ store.placementStatus === 'loading' ? '正在记录…' : '提交答案' }}</button>
    </view>
    <view v-else-if="guideChecked && guidePending" class="yx-card">
      <text class="question-count">开始定级</text>
      <text class="question">共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="begin">开始</button>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="openHome">返回学习首页</button>
    </view>
    <view v-else class="yx-card">
      <text class="question-count">开始定级</text>
      <text v-if="!guideChecked || store.placementStatus === 'loading' || store.placementStatus === 'idle'" class="question" role="status">正在准备测评</text>
      <text v-else-if="store.placementStatus === 'offline' || store.placementStatus === 'error'" class="question" role="alert">测评暂时不可用，请稍后重试。</text>
      <text v-else-if="store.placementStatus === 'forbidden'" class="question" role="alert">当前账号没有测评权限。</text>
      <text v-else-if="heldCheckpoint" class="question">定级进度在服务端。重新读取会从已接收检查点的下一题继续，不会新开一套题。</text>
      <text v-else class="question">目前没有可用题目，可以稍后重试。</text>
      <text v-if="!guideChecked || store.placementStatus === 'loading' || store.placementStatus === 'idle'" class="hint">请稍候。</text>
      <button v-if="guideChecked && store.placementStatus !== 'loading' && store.placementStatus !== 'idle'" tabindex="0" role="button" class="yx-button" type="button" @click="load">重新读取</button>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="openHome">返回学习首页</button>
    </view>
  </view>
</template>

<style scoped>
.question-count{color:var(--yx-brand);font-size:24rpx;font-weight:700}.question{display:block;margin:28rpx 0;font-size:34rpx;line-height:1.45}.hint{display:block;margin-top:18rpx;color:var(--yx-text-secondary);font-size:22rpx}.result-title{display:block;margin-top:16rpx;color:var(--yx-text-primary);font-size:48rpx;font-weight:800}.question-meta{display:flex;justify-content:space-between;color:var(--yx-brand);font-size:23rpx;font-weight:700}.options{display:grid;gap:14rpx;margin-bottom:22rpx}.option{display:flex;align-items:center;gap:14rpx;width:100%;padding:20rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);text-align:left;font-size:28rpx}.option.selected{border-color:var(--yx-brand);background:var(--yx-brand-soft)}.option-key{color:var(--yx-brand);font-weight:800}
.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
button:disabled{opacity:.55}
</style>
