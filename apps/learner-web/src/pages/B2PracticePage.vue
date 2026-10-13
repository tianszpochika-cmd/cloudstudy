<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLearnerContentStore } from '../stores/learner-content'
import { acceptSubmission, resumeView, showPracticeReward } from '../domain/practice-loop'

const router = useRouter()
const store = useLearnerContentStore()
const selectedKey = ref('')
const startedAt = ref(Date.now())
const submitting = ref(false)

const question = computed(() => store.assessment.currentQuestion)
const report = computed(() => store.assessment.report)
const isCompleted = computed(() => store.assessment.status === 'completed' || Boolean(report.value))
const isLoading = computed(() => store.assessmentStatus === 'loading' || store.assessment.status === 'submitting')
const scorePercent = computed(() => Math.round(report.value?.score ?? 0))
const resume = computed(() => {
  const offline = Boolean(store.lastError?.includes('内容已下线'))
  const received = store.assessment.acceptedSequence ?? 0
  if (!question.value && !offline && received <= 0) return null
  return resumeView({
    received,
    resumeIndex: received > 0 ? received : question.value?.stepIndex,
    contentOffline: offline,
  })
})
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
  if (!selectedKey.value || !question.value || !acceptSubmission(submitting.value)) return
  const answer = selectedKey.value
  selectedKey.value = ''
  submitting.value = true
  try {
    await store.submitAnswer(answer, (Date.now() - startedAt.value) / 1000)
    startedAt.value = Date.now()
  } finally {
    submitting.value = false
  }
}

function openToday(): void {
  void router.push({ name: 'today' })
}

onMounted(() => { void load() })
</script>

<template>
  <section class="real-practice-page v2-page v2-page--practice" aria-labelledby="practice-title">
    <ExperienceHeader page="Practice" icon="check" title-id="practice-title" />

    <div class="v2-practice-layout">
      <div class="v2-practice-main">
        <section v-if="isCompleted && report" class="result-panel v2-practice-card" aria-live="polite">
          <p class="card-kicker">历史两题练习结果</p>
          <h3>{{ report.cefrLevel }} · {{ scorePercent }} 分</h3>
          <p>旧版练习仅供参考，不能代替四维定级。</p>
          <p v-if="!showPracticeReward()" data-reward-hidden>本次练习已完成。</p>
          <div class="actions">
            <button class="primary-button" type="button" @click="openToday">查看今日任务</button>
            <button class="secondary-button" type="button" @click="void load()">重新读取报告</button>
          </div>
        </section>

        <p v-if="resume?.stopped" data-offline-exit role="status">{{ resume.copy }}</p>
        <section v-else-if="question" class="question-panel v2-practice-card">
          <p data-resume>{{ resume?.copy }}</p>
          <div class="question-meta">
            <span>{{ ({ GRAMMAR: '语法', VOCABULARY: '词汇', LISTENING: '听力' } as Record<string, string>)[question.dimension] ?? question.dimension }} · 第 {{ question.stepIndex }} / {{ question.totalSteps }} 题</span>
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
          <button class="primary-button" type="button" data-single-submit :disabled="!selectedKey || isLoading || submitting" @click="void submit()">
            {{ isLoading ? '正在记录…' : '提交答案' }}
          </button><small v-if="!selectedKey && !isLoading && !submitting" class="disabled-reason" data-disabled-reason>先选择一个选项，再提交。</small>
        </section>

        <section v-else-if="isLoading" class="state-panel v2-practice-card" role="status" aria-live="polite">
          <strong>正在读取真实练习</strong>
          <p>正在读取测评状态…</p>
        </section>

        <section v-else class="state-panel state-panel--error v2-practice-card" role="alert">
          <strong>{{ store.lastError ? '真实练习暂时不可用' : '当前没有可用练习题' }}</strong>
          <p>{{ store.lastError || '服务端尚未返回可用的已发布测评内容。' }}</p>
          <button class="secondary-button" type="button" @click="void load()">重新读取</button>
        </section>

        <p v-if="store.pendingAssessmentAnswers.length" class="pending-note" role="status">
          有 {{ store.pendingAssessmentAnswers.length }} 条答案等待服务端确认；未确认前不会显示为完成。
        </p>
      </div>
      <aside class="v2-practice-guide" aria-label="操作提示"><p class="card-kicker">专注练习</p><h3>一次完成一小步</h3><ol><li>先读题目与材料。</li><li>选择答案后提交。</li><li>对照反馈理解，再继续。</li></ol><p class="muted">退出页面会保留本机进度，回来后从原来的位置继续。</p><ul class="v2-practice-keys"><li><kbd>Tab</kbd> 移动焦点</li><li><kbd>Enter</kbd> 执行选中操作</li></ul><RouterLink class="button button--ghost" :to="{ name: 'today' }">返回今日任务</RouterLink></aside>
    </div>
  </section>
