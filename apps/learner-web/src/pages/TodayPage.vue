<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StatePanel from '../components/StatePanel.vue'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const snapshot = computed(() => store.today ?? store.home?.today ?? store.home?.home)
const tasks = computed(() => snapshot.value?.dailyStream.tasks ?? [])
onMounted(() => { store.restore(); void store.loadToday() })
function finish(id: string): void { const task = tasks.value.find(item => item.id === id); if (task) void router.push({ name: 'learn-session', query: { taskId: task.id, ...(task.contentCode ? { contentCode: task.contentCode } : {}) } }) }
function continueLearning(): void {
  const task = tasks.value.find((item) => !item.completed) ?? tasks.value[0]
  const contentCode = task?.contentCode ?? store.home?.content[0]?.contentId ?? ''
  const query = contentCode || task?.id ? { ...(contentCode ? { contentCode } : {}), ...(task?.id ? { taskId: task.id } : {}) } : undefined
  void router.push({ name: 'learn-session', query })
}
</script>

<template>
  <section class="page-stack" aria-labelledby="today-title"><ExperienceHeader page="Today" icon="target" title-id="today-title" hero /><article class="task-list"><div class="section-heading"><div><p class="card-kicker">DAILY STREAM</p><h3>今日任务</h3></div><button class="button button--secondary" type="button" @click="continueLearning">继续学习</button></div><StatePanel v-if="!tasks.length && !store.lastError" state="empty" title="今日任务为空" description="先设置一个学习目标，或者从书架里选一节课程。" /><div v-for="task in tasks" :key="task.id" class="task-row" :class="{ completed: task.completed }"><span class="task-icon">{{ task.kind === 'NEW' ? '＋' : task.kind === 'REVIEW' ? '↻' : '!' }}</span><div><strong>{{ task.title }}</strong><p>{{ task.description }} · {{ task.minutes }} 分钟</p></div><button class="button button--ghost" type="button" :disabled="task.completed" @click="finish(task.id)">{{ task.completed ? '已完成' : '开始学习' }}</button></div></article><StatePanel v-if="store.lastError" state="error" title="今日任务" :description="store.lastError" action-label="重试" @action="() => { void store.loadToday() }" /></section>
</template>
<style scoped>.progress-ring{display:grid;width:120px;height:120px;place-content:center;border:8px solid color-mix(in srgb,var(--yx-color-surface-card) 35%, transparent);border-top-color:var(--yx-color-surface-card);border-radius:50%;text-align:center}.progress-ring strong{font-size:24px}.progress-ring small{font-size:11px;opacity:.8}.task-list{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.section-heading h3{margin:6px 0;font-size:24px}.task-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid var(--yx-color-border)}.task-row>div{flex:1}.task-row p{margin:5px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.task-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:20px}.completed{opacity:.55}.error-text{color:var(--yx-color-danger)}.empty{padding:24px;color:var(--yx-color-text-secondary)}@media(max-width:640px){.hero-panel{align-items:flex-start}.progress-ring{width:84px;height:84px;flex:0 0 auto}.task-list{padding:18px}.section-heading{align-items:flex-start;gap:10px}.task-row .button{padding-inline:8px}}
:global(.app-shell__sidebar){overflow-y:auto}:global(.nav-list){min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable}:global(.sidebar-footer){flex:0 0 auto;margin-top:12px}
</style>
