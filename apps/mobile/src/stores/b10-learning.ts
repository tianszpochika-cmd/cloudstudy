import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { B10AnswerInput, B10AnswerResult, B10AssessmentSession, B10Mistake, B10Report, B10RequestContext, B10SrsBatch, B10SrsCard } from '../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../api/b10'
import { b10ContentLocale, b10UiLocale } from '../platform/b10-foundation'
import { getUniRuntime } from '../platform/uni-runtime'
import { useSessionStore } from './session'
import { B10_LEARNING_STORAGE_KEY, removeLearningCache } from './learning-cache'

const STORAGE_KEY = B10_LEARNING_STORAGE_KEY

interface QueuedReview { clientEventId: string; payload: Record<string, unknown>; cardId: string }
interface PersistedState {
  subject: string
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
const CONFIRMED_SRS_STATUSES = ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED'] as const

function responseRecord(value: unknown): Record<string, unknown> {
  let source = value
  if (isRecord(source) && isRecord(source.data)) source = source.data
  else if (isRecord(source) && isRecord(source.result)) source = source.result
  return isRecord(source) ? source : {}
}

function responseStatus(value: unknown): string | null {
  const status = responseRecord(value).status
  return typeof status === 'string' && status.trim() ? status.trim().toUpperCase() : null
}

function responseMessage(value: unknown, fallback: string): string {
  const source = responseRecord(value)
  for (const candidate of [source.feedbackCode, source.message, source.explanation]) if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  return fallback
}

function responseItems(value: unknown): unknown[] {
  const source = responseRecord(value)
  const items = source.results ?? source.items
  return Array.isArray(items) ? items : []
}

function isConfirmedSrsStatus(status: string | null): boolean {
  return status !== null && (CONFIRMED_SRS_STATUSES as readonly string[]).includes(status)
}

function applyRemoteSrsView(card: B10SrsCard, value: unknown): void {
  const source = responseRecord(value)
  const masteryStatus = source.masteryStatus ?? source.stage
  if (masteryStatus === 'NEW' || masteryStatus === 'LEARNING' || masteryStatus === 'MASTERED' || masteryStatus === 'CONSOLIDATED') card.masteryStatus = masteryStatus
  const due = source.nextReviewLocalDate ?? source.dueLocalDate ?? source.dueAt
  if (typeof due === 'string' && due.trim()) card.dueLocalDate = due.trim()
  const stateVersion = typeof source.stateVersion === 'number' ? source.stateVersion : typeof source.stateVersion === 'string' ? Number(source.stateVersion) : NaN
  if (Number.isFinite(stateVersion)) card.stateVersion = stateVersion
}

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
  const session = useSessionStore()
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
  const attemptCount = ref(0)
  const emptyCopy = ref('')
  const projectionVersion = ref('IT4-MISTAKE-1')
  const remediationId = ref<number | null>(null)
  const report = ref<B10Report | null>(null)
  const reportStatus = ref<typeof status.value>('idle')
  const practiceStatus = ref<typeof status.value>('idle')
  const practiceMessage = ref<string | null>(null)
  const srsQueueCount = computed(() => queuedReviews.value.length)
  const currentCard = computed(() => batch.value?.items[currentIndex.value] ?? null)
  const currentExercise = computed(() => practice.value?.exercises.find((exercise) => !answerResults.value[String(exercise.exerciseId)]) ?? practice.value?.exercises[0] ?? null)

  type Scope = { subject: string; revision: number }
  function scope(): Scope | null {
    return session.isAuthenticated && session.verifiedSubject
      ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
  }
  function stillCurrent(value: Scope | null): boolean {
    return Boolean(value && session.isAuthenticated && session.verifiedSubject === value.subject && session.identityRevision === value.revision)
  }
  function reset(): void {
    restored.value = false
    status.value = 'idle'; message.value = null
    batch.value = null; currentIndex.value = 0; queuedReviews.value = []
    practice.value = null; answers.value = {}; answerResults.value = {}; mistakes.value = []; attemptCount.value = 0; emptyCopy.value = ''; projectionVersion.value = 'IT4-MISTAKE-1'; remediationId.value = null; report.value = null
    reportStatus.value = 'idle'; practiceStatus.value = 'idle'; practiceMessage.value = null
  }
  watch(() => session.identityRevision, reset, { flush: 'sync' })

