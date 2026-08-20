<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import EmptyState from '../../components/EmptyState.vue'

const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const unsubscribe = engine.subscribe((state) => {
  performanceLevel.value = state.level
})

onMounted(() => {
  session.restore()
  engine.restore()
})

onUnmounted(() => {
  unsubscribe()
  engine.dispose()
})

function openLogin(): void {
  getUniRuntime().navigateTo({ url: '/pages/login/login' })
}

function selectPerformance(level: PerformanceLevel): void {
  engine.setLevel(level, 'manual')
}
</script>

<template>
  <view class="yx-page">
    <view class="yx-brand">
      <text class="yx-brand__mark" aria-hidden="true">✦</text>
      <text>语学星</text>
    </view>

    <text class="yx-eyebrow">ADAPTIVE HOME</text>
    <text class="yx-title">今天，从一个清晰的小任务开始。</text>
    <text class="yx-description">学习首页会在身份、学习计划和任务契约接入后加载真实数据。当前基座先展示可解释的空状态。</text>

    <view class="yx-card">
      <text class="yx-eyebrow">当前状态</text>
      <EmptyState title="今日任务为空" description="没有本地伪造的课程或进度。联网并完成身份契约后，系统会在这里呈现下一步。" />
      <button v-if="!session.isAuthenticated" class="yx-button" type="button" @click="openLogin">登录后继续</button>
      <view class="yx-status">
        <view class="yx-status__dot yx-status__dot--success" aria-hidden="true"></view>
        <text>性能档位：{{ performanceLevel }}</text>
      </view>
      <view class="performance-options" aria-label="手动选择性能档位">
        <button
          v-for="level in ['Ultra', 'High', 'Medium', 'Performance'] as PerformanceLevel[]"
          :key="level"
          class="performance-option"
          :class="{ 'performance-option--active': performanceLevel === level }"
          type="button"
          @click="selectPerformance(level)"
        >
          {{ level }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.performance-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 24rpx;
}

.performance-option {
  min-height: 64rpx;
  padding: 0 8rpx;
  border: 1rpx solid #e6e8f0;
  border-radius: 12rpx;
  color: #666d80;
  background: #fff;
  font-size: 22rpx;
}

.performance-option--active {
  border-color: #596bff;
  color: #596bff;
  background: #eef0ff;
}
</style>
