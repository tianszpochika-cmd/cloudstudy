export const B10_PERFORMANCE_LEVELS = ['Ultra', 'High', 'Medium', 'Performance'] as const
export type B10PerformanceLevel = (typeof B10_PERFORMANCE_LEVELS)[number]

export type B10Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'

export interface B10RequestContext {
  uiLocale: string
  contentLocale: string
}

export interface B10ContentVersionContext {
  contentVersionId: number | null
  contentEpoch: number
  projectionVersion: number
  contentLocale: string
}

export type B10ItemType = 'VOCAB' | 'PHRASE' | 'EXPRESSION'
export type B10MasteryStatus = 'NEW' | 'LEARNING' | 'MASTERED' | 'CONSOLIDATED'

export interface B10SrsCard {
  id: string
  snapshotId: number | null
  snapshotItemId: number
  sequenceNo: number
  itemType: B10ItemType
  itemId: number | string
  title: string
  sourceReason: string
  contentVersion: string | null
  contentVersionId: number | null
  phonetic: string | null
  audioUrl?: string | null
  hint: string | null
  meaningCn: string | null
  definitionEn: string | null
  examples: string[]
  masteryStatus: B10MasteryStatus | null
  dueLocalDate: string | null
  stateVersion: number
  revealed: boolean
  reviewStatus: 'PENDING' | 'SUBMITTING' | 'ACCEPTED' | 'QUEUED' | 'STALE' | 'FAILED'
}

export interface B10SrsBatch {
  snapshotId: number | null
  localDate: string
  timezone: string
  status: string
  algorithmVersion: string | null
  rulesVersion: string | null
  contentEpoch: number
  items: B10SrsCard[]
}

export type B10QuestionType = 'CHOICE' | 'CONNECT_LINE' | 'DRAG_SORTER' | 'FILL_BLANK' | 'SPELL_INPUT' | 'LISTEN_CHOICE' | 'ERROR_CORRECTION' | 'TRANSLATION_INPUT'

export interface B10Exercise {
  sessionId: string
  exerciseId: number
  questionId: number
  itemId: number | null
  questionType: B10QuestionType
  position: number
  prompt: string
  sourceText: string | null
  options: Array<{ key: string; text: string }>
  tokens: Array<{ tokenId: string; text: string }>
  blankIds: string[]
  sourceBucket: 'NEW' | 'REVIEW' | 'MISTAKE' | 'EXAM' | null
  verificationStage: 'D0' | 'D1' | 'D7' | null
  feedbackPolicy: 'IMMEDIATE' | 'AFTER_SUBMIT' | 'PENDING_MANUAL'
  contentVersionId: number | null
  ruleVersion: string | null
}

export interface B10AssessmentSession {
  sessionId: string
  sessionType: string
  status: string
  serverNow: string | null
  deadlineAt: string | null
  remainingSec: number | null
  lastCheckpointSeq: number
  exercises: B10Exercise[]
  answerSheet: Array<{ exerciseId: number; saved: boolean; revision: number }>
  contentEpoch: number
  degraded: boolean
  stateVersion: number
  lastAttemptId: string | null
  reportId: string | null
  resumeIndex?: number | null
  resumeCopy?: string | null
  contentOffline?: boolean
  exitCopy?: string | null
}

export interface B10AnswerResult {
  requestId: string | null
  exerciseId: number
  accepted: boolean
  revision: number | null
  scoringStatus: 'SCORED' | 'PENDING_MANUAL' | 'REJECTED' | 'LATE' | 'ACCEPTED'
  isCorrect: boolean | null
  score: number | null
  maxScore: number | null
  errorCauseCandidates: string[]
  masteryEffect: string | null
  deduplicated: boolean
  contentVersionStale: boolean
  attemptId?: string | null
  reportId?: string | null
  savedReceipt?: string | null
  feedbackText?: string | null
  nextQuestion?: string | null
  scoreBucket?: string | null
}

export type B10AnswerInput =
  | { selectedOptionKeys: string[] }
  | { blanks: Array<{ blankId: string; text: string }> }
  | { orderedTokenIds: string[] }
  | { pairs: Array<{ leftId: string; rightId: string }> }
  | { text: string }

