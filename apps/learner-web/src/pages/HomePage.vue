<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const home = computed(() => store.home)
const tasks = computed(() => home.value?.today?.dailyStream.tasks ?? home.value?.home?.dailyStream.tasks ?? [])
const content = computed(() => home.value?.content ?? [])

onMounted(() => { store.restore(); void store.loadHome() })
function complete(taskId: string): void { void store.completeTask(taskId) }
</script>

<template>
  <section class="page-stack" aria-labelledby="home-title">
    <div class="hero-panel"><div><p class="eyebrow">B9 · LEARNER HOME</p><h2 id="home-title">今天，从一个清晰的小任务开始。</h2><p>首页由 learner-service 与 content-service 的版本化 read model 组成；内容下线、无权和服务降级都会保留可恢复状态。</p></div><div class="hero-panel__orb" aria-hidden="true">✦</div></div>
    <div v-if="store.homeStatus === 'loading'" class="info-card"><h3>正在加载学习投影…</h3><p>正在恢复目标、首日状态和内容版本。</p></div>
    <template v-else>
      <div class="grid grid--two"><article class="info-card"><span class="card-kicker">今日进度</span><h3>{{ store.todayProgress }}%</h3><p>目标 {{ home?.today?.dailyStream.targetMinutes ?? home?.home?.dailyStream.targetMinutes ?? 15 }} 分钟，已完成 {{ home?.today?.dailyStream.completedMinutes ?? home?.home?.dailyStream.completedMinutes ?? 0 }} 分钟。</p></article><article class="info-card"><span class="card-kicker">内容版本</span><h3>{{ content.length }} 个可用投影</h3><p>{{ home?.contentStatus === 'UNAVAILABLE' ? '内容服务暂不可用，已保留学习入口。' : '学习端只读取已发布且有权利的内容。' }}</p></article></div>
      <article v-if="tasks.length" class="task-list"><div class="section-heading"><div><p class="card-kicker">DAILY STREAM</p><h3>今日任务</h3></div><button class="button button--secondary" type="button" @click="router.push({ name: 'today' })">打开今日任务</button></div><div v-for="task in tasks" :key="task.id" class="task-row"><span class="task-icon">{{ task.kind === 'NEW' ? '＋' : task.kind === 'REVIEW' ? '↻' : '!' }}</span><div><strong>{{ task.title }}</strong><p>{{ task.description }} · {{ task.minutes }} 分钟</p></div><button class="button button--ghost" type="button" :disabled="task.completed" @click="complete(task.id)">{{ task.completed ? '已完成' : '完成' }}</button></div></article>
      <EmptyState v-else title="今日任务为空" description="可能是目标尚未完成、内容版本下线或服务暂时降级；你可以进入 Onboarding 或稍后重试。" />
      <article v-if="content.length" class="content-grid"><div class="section-heading"><div><p class="card-kicker">PUBLISHED CONTENT</p><h3>可继续的内容</h3></div><button class="button button--secondary" type="button" @click="router.push({ name: 'learn' })">打开课程</button></div><div v-for="item in content.slice(0, 6)" :key="item.contentId" class="content-card"><strong>{{ item.title }}</strong><span>{{ item.kind }} · {{ item.contentLocale }} · {{ item.status }}</span></div></article>
    </template>
    <div class="quick-actions"><button class="button button--primary" type="button" @click="router.push({ name: 'onboarding' })">修改目标</button><button class="button button--secondary" type="button" @click="router.push({ name: 'assessment' })">进入测评</button></div>
    <p v-if="store.lastError" class="error-text" role="alert">{{ store.lastError }}</p>
  </section>
</template>

<style scoped>
:global(.app-shell__sidebar){overflow-y:auto}
:global(.nav-list){min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable}:global(.sidebar-footer){flex:0 0 auto;margin-top:12px}
.task-list,.content-grid{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.section-heading h3{margin:6px 0;font-size:24px}.task-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid var(--yx-color-border)}.task-row>div{flex:1}.task-row p{margin:5px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.task-icon{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:20px}.content-grid{margin-top:20px}.content-card{display:grid;gap:5px;padding:14px 0;border-top:1px solid var(--yx-color-border)}.content-card span{color:var(--yx-color-text-secondary);font-size:13px}.quick-actions{display:flex;gap:12px}.error-text{color:var(--yx-color-danger)}@media(max-width:640px){.task-list,.content-grid{padding:18px}.section-heading{align-items:flex-start;gap:10px}.task-row .button{padding-inline:8px}.quick-actions{display:grid}}
</style>
