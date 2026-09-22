import { experiencePerformance } from '../platform/experience-ui'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { type PerformanceLevel } from '@englishflow/performance'
import {
  createPracticeSession,
  createReadingMining,
  failureKind,
  getLearningReport,
  getPracticeSession,
  getReadingArticle,
  getReadingDictionary,
  getVocabularyDetail,
  isB10OfflineError,
  listGrammarExercises,
  listGrammarMastery,
  listGrammarPoints,
  listProofreadingExercises,
  listReadingArticles,
  listReadingQuestions,
  listWritingHistory,
  listWritingMaterials,
  listWritingPrompts,
  listWritingTemplates,
  listVocabularyBatch,
  savePracticeCheckpoint,
  saveReadingProgress,
  submitGrammarAttempt,
  submitPracticeAnswer,
  submitProofreading,
  submitReadingQuiz,
  submitSentenceBlocks,
  submitSentenceImitation,
  submitVocabularyReview,
  submitWriting,
  syncVocabularyReviews,
  getSentenceGraph,
} from '../api/b10'
import type {
  B10CardPhase,
  B10DictionaryEntry,
  B10Feedback,
  B10GrammarExercise,
  B10GrammarMastery,
  B10GrammarPoint,
  B10OfflineAction,
  B10PerformanceLevel,
  B10PracticeSession,
  B10ProofreadingIssue,
  B10ReadingArticle,
  B10ReadingAttemptResult,
  B10ReadingQuestion,
  B10Report,
  B10ReviewEvent,
  B10ReviewQuality,
  B10SentenceGraph,
  B10Status,
  B10VocabularyCard,
  B10WritingFeedback,
  B10WritingHistoryItem,
  B10WritingMaterial,
  B10WritingPrompt,
  B10WritingTemplate,
} from '../domain/b10'
import { createB10StableKey } from '../domain/b10'

const STORAGE_PREFIX = 'yx.b10.learner-web.v1'
const QUEUE_KEY = `${STORAGE_PREFIX}.offline-queue`
const DRAFT_KEY = `${STORAGE_PREFIX}.writing-draft`
const PRACTICE_DRAFT_KEY = `${STORAGE_PREFIX}.practice-drafts`
const SEQ_KEY = `${STORAGE_PREFIX}.client-seq`
const GRAMMAR_DRAFT_KEY = `${STORAGE_PREFIX}.grammar-drafts`
const READING_STATE_KEY = `${STORAGE_PREFIX}.reading-state`

interface GrammarDraft {
  selectedGrammarPointId: number | null
  blockOrders: Record<string, string[]>
  imitationSlots: Record<string, Record<string, string>>
  exerciseAnswers: Record<string, unknown>
}

interface ReadingState {
  articleId: number
  contentVersionId: number
  blockId: string | null
  blockIndex: number
  progressPercent: number
  minedBlockIds: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* local recovery is best effort */ }
}

function readGrammarDraft(): GrammarDraft {
  const raw = readStorage<unknown>(GRAMMAR_DRAFT_KEY, null)
  const draft: GrammarDraft = { selectedGrammarPointId: null, blockOrders: {}, imitationSlots: {}, exerciseAnswers: {} }
  if (!isRecord(raw)) return draft
  const selected = raw.selectedGrammarPointId
  draft.selectedGrammarPointId = typeof selected === 'number' && Number.isInteger(selected) && selected > 0 ? selected : null
  if (isRecord(raw.blockOrders)) {
    for (const [key, value] of Object.entries(raw.blockOrders)) {
      if (Array.isArray(value) && value.every((item): item is string => typeof item === 'string')) draft.blockOrders[key] = [...value]
    }
  }
  if (isRecord(raw.imitationSlots)) {
    for (const [sentenceId, value] of Object.entries(raw.imitationSlots)) {
      if (!isRecord(value)) continue
      const slots: Record<string, string> = {}
      for (const [key, item] of Object.entries(value)) if (typeof item === 'string') slots[key] = item
      draft.imitationSlots[sentenceId] = slots
    }
  }
  if (isRecord(raw.exerciseAnswers)) draft.exerciseAnswers = { ...raw.exerciseAnswers }
  return draft
}

