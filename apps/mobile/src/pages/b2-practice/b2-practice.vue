<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onUnmounted, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10ExerciseCard from '../../components/b10/B10ExerciseCard.vue'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import type { B10AnswerInput, B10AnswerResult } from '../../domain/b10'
import { acceptSubmission, practiceFeedback, resumeView, showPracticeReward } from '../../domain/practice-loop'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { useB10LearningStore } from '../../stores/b10-learning'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const store = useB10LearningStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const lastResult = ref<B10AnswerResult | null>(null)
const submitting = ref(false)
watch(() => session.identityRevision, () => { lastResult.value = null }, { flush: 'sync' })
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const resume = computed(() => resumeView(store.practice))
const exercise = computed(() => {
  const list = store.practice?.exercises ?? []
  if (resume.value.stopped) return null
  const start = Math.max(0, resume.value.index - 1)
  return list.find((item, index) => index >= start && !store.answerResults[String(item.exerciseId)]) ?? null
})
const answeredCount = computed(() => Object.keys(store.answerResults).length)
const answerFeedback = computed(() => lastResult.value ? practiceFeedback({
  correct: lastResult.value.isCorrect,
  savedReceipt: lastResult.value.savedReceipt,
  feedbackText: lastResult.value.feedbackText,
  nextQuestion: lastResult.value.nextQuestion,
  scoreBucket: lastResult.value.scoreBucket,
  received: answeredCount.value,
  total: store.practice?.exercises.length ?? 0,
}) : null)
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function load(): void { lastResult.value = null; void store.loadPractice() }
async function answer(value: B10AnswerInput): Promise<void> {
  if (!exercise.value || !acceptSubmission(submitting.value)) return
  submitting.value = true
  try { lastResult.value = await store.submitAnswer(exercise.value.exerciseId, value) }
  finally { submitting.value = false }
}
function checkpoint(): void { void store.saveCheckpoint(exercise.value?.exerciseId ?? null) }
function openReport(): void { getUniRuntime().navigateTo({ url: '/pages/b10-report/b10-report' }) }
onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } load() })
onUnmounted(() => engine.dispose())
</script>