  function persist(): void {
    const owner = scope()
    if (!owner) return
    getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ subject: owner.subject, batch: batch.value, currentIndex: currentIndex.value, queuedReviews: queuedReviews.value, practice: practice.value, answers: answers.value, answerResults: answerResults.value, mistakes: mistakes.value, report: report.value } satisfies PersistedState))
  }

  function restore(): void {
    const owner = scope()
    if (!owner) return
    if (restored.value) return
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw === 'string') {
      try {
        const saved = JSON.parse(raw) as PersistedState
        if (saved.subject !== owner.subject) { removeLearningCache(STORAGE_KEY); restored.value = true; return }
        if (saved.batch) batch.value = saved.batch
        if (typeof saved.currentIndex === 'number') currentIndex.value = Math.max(0, saved.currentIndex)
        if (Array.isArray(saved.queuedReviews)) queuedReviews.value = saved.queuedReviews.filter((item): item is QueuedReview => isRecord(item) && typeof item.clientEventId === 'string' && typeof item.cardId === 'string' && isRecord(item.payload))
        if (saved.practice) practice.value = saved.practice
        if (isRecord(saved.answers)) answers.value = saved.answers as Record<string, B10AnswerInput>
        if (isRecord(saved.answerResults)) answerResults.value = saved.answerResults as Record<string, B10AnswerResult>
        if (Array.isArray(saved.mistakes)) mistakes.value = saved.mistakes
        if (saved.report) report.value = saved.report
      } catch { removeLearningCache(STORAGE_KEY) }
    }
    restored.value = true
  }

  async function loadSrs(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); status.value = 'forbidden'; return }
    restore(); status.value = 'loading'; message.value = null
    try {
      const remote = await b10LearningApi.createSrsBatch(context(), nowId('srs-batch'))
      if (!stillCurrent(owner)) return
      batch.value = remote
      if (batch.value.status === 'RECOVERY_REQUIRED') {
        status.value = 'stale'; message.value = '复习记录待核验，暂不可结算。'; persist(); return
      }
      currentIndex.value = Math.min(currentIndex.value, batch.value.items.length)
      status.value = batch.value.items.length ? 'ready' : 'empty'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      const info = b10ErrorInfo(error, '词汇批次暂时无法加载。')
      status.value = info.kind; message.value = info.message; persist()
    }
  }

  async function revealCard(card = currentCard.value): Promise<void> {
    const owner = scope()
    if (!owner || !card || !batch.value?.items.includes(card) || card.revealed || card.reviewStatus === 'SUBMITTING') return
    status.value = 'loading'; message.value = null
    try {
      const detail = await b10LearningApi.getVocabularyDetail(context(), card.itemId, card.contentVersion)
      if (!stillCurrent(owner)) return
      Object.assign(card, detail, { revealed: true, reviewStatus: 'PENDING' as const })
      status.value = 'ready'; persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      const info = b10ErrorInfo(error, '词卡背面暂时无法加载，答案未被伪造。')
      status.value = info.kind; message.value = info.message
      if (info.kind === 'stale') card.reviewStatus = 'STALE'
      persist()
    }
  }

  function reviewPayload(card: NonNullable<typeof currentCard.value>, quality: 0 | 1 | 2 | 3, clientEventId: string): Record<string, unknown> {
    const item = card.itemType === 'VOCAB' ? { itemType: 'VOCAB', vocabId: card.itemId } : card.itemType === 'PHRASE' ? { itemType: 'PHRASE', phraseId: card.itemId } : { itemType: 'EXPRESSION', expressionId: card.itemId }
    return { itemId: card.itemId, snapshotId: card.snapshotId, snapshotItemId: card.snapshotItemId, item, rawQuality: quality, answerOutcome: 'REVEALED_WITHOUT_ANSWER', responseTimeMs: 0, revealElapsedMs: 0, clientEventId, clientOccurredAt: new Date().toISOString(), baseStateVersion: card.stateVersion }
  }

  async function rateCard(quality: 0 | 1 | 2 | 3, card = currentCard.value): Promise<void> {
    const owner = scope()
    if (!owner || !card || !batch.value?.items.includes(card) || !card.revealed || card.reviewStatus === 'SUBMITTING' || card.reviewStatus === 'ACCEPTED' || card.reviewStatus === 'QUEUED') return
    if (!card.snapshotId || !card.snapshotItemId) { status.value = 'error'; message.value = '当前卡片缺少服务端批次标识，不能提交复习事件。'; return }
    const clientEventId = nowId(`srs-review-${card.id}`)
    const payload = reviewPayload(card, quality, clientEventId)
    card.reviewStatus = 'SUBMITTING'; status.value = 'loading'; message.value = null
    try {
      const response = await b10LearningApi.submitSrsReview(context(), card, quality, clientEventId)
      if (!stillCurrent(owner)) return
      const remoteStatus = responseStatus(response)
      if (remoteStatus === 'PENDING_SYNC') {
        if (!queuedReviews.value.some((item) => item.clientEventId === clientEventId)) queuedReviews.value.push({ clientEventId, payload, cardId: card.id })
        card.reviewStatus = 'QUEUED'; status.value = 'offline'; message.value = '本次复习已排队待同步，服务端尚未确认掌握变化。'; currentIndex.value = Math.min(currentIndex.value + 1, batch.value?.items.length ?? currentIndex.value + 1); persist(); return
      }
      if (!isConfirmedSrsStatus(remoteStatus)) {
        card.reviewStatus = remoteStatus === 'CONFLICT' ? 'STALE' : 'FAILED'
        status.value = remoteStatus === 'CONFLICT' ? 'stale' : 'error'
        message.value = responseMessage(response, '服务端未确认本次复习，当前卡片未推进。')
        persist()
        return
      }
      applyRemoteSrsView(card, response)
      card.reviewStatus = 'ACCEPTED'; status.value = 'ready'; message.value = '复习已记录。'; currentIndex.value = Math.min(currentIndex.value + 1, batch.value?.items.length ?? currentIndex.value + 1); persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      const info = b10ErrorInfo(error, '复习提交失败。')
      if (info.kind === 'offline') {
        if (!queuedReviews.value.some((item) => item.clientEventId === clientEventId)) queuedReviews.value.push({ clientEventId, payload, cardId: card.id })
        card.reviewStatus = 'QUEUED'; status.value = 'offline'; message.value = '本次复习已排队待同步，服务端尚未确认掌握变化。'; currentIndex.value = Math.min(currentIndex.value + 1, batch.value?.items.length ?? currentIndex.value + 1)
      } else { card.reviewStatus = info.kind === 'stale' ? 'STALE' : 'FAILED'; status.value = info.kind; message.value = info.message }
      persist()
    }
  }

  async function syncSrs(): Promise<void> {
    const owner = scope()
    if (!owner || !queuedReviews.value.length) return
    status.value = 'loading'; message.value = null
    try {
      const queued = [...queuedReviews.value]
      const response = await b10LearningApi.syncSrsReviews(context(), queued.map((item) => item.payload), nowId('srs-sync'))
      if (!stillCurrent(owner)) return
      const results = responseItems(response)
      const remaining: QueuedReview[] = []
      for (const [index, item] of queued.entries()) {
        const result = results[index]
        const remoteStatus = responseStatus(result)
        const card = batch.value?.items.find((entry) => entry.id === item.cardId)
        if (isConfirmedSrsStatus(remoteStatus)) { if (card) { applyRemoteSrsView(card, result); card.reviewStatus = 'ACCEPTED' } }
        else { if (card) card.reviewStatus = remoteStatus === 'CONFLICT' ? 'STALE' : 'FAILED'; remaining.push(item) }
      }
      queuedReviews.value = remaining
      if (remaining.length) { status.value = results.some((result) => responseStatus(result) === 'CONFLICT') ? 'stale' : 'offline'; message.value = '部分复习未获服务端确认，队列仍保留。' }
      else { status.value = 'ready'; message.value = '待同步复习已提交。' }
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      const info = b10ErrorInfo(error, '同步失败，队列仍保留。'); status.value = info.kind; message.value = info.message; persist()
    }
  }

  async function loadPractice(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); practiceStatus.value = 'forbidden'; return }
    restore(); practiceStatus.value = 'loading'; practiceMessage.value = null
    try {
      const remote = practice.value?.sessionId && ['IN_PROGRESS', 'INTERRUPTED', 'CREATED'].includes(practice.value.status)
        ? await b10LearningApi.readAssessmentSession(context(), practice.value.sessionId)
        : await b10LearningApi.createAssessmentSession(context(), { sessionType: 'DAILY_STREAM', targetCount: 15 }, nowId('assessment-session'))
      if (!stillCurrent(owner)) return
      practice.value = remote
      practiceStatus.value = practice.value.exercises.length ? 'ready' : 'empty'; persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      const info = b10ErrorInfo(error, '练习会话暂时无法创建。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist()
    }
  }

  async function submitAnswer(exerciseId: number, answer: B10AnswerInput): Promise<B10AnswerResult | null> {
    const owner = scope()
    if (!owner) return null
    if (!practice.value || answerResults.value[String(exerciseId)]) return answerResults.value[String(exerciseId)] ?? null
    const selectedPractice = practice.value
    answers.value[String(exerciseId)] = answer; practiceStatus.value = 'loading'; practiceMessage.value = null
    const revision = (practice.value.answerSheet.find((item) => item.exerciseId === exerciseId)?.revision ?? 0) + 1
    const clientEventId = nowId(`assessment-answer-${exerciseId}`)
    try {
      const result = await b10LearningApi.submitAssessmentAnswer(context(), practice.value.sessionId, exerciseId, answer, revision, practice.value.lastCheckpointSeq, clientEventId, practice.value.stateVersion)
      if (!stillCurrent(owner) || practice.value !== selectedPractice) return null
      answerResults.value[String(exerciseId)] = result
      if (result.attemptId) practice.value.lastAttemptId = result.attemptId
      if (result.reportId) practice.value.reportId = result.reportId
      practice.value.stateVersion += 1
      practiceStatus.value = result.contentVersionStale ? 'stale' : 'ready'; practiceMessage.value = result.contentVersionStale ? '题目版本已失效，请重新读取会话。' : null; persist(); return result
    } catch (error) {
      if (!stillCurrent(owner) || practice.value !== selectedPractice) return null
      const info = b10ErrorInfo(error, '答案提交失败，当前答案已保留。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist(); return null
    }
  }

  async function saveCheckpoint(exerciseId: number | null): Promise<void> {
    const owner = scope()
    if (!owner || !practice.value) return
    const selectedPractice = practice.value
    practice.value.lastCheckpointSeq += 1; const clientEventId = nowId(`assessment-checkpoint-${practice.value.lastCheckpointSeq}`)
    if (!practice.value.lastAttemptId) return
    try {
      const digest = await hashState({ exerciseId, answeredExerciseIds: Object.keys(answers.value).map(Number).sort() })
      if (!stillCurrent(owner) || practice.value !== selectedPractice) return
      await b10LearningApi.saveAssessmentCheckpoint(context(), selectedPractice.sessionId, selectedPractice.lastAttemptId!, selectedPractice.lastCheckpointSeq, exerciseId, digest, clientEventId)
      if (stillCurrent(owner) && practice.value === selectedPractice) persist()
    }
    catch (error) { if (!stillCurrent(owner) || practice.value !== selectedPractice) return; const info = b10ErrorInfo(error, '断点保存失败，当前作答仍保留在本机。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist() }
  }

  async function completePractice(): Promise<void> {
    const owner = scope()
    if (!owner || !practice.value) return
    const selectedPractice = practice.value
    practiceStatus.value = 'loading'; practiceMessage.value = null
    try { const remote = await b10LearningApi.completeAssessmentSession(context(), selectedPractice.sessionId, nowId('assessment-complete')); if (!stillCurrent(owner) || practice.value !== selectedPractice) return; report.value = remote; practiceStatus.value = 'ready'; persist() }
    catch (error) { if (!stillCurrent(owner) || practice.value !== selectedPractice) return; const info = b10ErrorInfo(error, '提交结算失败，未伪造报告。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist() }
  }

  async function loadMistakes(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); status.value = 'forbidden'; return }
    status.value = 'loading'; message.value = null
    try { const remote = await b10LearningApi.listMistakeBook(context()); if (!stillCurrent(owner)) return; mistakes.value = remote.items; attemptCount.value = remote.attemptCount; emptyCopy.value = remote.emptyCopy; projectionVersion.value = remote.projectionVersion || 'IT4-MISTAKE-1'; const listed = remote.items.find((item) => item.remediationId)?.remediationId ?? null; if (listed) remediationId.value = listed; status.value = mistakes.value.length ? 'ready' : 'empty'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; const info = b10ErrorInfo(error, '错题服务暂时不可用。'); status.value = info.kind; message.value = info.message; persist() }
  }

  async function startMistakeRetry(mistakeId: number): Promise<void> {
    const owner = scope()
    if (!owner || !mistakes.value.some((item) => item.mistakeId === mistakeId)) return
    status.value = 'loading'; message.value = null
    try { const verification = await b10LearningApi.startMistakeRetry(context(), mistakeId, nowId(`mistake-retry-${mistakeId}`)); if (!stillCurrent(owner)) return; remediationId.value = verification.remediationId ?? verification.verificationId; status.value = 'ready'; message.value = '订正会话已创建。'; await loadMistakes() }
    catch (error) { if (!stillCurrent(owner)) return; const info = b10ErrorInfo(error, '错题订正暂时不可用。'); status.value = info.kind; message.value = info.message }
  }

  async function loadReport(period: 'daily' | 'weekly' = 'daily'): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); reportStatus.value = 'forbidden'; return }
    reportStatus.value = 'loading'
    try { const remote = await b10LearningApi.readReport(context(), period); if (!stillCurrent(owner)) return; report.value = remote; reportStatus.value = report.value.status === 'FAILED' ? 'error' : report.value.status === 'GENERATING' ? 'loading' : 'ready'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; const info = b10ErrorInfo(error, '报告暂时不可用。'); reportStatus.value = info.kind; message.value = info.message; persist() }
  }

  return { restored, status, message, batch, currentIndex, queuedReviews, practice, answers, answerResults, mistakes, attemptCount, emptyCopy, projectionVersion, remediationId, report, reportStatus, practiceStatus, practiceMessage, srsQueueCount, currentCard, currentExercise, restore, persist, loadSrs, revealCard, rateCard, syncSrs, loadPractice, submitAnswer, saveCheckpoint, completePractice, loadMistakes, startMistakeRetry, loadReport }
})
