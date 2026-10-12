<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

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
  <view class="yx-page b11-page v2-b11read-page" :class="themeClass" :style="experienceStyle" :data-motion="store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion">
    <MobilePageHeader page="b11-reading" />

    <view class="v2-b11read-body">
    <B11StatusPanel :status="store.readingStatus" :message="store.readingMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="setMotion" />

    <view v-if="store.reading && store.reading.article.rightsStatus !== 'REVOKED'" class="yx-card reader-card card v2-b11read-card">
      <view class="reader-heading v2-b11read-heading"><view class="v2-b11read-titlewrap"><text class="kicker eyebrow v2-b11read-eyebrow">{{ store.reading.article.cefrLevel }} · {{ store.reading.article.wordCount }} words</text><text class="card-title v2-b11read-h2">{{ store.reading.article.title }}</text></view><text class="subtle d v2-b11read-d">{{ b11T('common.contentVersion') }} {{ store.reading.contentVersion }}</text></view>
      <view class="progress-track v2-b11read-progress"><view class="progress-value v2-b11read-progress-value" :style="{ width: `${store.readingProgress}%` }"></view></view><text class="subtle d v2-b11read-d">{{ store.readingProgress }}% · 第 {{ store.readingBlockIndex + 1 }} / {{ store.reading.article.blocks.length }} 段</text>
      <view class="reading-block v2-b11read-block"><text class="v2-b11read-passage">{{ blockText }}</text><text v-if="blockTranslation" class="translation d v2-b11read-d v2-b11read-translation">{{ blockTranslation }}</text></view>
      <view class="reader-actions actions v2-b11read-actions"><button tabindex="0" role="button" class="small-button btn sm v2-b11read-btn v2-b11read-prev" type="button" @click="store.setReadingBlock(store.readingBlockIndex - 1)"><AppIcon name="back" :size="14" />上一段</button><button tabindex="0" role="button" class="small-button btn sm v2-b11read-btn v2-b11read-next" type="button" @click="nextBlock">{{ b11T('reading.next') }}<AppIcon name="chev" :size="14" /></button><button tabindex="0" role="button" class="yx-button btn v2-b11read-btn v2-b11read-save" type="button" @click="store.saveReadingPosition(true)"><AppIcon name="check" :size="14" />{{ b11T('reading.save') }}</button></view>
      <view v-if="store.reading.questions.length" class="question-list v2-b11read-list"><text class="kicker eyebrow v2-b11read-eyebrow">{{ b11T('reading.question') }}</text><view v-for="question in store.reading.questions" :key="question.questionId" class="question card v2-b11read-card v2-b11read-question"><text class="question-stem v2-b11read-stem">{{ question.stemText }}</text><radio-group class="v2-b11read-options" @change="setAnswer(question, $event)"><label v-for="option in question.options" :key="option.optionCode" class="option opt v2-b11read-opt"><radio :value="option.optionCode" :checked="store.readingAnswers[String(question.questionId)] === option.optionCode" /><text>{{ option.label }}</text></label></radio-group><button tabindex="0" role="button" class="small-button btn sm v2-b11read-btn v2-b11read-submit" type="button" :disabled="Boolean(store.readingAttempts[String(question.questionId)])" @click="store.submitReadingAnswer(question)">{{ b11T('reading.submit') }}</button><view v-if="store.readingAttempts[String(question.questionId)]" class="feedback v2-b11read-fb"><text>{{ store.readingAttempts[String(question.questionId)].correct ? '回答正确' : '服务端已记录本次练习' }}</text><text>{{ store.readingAttempts[String(question.questionId)].feedbackCode }}</text></view></view></view>
    </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.reader-card,.question-list,.question,.reading-block{display:grid;gap:18rpx}.reader-heading{display:flex;justify-content:space-between;gap:16rpx}.reader-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.card-title{font-size:35rpx;font-weight:750}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.progress-track{height:12rpx;overflow:hidden;border-radius:8rpx;background:var(--yx-border)}.progress-value{height:100%;border-radius:8rpx;background:var(--yx-brand)}.reading-block{padding:24rpx;border-radius:16rpx;color:var(--yx-text-primary);background:var(--yx-surface-soft);font-size:31rpx;line-height:1.8}.translation{color:var(--yx-text-secondary);font-size:25rpx}.reader-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.reader-actions .yx-button{grid-column:1/-1}.small-button{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.question{padding:20rpx;border:1rpx solid var(--yx-border);border-radius:14rpx}.question-stem{font-size:28rpx;font-weight:700;line-height:1.5}.option{display:flex;align-items:center;gap:10rpx;padding:12rpx 0;color:var(--yx-text-secondary);font-size:25rpx}.feedback{display:grid;gap:6rpx;padding:16rpx;border-radius:12rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:23rpx}.empty{display:grid;gap:14rpx}
/* v2 阅读页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-b11read-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11read-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11read-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b11read-card:hover{border-color:var(--v2-brand)}
.v2-b11read-heading{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b11read-heading>*{min-width:0;max-width:100%}
.v2-b11read-titlewrap{display:flex;flex-direction:column;gap:var(--v2-space-2);flex:1 1 auto;box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11read-titlewrap>*{min-width:0;max-width:100%}
.v2-b11read-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-b11read-h2{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b11read-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b11read-progress{height:14rpx;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-2) 0 var(--v2-space-4);border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-b11read-progress-value{display:block;height:100%;border-radius:inherit;background:var(--v2-brand)}
.v2-b11read-block{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface);font-family:var(--v2-font)}
.v2-b11read-block>*{min-width:0;max-width:100%}
.v2-b11read-passage{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.8;overflow-wrap:anywhere}
.v2-b11read-translation{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b11read-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11read-actions>*{min-width:0;max-width:100%}
.v2-b11read-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b11read-btn:hover{border-color:var(--v2-brand)}
.v2-b11read-btn:active{transform:scale(.97)}
.v2-b11read-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b11read-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b11read-prev{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);white-space:nowrap;overflow-wrap:anywhere}
.v2-b11read-next{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);white-space:nowrap;overflow-wrap:anywhere}
.v2-b11read-save{grid-column:1/-1;box-sizing:border-box;max-width:100%;min-width:0;border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700;overflow-wrap:anywhere}
.v2-b11read-save:hover{border-color:var(--v2-brand)}
.v2-b11read-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding-top:var(--v2-space-4);border-top:1px solid var(--v2-line);font-family:var(--v2-font)}
.v2-b11read-question{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-b11read-question:hover{border-color:var(--v2-brand)}
.v2-b11read-question>*{min-width:0;max-width:100%}
.v2-b11read-stem{display:block;box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 100%;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b11read-options{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 100%;font-family:var(--v2-font)}
.v2-b11read-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:normal;text-align:left;overflow-wrap:anywhere}
.v2-b11read-opt:hover{border-color:var(--v2-brand)}
.v2-b11read-opt:active{transform:scale(.97)}
.v2-b11read-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b11read-submit{box-sizing:border-box;max-width:100%;min-width:0;border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700;overflow-wrap:anywhere}
.v2-b11read-submit:hover{border-color:var(--v2-brand)}
.v2-b11read-question .v2-b11read-submit{width:auto;flex:0 0 auto}
.v2-b11read-fb{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 100%;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
