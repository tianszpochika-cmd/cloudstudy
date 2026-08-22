export type MobileReadModelStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'unavailable' | 'error'

export interface MobileGoalOption {
  value: string
  label: string
  description?: string
}

export interface MobileOnboardingModel {
  goal: string | null
  quota: number | null
  uiLocale: string
  contentLocale: string
  completed: boolean
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
