export type MobileReadModelStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'unavailable' | 'error'

export interface MobileGoalOption {
  value: string
  label: string
  description?: string
}

export interface MobileOnboardingModel {
  goal: string | null
  quota: number | null
  goals: MobileGoalOption[]
  quotas: number[]
  birthYear: number | null
  ageConfirmed: boolean
  privacyConsent: boolean
  termsConsent: boolean
  uiLocale: string
  contentLocale: string
  completed: boolean
  stateVersion: number
}

export type MobileThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK'
export type MobileMotionMode = 'FULL' | 'REDUCED' | 'OFF'

export interface MobileLearnerAccount {
  uiLocale: string
  contentLocale: string
  timezone: string
  themeMode: MobileThemeMode
  highContrast: boolean
  motionMode: MobileMotionMode
  goal: string | null
  quota: number | null
  stateVersion: number
}

export interface MobileTask {
  id: string
  type: string
  title: string
  description: string
  minutes: number
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'UNAVAILABLE'
  contentCode?: string
  contentVersionPin?: number
  unavailableReason?: string
}

export interface MobileContentCard {
  contentCode: string
  contentType: string
  title: string
  summary: string
  contentLocale: string
  contentVersionId: number | null
  availability: 'PUBLISHED' | 'UNPUBLISHED' | 'RIGHTS_PENDING' | 'RIGHTS_EXPIRED' | 'NOT_READY'
}

export interface MobileContentItem {
  itemId: string
  itemType: string
  text: string
  options: Array<{ key: string; text: string }>
}

export interface MobileContentDetail {
  contentCode: string
  contentVersionId: number | null
  contentType: string
  title: string
  summary: string
  contentLocale: string
  items: MobileContentItem[]
}

export interface MobileHomeModel {
  projectionVersion: number
  contentEpoch: number
  tasks: MobileTask[]
  content: MobileContentCard[]
  contentStatus: 'READY' | 'EMPTY' | 'UNAVAILABLE'
  completedMinutes: number
  targetMinutes: number
  stale: boolean
}

export interface MobileFirstDayModel {
  state: 'NOT_READY' | 'READY' | 'DEGRADED'
  profileReady: boolean
  targetReady: boolean
  placementStatus: string
  taskCount: number
  contentEpoch: number
  projectionVersion: number
}

export interface MobilePlacementOption {
  key: string
  text: string
}

export interface MobilePlacementQuestion {
  questionId: string
  stemText: string
  options: MobilePlacementOption[]
  dimension: string
  difficulty: number
  stepIndex: number
  totalSteps: number
  timeLimitSec: number
  itemId: number | null
}

export interface MobilePlacementReport {
  reportId: string
  sessionId: string
  resultKind: 'ASSESSED' | 'SKIPPED'
  cefrLevel: string | null
  score: number | null
  requestedStartingLevel: string | null
  mistakes: string[]
  /** Null unless the server summary included the count. Never a stand-in for a missing score. */
  fullCount: number | null
  zeroCount: number | null
  itemCount: number | null
}

export interface MobilePlacementModel {
  sessionId: string | null
  status: string
  currentQuestion: MobilePlacementQuestion | null
  report: MobilePlacementReport | null
  isCompleted: boolean
  stateVersion: number | null
  acceptedSequence: number
  nextSequence: number | null
  /** True when this view was aligned after a 409 and is not a receipt for the attempt just sent. */
  reconciledWithoutReceipt: boolean
  /** FULL or ZERO only when the submit receipt said so. Null is not a score. */
  responseOutcome: 'FULL' | 'ZERO' | null
}

export class MobileLearnerContentError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean

  constructor(message: string, status = 0, code = 'UNKNOWN', retryable = true) {
    super(message)
    this.name = 'MobileLearnerContentError'
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}
