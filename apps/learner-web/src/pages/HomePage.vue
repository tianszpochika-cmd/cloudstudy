<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import StatePanel from '../components/StatePanel.vue'
import AppIcon, { type AppIconName } from '../components/AppIcon.vue'
import StudyArtwork from '../components/StudyArtwork.vue'
import { hasPlacementEntryReached, isPlacementSatisfied, ONBOARDING_GUIDE_ACTION, onboardingProgressLabel, onboardingRemainingStepLabels, selectOnboardingResumeStep, showOnboardingGuide } from '../domain/onboarding-resume'
import { emptyStateView, firstLearningGuideCopy, type EmptyStateView } from '../domain/plan-today'
import { useLearnerContentStore } from '../stores/learner-content'
import { useExperienceText } from '../platform/experience-ui'
import { useLearningUi } from '../platform/learning-ui'
import { userFacingError } from '../platform/user-facing-error'
import { useSessionStore } from '../stores/session'
const router = useRouter()
const store = useLearnerContentStore()
const session = useSessionStore()
const t = useExperienceText()
const ui = useLearningUi()
const isRestricted = computed(() => session.adultGate === 'REJECTED')
const guideReady = ref(false)
const guideAction = ONBOARDING_GUIDE_ACTION
const placementDone = computed(() => isPlacementSatisfied({
  placementEntryReached: hasPlacementEntryReached(typeof sessionStorage === 'undefined' ? null : sessionStorage, session.userId),
  planId: store.planQueue?.planId ?? store.home?.plan?.planId ?? null,
  hasPlan: Boolean(store.home?.plan),
}))
const serverPlacementUnknown = computed(() => {
  const homePending = store.homeStatus === 'idle' || store.homeStatus === 'loading'
  const planPending = store.planQueueStatus === 'idle' || store.planQueueStatus === 'loading'
  return homePending || planPending
})
const guideVisible = computed(() => {
  const facts = store.onboardingResume
  if (!guideReady.value || !facts || isRestricted.value) return false
  return showOnboardingGuide(facts, placementDone.value, { serverPlacementUnknown: serverPlacementUnknown.value })
})
const guideLabel = computed(() => store.onboardingResume ? onboardingProgressLabel(store.onboardingResume) : '')
const guideSteps = computed(() => store.onboardingResume ? onboardingRemainingStepLabels(store.onboardingResume, placementDone.value) : [])
const guideTo = computed(() => store.onboardingResume && selectOnboardingResumeStep(store.onboardingResume) === 'assessment' ? { name: 'assessment' } : { name: 'onboarding' })
async function logout(): Promise<void> { await session.logout(); await router.replace({ name: 'login' }) }
const home = computed(() => ['ready', 'empty', 'unavailable'].includes(store.homeStatus) ? store.home : null)
const stream = computed(() => home.value?.today?.dailyStream ?? home.value?.home?.dailyStream)
const tasks = computed(() => stream.value?.tasks ?? [])
const content = computed(() => home.value?.content ?? [])
const plan = computed(() => home.value?.plan ?? null)
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const firstLearningCopy = computed(() => store.planQueue?.firstLearning?.guideVisible
  ? firstLearningGuideCopy(store.planQueue.firstLearning.reason)
  : null)
