<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import B10ThemeBar from '../../components/b10/B10ThemeBar.vue'
import type { B10ReadingArticle, B10ReadingAttempt, B10ReadingQuestion } from '../../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../../api/b10'
import { b10ContentLocale, b10ThemeMode, b10T, b10UiLocale } from '../../platform/b10-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
const message = ref<string | null>(null)
const article = ref<B10ReadingArticle | null>(null)
const questions = ref<B10ReadingQuestion[]>([])
const attempts = ref<Record<string, B10ReadingAttempt>>({})
const answers = ref<Record<string, string>>({})
const progress = ref(0)
const positionVersion = ref(0)
const saved = ref(false)
const pendingEventId = ref<string | null>(null)
const mined = ref<Set<string>>(new Set())
const showTranslation = ref(false)
const fontScale = ref(1)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const queueCount = computed(() => pendingEventId.value ? 1 : 0)
const context = computed(() => ({ uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }))
const storageKey = 'yx.b10.mobile.reading.v1'

function persist(): void { getUniRuntime().setStorageSync(storageKey, JSON.stringify({ articleId: article.value?.articleId, progress: progress.value, positionVersion: positionVersion.value, saved: saved.value, pendingEventId: pendingEventId.value })) }
function restore(): void {
  const raw = getUniRuntime().getStorageSync(storageKey)
  if (typeof raw !== 'string') return
  try { const value = JSON.parse(raw) as Record<string, unknown>; progress.value = typeof value.progress === 'number' ? value.progress : 0; positionVersion.value = typeof value.positionVersion === 'number' ? value.positionVersion : 0; saved.value = value.saved === true; pendingEventId.value = typeof value.pendingEventId === 'string' ? value.pendingEventId : null } catch { /* ignore corrupt local progress */ }
}
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
async function load(): Promise<void> {
  status.value = 'loading'; message.value = null
  try {
    const articles = await b10LearningApi.listReadingArticles(context.value)
    if (!articles.length) { article.value = null; questions.value = []; status.value = 'empty'; return }
    article.value = await b10LearningApi.getReadingArticle(context.value, articles[0].articleId)
    if (article.value.rightsStatus === 'REVOKED') { status.value = 'forbidden'; message.value = '当前文章版权状态不允许阅读。'; return }
    questions.value = await b10LearningApi.listReadingQuestions(context.value, article.value.articleId)
    status.value = article.value.blocks.length ? 'ready' : 'empty'; restore(); persist()
  } catch (error) { const info = b10ErrorInfo(error, '阅读服务暂时不可用。'); status.value = info.kind; message.value = info.message; persist() }
}
async function save(): Promise<void> {
  if (!article.value) return
  positionVersion.value += 1; saved.value = false; pendingEventId.value ??= createB10ClientEventId(`reading-progress-${article.value.articleId}`); persist()
  try { await b10LearningApi.saveReadingProgress(context.value, article.value, article.value.blocks[Math.max(0, Math.ceil(article.value.blocks.length * progress.value / 100) - 1)]?.blockId ?? article.value.blocks[0]?.blockId ?? 'root', progress.value, positionVersion.value, pendingEventId.value); saved.value = true; pendingEventId.value = null; status.value = 'ready'; message.value = '阅读进度已保存。'; persist() }
  catch (error) { const info = b10ErrorInfo(error, '阅读进度保存失败，最后位置已保留。'); status.value = info.kind; message.value = info.message; persist() }
}
async function sync(): Promise<void> { if (pendingEventId.value) await save() }
async function mine(blockId: string, selectedText: string): Promise<void> {
  if (!article.value || mined.value.has(blockId)) return
  try { await b10LearningApi.mineReadingExpression(context.value, article.value, blockId, selectedText, createB10ClientEventId(`reading-mine-${article.value.articleId}-${blockId}`)); mined.value = new Set([...mined.value, blockId]); message.value = b10T('reading.mined') }
  catch (error) { const info = b10ErrorInfo(error, '表达挖掘失败，未伪造入库结果。'); status.value = info.kind; message.value = info.message }
}
async function submitQuestion(question: B10ReadingQuestion): Promise<void> {
  const answer = answers.value[String(question.questionId)]
  if (!answer) return
  try { const result = await b10LearningApi.submitReadingAttempt(context.value, question, { selectedOptionKeys: [answer] }, createB10ClientEventId(`reading-question-${question.questionId}`)); attempts.value[String(question.questionId)] = result; status.value = result.contentVersionStale ? 'stale' : 'ready'; message.value = result.contentVersionStale ? b10T('common.stale') : null }
  catch (error) { const info = b10ErrorInfo(error, '阅读理解提交失败，当前答案仍保留。'); status.value = info.kind; message.value = info.message }
}
function increaseFont(): void { fontScale.value = Math.min(1.35, Number((fontScale.value + 0.1).toFixed(2))) }
function decreaseFont(): void { fontScale.value = Math.max(.85, Number((fontScale.value - 0.1).toFixed(2))) }
onMounted(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } restore(); void load() })
onUnmounted(() => engine.dispose())
</script>

