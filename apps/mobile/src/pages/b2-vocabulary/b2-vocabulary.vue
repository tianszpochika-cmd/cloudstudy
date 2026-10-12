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

    <view class="v2-vocab-body">
      <B10StatusPanel class="v2-vocab-progress" :status="store.status" :message="store.message" :queue-count="store.srsQueueCount" :performance-level="performanceLevel" @retry="load" @sync="store.syncSrs" @performance="setPerformance" />

      <view v-if="store.currentCard" class="yx-card b10-vocab-card v2-vocab-card">
        <view class="b10-vocab-card__meta v2-vocab-meta"><text class="v2-vocab-source">{{ store.currentCard.sourceReason }}</text><text v-if="store.currentCard.masteryStatus" class="v2-vocab-mastery">{{ store.currentCard.masteryStatus }}</text></view>
        <text class="b10-vocab-card__word v2-vocab-word">{{ store.currentCard.title }}</text>
        <text v-if="store.currentCard.phonetic" class="b10-vocab-card__phonetic v2-vocab-phonetic">{{ store.currentCard.phonetic }}</text>
        <button v-if="vocabPlayable(store.currentCard.audioUrl)" class="v2-vocab-play" type="button" data-vocab-play @click="playAudio">播放</button>
        <text v-else class="v2-vocab-silent" data-vocab-silent>没有发音，不能播放。</text>
        <text v-if="store.currentCard.hint && !store.currentCard.revealed" class="b10-vocab-card__hint v2-vocab-hint">{{ store.currentCard.hint }}</text>
        <text v-if="!store.currentCard.revealed" class="b10-vocab-card__privacy v2-vocab-privacy">正面不展示释义、例句或标准答案。</text>
        <button tabindex="0" role="button" v-if="!store.currentCard.revealed" class="yx-button v2-vocab-reveal" type="button" :disabled="store.status === 'loading'" @click="reveal">{{ store.status === 'loading' ? b10T('vocab.revealing') : b10T('vocab.reveal') }}</button>
        <view v-else class="b10-vocab-card__back v2-vocab-back">
          <text class="b10-vocab-card__meaning v2-vocab-meaning">{{ store.currentCard.meaningCn ?? b10T('vocab.noAnswer') }}</text>
          <text v-if="store.currentCard.definitionEn" class="b10-vocab-card__definition v2-vocab-definition">{{ store.currentCard.definitionEn }}</text>
          <view v-if="store.currentCard.examples.length" class="b10-vocab-card__examples v2-vocab-examples"><text v-for="example in store.currentCard.examples" :key="example" class="v2-vocab-example">{{ example }}</text></view>
          <text v-if="store.currentCard.dueLocalDate" class="b10-vocab-card__due v2-vocab-due">{{ b10T('vocab.due') }}：{{ store.currentCard.dueLocalDate }}</text>
          <text class="b10-vocab-card__label v2-vocab-rate-label">{{ b10T('vocab.rate') }}</text>
          <view class="b10-vocab-card__ratings v2-vocab-ratings"><button tabindex="0" role="button" v-for="option in ratingOptions" :key="option.value" class="b10-rating v2-vocab-rate" type="button" :disabled="store.currentCard.reviewStatus !== 'PENDING'" @click="rate(option.value)">{{ option.value }} · {{ option.label }}</button></view>
        </view>
      </view>

      <view v-else-if="completed" class="yx-card b10-empty v2-vocab-card v2-vocab-done"><text class="b10-empty__title v2-vocab-done-title">今日复习已完成</text><text class="v2-vocab-done-desc">本批次的复习事件已逐条获得服务端确认；若有待同步项，状态栏会保留队列。</text><button tabindex="0" role="button" class="yx-button v2-vocab-retry" type="button" @click="load">刷新复习队列</button></view>
      <view v-else-if="store.status === 'idle'" class="yx-card b10-empty v2-vocab-card v2-vocab-empty"><text class="b10-empty__title v2-vocab-empty-title">等待读取词汇批次</text><text class="v2-vocab-empty-desc">身份与页面初始化完成后，将从学习服务读取当前复习队列。</text></view>
      <view v-else-if="store.status === 'loading'" class="yx-card b10-empty v2-vocab-card v2-vocab-empty"><text class="v2-vocab-empty-desc">{{ b10T('status.loading') }}</text></view>
      <view v-else-if="store.status === 'empty'" class="yx-card b10-empty v2-vocab-card v2-vocab-empty"><text class="b10-empty__title v2-vocab-empty-title">{{ b10T('vocab.empty') }}</text><text class="v2-vocab-empty-desc">{{ store.message ?? b10T('status.noSample') }}</text><button tabindex="0" role="button" class="yx-button v2-vocab-retry" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
      <view v-else class="yx-card b10-empty v2-vocab-card v2-vocab-empty"><text class="b10-empty__title v2-vocab-empty-title">词汇批次暂时不可用</text><text class="v2-vocab-empty-desc">{{ store.message ?? '请根据上方状态重试；未确认的复习不会被显示为已完成。' }}</text><button tabindex="0" role="button" class="yx-button v2-vocab-retry" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
      <view class="b10-links v2-vocab-links"><button tabindex="0" role="button" class="yx-button yx-button--secondary v2-vocab-link" type="button" @click="open('/pages/assessment/assessment')">基础练习</button><button tabindex="0" role="button" class="yx-button yx-button--secondary v2-vocab-link" type="button" @click="open('/pages/b10-report/b10-report')">错题与报告</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-vocab-card{display:grid;gap:20rpx}.b10-vocab-card__meta{display:flex;justify-content:space-between;color:var(--yx-text-tertiary);font-size:22rpx}.b10-vocab-card__word{text-align:center;font-size:76rpx;font-weight:800;line-height:1.15}.b10-vocab-card__phonetic,.b10-vocab-card__hint,.b10-vocab-card__privacy,.b10-vocab-card__definition,.b10-vocab-card__due{color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6;text-align:center}.b10-vocab-card__privacy{color:var(--yx-text-tertiary);font-size:21rpx}.b10-vocab-card__back{display:grid;gap:16rpx}.b10-vocab-card__meaning{text-align:center;font-size:40rpx;font-weight:750}.b10-vocab-card__examples{display:grid;gap:10rpx;padding:18rpx;border-radius:14rpx;background:var(--yx-surface-soft);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.6}.b10-vocab-card__label{color:var(--yx-text-secondary);font-size:23rpx}.b10-vocab-card__ratings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.b10-rating{min-height:84rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:24rpx}.b10-rating:disabled{opacity:.55}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}.b10-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
