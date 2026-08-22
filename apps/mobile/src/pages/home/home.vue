<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
onShow(() => { session.restore(); void store.loadHome(); void store.loadFirstDay() })
function open(path: string): void { getUniRuntime().navigateTo({ url: path }) }
function complete(taskId: string): void { void store.completeTask(taskId) }
</script>

<template>
  <view class="yx-page">
    <view class="yx-brand"><text class="yx-brand__mark" aria-hidden="true">✦</text><text>语学星</text></view>
    <text class="yx-eyebrow">B9 · LEARNER HOME</text>
    <text class="yx-title">今天，从一个清晰的小任务开始。</text>
    <text class="yx-description">首页只消费 learner/content read model；内容下线、无权和服务降级都会保留可解释的恢复路径。</text>

    <view v-if="store.homeStatus === 'loading'" class="yx-card"><text>正在加载今日学习投影…</text></view>
    <view v-else class="yx-card">
      <view class="progress-row"><text>今日闭环</text><text class="progress">{{ store.progress }}%</text></view>
      <view class="progress-track"><view class="progress-value" :style="{ width: `${store.progress}%` }"></view></view>
      <view v-if="!store.home?.tasks.length" class="empty"><text>今日暂时没有可用任务。</text><text>可能是内容版本尚未发布、权限需要恢复或服务正在降级。</text></view>
      <view v-for="task in store.home?.tasks" :key="task.id" class="task-row">
        <view class="task-copy"><text class="task-title">{{ task.title }}</text><text class="task-description">{{ task.description }} · {{ task.minutes }} 分钟</text><text v-if="task.status === 'UNAVAILABLE'" class="task-warning">暂不可用：{{ task.unavailableReason || '内容版本已下线' }}</text></view>
        <button class="task-button" :disabled="task.status === 'COMPLETED' || task.status === 'UNAVAILABLE'" @click="complete(task.id)">{{ task.status === 'COMPLETED' ? '已完成' : '开始' }}</button>
      </view>
      <text v-if="store.home?.contentStatus === 'UNAVAILABLE'" class="task-warning">课程投影暂不可用，已保留学习首页；请稍后重试。</text>
      <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
    </view>

    <view class="entry-grid"><button class="yx-button yx-button--secondary" @click="open('/pages/onboarding/onboarding')">修改目标</button><button class="yx-button" @click="open('/pages/assessment/assessment')">进入测评</button><button class="yx-button yx-button--secondary" @click="open('/pages/today/today')">今日任务</button><button class="yx-button yx-button--secondary" @click="open('/pages/learn/learn')">继续课程</button></view>
    <view class="first-day"><text>首日投影：{{ store.firstDay?.state || '加载中' }}</text><text>可用任务 {{ store.firstDay?.taskCount ?? 0 }} 个 · 内容 epoch {{ store.firstDay?.contentEpoch ?? 0 }}</text></view>
    <view v-if="!session.isAuthenticated" class="yx-status"><text>当前未登录，远程读模型失败时只展示本地安全状态，不伪造登录成功。</text><button class="login-button" @click="open('/pages/login/login')">登录后继续</button></view>
  </view>
</template>

<style scoped>
.progress-row { display: flex; justify-content: space-between; align-items: center; color: #666d80; font-size: 24rpx; }
.progress { color: #596bff; font-size: 56rpx; font-weight: 800; }
.progress-track { height: 14rpx; margin: 10rpx 0 26rpx; border-radius: 99rpx; background: #e9ebf4; overflow: hidden; }.progress-value { height: 100%; border-radius: inherit; background: #596bff; }
.task-row { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid #edf0f6; }.task-copy { flex: 1; }.task-title, .task-description, .task-warning { display: block; }.task-title { font-weight: 700; }.task-description { margin-top: 6rpx; color: #666d80; font-size: 22rpx; }.task-warning, .error { margin-top: 8rpx; color: #b54747; font-size: 21rpx; }.task-button, .login-button { min-width: 120rpx; padding: 8rpx 14rpx; border-radius: 12rpx; color: #596bff; background: #eef0ff; font-size: 22rpx; }.empty { display: grid; gap: 8rpx; padding: 26rpx 0; color: #666d80; font-size: 24rpx; }.entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; margin-top: 20rpx; }.yx-button--secondary { color: #596bff; background: #fff; }.first-day { display: grid; gap: 8rpx; margin-top: 20rpx; color: #8a91a3; font-size: 21rpx; }.yx-status { display: grid; gap: 12rpx; margin-top: 22rpx; color: #666d80; font-size: 22rpx; }
</style>
