<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
const hasConfirmedProgress = computed(() => Boolean(store.home?.tasks.length && store.home.targetMinutes > 0 && !store.home.stale))
const canContinueCourse = computed(() => Boolean(store.home?.tasks.some((task) => (task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS') && task.contentCode)
  || store.home?.content.some((item) => item.availability === 'PUBLISHED')))
onShow(async () => { if (await ensureMobilePageAccess('/pages/home/home')) void store.loadHome() })
function open(path: string): void { openUniPage(path) }
function openTask(task: MobileTask): void {
  if ((task.status !== 'AVAILABLE' && task.status !== 'IN_PROGRESS') || !task.contentCode) return
  open(`/pages/learn/learn?contentCode=${encodeURIComponent(task.contentCode)}&taskId=${encodeURIComponent(task.id)}`)
}
function continueCourse(): void {
  const task = store.home?.tasks.find((item) => (item.status === 'AVAILABLE' || item.status === 'IN_PROGRESS') && item.contentCode)
  const contentCode = task?.contentCode ?? store.home?.content.find((item) => item.availability === 'PUBLISHED')?.contentCode
  if (contentCode) open(`/pages/learn/learn?contentCode=${encodeURIComponent(contentCode)}${task ? `&taskId=${encodeURIComponent(task.id)}` : ''}`)
}
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="home" />

    <view v-if="store.home && store.homeStatus !== 'idle' && store.homeStatus !== 'loading' && !store.home.tasks.length && !store.home.content.some((item) => item.availability === 'PUBLISHED')" class="yx-card guide-strip" role="status"><text class="state-title">先定级，3 分钟出报告</text><text class="state-description">测完自动生成你的学习计划。</text><button tabindex="0" role="button" class="yx-button" type="button" @click="open('/pages/assessment/assessment')">去定级 →</button></view>
    <view v-if="store.homeStatus === 'idle' || store.homeStatus === 'loading'" class="yx-card" role="status"><text>正在读取今日任务…</text></view>
    <view v-else-if="store.homeStatus === 'offline' || store.homeStatus === 'error' || store.homeStatus === 'forbidden'" class="yx-card" role="alert">
      <text class="state-title">今日任务暂不可用</text>
      <text class="state-description">{{ store.lastError || '请稍后重试。' }}</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="store.loadHome()">重试</button>
    </view>
    <view v-else-if="store.home" class="yx-card">
      <template v-if="hasConfirmedProgress">
        <view class="progress-row"><text>今日进度</text><text class="progress">{{ store.progress }}%</text></view>
        <view class="progress-track"><view class="progress-value" :style="{ width: `${store.progress}%` }"></view></view>
      </template>
      <view v-if="!store.home.tasks.length" class="empty"><text>今天还没有安排任务。</text><text v-if="store.home.content.some((item) => item.availability === 'PUBLISHED')">可从下方选择课程。</text></view>
      <view v-for="task in store.home.tasks" :key="task.id" class="task-row">
        <view class="task-copy"><text class="task-title">{{ task.title }}</text><text class="task-description">{{ task.description }}<text v-if="task.minutes > 0"> · {{ task.minutes }} 分钟</text></text><text v-if="task.status === 'UNAVAILABLE'" class="task-warning">{{ task.unavailableReason || '内容暂不可用' }}</text></view>
        <button tabindex="0" role="button" class="task-button" :disabled="(task.status !== 'AVAILABLE' && task.status !== 'IN_PROGRESS') || !task.contentCode" @click="openTask(task)">{{ task.status === 'COMPLETED' ? '已完成' : task.status === 'LOCKED' ? '未解锁' : !task.contentCode || task.status === 'UNAVAILABLE' ? '暂不可用' : task.status === 'IN_PROGRESS' ? '继续课程' : '查看课程' }}</button>
      </view>
      <view v-if="store.home.content.length" class="content-list">
        <text class="content-list__title">课程内容</text>
        <button tabindex="0" role="button" v-for="item in store.home.content" :key="item.contentCode" class="content-row" :disabled="item.availability !== 'PUBLISHED'" @click="open(`/pages/learn/learn?contentCode=${encodeURIComponent(item.contentCode)}`)">
          <text class="content-title">{{ item.title }}</text>
          <text class="content-description">{{ item.summary || '暂无简介' }}<text v-if="item.availability !== 'PUBLISHED'"> · {{ mobileT(`availability.${item.availability}`) }}</text></text>
        </button>
      </view>
      <text v-if="store.home.contentStatus === 'UNAVAILABLE'" class="task-warning" role="alert">课程列表暂不可用。</text>
    </view>

    <MobileFeatureGrid compact />
    <view class="entry-grid"><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="open('/pages/onboarding/onboarding')">修改目标</button><button tabindex="0" role="button" class="yx-button" @click="open('/pages/assessment/assessment')">进入测评</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="open('/pages/today/today')">今日任务</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" :disabled="!canContinueCourse" @click="continueCourse">继续课程</button></view>

    <view v-if="!session.isAuthenticated" class="yx-status"><text>登录后，继续查看你的学习进度。</text><button tabindex="0" role="button" class="login-button" @click="open('/pages/login/login')">登录后继续</button></view>
  </view>
</template>

<style scoped>
.progress-row { display: flex; justify-content: space-between; align-items: center; color: var(--yx-text-secondary); font-size: 24rpx; }
.progress { color: var(--yx-brand); font-size: 56rpx; font-weight: 800; }
.progress-track { height: 14rpx; margin: 10rpx 0 26rpx; border-radius: 99rpx; background: var(--yx-surface-soft); overflow: hidden; }.progress-value { height: 100%; border-radius: inherit; background: var(--yx-brand); }
.task-row { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid var(--yx-border); }.task-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }.task-title, .task-description, .task-warning { display: block; }.task-title { font-weight: 700; }.task-description { margin-top: 6rpx; color: var(--yx-text-secondary); font-size: 22rpx; }.task-warning { margin-top: 8rpx; color: var(--yx-danger); font-size: 21rpx; }.task-button, .login-button { flex: 0 0 auto; min-width: 120rpx; padding: 8rpx 14rpx; border-radius: 12rpx; color: var(--yx-brand); background: var(--yx-brand-soft); font-size: 22rpx; }.empty { display: grid; gap: 8rpx; padding: 26rpx 0; color: var(--yx-text-secondary); font-size: 24rpx; }.content-list { display: grid; gap: 12rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid var(--yx-border); }.content-list__title { font-weight: 700; }.content-row { display: grid; gap: 6rpx; width: 100%; padding: 16rpx; border: 1rpx solid var(--yx-border); border-radius: 14rpx; color: var(--yx-text-primary); background: var(--yx-surface-card); text-align: left; }.content-row:disabled{opacity:.65}.content-title, .content-description { display: block; }.content-description { color: var(--yx-text-secondary); font-size: 22rpx; line-height: 1.45; }.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 20rpx; }.yx-button--secondary { color: var(--yx-brand); background: var(--yx-surface-card); }.state-title,.state-description{display:block}.state-title{font-weight:700}.state-description{margin-top:12rpx;color:var(--yx-text-secondary);font-size:23rpx}.first-day { display: grid; gap: 8rpx; margin-top: 20rpx; color: var(--yx-text-tertiary); font-size: 21rpx; }.yx-status { display: grid; gap: 12rpx; margin-top: 22rpx; color: var(--yx-text-secondary); font-size: 22rpx; }
@media (max-width: 420px) { .task-row { flex-wrap: wrap; }.task-copy { flex-basis: 100%; }.task-button { margin-left: auto; } }
</style>
