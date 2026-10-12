<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { hasPlacementEntryReached, ONBOARDING_GUIDE_ACTION, onboardingProgressLabel, onboardingRemainingStepLabels, selectOnboardingResumeStep, showOnboardingGuide } from '../../domain/onboarding-resume'
import { emptyStateView, firstLearningGuideCopy, isAccessibleContent, shelfSearchState, type EmptyStateView } from '../../domain/plan-today'
import { learnerAuthoringActions, shelfNote } from '../../domain/content-release'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
const courseQuery = ref('')
const hasConfirmedProgress = computed(() => Boolean(store.home?.tasks.length && store.home.targetMinutes > 0 && !store.home.stale))
const canContinueCourse = computed(() => Boolean(store.home?.tasks.some((task) => (task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS') && task.contentCode)))
const publishedContent = computed(() => (store.home?.content ?? []).filter((item) => isAccessibleContent(item)))
const visibleContent = computed(() => {
  const needle = courseQuery.value.trim().toLowerCase()
  return publishedContent.value.filter((item) => !needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle))
})
const releaseNote = computed(() => shelfNote(publishedContent.value))
void learnerAuthoringActions()
const shelf = computed(() => shelfSearchState(
  publishedContent.value.length,
  visibleContent.value.length,
  store.home?.contentStatus === 'UNAVAILABLE',
))
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const firstLearningCopy = computed(() => {
  const first = store.planQueue?.firstLearning
  return first?.guideVisible ? firstLearningGuideCopy(first.reason) : null
})
const planEmpty = computed((): EmptyStateView | null => {
  if ((store.home?.tasks.length ?? 0) > 0) return null
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyStateView({ failed: false, reason: store.planQueue?.emptyReason ?? null, hasTasks: false })
})
const guideReady = ref(false)
const guideAction = ONBOARDING_GUIDE_ACTION
const guideVisible = computed(() => {
  const facts = store.onboardingResume
  if (!guideReady.value || !facts || session.adultGate === 'REJECTED') return false
  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  return showOnboardingGuide(facts, hasPlacementEntryReached(storage, session.verifiedSubject))
})
const guideLabel = computed(() => store.onboardingResume ? onboardingProgressLabel(store.onboardingResume) : '')
const guideSteps = computed(() => store.onboardingResume ? onboardingRemainingStepLabels(store.onboardingResume) : [])
const guidePath = computed(() => store.onboardingResume && selectOnboardingResumeStep(store.onboardingResume) === 'assessment' ? '/pages/assessment/assessment' : '/pages/onboarding/onboarding')
async function loadGuide(): Promise<void> {
  guideReady.value = false
  if (session.adultGate === 'REJECTED' || typeof store.loadOnboardingResume !== 'function') return
  try {
    await store.loadOnboardingResume()
    guideReady.value = true
  } catch {
    guideReady.value = false
  }
}
onShow(async () => { if (await ensureMobilePageAccess('/pages/home/home')) { void store.loadHome(); void loadGuide() } })
function open(path: string): void { openUniPage(path) }
function openTask(task: MobileTask): void {
  if ((task.status !== 'AVAILABLE' && task.status !== 'IN_PROGRESS') || !task.contentCode) return
  open(`/pages/learn/learn?contentCode=${encodeURIComponent(task.contentCode)}&taskId=${encodeURIComponent(task.id)}`)
}
function continueCourse(): void {
  const task = store.home?.tasks.find((item) => (item.status === 'AVAILABLE' || item.status === 'IN_PROGRESS') && item.contentCode)
  if (!task?.contentCode) return
  open(`/pages/learn/learn?contentCode=${encodeURIComponent(task.contentCode)}&taskId=${encodeURIComponent(task.id)}`)
}
function openPlanEmpty(view: EmptyStateView): void {
  if (view.to === 'retry') { void store.refreshPlanQueue(); return }
  if (view.to === 'onboarding') { open('/pages/onboarding/onboarding'); return }
  open('/pages/home/home')
}
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="home" />

    <view v-if="guideVisible" class="onboarding-guide"><view class="onboarding-guide__copy"><text>{{ guideLabel }}</text><text v-if="guideSteps.length" class="onboarding-guide__steps">剩余步骤：{{ guideSteps.join('、') }}</text></view><button tabindex="0" role="button" class="yx-button" type="button" @click="open(guidePath)">{{ guideAction }}</button></view>
    <view v-if="firstLearningCopy" class="first-learning-guide" role="status"><text>{{ firstLearningCopy }}</text></view>
    <view v-if="planExplanation" class="plan-banner" role="status"><text>{{ planExplanation }}</text></view>
    <view v-if="store.planNotice" class="plan-banner" role="status"><text>{{ store.planNotice }}</text></view>

    <view v-if="store.homeStatus === 'idle' || store.homeStatus === 'loading'" class="yx-card" role="status"><text>正在读取今日任务…</text></view>
    <view v-else-if="store.homeStatus === 'offline' || store.homeStatus === 'error' || store.homeStatus === 'forbidden'" class="yx-card" role="alert">
      <text class="state-title">今日任务暂不可用</text>
      <text class="state-description">{{ store.lastError || '请稍后重试。' }}</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="store.loadHome()">重试</button>
    </view>
    <view v-else-if="store.home" class="v2-home-body">
      <view class="v2-home-hero">
        <view class="v2-home-eyebrow"><AppIcon name="home" :size="14" /><text>今日学习<text v-if="store.home.targetMinutes > 0"> · 目标 {{ store.home.targetMinutes }} 分钟</text></text></view>
        <text class="v2-home-hi">继续推进</text>
        <text v-if="store.home.tasks.length" class="v2-home-sub">今日共 {{ store.home.tasks.length }} 个任务</text>
        <view class="v2-home-kpis">
          <view class="v2-home-kpi"><text class="v2-home-kpi-value">{{ store.home.tasks.length }}</text><text class="v2-home-kpi-label">今日任务</text></view>
          <view class="v2-home-kpi"><text class="v2-home-kpi-value">{{ store.home.content.length }}</text><text class="v2-home-kpi-label">课程内容</text></view>
          <view v-if="hasConfirmedProgress" class="v2-home-kpi"><text class="v2-home-kpi-value">{{ store.progress }}%</text><text class="v2-home-kpi-label">今日进度</text></view>
        </view>
        <template v-if="hasConfirmedProgress">
          <view class="progress-row"><text>今日进度</text><text class="progress">{{ store.progress }}%</text></view>
          <view class="progress-track"><view class="progress-value" :style="{ width: `${store.progress}%` }"></view></view>
        </template>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary v2-home-continue" :disabled="!canContinueCourse" @click="continueCourse"><AppIcon name="learn" :size="16" />继续课程<AppIcon name="chev" :size="14" /></button>
      </view>

      <view class="yx-card v2-home-card">
        <text class="v2-home-eyebrow">今日</text>
        <text class="v2-home-card-title">今日任务（{{ store.home.tasks.length }}）</text>
        <view v-if="planEmpty" class="empty"><text>{{ planEmpty.title }}</text><text>{{ planEmpty.description }}</text><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="openPlanEmpty(planEmpty)">{{ planEmpty.action }}</button></view>
        <view :hidden="planEmpty !== null" v-if="!store.home.tasks.length" class="empty"><text>今天还没有安排任务。</text><text v-if="store.home.content.some((item) => item.availability === 'PUBLISHED')">可从下方选择课程。</text></view>
        <view v-for="task in store.home.tasks" :key="task.id" class="task-row">
          <view class="task-copy"><text class="task-title">{{ task.title }}</text><text class="task-description">{{ task.description }}<text v-if="task.minutes > 0"> · {{ task.minutes }} 分钟</text></text><text v-if="task.status === 'UNAVAILABLE'" class="task-warning">{{ task.unavailableReason || '内容暂不可用' }}</text></view>
          <button tabindex="0" role="button" class="task-button" :disabled="(task.status !== 'AVAILABLE' && task.status !== 'IN_PROGRESS') || !task.contentCode" @click="openTask(task)">{{ task.status === 'COMPLETED' ? '已完成' : task.status === 'LOCKED' ? '未解锁' : !task.contentCode || task.status === 'UNAVAILABLE' ? '暂不可用' : task.status === 'IN_PROGRESS' ? '继续课程' : '查看课程' }}</button>
        </view>
      </view>

      <view class="yx-card v2-home-card">
        <text class="v2-home-eyebrow">补救</text>
        <text class="v2-home-card-title">错题本</text>
        <text class="v2-home-card-desc">答错的题目会收进错题本，随时回来补救。</text>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary v2-home-card-action" @click="open('/pages/b10-report/b10-report')"><AppIcon name="learn" :size="16" />进错题本<AppIcon name="chev" :size="14" /></button>
      </view>

      <view class="yx-card v2-home-card">
        <view class="content-list">
          <text class="content-list__title">课程内容</text>
          <text v-if="releaseNote" data-release-note>{{ releaseNote }}</text>
          <input v-model="courseQuery" class="course-search" type="search" aria-label="搜索课程" placeholder="搜索课程" />
          <text v-if="shelf === 'catalog-empty'" class="content-description">书架里还没有可学习的内容。</text>
          <text v-else-if="shelf === 'no-matches'" class="content-description">没有匹配的课程。</text>
          <text v-else-if="shelf === 'error'" class="content-description">课程暂时没能加载。</text>
          <button tabindex="0" role="button" v-for="item in visibleContent" :key="item.contentCode" class="content-row" @click="open(`/pages/learn/learn?contentCode=${encodeURIComponent(item.contentCode)}`)">
            <text class="content-title">{{ item.title }}</text>
            <text class="content-description">{{ item.summary || '暂无简介' }}</text>
          </button>
        </view>
        <text v-if="store.home.contentStatus === 'UNAVAILABLE'" class="task-warning" role="alert">课程列表暂不可用。</text>
      </view>
    </view>

    <MobileFeatureGrid compact />
    <view class="entry-grid"><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="open('/pages/onboarding/onboarding')">修改目标</button><button tabindex="0" role="button" class="yx-button" @click="open('/pages/assessment/assessment')">进入测评</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="open('/pages/today/today')">今日任务</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" :disabled="!canContinueCourse" @click="continueCourse">继续课程</button></view>

    <view v-if="!session.isAuthenticated" class="yx-status"><text>登录后，继续查看你的学习进度。</text><button tabindex="0" role="button" class="login-button" @click="open('/pages/login/login')">登录后继续</button></view>
  </view>
</template>

<style scoped>
.onboarding-guide { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 20rpx; padding: 18rpx; border: 1rpx solid var(--yx-border); border-radius: 14rpx; background: var(--yx-brand-soft); }
.onboarding-guide__copy { display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.onboarding-guide__steps { color: var(--yx-text-secondary); font-size: 22rpx; }
.onboarding-guide .yx-button { margin-top: 0; }
.progress-row { display: flex; justify-content: space-between; align-items: center; color: var(--yx-text-secondary); font-size: 24rpx; }
.progress { color: var(--yx-brand); font-size: 56rpx; font-weight: 800; }
.progress-track { height: 14rpx; margin: 10rpx 0 26rpx; border-radius: 99rpx; background: var(--yx-surface-soft); overflow: hidden; }.progress-value { height: 100%; border-radius: inherit; background: var(--yx-brand); }
.task-row { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid var(--yx-border); }.task-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }.task-title, .task-description, .task-warning { display: block; }.task-title { font-weight: 700; }.task-description { margin-top: 6rpx; color: var(--yx-text-secondary); font-size: 22rpx; }.task-warning { margin-top: 8rpx; color: var(--yx-danger); font-size: 21rpx; }.task-button, .login-button { flex: 0 0 auto; min-width: 120rpx; padding: 8rpx 14rpx; border-radius: 12rpx; color: var(--yx-brand); background: var(--yx-brand-soft); font-size: 22rpx; }.empty { display: grid; gap: 8rpx; padding: 26rpx 0; color: var(--yx-text-secondary); font-size: 24rpx; }.content-list { display: grid; gap: 12rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid var(--yx-border); }.content-list__title { font-weight: 700; }.content-row { display: grid; gap: 6rpx; width: 100%; padding: 16rpx; border: 1rpx solid var(--yx-border); border-radius: 14rpx; color: var(--yx-text-primary); background: var(--yx-surface-card); text-align: left; }.content-row:disabled{opacity:.65}.content-title, .content-description { display: block; }.content-description { color: var(--yx-text-secondary); font-size: 22rpx; line-height: 1.45; }
.course-search { box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; margin: 8rpx 0; padding: 12rpx 14rpx; border: 1rpx solid var(--yx-border); border-radius: 12rpx; color: var(--yx-text-primary); background: var(--yx-surface-card); }
.first-learning-guide, .plan-banner { margin-top: 12rpx; padding: 14rpx 16rpx; border: 1rpx solid var(--yx-border); border-radius: 12rpx; color: var(--yx-text-secondary); font-size: 24rpx; }.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 20rpx; }.yx-button--secondary { color: var(--yx-brand); background: var(--yx-surface-card); }.state-title,.state-description{display:block}.state-title{font-weight:700}.state-description{margin-top:12rpx;color:var(--yx-text-secondary);font-size:23rpx}.first-day { display: grid; gap: 8rpx; margin-top: 20rpx; color: var(--yx-text-tertiary); font-size: 21rpx; }.yx-status { display: grid; gap: 12rpx; margin-top: 22rpx; color: var(--yx-text-secondary); font-size: 22rpx; }
@media (max-width: 420px) { .task-row { flex-wrap: wrap; }.task-copy { flex-basis: 100%; }.task-button { margin-left: auto; } }
</style>