const planEmpty = computed(() => {
  if (tasks.value.length > 0) return null
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyStateView({ failed: false, reason: store.planQueue?.emptyReason ?? null, hasTasks: false })
})
function openPlanEmpty(view: EmptyStateView): void {
  if (view.to === 'retry') { void store.refreshPlanQueue(); return }
  void router.push({ name: view.to === 'home' ? 'home' : view.to })
}
const completeCount = computed(() => tasks.value.filter(task => task.completed).length)
const nextTask = computed(() => tasks.value.find(task => !task.completed && task.contentCode))
const heroUnavailable = computed(() => store.homeStatus === 'error' || store.homeStatus === 'offline')
const heroLoading = computed(() => store.homeStatus === 'idle' || store.homeStatus === 'loading')
const activities: Array<{ name: string; key: string; hint: string; icon: AppIconName }> = [
  { name: 'vocabulary', key: 'vocabulary', hint: 'vocabHint', icon: 'cards' },
  { name: 'b3-reading', key: 'reading', hint: 'readingHint', icon: 'book' },
  { name: 'b3-grammar', key: 'grammar', hint: 'grammarHint', icon: 'spark' },
]
function start(task = nextTask.value) {
  if (isRestricted.value) return
  if (!task?.contentCode) { void router.push({ name: 'courses' }); return }
  void router.push({ name: 'learn-session', query: { taskId: task.id, contentCode: task.contentCode } })
}
async function loadGuide(): Promise<void> {
  guideReady.value = false
  if (!session.isAuthenticated || session.adultGate === 'REJECTED') return
  try {
    await store.loadOnboardingResume()
    guideReady.value = true
  } catch {
    guideReady.value = false
  }
}
onMounted(() => { store.restore(); void store.loadHome(); void loadGuide() })
</script>
<template>
  <section class="page-stack home-experience v2-home" aria-labelledby="home-title">
    <div class="home-greeting"><div><p class="experience-eyebrow"><AppIcon name="spark" :size="15" />A LITTLE, EVERY DAY</p><h1 id="home-title">{{ t('homeTitle') }}</h1><p>{{ t('homeDescription') }}</p></div><RouterLink v-if="!isRestricted" class="text-link" :to="{ name: 'onboarding' }">{{ t('setGoal') }}<AppIcon name="arrow" :size="16" /></RouterLink></div>
    <RouterLink v-if="guideVisible" class="onboarding-guide" :to="guideTo"><span class="onboarding-guide__copy"><span>{{ guideLabel }}</span><small v-if="guideSteps.length">剩余步骤：{{ guideSteps.join('、') }}</small></span><strong>{{ guideAction }}</strong></RouterLink>
    <p v-if="firstLearningCopy" class="first-learning-guide" role="status">{{ firstLearningCopy }}</p>
    <p v-if="store.planNotice" class="plan-notice" role="status">{{ store.planNotice }}</p>
    <div v-if="isRestricted" class="restricted-banner" role="alert">
      <div class="restricted-banner__copy">
        <strong>学习功能暂未开放</strong>
        <p>当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。</p>
      </div>
      <div class="restricted-banner__actions">
        <RouterLink class="button button--secondary" to="/settings">前往账号设置</RouterLink>
        <RouterLink class="button button--ghost" to="/support">帮助与反馈</RouterLink>
        <button class="button button--ghost" type="button" @click="logout">退出登录</button>
      </div>
    </div>
    <div class="home-dashboard">
      <div class="home-main">
        <article v-if="!heroUnavailable" class="home-hero">
          <div class="home-hero__copy"><span class="hero-label">{{ t('myTasks') }}</span><h2>{{ heroLoading ? '正在读取今日安排' : nextTask?.title || '从一节课开始' }}</h2><p>{{ heroLoading ? '请稍候。' : nextTask?.description || '看看书架上有哪些可用课程。' }}</p><button v-if="!heroLoading" class="button button--white" type="button" :disabled="isRestricted" @click="start()">{{ nextTask ? t('continue') : '浏览课程' }}<AppIcon name="arrow" :size="18" /></button><small v-if="nextTask">{{ nextTask.minutes }} {{ t('minutes') }} · {{ t('next') }}</small></div>
          <StudyArtwork v-if="!heroLoading" />
        </article>
        <article class="experience-card home-tasks">
          <div class="section-heading"><div><span class="card-kicker">YOUR DAILY PLAN</span><h2>{{ t('myTasks') }}</h2></div><RouterLink class="text-link" :to="{ name: 'today' }">{{ t('viewAll') }}<AppIcon name="arrow" :size="16" /></RouterLink></div>
          <div v-if="planExplanation || plan" class="plan-banner"><strong>{{ planExplanation || `学习计划 ${plan?.planId}` }}</strong><span v-if="plan">{{ planExplanation ? `学习计划 ${plan.planId}` : `${plan.taskCount} 个今日任务已下发` }}</span><RouterLink class="text-link" :to="{ name: 'today' }">去完成<AppIcon name="arrow" :size="16" /></RouterLink></div>
          <StatePanel v-if="store.homeStatus === 'loading'" state="loading" :title="t('loading')" />
          <StatePanel v-else-if="store.homeStatus === 'offline'" state="offline" :title="ui.t('common.state.offline')" :description="ui.t('learning.state.offline')" :action-label="ui.t('common.retry')" @action="() => { void store.loadHome() }" />
          <StatePanel v-else-if="store.lastError" state="error" :title="t('myTasks')" :description="userFacingError(store.lastError, '暂时无法读取今日任务，请稍后重试。')" action-label="重试" @action="() => { void store.loadHome() }" />
          <div v-else-if="tasks.length" class="daily-task-list v2-home-table"><div class="v2-home-thead" aria-hidden="true"><span>学习内容</span><span>预计时长</span><span>操作</span></div><button v-for="(task, index) in tasks.slice(0,4)" :key="task.id" type="button" class="daily-task v2-home-row" :class="{ 'daily-task--done': task.completed }" :disabled="task.completed || isRestricted" @click="start(task)"><span class="daily-task__number"><AppIcon v-if="task.completed" name="check" :size="18" /><template v-else>{{ String(index + 1).padStart(2, '0') }}</template></span><span class="daily-task__copy"><strong>{{ task.title }}</strong><small>{{ task.minutes }} {{ t('minutes') }} · {{ task.description }}</small></span><span class="v2-home-min">{{ task.minutes }} {{ t('minutes') }}</span><span class="daily-task__state">{{ task.completed ? t('completed') : task.contentCode ? t('start') : '浏览课程' }}</span><AppIcon v-if="!task.completed" name="arrow" :size="17" /></button></div>
          <StatePanel v-else-if="planEmpty" state="empty" :title="planEmpty.title" :description="planEmpty.description" :action-label="planEmpty.action" @action="openPlanEmpty(planEmpty)" />
          <StatePanel v-else state="empty" title="今天还没有安排任务" description="可以先从书架选择一节课。" action-label="浏览课程" @action="router.push({ name: 'courses' })" />
        </article>
      </div>
      <aside class="home-aside v2-home-rail">
        <article class="experience-card daily-progress"><span class="card-kicker">LITTLE STEPS COUNT</span><h2>{{ t('progress') }}</h2><div class="daily-progress__ring" :style="{ '--progress': (stream ? store.todayProgress : 0) + '%' }"><div><strong>{{ stream ? store.todayProgress + '%' : '—' }}</strong><span>{{ t('completed') }}</span></div></div><div class="daily-progress__facts"><span>{{ t('target') }}<strong>{{ stream ? stream.targetMinutes : '—' }} <small>{{ t('minutes') }}</small></strong></span><span>{{ t('completed') }}<strong>{{ stream ? stream.completedMinutes : '—' }} <small>{{ t('minutes') }}</small></strong></span></div><p v-if="tasks.length" class="muted">{{ completeCount }} / {{ tasks.length }} {{ t('completed') }}</p></article>
        <RouterLink class="world-invitation" :to="{ name: 'world' }"><div class="world-invitation__art" aria-hidden="true"><span>✦</span><i></i><b>✧</b></div><span class="card-kicker">YOUR LITTLE WORLD</span><h3>{{ t('worldTitle') }}</h3><p>{{ t('worldHint') }}</p><span class="text-link">{{ t('enterWorld') }}<AppIcon name="arrow" :size="17" /></span></RouterLink><nav class="experience-card v2-home-quick" aria-label="快捷入口"><span class="card-kicker">快捷入口</span><RouterLink :to="{ name: 'vocabulary' }">词汇复习<AppIcon name="arrow" :size="15" /></RouterLink><RouterLink :to="{ name: 'mistakes' }">错题本<AppIcon name="arrow" :size="15" /></RouterLink><RouterLink :to="{ name: 'b2-report' }">学习报告<AppIcon name="arrow" :size="15" /></RouterLink></nav>
      </aside>
    </div>
    <section class="home-explore"><div class="section-heading"><div><span class="card-kicker">FIND YOUR RHYTHM</span><h2>{{ t('explore') }}</h2></div><p>{{ t('exploreDescription') }}</p></div><div class="activity-grid"><RouterLink v-for="(activity, index) in activities" :key="activity.key" class="activity-card" :data-tone="index % 3" :to="{ name: activity.name }"><span class="activity-card__icon"><AppIcon :name="activity.icon" :size="25" /></span><span><strong>{{ t(activity.key) }}</strong><small>{{ t(activity.hint) }}</small></span><AppIcon name="arrow" :size="17" /></RouterLink></div></section>
    <section v-if="content.length" class="home-books"><div class="section-heading"><h2>{{ t('bookshelf') }}</h2><RouterLink class="text-link" :to="{ name: 'courses' }">{{ t('viewAll') }}<AppIcon name="arrow" :size="16" /></RouterLink></div><div class="book-row"><RouterLink v-for="(item, index) in content.slice(0,3)" :key="item.contentId" class="book-card" :to="{ name: 'learn-session', query: { contentId: item.contentId } }"><span class="book-card__cover" :data-tone="index % 3"><AppIcon name="book" :size="32" /><small>{{ item.contentLocale }}</small></span><div><small>{{ t('availableContent') }}</small><h3>{{ item.title }}</h3><p>{{ item.description || t('courseFallback') }}</p></div><AppIcon name="arrow" :size="18" /></RouterLink></div></section>
  </section>
