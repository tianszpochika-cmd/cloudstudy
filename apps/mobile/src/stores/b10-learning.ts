import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { B10AnswerInput, B10AnswerResult, B10AssessmentSession, B10Mistake, B10Report, B10RequestContext, B10SrsBatch } from '../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../api/b10'
import { b10ContentLocale, b10UiLocale } from '../platform/b10-foundation'
import { getUniRuntime } from '../platform/uni-runtime'

const STORAGE_KEY = 'yx.b10.mobile.learning.v1'

interface QueuedReview { clientEventId: string; payload: Record<string, unknown>; cardId: string }
interface PersistedState {
  batch?: B10SrsBatch | null
  currentIndex?: number
  queuedReviews?: QueuedReview[]
  practice?: B10AssessmentSession | null
  answers?: Record<string, B10AnswerInput>
  answerResults?: Record<string, B10AnswerResult>
  mistakes?: B10Mistake[]
  report?: B10Report | null
}

function context(): B10RequestContext { return { uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value } }
function nowId(prefix: string): string { return createB10ClientEventId(prefix) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

async function hashState(value: unknown): Promise<string> {
  const serialized = JSON.stringify(value)
  const cryptoValue = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
  if (cryptoValue?.subtle) {
    const digest = await cryptoValue.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const char of serialized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `${Math.abs(hash).toString(16).padStart(8, '0')}${'0'.repeat(56)}`
}

export const useB10LearningStore = defineStore('mobile-b10-learning', () => {
  const restored = ref(false)
  const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
  const message = ref<string | null>(null)
  const batch = ref<B10SrsBatch | null>(null)
  const currentIndex = ref(0)
  const queuedReviews = ref<QueuedReview[]>([])
  const practice = ref<B10AssessmentSession | null>(null)
  const answers = ref<Record<string, B10AnswerInput>>({})
  const answerResults = ref<Record<string, B10AnswerResult>>({})
  const mistakes = ref<B10Mistake[]>([])
  const report = ref<B10Report | null>(null)
  const reportStatus = ref<typeof status.value>('idle')
  const practiceStatus = ref<typeof status.value>('idle')
  const practiceMessage = ref<string | null>(null)
  const srsQueueCount = computed(() => queuedReviews.value.length)
  const currentCard = computed(() => batch.value?.items[currentIndex.value] ?? null)
  const currentExercise = computed(() => practice.value?.exercises.find((exercise) => !answerResults.value[String(exercise.exerciseId)]) ?? practice.value?.exercises[0] ?? null)

  function persist(): void {
    getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ batch: batch.value, currentIndex: currentIndex.value, queuedReviews: queuedReviews.value, practice: practice.value, answers: answers.value, answerResults: answerResults.value, mistakes: mistakes.value, report: report.value } satisfies PersistedState))
  }

  function restore(): void {
    if (restored.value) return
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw === 'string') {
      try {
        const saved = JSON.parse(raw) as PersistedState
        if (saved.batch) batch.value = saved.batch
        if (typeof saved.currentIndex === 'number') currentIndex.value = Math.max(0, saved.currentIndex)
        if (Array.isArray(saved.queuedReviews)) queuedReviews.value = saved.queuedReviews.filter((item): item is QueuedReview => isRecord(item) && typeof item.clientEventId === 'string' && typeof item.cardId === 'string' && isRecord(item.payload))
        if (saved.practice) practice.value = saved.practice
        if (isRecord(saved.answers)) answers.value = saved.answers as Record<string, B10AnswerInput>
        if (isRecord(saved.answerResults)) answerResults.value = saved.answerResults as Record<string, B10AnswerResult>
        if (Array.isArray(saved.mistakes)) mistakes.value = saved.mistakes
        if (saved.report) report.value = saved.report
      } catch { /* corrupt local state is ignored; server remains authoritative */ }
    }
    restored.value = true
  }

  async function loadSrs(): Promise<void> {
    restore(); status.value = 'loading'; message.value = null
    try {
      batch.value = await b10LearningApi.createSrsBatch(context(), nowId('srs-batch'))
      currentIndex.value = Math.min(currentIndex.value, batch.value.items.length)
      status.value = batch.value.items.length ? 'ready' : 'empty'
      persist()
    } catch (error) {
      const info = b10ErrorInfo(error, '词汇批次暂时无法加载。')
      status.value = info.kind; message.value = info.message; persist()
    }
  }

  async function revealCard(card = currentCard.value): Promise<void> {
    if (!card || card.revealed || card.reviewStatus === 'SUBMITTING') return
    status.value = 'loading'; message.value = null
    try {
      const detail = await b10LearningApi.getVocabularyDetail(context(), card.itemId, card.contentVersion)
      Object.assign(card, detail, { revealed: true, reviewStatus: 'PENDING' as const })
      status.value = 'ready'; persist()
    } catch (error) {
      const info = b10ErrorInfo(error, '词卡背面暂时无法加载，答案未被伪造。')
      status.value = info.kind; message.value = info.message
      if (info.kind === 'stale') card.reviewStatus = 'STALE'
      persist()
    }
  }

  function reviewPayload(card: NonNullable<typeof currentCard.value>, quality: 0 | 1 | 2 | 3, clientEventId: string): Record<string, unknown> {
    const item = card.itemType === 'VOCAB' ? { itemType: 'VOCAB', vocabId: card.itemId } : card.itemType === 'PHRASE' ? { itemType: 'PHRASE', phraseId: card.itemId } : { itemType: 'EXPRESSION', expressionId: card.itemId }
    return { snapshotId: card.snapshotId, snapshotItemId: card.snapshotItemId, item, rawQuality: quality, answerOutcome: 'REVEALED_WITHOUT_ANSWER', responseTimeMs: 0, revealElapsedMs: 0, clientEventId, clientOccurredAt: new Date().toISOString(), baseStateVersion: card.stateVersion }
  }

  async function rateCard(quality: 0 | 1 | 2 | 3, card = currentCard.value): Promise<void> {
    if (!card || !card.revealed || card.reviewStatus === 'SUBMITTING' || card.reviewStatus === 'ACCEPTED' || card.reviewStatus === 'QUEUED') return
    if (!card.snapshotId || !card.snapshotItemId) { status.value = 'error'; message.value = '当前卡片缺少服务端批次标识，不能提交复习事件。'; return }
    const clientEventId = nowId(`srs-review-${card.id}`)
    const payload = reviewPayload(card, quality, clientEventId)
    card.reviewStatus = 'SUBMITTING'; status.value = 'loading'; message.value = null
    try {
      await b10LearningApi.submitSrsReview(context(), card, quality, clientEventId)
      card.reviewStatus = 'ACCEPTED'; status.value = 'ready'; message.value = '复习已记录。'; currentIndex.value = Math.min(currentIndex.value + 1, batch.value?.items.length ?? currentIndex.value + 1); persist()
    } catch (error) {
      const info = b10ErrorInfo(error, '复习提交失败。')
      if (info.kind === 'offline') {
        if (!queuedReviews.value.some((item) => item.clientEventId === clientEventId)) queuedReviews.value.push({ clientEventId, payload, cardId: card.id })
        card.reviewStatus = 'QUEUED'; status.value = 'offline'; message.value = '本次复习已排队待同步，服务端尚未确认掌握变化。'; currentIndex.value = Math.min(currentIndex.value + 1, batch.value?.items.length ?? currentIndex.value + 1)
      } else { card.reviewStatus = info.kind === 'stale' ? 'STALE' : 'FAILED'; status.value = info.kind; message.value = info.message }
      persist()
    }
  }

  async function syncSrs(): Promise<void> {
    if (!queuedReviews.value.length) return
    status.value = 'loading'; message.value = null
    try {
      await b10LearningApi.syncSrsReviews(context(), queuedReviews.value.map((item) => item.payload), nowId('srs-sync'))
      for (const item of queuedReviews.value) { const card = batch.value?.items.find((entry) => entry.id === item.cardId); if (card) card.reviewStatus = 'ACCEPTED' }
      queuedReviews.value = []; status.value = 'ready'; message.value = '待同步复习已提交。'; persist()
    } catch (error) {
      const info = b10ErrorInfo(error, '同步失败，队列仍保留。'); status.value = info.kind; message.value = info.message; persist()
    }
  }

  async function loadPractice(): Promise<void> {
    restore(); practiceStatus.value = 'loading'; practiceMessage.value = null
    try {
      if (practice.value?.sessionId && ['IN_PROGRESS', 'INTERRUPTED', 'CREATED'].includes(practice.value.status)) practice.value = await b10LearningApi.readAssessmentSession(context(), practice.value.sessionId)
      else practice.value = await b10LearningApi.createAssessmentSession(context(), { sessionType: 'DAILY_STREAM', targetCount: 15 }, nowId('assessment-session'))
      practiceStatus.value = practice.value.exercises.length ? 'ready' : 'empty'; persist()
    } catch (error) {
      const info = b10ErrorInfo(error, '练习会话暂时无法创建。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist()
    }
  }

  async function submitAnswer(exerciseId: number, answer: B10AnswerInput): Promise<B10AnswerResult | null> {
    if (!practice.value || answerResults.value[String(exerciseId)]) return answerResults.value[String(exerciseId)] ?? null
    answers.value[String(exerciseId)] = answer; practiceStatus.value = 'loading'; practiceMessage.value = null
    const revision = (practice.value.answerSheet.find((item) => item.exerciseId === exerciseId)?.revision ?? 0) + 1
    const clientEventId = nowId(`assessment-answer-${exerciseId}`)
    try {
      const result = await b10LearningApi.submitAssessmentAnswer(context(), practice.value.sessionId, exerciseId, answer, revision, practice.value.lastCheckpointSeq, clientEventId)
      answerResults.value[String(exerciseId)] = result; practiceStatus.value = result.contentVersionStale ? 'stale' : 'ready'; practiceMessage.value = result.contentVersionStale ? '题目版本已失效，请重新读取会话。' : null; persist(); return result
    } catch (error) {
      const info = b10ErrorInfo(error, '答案提交失败，当前答案已保留。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist(); return null
    }
  }

  async function saveCheckpoint(exerciseId: number | null): Promise<void> {
    if (!practice.value) return
    practice.value.lastCheckpointSeq += 1; const clientEventId = nowId(`assessment-checkpoint-${practice.value.lastCheckpointSeq}`)
    try { await b10LearningApi.saveAssessmentCheckpoint(context(), practice.value.sessionId, practice.value.lastCheckpointSeq, exerciseId, await hashState({ exerciseId, answeredExerciseIds: Object.keys(answers.value).map(Number).sort() }), clientEventId); persist() }
    catch (error) { const info = b10ErrorInfo(error, '断点保存失败，当前作答仍保留在本机。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist() }
  }

  async function completePractice(): Promise<void> {
    if (!practice.value) return
    practiceStatus.value = 'loading'; practiceMessage.value = null
    try { report.value = await b10LearningApi.completeAssessmentSession(context(), practice.value.sessionId, nowId('assessment-complete')); practiceStatus.value = 'ready'; persist() }
    catch (error) { const info = b10ErrorInfo(error, '提交结算失败，未伪造报告。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist() }
  }

  async function loadMistakes(): Promise<void> {
    status.value = 'loading'; message.value = null
    try { mistakes.value = await b10LearningApi.listMistakes(context()); status.value = mistakes.value.length ? 'ready' : 'empty'; persist() }
    catch (error) { const info = b10ErrorInfo(error, '错题服务暂时不可用。'); status.value = info.kind; message.value = info.message; persist() }
  }

  async function startMistakeRetry(mistakeId: number): Promise<void> {
    status.value = 'loading'; message.value = null
    try { await b10LearningApi.startMistakeRetry(context(), mistakeId, nowId(`mistake-retry-${mistakeId}`)); status.value = 'ready'; message.value = '订正会话已创建。'; await loadMistakes() }
    catch (error) { const info = b10ErrorInfo(error, '错题订正暂时不可用。'); status.value = info.kind; message.value = info.message }
  }

  async function loadReport(period: 'daily' | 'weekly' = 'daily'): Promise<void> {
    reportStatus.value = 'loading'
    try { report.value = await b10LearningApi.readReport(context(), period); reportStatus.value = report.value.status === 'FAILED' ? 'error' : report.value.status === 'GENERATING' ? 'loading' : 'ready'; persist() }
    catch (error) { const info = b10ErrorInfo(error, '报告暂时不可用。'); reportStatus.value = info.kind; message.value = info.message; persist() }
  }

  return { restored, status, message, batch, currentIndex, queuedReviews, practice, answers, answerResults, mistakes, report, reportStatus, practiceStatus, practiceMessage, srsQueueCount, currentCard, currentExercise, restore, persist, loadSrs, revealCard, rateCard, syncSrs, loadPractice, submitAnswer, saveCheckpoint, completePractice, loadMistakes, startMistakeRetry, loadReport }
})
