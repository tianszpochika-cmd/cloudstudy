<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StatePanel from '../components/StatePanel.vue'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const snapshot = computed(() => store.today ?? store.home?.today ?? store.home?.home)
const tasks = computed(() => snapshot.value?.dailyStream.tasks ?? [])
onMounted(() => { store.restore(); void store.loadToday() })
function finish(id: string): void { void store.completeTask(id) }
function continueLearning(): void {
  const task = tasks.value.find((item) => !item.completed) ?? tasks.value[0]
  const contentCode = task?.contentCode ?? store.home?.content[0]?.contentId ?? ''
  const query = contentCode || task?.id ? { ...(contentCode ? { contentCode } : {}), ...(task?.id ? { taskId: task.id } : {}) } : undefined
  void router.push({ name: 'learn-session', query })
}
</script>

<template>
  <section class="page-stack" aria-labelledby="today-title"><div class="hero-panel"><div><p class="eyebrow">B9 · TODAY READ MODEL</p><h2 id="today-title">今天完成一个小闭环。</h2><p>今日任务、内容版本和恢复状态由服务端投影提供；下线或无权不会伪装成空成功。</p></div><div class="progress-ring"><strong>{{ store.todayProgress }}%</strong><small>今日进度</small></div></div><StatePanel v-if="store.todayStatus === 'loading'" state="loading" title="今日任务" description="正在同步今日任务与内容版本。" /><StatePanel v-else-if="store.todayStatus === 'offline'" state="offline" title="今日任务" description="网络不可用，任务完成状态已保存在本地，恢复联网后可重试。" action-label="重试" @action="() => { void store.loadToday() }" /><article v-else class="task-list"><div class="section-heading"><div><p class="card-kicker">DAILY STREAM</p><h3>今日任务</h3></div><button class="button button--secondary" type="button" @click="continueLearning">继续学习</button></div><StatePanel v-if="!tasks.length && !store.lastError" state="empty" title="今日任务为空" description="请检查目标、内容发布状态或稍后重试。" /><div v-for="task in tasks" :key="task.id" class="task-row" :class="{ completed: task.completed }"><span class="task-icon">{{ task.kind === 'NEW' ? '＋' : task.kind === 'REVIEW' ? '↻' : '!' }}</span><div><strong>{{ task.title }}</strong><p>{{ task.description }} · {{ task.minutes }} 分钟</p></div><button class="button button--ghost" type="button" :disabled="task.completed" @click="finish(task.id)">{{ task.completed ? '已完成' : '完成' }}</button></div></article><StatePanel v-if="store.lastError && store.todayStatus !== 'loading' && store.todayStatus !== 'offline'" state="error" title="今日任务" :description="store.lastError" action-label="重试" @action="() => { void store.loadToday() }" /></section>
</template>
<style scoped>.progress-ring{display:grid;width:120px;height:120px;place-content:center;border:8px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;text-align:center}.progress-ring strong{font-size:24px}.progress-ring small{font-size:11px;opacity:.8}.task-list{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.section-heading h3{margin:6px 0;font-size:24px}.task-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid var(--yx-color-border)}.task-row>div{flex:1}.task-row p{margin:5px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.task-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:20px}.completed{opacity:.55}.error-text{color:var(--yx-color-danger)}.empty{padding:24px;color:var(--yx-color-text-secondary)}@media(max-width:640px){.hero-panel{align-items:flex-start}.progress-ring{width:84px;height:84px;flex:0 0 auto}.task-list{padding:18px}.section-heading{align-items:flex-start;gap:10px}.task-row .button{padding-inline:8px}}
:global(.app-shell__sidebar){overflow-y:auto}:global(.nav-list){min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable}:global(.sidebar-footer){flex:0 0 auto;margin-top:12px}
</style>