</template>
<style scoped>
.onboarding-guide{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px;padding:14px 16px;border:1px solid var(--yx-color-border);border-radius:14px;background:var(--yx-color-brand-primary-soft);color:inherit;text-decoration:none}
.onboarding-guide__copy{display:grid;gap:2px}
.onboarding-guide small{color:var(--yx-color-text-secondary);font-size:12px}
.onboarding-guide strong{color:var(--yx-color-brand-primary);white-space:nowrap}
.restricted-banner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding:16px 20px;border:1px solid var(--yx-color-border);border-left:4px solid var(--yx-color-warning,#f59e0b);border-radius:14px;background:var(--yx-color-surface-card);margin-bottom:20px}
.restricted-banner__copy strong{display:block;font-size:15px;color:var(--yx-color-text-primary);margin-bottom:4px}
.restricted-banner__copy p{margin:0;color:var(--yx-color-text-secondary);font-size:13px}
.restricted-banner__actions{display:flex;gap:10px;align-items:center}
.plan-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card);margin-bottom:12px}
.plan-banner span{color:var(--yx-color-text-secondary);font-size:13px}
.first-learning-guide,.plan-notice{margin:0 0 12px;padding:12px 14px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card)}
</style>
<style>
.home-experience.v2-home h1 { font-size: 28px; letter-spacing: -1px; color: var(--v2-ink); }
.home-experience.v2-home .experience-eyebrow, .home-experience.v2-home .card-kicker { color: var(--v2-brand); letter-spacing: 1px; font-weight: 700; }
.home-experience.v2-home .home-hero { background: var(--v2-grad-soft); color: var(--v2-ink); border: 1px solid var(--v2-line); box-shadow: var(--v2-shadow-pop); border-radius: var(--v2-radius-lg); }
.home-experience.v2-home .home-hero h2 { color: var(--v2-ink); font-size: 30px; letter-spacing: -1px; }
.home-experience.v2-home .home-hero p { color: var(--v2-mut); }
.home-experience.v2-home .home-hero .hero-label { background: var(--v2-soft); color: var(--v2-brand); border-color: transparent; }
.home-experience.v2-home .home-hero .button, .home-experience.v2-home .home-hero button { background: var(--v2-brand); color: var(--v2-inverse); border-radius: var(--v2-radius-md); }
.home-experience.v2-home .home-hero .study-artwork { opacity: .55; }
.home-experience.v2-home .experience-card { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); }
.home-experience.v2-home .daily-task-list { border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); overflow: hidden; }
.home-experience.v2-home .daily-task { border-radius: 0; border-bottom: 1px solid var(--v2-line); padding: 14px 16px; transition: background var(--v2-motion-fast); }
.home-experience.v2-home .daily-task:last-child { border-bottom: 0; }
.home-experience.v2-home .daily-task:hover:not(:disabled) { background: var(--v2-surface); }
.home-experience.v2-home .daily-task--done { opacity: .6; }
.home-experience.v2-home .text-link { color: var(--v2-brand); font-weight: 600; }
.home-experience.v2-home .onboarding-guide { background: var(--v2-soft); border-color: var(--v2-line); }
.home-experience.v2-home .v2-home-thead { display: grid; grid-template-columns: 44px minmax(0, 1fr) 90px 110px; gap: 12px; padding: 10px 16px; background: var(--v2-surface); color: var(--v2-mut); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--v2-line); }
.home-experience.v2-home .v2-home-thead span:first-child { grid-column: 1 / 3; }
.home-experience.v2-home .v2-home-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 90px 110px; gap: 12px; align-items: center; border-top: 0; text-align: left; }
.home-experience.v2-home .v2-home-row > svg { display: none; }
.home-experience.v2-home .v2-home-row .daily-task__copy small { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.home-experience.v2-home .v2-home-min { color: var(--v2-mut); font-size: 13px; }
.home-experience.v2-home .v2-home-row .daily-task__state { justify-self: start; padding: 4px 12px; border-radius: var(--v2-radius-pill); background: var(--v2-soft); color: var(--v2-brand); font-size: 12px; font-weight: 700; }
.home-experience.v2-home .v2-home-row.daily-task--done .daily-task__state { background: var(--v2-ok-soft); color: var(--v2-ok); }
.home-experience.v2-home .v2-home-rail { display: flex; flex-direction: column; gap: 16px; }
.home-experience.v2-home .v2-home-rail .world-invitation { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); color: var(--v2-ink); }
.home-experience.v2-home .v2-home-quick { display: flex; flex-direction: column; gap: 6px; padding: 18px 20px; }
.home-experience.v2-home .v2-home-quick a { display: flex; align-items: center; justify-content: space-between; min-height: 40px; padding: 0 12px; border-radius: var(--v2-radius-md); color: var(--v2-ink); text-decoration: none; font-size: 13px; transition: background var(--v2-motion-fast); }
.home-experience.v2-home .v2-home-quick a:hover { background: var(--v2-surface); color: var(--v2-brand); }
@media (max-width: 650px) { .home-experience.v2-home .v2-home-thead { display: none; } .home-experience.v2-home .v2-home-row { grid-template-columns: 40px minmax(0, 1fr); } .home-experience.v2-home .v2-home-min { display: none; } .home-experience.v2-home .v2-home-row .daily-task__state { grid-column: 2; } }
</style>
