export const B2_STORAGE_KEY = 'yx.b2.learner-web.v1'
export const B2_QUEUE_KEY = 'yx.b2.review-queue.v1'
import { createClientId } from '../platform/client-id'

export type ItemType = 'VOCAB' | 'CHUNK' | 'EXPRESSION'
export type PerformanceLevel = 'Ultra' | 'High' | 'Medium' | 'Performance'
export type ReviewQuality = 0 | 1 | 2 | 3
export type MasteryStatus = 'NEW' | 'LEARNING' | 'SHORT_TERM' | 'CONSOLIDATING' | 'MASTERED' | 'CONSOLIDATED' | 'AT_RISK' | 'SUSPENDED'
export type DelayedVerifyStage = 'NONE' | 'D1_PENDING' | 'D7_PENDING' | 'PASSED' | 'FAILED'
export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'
export type B2ViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error'
export type CardPhase = 'FRONT' | 'REVEALING' | 'BACK' | 'RATING' | 'SUBMITTING' | 'SYNCED' | 'PENDING_SYNC' | 'ERROR_RETRY' | 'PAUSED' | 'ABANDONED'

export type LearningItemRef =
  | { itemType: 'VOCAB'; vocabId: number }
  | { itemType: 'CHUNK'; chunkId: number }
  | { itemType: 'EXPRESSION'; expressionId: number }

export interface SrsSummary {
  srsStateId: number | null
  stateVersion: number
  masteryStatus: MasteryStatus
  delayedVerifyStage: DelayedVerifyStage
  riskBand: RiskBand
  dueLocalDate: string | null
  nextReviewLocalDate: string | null
  reviewCount: number
  consecutiveCorrect: number
  explanation: string | null
}

export interface VocabularyCardFront {
  id: string
  snapshotId: number | null
  snapshotItemId: number | null
  item: LearningItemRef
  title: string
  phoneticUs: string | null
  phoneticUk: string | null
  audioUsNormal: string | null
  audioUkNormal: string | null
  frontHint: string | null
  contentVersion: string | null
  position: number
  total: number
  srs: SrsSummary | null
}

export interface VocabularyCardBack {
  meaningCn: string | null
  definitionEn: string | null
  partOfSpeech: string | null
  examples: Array<{ sentence: string; translation: string | null }>
  collocations: string[]
  rootSummary: string | null
  answerAvailable: boolean
}

export interface VocabularyCard extends VocabularyCardFront {
  back: VocabularyCardBack | null
}

export interface ReviewEventInput {
  snapshotId: number
  snapshotItemId: number
  item: LearningItemRef
  rawQuality: ReviewQuality
  answerOutcome: 'CORRECT' | 'INCORRECT' | 'UNANSWERED' | 'REVEALED_WITHOUT_ANSWER'
  responseTimeMs: number
  revealElapsedMs: number
  clientEventId: string
  clientOccurredAt: string
  baseStateVersion: number | null
}

export interface ReviewResult {
  status: 'ACCEPTED' | 'DUPLICATE' | 'RISK_FILTERED' | 'CONFLICT' | 'PENDING_SYNC' | 'REJECTED'
  reviewEventId: number | null
  effectiveQuality: ReviewQuality | null
  masteryStatus: MasteryStatus | null
  delayedVerifyStage: DelayedVerifyStage | null
  nextReviewLocalDate: string | null
  explanation: string | null
}

export interface OfflineQueueItem {
  id: string
  event: ReviewEventInput
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'EXPIRED'
  attemptCount: number
  nextRetryAt: string | null
  lastError: string | null
}

export interface ContinueContext {
  moduleType: 'FLASHCARD' | 'VOCAB_DETAIL' | 'CHUNK_REVIEW' | 'EXPRESSION_REVIEW' | 'PRACTICE'
  sessionId: string | null
  snapshotId: number | null
  snapshotItemId: number | null
  stepIndex: number
  totalSteps: number
  elapsedTimeMs: number
  pendingEventCount: number
  updatedAt: string
}

export type PracticeQuestionType = 'CHOICE' | 'FILL_BLANK' | 'DRAG_SORTER' | 'LISTEN' | 'TRANSLATION'