<template>
  <view class="yx-page v2-b2p-page" :class="themeClass" :data-performance="performanceLevel" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b2-practice" />

    <view class="v2-b2p-body">
      <B10StatusPanel class="v2-b2p-status" :status="store.practiceStatus" :message="store.practiceMessage" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />

      <view v-if="resume.stopped" class="yx-card v2-b2p-card card" role="status" data-offline-exit>
        <view class="v2-b2p-eyebrow eyebrow"><AppIcon name="alert" :size="14" /><text>练习状态</text></view>
        <text class="v2-b2p-title">{{ resume.copy }}</text>
      </view>
      <view v-else-if="exercise" class="yx-card b10-practice-card v2-b2p-card card">
        <view class="v2-b2p-eyebrow eyebrow"><AppIcon name="target" :size="14" /><text data-resume>{{ resume.copy }}</text></view>
        <view class="b10-practice-card__progress v2-b2p-meta meta"><text>{{ answeredCount }} / {{ store.practice?.exercises.length ?? 0 }}</text><text>{{ exercise.questionType }}</text></view>
        <B10ExerciseCard :exercise="exercise" :disabled="store.practiceStatus === 'loading' || submitting" data-single-submit @answer="answer" />
        <view class="b10-practice-card__actions v2-b2p-actions row"><button tabindex="0" role="button" class="yx-button yx-button--secondary v2-b2p-btn btn" type="button" @click="checkpoint">{{ b10T('practice.checkpoint') }}</button><button tabindex="0" role="button" v-if="lastResult" class="yx-button yx-button--secondary v2-b2p-btn btn" type="button" @click="lastResult = null">{{ b10T('practice.next') }}<AppIcon name="chev" :size="14" /></button></view>
        <view v-if="answerFeedback" class="b10-result v2-b2p-fb fb" role="alert"><text class="b10-result__title v2-b2p-title">{{ lastResult?.isCorrect === true ? '规则命中' : lastResult?.isCorrect === false ? '需要修复' : '' }}</text><text v-if="lastResult?.scoringStatus" class="v2-b2p-d d">{{ lastResult.scoringStatus }}</text><text data-save-receipt class="v2-b2p-d d">{{ answerFeedback.savedReceipt }}</text><text data-feedback-text class="v2-b2p-d d">{{ answerFeedback.feedbackText }}</text><text data-next-question class="v2-b2p-d d">{{ answerFeedback.nextQuestion }}</text><text v-if="lastResult?.contentVersionStale" class="b10-result__stale v2-b2p-d d">{{ b10T('common.stale') }}</text></view>
      </view>

      <view v-else-if="store.practiceStatus === 'loading'" class="yx-card b10-empty v2-b2p-card card"><view class="v2-b2p-eyebrow eyebrow"><AppIcon name="refresh" :size="14" /><text>加载中</text></view><text class="v2-b2p-d d">{{ b10T('practice.loading') }}</text></view>
      <view v-else class="yx-card b10-empty v2-b2p-card card"><view class="v2-b2p-eyebrow eyebrow"><AppIcon name="inbox" :size="14" /><text>练习</text></view><text class="b10-empty__title v2-b2p-title">{{ store.practiceStatus === 'empty' ? b10T('practice.empty') : b10T('status.error') }}</text><text class="v2-b2p-d d">{{ store.practiceMessage ?? b10T('status.noSample') }}</text><button tabindex="0" role="button" class="yx-button v2-b2p-btn btn" type="button" @click="load">{{ b10T('status.retry') }}<AppIcon name="chev" :size="14" /></button></view>
      <button tabindex="0" role="button" v-if="store.practice && !exercise" class="yx-button v2-b2p-btn v2-b2p-submit btn" type="button" @click="openReport">{{ b10T('practice.complete') }}<AppIcon name="chev" :size="14" /></button>
      <text v-if="store.practice && !exercise && !showPracticeReward()" data-reward-hidden class="v2-b2p-d d">本次练习已完成。</text>
      <MobileFeatureGrid />
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-practice-card{display:grid;gap:18rpx}.b10-practice-card__progress,.b10-practice-card__actions{display:flex;align-items:center;justify-content:space-between;gap:12rpx;color:var(--yx-text-secondary);font-size:23rpx}.b10-practice-card__actions{align-items:stretch}.b10-practice-card__actions .yx-button{flex:1}.b10-result{display:grid;gap:8rpx;padding:18rpx;border:1rpx solid var(--yx-success-border);border-radius:14rpx;background:var(--yx-success-soft);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-result__title{color:var(--yx-success-strong);font-size:30rpx;font-weight:750}.b10-result__stale{color:var(--yx-warning-strong)}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
/* v2 练习入口页换皮：对齐 practice.vue 与 today.vue 中 v2-* 卡片/eyebrow/标题/按钮同样数值，仅用 var(--v2-*)。 */
.v2-b2p-page{font-family:var(--v2-font)}
.v2-b2p-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font)}
.v2-b2p-status{display:grid;gap:var(--v2-space-2);font-family:var(--v2-font)}
.v2-b2p-card{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b2p-card:hover{border-color:var(--v2-brand)}
.v2-b2p-eyebrow{display:flex;align-items:center;gap:var(--v2-space-2);margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.v2-b2p-title{display:block;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45}
.v2-b2p-meta{display:flex;justify-content:space-between;align-items:center;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b2p-actions{display:flex;align-items:stretch;gap:var(--v2-space-2);font-family:var(--v2-font)}
.v2-b2p-actions .v2-b2p-btn{flex:1}
.v2-b2p-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap}
.v2-b2p-btn:hover{border-color:var(--v2-brand)}
.v2-b2p-btn:active{transform:scale(.97)}
.v2-b2p-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b2p-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b2p-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-b2p-submit:hover{border-color:var(--v2-brand)}
.v2-b2p-fb{display:grid;gap:var(--v2-space-2);margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b2p-d{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
</style>
