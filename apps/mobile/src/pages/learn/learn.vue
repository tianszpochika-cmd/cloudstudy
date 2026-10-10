<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { mobileLearnerContentApi } from '../../api/learner-content'
import type { MobileB18ReviewQueueItem } from '../../api/b18-learning'
import type { MobileContentDetail } from '../../domain/learner-content'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { consumePendingNavigationQuery, openUniPage, getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB18LearningStore } from '../../stores/b18-learning'
import { weaknessView } from '../../domain/mistake-book'
import { reviewFailureCopy } from '../../domain/review-stage'

const session = useSessionStore()
const learning = useB18LearningStore()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const contentCode = ref('')
const taskId = ref('')
const content = ref<MobileContentDetail | null>(null)
const contentState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const contentError = ref<string | null>(null)
const contentMeta = computed(() => {
  if (!content.value) return ''
  const locale = ({ 'en-US': '英语', 'en-GB': '英语', 'zh-CN': '中文', 'de-DE': '德语', 'fr-FR': '法语', 'es-ES': '西班牙语' } as Record<string, string>)[content.value.contentLocale]
  const kind = ({ COURSE: '课程', COURSE_UNIT: '课程单元', VOCABULARY: '词汇', PHRASE: '短语', GRAMMAR: '语法', SENTENCE: '句子', MEDIA: '音视频', QUESTION: '练习' } as Record<string, string>)[content.value.contentType]
  return [locale, kind].filter(Boolean).join(' · ')
})
const reviewCountKnown = computed(() => ['ready', 'empty', 'partial', 'success'].includes(learning.state))
const reviewRows = computed(() => reviewCountKnown.value ? learning.queue.slice(0, 4) : [])
const reviewNotice = computed(() => {
  if (reviewCountKnown.value || learning.state === 'idle' || learning.state === 'loading') return null
  return learning.lastError || (learning.state === 'permission' ? '当前账号无法查看复习安排。' : '复习安排暂不可用。')
})
let loadedContentCode = ''
function open(path: string): void { openUniPage(path === '/pages/b2-practice/b2-practice' ? '/pages/assessment/assessment' : path) }
function completeReview(item: Parameters<typeof learning.complete>[0]): void {
  if (!item.completable || learning.busyItemId === item.queueItemId) return
  void learning.complete(item)
}
function reviewLabel(item: MobileB18ReviewQueueItem): string {
  const source = { NEW: '新内容', REVIEW: '复习', MISTAKE: '错题', RETRY: '重练', UNKNOWN: '复习项' }[item.source]
  const stage = ({ NEW: '初学', LEARNING: '巩固中', REVIEW: '待复习', MASTERED: '已掌握' } as Record<string, string>)[item.state]
  return source === '复习' && stage === '待复习' ? source : [source, stage].filter(Boolean).join(' · ')
}
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
  if (!normalized || (normalized === loadedContentCode && contentState.value !== 'error')) return
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
onLoad((options) => initializeContent(options as Record<string, unknown>))
onMounted(() => initializeContent())
onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; void learning.load() })
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="learn" />
    <MobileFeatureGrid />
    <view class="yx-card content-card">
      <text class="b10-flow__title">{{ contentCode ? '课程内容' : '选择课程' }}</text>
      <text v-if="contentState === 'idle'">从首页选择一门课程。</text>
      <text v-else-if="contentState === 'loading'">正在读取课程…</text>
      <template v-else-if="content">
        <text class="content-title">{{ content.title }}</text>
        <text v-if="contentMeta" class="content-meta">{{ contentMeta }}</text>
        <text v-if="content.summary" class="content-summary">{{ content.summary }}</text>
        <view v-for="item in content.items" :key="item.itemId" class="content-item">
          <text class="content-item__text">{{ item.text }}</text>
          <text v-for="option in item.options" :key="option.key" class="content-option">{{ option.key }} · {{ option.text }}</text>
        </view>
        <text v-if="!content.items.length" class="content-summary">暂无可展示的学习单元。</text>
        <text v-if="taskId" class="content-summary" role="status">可浏览课程，完成记录暂不可用。</text>
      </template>
      <template v-else-if="contentState === 'error'">
        <text class="review-error" role="alert">{{ contentError || '课程暂不可用。' }}</text>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="loadContent(contentCode)">重试</button>
      </template>
    </view>
    <view class="yx-card b10-flow">
      <text class="b10-flow__title">练习入口</text>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="open('/pages/b2-practice/b2-practice')">基础练习</button>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-reading/b11-reading')">分级阅读</button>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b3-grammar/b3-grammar')">语法练习</button>
    </view>
    <view class="yx-card review-card">
      <text class="b10-flow__title">{{ reviewCountKnown ? `待复习 ${learning.queue.length} 项` : '复习安排' }}</text>
      <text v-if="learning.queue.length === 0" data-weakness-unknown>{{ weaknessView(0).copy }}</text>
      <text v-else data-weakness-evidence>已有复习证据</text>
      <text v-if="learning.state === 'idle' || learning.state === 'loading'" role="status">正在读取复习安排…</text>
      <text v-else-if="learning.state === 'empty'">暂无待复习内容。</text>
      <text v-if="reviewFailureCopy(learning.lastError)" data-review-illegal>{{ reviewFailureCopy(learning.lastError) }}</text>
      <template v-else-if="reviewNotice">
        <text class="review-error" role="alert">{{ reviewFailureCopy(learning.lastError) || reviewNotice }}</text>
        <button v-if="learning.state !== 'permission' && learning.state !== 'recovery'" tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="learning.load()">重试</button>
      </template>
      <view v-for="item in reviewRows" :key="item.queueItemId" class="review-row">
        <view class="review-row__copy"><text>{{ reviewLabel(item) }}</text></view>
        <button tabindex="0" role="button" class="review-button" type="button" :disabled="!item.completable || learning.busyItemId === item.queueItemId" :aria-disabled="!item.completable || learning.busyItemId === item.queueItemId" @click="completeReview(item)">{{ item.completable ? '开始复习' : '暂不可操作' }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-flow{display:grid;gap:14rpx}.b10-flow__title{font-size:32rpx;font-weight:750}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
.content-card{display:grid;gap:12rpx;margin-bottom:20rpx}.content-title{font-size:30rpx;font-weight:750}.content-meta,.content-summary{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.content-item{display:grid;gap:8rpx;padding-top:14rpx;border-top:1rpx solid var(--yx-border)}.content-item__text{font-size:26rpx;font-weight:650}.content-option{padding:8rpx 12rpx;border-radius:10rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:22rpx}
.review-card{display:grid;gap:14rpx;margin-top:20rpx}.review-row{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding-top:14rpx;border-top:1rpx solid var(--yx-border)}.review-row__copy{min-width:0;overflow-wrap:anywhere}.review-row text{display:block}.review-button{flex:0 0 auto;min-width:110rpx;padding:8rpx 14rpx;border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx}.review-error{color:var(--yx-danger);font-size:22rpx}
</style>