/* v2 词汇复习页换皮：对齐 mobile/styles.css 与 refine.css 中 .word-card/.word-actions/.fb/.btn，对齐 practice.vue v2-practice-* 卡片数值，仅用 var(--v2-*)。 */
.v2-vocab-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font)}
.v2-vocab-progress{display:grid;gap:var(--v2-space-2)}
.v2-vocab-card{box-sizing:border-box;display:grid;gap:var(--v2-space-4);justify-items:center;width:100%;min-height:260px;padding:var(--v2-space-8) var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);text-align:center}
.v2-vocab-meta{display:flex;align-items:center;justify-content:space-between;width:100%;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.7}
.v2-vocab-source{display:inline-block;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:600;line-height:1.5}
.v2-vocab-mastery{display:inline-block;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:600;line-height:1.5}
.v2-vocab-word{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-2xl);font-weight:700;line-height:1.2;text-align:center}
.v2-vocab-phonetic{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:center}
.v2-vocab-play{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-width:160px;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-brand);border-radius:var(--v2-radius-md);background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5;white-space:nowrap}
.v2-vocab-play:active{transform:scale(.97)}
.v2-vocab-play:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-vocab-play:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-vocab-silent{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:center}
.v2-vocab-hint{display:block;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:center}
.v2-vocab-privacy{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.7;text-align:center}
.v2-vocab-reveal{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-width:160px;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-brand);border-radius:var(--v2-radius-md);background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5;white-space:nowrap}
.v2-vocab-reveal:active{transform:scale(.97)}
.v2-vocab-reveal:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-vocab-reveal:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-vocab-back{display:grid;gap:var(--v2-space-3);width:100%;text-align:center}
.v2-vocab-meaning{display:block;color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.4;text-align:center}
.v2-vocab-definition{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:center}
.v2-vocab-examples{display:grid;gap:var(--v2-space-2);width:100%;box-sizing:border-box;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:left}
.v2-vocab-example{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-vocab-due{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.7;text-align:center}
.v2-vocab-rate-label{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.7;text-align:center}
.v2-vocab-ratings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);width:100%}
.v2-vocab-rate{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap}
.v2-vocab-rate:hover{border-color:var(--v2-brand)}
.v2-vocab-rate:active{transform:scale(.97)}
.v2-vocab-rate:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-vocab-rate:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-vocab-rate:nth-child(1){background:var(--v2-bad-soft);color:var(--v2-bad);border-color:var(--v2-bad-soft)}
.v2-vocab-rate:nth-child(2){background:var(--v2-warn-soft);color:var(--v2-warn);border-color:var(--v2-warn-soft)}
.v2-vocab-rate:nth-child(3){background:var(--v2-ok-soft);color:var(--v2-ok);border-color:var(--v2-ok-soft)}
.v2-vocab-rate:nth-child(4){background:var(--v2-ok-soft);color:var(--v2-ok);border-color:var(--v2-ok-soft)}
.v2-vocab-done{display:grid;gap:var(--v2-space-3);justify-items:center;width:100%;text-align:center}
.v2-vocab-done-title{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.4;text-align:center}
.v2-vocab-done-desc{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:center}
.v2-vocab-retry{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-width:160px;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-brand);border-radius:var(--v2-radius-md);background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5;white-space:nowrap}
.v2-vocab-retry:active{transform:scale(.97)}
.v2-vocab-retry:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-vocab-retry:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-vocab-empty{display:grid;gap:var(--v2-space-3);justify-items:center;width:100%;text-align:center}
.v2-vocab-empty-title{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.4;text-align:center}
.v2-vocab-empty-desc{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;text-align:center}
.v2-vocab-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);width:100%}
.v2-vocab-link{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-soft);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap}
.v2-vocab-link:active{transform:scale(.97)}
.v2-vocab-link:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-vocab-link:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
</style>
