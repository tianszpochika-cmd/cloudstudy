<script setup lang="ts">
import { placementScorePercent } from '../../domain/placement-score'
import AppIcon from '../../components/AppIcon.vue'
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
const scorePercent = computed(() => placementScorePercent(report.value?.score))
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

    <view class="v2-assess-body">
    <view v-if="isSkipped" class="yx-card result-card card v2-assess-card v2-assess-skipped">
      <text class="question-count v2-assess-meta v2-assess-eyebrow"><AppIcon name="flag" :size="14" /><text>已跳过测评</text></text>
      <text class="result-title v2-assess-title v2-assess-h2">水平尚未验证</text>
      <text data-placement-card class="v2-assess-d v2-assess-desc">这次跳过不是正式测评分数。</text>
      <text v-if="report?.requestedStartingLevel" class="question v2-assess-desc v2-assess-row">你选择了 {{ report.requestedStartingLevel }} 作为起点；这不是测评等级。</text>
      <text v-else class="question v2-assess-desc v2-assess-row">自选起点，水平尚未验证。</text>
      <view class="v2-assess-row v2-assess-actions">
        <button tabindex="0" role="button" class="yx-button btn v2-assess-btn v2-assess-opt v2-assess-submit" type="button" @click="openToday">查看今日状态<AppIcon name="chev" :size="14" /></button>
      </view>
    </view>
    <view v-else-if="report" class="yx-card result-card card v2-assess-card v2-assess-report">
      <text class="question-count v2-assess-meta v2-assess-eyebrow"><AppIcon name="chart" :size="14" /><text>报告已生成</text></text>
      <text v-if="report.cefrLevel && scorePercent !== null" class="result-title v2-assess-title v2-assess-h2">{{ report.cefrLevel }} · {{ scorePercent }} 分</text>
      <text data-placement-card class="v2-assess-d v2-assess-desc">这份报告和快照是同一版本。</text>
      <text v-if="countedReport" class="question v2-assess-desc v2-assess-row">答对 {{ countedReport.full }} 题，共 {{ countedReport.total }} 题。</text>
      <text v-if="feedbackText" class="question v2-assess-desc v2-assess-fb v2-assess-row" role="status">{{ feedbackText }}</text>
      <text class="question v2-assess-desc v2-assess-row">重测会另开一套题，这份报告会保留。是否调整已有计划需要另外确认。</text>
      <view class="v2-assess-row v2-assess-actions">
        <button tabindex="0" role="button" class="yx-button btn v2-assess-btn v2-assess-opt v2-assess-submit" type="button" @click="openToday">查看今日状态<AppIcon name="chev" :size="14" /></button>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary btn v2-assess-btn v2-assess-opt" type="button" :disabled="retestPending" @click="retest">重测<AppIcon name="refresh" :size="14" /></button>
      </view>
    </view>
    <view v-else-if="question" class="yx-card question-card card v2-assess-card v2-assess-question">
      <view class="question-meta meta v2-assess-meta v2-assess-eyebrow"><AppIcon name="target" :size="14" /><text>第 {{ question.stepIndex }} 题，共 {{ question.totalSteps }} 题</text></view>
      <view class="v2-assess-progress-track"><view class="v2-assess-progress-value" :style="{ width: `${(question.stepIndex / question.totalSteps) * 100}%` }"></view></view>
      <text v-if="store.placement.acceptedSequence > 0" class="hint v2-assess-desc">服务端已接收 {{ store.placement.acceptedSequence }} 题。</text>
      <text class="question v2-assess-stem v2-assess-title v2-assess-h2">{{ question.stemText }}</text>
      <text v-if="feedbackText" class="hint v2-assess-desc v2-assess-fb" role="status">{{ feedbackText }}</text>
      <view class="options v2-assess-list"><button tabindex="0" role="button" v-for="option in question.options" :key="option.key" class="option opt v2-assess-opt v2-assess-row" :class="{ selected: selectedKey === option.key }" type="button" @click="selectedKey = option.key"><text class="option-key v2-assess-opt-key">{{ option.key }}</text><text class="v2-assess-desc v2-assess-option-text">{{ option.text }}</text></button></view>
      <text class="hint v2-assess-desc">当前选择只留在这一页。离开后，还没提交的选择不会保留。</text>
      <text v-if="store.placementStatus === 'offline'" class="hint v2-assess-desc v2-assess-fb" role="alert">{{ store.lastError || '答案状态尚未确认。请先重新读取，不会因此新开一套题。' }}</text>
      <view class="v2-assess-row v2-assess-actions">
        <button v-if="store.placementStatus === 'offline'" tabindex="0" role="button" class="yx-button btn v2-assess-btn v2-assess-opt v2-assess-submit" type="button" @click="load">重新读取<AppIcon name="refresh" :size="14" /></button>
        <button v-else tabindex="0" role="button" class="yx-button btn v2-assess-btn v2-assess-opt v2-assess-submit" type="button" :disabled="!selectedKey || store.placementStatus === 'loading'" @click="submit">{{ store.placementStatus === 'loading' ? '正在记录…' : '提交答案' }}<AppIcon name="check" :size="14" /></button>
      </view>
    </view>
    <view v-else-if="guideChecked && guidePending" class="yx-card card v2-assess-card v2-assess-guide">
      <text class="question-count v2-assess-meta v2-assess-eyebrow v2-assess-title v2-assess-h2"><AppIcon name="spark" :size="14" /><text>开始定级</text></text>
      <text class="question v2-assess-d v2-assess-desc">共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。</text>
      <view class="v2-assess-row v2-assess-actions">
        <button tabindex="0" role="button" class="yx-button btn v2-assess-btn v2-assess-opt v2-assess-submit" type="button" @click="begin">开始<AppIcon name="chev" :size="14" /></button>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary btn v2-assess-btn v2-assess-opt" type="button" @click="openHome">返回学习首页<AppIcon name="back" :size="14" /></button>
      </view>
    </view>
    <view v-else class="yx-card card v2-assess-card v2-assess-pending">
      <text class="question-count v2-assess-meta v2-assess-eyebrow v2-assess-title v2-assess-h2"><AppIcon name="clock" :size="14" /><text>开始定级</text></text>
      <text v-if="!guideChecked || store.placementStatus === 'loading' || store.placementStatus === 'idle'" class="question v2-assess-d v2-assess-desc" role="status">正在准备测评</text>
      <text v-else-if="store.placementStatus === 'offline' || store.placementStatus === 'error'" class="question v2-assess-d v2-assess-desc" role="alert">测评暂时不可用，请稍后重试。</text>
      <text v-else-if="store.placementStatus === 'forbidden'" class="question v2-assess-d v2-assess-desc" role="alert">当前账号没有测评权限。</text>
      <text v-else-if="heldCheckpoint" class="question v2-assess-d v2-assess-desc">定级进度在服务端。重新读取会从已接收检查点的下一题继续，不会新开一套题。</text>
      <text v-else class="question v2-assess-d v2-assess-desc">目前没有可用题目，可以稍后重试。</text>
      <text v-if="!guideChecked || store.placementStatus === 'loading' || store.placementStatus === 'idle'" class="hint v2-assess-desc v2-assess-fb">请稍候。</text>
      <view class="v2-assess-row v2-assess-actions">
        <button v-if="guideChecked && store.placementStatus !== 'loading' && store.placementStatus !== 'idle'" tabindex="0" role="button" class="yx-button btn v2-assess-btn v2-assess-opt v2-assess-submit" type="button" @click="load">重新读取<AppIcon name="refresh" :size="14" /></button>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary btn v2-assess-btn v2-assess-opt" type="button" @click="openHome">返回学习首页<AppIcon name="back" :size="14" /></button>
      </view>
    </view>
    </view>
  </view>
