<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import { useLearnerContentStore } from '../stores/learner-content'
import { useB18LearningStore } from '../stores/b18-learning'
import { reviewFailureCopy } from '../domain/review-stage'
import { reviewEmpty } from '../domain/review-history'
import { STAGE_PROJECTION } from '../domain/stage-projection'

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
function startTask(taskId: string): void {
  const task = tasks.value.find((item) => item.id === taskId)
  if (!task?.contentCode) { void router.push({ name: 'courses' }); return }
  void router.push({ name: 'learn-session', query: { taskId, contentCode: task.contentCode } })
}
</script>

<template>
  <section class="page-stack v2-page v2-page--loop" aria-labelledby="learning-loop-title">
    <ExperienceHeader class="v2-loop-head" page="Learn" icon="route" title-id="learning-loop-title"><button class="button button--primary" type="button" @click="openPractice">开始练习</button></ExperienceHeader>

    <div v-if="contentStore.homeStatus === 'loading' || loopStore.state === 'loading'" class="info-card"><h3>正在恢复学习投影…</h3><p>正在读取今日任务、课程、复习队列和报告。</p></div>
    <div v-else-if="contentStore.homeStatus === 'forbidden' || loopStore.state === 'permission'" class="info-card state-card state-card--warning"><h3>当前账号没有访问权限</h3><p>请重新登录；若仍无法访问，请联系管理员。</p><button class="button button--secondary" type="button" @click="router.push({ name: 'login' })">重新登录</button></div>
    <div v-else-if="contentStore.homeStatus === 'offline' || loopStore.state === 'offline'" class="info-card state-card state-card--warning"><h3>服务暂时不可用</h3><p>已保留本地页面和已知断点；网络恢复后可以继续同步。</p><button class="button button--secondary" type="button" @click="retry">重试恢复</button></div>
    <div v-else-if="contentStore.homeStatus === 'error' || loopStore.state === 'error'" class="info-card state-card state-card--danger"><h3>学习数据读取失败</h3><p>{{ contentStore.lastError ?? loopStore.lastError ?? '请稍后重试。' }}</p><button class="button button--secondary" type="button" @click="retry">重试</button></div>

    <div class="grid grid--two">
      <article class="info-card"><span class="card-kicker"><span class="v2-sr-only">今日</span>今日</span><h3>{{ tasks.length }} 个今日任务</h3><p>已完成 {{ contentStore.todayProgress }}%<span class="v2-sr-only">，内容语言 {{ contentStore.home?.contentLocale ?? 'en-US' }}。</span></p><div v-if="tasks.length" class="task-list task-list--compact"><div v-for="task in tasks.slice(0, 4)" :key="task.id" class="task-row"><div><strong>{{ task.title }}</strong><p>{{ task.description }} · {{ task.minutes }} 分钟</p></div><button class="button button--ghost" type="button" :disabled="task.completed" @click="startTask(task.id)">{{ task.completed ? '已完成' : '开始学习' }}</button></div></div><EmptyState v-else title="今日暂无任务" description="可以先从课程书架选择内容。" /></article>
      <article class="info-card"><span class="card-kicker"><span class="v2-sr-only">复习 · 报告</span>复习与报告</span><h3>{{ loopStore.queue.length }} 个待复习</h3><p data-stage-projection class="v2-sr-only">{{ loopStore.projectionVersion || STAGE_PROJECTION }}</p><p v-if="loopStore.queue[0]" data-stage>{{ ({ DUE: '待复习', LEARNING: '学习中', REVIEW: '复习中', NEW: '新词', MISTAKE: '错题', RETRY: '重练' })[loopStore.queue[0].state] ?? loopStore.queue[0].state }}</p><p v-if="!loopStore.queue.length" data-review-empty>{{ loopStore.emptyCopy || reviewEmpty(loopStore.state === 'error' || loopStore.state === 'offline', true, false).copy }}</p><p v-for="row in loopStore.history" :key="`${row.disposition}-${row.itemId}`" data-review-history>{{ row.disposition === 'DEFERRED' ? '延期' : '已完成' }}</p><p v-if="loopStore.report">今日准确率 {{ loopStore.report.accuracy === null ? '—' : `${Math.round(loopStore.report.accuracy * 100)}%` }}，报告版本由服务端提供。</p><p v-else>报告暂时没有可展示的数据，不把空值伪装成零。</p><div class="actions"><button class="button button--secondary" type="button" @click="router.push({ name: 'vocabulary' })">去复习</button><button class="button button--secondary" type="button" @click="router.push({ name: 'weakness-report' })">查看报告</button></div></article>
    </div>

    <article class="content-grid" v-if="content.length"><div class="section-heading"><div><p class="card-kicker"><span class="v2-sr-only">课程</span>课程</p><h3>已发布课程</h3></div><button class="button button--secondary" type="button" @click="router.push({ name: 'courses' })">全部课程</button></div><button v-for="item in content.slice(0, 6)" :key="item.contentId" class="content-card" type="button" @click="openCourse(item.contentId)"><strong>{{ item.title }}</strong><span>{{ ({ COURSE_UNIT: '课程单元', BOOK: '书', LESSON: '课' })[item.kind] ?? item.kind }}<span class="v2-sr-only"> · {{ item.contentLocale }} · {{ item.status }}</span></span></button></article>
    <p v-if="reviewFailureCopy(loopStore.lastError)" data-review-illegal>{{ reviewFailureCopy(loopStore.lastError) }}</p>
    <p v-if="contentStore.lastError || loopStore.lastError" class="error-text" role="alert">{{ reviewFailureCopy(loopStore.lastError) || contentStore.lastError || loopStore.lastError }}</p>
  </section>
