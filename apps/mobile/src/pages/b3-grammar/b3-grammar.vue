<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10ExerciseCard from '../../components/b10/B10ExerciseCard.vue'
import B10FeedbackCard from '../../components/b10/B10FeedbackCard.vue'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import type { B10AnswerInput, B10AssessmentSession, B10GrammarPoint, B10RuleFeedback, B10SyntaxGraph, B10WritingPrompt } from '../../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../../api/b10'
import { packNotice } from '../../domain/grammar-reading-pack'
import { b10ContentLocale, b10ThemeMode, b10T, b10UiLocale } from '../../platform/b10-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
const message = ref<string | null>(null)
const points = ref<B10GrammarPoint[]>([])
const activePoint = ref<B10GrammarPoint | null>(null)
const graph = ref<B10SyntaxGraph | null>(null)
const grammarSession = ref<B10AssessmentSession | null>(null)
const blockOrder = ref<string[]>([])
const slotValues = ref<Record<string, string>>({})
const feedback = ref<B10RuleFeedback | null>(null)
const correctionPrompt = ref<B10WritingPrompt | null>(null)
const correctionAnswer = ref('')
let grammarSelectionRequest = 0
interface MobileGrammarDraft {
  selectedPointId: number | null
  blockOrders: Record<string, string[]>
  slotValues: Record<string, Record<string, string>>
  contentVersions: Record<string, number | null>
}
const GRAMMAR_DRAFT_KEY = 'yx.b10.mobile.grammar-draft.v1'
const grammarDraft = ref<MobileGrammarDraft>(emptyGrammarDraft())
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const exercise = computed(() => grammarSession.value?.exercises.find((item) => item.position === 0) ?? grammarSession.value?.exercises[0] ?? null)
const grammarPackNotice = computed(() => packNotice('GRAMMAR', grammarSession.value?.exercises.length ?? 0, message.value))
const linearMode = computed(() => performanceLevel.value === 'Performance' || graph.value?.graphStatus === 'DEGRADED')
const context = computed(() => ({ uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }))
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function emptyGrammarDraft(): MobileGrammarDraft { return { selectedPointId: null, blockOrders: {}, slotValues: {}, contentVersions: {} } }
type AccountScope = { subject: string; revision: number }
function accountScope(): AccountScope | null {
  return session.isAuthenticated && session.verifiedSubject
    ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function isCurrent(scope: AccountScope | null): scope is AccountScope {
  return Boolean(scope && session.isAuthenticated && session.verifiedSubject === scope.subject && session.identityRevision === scope.revision)
}
function clearPage(): void {
  grammarSelectionRequest += 1
  points.value = []; activePoint.value = null; graph.value = null; grammarSession.value = null
  blockOrder.value = []; slotValues.value = {}; feedback.value = null
  correctionPrompt.value = null; correctionAnswer.value = ''; grammarDraft.value = emptyGrammarDraft()
  status.value = 'idle'; message.value = null
}
function readGrammarDraft(): MobileGrammarDraft {
  const draft = emptyGrammarDraft()
  const scope = accountScope()
  if (!isCurrent(scope)) return draft
  try {
    const raw = getUniRuntime().getStorageSync(GRAMMAR_DRAFT_KEY)
    if (typeof raw !== 'string') return draft
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return draft
    if (parsed.subject !== scope.subject) { getUniRuntime().removeStorageSync(GRAMMAR_DRAFT_KEY); return draft }
    draft.selectedPointId = typeof parsed.selectedPointId === 'number' && Number.isInteger(parsed.selectedPointId) ? parsed.selectedPointId : null
    if (isRecord(parsed.blockOrders)) for (const [key, value] of Object.entries(parsed.blockOrders)) if (Array.isArray(value) && value.every((item): item is string => typeof item === 'string')) draft.blockOrders[key] = [...value]
    if (isRecord(parsed.slotValues)) for (const [sentenceId, value] of Object.entries(parsed.slotValues)) if (isRecord(value)) draft.slotValues[sentenceId] = Object.fromEntries(Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [[key, item]] : []))
    if (isRecord(parsed.contentVersions)) for (const [sentenceId, value] of Object.entries(parsed.contentVersions)) if (value === null || (typeof value === 'number' && Number.isSafeInteger(value))) draft.contentVersions[sentenceId] = value as number | null
  } catch { try { getUniRuntime().removeStorageSync(GRAMMAR_DRAFT_KEY) } catch { /* ignore */ } }
  return draft
}
function persistGrammarDraft(): void { const scope = accountScope(); if (!isCurrent(scope)) return; try { getUniRuntime().setStorageSync(GRAMMAR_DRAFT_KEY, JSON.stringify({ subject: scope.subject, ...grammarDraft.value })) } catch { /* best effort local recovery */ } }
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function moveBlock(index: number, offset: number): void { const target = index + offset; if (target < 0 || target >= blockOrder.value.length) return; const next = [...blockOrder.value]; [next[index], next[target]] = [next[target], next[index]]; blockOrder.value = next }
async function loadPoint(point: B10GrammarPoint): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope)) return
  const requestId = ++grammarSelectionRequest
  activePoint.value = point; grammarDraft.value.selectedPointId = point.grammarPointId; persistGrammarDraft(); graph.value = null; grammarSession.value = null; feedback.value = null; blockOrder.value = []; slotValues.value = {}; status.value = 'loading'; message.value = null
  try {
    if (point.sentenceId) {
      const nextGraph = await b10LearningApi.getSentenceGraph(context.value, point.sentenceId)
      if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
      graph.value = nextGraph
      const versionMatches = Object.hasOwn(grammarDraft.value.contentVersions, String(nextGraph.sentenceId))
        && grammarDraft.value.contentVersions[String(nextGraph.sentenceId)] === nextGraph.contentVersionId
      const savedOrder = versionMatches ? grammarDraft.value.blockOrders[String(nextGraph.sentenceId)] : undefined
      const savedSlots = versionMatches ? grammarDraft.value.slotValues[String(nextGraph.sentenceId)] : undefined
      const allowedBlockIds = new Set(nextGraph.blockOrder)
      blockOrder.value = savedOrder?.length === nextGraph.blockOrder.length && savedOrder.every((item) => allowedBlockIds.has(item)) ? [...savedOrder] : [...nextGraph.blockOrder]
      slotValues.value = { ...nextGraph.imitationSlots }
      if (savedSlots) for (const [key, value] of Object.entries(savedSlots)) if (key in slotValues.value) slotValues.value[key] = value
    } else message.value = '当前知识点还没有发布可解析的长难句。'
    const nextSession = await b10LearningApi.createGrammarSession(context.value, point.grammarPointId, point.contentVersionId, createB10ClientEventId(`grammar-session-${point.grammarPointId}`))
    if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
    grammarSession.value = nextSession
    status.value = graph.value || grammarSession.value.exercises.length ? 'ready' : 'empty'
  } catch (error) { if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return; const info = b10ErrorInfo(error, '语法服务暂时不可用。'); status.value = info.kind; message.value = info.message }
}
async function load(): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope)) return
  const requestId = ++grammarSelectionRequest
  status.value = 'loading'; message.value = null
  try {
    const nextPoints = await b10LearningApi.listGrammarPoints(context.value)
    if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
    const nextCorrectionPrompt = (await b10LearningApi.listWritingPrompts(context.value, 'CORRECTION'))[0] ?? null
    if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
    points.value = nextPoints
    correctionPrompt.value = nextCorrectionPrompt
    if (!points.value.length) {
      const loose = await b10LearningApi.createGrammarSession(context.value, 0, null, createB10ClientEventId('grammar-unbound'))
      if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
      grammarSession.value = loose
      status.value = loose.exercises.length ? 'ready' : 'empty'
      return
    }
    await loadPoint(points.value.find((point) => point.grammarPointId === grammarDraft.value.selectedPointId) ?? points.value[0])
  } catch (error) { if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return; const info = b10ErrorInfo(error, '语法知识树暂时不可用。'); status.value = info.kind; message.value = info.message }
}
async function submitBlocks(): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope) || !grammarSession.value || !exercise.value || !graph.value || !blockOrder.value.length) return
  const requestId = grammarSelectionRequest
  try { const result = await b10LearningApi.submitGrammarAnswer(context.value, grammarSession.value.sessionId, exercise.value.exerciseId, { orderedTokenIds: [...blockOrder.value] }, graph.value.contentVersionId, createB10ClientEventId(`grammar-blocks-${graph.value.sentenceId}`)); if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready' }
  catch (error) { if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; const info = b10ErrorInfo(error, '句子积木提交失败，当前顺序已保留。'); status.value = info.kind; message.value = info.message }
}
async function submitImitation(): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope) || !grammarSession.value || !exercise.value || !graph.value) return
  const requestId = grammarSelectionRequest
  try { const result = await b10LearningApi.submitGrammarAnswer(context.value, grammarSession.value.sessionId, exercise.value.exerciseId, { text: JSON.stringify(slotValues.value) }, graph.value.contentVersionId, createB10ClientEventId(`grammar-imitation-${graph.value.sentenceId}`)); if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready' }
  catch (error) { if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; const info = b10ErrorInfo(error, '仿写提交失败，草稿仍保留。'); status.value = info.kind; message.value = info.message }
}
async function submitExerciseAnswer(answer: B10AnswerInput): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope) || !grammarSession.value || !exercise.value) return
  const requestId = grammarSelectionRequest
  try { const result = await b10LearningApi.submitGrammarAnswer(context.value, grammarSession.value.sessionId, exercise.value.exerciseId, answer, activePoint.value?.contentVersionId ?? null, createB10ClientEventId(`grammar-exercise-${exercise.value.exerciseId}`)); if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready' }
  catch (error) { if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; const info = b10ErrorInfo(error, '语法练习提交失败，答案仍保留。'); status.value = info.kind; message.value = info.message }
}
async function submitCorrection(): Promise<void> {
  const scope = accountScope()
  if (!isCurrent(scope) || !correctionPrompt.value || !correctionAnswer.value.trim()) return
  const requestId = grammarSelectionRequest
  try { const result = await b10LearningApi.submitCorrection(context.value, correctionPrompt.value, correctionAnswer.value, createB10ClientEventId(`correction-${correctionPrompt.value.promptId}`)); if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready' }
  catch (error) { if (!isCurrent(scope) || requestId !== grammarSelectionRequest) return; const info = b10ErrorInfo(error, '病句改错提交失败，答案仍保留。'); status.value = info.kind; message.value = info.message }
}
watch(() => session.identityRevision, clearPage, { flush: 'sync' })
onMounted(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } grammarDraft.value = readGrammarDraft(); void load() })
onUnmounted(() => engine.dispose())
watch(blockOrder, (value) => { if (graph.value) { grammarDraft.value.blockOrders[String(graph.value.sentenceId)] = [...value]; grammarDraft.value.contentVersions[String(graph.value.sentenceId)] = graph.value.contentVersionId; persistGrammarDraft() } }, { deep: true })
watch(slotValues, (value) => { if (graph.value) { grammarDraft.value.slotValues[String(graph.value.sentenceId)] = { ...value }; grammarDraft.value.contentVersions[String(graph.value.sentenceId)] = graph.value.contentVersionId; persistGrammarDraft() } }, { deep: true })
</script>

