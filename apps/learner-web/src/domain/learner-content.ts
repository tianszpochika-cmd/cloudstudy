import type {
  AssessmentReport,
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

export interface LearnerOnboardingReadModel {
  profile: OnboardingProfile
  goals: readonly LearnerGoalOption[]
  quotas: readonly DailyQuotaMinutes[]
  contentLocale: string
  revision: string | null
}

export interface PlacementReadModel {
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EMPTY'
  sessionId: string | null
  currentQuestion: PlacementQuestion | null
  report: AssessmentReport | null
  contentVersionId: string | null
  contentLocale: string
}

export interface LearnerHomeReadModel {
  home: HomeSnapshot | null
  today: HomeSnapshot | null
  continueContext: ContinueContext | null
  content: readonly ContentProjection[]
  contentStatus: 'READY' | 'EMPTY' | 'UNAVAILABLE'
  contentLocale: string
  revision: string | null
}

export interface PlacementAnswerInput {
  sessionId: string
  questionId: string
  selectedKey: string
  timeSpentSec: number
  contentLocale: string
}

export interface PlacementSubmitResult {
  isCompleted: boolean
  nextQuestion: PlacementQuestion | null
  report: AssessmentReport | null
}

export interface SaveOnboardingInput {
  profile: OnboardingProfile
  clientEventId: string
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
  saveOnboarding(input: SaveOnboardingInput): Promise<LearnerOnboardingReadModel | null>
  readPlacement(input: { contentLocale: string; sessionId?: string | null }): Promise<PlacementReadModel>
  submitPlacementAnswer(input: PlacementAnswerInput): Promise<PlacementSubmitResult>
  skipPlacement(input: { fastTrackLevel: string; contentLocale: string; clientEventId: string }): Promise<PlacementSubmitResult | null>
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
