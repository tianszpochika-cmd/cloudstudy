<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10ExerciseCard from '../../components/b10/B10ExerciseCard.vue'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import type { B10AnswerInput, B10AnswerResult } from '../../domain/b10'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { useB10LearningStore } from '../../stores/b10-learning'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const store = useB10LearningStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const lastResult = ref<B10AnswerResult | null>(null)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const exercise = computed(() => store.practice?.exercises.find((item) => !store.answerResults[String(item.exerciseId)]) ?? null)
const answeredCount = computed(() => Object.keys(store.answerResults).length)
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function load(): void { lastResult.value = null; void store.loadPractice() }
async function answer(value: B10AnswerInput): Promise<void> { if (!exercise.value) return; lastResult.value = await store.submitAnswer(exercise.value.exerciseId, value) }
function checkpoint(): void { void store.saveCheckpoint(exercise.value?.exerciseId ?? null) }
function openReport(): void { getUniRuntime().navigateTo({ url: '/pages/b10-report/b10-report' }) }
onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } load() })
onUnmounted(() => engine.dispose())
</script>

<template>
  <view class="yx-page" :class="themeClass" :data-performance="performanceLevel" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b2-practice" />

    <B10StatusPanel :status="store.practiceStatus" :message="store.practiceMessage" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />

    <view v-if="exercise" class="yx-card b10-practice-card">
      <view class="b10-practice-card__progress"><text>{{ answeredCount }} / {{ store.practice?.exercises.length ?? 0 }}</text><text>{{ exercise.questionType }}</text></view>
      <B10ExerciseCard :exercise="exercise" :disabled="store.practiceStatus === 'loading'" @answer="answer" />
      <view class="b10-practice-card__actions"><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="checkpoint">{{ b10T('practice.checkpoint') }}</button><button tabindex="0" role="button" v-if="lastResult" class="yx-button yx-button--secondary" type="button" @click="lastResult = null">{{ b10T('practice.next') }}</button></view>
      <view v-if="lastResult" class="b10-result" role="alert"><text class="b10-result__title">{{ lastResult.isCorrect === true ? '规则命中' : lastResult.isCorrect === false ? '需要复习' : '答案已接收' }}</text><text>{{ lastResult.scoringStatus }}<template v-if="lastResult.score !== null"> · {{ lastResult.score }} / {{ lastResult.maxScore ?? 0 }}</template></text><text v-for="cause in lastResult.errorCauseCandidates" :key="cause">{{ cause }}</text><text v-if="lastResult.contentVersionStale" class="b10-result__stale">{{ b10T('common.stale') }}</text></view>
    </view>

    <view v-else-if="store.practiceStatus === 'loading'" class="yx-card b10-empty"><text>{{ b10T('practice.loading') }}</text></view>
    <view v-else class="yx-card b10-empty"><text class="b10-empty__title">{{ store.practiceStatus === 'empty' ? b10T('practice.empty') : b10T('status.error') }}</text><text>{{ store.practiceMessage ?? b10T('status.noSample') }}</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
    <button tabindex="0" role="button" v-if="store.practice && !exercise" class="yx-button" type="button" @click="openReport">{{ b10T('practice.complete') }}</button>
    <MobileFeatureGrid />
  </view>
</template>

<style scoped lang="scss">
.b10-practice-card{display:grid;gap:18rpx}.b10-practice-card__progress,.b10-practice-card__actions{display:flex;align-items:center;justify-content:space-between;gap:12rpx;color:var(--yx-text-secondary);font-size:23rpx}.b10-practice-card__actions{align-items:stretch}.b10-practice-card__actions .yx-button{flex:1}.b10-result{display:grid;gap:8rpx;padding:18rpx;border:1rpx solid var(--yx-success-border);border-radius:14rpx;background:var(--yx-success-soft);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-result__title{color:var(--yx-success-strong);font-size:30rpx;font-weight:750}.b10-result__stale{color:var(--yx-warning-strong)}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
</style>
