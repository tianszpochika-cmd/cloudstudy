<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatePanel from '../components/StatePanel.vue'
import { useLearnerContentStore } from '../stores/learner-content'
import { userFacingError } from '../platform/user-facing-error'
import { ALGORITHM_VERSION, arrangementLabel, emptyStateView, firstLearningGuideCopy, type EmptyStateView } from '../domain/plan-today'
import { practiceFeedback } from '../domain/practice-loop'

const router = useRouter()
const store = useLearnerContentStore()
const snapshot = computed(() => store.today ?? store.home?.today ?? store.home?.home)
const tasks = computed(() => snapshot.value?.dailyStream.tasks ?? [])
const availableTask = computed(() => tasks.value.find((task) => !task.completed && task.contentCode))
const practice = computed(() => store.practiceTasks)
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const firstLearningCopy = computed(() => {
  const first = store.planQueue?.firstLearning
  return first?.guideVisible ? firstLearningGuideCopy(first.reason) : null
})
const planEmpty = computed(() => {
  if (tasks.value.length > 0 || practice.value.length > 0) return null
  if (store.planQueueStatus === 'error') return emptyStateView({ failed: true, reason: null, hasTasks: false })
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyStateView({ failed: false, reason: store.planQueue?.emptyReason ?? null, hasTasks: false })
})
function openPlanEmpty(view: EmptyStateView): void {
  if (view.to === 'retry') { void store.loadToday(); return }
  void router.push({ name: view.to })
}
const selections = ref<Record<string, string>>({})
function practiceResult(taskId: string) {
  const result = store.practiceResults[taskId]
  if (!result) return null
  return practiceFeedback({ correct: result.correct })
}
function submitPractice(taskId: string): void {
  const optionKey = selections.value[taskId]
  if (!optionKey) return
  void store.submitPracticeTodayTask(taskId, optionKey)
}
onMounted(() => { store.restore(); void store.loadToday() })
function startTask(id: string): void {
  const task = tasks.value.find(item => item.id === id)
  if (!task) return
  if (!task.contentCode) { void router.push({ name: 'courses' }); return }
  void router.push({ name: 'learn-session', query: { taskId: task.id, contentCode: task.contentCode } })
}
function continueLearning(): void {
  const task = availableTask.value
  if (!task?.contentCode) { void router.push({ name: 'courses' }); return }
  void router.push({ name: 'learn-session', query: { contentCode: task.contentCode, taskId: task.id } })
}
</script>

<template>
  <section class="page-stack v2-page v2-page--today" aria-labelledby="today-title">
    <ExperienceHeader page="Today" icon="target" title-id="today-title" hero />
    <StatePanel v-if="store.todayStatus === 'loading'" state="loading" title="今日任务" description="正在读取今日任务。" />
    <StatePanel v-else-if="store.todayStatus === 'offline'" state="offline" title="今日任务" description="网络暂时不可用，请重试。" action-label="重试" @action="() => { void store.loadToday() }" />
    <StatePanel v-else-if="store.lastError" state="error" title="今日任务" :description="userFacingError(store.lastError, '暂时无法读取今日任务，请稍后重试。')" action-label="重试" @action="() => { void store.loadToday() }" />
    <article v-else class="task-list v2-today">
      <p data-algorithm class="v2-sr-only">{{ store.planQueue?.algorithmVersion || ALGORITHM_VERSION }}</p>
      <p v-for="item in store.planQueue?.arrangements ?? []" :key="item.itemId" data-arrangement class="v2-today-arrangement">{{ arrangementLabel(item.arrangement, item.arrangementCopy) }}</p>
      <p v-if="planExplanation" class="plan-banner v2-today-banner" role="status">{{ planExplanation }}</p>
      <p v-if="firstLearningCopy" class="plan-banner v2-today-banner" role="status">{{ firstLearningCopy }}</p>
      <p v-if="store.planNotice" class="plan-banner v2-today-banner" role="status">{{ store.planNotice }}</p>
      <div class="section-heading v2-today-heading"><div><p class="card-kicker">DAILY STREAM</p><h3>今日任务</h3></div><button class="button button--secondary" type="button" @click="continueLearning">{{ availableTask ? '继续学习' : '浏览课程' }}</button></div>
      <StatePanel v-if="planEmpty" state="empty" :title="planEmpty.title" :description="planEmpty.description" :action-label="planEmpty.action" @action="openPlanEmpty(planEmpty)" />
      <StatePanel v-else-if="!tasks.length && !practice.length" state="empty" title="今天还没有安排任务" description="可以先从书架选择一节课。" />
      <div v-for="task in practice" :key="`practice-${task.id}`" class="task-row v2-today-card">
        <span class="task-icon">{{ task.kind === 'NEW' ? '＋' : '↻' }}</span>
        <div class="task-copy"><strong>{{ task.title }}</strong><p>{{ task.kind === 'NEW' ? '新任务' : '复习' }} · {{ task.stage }}</p>
          <div class="practice-options">
            <label v-for="option in task.options" :key="option.key"><input v-model="selections[task.id]" type="radio" :name="`practice-${task.id}`" :value="option.key" />{{ option.text }}</label>
          </div>
          <p v-if="practiceResult(task.id)" class="practice-feedback">
            <span data-save-receipt>{{ practiceResult(task.id)?.savedReceipt }}</span>
            <span data-feedback-text>{{ practiceResult(task.id)?.feedbackText }}</span>
            <span data-next-question>{{ practiceResult(task.id)?.nextQuestion }}</span>
          </p>
        </div>
        <button class="button button--ghost" type="button" :disabled="!selections[task.id]" @click="submitPractice(task.id)">提交作答</button>
      </div>
      <div v-for="task in tasks" :key="task.id" class="task-row v2-today-card" :class="{ completed: task.completed }">
        <span class="task-icon">{{ task.kind === 'NEW' ? '＋' : task.kind === 'REVIEW' ? '↻' : '!' }}</span>
        <div class="task-copy"><strong>{{ task.title }}</strong><p>{{ task.description }} · {{ task.minutes }} 分钟</p></div>
        <button class="button button--ghost" type="button" :disabled="task.completed" @click="startTask(task.id)">{{ task.completed ? '已完成' : task.contentCode ? '开始学习' : '浏览课程' }}</button>
      </div>
    </article>
  </section>
