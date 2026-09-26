<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
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
let loadRequest = 0
type AccountScope = { subject: string; revision: number }
function accountScope(): AccountScope | null {
  return session.isAuthenticated && session.verifiedSubject
    ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function isCurrent(scope: AccountScope | null): scope is AccountScope {
  return Boolean(scope && session.isAuthenticated && session.verifiedSubject === scope.subject && session.identityRevision === scope.revision)
}
function clearPage(): void {
  loadRequest += 1
  article.value = null; questions.value = []; attempts.value = {}; answers.value = {}
  progress.value = 0; positionVersion.value = 0; saved.value = false
  pendingEventId.value = null; mined.value = new Set(); showTranslation.value = false
  status.value = 'idle'; message.value = null
}

function discardReadingState(): void { try { getUniRuntime().removeStorageSync(storageKey) } catch { /* storage unavailable */ } }
function persist(): void { const scope = accountScope(); if (!isCurrent(scope) || !article.value) return; try { getUniRuntime().setStorageSync(storageKey, JSON.stringify({ subject: scope.subject, articleId: article.value.articleId, contentVersionId: article.value.contentVersionId, contentEpoch: article.value.contentEpoch, progress: progress.value, positionVersion: positionVersion.value, saved: saved.value, pendingEventId: pendingEventId.value })) } catch { /* server readback remains authoritative */ } }
function restore(): void {
  const scope = accountScope()
  if (!isCurrent(scope) || !article.value) return
  try { const raw = getUniRuntime().getStorageSync(storageKey); if (typeof raw !== 'string') return; const value = JSON.parse(raw) as Record<string, unknown>; if (value.subject !== scope.subject || value.articleId !== article.value.articleId || value.contentVersionId !== article.value.contentVersionId || value.contentEpoch !== article.value.contentEpoch) { discardReadingState(); return } progress.value = typeof value.progress === 'number' && Number.isFinite(value.progress) ? Math.max(0, Math.min(100, value.progress)) : 0; positionVersion.value = typeof value.positionVersion === 'number' && Number.isSafeInteger(value.positionVersion) && value.positionVersion >= 0 ? value.positionVersion : 0; saved.value = value.saved === true; pendingEventId.value = typeof value.pendingEventId === 'string' ? value.pendingEventId : null } catch { discardReadingState() }
}
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
async function load(): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope)) return
  const requestId = ++loadRequest
  status.value = 'loading'; message.value = null
  try {
    const articles = await b10LearningApi.listReadingArticles(context.value)
    if (!isCurrent(scope) || requestId !== loadRequest) return
    if (!articles.length) { article.value = null; questions.value = []; status.value = 'empty'; return }
    const nextArticle = await b10LearningApi.getReadingArticle(context.value, articles[0].articleId)
    if (!isCurrent(scope) || requestId !== loadRequest) return
    if (article.value?.articleId !== nextArticle.articleId || article.value.contentVersionId !== nextArticle.contentVersionId || article.value.contentEpoch !== nextArticle.contentEpoch) {
      progress.value = 0; positionVersion.value = 0; saved.value = false
      pendingEventId.value = null; attempts.value = {}; answers.value = {}; mined.value = new Set()
    }
    article.value = nextArticle
    if (article.value.rightsStatus === 'REVOKED') { status.value = 'forbidden'; message.value = '当前文章版权状态不允许阅读。'; return }
    const nextQuestions = await b10LearningApi.listReadingQuestions(context.value, article.value.articleId)
    if (!isCurrent(scope) || requestId !== loadRequest) return
    questions.value = nextQuestions
    status.value = article.value.blocks.length ? 'ready' : 'empty'; restore(); persist()
  } catch (error) { if (!isCurrent(scope) || requestId !== loadRequest) return; const info = b10ErrorInfo(error, '阅读服务暂时不可用。'); status.value = info.kind; message.value = info.message; persist() }
}
async function performSave(reusePending: boolean): Promise<void> {
  const scope = accountScope()
  const currentArticle = article.value
  if (!isCurrent(scope) || !currentArticle) return
  if (!reusePending || !pendingEventId.value) {
    positionVersion.value += 1
    pendingEventId.value = createB10ClientEventId(`reading-progress-${currentArticle.articleId}-${positionVersion.value}`)
  }
  const version = positionVersion.value
  const eventId = pendingEventId.value
  const position = progress.value
  saved.value = false; persist()
  try {
    await b10LearningApi.saveReadingProgress(context.value, currentArticle, currentArticle.blocks[Math.max(0, Math.ceil(currentArticle.blocks.length * position / 100) - 1)]?.blockId ?? currentArticle.blocks[0]?.blockId ?? 'root', position, version, eventId)
    if (!isCurrent(scope) || article.value !== currentArticle || positionVersion.value !== version || pendingEventId.value !== eventId) return
    saved.value = true; pendingEventId.value = null; status.value = 'ready'; message.value = '阅读进度已保存。'; persist()
  } catch (error) {
    if (!isCurrent(scope) || article.value !== currentArticle || positionVersion.value !== version || pendingEventId.value !== eventId) return
    const info = b10ErrorInfo(error, '阅读进度保存失败，最后位置已保留。'); status.value = info.kind; message.value = info.message; persist()
  }
}
async function save(): Promise<void> { await performSave(false) }
async function sync(): Promise<void> { if (pendingEventId.value) await performSave(true) }
async function mine(blockId: string, selectedText: string): Promise<void> {
  const scope = accountScope()
  const currentArticle = article.value
  if (!isCurrent(scope) || !currentArticle || mined.value.has(blockId)) return
  try { await b10LearningApi.mineReadingExpression(context.value, currentArticle, blockId, selectedText, createB10ClientEventId(`reading-mine-${currentArticle.articleId}-${blockId}`)); if (!isCurrent(scope) || article.value !== currentArticle) return; mined.value = new Set([...mined.value, blockId]); message.value = b10T('reading.mined') }
  catch (error) { if (!isCurrent(scope) || article.value !== currentArticle) return; const info = b10ErrorInfo(error, '表达挖掘失败，未伪造入库结果。'); status.value = info.kind; message.value = info.message }
}
async function submitQuestion(question: B10ReadingQuestion): Promise<void> {
  const scope = accountScope()
  const currentArticle = article.value
  if (!isCurrent(scope) || !currentArticle) return
  const answer = answers.value[String(question.questionId)]
  if (!answer) return
  try { const result = await b10LearningApi.submitReadingAttempt(context.value, question, { selectedOptionKeys: [answer] }, createB10ClientEventId(`reading-question-${question.questionId}`)); if (!isCurrent(scope) || article.value !== currentArticle || answers.value[String(question.questionId)] !== answer) return; attempts.value[String(question.questionId)] = result; status.value = result.contentVersionStale ? 'stale' : 'ready'; message.value = result.contentVersionStale ? b10T('common.stale') : null }
  catch (error) { if (!isCurrent(scope) || article.value !== currentArticle || answers.value[String(question.questionId)] !== answer) return; const info = b10ErrorInfo(error, '阅读理解提交失败，当前答案仍保留。'); status.value = info.kind; message.value = info.message }
}
function increaseFont(): void { fontScale.value = Math.min(1.35, Number((fontScale.value + 0.1).toFixed(2))) }
function decreaseFont(): void { fontScale.value = Math.max(.85, Number((fontScale.value - 0.1).toFixed(2))) }
watch(() => session.identityRevision, clearPage, { flush: 'sync' })
onMounted(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } void load() })
onUnmounted(() => engine.dispose())
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b3-reading" />

    <B10StatusPanel :status="status" :message="message" :queue-count="queueCount" :performance-level="performanceLevel" @retry="load" @sync="sync" @performance="setPerformance" />
    <view v-if="article" class="yx-card b10-reading-card">
      <view class="b10-reading-card__header"><view><text class="b10-kicker">{{ article.cefrLevel }} · {{ article.wordCount }} words</text><text class="b10-reading-card__title">{{ article.title }}</text></view><text class="b10-reading-card__saved">{{ saved ? '已保存' : '未保存' }}</text></view>
      <view class="b10-reading-card__tools"><button tabindex="0" role="button" class="b10-tool" type="button" @click="decreaseFont">A−</button><text>{{ Math.round(fontScale * 100) }}%</text><button tabindex="0" role="button" class="b10-tool" type="button" @click="increaseFont">A＋</button><button tabindex="0" role="button" class="b10-tool" type="button" @click="showTranslation = !showTranslation">{{ showTranslation ? b10T('reading.hideTranslation') : b10T('reading.translation') }}</button></view>
      <view v-for="block in article.blocks" :key="block.blockId" class="b10-reading-block"><text class="b10-reading-block__text" :style="{ fontSize: `${28 * fontScale}rpx` }">{{ block.text }}</text><text v-if="showTranslation && block.translation" class="b10-reading-block__translation">{{ block.translation }}</text><button tabindex="0" role="button" class="b10-mine" type="button" @click="mine(block.blockId, block.text)">{{ mined.has(block.blockId) ? b10T('reading.mined') : b10T('reading.mining') }}</button></view>
      <view class="b10-reading-progress"><text>{{ Math.round(progress) }}%</text><slider class="b10-reading-progress__slider" :value="progress" min="0" max="100" @change="progress = Number($event.detail.value); saved = false; pendingEventId = null; persist()" /><text v-if="queueCount">待同步 {{ queueCount }}</text></view>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="save">{{ b10T('reading.save') }}</button>
      <view v-if="questions.length" class="b10-reading-questions"><text class="b10-kicker">{{ b10T('reading.question') }}</text><view v-for="question in questions" :key="question.questionId" class="b10-reading-question"><text class="b10-reading-question__stem">{{ question.stemText }}</text><label v-for="option in question.options" :key="option.optionCode" class="b10-reading-question__option"><radio :value="option.optionCode" :checked="answers[String(question.questionId)] === option.optionCode" @click="answers[String(question.questionId)] = option.optionCode" />{{ option.label }}</label><button tabindex="0" role="button" class="b10-mine" type="button" @click="submitQuestion(question)">{{ b10T('reading.submit') }}</button><text v-if="attempts[String(question.questionId)]" class="b10-reading-question__feedback">{{ attempts[String(question.questionId)].correct ? '回答正确' : '需要复习' }}</text></view></view>
    </view>
    <view v-else-if="status === 'loading'" class="yx-card b10-empty"><text>{{ b10T('status.loading') }}</text></view>
    <view v-else-if="status === 'empty'" class="yx-card b10-empty" role="status"><text class="b10-empty__title">{{ b10T('reading.noArticle') }}</text><text>{{ b10T('status.noSample') }}</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
    <view v-else class="yx-card b10-empty" role="alert"><text class="b10-empty__title">{{ b10T(`status.${status}`) }}</text><text>{{ message ?? b10T('status.retry') }}</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
  </view>
