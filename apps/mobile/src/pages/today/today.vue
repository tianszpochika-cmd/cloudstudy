<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'

const store = useLearnerContentStore()
onShow(() => { void store.loadHome() })
function complete(taskId: string): void { void store.completeTask(taskId) }
function backHome(): void { getUniRuntime().switchTab({ url: '/pages/home/home' }) }
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">TODAY'S LOOP · READ MODEL</text><text class="yx-title">今天完成一个小闭环。</text>
    <view class="yx-card"><text class="progress">{{ store.progress }}%</text><text class="yx-description">目标 {{ store.home?.targetMinutes ?? 15 }} 分钟，已完成 {{ store.home?.completedMinutes ?? 0 }} 分钟。</text><view v-if="!store.home?.tasks.length" class="empty">今日任务为空；内容下线或无权状态不会被伪装成完成。</view><view v-for="task in store.home?.tasks" :key="task.id" class="task-row"><view><text class="title">{{ task.title }}</text><text class="description">{{ task.description }} · {{ task.minutes }} 分钟</text></view><button :disabled="task.status === 'COMPLETED' || task.status === 'UNAVAILABLE'" @click="complete(task.id)">{{ task.status === 'COMPLETED' ? '已完成' : task.status === 'UNAVAILABLE' ? '不可用' : '完成' }}</button></view><text v-if="store.lastError" class="error">{{ store.lastError }}</text></view>
    <button class="yx-button yx-button--secondary" @click="backHome">返回学习首页</button>
  </view>
</template>

<style scoped>.progress{display:block;margin:16rpx 0;color:#596bff;font-size:72rpx;font-weight:700}.empty{padding:24rpx 0;color:#666d80;font-size:24rpx}.task-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:20rpx 0;border-top:1rpx solid #edf0f6}.title,.description{display:block}.title{font-weight:700}.description{margin-top:6rpx;color:#666d80;font-size:22rpx}.task-row button{min-width:120rpx;color:#596bff;background:#eef0ff;font-size:22rpx}.error{display:block;margin-top:16rpx;color:#b54747;font-size:22rpx}.yx-button--secondary{color:#596bff;background:#fff}</style>
