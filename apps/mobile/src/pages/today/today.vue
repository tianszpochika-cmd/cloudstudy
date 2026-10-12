<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { ALGORITHM_VERSION, arrangementLabel, emptyStateView, firstLearningGuideCopy, type EmptyStateView } from '../../domain/plan-today'
import { useLearnerContentStore } from '../../stores/learner-content'
import { computed } from 'vue'

const store = useLearnerContentStore()
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const firstLearningCopy = computed(() => {
  const first = store.planQueue?.firstLearning
  return first?.guideVisible ? firstLearningGuideCopy(first.reason) : null
})
const planEmpty = computed((): EmptyStateView | null => {
  if ((store.home?.tasks.length ?? 0) > 0) return null
  if (store.planQueueStatus === 'error') return emptyStateView({ failed: true, reason: null, hasTasks: false })
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyStateView({ failed: false, reason: store.planQueue?.emptyReason ?? null, hasTasks: false })
})
onShow(async () => { if (await ensureMobilePageAccess('/pages/today/today')) void store.loadHome() })
function openPlanEmpty(view: EmptyStateView): void {
  if (view.to === 'retry') { void store.loadHome(); return }
  if (view.to === 'onboarding') { openUniPage('/pages/onboarding/onboarding'); return }
  getUniRuntime().switchTab({ url: '/pages/home/home' })
}
function canOpenTask(task: MobileTask): boolean { return (task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS') && Boolean(task.contentCode) }
function viewTask(task: MobileTask): void {
  if (!canOpenTask(task) || !task.contentCode) return
  openUniPage(`/pages/learn/learn?contentCode=${encodeURIComponent(task.contentCode)}&taskId=${encodeURIComponent(task.id)}`)
}
function backHome(): void { getUniRuntime().switchTab({ url: '/pages/home/home' }) }
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="today" />
    <view v-if="store.homeStatus === 'idle' || store.homeStatus === 'loading'" class="yx-card" role="status"><text>正在读取今日任务…</text></view>
    <view v-else-if="store.homeStatus === 'offline' || store.homeStatus === 'error' || store.homeStatus === 'forbidden'" class="yx-card" role="alert">
      <text class="state-title">今日任务暂时无法读取</text>
      <text class="state-description">{{ store.homeStatus === 'forbidden' ? '当前账号没有查看权限。' : '请检查网络后重试。' }}</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="store.loadHome()">重试</button>
    </view>
    <view v-else class="v2-today-body">
      <view v-if="store.homeStatus === 'unavailable'" class="yx-card v2-today-card v2-today-unavailable unavailable" role="status">
        <text class="state-title">课程列表暂不可用</text>
        <text class="state-description">今日任务状态仍可查看。</text>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="store.loadHome()">重新加载</button>
      </view>
      <view class="yx-card v2-today-card">
        <text class="v2-today-eyebrow"><AppIcon name="list" :size="14" /><text>今日</text></text>
        <text class="v2-today-title">今日任务</text>
        <template v-if="store.home"><text class="yx-description v2-today-desc">目标 {{ store.home.targetMinutes }} 分钟，已完成 {{ store.home.completedMinutes }} 分钟。</text><view class="progress-row v2-today-progress-row"><text>今日进度</text><text class="progress v2-today-progress">{{ store.progress }}%</text></view><view class="progress-track v2-today-progress-track"><view class="progress-value" :style="{ width: `${store.progress}%` }"></view></view></template>
        <text data-algorithm>{{ store.planQueue?.algorithmVersion || ALGORITHM_VERSION }}</text>
        <text v-for="item in store.planQueue?.arrangements ?? []" :key="item.itemId" data-arrangement>{{ arrangementLabel(item.arrangement, item.arrangementCopy) }}</text>
        <view v-if="planExplanation" class="empty v2-today-empty" role="status">{{ planExplanation }}</view>
        <view v-if="firstLearningCopy" class="empty v2-today-empty" role="status">{{ firstLearningCopy }}</view>
        <view v-if="store.planNotice" class="empty v2-today-empty" role="status">{{ store.planNotice }}</view>
        <view v-if="planEmpty" class="empty v2-today-empty"><text>{{ planEmpty.title }}</text><text>{{ planEmpty.description }}</text><button tabindex="0" role="button" type="button" @click="openPlanEmpty(planEmpty)">{{ planEmpty.action }}</button></view>
        <view :hidden="planEmpty !== null" :class="'v2-today-empty'" v-if="store.home && !store.home.tasks.length" class="empty">今天还没有安排任务。</view>
        <view v-for="task in store.home?.tasks" :key="task.id" class="task-row v2-today-task-row">
          <view class="task-copy"><text class="title">{{ task.title }}</text><text class="description">{{ task.description }} · {{ task.minutes }} 分钟</text></view>
          <button tabindex="0" role="button" :disabled="!canOpenTask(task)" @click="viewTask(task)">{{ task.status === 'COMPLETED' ? '已完成' : task.status === 'LOCKED' ? '未解锁' : canOpenTask(task) ? '查看课程' : '暂不可用' }}</button>
        </view>
        <view v-if="!store.home && store.homeStatus === 'empty'" class="empty v2-today-empty">今天还没有可展示的任务。</view>
      </view>
    </view>
    <button tabindex="0" role="button" class="yx-button yx-button--secondary v2-today-back" @click="backHome"><AppIcon name="back" :size="14" />返回学习首页</button>
  </view>
</template>

<style scoped>.progress{display:block;margin:16rpx 0;color:var(--yx-brand);font-size:72rpx;font-weight:700}.empty{padding:24rpx 0;color:var(--yx-text-secondary);font-size:24rpx}.task-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:20rpx 0;border-top:1rpx solid var(--yx-border)}.task-copy{flex:1;min-width:0;overflow-wrap:anywhere}.title,.description{display:block}.title{font-weight:700}.description{margin-top:6rpx;color:var(--yx-text-secondary);font-size:22rpx}.task-row button{flex:0 0 auto;min-width:120rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:22rpx}.state-title,.state-description{display:block}.state-title{font-weight:700}.state-description{margin-top:12rpx;color:var(--yx-text-secondary);font-size:23rpx}.unavailable{display:grid;gap:8rpx;padding-bottom:18rpx;border-bottom:1rpx solid var(--yx-border)}.unavailable .state-description{margin-top:0}.unavailable .yx-button{justify-self:start}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}@media(max-width:420px){.task-row{flex-wrap:wrap}.task-copy{flex-basis:100%}.task-row button{margin-left:auto}}
/* v2 今日页换皮：对齐 home.vue v2-home-* 卡片/进度条/eyebrow/按钮同样数值，仅用 var(--v2-*)。 */
.v2-today-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font)}
.v2-today-card{padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-today-unavailable{display:grid;gap:var(--v2-space-2)}
.v2-today-eyebrow{display:flex;align-items:center;gap:var(--v2-space-2);margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.v2-today-title{display:block;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45}
.v2-today-desc{display:block;margin-top:var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-today-progress-row{display:flex;justify-content:space-between;align-items:center;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-today-progress{color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:800;line-height:1.2}
.v2-today-progress-track{height:14rpx;margin:var(--v2-space-2) 0 var(--v2-space-4);border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-today-progress-track .progress-value{height:100%;border-radius:inherit;background:var(--v2-brand)}
.v2-today-empty{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4) 0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-today-task-row{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-today-task-row:hover{border-color:var(--v2-brand)}
.v2-today-back{box-sizing:border-box;min-height:var(--v2-space-12);margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid transparent;border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5;white-space:nowrap}
.v2-today-back:active{transform:scale(.97)}
.v2-today-back:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-today-back:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}</style>