export interface B10Mistake {
  mistakeId: number
  itemId: number
  questionId: number | null
  mistakeStatus: 'PENDING_RETRY' | 'DELAY_VERIFY_D1' | 'DELAY_VERIFY_D7' | 'MASTERED' | 'REOPENED'
  masteryStatus: B10MasteryStatus
  errorCategory: string
  reasonTrace: Array<{ code: string; label: string; evidence?: string }>
  prompt: string | null
  questionType: B10QuestionType | null
  contentVersionId: number | null
  verificationId: number | null
  remediationId?: number | null
  closureCopy?: string | null
  variantStatus?: string | null
}

export interface B10Verification {
  verificationId: number
  mistakeId: number
  stage: 'D0' | 'D1' | 'D7'
  result: 'PENDING' | 'PASSED' | 'FAILED' | 'NOT_DUE' | 'EXPIRED'
  dueAt: string
  score: number | null
  maxScore: number | null
  nextState: string | null
  remediationId?: number | null
}

export interface B10Report {
  reportId: number | string
  reportType: 'EXAM_DIAGNOSTIC' | 'DAILY' | 'WEEKLY'
  status: 'GENERATING' | 'READY' | 'PARTIAL' | 'FAILED'
  score: number | null
  reportedMaxScore: number | null
  percentile: number | null
  calculationVersion: string
  metrics: Array<{ code: string; label: string; value: number; max?: number }>
  evidence: Array<{ exerciseId?: number; mistakeId?: number; label: string; detail: string }>
  explanation: string[]
}

export interface B10GrammarPoint {
  grammarPointId: number
  code: string
  title: string
  ruleFormula: string
  meaningCn: string
  cefrLevel: string
  trapTags: string[]
  prerequisites: number[]
  sentenceId: number | null
  masteryPercent: number | null
  contentVersionId: number | null
}

export interface B10SyntaxSlice {
  sliceId: string
  sliceCode: string
  role: string
  text: string
  startToken: number
  endToken: number
}

export interface B10SyntaxGraph {
  sentenceId: number
  text: string
  translation: string | null
  nodes: Array<{ nodeId: string; role: string; text: string }>
  edges: Array<{ fromNodeId: string; toNodeId: string; relation: string }>
  slices: B10SyntaxSlice[]
  blockOrder: string[]
  imitationSlots: Record<string, string>
  contentVersionId: number | null
  graphStatus: 'READY' | 'DEGRADED' | 'FAILED'
}

export interface B10RuleFeedback {
  accepted: boolean
  correct: boolean | null
  score: number | null
  ruleVersion: string | null
  feedbackCode: string | null
  errorCauses: string[]
  evidence: Array<{ label: string; sourceText?: string; explanation: string }>
  nextAction: string | null
  aiScoringAvailable: false
  deduplicated: boolean
  contentVersionStale: boolean
  savedReceipt?: string | null
  feedbackText?: string | null
  nextQuestion?: string | null
  scoreBucket?: string | null
}

export interface B10ReadingArticle {
  articleId: number
  title: string
  cefrLevel: string
  wordCount: number
  estimatedMinutes: number
  blocks: Array<{ blockId: string; blockIndex: number; text: string; translation: string | null }>
  rightsStatus: 'AUTHORIZED' | 'REVOKED'
  contentVersionId: number | null
  contentEpoch: number
}

export interface B10ReadingQuestion {
  questionId: number
  articleId: number
  questionType: 'MAIN_IDEA' | 'DETAIL' | 'INFERENCE' | 'VOCABULARY'
  stemText: string
  options: Array<{ optionCode: string; label: string }>
  contentVersionId: number | null
}

export interface B10ReadingAttempt {
  attemptId: number | null
  questionId: number
  correct: boolean | null
  score: number | null
  feedbackCode: string | null
  reviewSignal: string | null
  ruleVersion: string | null
  contentVersionStale: boolean
}

export interface B10WritingPrompt {
  promptId: number
  promptType: 'TRANSLATION' | 'CORRECTION' | 'ESSAY' | 'LETTER'
  title: string
  taskText: string
  sourceText: string | null
  targetStructure: string[]
  contentVersionId: number | null
  ruleVersion: string | null
}

export interface B10Draft {
  promptId: number
  text: string
  revision: number
  savedAt: string | null
  pendingSync: boolean
}

export function isB10Status(value: unknown): value is B10Status {
  return value === 'idle' || value === 'loading' || value === 'ready' || value === 'empty' || value === 'offline' || value === 'forbidden' || value === 'stale' || value === 'error'
}
