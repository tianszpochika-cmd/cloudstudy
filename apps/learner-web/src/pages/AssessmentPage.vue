<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const selected = ref('')
const startedAt = ref(Date.now())
const question = computed(() => store.assessment.currentQuestion)
const report = computed(() => store.assessment.report)
const isDone = computed(() => store.assessment.status === 'completed')
const totalSteps = computed(() => question.value?.totalSteps ?? (report.value ? Math.max(1, store.assessmentProgress) : 10))
const progressLabel = computed(() => question.value ? `${store.assessmentProgress}/${totalSteps.value}` : isDone.value ? '已完成' : `${store.assessmentProgress}/${totalSteps.value}`)
const isLoading = computed(() => store.assessmentStatus === 'loading' || store.assessment.status === 'submitting')
const hasError = computed(() => ['offline', 'forbidden', 'content-unavailable', 'error'].includes(store.assessmentStatus) && !question.value)
onMounted(() => { store.restore(); void store.loadAssessment(); startedAt.value = Date.now() })
async function submit(): Promise<void> { if (!selected.value) return; const answer = selected.value; selected.value = ''; await store.submitAnswer(answer, (Date.now() - startedAt.value) / 1000); startedAt.value = Date.now() }
async function fastTrack(level: 'ZERO_A1' | 'CET4_B1' | 'CET6_B2' | 'POSTGRAD_B2_PLUS'): Promise<void> { await store.applyFastTrack(level) }
async function restart(): Promise<void> { selected.value = ''; startedAt.value = Date.now(); await store.restartAssessment() }
function retry(): void { void store.loadAssessment() }
</script>
<template>
  <section class="page-stack" aria-labelledby="assessment-title"><div class="hero-panel"><div><p class="eyebrow">B9 · CONTENT VERSIONED PLACEMENT</p><h2 id="assessment-title">用服务端题目找到今天的起点。</h2><p>题目由内容 read model 版本化提供；答案规则只由 assessment 服务端判定，不进入页面模型。</p></div><div class="hero-panel__orb" aria-hidden="true">{{ progressLabel }}</div></div>
  <article v-if="isDone && report" class="result-card"><p class="card-kicker">测评完成</p><h3>{{ report.cefrLevel }} · {{ Math.round(report.score) }} 分</h3><p>{{ report.recommendedAdvice }}</p><div class="result-grid"><span><strong>{{ report.estimatedVocabulary }}</strong><small>估算词汇量</small></span><span><strong>{{ report.radarScores.vocab }}%</strong><small>词汇掌握</small></span><span><strong>{{ report.radarScores.listening }}%</strong><small>听力表现</small></span></div><div class="result-actions"><button class="button button--primary" type="button" @click="router.push({ name: 'today' })">查看今日任务</button><button class="button button--secondary" type="button" @click="restart">重新开始测评</button></div></article>
  <article v-else-if="question" class="question-card"><div class="question-meta"><span>{{ question.helperText }}</span><span>{{ question.stepIndex }}/{{ question.totalSteps }}</span></div><h3>{{ question.stemText }}</h3><div class="options"><button v-for="option in question.options" :key="option.key" class="option" :class="{ selected: selected === option.key }" type="button" @click="selected = option.key"><b>{{ option.key }}</b><span>{{ option.text }}</span></button></div><button class="button button--primary" type="button" :disabled="!selected || store.assessment.status === 'submitting'" @click="submit">{{ store.assessment.status === 'submitting' ? '正在记录…' : '提交答案' }}</button></article>
  <article v-else-if="isLoading" class="info-card" role="status"><h3>正在准备测评</h3><p>正在读取服务端内容投影，不会在页面推断答案或成绩。</p></article>
  <article v-else-if="hasError" class="info-card" role="alert"><h3>测评暂时不可用</h3><p>{{ store.lastError || '服务端暂时没有返回可用的测评内容。' }}</p><button class="button button--primary" type="button" @click="retry">重试</button></article>
  <article v-else class="info-card"><h3>暂无可用测评</h3><p>服务端内容投影尚未返回时，系统会保留可恢复入口，不会显示答案规则。</p><button class="button button--primary" type="button" @click="retry">重新读取</button></article>
  <details class="fast-track"><summary>已有成绩？快速定级</summary><div class="tag-list"><button class="tag" type="button" @click="fastTrack('ZERO_A1')">零基础 A1</button><button class="tag" type="button" @click="fastTrack('CET4_B1')">四级 B1</button><button class="tag" type="button" @click="fastTrack('CET6_B2')">六级 B2</button></div></details><p v-if="store.lastError" class="error-text" role="alert">{{ store.lastError }}</p></section>
</template>
<style scoped>.question-card,.result-card{padding:32px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.question-meta{display:flex;justify-content:space-between;color:var(--yx-color-brand-primary);font-size:13px;font-weight:700}.question-card h3,.result-card h3{margin:26px 0;font-size:clamp(22px,4vw,32px);line-height:1.4}.options{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}.option{display:flex;gap:12px;padding:18px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card);text-align:left}.option b{color:var(--yx-color-brand-primary)}.option.selected{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.result-grid{display:flex;gap:12px;margin:24px 0}.result-grid span{display:grid;gap:5px;min-width:120px;padding:14px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.result-grid strong{color:var(--yx-color-brand-primary);font-size:22px}.result-grid small{color:var(--yx-color-text-secondary)}.fast-track{padding:18px 20px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card)}.fast-track summary{cursor:pointer;color:var(--yx-color-text-secondary)}.tag-list{display:flex;gap:10px;margin-top:16px}.tag{padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card)}.error-text{color:var(--yx-color-danger)}@media(max-width:640px){.options{grid-template-columns:1fr}.question-card,.result-card{padding:22px}.result-grid{flex-wrap:wrap}}
</style>
