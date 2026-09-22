import { experiencePerformance } from '../platform/experience-ui'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { type PerformanceLevel } from '@englishflow/performance'
import { createPracticeSession, createSrsBatch, fetchLearningReport, fetchPracticeSession, fetchVocabDetail, isB2OfflineError, savePracticeCheckpoint, submitPracticeAnswer, submitReviewEvent, syncReviewEvents } from '../api/b2'
import { B2_QUEUE_KEY, B2_STORAGE_KEY, type B2StateSnapshot, type CardPhase, type ContinueContext, type ImmediateFeedback, type LearningReport, type OfflineQueueItem, type PracticeSession, type ReviewEventInput, type ReviewQuality, type ReviewResult, type VocabularyCard, createClientEventId, createEmptyContinueContext } from '../domain/b2'

type B2Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error'

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function isPerformanceLevel(value: unknown): value is PerformanceLevel { return value === 'Ultra' || value === 'High' || value === 'Medium' || value === 'Performance' }
function readStoredQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(B2_QUEUE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is OfflineQueueItem => isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.event)) : []
  } catch { return [] }
}

export const useB2Store = defineStore('b2', () => {
  const engine = experiencePerformance
  const restored = ref(false)
  const performanceLevel = ref<PerformanceLevel>(engine.level)
  const status = ref<B2Status>('idle')
  const lastError = ref<string | null>(null)
  const cards = ref<VocabularyCard[]>([])
  const cardIndex = ref(0)
  const cardPhase = ref<CardPhase>('FRONT')
  const revealStartedAt = ref<number | null>(null)
  const queue = ref<OfflineQueueItem[]>([])
  const continueContext = ref<ContinueContext | null>(null)
  const practice = ref<PracticeSession | null>(null)
  const practiceFeedback = ref<ImmediateFeedback | null>(null)
  const report = ref<LearningReport | null>(null)
  const reportStatus = ref<B2Status>('idle')
  const currentCard = computed(() => cards.value[cardIndex.value] ?? null)
  const queueCount = computed(() => queue.value.filter((entry) => entry.status === 'PENDING' || entry.status === 'FAILED').length)
  const currentQuestion = computed(() => practice.value?.questions[practice.value.currentIndex] ?? null)

  const unsubscribePerformance = engine.subscribe((state) => { performanceLevel.value = state.level })

  function persist(): void {
    if (typeof window === 'undefined') return
    const snapshot: B2StateSnapshot = { performanceLevel: performanceLevel.value, cardPhase: cardPhase.value, currentCardId: currentCard.value?.id ?? null, currentSnapshotItemId: currentCard.value?.snapshotItemId ?? null, continueContext: continueContext.value, queue: queue.value }
    window.localStorage.setItem(B2_STORAGE_KEY, JSON.stringify(snapshot))
    window.localStorage.setItem(B2_QUEUE_KEY, JSON.stringify(queue.value))
  }

  function restore(): void {
    if (restored.value) return
    queue.value = readStoredQueue()
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(B2_STORAGE_KEY)
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (isRecord(parsed)) {
            if (isPerformanceLevel(parsed.performanceLevel)) { engine.setLevel(parsed.performanceLevel, 'restore'); performanceLevel.value = parsed.performanceLevel }
            if (isRecord(parsed.continueContext)) continueContext.value = parsed.continueContext as unknown as ContinueContext
          }
        } catch { /* stale local context is ignored; server remains authoritative */ }
      }
    }
    restored.value = true
  }

  async function loadVocabulary(): Promise<void> {
    restore(); status.value = 'loading'; lastError.value = null
    try {
      cards.value = await createSrsBatch({})
      cardIndex.value = 0; cardPhase.value = 'FRONT'; status.value = cards.value.length ? 'ready' : 'empty'; persist()
    } catch (error) {
      status.value = isB2OfflineError(error) ? 'offline' : 'error'
      lastError.value = error instanceof Error ? error.message : '词汇批次暂时无法加载，请稍后重试。'
    }
  }

  async function revealCard(): Promise<void> {
    const card = currentCard.value
    if (!card || cardPhase.value !== 'FRONT') return
    cardPhase.value = 'REVEALING'; revealStartedAt.value = Date.now(); persist()
    if (!card.back) {
      try { card.back = await fetchVocabDetail(card.item, card.snapshotId) } catch (error) {
        cardPhase.value = 'FRONT'; status.value = isB2OfflineError(error) ? 'offline' : 'error'; lastError.value = error instanceof Error ? error.message : '词卡背面暂时无法加载，答案未被伪造。'; persist(); return
      }
    }
    cardPhase.value = 'BACK'; lastError.value = null; persist()
  }

  function enqueue(event: ReviewEventInput, errorMessage: string): void {
    queue.value.push({ id: event.clientEventId, event, status: 'PENDING', attemptCount: 0, nextRetryAt: null, lastError: errorMessage }); cardPhase.value = 'PENDING_SYNC'; status.value = 'offline'; lastError.value = '当前网络不可用，本次复习已排队，待同步不等于已掌握。'; persist()
  }

  function moveToNextCard(): void {
    if (cardIndex.value < cards.value.length - 1) { cardIndex.value += 1; cardPhase.value = 'FRONT'; revealStartedAt.value = null } else { cardPhase.value = 'SYNCED'; }
    if (currentCard.value) continueContext.value = { moduleType: 'FLASHCARD', sessionId: null, snapshotId: currentCard.value.snapshotId, snapshotItemId: currentCard.value.snapshotItemId, stepIndex: cardIndex.value, totalSteps: cards.value.length, elapsedTimeMs: 0, pendingEventCount: queueCount.value, updatedAt: new Date().toISOString() }
    persist()
  }

  async function rateCard(rawQuality: ReviewQuality, answerOutcome: ReviewEventInput['answerOutcome'] = 'REVEALED_WITHOUT_ANSWER'): Promise<ReviewResult | null> {
    const card = currentCard.value
    if (!card || cardPhase.value !== 'BACK') return null
    if (card.snapshotId === null || card.snapshotItemId === null) { lastError.value = '当前卡片缺少服务端批次标识，不能提交复习事件。'; cardPhase.value = 'ERROR_RETRY'; return null }
    const event: ReviewEventInput = { snapshotId: card.snapshotId, snapshotItemId: card.snapshotItemId, item: card.item, rawQuality, answerOutcome, responseTimeMs: Math.max(0, Date.now() - (revealStartedAt.value ?? Date.now())), revealElapsedMs: Math.max(0, Date.now() - (revealStartedAt.value ?? Date.now())), clientEventId: createClientEventId(), clientOccurredAt: new Date().toISOString(), baseStateVersion: card.srs?.stateVersion ?? null }
    cardPhase.value = 'SUBMITTING'; lastError.value = null; persist()
    try {
      const result = await submitReviewEvent(event)
      if (result.status === 'CONFLICT') { cardPhase.value = 'ERROR_RETRY'; lastError.value = '这张卡片已在其他设备更新，请刷新批次后再继续。'; return result }
      moveToNextCard(); return result
    } catch (error) {
      if (isB2OfflineError(error)) { enqueue(event, error instanceof Error ? error.message : '网络不可用'); moveToNextCard(); return { status: 'PENDING_SYNC', reviewEventId: null, effectiveQuality: null, masteryStatus: null, delayedVerifyStage: null, nextReviewLocalDate: null, explanation: null } }
      cardPhase.value = 'ERROR_RETRY'; lastError.value = error instanceof Error ? error.message : '复习事件未提交，请重试。'; status.value = 'error'; return null
    }
  }

  async function syncQueue(): Promise<void> {
    const pending = queue.value.filter((entry) => entry.status === 'PENDING' || entry.status === 'FAILED')
    if (!pending.length) return
    pending.forEach((entry) => { entry.status = 'SYNCING' })
    try {
      const results = await syncReviewEvents(pending.map((entry) => entry.event))
      pending.forEach((entry, index) => { const result = results[index]; if (result && ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED'].includes(result.status)) entry.status = 'PENDING' as OfflineQueueItem['status']; else entry.status = 'FAILED'; entry.lastError = result?.explanation ?? null })
      queue.value = queue.value.filter((entry) => entry.status !== 'PENDING' || !pending.some((candidate) => candidate.id === entry.id))
      lastError.value = queue.value.length ? '部分离线事件仍待同步，请保持联网后重试。' : null
      status.value = queue.value.length ? 'offline' : 'ready'; persist()
    } catch (error) {
      pending.forEach((entry) => { entry.status = 'FAILED'; entry.attemptCount += 1; entry.lastError = error instanceof Error ? error.message : '同步失败' })
      status.value = isB2OfflineError(error) ? 'offline' : 'error'; lastError.value = '离线队列同步未完成，原事件仍保留。'; persist()
    }
  }

  async function saveCheckpoint(elapsedTimeMs = 0): Promise<void> {
    const context: ContinueContext = { moduleType: practice.value ? 'PRACTICE' : 'FLASHCARD', sessionId: practice.value?.sessionId ?? null, snapshotId: currentCard.value?.snapshotId ?? null, snapshotItemId: currentCard.value?.snapshotItemId ?? null, stepIndex: practice.value?.currentIndex ?? cardIndex.value, totalSteps: practice.value?.questions.length ?? cards.value.length, elapsedTimeMs, pendingEventCount: queueCount.value, updatedAt: new Date().toISOString() }
    continueContext.value = context; persist()
    if (practice.value?.sessionId) {
      if (!practice.value.lastAttemptId) return
      try { await savePracticeCheckpoint(practice.value.sessionId, practice.value.lastAttemptId, context) } catch (error) { lastError.value = isB2OfflineError(error) ? '断点已保存在本地，网络恢复后再同步。' : '断点服务暂时不可用，已保留本地副本。' }
    }
  }

  async function startPractice(sessionType: 'DAILY' | 'QUICK' | 'CHECKPOINT' = 'DAILY'): Promise<void> {
    status.value = 'loading'; lastError.value = null
    try { practice.value = await createPracticeSession(sessionType); status.value = practice.value.questions.length ? 'ready' : 'empty'; practiceFeedback.value = null; persist() } catch (error) { status.value = isB2OfflineError(error) ? 'offline' : 'error'; lastError.value = error instanceof Error ? error.message : '练习会话暂时无法创建。' }
  }

  async function loadPractice(sessionId: string): Promise<void> {
    status.value = 'loading'; lastError.value = null
    try { practice.value = await fetchPracticeSession(sessionId); status.value = practice.value.questions.length ? 'ready' : 'empty'; practiceFeedback.value = null } catch (error) { status.value = isB2OfflineError(error) ? 'offline' : 'error'; lastError.value = error instanceof Error ? error.message : '练习断点暂时无法读取。' }
  }

  async function answerPractice(answer: unknown): Promise<void> {
    const session = practice.value; const question = currentQuestion.value
    if (!session || !question || practiceFeedback.value) return
    try {
      const result = await submitPracticeAnswer(session.sessionId, { exerciseId: question.id, answer, clientAnswerId: createClientEventId('answer'), stateVersion: session.stateVersion })
      if (result.attemptId) session.lastAttemptId = result.attemptId
      if (result.reportId) session.reportId = result.reportId
      session.stateVersion += 1
      practiceFeedback.value = { correct: result.correct, title: result.correct === true ? '这一步已完成' : result.correct === false ? '先修复这个薄弱点' : '服务端暂未返回判定', message: result.feedback ?? '判定以服务端结果为准。', errorCategory: result.errorCategory, nextAction: result.correct === false ? 'RETRY' : 'NEXT' }
    } catch (error) { lastError.value = isB2OfflineError(error) ? '答案已留在当前断点，联网后再提交；未伪造正确或错误。' : '答案提交失败，请保持当前题面后重试。'; status.value = isB2OfflineError(error) ? 'offline' : 'error' }
  }

  function nextPractice(): void { if (!practice.value) return; practice.value.currentIndex = Math.min(practice.value.currentIndex + 1, practice.value.questions.length); practiceFeedback.value = null; void saveCheckpoint(); persist() }

  async function loadReport(reportType: 'DAILY' | 'WEEKLY' = 'DAILY'): Promise<void> {
    reportStatus.value = 'loading'; report.value = null
    try { report.value = await fetchLearningReport(reportType); reportStatus.value = 'ready' } catch (error) { reportStatus.value = isB2OfflineError(error) ? 'offline' : 'error'; lastError.value = error instanceof Error ? error.message : '报告快照暂时无法读取，页面不会显示估算数据。' }
  }

  function setPerformanceLevel(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level; persist() }
  function clearError(): void { lastError.value = null }
  function dispose(): void { unsubscribePerformance(); /* Shared engine lives for the application lifetime. */ }

  return { restored, performanceLevel, status, lastError, cards, cardIndex, cardPhase, currentCard, queue, queueCount, continueContext, practice, currentQuestion, practiceFeedback, report, reportStatus, restore, persist, loadVocabulary, revealCard, rateCard, syncQueue, saveCheckpoint, startPractice, loadPractice, answerPractice, nextPractice, loadReport, setPerformanceLevel, clearError, dispose }
})