function nextSequence(): number {
  const current = Number(readStorage<number>(SEQ_KEY, 0))
  const next = Number.isFinite(current) && current >= 0 ? Math.floor(current) + 1 : 1
  writeStorage(SEQ_KEY, next)
  return next
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function localDate(): string { return new Date().toISOString().slice(0, 10) }

function isConfirmedReviewStatus(status: string): boolean {
  return status === 'ACCEPTED' || status === 'DUPLICATE' || status === 'RISK_FILTERED'
}

export const useB10Store = defineStore('b10-learning', () => {
  const engine = experiencePerformance
  const performanceLevel = ref<B10PerformanceLevel>(engine.level)
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

  const vocabularyStatus = ref<B10Status>('idle')
  const vocabularyMessage = ref<string | null>(null)
  const cards = ref<B10VocabularyCard[]>([])
  const cardIndex = ref(0)
  const cardPhase = ref<B10CardPhase>('FRONT')
  const revealStartedAt = ref<number | null>(null)
  const vocabularyCached = ref(false)

  const practiceStatus = ref<B10Status>('idle')
  const practiceMessage = ref<string | null>(null)
  const practice = ref<B10PracticeSession | null>(null)
  const practiceFeedback = ref<B10Feedback | null>(null)
  const practiceDrafts = ref<Record<string, unknown>>(readStorage<Record<string, unknown>>(PRACTICE_DRAFT_KEY, {}))
  const practiceSubmitting = ref(false)

  const reportStatus = ref<B10Status>('idle')
  const reportMessage = ref<string | null>(null)
  const report = ref<B10Report | null>(null)

  const readingStatus = ref<B10Status>('idle')
  const readingMessage = ref<string | null>(null)
  const readingArticle = ref<B10ReadingArticle | null>(null)
  const readingArticles = ref<B10ReadingArticle[]>([])
  const readingQuestions = ref<B10ReadingQuestion[]>([])
  const readingAnswers = ref<Record<number, string>>({})
  const readingResults = ref<Record<number, B10ReadingAttemptResult>>({})
  const readingActiveBlock = ref(0)
  const readingDictionary = ref<B10DictionaryEntry | null>(null)
  const readingDictionaryMessage = ref<string | null>(null)
  const minedBlocks = ref<Set<string>>(new Set())
  const readingCached = ref(false)

  const grammarStatus = ref<B10Status>('idle')
  const grammarMessage = ref<string | null>(null)
  const grammarPoints = ref<B10GrammarPoint[]>([])
  const grammarExercises = ref<B10GrammarExercise[]>([])
  const grammarMastery = ref<B10GrammarMastery[]>([])
  const grammarDraft = ref<GrammarDraft>(readGrammarDraft())
  const selectedGrammarPointId = ref<number | null>(grammarDraft.value.selectedGrammarPointId)
  const grammarSentence = ref<B10SentenceGraph | null>(null)
  const grammarSentenceFallback = ref(false)
  const grammarFeedback = ref<B10Feedback | null>(null)
  const imitationFeedback = ref<B10Feedback | null>(null)
  const blockFeedback = ref<B10Feedback | null>(null)
  let grammarSelectionRequest = 0

  const writingStatus = ref<B10Status>('idle')
  const writingMessage = ref<string | null>(null)
  const writingPrompts = ref<B10WritingPrompt[]>([])
  const writingTemplates = ref<B10WritingTemplate[]>([])
  const writingMaterials = ref<B10WritingMaterial[]>([])
  const proofreadingExercises = ref<B10ProofreadingIssue[]>([])
  const writingHistory = ref<B10WritingHistoryItem[]>([])
  const writingFeedback = ref<B10WritingFeedback | null>(null)
  const proofreadingFeedback = ref<B10Feedback | null>(null)
  const writingDraft = ref(readStorage<string>(DRAFT_KEY, ''))
  const writingSubmitting = ref(false)

  const offlineQueue = ref<B10OfflineAction[]>(readStorage<B10OfflineAction[]>(QUEUE_KEY, []).filter((item) => isRecord(item) && typeof item.id === 'string'))
  const queueCount = computed(() => offlineQueue.value.filter((item) => item.status === 'PENDING' || item.status === 'FAILED').length)
  const currentCard = computed(() => cards.value[cardIndex.value] ?? null)
  const currentQuestion = computed(() => practice.value?.questions[practice.value.currentIndex] ?? null)
  const selectedGrammarPoint = computed(() => grammarPoints.value.find((item) => item.grammarPointId === selectedGrammarPointId.value) ?? null)
  const selectedGrammarExercises = computed(() => grammarExercises.value.filter((item) => item.grammarPointId === selectedGrammarPointId.value))
  const reportWeaknesses = computed(() => report.value?.weakness ?? [])

  const unsubscribePerformance = engine.subscribe((state) => { performanceLevel.value = state.level })

  function persistQueue(): void { writeStorage(QUEUE_KEY, offlineQueue.value) }
  function persistPracticeDrafts(): void { writeStorage(PRACTICE_DRAFT_KEY, practiceDrafts.value) }
  function persistGrammarDraft(): void { writeStorage(GRAMMAR_DRAFT_KEY, grammarDraft.value) }
  function readReadingState(): ReadingState | null {
    const raw = readStorage<unknown>(READING_STATE_KEY, null)
    if (!isRecord(raw)) return null
    const articleId = typeof raw.articleId === 'number' && Number.isSafeInteger(raw.articleId) && raw.articleId > 0 ? raw.articleId : null
    const contentVersionId = typeof raw.contentVersionId === 'number' && Number.isSafeInteger(raw.contentVersionId) && raw.contentVersionId > 0 ? raw.contentVersionId : null
    const blockIndex = typeof raw.blockIndex === 'number' && Number.isSafeInteger(raw.blockIndex) && raw.blockIndex >= 0 ? raw.blockIndex : null
    const progressPercent = typeof raw.progressPercent === 'number' && Number.isFinite(raw.progressPercent) ? Math.min(100, Math.max(0, raw.progressPercent)) : null
    const blockId = raw.blockId === null || typeof raw.blockId === 'string' ? raw.blockId : null
    const minedBlockIds = Array.isArray(raw.minedBlockIds) ? raw.minedBlockIds.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
    if (articleId === null || contentVersionId === null || blockIndex === null || progressPercent === null) return null
    return { articleId, contentVersionId, blockId, blockIndex, progressPercent, minedBlockIds }
  }
  function persistReadingState(): void {
    const article = readingArticle.value
    if (!article) return
    const block = article.blocks[readingActiveBlock.value]
    writeStorage(READING_STATE_KEY, {
      articleId: article.articleId,
      contentVersionId: article.contentVersionId,
      blockId: block?.blockId ?? null,
      blockIndex: Math.max(0, readingActiveBlock.value),
      progressPercent: article.blocks.length ? Math.round(((readingActiveBlock.value + 1) / article.blocks.length) * 100) : 0,
      minedBlockIds: [...minedBlocks.value],
    } satisfies ReadingState)
  }
  function applyReadingState(article: B10ReadingArticle): void {
    const saved = readReadingState()
    const sameArticle = saved?.articleId === article.articleId && saved.contentVersionId === article.contentVersionId
    if (!sameArticle) {
      readingActiveBlock.value = 0
      minedBlocks.value = new Set()
      return
    }
    const savedIndex = saved.blockId ? article.blocks.findIndex((block) => block.blockId === saved.blockId) : -1
    readingActiveBlock.value = Math.min(Math.max(savedIndex >= 0 ? savedIndex : saved.blockIndex, 0), Math.max(article.blocks.length - 1, 0))
    const blockIds = new Set(article.blocks.map((block) => block.blockId))
    minedBlocks.value = new Set(saved.minedBlockIds.filter((blockId) => blockIds.has(blockId)))
  }
  function restoreReadingState(): void {
    const cached = readStorage<unknown>(`${STORAGE_PREFIX}.reading`, null)
    if (isRecord(cached) && typeof cached.articleId === 'number' && Array.isArray(cached.blocks)) {
      readingArticle.value = cached as unknown as B10ReadingArticle
      readingCached.value = true
      applyReadingState(readingArticle.value)
    }
  }
  function restoreGrammarDraft(): void {
    grammarDraft.value = readGrammarDraft()
    if (selectedGrammarPointId.value === null) selectedGrammarPointId.value = grammarDraft.value.selectedGrammarPointId
  }
  function grammarBlockOrder(sentenceId: number, fallback: readonly string[]): string[] {
    const saved = grammarDraft.value.blockOrders[String(sentenceId)]
    const allowed = new Set(fallback)
    return saved?.length === fallback.length && saved.every((item) => allowed.has(item)) ? [...saved] : [...fallback]
  }
  function saveGrammarBlockOrder(sentenceId: number, blockOrder: readonly string[]): void {
    grammarDraft.value.blockOrders[String(sentenceId)] = [...blockOrder]
    persistGrammarDraft()
  }
  function grammarImitationSlots(sentenceId: number, fallback: Record<string, string>): Record<string, string> {
    const saved = grammarDraft.value.imitationSlots[String(sentenceId)]
    if (!saved) return { ...fallback }
    const merged = { ...fallback }
    for (const [key, value] of Object.entries(saved)) if (key in fallback) merged[key] = value
    return merged
  }
  function saveGrammarImitationSlots(sentenceId: number, slotValues: Record<string, string>): void {
    grammarDraft.value.imitationSlots[String(sentenceId)] = { ...slotValues }
    persistGrammarDraft()
  }
  function grammarExerciseAnswer(exerciseId: number): unknown { return grammarDraft.value.exerciseAnswers[String(exerciseId)] }
  function saveGrammarExerciseAnswer(exerciseId: number, answer: unknown): void {
    grammarDraft.value.exerciseAnswers[String(exerciseId)] = answer
    persistGrammarDraft()
  }
  function setFailure(status: { value: B10Status }, message: { value: string | null }, error: unknown, fallback: string): void {
    const kind = failureKind(error)
    status.value = kind === 'offline' ? 'offline' : kind === 'forbidden' ? 'forbidden' : kind === 'stale' ? 'stale' : 'error'
    message.value = failureMessage(error, fallback)
  }
  function clearModuleError(message: { value: string | null }): void { message.value = null }
  function restore(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { online.value = true })
      window.addEventListener('offline', () => { online.value = false })
    }
    restoreGrammarDraft()
    restoreReadingState()
    engine.restore()
  }
  function setPerformanceLevel(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
  function markCached<T>(target: { value: T }, key: string): boolean {
    const cached = readStorage<T | null>(`${STORAGE_PREFIX}.${key}`, null)
    if (cached === null) return false
    target.value = cached
    return true
  }
  function cache<T>(key: string, value: T): void { writeStorage(`${STORAGE_PREFIX}.${key}`, value) }
  function setReadingBlock(index: number): void {
    const article = readingArticle.value
    if (!article?.blocks.length) return
    readingActiveBlock.value = Math.min(Math.max(0, index), article.blocks.length - 1)
    persistReadingState()
  }
  function enqueue(module: B10OfflineAction['module'], kind: B10OfflineAction['kind'], payload: Record<string, unknown>, id: string): void {
    if (offlineQueue.value.some((item) => item.id === id)) return
    offlineQueue.value.push({ id, module, kind, clientSeq: nextSequence(), payload, createdAt: new Date().toISOString(), status: 'PENDING', lastError: null })
    persistQueue()
  }

  async function loadVocabulary(): Promise<void> {
    vocabularyStatus.value = 'loading'; clearModuleError(vocabularyMessage)
    try {
      const result = await listVocabularyBatch({ localDate: localDate() })
      cards.value = result; cardIndex.value = 0; cardPhase.value = 'FRONT'; vocabularyCached.value = false; vocabularyStatus.value = result.length ? 'ready' : 'empty'; cache('vocabulary', result)
    } catch (error) {
      vocabularyCached.value = markCached(cards, 'vocabulary')
      cardIndex.value = Math.min(cardIndex.value, Math.max(0, cards.value.length - 1))
      if (vocabularyCached.value && isB10OfflineError(error)) vocabularyStatus.value = 'offline'
      else setFailure(vocabularyStatus, vocabularyMessage, error, '词汇批次暂时无法加载，请稍后重试。')
    }
  }

  async function revealCard(): Promise<void> {
    const card = currentCard.value
    if (!card || cardPhase.value !== 'FRONT') return
    cardPhase.value = 'REVEALING'; revealStartedAt.value = Date.now()
    try {
      if (!card.back) card.back = await getVocabularyDetail(card)
      cardPhase.value = 'BACK'; vocabularyMessage.value = null
    } catch (error) {
      cardPhase.value = 'ERROR_RETRY'; setFailure(vocabularyStatus, vocabularyMessage, error, '词卡背面暂时无法加载，答案未被伪造。')
    }
  }

  function moveToNextCard(pendingSync = false): void {
    if (cardIndex.value < cards.value.length - 1) { cardIndex.value += 1; cardPhase.value = 'FRONT'; revealStartedAt.value = null }
    else cardPhase.value = pendingSync ? 'PENDING_SYNC' : 'SYNCED'
  }

  async function rateCard(rawQuality: B10ReviewQuality, answerOutcome: B10ReviewEvent['answerOutcome'] = 'REVEALED_WITHOUT_ANSWER'): Promise<void> {
    const card = currentCard.value
    if (!card || cardPhase.value !== 'BACK') return
    const isDurableB25Card = typeof card.itemId === 'string'
    if (!isDurableB25Card && (card.snapshotId === null || card.snapshotItemId === null || card.contentVersionId === null)) { cardPhase.value = 'ERROR_RETRY'; vocabularyMessage.value = '当前卡片缺少服务端批次或内容版本标识，不能提交复习事件。'; return }
    const clientEventId = createB10StableKey('review', card.id, card.snapshotId ?? 'b25', card.snapshotItemId ?? card.itemId, card.srs?.stateVersion ?? 0, rawQuality)
    const event: B10ReviewEvent = { snapshotId: card.snapshotId ?? 'b25', snapshotItemId: card.snapshotItemId ?? card.itemId, itemType: card.itemType, itemId: card.itemId, contentVersionId: card.contentVersionId ?? 0, rawQuality, answerOutcome, responseTimeMs: Math.max(0, Date.now() - (revealStartedAt.value ?? Date.now())), revealElapsedMs: Math.max(0, Date.now() - (revealStartedAt.value ?? Date.now())), clientEventId, clientSeq: nextSequence(), clientOccurredAt: new Date().toISOString(), baseStateVersion: card.srs?.stateVersion ?? 0 }
    cardPhase.value = 'SUBMITTING'; vocabularyMessage.value = null
    try {
      const result = await submitVocabularyReview(event)
      if (result.status === 'CONFLICT') { cardPhase.value = 'ERROR_RETRY'; vocabularyStatus.value = 'stale'; vocabularyMessage.value = '这张卡片已在其他设备更新，请刷新批次后再继续。'; return }
      if (result.status === 'PENDING_SYNC') {
        enqueue('vocabulary', 'SRS_REVIEW', event as unknown as Record<string, unknown>, clientEventId)
        vocabularyStatus.value = 'offline'
        vocabularyMessage.value = '本次复习已按顺序排队，待同步不等于已掌握。'
        moveToNextCard(true)
        return
      }
      if (!isConfirmedReviewStatus(result.status)) {
        cardPhase.value = 'ERROR_RETRY'
        vocabularyStatus.value = 'error'
        vocabularyMessage.value = result.feedbackCode ?? '服务端未确认本次复习，当前卡片未推进。'
        return
      }
      if (card.srs) {
        card.srs = {
          ...card.srs,
          masteryStatus: result.masteryStatus ?? card.srs.masteryStatus,
          delayedVerifyStage: result.delayedVerifyStage ?? card.srs.delayedVerifyStage,
          nextReviewLocalDate: result.nextReviewLocalDate ?? card.srs.nextReviewLocalDate,
          dueLocalDate: result.nextReviewLocalDate ?? card.srs.dueLocalDate,
        }
      }
      moveToNextCard()
    } catch (error) {
      if (isB10OfflineError(error)) { enqueue('vocabulary', 'SRS_REVIEW', event as unknown as Record<string, unknown>, clientEventId); vocabularyStatus.value = 'offline'; vocabularyMessage.value = '本次复习已按顺序排队，待同步不等于已掌握。'; moveToNextCard(true); return }
      cardPhase.value = 'ERROR_RETRY'; setFailure(vocabularyStatus, vocabularyMessage, error, '复习事件未提交，请保留当前卡片后重试。')
    }
  }

  async function syncOffline(): Promise<void> {
    const pending = offlineQueue.value.filter((item) => item.status === 'PENDING' || item.status === 'FAILED').sort((left, right) => left.clientSeq - right.clientSeq)
    if (!pending.length) return
    pending.forEach((item) => { item.status = 'SYNCING'; item.lastError = null }); persistQueue()
    const reviewItems = pending.filter((item) => item.kind === 'SRS_REVIEW')
    let reviewSyncConfirmed = false
    try {
      if (reviewItems.length) {
        const results = await syncVocabularyReviews(reviewItems.map((item) => item.payload as unknown as B10ReviewEvent))
        reviewItems.forEach((item, index) => {
          const result = results[index]
          if (result && isConfirmedReviewStatus(result.status)) { offlineQueue.value = offlineQueue.value.filter((candidate) => candidate.id !== item.id); reviewSyncConfirmed = true }
          else { item.status = result?.status === 'CONFLICT' ? 'FAILED' : 'FAILED'; item.lastError = result?.feedbackCode ?? '服务端未确认本次复习。' }
        })
      }
      const progressItems = pending.filter((item) => item.kind === 'READING_PROGRESS')
      for (const item of progressItems) {
        try {
          await saveReadingProgress(item.payload as { articleId: number; blockId: string; progressPercent: number; positionVersion: number; contentVersionId: number }, item.id)
          offlineQueue.value = offlineQueue.value.filter((candidate) => candidate.id !== item.id)
        } catch (error) { item.status = 'FAILED'; item.lastError = failureMessage(error, '阅读进度同步失败。') }
      }
      persistQueue()
      if (!offlineQueue.value.length) { online.value = true; vocabularyStatus.value = vocabularyStatus.value === 'offline' ? 'ready' : vocabularyStatus.value; readingStatus.value = readingStatus.value === 'offline' ? 'ready' : readingStatus.value }
      if (reviewSyncConfirmed && !offlineQueue.value.length) await loadVocabulary()
    } catch (error) {
      pending.forEach((item) => { item.status = 'FAILED'; item.lastError = failureMessage(error, '同步失败。') })
      persistQueue(); if (failureKind(error) === 'offline') online.value = false
      vocabularyMessage.value = '离线队列同步未完成，原事件仍保留。'
    }
  }

  async function startPractice(sessionType: 'DAILY' | 'QUICK' | 'CHECKPOINT' = 'DAILY'): Promise<void> {
    practiceStatus.value = 'loading'; clearModuleError(practiceMessage); practiceFeedback.value = null
    try { practice.value = await createPracticeSession(sessionType); practiceStatus.value = practice.value.questions.length ? 'ready' : 'empty' }
    catch (error) { setFailure(practiceStatus, practiceMessage, error, '练习会话暂时无法创建。') }
  }
  async function loadPractice(sessionId: string): Promise<void> {
    practiceStatus.value = 'loading'; clearModuleError(practiceMessage); practiceFeedback.value = null
    try { practice.value = await getPracticeSession(sessionId); practiceStatus.value = practice.value.questions.length ? 'ready' : 'empty' }
    catch (error) { setFailure(practiceStatus, practiceMessage, error, '练习断点暂时无法读取。') }
  }
  function setPracticeAnswer(questionId: string, answer: unknown): void { practiceDrafts.value[questionId] = answer; persistPracticeDrafts() }
  function practiceAnswer(questionId: string): unknown { return practiceDrafts.value[questionId] }
  async function submitCurrentAnswer(answer: unknown): Promise<void> {
    const session = practice.value; const question = currentQuestion.value
    if (!session || !question || practiceSubmitting.value || practiceFeedback.value) return
    setPracticeAnswer(question.id, answer); practiceSubmitting.value = true; practiceStatus.value = 'recovering'; practiceMessage.value = null
    const stableKey = createB10StableKey('practice-answer', session.sessionId, question.id, session.answerRevision, JSON.stringify(answer))
    try {
      practiceFeedback.value = await submitPracticeAnswer(session.sessionId, { exerciseId: question.id, answer, clientAnswerId: stableKey, contentVersionId: question.contentVersionId, stateVersion: session.stateVersion }, stableKey)
      if (practiceFeedback.value.attemptId) session.lastAttemptId = String(practiceFeedback.value.attemptId)
      if (practiceFeedback.value.reportId) session.reportId = practiceFeedback.value.reportId
      session.stateVersion += 1
      practiceStatus.value = 'ready'
    } catch (error) { setFailure(practiceStatus, practiceMessage, error, '答案提交失败，已保留当前题面和本地草稿。') }
    finally { practiceSubmitting.value = false }
  }
  async function saveCheckpoint(elapsedTimeMs = 0): Promise<void> {
    if (!practice.value) return
    const payload = { checkpointSeq: practice.value.checkpointSeq + 1, currentIndex: practice.value.currentIndex, elapsedTimeMs, answerRevision: practice.value.answerRevision }
    practice.value.checkpointSeq = payload.checkpointSeq
    writeStorage(`${STORAGE_PREFIX}.practice-checkpoint`, { sessionId: practice.value.sessionId, ...payload, savedAt: new Date().toISOString() })
      if (!practice.value.lastAttemptId) return
      try { await savePracticeCheckpoint(practice.value.sessionId, practice.value.lastAttemptId, payload, createB10StableKey('practice-checkpoint', practice.value.sessionId, payload.checkpointSeq)) }
    catch (error) { practiceMessage.value = isB10OfflineError(error) ? '断点已保存在本地，网络恢复后可继续。' : failureMessage(error, '断点服务暂时不可用，已保留本地副本。') }
  }
  function nextPractice(): void { if (!practice.value || !practiceFeedback.value) return; practice.value.currentIndex = Math.min(practice.value.currentIndex + 1, practice.value.questions.length); practiceFeedback.value = null; void saveCheckpoint() }

  async function loadReport(reportType: 'DAILY' | 'WEEKLY' = 'DAILY'): Promise<void> {
    reportStatus.value = 'loading'; clearModuleError(reportMessage)
    try { report.value = await getLearningReport(reportType); reportStatus.value = 'ready' }
    catch (error) { setFailure(reportStatus, reportMessage, error, '报告快照暂时无法读取，页面不会显示估算数据。') }
  }

  async function loadReading(articleId?: number): Promise<void> {
    readingStatus.value = 'loading'; clearModuleError(readingMessage); readingDictionary.value = null; readingDictionaryMessage.value = null
    try {
      readingArticles.value = await listReadingArticles()
      const selectedId = articleId ?? readingArticles.value[0]?.articleId
      readingArticle.value = selectedId === undefined ? null : await getReadingArticle(selectedId)
      if (readingArticle.value) readingQuestions.value = await listReadingQuestions(readingArticle.value.articleId)
      if (readingArticle.value) { readingCached.value = false; applyReadingState(readingArticle.value); cache('reading', readingArticle.value); persistReadingState() }
      else { readingActiveBlock.value = 0; minedBlocks.value = new Set(); readingCached.value = false }
      readingStatus.value = readingArticle.value ? 'ready' : 'empty'
    } catch (error) {
      readingCached.value = markCached(readingArticle, 'reading')
      if (readingCached.value && readingArticle.value) { applyReadingState(readingArticle.value); readingStatus.value = 'offline'; try { readingQuestions.value = await listReadingQuestions(readingArticle.value.articleId) } catch { readingQuestions.value = [] } }
      else setFailure(readingStatus, readingMessage, error, '分级阅读内容暂时无法加载。')
    }
  }
  async function lookupReading(tokenId: string): Promise<void> {
    if (!readingArticle.value) return
    readingDictionaryMessage.value = null
    try { readingDictionary.value = await getReadingDictionary(readingArticle.value.articleId, tokenId, readingArticle.value.contentVersionId) }
    catch (error) { readingDictionary.value = null; readingDictionaryMessage.value = failureMessage(error, '查词暂时不可用。'); if (failureKind(error) === 'stale') { readingStatus.value = 'stale'; readingMessage.value = readingDictionaryMessage.value } }
  }
  async function saveCurrentReadingProgress(blockId: string, progressPercent: number, positionVersion: number): Promise<void> {
    if (!readingArticle.value) return
    const payload = { articleId: readingArticle.value.articleId, blockId, progressPercent, positionVersion, contentVersionId: readingArticle.value.contentVersionId }
    const blockIndex = readingArticle.value.blocks.findIndex((block) => block.blockId === blockId)
    if (blockIndex >= 0) readingActiveBlock.value = blockIndex
    persistReadingState()
    const key = createB10StableKey('reading-progress', payload.articleId, payload.contentVersionId, positionVersion, blockId)
    try { await saveReadingProgress(payload, key); readingStatus.value = readingStatus.value === 'offline' ? 'ready' : readingStatus.value; persistReadingState() }
    catch (error) {
      if (isB10OfflineError(error)) { enqueue('reading', 'READING_PROGRESS', payload as unknown as Record<string, unknown>, key); readingStatus.value = 'offline'; readingMessage.value = '阅读进度已安全排队，服务端确认前不会标记为已同步。' }
      else setFailure(readingStatus, readingMessage, error, '阅读进度保存失败，已保留当前阅读位置。')
    }
  }
  async function submitReadingQuestion(question: B10ReadingQuestion, answer: string): Promise<void> {
    if (!readingArticle.value || !answer) return
    readingAnswers.value[question.questionId] = answer
    const key = createB10StableKey('reading-quiz', question.questionId, question.contentVersionId, answer)
    try { readingResults.value[question.questionId] = await submitReadingQuiz(question.questionId, answer, question.contentVersionId, key) }
    catch (error) { setFailure(readingStatus, readingMessage, error, '阅读理解提交失败，已保留你的选择。') }
  }
  async function mineReading(blockId: string, selectedText?: string): Promise<void> {
    if (!readingArticle.value) return
    const block = readingArticle.value.blocks.find((item) => item.blockId === blockId)
    const text = selectedText?.trim() || block?.text.trim().slice(0, 500) || ''
    if (!text) { readingMessage.value = '请选择或定位要加入表达复习的文本。'; return }
    const key = createB10StableKey('reading-mining', readingArticle.value.articleId, readingArticle.value.contentVersionId, blockId, text)
    try { await createReadingMining(readingArticle.value.articleId, blockId, text, readingArticle.value.contentVersionId, key); minedBlocks.value = new Set([...minedBlocks.value, blockId]); persistReadingState() }
    catch (error) { setFailure(readingStatus, readingMessage, error, '表达复习保存失败，已保留当前阅读位置。') }
  }

  async function loadGrammar(): Promise<void> {
    grammarSelectionRequest += 1
    grammarStatus.value = 'loading'; clearModuleError(grammarMessage); grammarSentence.value = null; grammarSentenceFallback.value = false
    try {
      [grammarPoints.value, grammarExercises.value, grammarMastery.value] = await Promise.all([listGrammarPoints(), listGrammarExercises(), listGrammarMastery()])
      const savedPoint = grammarPoints.value.find((point) => point.grammarPointId === grammarDraft.value.selectedGrammarPointId)
      selectedGrammarPointId.value = savedPoint?.grammarPointId ?? grammarPoints.value[0]?.grammarPointId ?? null
      grammarDraft.value.selectedGrammarPointId = selectedGrammarPointId.value
      persistGrammarDraft()
      grammarStatus.value = grammarPoints.value.length ? 'ready' : 'empty'
      if (selectedGrammarPoint.value) await selectGrammarPoint(selectedGrammarPoint.value.grammarPointId)
    }
    catch (error) { setFailure(grammarStatus, grammarMessage, error, '语法知识树暂时无法加载。') }
  }
  async function selectGrammarPoint(grammarPointId: number): Promise<void> {
    const requestId = ++grammarSelectionRequest
    selectedGrammarPointId.value = grammarPointId; grammarDraft.value.selectedGrammarPointId = grammarPointId; persistGrammarDraft(); grammarFeedback.value = null; blockFeedback.value = null; imitationFeedback.value = null
    grammarSentence.value = null; grammarSentenceFallback.value = false
    const point = grammarPoints.value.find((item) => item.grammarPointId === grammarPointId)
    if (!point?.sentenceId) return
    try {
      const sentence = await getSentenceGraph(point.sentenceId)
      if (requestId !== grammarSelectionRequest || selectedGrammarPointId.value !== grammarPointId) return
      grammarSentence.value = sentence; grammarSentenceFallback.value = false
    }
    catch (error) {
      if (requestId !== grammarSelectionRequest || selectedGrammarPointId.value !== grammarPointId) return
      grammarSentence.value = null; grammarSentenceFallback.value = true; if (failureKind(error) === 'stale') { grammarStatus.value = 'stale'; grammarMessage.value = failureMessage(error, '句法结构版本已失效。') }
    }
  }
  async function submitGrammarExercise(exercise: B10GrammarExercise, answer: unknown): Promise<void> {
    const key = createB10StableKey('grammar-attempt', exercise.exerciseId, exercise.contentVersionId, JSON.stringify(answer))
    try { grammarFeedback.value = await submitGrammarAttempt(exercise.exerciseId, answer, exercise.contentVersionId, key) }
    catch (error) { setFailure(grammarStatus, grammarMessage, error, '语法练习提交失败，已保留当前答案。') }
  }
  async function submitSentenceOrder(blockOrder: string[]): Promise<void> {
    if (!grammarSentence.value) return
    const key = createB10StableKey('sentence-order', grammarSentence.value.sentenceId, grammarSentence.value.contentVersionId, blockOrder.join(','))
    try { blockFeedback.value = await submitSentenceBlocks(grammarSentence.value.sentenceId, blockOrder, grammarSentence.value.contentVersionId, key) }
    catch (error) { setFailure(grammarStatus, grammarMessage, error, '句子结构提交失败，已保留当前顺序。') }
  }
  async function submitImitation(slotValues: Record<string, string>): Promise<void> {
    if (!grammarSentence.value) return
    const key = createB10StableKey('sentence-imitation', grammarSentence.value.sentenceId, grammarSentence.value.contentVersionId, JSON.stringify(slotValues))
    try { imitationFeedback.value = await submitSentenceImitation(grammarSentence.value.sentenceId, slotValues, grammarSentence.value.contentVersionId, key) }
    catch (error) { setFailure(grammarStatus, grammarMessage, error, '仿写提交失败，草稿仍保留在当前页面。') }
  }

  async function loadWriting(): Promise<void> {
    writingStatus.value = 'loading'; clearModuleError(writingMessage); writingFeedback.value = null; proofreadingFeedback.value = null
    try { [writingPrompts.value, writingTemplates.value, writingMaterials.value, proofreadingExercises.value, writingHistory.value] = await Promise.all([listWritingPrompts(), listWritingTemplates(), listWritingMaterials(), listProofreadingExercises(), listWritingHistory()]); writingStatus.value = writingPrompts.value.length ? 'ready' : 'empty' }
    catch (error) { setFailure(writingStatus, writingMessage, error, '规则写作内容暂时无法加载。') }
  }
  function saveWritingDraft(value: string): void { writingDraft.value = value; writeStorage(DRAFT_KEY, value) }
  async function submitCurrentWriting(): Promise<void> {
    const prompt = writingPrompts.value[0]
    if (!prompt || !writingDraft.value.trim() || writingSubmitting.value) return
    writingSubmitting.value = true; writingStatus.value = 'recovering'; writingMessage.value = null
    const key = createB10StableKey('writing-submit', prompt.promptId, prompt.contentVersionId, writingDraft.value.trim())
    try { writingFeedback.value = await submitWriting(prompt.promptId, writingDraft.value, prompt.contentVersionId, key); writingStatus.value = 'ready' }
    catch (error) { setFailure(writingStatus, writingMessage, error, '规则写作提交失败，草稿仍保留在本地。') }
    finally { writingSubmitting.value = false }
  }
  async function submitCurrentProofreading(answer: string): Promise<void> {
    const issue = proofreadingExercises.value[0]
    if (!issue || !answer.trim()) return
    const key = createB10StableKey('proofreading-submit', issue.promptId, issue.contentVersionId, answer.trim())
    try { proofreadingFeedback.value = await submitProofreading(issue.promptId, answer, issue.contentVersionId, key) }
    catch (error) { setFailure(writingStatus, writingMessage, error, '病句改错提交失败，已保留当前答案。') }
  }

  return {
    performanceLevel, online, vocabularyStatus, vocabularyMessage, cards, cardIndex, cardPhase, currentCard, vocabularyCached,
    practiceStatus, practiceMessage, practice, currentQuestion, practiceFeedback, practiceSubmitting, setPracticeAnswer, practiceAnswer,
    reportStatus, reportMessage, report, reportWeaknesses,
    readingStatus, readingMessage, readingArticle, readingArticles, readingQuestions, readingAnswers, readingResults, readingActiveBlock, readingDictionary, readingDictionaryMessage, minedBlocks, readingCached,
    grammarStatus, grammarMessage, grammarPoints, grammarExercises, selectedGrammarPointId, selectedGrammarPoint, selectedGrammarExercises, grammarMastery, grammarSentence, grammarSentenceFallback, grammarFeedback, imitationFeedback, blockFeedback,
    writingStatus, writingMessage, writingPrompts, writingTemplates, writingMaterials, proofreadingExercises, writingHistory, writingFeedback, proofreadingFeedback, writingDraft, writingSubmitting,
    offlineQueue, queueCount, restore, setPerformanceLevel, loadVocabulary, revealCard, rateCard, syncOffline, startPractice, loadPractice, submitCurrentAnswer, saveCheckpoint, nextPractice, loadReport, loadReading, lookupReading, setReadingBlock, saveCurrentReadingProgress, submitReadingQuestion, mineReading, loadGrammar, selectGrammarPoint, grammarBlockOrder, saveGrammarBlockOrder, grammarImitationSlots, saveGrammarImitationSlots, grammarExerciseAnswer, saveGrammarExerciseAnswer, submitGrammarExercise, submitSentenceOrder, submitImitation, loadWriting, saveWritingDraft, submitCurrentWriting, submitCurrentProofreading,
    dispose: () => { unsubscribePerformance(); /* Shared engine lives for the application lifetime. */ },
  }
})
