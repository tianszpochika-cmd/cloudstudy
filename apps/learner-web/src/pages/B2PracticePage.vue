<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import B10PracticeQuestion from '../components/b10/B10PracticeQuestion.vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import type { B10PerformanceLevel } from '../domain/b10'

import '../platform/b10-i18n'

const route = useRoute()
const ui = useLearningUi()
const store = useB10Store()
const sessionId = computed(() => typeof route.query.sessionId === 'string' ? route.query.sessionId : null)
const question = computed(() => store.currentQuestion)
const initialAnswer = computed(() => question.value ? store.practiceAnswer(question.value.id) : undefined)
const progress = computed(() => store.practice?.questions.length ? Math.round(((store.practice.currentIndex + 1) / store.practice.questions.length) * 100) : 0)

onMounted(() => { store.restore(); if (sessionId.value) void store.loadPractice(sessionId.value); else void store.startPractice('DAILY') })
function retry(): void { if (sessionId.value) void store.loadPractice(sessionId.value); else void store.startPractice('DAILY') }
function sync(): void { void store.syncOffline() }
function performance(level: B10PerformanceLevel): void { store.setPerformanceLevel(level) }
function answer(value: unknown): void { if (question.value) store.setPracticeAnswer(question.value.id, value); void store.submitCurrentAnswer(value) }
</script>

<template>
  <main class="b10-page" :data-performance="store.performanceLevel" aria-labelledby="practice-title">
    <header class="page-heading"><div><p class="eyebrow">ASM · RULED PRACTICE</p><h2 id="practice-title">{{ ui.t('b10.practice.title') }}</h2><p>{{ ui.t('b10.common.noAnswerRule') }}</p></div><span class="locale-pill">{{ ui.t('b10.common.ui') }} {{ ui.locale }} · {{ ui.t('b10.common.content') }} {{ ui.contentLocale }}</span></header>
    <B10StatePanel v-if="store.practiceStatus !== 'ready' || store.practiceMessage" :status="store.practiceStatus" :message="store.practiceMessage" :queue-count="store.queueCount" module-label="ASM / PRACTICE" :performance-level="store.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <section v-if="store.practice && question" class="practice-layout">
      <article class="practice-main"><div class="practice-progress"><div><span>{{ ui.t('b10.practice.progress', { current: store.practice.currentIndex + 1, total: store.practice.questions.length }) }}</span><span>{{ progress }}%</span></div><progress :value="progress" max="100">{{ progress }}%</progress></div><B10PracticeQuestion :question="question" :initial-answer="initialAnswer" :disabled="store.practiceSubmitting || Boolean(store.practiceFeedback)" :performance-level="store.performanceLevel" @answer="answer" /><section v-if="store.practiceFeedback" class="feedback" :class="{ 'feedback--wrong': store.practiceFeedback.correct === false }" role="status" aria-live="polite"><strong>{{ store.practiceFeedback.correct === true ? '规则命中' : store.practiceFeedback.correct === false ? '需要修复' : '服务端已接收' }}</strong><span v-if="store.practiceFeedback.feedbackCode">{{ store.practiceFeedback.feedbackCode }}</span><p v-if="store.practiceFeedback.message">{{ store.practiceFeedback.message }}</p><small v-if="store.practiceFeedback.ruleVersion">规则版本：{{ store.practiceFeedback.ruleVersion }}</small><button class="primary-button" type="button" @click="store.nextPractice">{{ ui.t('b10.practice.next') }}</button></section></article>
      <aside class="side-panel"><h3>{{ ui.t('b10.practice.checkpoint') }}</h3><p>会话：{{ store.practice.sessionId }}</p><p>服务端断点：{{ store.practice.checkpointSeq }}</p><p v-if="store.practiceAnswer(question.id) !== undefined">{{ ui.t('b10.practice.draft') }}</p><button class="secondary-button" type="button" @click="store.saveCheckpoint()">{{ ui.t('b10.practice.checkpoint') }}</button></aside>
    </section>
    <section v-else-if="store.practiceStatus === 'empty'" class="empty-panel"><strong>{{ ui.t('b10.practice.noQuestions') }}</strong><p>{{ ui.t('b10.state.empty') }}</p></section>
  </main>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:680px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.practice-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}.practice-main{display:grid;gap:16px}.practice-progress,.side-panel,.empty-panel{padding:20px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.practice-progress>div{display:flex;justify-content:space-between;color:var(--yx-color-text-secondary);font-size:13px}.practice-progress progress{width:100%;height:9px;margin-top:12px;accent-color:var(--yx-color-brand-primary)}.feedback{display:grid;gap:7px;padding:18px;border:1px solid var(--yx-color-success);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.feedback--wrong{border-color:var(--yx-color-warning)}.feedback p{margin:0;color:var(--yx-color-text-secondary);line-height:1.6}.feedback small,.feedback span{color:var(--yx-color-text-secondary);font-size:12px}.primary-button,.secondary-button{min-height:44px;padding:0 16px;border-radius:12px;font-weight:800}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.side-panel{display:grid;align-content:start;gap:10px;height:max-content}.side-panel h3{margin:0}.side-panel p{margin:0;color:var(--yx-color-text-secondary);line-height:1.6}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:800px){.page-heading{align-items:flex-start;flex-direction:column}.practice-layout{grid-template-columns:1fr}.side-panel{order:-1}}
</style>
