<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useLearnerContentStore } from '../../stores/learner-content'

const store = useLearnerContentStore()
onShow(async () => { if (await ensureMobilePageAccess('/pages/today/today')) void store.loadHome() })
function complete(taskId: string): void { void store.completeTask(taskId) }
function backHome(): void { getUniRuntime().switchTab({ url: '/pages/home/home' }) }
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="today" />
    <view class="yx-card"><text class="progress">{{ store.progress }}%</text><text class="yx-description">目标 {{ store.home?.targetMinutes ?? 15 }} 分钟，已完成 {{ store.home?.completedMinutes ?? 0 }} 分钟。</text><view v-if="!store.home?.tasks.length" class="empty">今天还没有可用任务。你可以稍后再试，或调整学习目标。</view><view v-for="task in store.home?.tasks" :key="task.id" class="task-row"><view><text class="title">{{ task.title }}</text><text class="description">{{ task.description }} · {{ task.minutes }} 分钟</text></view><button tabindex="0" role="button" :disabled="task.status === 'COMPLETED' || task.status === 'UNAVAILABLE'" @click="complete(task.id)">{{ task.status === 'COMPLETED' ? '已完成' : task.status === 'UNAVAILABLE' ? '不可用' : '完成' }}</button></view><text v-if="store.lastError" class="error">{{ store.lastError }}</text></view>
    <button tabindex="0" role="button" class="yx-button yx-button--secondary" @click="backHome">返回学习首页</button>
  </view>
</template>

<style scoped>.progress{display:block;margin:16rpx 0;color:var(--yx-brand);font-size:72rpx;font-weight:700}.empty{padding:24rpx 0;color:var(--yx-text-secondary);font-size:24rpx}.task-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:20rpx 0;border-top:1rpx solid var(--yx-border)}.title,.description{display:block}.title{font-weight:700}.description{margin-top:6rpx;color:var(--yx-text-secondary);font-size:22rpx}.task-row button{min-width:120rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:22rpx}.error{display:block;margin-top:16rpx;color:var(--yx-danger);font-size:22rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}</style>
