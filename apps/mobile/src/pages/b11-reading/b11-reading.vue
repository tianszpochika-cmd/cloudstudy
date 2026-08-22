<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { PerformanceLevel } from '@englishflow/performance'
import B11StatusPanel from '../../components/b11/B11StatusPanel.vue'
import { b11T, b11ThemeMode } from '../../platform/b11-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB11LearningStore } from '../../stores/b11-learning'
import type { ReadingQuestion } from '../../domain/b3'

const session = useSessionStore()
const store = useB11LearningStore()
const themeClass = computed(() => `b10-theme--${b11ThemeMode.value}`)
const blockText = computed(() => store.currentReadingBlock?.text ?? '')
const blockTranslation = computed(() => store.currentReadingBlock?.translation ?? '')

async function load(): Promise<void> { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; await store.loadReading() }
function setPerformance(level: PerformanceLevel): void { store.setPerformance(level) }
function setMotion(disabled: boolean): void { store.setMotionDisabled(disabled) }
function sync(): void { void store.syncOffline() }
function nextBlock(): void { store.setReadingBlock(store.readingBlockIndex + 1) }
function setAnswer(question: ReadingQuestion, event: { detail: { value: string } }): void { store.readingAnswers[String(question.questionId)] = event.detail.value }
onMounted(() => { void load() })
</script>

<template>
  <view class="yx-page b11-page" :class="themeClass">
    <text class="yx-eyebrow">{{ b11T('reading.eyebrow') }}</text>
    <text class="yx-title">{{ b11T('reading.title') }}</text>
    <text class="yx-description">{{ b11T('reading.description') }}</text>
    <B11StatusPanel :status="store.readingStatus" :message="store.readingMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="setMotion" />

    <view v-if="store.reading" class="yx-card reader-card">
      <view class="reader-heading"><view><text class="kicker">{{ store.reading.article.cefrLevel }} · {{ store.reading.article.wordCount }} words</text><text class="card-title">{{ store.reading.article.title }}</text></view><text class="subtle">{{ b11T('common.contentVersion') }} {{ store.reading.contentVersion }}</text></view>
      <view class="progress-track"><view class="progress-value" :style="{ width: `${store.readingProgress}%` }"></view></view><text class="subtle">{{ store.readingProgress }}% · 第 {{ store.readingBlockIndex + 1 }} / {{ store.reading.article.blocks.length }} 段</text>
      <view class="reading-block"><text>{{ blockText }}</text><text v-if="blockTranslation" class="translation">{{ blockTranslation }}</text></view>
      <view class="reader-actions"><button class="small-button" type="button" @click="store.setReadingBlock(store.readingBlockIndex - 1)">上一段</button><button class="small-button" type="button" @click="nextBlock">{{ b11T('reading.next') }}</button><button class="yx-button" type="button" @click="store.saveReadingPosition(true)">{{ b11T('reading.save') }}</button></view>
      <view v-if="store.reading.questions.length" class="question-list"><text class="kicker">{{ b11T('reading.question') }}</text><view v-for="question in store.reading.questions" :key="question.questionId" class="question"><text class="question-stem">{{ question.stemText }}</text><radio-group @change="setAnswer(question, $event)"><label v-for="option in question.options" :key="option.optionCode" class="option"><radio :value="option.optionCode" :checked="store.readingAnswers[String(question.questionId)] === option.optionCode" /><text>{{ option.label }}</text></label></radio-group><button class="small-button" type="button" :disabled="Boolean(store.readingAttempts[String(question.questionId)])" @click="store.submitReadingAnswer(question)">{{ b11T('reading.submit') }}</button><view v-if="store.readingAttempts[String(question.questionId)]" class="feedback"><text>{{ store.readingAttempts[String(question.questionId)].correct ? '服务端规则判定正确' : '服务端已记录本次练习' }}</text><text>{{ store.readingAttempts[String(question.questionId)].feedbackCode }}</text></view></view></view>
    </view>
    <view v-else-if="store.readingStatus !== 'loading'" class="yx-card empty"><text>{{ b11T('reading.noArticle') }}</text><text class="subtle">{{ b11T('common.noSample') }}</text><button class="yx-button" type="button" @click="load">{{ b11T('status.retry') }}</button></view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.reader-card,.question-list,.question,.reading-block{display:grid;gap:18rpx}.reader-heading{display:flex;justify-content:space-between;gap:16rpx}.reader-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.card-title{font-size:35rpx;font-weight:750}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.progress-track{height:12rpx;overflow:hidden;border-radius:8rpx;background:var(--yx-border)}.progress-value{height:100%;border-radius:8rpx;background:var(--yx-brand)}.reading-block{padding:24rpx;border-radius:16rpx;color:var(--yx-text-primary);background:var(--yx-surface-soft);font-size:31rpx;line-height:1.8}.translation{color:var(--yx-text-secondary);font-size:25rpx}.reader-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.reader-actions .yx-button{grid-column:1/-1}.small-button{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.question{padding:20rpx;border:1rpx solid var(--yx-border);border-radius:14rpx}.question-stem{font-size:28rpx;font-weight:700;line-height:1.5}.option{display:flex;align-items:center;gap:10rpx;padding:12rpx 0;color:var(--yx-text-secondary);font-size:25rpx}.feedback{display:grid;gap:6rpx;padding:16rpx;border-radius:12rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:23rpx}.empty{display:grid;gap:14rpx}
</style>
