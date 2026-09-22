<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
onShow(async () => { if (!await ensureMobilePageAccess('/pages/home/home')) return; void store.loadHome(); void store.loadFirstDay() })
function open(path: string): void { openUniPage(path) }
function openTask(task: MobileTask): void {
  if (task.status === 'UNAVAILABLE' || task.status === 'COMPLETED') return
  const contentCode = task.contentCode ?? store.home?.content[0]?.contentCode ?? ''
  const query = contentCode ? `?contentCode=${encodeURIComponent(contentCode)}&taskId=${encodeURIComponent(task.id)}` : `?taskId=${encodeURIComponent(task.id)}`
  open(`/pages/learn/learn${query}`)
}
function continueCourse(): void {
  const task = store.home?.tasks.find((item) => item.status !== 'COMPLETED' && item.contentCode)
  const contentCode = task?.contentCode ?? store.home?.content[0]?.contentCode ?? ''
  open(contentCode ? `/pages/learn/learn?contentCode=${encodeURIComponent(contentCode)}${task ? `&taskId=${encodeURIComponent(task.id)}` : ''}` : '/pages/learn/learn')
}
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="home" />

    <view v-if="store.homeStatus === 'loading'" class="yx-card"><text>正在准备今日学习任务…</text></view>
    <view v-else class="yx-card">
      <view class="progress-row"><text>今日闭环</text><text class="progress">{{ store.progress }}%</text></view>
      <view class="progress-track"><view class="progress-value" :style="{ width: `${store.progress}%` }"></view></view>
      <view v-if="!store.home?.tasks.length" class="empty"><text>今日暂时没有可用任务。</text><text>稍后再来看看，也可以先设置你的学习目标。</text></view>
      <view v-for="task in store.home?.tasks" :key="task.id" class="task-row">
        <view class="task-copy"><text class="task-title">{{ task.title }}</text><text class="task-description">{{ task.description }} · {{ task.minutes }} 分钟</text><text v-if="task.status === 'UNAVAILABLE'" class="task-warning">暂不可用：{{ task.unavailableReason || '内容版本已下线' }}</text></view>
        <button tabindex="0" role="button" class="task-button" :disabled="task.status === 'COMPLETED' || task.status === 'UNAVAILABLE'" @click="openTask(task)">{{ task.status === 'COMPLETED' ? '已完成' : '开始' }}</button>
      </view>
      <view v-if="store.home?.content.length" class="content-list">
        <text class="content-list__title">可继续内容</text>
        <button tabindex="0" role="button" v-for="item in store.home.content" :key="item.contentCode" class="content-row" @click="open(`/pages/learn/learn?contentCode=${encodeURIComponent(item.contentCode)}`)">
          <text class="content-title">{{ item.title }}</text>
          <text class="content-description">{{ item.summary || '已发布学习内容' }} · {{ item.contentLocale }} · {{ mobileT(`availability.${item.availability}`) }}</text>
        </button>
      </view>
      <text v-if="store.home?.contentStatus === 'UNAVAILABLE'" class="task-warning">课程内容暂时不可用，请稍后重试。</text>
      <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
    </view>

    <MobileFeatureGrid compact />
    <view class="entry-grid"><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="open('/pages/onboarding/onboarding')">修改目标</button><button tabindex="0" role="button" class="yx-button" @click="open('/pages/assessment/assessment')">进入测评</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="open('/pages/today/today')">今日任务</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="continueCourse">继续课程</button></view>

    <view v-if="!session.isAuthenticated" class="yx-status"><text>登录后，继续查看你的学习进度。</text><button tabindex="0" role="button" class="login-button" @click="open('/pages/login/login')">登录后继续</button></view>
  </view>
</template>

<style scoped>
.progress-row { display: flex; justify-content: space-between; align-items: center; color: var(--yx-text-secondary); font-size: 24rpx; }
.progress { color: var(--yx-brand); font-size: 56rpx; font-weight: 800; }
.progress-track { height: 14rpx; margin: 10rpx 0 26rpx; border-radius: 99rpx; background: var(--yx-surface-soft); overflow: hidden; }.progress-value { height: 100%; border-radius: inherit; background: var(--yx-brand); }
.task-row { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid var(--yx-border); }.task-copy { flex: 1; }.task-title, .task-description, .task-warning { display: block; }.task-title { font-weight: 700; }.task-description { margin-top: 6rpx; color: var(--yx-text-secondary); font-size: 22rpx; }.task-warning, .error { margin-top: 8rpx; color: var(--yx-danger); font-size: 21rpx; }.task-button, .login-button { min-width: 120rpx; padding: 8rpx 14rpx; border-radius: 12rpx; color: var(--yx-brand); background: var(--yx-brand-soft); font-size: 22rpx; }.empty { display: grid; gap: 8rpx; padding: 26rpx 0; color: var(--yx-text-secondary); font-size: 24rpx; }.content-list { display: grid; gap: 12rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid var(--yx-border); }.content-list__title { font-weight: 700; }.content-row { display: grid; gap: 6rpx; width: 100%; padding: 16rpx; border: 1rpx solid var(--yx-border); border-radius: 14rpx; color: var(--yx-text-primary); background: var(--yx-surface-card); text-align: left; }.content-title, .content-description { display: block; }.content-description { color: var(--yx-text-secondary); font-size: 22rpx; line-height: 1.45; }.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 20rpx; }.yx-button--secondary { color: var(--yx-brand); background: var(--yx-surface-card); }.first-day { display: grid; gap: 8rpx; margin-top: 20rpx; color: var(--yx-text-tertiary); font-size: 21rpx; }.yx-status { display: grid; gap: 12rpx; margin-top: 22rpx; color: var(--yx-text-secondary); font-size: 22rpx; }
</style>