export interface PracticeQuestionBase {
  id: string
  type: PracticeQuestionType
  prompt: string
  helperText: string | null
  explanation: string | null
  item: LearningItemRef | null
}

export interface ChoiceQuestion extends PracticeQuestionBase {
  type: 'CHOICE'
  options: Array<{ key: string; text: string }>
}

export interface FillBlankQuestion extends PracticeQuestionBase {
  type: 'FILL_BLANK'
  sentence: string
  options: Array<{ key: string; text: string }>
  placeholder: string
}

export interface DragSorterQuestion extends PracticeQuestionBase {
  type: 'DRAG_SORTER'
  tokens: Array<{ tokenId: string; text: string }>
}

export interface ListenQuestion extends PracticeQuestionBase {
  type: 'LISTEN'
  audioUrl: string | null
  options: Array<{ key: string; text: string }>
  transcript: string | null
}

export interface TranslationQuestion extends PracticeQuestionBase {
  type: 'TRANSLATION'
  sourceText: string
  placeholder: string
}

export type PracticeQuestion = ChoiceQuestion | FillBlankQuestion | DragSorterQuestion | ListenQuestion | TranslationQuestion

export interface ImmediateFeedback {
  correct: boolean | null
  title: string
  message: string
  errorCategory: string | null
  nextAction: 'NEXT' | 'RETRY' | 'REVIEW'
}

export interface PracticeSession {
  sessionId: string
  sessionType: 'DAILY' | 'QUICK' | 'CHECKPOINT'
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'INTERRUPTED' | 'EXPIRED'
  questions: PracticeQuestion[]
  currentIndex: number
  checkpointSeq: number
  answerRevision: number
  serverNow: string | null
}

export interface LearningReport {
  reportId: string
  reportType: 'DAILY' | 'WEEKLY' | 'EXAM'
  generatedAt: string
  calculationVersion: string | null
  studyMinutes: number | null
  newItems: number | null
  reviewItems: number | null
  accuracy: number | null
  xp: number | null
  streakDays: number | null
  masteredIncrement: number | null
  forgettingRate: number | null
  d1Pending: number | null
  d7Pending: number | null
  weakness: Array<{ label: string; value: number; evidence: string | null }>
}

export interface B2StateSnapshot {
  performanceLevel: 'Ultra' | 'High' | 'Medium' | 'Performance'
  cardPhase: CardPhase
  currentCardId: string | null
  currentSnapshotItemId: number | null
  continueContext: ContinueContext | null
  queue: OfflineQueueItem[]
}

export function createEmptySrsSummary(): SrsSummary {
  return { srsStateId: null, stateVersion: 0, masteryStatus: 'NEW', delayedVerifyStage: 'NONE', riskBand: 'UNKNOWN', dueLocalDate: null, nextReviewLocalDate: null, reviewCount: 0, consecutiveCorrect: 0, explanation: null }
}

export function createEmptyContinueContext(): ContinueContext {
  return { moduleType: 'FLASHCARD', sessionId: null, snapshotId: null, snapshotItemId: null, stepIndex: 0, totalSteps: 0, elapsedTimeMs: 0, pendingEventCount: 0, updatedAt: new Date(0).toISOString() }
}

export function createClientEventId(prefix = 'b2'): string {
  return createClientId(prefix)
}

export function masteryLabel(status: MasteryStatus): string {
  const labels: Record<MasteryStatus, string> = { NEW: '新', LEARNING: '学习中', SHORT_TERM: '短期稳固', CONSOLIDATING: '巩固中', MASTERED: '已掌握', CONSOLIDATED: '长期稳固', AT_RISK: '即将遗忘', SUSPENDED: '已暂停' }
  return labels[status]
}

export function delayedVerifyLabel(stage: DelayedVerifyStage): string {
  const labels: Record<DelayedVerifyStage, string> = { NONE: '暂无延迟复测', D1_PENDING: '等待 D+1 复测', D7_PENDING: '等待 D+7 复测', PASSED: '延迟复测通过', FAILED: '延迟复测未通过' }
  return labels[stage]
}
