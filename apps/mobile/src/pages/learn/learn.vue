<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { mobileLearnerContentApi } from '../../api/learner-content'
import type { MobileContentDetail } from '../../domain/learner-content'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { consumePendingNavigationQuery, openUniPage, getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB18LearningStore } from '../../stores/b18-learning'
import { useLearnerContentStore } from '../../stores/learner-content'

const session = useSessionStore()
const learning = useB18LearningStore()
const learnerContent = useLearnerContentStore()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const contentCode = ref('')
const taskId = ref('')
const taskState = ref<'idle' | 'submitting' | 'completed'>('idle')
const content = ref<MobileContentDetail | null>(null)
const contentState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const contentError = ref<string | null>(null)
let loadedContentCode = ''
function open(path: string): void { openUniPage(path === '/pages/b2-practice/b2-practice' ? '/pages/assessment/assessment' : path) }
function completeReview(item: Parameters<typeof learning.complete>[0]): void { void learning.complete(item) }
function hashContentCode(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return ''
  return new URLSearchParams(hash.slice(queryIndex + 1)).get('contentCode')?.trim() ?? ''
}
function hashQueryValue(key: string): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return ''
  return new URLSearchParams(hash.slice(queryIndex + 1)).get(key)?.trim() ?? ''
}
async function loadContent(code: string): Promise<void> {
  const normalized = code.trim()
  if (!normalized || normalized === loadedContentCode) return
  loadedContentCode = normalized
  contentCode.value = normalized
  contentState.value = 'loading'
  contentError.value = null
  try {
    content.value = await mobileLearnerContentApi.readContent(normalized)
    contentState.value = 'ready'
  } catch (error) {
    content.value = null
    contentState.value = 'error'
    contentError.value = error instanceof Error ? error.message : '课程内容暂时不可用。'
  }
}
function initializeContent(options?: Record<string, unknown>): void {
  const pending = consumePendingNavigationQuery('/pages/learn/learn')
  const optionCode = typeof options?.contentCode === 'string' ? options.contentCode : pending.contentCode ?? ''
  const optionTask = typeof options?.taskId === 'string' ? options.taskId : pending.taskId ?? ''
  taskId.value = optionTask || hashQueryValue('taskId')
  void loadContent(optionCode || hashContentCode())
}
async function completeTask(): Promise<void> {
  if (!taskId.value || taskState.value === 'submitting' || taskState.value === 'completed') return
  taskState.value = 'submitting'
  await learnerContent.completeTask(taskId.value)
  taskState.value = learnerContent.lastError ? 'idle' : 'completed'
}
onLoad((options) => initializeContent(options as Record<string, unknown>))
onMounted(() => initializeContent())
onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; void learning.load() })
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion"><MobilePageHeader page="learn" /><MobileFeatureGrid /><view class="yx-card content-card"><text class="b10-flow__title">{{ contentCode ? '课程内容' : '从首页选择课程' }}</text><text v-if="contentState === 'idle'">选择一门课程，接着上次的进度继续学习。</text><text v-else-if="contentState === 'loading'">正在读取课程内容…</text><template v-else-if="content"><text class="content-title">{{ content.title }}</text><text class="content-meta">{{ content.contentLocale }} · {{ content.contentType }}</text><text v-if="content.summary" class="content-summary">{{ content.summary }}</text><view v-for="item in content.items" :key="item.itemId" class="content-item"><text class="content-item__text">{{ item.text }}</text><text v-for="option in item.options" :key="option.key" class="content-option">{{ option.key }} · {{ option.text }}</text></view><text v-if="!content.items.length" class="content-summary">当前版本没有可展示的学习单元。</text></template><text v-else-if="contentState === 'error'" class="review-error" role="alert">{{ contentError }}</text><button tabindex="0" role="button" v-if="taskId" class="yx-button" type="button" :disabled="taskState === 'submitting' || taskState === 'completed'" @click="completeTask">{{ taskState === 'completed' ? '本步已完成' : taskState === 'submitting' ? '正在提交…' : '完成本步' }}</button></view><view class="yx-card b10-flow"><text class="b10-flow__title">继续今天的闭环</text><text class="b10-flow__copy">目标 → 练习 → 反馈 → 复习 → 报告</text><button tabindex="0" role="button" class="yx-button" type="button" @click="open('/pages/b2-practice/b2-practice')">开始基础练习</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-listening/b11-listening')">听力精练</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-reading/b11-reading')">分级阅读</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-speaking/b11-speaking')">音标与跟读</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b3-grammar/b3-grammar')">修复语法弱点</button></view><view class="yx-card review-card"><text class="b10-flow__title">待复习 {{ learning.queue.length }} 项</text><text v-if="learning.state === 'loading'">正在读取复习队列…</text><text v-else-if="learning.state === 'permission'">当前会话没有复习权限。</text><text v-else-if="learning.state === 'offline' || learning.state === 'recovery'">复习服务暂不可用，恢复联网后可重试。</text><text v-else-if="learning.state === 'empty'">暂无待复习内容。</text><view v-for="item in learning.queue.slice(0, 4)" :key="item.queueItemId" class="review-row"><view><text>{{ item.source }} · {{ item.state }}</text><text class="review-meta">优先级 {{ item.priority }}</text></view><button tabindex="0" role="button" class="review-button" :disabled="learning.busyItemId === item.queueItemId" @click="completeReview(item)">完成</button></view><text v-if="learning.lastError" class="review-error" role="alert">{{ learning.lastError }}</text></view></view>
</template>

<style scoped lang="scss">
.b10-flow{display:grid;gap:14rpx}.b10-flow__title{font-size:32rpx;font-weight:750}.b10-flow__copy{color:var(--yx-text-secondary);font-size:24rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
.content-card{display:grid;gap:12rpx;margin-bottom:20rpx}.content-title{font-size:30rpx;font-weight:750}.content-meta,.content-summary{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.content-item{display:grid;gap:8rpx;padding-top:14rpx;border-top:1rpx solid var(--yx-border)}.content-item__text{font-size:26rpx;font-weight:650}.content-option{padding:8rpx 12rpx;border-radius:10rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:22rpx}
.review-card{display:grid;gap:14rpx;margin-top:20rpx}.review-row{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding-top:14rpx;border-top:1rpx solid var(--yx-border)}.review-row text{display:block}.review-meta{margin-top:5rpx;color:var(--yx-text-secondary);font-size:21rpx}.review-button{min-width:110rpx;padding:8rpx 14rpx;border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx}.review-error{color:var(--yx-danger);font-size:22rpx}
</style>
