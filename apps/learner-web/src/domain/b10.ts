import { createClientId } from '../platform/client-id'

export type B10Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error' | 'forbidden' | 'stale' | 'recovering'
export type B10PerformanceLevel = 'Ultra' | 'High' | 'Medium' | 'Performance'
export type B10Module = 'vocabulary' | 'practice' | 'reading' | 'grammar' | 'writing' | 'report'
export type B10ReviewQuality = 0 | 1 | 2 | 3
export type B10CardPhase = 'FRONT' | 'REVEALING' | 'BACK' | 'SUBMITTING' | 'PENDING_SYNC' | 'SYNCED' | 'ERROR_RETRY'
export type B10QuestionType = 'CHOICE' | 'FILL_BLANK' | 'DRAG_SORTER' | 'TRANSLATION'

export interface B10SrsSummary {
  stateVersion: number
  masteryStatus: string
  delayedVerifyStage: string
  riskBand: string
  dueLocalDate: string | null
  nextReviewLocalDate: string | null
  reviewCount: number
  consecutiveCorrect: number
}

export interface B10VocabularyBack {
  meaningCn: string | null
  definitionEn: string | null
  partOfSpeech: string | null
  examples: Array<{ sentence: string; translation: string | null }>
  collocations: string[]
  rootSummary: string | null
}

export interface B10VocabularyCard {
  id: string
  itemType: 'VOCAB' | 'CHUNK' | 'EXPRESSION'
  itemId: number | string
  snapshotId: number | string | null
  snapshotItemId: number | string | null
  title: string
  phoneticUs: string | null
  phoneticUk: string | null
  frontHint: string | null
  contentVersionId: number | null
  contentLocale: string
  position: number
  total: number
  srs: B10SrsSummary | null
  back: B10VocabularyBack | null
}

export interface B10ReviewEvent {
  snapshotId: number | string
  snapshotItemId: number | string
  itemType: B10VocabularyCard['itemType']
  itemId: number | string
  contentVersionId: number
  rawQuality: B10ReviewQuality
  answerOutcome: 'CORRECT' | 'INCORRECT' | 'UNANSWERED' | 'REVEALED_WITHOUT_ANSWER'
  responseTimeMs: number
  revealElapsedMs: number
  clientEventId: string
  clientSeq: number
  clientOccurredAt: string
  baseStateVersion: number
}

export interface B10ReviewResult {
  status: 'ACCEPTED' | 'DUPLICATE' | 'RISK_FILTERED' | 'CONFLICT' | 'PENDING_SYNC' | 'REJECTED'
  effectiveQuality: B10ReviewQuality | null
  masteryStatus: string | null
  delayedVerifyStage: string | null
  nextReviewLocalDate: string | null
  feedbackCode: string | null
}

export interface B10PracticeOption { key: string; text: string }
export interface B10PracticeToken { tokenId: string; text: string }

export interface B10PracticeQuestion {
  id: string
  type: B10QuestionType
  prompt: string
  helperText: string | null
  sentence: string | null
  sourceText: string | null
  placeholder: string | null
  options: B10PracticeOption[]
  tokens: B10PracticeToken[]
  contentVersionId: number | null
  contentLocale: string
}

export interface B10PracticeSession {
  sessionId: string
  sessionType: 'DAILY' | 'QUICK' | 'CHECKPOINT'
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'INTERRUPTED' | 'AUTO_SUBMITTED' | 'EXPIRED'
  questions: B10PracticeQuestion[]
  currentIndex: number
  checkpointSeq: number
  answerRevision: number
  contentVersionId: number | null
  stateVersion: number
  lastAttemptId: string | null
  reportId: string | null
}

export interface B10Feedback {
  correct: boolean | null
  feedbackCode: string | null
  message: string | null
  errorCategory: string | null
  ruleVersion: string | null
  nextAction: 'NEXT' | 'RETRY' | 'REVIEW' | null
  evidence: string | null
  attemptId?: string | number | null
  reportId?: string | null
  savedReceipt?: string | null
  feedbackText?: string | null
  nextQuestion?: string | null
  scoreBucket?: string | null
}

export interface B10ReportWeakness {
  label: string
  value: number
  evidence: string | null
  nextAction: string | null
}

export interface B10Report {
  reportId: string
  reportType: 'DAILY' | 'WEEKLY' | 'EXAM'
  generatedAt: string
  calculationVersion: string | null
  studyMinutes: number | null
  newItems: number | null
  reviewItems: number | null
  accuracy: number | null
  masteredIncrement: number | null
  forgettingRate: number | null
  d1Pending: number | null
  d7Pending: number | null
  weakness: B10ReportWeakness[]
}

