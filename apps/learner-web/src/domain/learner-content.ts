import type {
  AssessmentReport,
  AssessmentSkipBaseline,
  AssessmentSnapshot,
  ContinueContext,
  DailyQuotaMinutes,
  DailyTask,
  HomeSnapshot,
  OnboardingProfile,
  PlacementQuestion,
  SubTag,
  TargetGoal,
} from './b1'

export type ReadModelStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'forbidden'
  | 'content-unavailable'
  | 'error'

export type ReadModelSource = 'remote' | 'cache' | 'local'
export type ReadModelErrorCode = 'NETWORK' | 'FORBIDDEN' | 'CONTENT_UNAVAILABLE' | 'UNAVAILABLE' | 'INVALID' | 'UNKNOWN'

export interface LearnerGoalOption {
  value: TargetGoal
  label: string
  description: string
}

export interface ContentProjection {
  contentId: string
  contentVersionId: string | null
  kind: string
  title: string
  description: string
  contentLocale: string
  status: 'PUBLISHED' | 'UNAVAILABLE' | 'WITHDRAWN'
}

export interface LearnerContentDetail {
  contentId: string
  contentVersionId: string | null
  kind: string
  title: string
  description: string
  contentLocale: string
  items: readonly {
    itemId: string
    itemType: string
    text: string
    options: readonly { key: string; text: string }[]
  }[]
}

export interface LearnerOnboardingReadModel {
  profile: OnboardingProfile
  goals: readonly LearnerGoalOption[]
  quotas: readonly DailyQuotaMinutes[]
  contentLocale: string
  revision: string | null
}

export interface PlacementFormalReport {
  reportId: string
  fullCount: number | null
  zeroCount: number | null
  itemCount: number | null
}

export interface PlacementReadModel {
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'EMPTY'
  sessionId: string | null
  currentQuestion: PlacementQuestion | null
  report: AssessmentReport | null
  /** Present when the server already stored a report id. Counts stay null if the server did not send them. */
  formalReport: PlacementFormalReport | null
  /** Set only from a submit receipt. Never inferred, and never a correct option. */
  responseOutcome: 'FULL' | 'ZERO' | null
  skipBaseline: AssessmentSkipBaseline | null
  contentVersionId: string | null
  contentLocale: string
  stateVersion: number | null
  acceptedSequence: number
  nextSequence: number | null
}

export interface LearnerHomeReadModel {
  home: HomeSnapshot | null
  today: HomeSnapshot | null
  continueContext: ContinueContext | null
  content: readonly ContentProjection[]
  contentStatus: 'READY' | 'EMPTY' | 'UNAVAILABLE'
  contentLocale: string
  revision: string | null
  plan?: {
    planId: string
    taskCount: number
    tasks: { itemId: string; taskType: string; status: string }[]
  } | null
}

export interface PlacementAnswerInput {
  sessionId: string
  questionId: string
  selectedKey: string
  timeSpentSec: number
  contentLocale: string
  stateVersion?: number | null
  itemId?: number | null
  itemSequence?: number | null
  idempotencyKey?: string
}

export interface PlacementSubmitResult {
  isCompleted: boolean
  nextQuestion: PlacementQuestion | null
  report: AssessmentReport | null
  formalReport?: PlacementFormalReport | null
  /** Present only when this attempt's receipt said FULL or ZERO. Absent means no grade was returned. */
  responseOutcome?: 'FULL' | 'ZERO' | null
  skipBaseline?: AssessmentSkipBaseline | null
  /** False when a 409 was reconciled to the server checkpoint without a receipt for this attempt. */
  accepted?: boolean
  stateVersion?: number | null
  acceptedSequence?: number | null
  nextSequence?: number | null
  sessionId?: string | null
}

export interface SaveOnboardingInput {
  profile: OnboardingProfile
  clientEventId: string
  /** IAM already records the required learning consents, so this write is only the target. */
  consentsRecorded?: boolean
}

export interface OnboardingResumeRead {
  adultGate: string
  consent: { readable: boolean; accepted: boolean | null; unsatisfiedPurposes: readonly string[] }
  target: { readable: boolean; saved: boolean; goal: string | null; quota: number | null }
}

export interface ReadModelErrorShape {
  code: ReadModelErrorCode
  status: number
  retryable: boolean
  message: string
}

export class LearnerContentReadModelError extends Error implements ReadModelErrorShape {
  readonly code: ReadModelErrorCode
  readonly status: number
  readonly retryable: boolean

  constructor(shape: ReadModelErrorShape) {
    super(shape.message)
    this.name = 'LearnerContentReadModelError'
    this.code = shape.code
    this.status = shape.status
    this.retryable = shape.retryable
  }
}

export interface LearnerContentPort {
  readOnboarding(contentLocale: string): Promise<LearnerOnboardingReadModel>
  readOnboardingResume(): Promise<OnboardingResumeRead>
  recordRequiredConsents(clientEventId: string): Promise<void>
  saveOnboarding(input: SaveOnboardingInput): Promise<LearnerOnboardingReadModel | null>
  readContent(contentId: string): Promise<LearnerContentDetail>
  readPlacement(input: { contentLocale: string; sessionId?: string | null }): Promise<PlacementReadModel>
  startPlacement(input: { contentLocale: string; clientEventId: string }): Promise<PlacementReadModel>
  submitPlacementAnswer(input: PlacementAnswerInput): Promise<PlacementSubmitResult>
  skipPlacement(input: { fastTrackLevel: string; sessionId?: string | null; contentLocale: string; clientEventId: string }): Promise<PlacementSubmitResult | null>
  retestPlacement(input: { sessionId: string; contentLocale: string; clientEventId: string }): Promise<PlacementReadModel>
  readHome(contentLocale: string): Promise<LearnerHomeReadModel>
  readToday(contentLocale: string): Promise<LearnerHomeReadModel>
  completeTask(input: { taskId: string; contentLocale: string; clientEventId: string }): Promise<LearnerHomeReadModel | null>
}

export interface LearnerContentPersistedState {
  onboarding: OnboardingProfile
  assessment: AssessmentSnapshot
  home: LearnerHomeReadModel | null
  today: HomeSnapshot | null
  pendingAssessmentAnswers: PlacementAnswerInput[]
  pendingTaskIds: string[]
}

export interface LearnerContentSnapshot {
  onboarding: OnboardingProfile
  assessment: AssessmentSnapshot
  home: LearnerHomeReadModel | null
  today: HomeSnapshot | null
  pendingAssessmentAnswers: readonly PlacementAnswerInput[]
  pendingTaskIds: readonly string[]
}

export type LearnerContentSubTag = SubTag
export type LearnerContentTask = DailyTask