</template>

<style scoped lang="scss">
.b10-reading-card{display:grid;gap:18rpx}.b10-reading-card__header{display:flex;justify-content:space-between;gap:16rpx}.b10-kicker{color:var(--yx-brand);font-size:22rpx;font-weight:700}.b10-reading-card__title{display:block;margin-top:8rpx;color:var(--yx-text-primary);font-size:36rpx;font-weight:750}.b10-reading-card__saved{color:var(--yx-success-strong);font-size:22rpx}.b10-reading-card__tools{display:flex;align-items:center;gap:12rpx;color:var(--yx-text-secondary);font-size:22rpx}.b10-tool{min-height:58rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:58rpx}.b10-reading-block{display:grid;gap:10rpx;padding:18rpx 0;border-bottom:1rpx solid var(--yx-border)}.b10-reading-block__text{color:var(--yx-text-primary);line-height:1.8}.b10-reading-block__translation{color:var(--yx-text-secondary);font-size:25rpx;line-height:1.6}.b10-mine{justify-self:start;min-height:54rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:21rpx;line-height:54rpx}.b10-reading-progress{display:flex;align-items:center;gap:12rpx;color:var(--yx-text-secondary);font-size:22rpx}.b10-reading-progress__slider{flex:1}.b10-reading-questions{display:grid;gap:14rpx;padding-top:18rpx;border-top:1rpx solid var(--yx-border)}.b10-reading-question{display:grid;gap:10rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-soft)}.b10-reading-question__stem{font-size:26rpx;font-weight:700}.b10-reading-question__option{display:flex;gap:8rpx;align-items:center;color:var(--yx-text-secondary);font-size:23rpx}.b10-reading-question__feedback{padding:10rpx;border-radius:10rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:22rpx}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:26rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}
</style>