</template>

<style scoped>
.real-practice-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.source-badge{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px;white-space:nowrap}.question-panel,.result-panel,.state-panel{padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.question-panel{display:grid;gap:18px}.question-meta{display:flex;justify-content:space-between;color:var(--yx-color-brand-primary);font-size:13px;font-weight:750}.question-panel progress{width:100%;height:9px;accent-color:var(--yx-color-brand-primary)}.question-panel h3,.result-panel h3{margin:4px 0;font-size:clamp(24px,4vw,36px);line-height:1.4}.helper-text,.result-panel>p:not(.card-kicker),.state-panel p{margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.option{display:flex;align-items:flex-start;gap:12px;min-height:60px;padding:16px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);text-align:left}.option:disabled{cursor:not-allowed;opacity:.7}.option b{color:var(--yx-color-brand-primary)}.option.selected{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.card-kicker{margin:0;color:var(--yx-color-brand-primary);font-size:13px;font-weight:800;letter-spacing:.12em}.result-panel{display:grid;gap:14px}.result-grid{display:flex;flex-wrap:wrap;gap:12px}.result-grid span{display:grid;gap:5px;min-width:128px;padding:14px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.result-grid strong{color:var(--yx-color-brand-primary);font-size:22px}.result-grid small{color:var(--yx-color-text-secondary)}.actions{display:flex;flex-wrap:wrap;gap:10px}.primary-button,.secondary-button{min-height:44px;padding:0 16px;border-radius:12px;font-weight:800}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button:disabled{cursor:not-allowed;opacity:.55}.state-panel{display:grid;gap:10px;min-height:140px;align-content:center}.state-panel--error{border-color:var(--yx-color-danger)}.pending-note{margin:0;color:var(--yx-color-warning);font-size:13px}@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.source-badge{white-space:normal}.options{grid-template-columns:1fr}.question-panel,.result-panel,.state-panel{padding:22px}}
</style>

<style>
.v2-page--practice .v2-practice-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
.v2-page--practice .v2-practice-main { display: grid; gap: 16px; min-width: 0; }
.v2-page--practice .v2-practice-card { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: 28px; }
.v2-page--practice .question-meta { color: var(--v2-brand); font-size: 12px; font-weight: 700; letter-spacing: .5px; }
.v2-page--practice progress { accent-color: var(--v2-brand); height: 6px; }
.v2-page--practice .question-panel h3 { font-size: 26px; letter-spacing: -.6px; color: var(--v2-ink); line-height: 1.45; }
.v2-page--practice .options .option { border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); background: var(--v2-card); color: var(--v2-ink); min-height: 52px; transition: border-color var(--v2-motion-fast), background var(--v2-motion-fast); }
.v2-page--practice .options .option:hover:not(:disabled) { border-color: var(--v2-brand2); background: var(--v2-surface); }
.v2-page--practice .options .option.selected { border-color: var(--v2-brand); background: var(--v2-soft); box-shadow: 0 0 0 1px var(--v2-brand) inset; }
.v2-page--practice .options .option b { color: var(--v2-brand); }
.v2-page--practice .primary-button { background: var(--v2-brand); color: var(--v2-inverse); border-radius: var(--v2-radius-md); min-height: 46px; font-weight: 700; }
.v2-page--practice .primary-button:disabled { opacity: .45; }
.v2-page--practice .secondary-button { background: var(--v2-soft); color: var(--v2-brand); border-radius: var(--v2-radius-md); }
.v2-page--practice .v2-practice-guide { position: sticky; top: 96px; display: flex; flex-direction: column; gap: 10px; padding: 22px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); font-size: 13px; }
.v2-page--practice .v2-practice-guide h3 { margin: 0; font-size: 18px; }
.v2-page--practice .v2-practice-guide ol { margin: 0; padding-left: 18px; color: var(--v2-ink); line-height: 1.9; }
.v2-page--practice .v2-practice-keys { list-style: none; margin: 0; padding: 10px 0 0; border-top: 1px solid var(--v2-line); display: grid; gap: 6px; color: var(--v2-mut); font-size: 12px; }
.v2-page--practice .v2-practice-keys kbd { border: 1px solid var(--v2-line); border-radius: 4px; padding: 1px 6px; background: var(--v2-surface); font: inherit; }
@media (max-width: 900px) { .v2-page--practice .v2-practice-layout { grid-template-columns: 1fr; } .v2-page--practice .v2-practice-guide { position: static; } }
</style>