</template>

<style scoped>
.loop-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:30px;border-radius:24px;color:var(--yx-color-on-brand);background:linear-gradient(135deg,var(--yx-color-brand-primary),var(--yx-color-brand-secondary));box-shadow:0 18px 50px color-mix(in srgb,var(--yx-color-brand-primary) 20%, transparent)}.loop-hero h2{max-width:720px;margin:10px 0;font-size:clamp(30px,5vw,48px);line-height:1.15}.loop-hero p:not(.eyebrow){max-width:680px;margin:0;color:color-mix(in srgb,var(--yx-color-on-brand) 82%, transparent);line-height:1.7}.loop-hero__cta{flex:0 0 auto;color:var(--yx-color-brand-primary);background:var(--yx-color-surface-card);border-color:transparent;font-weight:800;box-shadow:0 8px 24px color-mix(in srgb,var(--yx-color-brand-primary) 22%, transparent)}.loop-hero__cta:hover{background:var(--yx-color-surface-card);transform:translateY(-1px)}.state-card{display:flex;align-items:center;justify-content:space-between;gap:18px}.state-card--warning{border-color:var(--yx-color-warning)}.state-card--danger{border-color:var(--yx-color-danger)}.task-list--compact{margin-top:16px}.task-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--yx-color-border)}.task-row>div{flex:1}.task-row p{margin:5px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.actions{display:flex;gap:10px;margin-top:20px}.content-grid{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section-heading h3{margin:5px 0}.content-card{display:flex;align-items:center;justify-content:space-between;width:100%;padding:15px 0;border:0;border-top:1px solid var(--yx-color-border);color:inherit;background:transparent;text-align:left;cursor:pointer}.content-card span{color:var(--yx-color-text-secondary);font-size:13px}.error-text{color:var(--yx-color-danger)}@media(max-width:640px){.loop-hero,.state-card{display:grid;align-items:start}.loop-hero{padding:24px}.actions{display:grid}.content-grid{padding:18px}.content-card{display:grid;gap:5px}}
</style>

<style>
.v2-page--loop { display: grid; gap: var(--v2-space-6); width: 100%; max-width: 1320px; margin: 0 auto; font-family: var(--v2-font); }
.v2-page--loop .v2-loop-head { min-width: 0; }
.v2-page--loop > .info-card { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-5); min-width: 0; display: grid; gap: var(--v2-space-2); }
.v2-page--loop .state-card { display: flex; align-items: center; justify-content: space-between; gap: var(--v2-space-4); flex-wrap: wrap; }
.v2-page--loop .state-card--warning { border-color: var(--v2-warn); }
.v2-page--loop .state-card--danger { border-color: var(--v2-bad); }
.v2-page--loop .info-card h3 { margin: var(--v2-space-1) 0; color: var(--v2-ink); font-size: var(--v2-text-lg); line-height: 1.4; }
.v2-page--loop .info-card p { margin: 0; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--loop .card-kicker { margin: 0; color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 700; letter-spacing: 1px; }
.v2-page--loop .grid.grid--two { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--v2-space-6); align-items: start; min-width: 0; }
.v2-page--loop .grid.grid--two .info-card { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-6); min-width: 0; display: grid; gap: var(--v2-space-3); align-content: start; }
.v2-page--loop .task-list--compact { display: grid; margin-top: var(--v2-space-2); }
.v2-page--loop .task-row { display: flex; align-items: center; gap: var(--v2-space-4); padding: var(--v2-space-4) 0; border-top: 1px solid var(--v2-line); }
.v2-page--loop .task-row > div { flex: 1; min-width: 0; }
.v2-page--loop .task-row strong { color: var(--v2-ink); font-size: var(--v2-text-sm); }
.v2-page--loop .task-row p { margin: var(--v2-space-1) 0 0; color: var(--v2-mut); font-size: var(--v2-text-xs); line-height: 1.6; }
.v2-page--loop [data-stage-projection] { color: var(--v2-mut); font-size: var(--v2-text-xs); }
.v2-page--loop [data-stage] { display: inline-flex; align-items: center; border-radius: var(--v2-radius-pill); background: var(--v2-soft); color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 700; padding: var(--v2-space-1) var(--v2-space-3); white-space: nowrap; width: max-content; }
.v2-page--loop [data-review-empty] { color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--loop [data-review-history] { margin: 0; padding: var(--v2-space-3) 0; border-top: 1px solid var(--v2-line); color: var(--v2-mut); font-size: var(--v2-text-sm); }
.v2-page--loop [data-review-illegal] { margin: 0; padding: var(--v2-space-2) var(--v2-space-3); border-radius: var(--v2-radius-md); background: var(--v2-warn-soft); color: var(--v2-warn); font-size: var(--v2-text-sm); line-height: 1.6; }
.v2-page--loop .actions { display: flex; flex-wrap: wrap; gap: var(--v2-space-2); margin-top: var(--v2-space-2); }
.v2-page--loop .content-grid { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-6); min-width: 0; display: grid; gap: var(--v2-space-2); }
.v2-page--loop .section-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--v2-space-3); margin-bottom: var(--v2-space-2); }
.v2-page--loop .section-heading h3 { margin: var(--v2-space-1) 0; color: var(--v2-ink); font-size: var(--v2-text-md); line-height: 1.5; }
.v2-page--loop .content-card { display: flex; align-items: center; justify-content: space-between; gap: var(--v2-space-3); width: 100%; padding: var(--v2-space-4) 0; border: 0; border-top: 1px solid var(--v2-line); background: var(--v2-card); color: var(--v2-ink); font-size: var(--v2-text-sm); text-align: left; cursor: pointer; }
.v2-page--loop .content-card strong { color: var(--v2-ink); }
.v2-page--loop .content-card span { color: var(--v2-mut); font-size: var(--v2-text-xs); }
.v2-page--loop .content-card:hover { color: var(--v2-brand); }
.v2-page--loop .error-text { margin: 0; color: var(--v2-bad); font-size: var(--v2-text-sm); line-height: 1.6; }
.v2-page--loop :is(.button, .content-card):focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
@media (max-width: 1190px) { .v2-page--loop .grid.grid--two { grid-template-columns: minmax(0, 1fr) 240px; gap: var(--v2-space-5); } .v2-page--loop .grid.grid--two .info-card { padding: var(--v2-space-5); } .v2-page--loop .content-grid { padding: var(--v2-space-5); } }
@media (max-width: 900px) { .v2-page--loop .grid.grid--two { grid-template-columns: 1fr; } .v2-page--loop .state-card { display: grid; align-items: start; } .v2-page--loop .actions { display: grid; } .v2-page--loop .content-card { display: grid; gap: var(--v2-space-1); } }
</style>