</template>
<style scoped>.progress-ring{display:grid;width:120px;height:120px;place-content:center;border:8px solid color-mix(in srgb,var(--yx-color-surface-card) 35%, transparent);border-top-color:var(--yx-color-surface-card);border-radius:50%;text-align:center}.progress-ring strong{font-size:24px}.progress-ring small{font-size:11px;opacity:.8}.task-list{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.section-heading h3{margin:6px 0;font-size:24px}.task-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid var(--yx-color-border)}.task-row>div{flex:1}.task-row p{margin:5px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.task-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:20px}.completed{opacity:.55}.error-text{color:var(--yx-color-danger)}.empty{padding:24px;color:var(--yx-color-text-secondary)}@media(max-width:640px){.hero-panel{align-items:flex-start}.progress-ring{width:84px;height:84px;flex:0 0 auto}.task-list{padding:18px}.section-heading{align-items:flex-start;gap:10px}.task-row .button{padding-inline:8px}}
:global(.app-shell__sidebar){overflow-y:auto}:global(.nav-list){min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable}:global(.sidebar-footer){flex:0 0 auto;margin-top:12px}
.task-copy{min-width:0;overflow-wrap:anywhere}
.plan-banner{margin:0 0 12px;color:var(--yx-color-text-secondary)}
.practice-options{display:grid;gap:6px;margin-top:8px}.practice-options label{display:flex;gap:8px;align-items:flex-start;line-height:1.6;cursor:pointer}
@media(max-width:640px){.section-heading{flex-wrap:wrap}.task-row{flex-wrap:wrap}.task-copy{flex-basis:calc(100% - 54px)}.task-row .button{margin-left:auto}}
</style>
<style>
.v2-page--today .v2-today { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; background: transparent; border: 0; box-shadow: none; padding: 0; }
.v2-page--today .v2-today > * { grid-column: 1 / -1; }
.v2-page--today .v2-today > .v2-today-card { grid-column: auto; }
.v2-page--today .v2-today-heading { display: flex; align-items: flex-end; justify-content: space-between; padding: 22px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); }
.v2-page--today .v2-today-heading h3 { margin: 4px 0 0; font-size: 20px; }
.v2-page--today .v2-today-arrangement { display: none; }
.v2-page--today .v2-today-banner { margin: 0; padding: 12px 16px; background: var(--v2-soft); color: var(--v2-ink); border-radius: var(--v2-radius-md); font-size: 13px; }
.v2-page--today .v2-today-card { display: grid; grid-template-columns: 40px minmax(0, 1fr); grid-template-rows: auto auto; gap: 10px 12px; align-items: start; padding: 20px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); transition: border-color var(--v2-motion-fast); }
.v2-page--today .v2-today-card:hover { border-color: var(--v2-brand2); }
.v2-page--today .v2-today-card .task-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: var(--v2-soft); color: var(--v2-brand); font-weight: 700; }
.v2-page--today .v2-today-card .task-copy strong { color: var(--v2-ink); font-size: 15px; }
.v2-page--today .v2-today-card .task-copy p { margin: 4px 0 0; color: var(--v2-mut); font-size: 12px; }
.v2-page--today .v2-today-card > .button { grid-column: 2; justify-self: start; min-height: 36px; background: var(--v2-brand); color: var(--v2-inverse); border: 0; }
.v2-page--today .v2-today-card.completed { opacity: .6; }
.v2-page--today .v2-today-card.completed > .button { background: var(--v2-surface); color: var(--v2-mut); }
@media (max-width: 650px) { .v2-page--today .v2-today { grid-template-columns: 1fr; } }
</style>
