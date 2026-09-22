<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const selectedKey = ref('')
const startedAt = ref(Date.now())

const question = computed(() => store.assessment.currentQuestion)
const report = computed(() => store.assessment.report)
const isCompleted = computed(() => store.assessment.status === 'completed' || Boolean(report.value))
const isLoading = computed(() => store.assessmentStatus === 'loading' || store.assessment.status === 'submitting')
const scorePercent = computed(() => Math.round((report.value?.score ?? 0) * 100))
const progress = computed(() => {
  const current = question.value
  if (!current) return report.value ? 100 : 0
  return Math.min(100, Math.round(((current.stepIndex - 1) / Math.max(1, current.totalSteps)) * 100))
})

async function load(): Promise<void> {
  selectedKey.value = ''
  startedAt.value = Date.now()
  await store.loadAssessment()
}

async function submit(): Promise<void> {
  if (!selectedKey.value || !question.value) return
  const answer = selectedKey.value
  selectedKey.value = ''
  await store.submitAnswer(answer, (Date.now() - startedAt.value) / 1000)
  startedAt.value = Date.now()
}

function openToday(): void {
  void router.push({ name: 'today' })
}

onMounted(() => { void load() })
</script>

<template>
  <section class="real-practice-page" aria-labelledby="practice-title">
    <ExperienceHeader page="Practice" icon="check" title-id="practice-title" />

    <section v-if="isCompleted && report" class="result-panel" aria-live="polite">
      <p class="card-kicker">练习已完成</p>
      <h3>{{ report.cefrLevel }} · {{ scorePercent }} 分</h3>
      <p>{{ report.recommendedAdvice || '结果来自服务端规则判分。' }}</p>
      <div class="result-grid">
        <span><strong>{{ report.estimatedVocabulary }}</strong><small>估算词汇量</small></span>
        <span><strong>{{ report.radarScores.vocab }}%</strong><small>词汇掌握</small></span>
        <span><strong>{{ report.radarScores.listening }}%</strong><small>听力表现</small></span>
      </div>
      <div class="actions">
        <button class="primary-button" type="button" @click="openToday">查看今日任务</button>
        <button class="secondary-button" type="button" @click="void load()">重新读取报告</button>
      </div>
    </section>

    <section v-else-if="question" class="question-panel">
      <div class="question-meta">
        <span>{{ question.dimension }} · {{ question.stepIndex }} / {{ question.totalSteps }}</span>
        <span>{{ progress }}%</span>
      </div>
      <progress :value="progress" max="100">{{ progress }}%</progress>
      <h3>{{ question.stemText }}</h3>
      <p v-if="question.helperText" class="helper-text">{{ question.helperText }}</p>
      <div class="options">
        <button
          v-for="option in question.options"
          :key="option.key"
          class="option"
          :class="{ selected: selectedKey === option.key }"
          type="button"
          :disabled="isLoading"
          @click="selectedKey = option.key"
        >
          <b>{{ option.key }}</b>
          <span>{{ option.text }}</span>
        </button>
      </div>
      <button class="primary-button" type="button" :disabled="!selectedKey || isLoading" @click="void submit()">
        {{ isLoading ? '正在记录…' : '提交答案' }}
      </button>
    </section>

    <section v-else-if="isLoading" class="state-panel" role="status" aria-live="polite">
      <strong>正在读取真实练习</strong>
      <p>正在从 Gateway、assessment-service 和 MySQL 读取当前测评状态。</p>
    </section>

    <section v-else class="state-panel state-panel--error" role="alert">
      <strong>{{ store.lastError ? '真实练习暂时不可用' : '当前没有可用练习题' }}</strong>
      <p>{{ store.lastError || '服务端尚未返回可用的已发布测评内容。' }}</p>
      <button class="secondary-button" type="button" @click="void load()">重新读取</button>
    </section>

    <p v-if="store.pendingAssessmentAnswers.length" class="pending-note" role="status">
      有 {{ store.pendingAssessmentAnswers.length }} 条答案等待服务端确认；未确认前不会显示为完成。
    </p>
  </section>
</template>

<style scoped>
.real-practice-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.source-badge{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px;white-space:nowrap}.question-panel,.result-panel,.state-panel{padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.question-panel{display:grid;gap:18px}.question-meta{display:flex;justify-content:space-between;color:var(--yx-color-brand-primary);font-size:13px;font-weight:750}.question-panel progress{width:100%;height:9px;accent-color:var(--yx-color-brand-primary)}.question-panel h3,.result-panel h3{margin:4px 0;font-size:clamp(24px,4vw,36px);line-height:1.4}.helper-text,.result-panel>p:not(.card-kicker),.state-panel p{margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.option{display:flex;align-items:flex-start;gap:12px;min-height:60px;padding:16px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);text-align:left}.option:disabled{cursor:not-allowed;opacity:.7}.option b{color:var(--yx-color-brand-primary)}.option.selected{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.card-kicker{margin:0;color:var(--yx-color-brand-primary);font-size:13px;font-weight:800;letter-spacing:.12em}.result-panel{display:grid;gap:14px}.result-grid{display:flex;flex-wrap:wrap;gap:12px}.result-grid span{display:grid;gap:5px;min-width:128px;padding:14px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.result-grid strong{color:var(--yx-color-brand-primary);font-size:22px}.result-grid small{color:var(--yx-color-text-secondary)}.actions{display:flex;flex-wrap:wrap;gap:10px}.primary-button,.secondary-button{min-height:44px;padding:0 16px;border-radius:12px;font-weight:800}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button:disabled{cursor:not-allowed;opacity:.55}.state-panel{display:grid;gap:10px;min-height:140px;align-content:center}.state-panel--error{border-color:var(--yx-color-danger)}.pending-note{margin:0;color:var(--yx-color-warning);font-size:13px}@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.source-badge{white-space:normal}.options{grid-template-columns:1fr}.question-panel,.result-panel,.state-panel{padding:22px}}
</style>
