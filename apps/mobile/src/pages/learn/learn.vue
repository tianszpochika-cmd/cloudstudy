<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
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
import { reviewEmpty } from '../../domain/review-history'
import { STAGE_PROJECTION } from '../../domain/stage-projection'

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
const stageText = { NEW: '初学', LEARNING: '巩固中', REVIEW: '待复习', MASTERED: '已掌握' } as Record<string, string>
function stageLabel(state: string): string {
  return stageText[state] ?? '复习中'
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
    <view class="v2-learn-body">
      <MobileFeatureGrid />
      <view class="yx-card content-card card v2-learn-card v2-learn-content">
        <view class="eyebrow v2-learn-eyebrow"><AppIcon name="book" /><text>课程</text></view>
        <text class="b10-flow__title v2-learn-title v2-learn-h2">{{ contentCode ? '课程内容' : '选择课程' }}</text>
        <text v-if="contentState === 'idle'" class="d v2-learn-desc v2-learn-fb">从首页选择一门课程。</text>
        <text v-else-if="contentState === 'loading'" class="d v2-learn-desc v2-learn-fb">正在读取课程…</text>
        <template v-else-if="content">
          <text class="content-title v2-learn-title v2-learn-stem">{{ content.title }}</text>
          <text v-if="contentMeta" class="content-meta d v2-learn-desc">{{ contentMeta }}</text>
          <text v-if="content.summary" class="content-summary d v2-learn-desc">{{ content.summary }}</text>
          <view v-for="item in content.items" :key="item.itemId" class="content-item v2-learn-row v2-learn-item">
            <view class="v2-learn-row__head"><AppIcon name="book" /><text class="content-item__text v2-learn-stem">{{ item.text }}</text></view>
            <text v-for="option in item.options" :key="option.key" class="content-option d v2-learn-desc v2-learn-option">{{ option.key }} · {{ option.text }}</text>
          </view>
          <text v-if="!content.items.length" class="content-summary d v2-learn-desc v2-learn-fb">暂无可展示的学习单元。</text>
          <text v-if="taskId" class="content-summary d v2-learn-desc v2-learn-fb" role="status">可浏览课程，完成记录暂不可用。</text>
        </template>
        <template v-else-if="contentState === 'error'">
          <text class="review-error d v2-learn-desc v2-learn-fb" role="alert">{{ contentError || '课程暂不可用。' }}</text>
          <button tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-learn-btn v2-learn-opt" type="button" @click="loadContent(contentCode)">重试<AppIcon name="refresh" /></button>
        </template>
      </view>
      <view class="yx-card b10-flow card v2-learn-card v2-learn-practice">
        <view class="eyebrow v2-learn-eyebrow"><AppIcon name="target" /><text>练习</text></view>
        <text class="b10-flow__title v2-learn-title v2-learn-h2">练习入口</text>
        <view class="v2-learn-list">
          <view class="v2-learn-row v2-learn-entry"><button tabindex="0" role="button" class="yx-button btn opt v2-learn-btn v2-learn-opt v2-learn-submit" type="button" @click="open('/pages/b2-practice/b2-practice')">基础练习<AppIcon name="chev" /></button></view>
          <view class="v2-learn-row v2-learn-entry"><button tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-learn-btn v2-learn-opt" type="button" @click="open('/pages/b11-reading/b11-reading')">分级阅读<AppIcon name="chev" /></button></view>
          <view class="v2-learn-row v2-learn-entry"><button tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-learn-btn v2-learn-opt" type="button" @click="open('/pages/b3-grammar/b3-grammar')">语法练习<AppIcon name="chev" /></button></view>
        </view>
      </view>
      <view class="yx-card review-card card v2-learn-card v2-learn-review">
        <view class="eyebrow v2-learn-eyebrow"><AppIcon name="clock" /><text>复习</text></view>
        <text class="b10-flow__title v2-learn-title v2-learn-h2">{{ reviewCountKnown ? `待复习 ${learning.queue.length} 项` : '复习安排' }}</text>
        <text v-if="learning.queue.length === 0" class="d v2-learn-desc" data-weakness-unknown>{{ weaknessView(0).copy }}</text>
        <text v-else class="d v2-learn-desc" data-weakness-evidence>已有复习证据</text>
        <text v-if="learning.state === 'idle' || learning.state === 'loading'" class="d v2-learn-desc v2-learn-fb" role="status">正在读取复习安排…</text>
        <text v-else-if="learning.state === 'empty'" class="d v2-learn-desc v2-learn-fb">暂无待复习内容。</text>
        <text class="d v2-learn-desc v2-learn-fb v2-learn-internal" data-stage-projection>{{ learning.projectionVersion || STAGE_PROJECTION }}</text>
        <text v-if="learning.queue[0]" class="d v2-learn-desc" data-stage>{{ stageLabel(learning.queue[0].state) }}</text>
        <text v-if="learning.queue.length === 0 && learning.state !== 'loading'" class="d v2-learn-desc v2-learn-fb" data-review-empty>{{ learning.emptyCopy || reviewEmpty(learning.state === 'error' || learning.state === 'offline', true, false).copy }}</text>
        <text v-for="row in learning.history" :key="`${row.disposition}-${row.itemId}`" class="d v2-learn-desc v2-learn-row" data-review-history>{{ row.disposition === 'DEFERRED' ? '延期' : '已完成' }}</text>
        <text v-if="reviewFailureCopy(learning.lastError)" class="d v2-learn-desc v2-learn-fb" data-review-illegal>{{ reviewFailureCopy(learning.lastError) }}</text>
        <template v-else-if="reviewNotice">
          <text class="review-error d v2-learn-desc v2-learn-fb" role="alert">{{ reviewFailureCopy(learning.lastError) || reviewNotice }}</text>
          <button v-if="learning.state !== 'permission' && learning.state !== 'recovery'" tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-learn-btn v2-learn-opt" type="button" @click="learning.load()">重试<AppIcon name="refresh" /></button>
        </template>
        <view v-for="item in reviewRows" :key="item.queueItemId" class="review-row v2-learn-row v2-learn-item">
          <view class="review-row__copy v2-learn-row__copy"><AppIcon name="clock" /><text class="v2-learn-stem">{{ reviewLabel(item) }}</text></view>
          <button tabindex="0" role="button" class="review-button btn opt v2-learn-btn v2-learn-opt" type="button" :disabled="!item.completable || learning.busyItemId === item.queueItemId" :aria-disabled="!item.completable || learning.busyItemId === item.queueItemId" @click="completeReview(item)">{{ item.completable ? '开始复习' : '暂不可操作' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-flow{display:grid;gap:14rpx}.b10-flow__title{font-size:32rpx;font-weight:750}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
.content-card{display:grid;gap:12rpx;margin-bottom:20rpx}.content-title{font-size:30rpx;font-weight:750}.content-meta,.content-summary{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.content-item{display:grid;gap:8rpx;padding-top:14rpx;border-top:1rpx solid var(--yx-border)}.content-item__text{font-size:26rpx;font-weight:650}.content-option{padding:8rpx 12rpx;border-radius:10rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:22rpx}
.review-card{display:grid;gap:14rpx;margin-top:20rpx}.review-row{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding-top:14rpx;border-top:1rpx solid var(--yx-border)}.review-row__copy{min-width:0;overflow-wrap:anywhere}.review-row text{display:block}.review-button{flex:0 0 auto;min-width:110rpx;padding:8rpx 14rpx;border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx}.review-error{color:var(--yx-danger);font-size:22rpx}
/* v2 学习页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.btn/.fb/.list-row，对齐 practice.vue today.vue v2-* 同样数值，仅用 var(--v2-*)。 */
.v2-learn-body{box-sizing:border-box;display:flex;flex-direction:column;gap:var(--v2-space-4);min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-learn-card{box-sizing:border-box;display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-learn-card:hover{border-color:var(--v2-brand)}
.v2-learn-content,.v2-learn-practice,.v2-learn-review{box-sizing:border-box;min-width:0;max-width:100%}
.v2-learn-eyebrow{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-learn-title{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-learn-h2{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-learn-desc{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-learn-stem{box-sizing:border-box;display:block;flex:1 1 auto;min-width:0;max-width:100%;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-learn-fb{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-learn-list{box-sizing:border-box;display:grid;gap:var(--v2-space-4);min-width:0;max-width:100%}
.v2-learn-row{box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-learn-row:hover{border-color:var(--v2-brand)}
.v2-learn-item{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-learn-entry{box-sizing:border-box;display:grid;min-width:0;max-width:100%}
.v2-learn-row__head{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);flex:1 1 100%;min-width:0;max-width:100%;color:var(--v2-ink);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-learn-row__copy{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);flex:1 1 0;min-width:0;max-width:100%;color:var(--v2-ink);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-learn-option{box-sizing:border-box;display:block;flex:1 1 100%;min-width:0;max-width:100%;padding:var(--v2-space-2) var(--v2-space-3);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-learn-btn,.v2-learn-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-learn-row .v2-learn-btn,.v2-learn-row .v2-learn-opt,.v2-learn-item .v2-learn-btn,.v2-learn-item .v2-learn-opt{width:auto;flex:0 0 auto}
.v2-learn-opt:hover{border-color:var(--v2-brand)}
.v2-learn-opt:active{transform:scale(.97)}
.v2-learn-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-learn-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-learn-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-learn-submit:hover{border-color:var(--v2-brand)}
.v2-learn-internal{display:none !important;}
</style>