export interface B10ReadingBlock {
  blockId: string
  blockIndex: number
  text: string
  translation: string | null
  tokens: Array<{ tokenId: string; text: string }>
}

export interface B10ReadingArticle {
  articleId: number
  title: string
  cefrLevel: string
  wordCount: number
  estimatedMinutes: number
  rightsStatus: 'AUTHORIZED' | 'REVOKED'
  contentVersionId: number
  contentLocale: string
  blocks: B10ReadingBlock[]
}

export interface B10DictionaryEntry {
  tokenId: string
  lemma: string
  partOfSpeech: string | null
  meaningCn: string
  exampleText: string | null
  contentVersionId: number | null
}

export interface B10PracticeRef {
  contentCode: string
  contentVersionId: number
  questionItemId: string
}

export interface B10ReadingQuestion {
  questionId: number
  articleId: number
  questionType: 'MAIN_IDEA' | 'DETAIL' | 'INFERENCE' | 'VOCABULARY'
  stemText: string
  options: B10PracticeOption[]
  contentVersionId: number
  practiceRef?: B10PracticeRef
}

export interface B10ReadingAttemptResult extends B10Feedback {
  attemptId: number
  questionId: number
  score: number | null
  reviewSignal: string | null
}

export interface B10GrammarPoint {
  grammarPointId: number
  code: string
  title: string
  ruleSummary: string | null
  meaningCn: string | null
  cefrLevel: string | null
  trapTags: string[]
  contentVersionId: number
  sentenceId: number | null
}

export interface B10GrammarExercise {
  exerciseId: number
  grammarPointId: number | null
  type: 'FILL_BLANK' | 'CHOICE' | 'SENTENCE_BUILD' | 'PARAPHRASE' | 'CORRECTION'
  promptText: string
  options: B10PracticeOption[]
  tokens: B10PracticeToken[]
  contentVersionId: number
  contentLocale: string
  practiceRef?: B10PracticeRef
}

export interface B10GrammarMastery {
  grammarPointId: number
  dimensions: Record<string, number>
  overall: number
  level: 'REVIEW' | 'DEVELOPING' | 'MASTERED'
}

export interface B10SyntaxNode { nodeId: string; role: string; text: string; startToken: number; endToken: number }
export interface B10SyntaxEdge { fromNodeId: string; toNodeId: string; relation: string }
export interface B10SentenceGraph {
  sentenceId: number
  text: string
  translation: string | null
  contentVersionId: number
  nodes: B10SyntaxNode[]
  edges: B10SyntaxEdge[]
  blockOrder: string[]
  imitationSlots: Record<string, string>
}

export interface B10WritingPrompt {
  promptId: number
  promptType: string
  title: string
  taskText: string
  targetStructure: string[]
  contentVersionId: number
  contentLocale: string
}

export interface B10WritingTemplate {
  templateId: number
  title: string
  structure: Array<{ slotCode: string; label: string; required: boolean }>
  contentVersionId: number
}

export interface B10WritingMaterial {
  materialId: number
  title: string
  bodyText: string
  contentVersionId: number
}

export interface B10ProofreadingIssue {
  issueId: number
  promptId: number
  errorType: string
  wrongText: string
  contentVersionId: number
}

export interface B10WritingFeedbackItem {
  code: string
  feedbackCode: string
  message: string | null
  evidence: string | null
  score: number | null
}

export interface B10WritingFeedback extends B10Feedback {
  submissionId: number
  promptId: number
  score: number | null
  band: string | null
  items: B10WritingFeedbackItem[]
}

export interface B10WritingHistoryItem extends B10WritingFeedback {
  submittedAt: string | null
  promptTitle: string | null
}

export interface B10OfflineAction {
  id: string
  module: 'vocabulary' | 'reading'
  kind: 'SRS_REVIEW' | 'READING_PROGRESS'
  clientSeq: number
  payload: Record<string, unknown>
  createdAt: string
  status: 'PENDING' | 'SYNCING' | 'FAILED'
  lastError: string | null
}

export function createB10ClientId(prefix = 'b10'): string {
  return createClientId(prefix)
}

export function createB10StableKey(...parts: Array<string | number>): string {
  let hash = 2166136261
  const value = parts.join('|')
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `b10-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function isB10PerformanceLevel(value: unknown): value is B10PerformanceLevel {
  return value === 'Ultra' || value === 'High' || value === 'Medium' || value === 'Performance'
}