<template>
  <view class="yx-page" :class="themeClass">
    <text class="yx-eyebrow">{{ b10T('reading.eyebrow') }}</text>
    <text class="yx-title">{{ b10T('reading.title') }}</text>
    <text class="yx-description">{{ b10T('reading.description') }}</text>
    <B10ThemeBar />
    <B10StatusPanel :status="status" :message="message" :queue-count="queueCount" :performance-level="performanceLevel" @retry="load" @sync="sync" @performance="setPerformance" />
    <view v-if="article" class="yx-card b10-reading-card">
      <view class="b10-reading-card__header"><view><text class="b10-kicker">{{ article.cefrLevel }} · {{ article.wordCount }} words</text><text class="b10-reading-card__title">{{ article.title }}</text></view><text class="b10-reading-card__saved">{{ saved ? '已保存' : '未保存' }}</text></view>
      <view class="b10-reading-card__tools"><button class="b10-tool" type="button" @click="decreaseFont">A−</button><text>{{ Math.round(fontScale * 100) }}%</text><button class="b10-tool" type="button" @click="increaseFont">A＋</button><button class="b10-tool" type="button" @click="showTranslation = !showTranslation">{{ showTranslation ? b10T('reading.hideTranslation') : b10T('reading.translation') }}</button></view>
      <view v-for="block in article.blocks" :key="block.blockId" class="b10-reading-block"><text class="b10-reading-block__text" :style="{ fontSize: `${28 * fontScale}rpx` }">{{ block.text }}</text><text v-if="showTranslation && block.translation" class="b10-reading-block__translation">{{ block.translation }}</text><button class="b10-mine" type="button" @click="mine(block.blockId, block.text)">{{ mined.has(block.blockId) ? b10T('reading.mined') : b10T('reading.mining') }}</button></view>
      <view class="b10-reading-progress"><text>{{ Math.round(progress) }}%</text><slider class="b10-reading-progress__slider" :value="progress" min="0" max="100" @change="progress = Number($event.detail.value); saved = false; persist()" /><text v-if="queueCount">{{ queueCount }} · pending</text></view>
      <button class="yx-button" type="button" @click="save">{{ b10T('reading.save') }}</button>
      <view v-if="questions.length" class="b10-reading-questions"><text class="b10-kicker">{{ b10T('reading.question') }}</text><view v-for="question in questions" :key="question.questionId" class="b10-reading-question"><text class="b10-reading-question__stem">{{ question.stemText }}</text><label v-for="option in question.options" :key="option.optionCode" class="b10-reading-question__option"><radio :value="option.optionCode" :checked="answers[String(question.questionId)] === option.optionCode" @click="answers[String(question.questionId)] = option.optionCode" />{{ option.label }}</label><button class="b10-mine" type="button" @click="submitQuestion(question)">{{ b10T('reading.submit') }}</button><text v-if="attempts[String(question.questionId)]" class="b10-reading-question__feedback">{{ attempts[String(question.questionId)].correct ? '回答正确' : '需要复习' }} · {{ attempts[String(question.questionId)].feedbackCode ?? 'server-rule' }}</text></view></view>
    </view>
    <view v-else-if="status === 'loading'" class="yx-card b10-empty"><text>{{ b10T('status.loading') }}</text></view>
    <view v-else-if="status === 'empty'" class="yx-card b10-empty" role="status"><text class="b10-empty__title">{{ b10T('reading.noArticle') }}</text><text>{{ b10T('status.noSample') }}</text><button class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
    <view v-else class="yx-card b10-empty" role="alert"><text class="b10-empty__title">{{ b10T(`status.${status}`) }}</text><text>{{ message ?? b10T('status.retry') }}</text><button class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
  </view>
</template>

<style scoped lang="scss">
.b10-reading-card{display:grid;gap:18rpx}.b10-reading-card__header{display:flex;justify-content:space-between;gap:16rpx}.b10-kicker{color:var(--yx-brand);font-size:22rpx;font-weight:700}.b10-reading-card__title{display:block;margin-top:8rpx;color:var(--yx-text-primary);font-size:36rpx;font-weight:750}.b10-reading-card__saved{color:var(--yx-success-strong);font-size:22rpx}.b10-reading-card__tools{display:flex;align-items:center;gap:12rpx;color:var(--yx-text-secondary);font-size:22rpx}.b10-tool{min-height:58rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:58rpx}.b10-reading-block{display:grid;gap:10rpx;padding:18rpx 0;border-bottom:1rpx solid var(--yx-border)}.b10-reading-block__text{color:var(--yx-text-primary);line-height:1.8}.b10-reading-block__translation{color:var(--yx-text-secondary);font-size:25rpx;line-height:1.6}.b10-mine{justify-self:start;min-height:54rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:21rpx;line-height:54rpx}.b10-reading-progress{display:flex;align-items:center;gap:12rpx;color:var(--yx-text-secondary);font-size:22rpx}.b10-reading-progress__slider{flex:1}.b10-reading-questions{display:grid;gap:14rpx;padding-top:18rpx;border-top:1rpx solid var(--yx-border)}.b10-reading-question{display:grid;gap:10rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-soft)}.b10-reading-question__stem{font-size:26rpx;font-weight:700}.b10-reading-question__option{display:flex;gap:8rpx;align-items:center;color:var(--yx-text-secondary);font-size:23rpx}.b10-reading-question__feedback{padding:10rpx;border-radius:10rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:22rpx}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:26rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}
</style>
