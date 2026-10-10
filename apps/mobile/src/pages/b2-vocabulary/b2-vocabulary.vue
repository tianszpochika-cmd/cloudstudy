<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import { useB10LearningStore } from '../../stores/b10-learning'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { vocabPlayable } from '../../domain/closed-practice'

const store = useB10LearningStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const ratingOptions = [{ value: 0 as const, label: '忘了' }, { value: 1 as const, label: '模糊' }, { value: 2 as const, label: '记得' }, { value: 3 as const, label: '很熟' }]
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const completed = computed(() => Boolean(store.batch && store.batch.items.length > 0 && !store.currentCard && store.currentIndex >= store.batch.items.length))
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function open(path: string): void { openUniPage(path) }
function load(): void { void store.loadSrs() }
function reveal(): void { void store.revealCard() }
function rate(value: 0 | 1 | 2 | 3): void { void store.rateCard(value) }
function playAudio(): void {
  const src = store.currentCard?.audioUrl
  if (!vocabPlayable(src)) return
  const context = getUniRuntime().createInnerAudioContext?.()
  if (!context || !src) return
  context.src = src
  context.play()
}
onShow(async () => { if (await ensureMobilePageAccess('/pages/b2-vocabulary/b2-vocabulary')) load() })
onUnmounted(() => engine.dispose())
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b2-vocabulary" />

    <B10StatusPanel :status="store.status" :message="store.message" :queue-count="store.srsQueueCount" :performance-level="performanceLevel" @retry="load" @sync="store.syncSrs" @performance="setPerformance" />

    <view v-if="store.currentCard" class="yx-card b10-vocab-card">
      <view class="b10-vocab-card__meta"><text>{{ store.currentCard.sourceReason }}</text><text v-if="store.currentCard.masteryStatus">{{ store.currentCard.masteryStatus }}</text></view>
      <text class="b10-vocab-card__word">{{ store.currentCard.title }}</text>
      <text v-if="store.currentCard.phonetic" class="b10-vocab-card__phonetic">{{ store.currentCard.phonetic }}</text>
      <button v-if="vocabPlayable(store.currentCard.audioUrl)" type="button" data-vocab-play @click="playAudio">播放</button>
      <text v-else data-vocab-silent>没有发音，不能播放。</text>
      <text v-if="store.currentCard.hint && !store.currentCard.revealed" class="b10-vocab-card__hint">{{ store.currentCard.hint }}</text>
      <text v-if="!store.currentCard.revealed" class="b10-vocab-card__privacy">正面不展示释义、例句或标准答案。</text>
      <button tabindex="0" role="button" v-if="!store.currentCard.revealed" class="yx-button" type="button" :disabled="store.status === 'loading'" @click="reveal">{{ store.status === 'loading' ? b10T('vocab.revealing') : b10T('vocab.reveal') }}</button>
      <view v-else class="b10-vocab-card__back">
        <text class="b10-vocab-card__meaning">{{ store.currentCard.meaningCn ?? b10T('vocab.noAnswer') }}</text>
        <text v-if="store.currentCard.definitionEn" class="b10-vocab-card__definition">{{ store.currentCard.definitionEn }}</text>
        <view v-if="store.currentCard.examples.length" class="b10-vocab-card__examples"><text v-for="example in store.currentCard.examples" :key="example">{{ example }}</text></view>
        <text v-if="store.currentCard.dueLocalDate" class="b10-vocab-card__due">{{ b10T('vocab.due') }}：{{ store.currentCard.dueLocalDate }}</text>
        <text class="b10-vocab-card__label">{{ b10T('vocab.rate') }}</text>
        <view class="b10-vocab-card__ratings"><button tabindex="0" role="button" v-for="option in ratingOptions" :key="option.value" class="b10-rating" type="button" :disabled="store.currentCard.reviewStatus !== 'PENDING'" @click="rate(option.value)">{{ option.value }} · {{ option.label }}</button></view>
      </view>
    </view>

    <view v-else-if="completed" class="yx-card b10-empty"><text class="b10-empty__title">今日复习已完成</text><text>本批次的复习事件已逐条获得服务端确认；若有待同步项，状态栏会保留队列。</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">刷新复习队列</button></view>
    <view v-else-if="store.status === 'idle'" class="yx-card b10-empty"><text class="b10-empty__title">等待读取词汇批次</text><text>身份与页面初始化完成后，将从学习服务读取当前复习队列。</text></view>
    <view v-else-if="store.status === 'loading'" class="yx-card b10-empty"><text>{{ b10T('status.loading') }}</text></view>
    <view v-else-if="store.status === 'empty'" class="yx-card b10-empty"><text class="b10-empty__title">{{ b10T('vocab.empty') }}</text><text>{{ store.message ?? b10T('status.noSample') }}</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
    <view v-else class="yx-card b10-empty"><text class="b10-empty__title">词汇批次暂时不可用</text><text>{{ store.message ?? '请根据上方状态重试；未确认的复习不会被显示为已完成。' }}</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
    <view class="b10-links"><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/assessment/assessment')">基础练习</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b10-report/b10-report')">错题与报告</button></view>
  </view>
</template>

<style scoped lang="scss">
.b10-vocab-card{display:grid;gap:20rpx}.b10-vocab-card__meta{display:flex;justify-content:space-between;color:var(--yx-text-tertiary);font-size:22rpx}.b10-vocab-card__word{text-align:center;font-size:76rpx;font-weight:800;line-height:1.15}.b10-vocab-card__phonetic,.b10-vocab-card__hint,.b10-vocab-card__privacy,.b10-vocab-card__definition,.b10-vocab-card__due{color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6;text-align:center}.b10-vocab-card__privacy{color:var(--yx-text-tertiary);font-size:21rpx}.b10-vocab-card__back{display:grid;gap:16rpx}.b10-vocab-card__meaning{text-align:center;font-size:40rpx;font-weight:750}.b10-vocab-card__examples{display:grid;gap:10rpx;padding:18rpx;border-radius:14rpx;background:var(--yx-surface-soft);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.6}.b10-vocab-card__label{color:var(--yx-text-secondary);font-size:23rpx}.b10-vocab-card__ratings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.b10-rating{min-height:84rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:24rpx}.b10-rating:disabled{opacity:.55}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}.b10-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
</style>