<template>
  <view class="yx-page v2-grammar-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b3-grammar" />

    <view class="v2-grammar-body">
    <B10StatusPanel class="v2-grammar-status" :status="status" :message="message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />

    <view v-if="points.length" class="yx-card b10-grammar-tree v2-grammar-card card"><view class="v2-grammar-eyebrow eyebrow"><AppIcon name="book" :size="14" /><text class="b10-section-title v2-grammar-title v2-grammar-h2">{{ b10T('grammar.tree') }}</text></view><scroll-view scroll-x class="b10-point-list v2-grammar-list"><button tabindex="0" role="button" v-for="point in points" :key="point.grammarPointId" class="b10-point v2-grammar-opt opt" :class="{ 'b10-point--active': activePoint?.grammarPointId === point.grammarPointId }" type="button" @click="loadPoint(point)">{{ point.code }} · {{ point.title }}</button></scroll-view><view v-if="activePoint" class="b10-rule v2-grammar-rule"><text class="b10-kicker v2-grammar-kicker eyebrow">{{ activePoint.cefrLevel }} · {{ activePoint.code }}</text><text class="b10-rule__title v2-grammar-title v2-grammar-h2">{{ activePoint.title }}</text><text class="b10-rule__copy v2-grammar-d d">{{ activePoint.meaningCn }}</text><text class="b10-rule__formula v2-grammar-fb fb">{{ activePoint.ruleFormula }}</text><text v-if="activePoint.prerequisites.length" class="b10-rule__meta v2-grammar-d d">前置知识点：{{ activePoint.prerequisites.join('、') }}</text><text v-if="activePoint.masteryPercent !== null" class="b10-rule__meta v2-grammar-d d">掌握投影：{{ activePoint.masteryPercent }}%</text></view></view>

    <view v-if="graph" class="yx-card b10-graph-card v2-grammar-card card"><view class="b10-graph-card__header v2-grammar-head"><view class="v2-grammar-titles"><view class="v2-grammar-eyebrow eyebrow"><AppIcon name="type" :size="14" /><text class="b10-kicker v2-grammar-kicker">{{ b10T('grammar.sentence') }} · {{ graph.sentenceId }}</text></view><text class="b10-graph-card__sentence v2-grammar-title v2-grammar-h2">{{ graph.text }}</text></view><text class="b10-graph-card__mode v2-grammar-meta meta">{{ linearMode ? '2D / Linear' : performanceLevel }}</text></view><text v-if="graph.translation" class="b10-graph-card__translation v2-grammar-d d">{{ graph.translation }}</text><text v-if="graph.graphStatus === 'DEGRADED' || performanceLevel === 'Performance'" class="b10-graph-card__notice v2-grammar-fb fb">{{ b10T('grammar.degraded') }}</text><view class="b10-node-list v2-grammar-list"><view v-for="node in graph.nodes" :key="node.nodeId" class="b10-node v2-grammar-row"><text class="b10-node__role v2-grammar-kicker eyebrow">{{ node.role }}</text><text class="v2-grammar-d d">{{ node.text }}</text></view></view><view v-if="!linearMode && graph.edges.length" class="b10-edge-list v2-grammar-fb fb"><text class="v2-grammar-d d">依存关系 {{ graph.edges.length }} 条</text><text v-for="edge in graph.edges" :key="`${edge.fromNodeId}-${edge.toNodeId}`" class="v2-grammar-d d">{{ edge.fromNodeId }} → {{ edge.toNodeId }} · {{ edge.relation }}</text></view><view v-if="linearMode" class="b10-linear-list v2-grammar-fb fb"><text v-for="slice in graph.slices" :key="slice.sliceId" class="v2-grammar-d d">{{ slice.role }}：{{ slice.text }}</text></view>
      <view v-if="blockOrder.length" class="b10-practice-section v2-grammar-section"><view class="v2-grammar-eyebrow eyebrow"><AppIcon name="list" :size="14" /><text class="b10-section-title v2-grammar-title v2-grammar-h2">{{ b10T('grammar.order') }}</text></view><view v-for="(blockId, index) in blockOrder" :key="blockId" class="b10-block-row v2-grammar-row"><text class="v2-grammar-d d">{{ index + 1 }}. {{ graph.slices.find((slice) => slice.sliceId === blockId)?.text ?? blockId }}</text><view class="v2-grammar-actions row"><button tabindex="0" role="button" class="b10-move v2-grammar-btn btn" type="button" :disabled="index === 0" aria-label="上移" @click="moveBlock(index, -1)">↑</button><button tabindex="0" role="button" class="b10-move v2-grammar-btn btn" type="button" :disabled="index === blockOrder.length - 1" aria-label="下移" @click="moveBlock(index, 1)">↓</button></view></view><button tabindex="0" role="button" class="yx-button v2-grammar-btn v2-grammar-submit btn" type="button" @click="submitBlocks">{{ b10T('grammar.submit') }}<AppIcon name="check" :size="14" /></button></view>
      <view v-if="Object.keys(graph.imitationSlots).length" class="b10-practice-section v2-grammar-section"><view class="v2-grammar-eyebrow eyebrow"><AppIcon name="activity" :size="14" /><text class="b10-section-title v2-grammar-title v2-grammar-h2">{{ b10T('grammar.imitate') }}</text></view><view v-for="(value, key) in graph.imitationSlots" :key="key" class="b10-slot v2-grammar-row"><text class="v2-grammar-d d">{{ key }}</text><input v-model="slotValues[key]" class="b10-input v2-grammar-input" :placeholder="value" /></view><button tabindex="0" role="button" class="yx-button v2-grammar-btn v2-grammar-submit btn" type="button" @click="submitImitation">{{ b10T('grammar.submit') }}<AppIcon name="check" :size="14" /></button></view>
    </view>
    <text v-if="grammarPackNotice" class="b10-pack-notice v2-grammar-d d" data-pack-notice>{{ grammarPackNotice }}</text>
    <B10ExerciseCard v-if="exercise" class="v2-grammar-card" :exercise="exercise" @answer="submitExerciseAnswer" />
    <B10FeedbackCard class="v2-grammar-fb" :feedback="feedback" />

    <view v-if="correctionPrompt" class="yx-card b10-correction v2-grammar-card card"><view class="v2-grammar-eyebrow eyebrow"><AppIcon name="flag" :size="14" /><text class="b10-section-title v2-grammar-title v2-grammar-h2">{{ b10T('grammar.correction') }}</text></view><text class="b10-kicker v2-grammar-kicker eyebrow">{{ correctionPrompt.title }}</text><text class="v2-grammar-d d">{{ correctionPrompt.taskText }}</text><textarea v-model="correctionAnswer" class="b10-textarea v2-grammar-input" maxlength="12000" placeholder="指出错误并给出规则依据。" /><button tabindex="0" role="button" class="yx-button v2-grammar-btn v2-grammar-submit btn" type="button" @click="submitCorrection">{{ b10T('grammar.submit') }}<AppIcon name="check" :size="14" /></button></view>
    <view v-if="status === 'empty'" class="yx-card b10-empty v2-grammar-card card"><view class="v2-grammar-eyebrow eyebrow"><AppIcon name="inbox" :size="14" /><text class="v2-grammar-title v2-grammar-h2">{{ b10T('grammar.noGraph') }}</text></view><button tabindex="0" role="button" class="yx-button v2-grammar-btn btn" type="button" @click="load">{{ b10T('status.retry') }}<AppIcon name="refresh" :size="14" /></button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-grammar-tree,.b10-graph-card,.b10-correction{display:grid;gap:16rpx}.b10-section-title{color:var(--yx-text-primary);font-size:29rpx;font-weight:750}.b10-point-list{display:flex;white-space:nowrap}.b10-point{display:inline-block;min-height:64rpx;margin-right:10rpx;padding:0 16rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.b10-point--active{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.b10-rule{display:grid;gap:10rpx;padding-top:16rpx;border-top:1rpx solid var(--yx-border)}.b10-kicker{color:var(--yx-brand);font-size:22rpx;font-weight:700}.b10-rule__title{font-size:34rpx;font-weight:750}.b10-rule__copy,.b10-rule__meta{color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.b10-rule__formula{padding:16rpx;border-radius:12rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:26rpx}.b10-graph-card__header{display:flex;justify-content:space-between;gap:16rpx}.b10-graph-card__sentence{display:block;margin-top:8rpx;font-size:32rpx;line-height:1.55}.b10-graph-card__mode,.b10-graph-card__translation{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.6}.b10-graph-card__notice{padding:12rpx;border-radius:10rpx;color:var(--yx-warning-strong);background:var(--yx-warning-soft);font-size:22rpx}.b10-node-list,.b10-edge-list,.b10-linear-list{display:grid;gap:10rpx}.b10-node{display:grid;gap:4rpx;padding:14rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;background:var(--yx-surface-card);font-size:24rpx}.b10-node__role{color:var(--yx-brand);font-size:20rpx;font-weight:700}.b10-edge-list,.b10-linear-list{padding:14rpx;border-radius:12rpx;background:var(--yx-surface-soft);color:var(--yx-text-secondary);font-size:22rpx;line-height:1.6}.b10-practice-section{display:grid;gap:12rpx;padding-top:18rpx;border-top:1rpx solid var(--yx-border)}.b10-block-row{display:flex;align-items:center;justify-content:space-between;gap:10rpx;padding:14rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);font-size:24rpx}.b10-move{min-width:62rpx;min-height:58rpx;margin-left:8rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:26rpx}.b10-slot{display:grid;grid-template-columns:140rpx 1fr;gap:10rpx;align-items:center;color:var(--yx-brand);font-size:22rpx}.b10-input,.b10-textarea{width:100%;box-sizing:border-box;padding:16rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;background:var(--yx-surface-card);font-size:24rpx}.b10-input{height:72rpx}.b10-textarea{min-height:220rpx}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}
/* v2 语法页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-grammar-page{font-family:var(--v2-font)}
.v2-grammar-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-grammar-status{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-grammar-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-grammar-card:hover{border-color:var(--v2-brand)}
.v2-grammar-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-grammar-title,.v2-grammar-h2{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-grammar-kicker{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;line-height:1.5;text-transform:uppercase;overflow-wrap:anywhere}
.v2-grammar-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-grammar-meta{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-grammar-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-grammar-fb.ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-grammar-fb.no{background:var(--v2-bad-soft);color:var(--v2-bad)}
.v2-grammar-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-grammar-head>*{min-width:0;max-width:100%}
.v2-grammar-titles{display:flex;flex-direction:column;gap:var(--v2-space-2);flex:1 1 auto;box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-grammar-titles>*{min-width:0;max-width:100%}
.v2-grammar-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0}
scroll-view.v2-grammar-list{display:flex;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;overflow-x:auto}
.v2-grammar-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
scroll-view.v2-grammar-list .v2-grammar-opt{width:auto;flex:0 0 auto}
.v2-grammar-opt:hover{border-color:var(--v2-brand)}
.v2-grammar-opt.sel{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-grammar-opt.b10-point--active{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-grammar-opt:active{transform:scale(.97)}
.v2-grammar-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-grammar-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-grammar-rule{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding-top:var(--v2-space-4);border-top:1px solid var(--v2-line);font-family:var(--v2-font)}
.v2-grammar-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-grammar-row:hover{border-color:var(--v2-brand)}
.v2-grammar-row>*{min-width:0;max-width:100%}
.v2-grammar-section{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding-top:var(--v2-space-4);border-top:1px solid var(--v2-line);font-family:var(--v2-font)}
.v2-grammar-actions{display:flex;gap:var(--v2-space-2);flex-wrap:wrap;align-items:center;box-sizing:border-box;max-width:100%;min-width:0}
.v2-grammar-actions>*{min-width:0;max-width:100%}
.v2-grammar-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-grammar-actions .v2-grammar-btn{width:auto;flex:0 0 auto}
.v2-grammar-btn:hover{border-color:var(--v2-brand)}
.v2-grammar-btn:active{transform:scale(.97)}
.v2-grammar-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-grammar-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-grammar-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-grammar-submit:hover{border-color:var(--v2-brand)}
.v2-grammar-input{width:100%;box-sizing:border-box;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.5;overflow-wrap:anywhere}
</style>
