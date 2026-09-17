<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import { useLearnerContentStore } from '../stores/learner-content'
import { useB18LearningStore } from '../stores/b18-learning'

const router = useRouter()
const contentStore = useLearnerContentStore()
const loopStore = useB18LearningStore()
const tasks = computed(() => contentStore.home?.today?.dailyStream.tasks ?? contentStore.home?.home?.dailyStream.tasks ?? [])
const content = computed(() => contentStore.home?.content ?? [])

onMounted(() => {
  contentStore.restore()
  void contentStore.loadHome()
  void loopStore.load()
})

function retry(): void { void Promise.all([contentStore.retry('home'), loopStore.load()]) }
function openPractice(): void { void router.push({ name: 'b2-practice' }) }
function openCourse(contentId?: string): void { void router.push({ name: 'learn-session', query: contentId ? { contentId } : undefined }) }
function completeTask(taskId: string): void { void contentStore.completeTask(taskId) }
</script>

<template>
  <section class="page-stack" aria-labelledby="learning-loop-title">
    <header class="loop-hero"><div><p class="eyebrow">B18 · LEARNING LOOP</p><h2 id="learning-loop-title">目标、练习、反馈、复习、报告。</h2><p>学习端只编排服务端投影；每一步都支持刷新、断网保留和服务恢复。</p></div><button class="button loop-hero__cta" type="button" @click="openPractice">开始练习</button></header>

    <div v-if="contentStore.homeStatus === 'loading' || loopStore.state === 'loading'" class="info-card"><h3>正在恢复学习投影…</h3><p>正在读取今日任务、课程、复习队列和报告。</p></div>
    <div v-else-if="contentStore.homeStatus === 'forbidden' || loopStore.state === 'permission'" class="info-card state-card state-card--warning"><h3>当前会话没有访问权限</h3><p>权限由 Gateway 和领域服务共同决定，客户端不会使用角色字段绕过限制。</p><button class="button button--secondary" type="button" @click="router.push({ name: 'login' })">重新登录</button></div>
    <div v-else-if="contentStore.homeStatus === 'offline' || loopStore.state === 'offline'" class="info-card state-card state-card--warning"><h3>服务暂时不可用</h3><p>已保留本地页面和已知断点；网络恢复后可以继续同步。</p><button class="button button--secondary" type="button" @click="retry">重试恢复</button></div>
    <div v-else-if="contentStore.homeStatus === 'error' || loopStore.state === 'error'" class="info-card state-card state-card--danger"><h3>学习数据读取失败</h3><p>{{ contentStore.lastError ?? loopStore.lastError ?? '请稍后重试。' }}</p><button class="button button--secondary" type="button" @click="retry">重试</button></div>

    <div class="grid grid--two">
      <article class="info-card"><span class="card-kicker">TODAY</span><h3>{{ tasks.length }} 个今日任务</h3><p>已完成 {{ contentStore.todayProgress }}%，内容语言 {{ contentStore.home?.contentLocale ?? 'en-US' }}。</p><div v-if="tasks.length" class="task-list task-list--compact"><div v-for="task in tasks.slice(0, 4)" :key="task.id" class="task-row"><div><strong>{{ task.title }}</strong><p>{{ task.description }} · {{ task.minutes }} 分钟</p></div><button class="button button--ghost" type="button" :disabled="task.completed" @click="completeTask(task.id)">{{ task.completed ? '已完成' : '完成' }}</button></div></div><EmptyState v-else title="今日暂无任务" description="目标或内容投影可能尚未准备好。" /></article>
      <article class="info-card"><span class="card-kicker">REVIEW / REPORT</span><h3>{{ loopStore.queue.length }} 个待复习</h3><p v-if="loopStore.report">今日准确率 {{ loopStore.report.accuracy === null ? '—' : `${Math.round(loopStore.report.accuracy * 100)}%` }}，报告版本由服务端提供。</p><p v-else>报告暂时没有可展示的数据，不把空值伪装成零。</p><div class="actions"><button class="button button--secondary" type="button" @click="router.push({ name: 'vocabulary' })">打开 SRS</button><button class="button button--secondary" type="button" @click="router.push({ name: 'weakness-report' })">查看报告</button></div></article>
    </div>

    <article class="content-grid" v-if="content.length"><div class="section-heading"><div><p class="card-kicker">COURSES</p><h3>已发布课程</h3></div><button class="button button--secondary" type="button" @click="router.push({ name: 'courses' })">全部课程</button></div><button v-for="item in content.slice(0, 6)" :key="item.contentId" class="content-card" type="button" @click="openCourse(item.contentId)"><strong>{{ item.title }}</strong><span>{{ item.kind }} · {{ item.contentLocale }} · {{ item.status }}</span></button></article>
    <p v-if="contentStore.lastError || loopStore.lastError" class="error-text" role="alert">{{ contentStore.lastError ?? loopStore.lastError }}</p>
  </section>
</template>

<style scoped>
.loop-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:30px;border-radius:24px;color:#fff;background:linear-gradient(135deg,var(--yx-color-brand-primary),var(--yx-color-brand-secondary));box-shadow:0 18px 50px rgb(89 107 255 / 20%)}.loop-hero h2{max-width:720px;margin:10px 0;font-size:clamp(30px,5vw,48px);line-height:1.15}.loop-hero p:not(.eyebrow){max-width:680px;margin:0;color:rgb(255 255 255 / 82%);line-height:1.7}.loop-hero__cta{flex:0 0 auto;color:var(--yx-color-brand-primary);background:#fff;border-color:transparent;font-weight:800;box-shadow:0 8px 24px rgb(0 0 0 / 22%)}.loop-hero__cta:hover{background:#fff;transform:translateY(-1px)}.state-card{display:flex;align-items:center;justify-content:space-between;gap:18px}.state-card--warning{border-color:var(--yx-color-warning)}.state-card--danger{border-color:var(--yx-color-danger)}.task-list--compact{margin-top:16px}.task-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--yx-color-border)}.task-row>div{flex:1}.task-row p{margin:5px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.actions{display:flex;gap:10px;margin-top:20px}.content-grid{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section-heading h3{margin:5px 0}.content-card{display:flex;align-items:center;justify-content:space-between;width:100%;padding:15px 0;border:0;border-top:1px solid var(--yx-color-border);color:inherit;background:transparent;text-align:left;cursor:pointer}.content-card span{color:var(--yx-color-text-secondary);font-size:13px}.error-text{color:var(--yx-color-danger)}@media(max-width:640px){.loop-hero,.state-card{display:grid;align-items:start}.loop-hero{padding:24px}.actions{display:grid}.content-grid{padding:18px}.content-card{display:grid;gap:5px}}
</style>