</template>

<style scoped>
.question-count{color:var(--yx-brand);font-size:24rpx;font-weight:700}.question{display:block;margin:28rpx 0;font-size:34rpx;line-height:1.45}.hint{display:block;margin-top:18rpx;color:var(--yx-text-secondary);font-size:22rpx}.result-title{display:block;margin-top:16rpx;color:var(--yx-text-primary);font-size:48rpx;font-weight:800}.question-meta{display:flex;justify-content:space-between;color:var(--yx-brand);font-size:23rpx;font-weight:700}.options{display:grid;gap:14rpx;margin-bottom:22rpx}.option{display:flex;align-items:center;gap:14rpx;width:100%;padding:20rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);text-align:left;font-size:28rpx}.option.selected{border-color:var(--yx-brand);background:var(--yx-brand-soft)}.option-key{color:var(--yx-brand);font-weight:800}
.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
button:disabled{opacity:.55}
/* v2 定级测评页换皮：对齐 practice.vue 与 today.vue 中 v2-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.list-row/.action-row/.opt/.fb/.btn，仅用 var(--v2-*)。 */
.v2-assess-body{box-sizing:border-box;display:flex;flex-direction:column;gap:var(--v2-space-4);min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-assess-card{box-sizing:border-box;display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-assess-card:hover{border-color:var(--v2-brand)}
.v2-assess-skipped,.v2-assess-report,.v2-assess-question,.v2-assess-guide,.v2-assess-pending{box-sizing:border-box;min-width:0;max-width:100%}
.v2-assess-meta{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-assess-eyebrow{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-assess-title{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-assess-h2{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-assess-stem{box-sizing:border-box;display:block;min-width:0;max-width:100%;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-assess-d{box-sizing:border-box;display:block;min-width:0;max-width:100%;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-assess-desc{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-assess-fb{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-assess-list{box-sizing:border-box;display:grid;gap:var(--v2-space-4);min-width:0;max-width:100%}
.v2-assess-row{box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-assess-row:hover{border-color:var(--v2-brand)}
.v2-assess-actions{box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:stretch;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:0;border:0;background:none;font-family:var(--v2-font)}
.v2-assess-actions .v2-assess-btn,.v2-assess-actions .v2-assess-opt{flex:1 1 0;width:auto}
.v2-assess-btn,.v2-assess-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-assess-opt:hover{border-color:var(--v2-brand)}
.v2-assess-opt.selected{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-assess-opt:active{transform:scale(.97)}
.v2-assess-opt:focus-visible,.v2-assess-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-assess-btn:disabled,.v2-assess-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-assess-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-assess-submit:hover{border-color:var(--v2-brand)}
.v2-assess-list .v2-assess-opt,.v2-assess-list .v2-assess-row{justify-content:flex-start;text-align:left}
.v2-assess-opt-key{box-sizing:border-box;flex:none;min-width:0;color:var(--v2-brand);font-family:var(--v2-font);font-weight:800;overflow-wrap:anywhere}
.v2-assess-option-text{box-sizing:border-box;display:block;flex:1 1 0;min-width:0;max-width:100%;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;white-space:normal;overflow-wrap:anywhere}
.v2-assess-progress-track{box-sizing:border-box;display:block;min-width:0;max-width:100%;height:14rpx;margin:var(--v2-space-2) 0 var(--v2-space-4);border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-assess-progress-value{display:block;min-width:0;max-width:100%;height:100%;border-radius:inherit;background:var(--v2-brand)}
@media(max-width:360px){.v2-assess-actions{flex-direction:column;flex-wrap:nowrap;height:auto}.v2-assess-actions .v2-assess-btn,.v2-assess-actions .v2-assess-opt{flex:1 1 100%;width:100%}}
.v2-assess-actions{display:flex;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-assess-actions .v2-assess-btn,.v2-assess-btn{flex:1 1 100%;max-width:100%;min-width:0;white-space:normal;overflow-wrap:anywhere;box-sizing:border-box}
</style>
