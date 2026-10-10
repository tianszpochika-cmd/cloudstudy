import { ApiError, apiClient, type ApiRequestOptions } from './client'
import {
  assessmentQuestions,
  createDefaultAssessment,
  createDefaultOnboarding,
  dailyQuotaOptions,
  targetGoals,
  type AssessmentReport,
  type AssessmentSkipBaseline,
  type AssessmentSnapshot,
  type ContinueContext,
  type DailyQuotaMinutes,
  type DailyTask,
  type HomeSnapshot,
  type OnboardingProfile,
  type PlacementQuestion,
  type SubTag,
  type TargetGoal,
} from '../domain/b1'
import {
  LearnerContentReadModelError,
  type ContentProjection,
  type LearnerContentDetail,
  type LearnerContentPort,
  type LearnerHomeReadModel,
  type LearnerGoalOption,
  type LearnerOnboardingReadModel,
  type PlacementAnswerInput,
  type PlacementFormalReport,
  type PlacementReadModel,
  type OnboardingResumeRead,
  type PlacementSubmitResult,
  type SaveOnboardingInput,
} from '../domain/learner-content'

type RecordValue = Record<string, unknown>

const READ_MODEL_PATHS = {
  profile: '/learner/profile',
  target: '/learner/targets',
  preferences: '/learner/preferences',
  onboardingOptions: '/onboarding/options',
  firstDay: '/learner/first-day',
  home: '/learner/home',
  contentCatalog: '/content/learner/catalog',
  placementSessions: '/assessment/placement/sessions',
  placementSkipCommand: '/assessment/placement/baselines/skip',
  taskCompleteCommand: '/onboarding/daily-tasks',
} as const

const FAST_TRACK_STARTING_LEVEL = {
  ZERO_A1: 'A1',
  CET4_B1: 'B1',
  CET6_B2: 'B2',
  POSTGRAD_B2_PLUS: 'B2',
} as const

function placementSkipBody(input: { fastTrackLevel: string; sessionId?: string | null }): RecordValue {
  const level = FAST_TRACK_STARTING_LEVEL[input.fastTrackLevel as keyof typeof FAST_TRACK_STARTING_LEVEL]
  const body: RecordValue = {}
  if (input.sessionId?.startsWith('asess_')) body.sessionId = input.sessionId
  if (level) body.requestedStartingLevel = { level, authority: 'USER_SELECTED_NON_AUTHORITATIVE' }
  return body
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

interface OwnerSnapshot { data: RecordValue; version: number }

function ownerSnapshot(value: unknown, owner: string): OwnerSnapshot | null {
  if (value === null) return null
  const data = unwrap(value)
  const version = isRecord(data) ? data.stateVersion ?? data.state_version : null
  if (!isRecord(data) || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error(`${owner} 服务端版本无效，请刷新后重试。`)
  }
  return { data, version }
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isTargetGoal(value: unknown): value is TargetGoal {
  return targetGoals.some((item) => item.value === value)
}

function mapUiGoalCode(value: string | null): TargetGoal | null {
  switch (value) {
    case 'FOUNDATION':
    case 'ZERO_BASIS':
      return 'ZERO_BASIS'
    case 'COLLEGE_CET':
    case 'CET_4_6':
      return 'CET_4_6'
    case 'POSTGRADUATE_ENGLISH':
    case 'POSTGRADUATE':
      return 'POSTGRADUATE'
    case 'WORKPLACE_DAILY':
    case 'WORKPLACE':
      return 'WORKPLACE_DAILY'
    default:
      return null
  }
}

function decisionCode(details: unknown): string | null {
  if (!isRecord(details)) return null
  const envelope = isRecord(details.error) ? details.error : details
  const code = envelope.code
  return typeof code === 'string' && code.trim() ? code.trim() : null
}

function isSubTag(value: unknown): value is SubTag {
  return ['PRONUNCIATION', 'VOCABULARY', 'READING', 'LISTENING', 'SPEAKING', 'TRAVEL', 'EMAIL'].includes(String(value))
}

function withIdempotency(clientEventId: string, options: ApiRequestOptions = {}): ApiRequestOptions {
  return {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      'Idempotency-Key': clientEventId,
    },
  }
}

function query(path: string, contentLocale: string, extra: Record<string, string | null | undefined> = {}): string {
  const params = new URLSearchParams({ contentLocale })
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value)
  }
  return `${path}?${params.toString()}`
}

function parseGoals(value: unknown, allowFallback = true): LearnerGoalOption[] {
  if (!Array.isArray(value)) {
    return allowFallback ? targetGoals.map((item) => ({ value: item.value, label: item.label, description: item.description })) : []
  }
  return value.flatMap((item): LearnerGoalOption[] => {
    if (!isRecord(item) || !isTargetGoal(item.value)) return []
    const fallback = targetGoals.find((goal) => goal.value === item.value)
    return fallback ? [{ value: item.value, label: readString(item.label) ?? fallback.label, description: readString(item.description) ?? fallback.description }] : []
  })
}

function parseQuotas(value: unknown, allowFallback = true): DailyQuotaMinutes[] {
  if (!Array.isArray(value)) return allowFallback ? [...dailyQuotaOptions] : []
  return value.filter((item): item is DailyQuotaMinutes => dailyQuotaOptions.includes(item as DailyQuotaMinutes))
}

function parseOnboarding(value: unknown): OnboardingProfile {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const profileSource = isRecord(source.profile) ? source.profile : source
  const targetGoal = mapUiGoalCode(readString(profileSource.targetGoal ?? profileSource.target_goal))
  const quota = readNumber(profileSource.dailyQuotaMinutes ?? profileSource.daily_quota_minutes)
  return {
    ...createDefaultOnboarding(),
    ageConfirmed: readBoolean(profileSource.ageConfirmed ?? profileSource.age_confirmed) ?? false,
    privacyConsent: readBoolean(profileSource.privacyConsent ?? profileSource.privacy_consent) ?? false,
    termsConsent: readBoolean(profileSource.termsConsent ?? profileSource.terms_consent) ?? false,
    birthYear: readNumber(profileSource.birthYear ?? profileSource.birth_year),
    targetGoal,
    subTags: Array.isArray(profileSource.subTags) ? profileSource.subTags.filter(isSubTag).slice(0, 3) : [],
    dailyQuotaMinutes: dailyQuotaOptions.includes(quota as DailyQuotaMinutes) ? quota as DailyQuotaMinutes : null,
    completed: readBoolean(profileSource.completed) ?? String(profileSource.status ?? '').toUpperCase() === 'ACTIVE',
    updatedAt: readString(profileSource.updatedAt ?? profileSource.updated_at),
  }
}

function identifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return readString(value)
}

function readItemId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  return null
}

function readSequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function readStateVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new LearnerContentReadModelError({ code: 'UNAVAILABLE', status: 0, retryable: false, message: '当前环境无法生成作答摘要，这题没有提交。' })
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function itemAtSequence(items: unknown[], sequence: number): unknown {
  for (const item of items) {
    if (!isRecord(item)) continue
    if (readSequence(item.itemSequence) === sequence || readSequence(item.displayOrder) === sequence) return item
  }
  const index = sequence - 1
  return index >= 0 && index < items.length ? items[index] : null
}

type PlacementConflictAction = 'adopt' | 'retry' | 'stop'

function isPlacementConflict(error: unknown): boolean {
  return error instanceof LearnerContentReadModelError && error.status === 409
}

function placementConflictAction(
  attempt: { stateVersion: number; itemSequence: number; itemId: number },
  latest: PlacementReadModel,
  retried: boolean,
): PlacementConflictAction {
  if (latest.acceptedSequence >= attempt.itemSequence) return 'adopt'
  const sequence = latest.nextSequence ?? latest.currentQuestion?.stepIndex ?? null
  const sameItem = latest.currentQuestion?.itemId == null || latest.currentQuestion.itemId === attempt.itemId
  const unchanged = latest.stateVersion === attempt.stateVersion && sequence === attempt.itemSequence && sameItem
  if (unchanged && !retried) return 'retry'
  return 'stop'
}

function parseOptions(value: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): Array<{ key: string; text: string }> => {
    if (!isRecord(item)) return []
    const key = readString(item.key) ?? readString(item.optionId)
    const text = readString(item.text) ?? readString(item.label)
    return key && text ? [{ key, text }] : []
  })
}

function parseQuestion(value: unknown, fallbackSessionId: string | null, stepHint: number | null = null, totalSteps: number | null = null): PlacementQuestion | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const questionSource = isRecord(source.question) ? source.question : source
  const questionId = readString(questionSource.questionId) ?? readString(questionSource.id) ?? identifier(questionSource.itemId)
  const stemText = readString(questionSource.stemText) ?? readString(questionSource.stem) ?? readString(questionSource.prompt)
  const options = parseOptions(questionSource.options)
  if (!questionId || !stemText || options.length === 0) return null
  const rawDimension = readString(questionSource.dimension) ?? readString(questionSource.itemType)
  const dimension = rawDimension === 'GRAMMAR' || rawDimension === 'BASIC_GRAMMAR'
    ? 'GRAMMAR'
    : rawDimension === 'LISTENING' ? 'LISTENING' : 'VOCABULARY'
  const displayOrder = readNumber(questionSource.displayOrder) ?? readNumber(source.displayOrder)
  return {
    questionId,
    itemId: readItemId(questionSource.itemId) ?? readItemId(source.itemId),
    sessionId: readString(source.sessionId) ?? readString(source.sessionUuid) ?? fallbackSessionId ?? 'placement',
    stepIndex: stepHint ?? readNumber(source.stepIndex) ?? displayOrder ?? 1,
    totalSteps: totalSteps ?? readNumber(source.totalSteps) ?? readNumber(questionSource.totalSteps) ?? 10,
    dimension,
    difficulty: readNumber(questionSource.difficulty) ?? 2,
    stemText,
    helperText: readString(questionSource.helperText) ?? '',
    options,
    correctKey: null,
    timeLimitSec: readNumber(questionSource.timeLimitSec) ?? 25,
  }
}

function readCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function readFormalReport(value: unknown): PlacementFormalReport | null {
  const source = unwrap(value)
  if (!isRecord(source) || source.resultKind === 'SKIPPED') return null
  const summary = isRecord(source.summary) ? source.summary : source
  if (summary.resultKind === 'SKIPPED') return null
  const reportId = readString(summary.reportId) ?? readString(source.reportId)
  if (!reportId) return null
  return {
    reportId,
    fullCount: readCount(summary.fullCount),
    zeroCount: readCount(summary.zeroCount),
    itemCount: readCount(summary.itemCount),
  }
}

function parseReport(value: unknown): AssessmentReport | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const reportSource = isRecord(source.report) ? source.report : isRecord(source.finalReport) ? source.finalReport : source
  const assessed = reportSource.resultKind === 'ASSESSED'
  const cefrLevel = readString(reportSource.cefrLevel) ?? (assessed ? readString(reportSource.referenceLevel) : null)
  const rawScore = readNumber(reportSource.score) ?? (assessed ? readNumber(reportSource.aggregateScore) : null)
  if (!cefrLevel || rawScore === null || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrLevel)) return null
  // B25 stores a 0..1 ratio. P1 aggregateScore is already 0..100, so only the
  // legacy score field is scaled. A P1 score of 1 must stay 1.
  const score = reportSource.aggregateScore == null && rawScore >= 0 && rawScore <= 1 ? rawScore * 100 : rawScore
  const radar = isRecord(reportSource.radarScores) ? reportSource.radarScores : {}
  const level = cefrLevel === 'A1' ? 1 : cefrLevel === 'A2' ? 2 : cefrLevel === 'B1' ? 3 : cefrLevel === 'B2' ? 4 : cefrLevel === 'C1' ? 5 : 6
  return {
    score,
    level,
    cefrLevel: cefrLevel as AssessmentReport['cefrLevel'],
    estimatedVocabulary: readNumber(reportSource.estimatedVocabulary) ?? 0,
    radarScores: {
      vocab: readNumber(radar.vocab) ?? 0,
      grammar: readNumber(radar.grammar) ?? 0,
      listening: readNumber(radar.listening) ?? 0,
      speed: readNumber(radar.speed) ?? 0,
      scenario: readNumber(radar.scenario) ?? 0,
    },
    recommendedAdvice: readString(reportSource.recommendedAdvice) ?? '',
    source: reportSource.source === 'FAST_TRACK' ? 'FAST_TRACK' : 'PLACEMENT',
    completedAt: readString(reportSource.completedAt) ?? new Date().toISOString(),
  }
}

function parseSkipBaseline(value: unknown): AssessmentSkipBaseline | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const result = isRecord(source.report) ? source.report : source
  if (result.resultKind !== 'SKIPPED' && source.status !== 'SKIPPED') return null
  const sessionId = readString(result.sessionId) ?? readString(source.sessionId)
  // A skip baseline is not a scored report. The session id is the durable identity.
  const reportId = readString(result.reportId) ?? sessionId
  if (!reportId || !sessionId) return null
  const hint = isRecord(result.requestedStartingLevel) ? readString(result.requestedStartingLevel.level) : null
  return {
    reportId,
    sessionId,
    requestedStartingLevel: hint && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(hint) ? hint as AssessmentSkipBaseline['requestedStartingLevel'] : null,
    confidence: 'UNVERIFIED',
  }
}

function parseTask(value: unknown): DailyTask | null {
  if (!isRecord(value)) return null
  const id = readString(value.id) ?? readString(value.taskId) ?? readString(value.task_id)
  const title = readString(value.title)
  if (!id || !title) return null
  const rawKind = readString(value.kind) ?? readString(value.taskType) ?? readString(value.task_type)
  const kind = rawKind === 'REVIEW' || rawKind === 'MISTAKE' ? rawKind : 'NEW'
  return {
    id,
    contentCode: readString(value.contentCode) ?? readString(value.content_code),
    title,
    description: readString(value.description) ?? '',
    kind,
    minutes: Math.max(0, Math.round(readNumber(value.minutes) ?? 0)),
    count: Math.max(0, Math.round(readNumber(value.count) ?? 0)),
    completed: value.completed === true || String(value.status ?? value.task_status ?? '').toUpperCase() === 'COMPLETED',
  }
}

function parseHome(value: unknown): HomeSnapshot | null {
  const source = unwrap(value)
  if (!isRecord(source) || source.empty === true) return null
  const homeSource = isRecord(source.home) ? source.home : isRecord(source.today) ? source.today : source
  const stream = isRecord(homeSource.dailyStream) ? homeSource.dailyStream : isRecord(homeSource.dailyTaskStream) ? homeSource.dailyTaskStream : null
  if (!stream) return null
  const tasks = Array.isArray(stream.tasks) ? stream.tasks.flatMap((item) => { const task = parseTask(item); return task ? [task] : [] }) : []
  const targetMinutes = readNumber(stream.targetMinutes)
  if (targetMinutes === null) return null
  return {
    streakDays: Math.max(0, Math.round(readNumber(homeSource.streakDays) ?? 0)),
    starCoins: Math.max(0, Math.round(readNumber(homeSource.starCoins) ?? 0)),
    currentXp: Math.max(0, Math.round(readNumber(homeSource.currentXp) ?? 0)),
    levelTitle: readString(homeSource.levelTitle) ?? '',
    dailyStream: {
      dueNewCount: Math.max(0, Math.round(readNumber(stream.dueNewCount) ?? tasks.filter((task) => task.kind === 'NEW' && !task.completed).length)),
      dueReviewCount: Math.max(0, Math.round(readNumber(stream.dueReviewCount) ?? tasks.filter((task) => task.kind === 'REVIEW' && !task.completed).length)),
      mistakeCount: Math.max(0, Math.round(readNumber(stream.mistakeCount) ?? tasks.filter((task) => task.kind === 'MISTAKE' && !task.completed).length)),
      completedMinutes: Math.max(0, Math.round(readNumber(stream.completedMinutes) ?? 0)),
      targetMinutes: targetMinutes as DailyQuotaMinutes,
      tasks,
    },
    orderedWidgets: Array.isArray(homeSource.orderedWidgets) ? homeSource.orderedWidgets.filter((item): item is string => typeof item === 'string') : [],
    lastSyncedAt: readString(homeSource.lastSyncedAt),
  }
}

function parseContinue(value: unknown): ContinueContext | null {
  const source = unwrap(value)
  if (!isRecord(source) || source.hasContext === false || source.empty === true) return null
  const moduleId = readString(source.moduleId)
  const lessonId = readString(source.lessonId)
  if (!moduleId || !lessonId) return null
  return {
    moduleId,
    moduleLabel: readString(source.moduleLabel) ?? '',
    lessonId,
    lessonTitle: readString(source.lessonTitle) ?? '',
    stepIndex: Math.max(0, Math.round(readNumber(source.stepIndex) ?? 0)),
    totalSteps: Math.max(1, Math.round(readNumber(source.totalSteps) ?? 1)),
    elapsedTimeMs: Math.max(0, Math.round(readNumber(source.elapsedTimeMs) ?? 0)),
    updatedAt: readString(source.updatedAt) ?? new Date().toISOString(),
    status: source.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
  }
}

function parseContent(value: unknown): ContentProjection[] {
  const source = unwrap(value)
  if (!isRecord(source)) return []
  const items = Array.isArray(source.items) ? source.items : Array.isArray(source.content) ? source.content : Array.isArray(source.cards) ? source.cards : []
  return items.flatMap((item): ContentProjection[] => {
    if (!isRecord(item)) return []
    const contentId = readString(item.contentId) ?? readString(item.contentCode) ?? readString(item.id)
    const title = readString(item.title)
    if (!contentId || !title) return []
    const rawStatus = readString(item.status) ?? readString(item.availability)
    const status = rawStatus === 'WITHDRAWN' || rawStatus === 'UNPUBLISHED'
      ? 'WITHDRAWN'
      : rawStatus === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : 'PUBLISHED'
    return [{
      contentId,
      contentVersionId: readString(item.contentVersionId) ?? readString(item.versionId),
      kind: readString(item.kind) ?? readString(item.contentType) ?? 'LESSON',
      title,
      description: readString(item.description) ?? readString(item.summary) ?? '',
      contentLocale: readString(item.contentLocale) ?? 'en-US',
      status,
    }]
  })
}

function parseContentDetail(value: unknown): LearnerContentDetail {
  const unwrapped = unwrap(value)
  const source = isRecord(unwrapped) ? unwrapped : {}
  const detail = isRecord(source.content) ? source.content : source
  const contentId = readString(detail.contentId) ?? readString(detail.contentCode) ?? readString(detail.id)
  const title = readString(detail.title)
  if (!contentId || !title) {
    throw new LearnerContentReadModelError({ code: 'INVALID', status: 200, retryable: false, message: '服务端课程内容格式无效。' })
  }
  const rawItems = Array.isArray(detail.items) ? detail.items : []
  const items = rawItems.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const options = Array.isArray(item.options) ? item.options.flatMap((option) => {
      if (!isRecord(option)) return []
      const key = readString(option.key)
      const text = readString(option.text)
      return key && text ? [{ key, text }] : []
    }) : []
    return [{
      itemId: readString(item.itemId) ?? readString(item.itemCode) ?? `${contentId}:item:${index + 1}`,
      itemType: readString(item.itemType) ?? 'LESSON',
      text: readString(item.text) ?? readString(item.displayText) ?? readString(item.prompt) ?? readString(item.content) ?? '',
      options,
    }]
  })
  return {
    contentId,
    contentVersionId: readString(detail.contentVersionId) ?? readString(detail.versionId),
    kind: readString(detail.kind) ?? readString(detail.contentType) ?? 'LESSON',
    title,
    description: readString(detail.description) ?? readString(detail.summary) ?? '',
    contentLocale: readString(detail.contentLocale) ?? 'en-US',
    items,
  }
}

function toReadModelError(error: unknown): LearnerContentReadModelError {
  if (error instanceof LearnerContentReadModelError) return error
  const status = error instanceof ApiError ? error.status : 0
  const details = error instanceof ApiError && isRecord(error.details) ? error.details : {}
  const code = readString(details.code) ?? readString(details.errorCode)
  if (status === 401) {
    return new LearnerContentReadModelError({ code: 'UNAVAILABLE', status, retryable: false, message: '会话已失效，请重新登录。' })
  }
  if (status === 403 || code === 'FORBIDDEN' || code === 'ACCESS_DENIED') {
    return new LearnerContentReadModelError({ code: 'FORBIDDEN', status, retryable: false, message: '服务端拒绝了当前学习资源。' })
  }
  if (status === 404 || status === 410 || ['CONTENT_UNAVAILABLE', 'CONTENT_WITHDRAWN', 'CONTENT_VERSION_UNAVAILABLE'].includes(code ?? '')) {
    return new LearnerContentReadModelError({ code: 'CONTENT_UNAVAILABLE', status, retryable: true, message: '学习内容已下线或当前版本不可用。' })
  }
  if (status >= 500 || status === 0 || error instanceof TypeError) {
    return new LearnerContentReadModelError({ code: status === 0 ? 'NETWORK' : 'UNAVAILABLE', status, retryable: true, message: '学习服务暂时不可用。' })
  }
  return new LearnerContentReadModelError({ code: 'UNKNOWN', status, retryable: false, message: error instanceof Error ? error.message : '学习数据格式暂时无法识别。' })
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  try {
    return await apiClient.request<T>(path, options)
  } catch (error) {
    throw toReadModelError(error)
  }
}

async function requestOptional<T>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
  try {
    return await request<T>(path, options)
  } catch (error) {
    // A newly registered principal has no learner-owned row yet. That is an empty
    // onboarding state, not an authorization failure or fake fallback.
    if ((error instanceof ApiError || error instanceof LearnerContentReadModelError) && error.status === 404) return null
    throw error
  }
}

function emptyHome(): HomeSnapshot | null {
  return null
}

function parseOnboardingModel(value: unknown, contentLocale: string, allowOptionFallback = true): LearnerOnboardingReadModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const optionsSource = isRecord(source.options) ? source.options : {}
  return {
    profile: parseOnboarding(source),
    goals: parseGoals(source.goals ?? optionsSource.goals, allowOptionFallback),
    quotas: parseQuotas(source.quotas ?? optionsSource.dailyQuotaMinutes, allowOptionFallback),
    contentLocale: readString(source.contentLocale) ?? contentLocale,
    revision: readString(source.revision) ?? readString(source.profileVersion),
  }
}

function emptyPlacement(contentLocale: string): PlacementReadModel {
  return {
    status: 'EMPTY',
    sessionId: null,
    currentQuestion: null,
    report: null,
    formalReport: null,
    responseOutcome: null,
    skipBaseline: null,
    contentVersionId: null,
    contentLocale,
    stateVersion: null,
    acceptedSequence: 0,
    nextSequence: null,
  }
}

function selectPlacementItem(source: RecordValue, items: unknown[], acceptedSequence: number, nextSequence: number | null, totalSteps: number | null): unknown {
  const explicit = source.currentItem ?? source.currentQuestion ?? source.nextItem ?? source.nextQuestion ?? source.question
  if (explicit != null) return explicit
  const total = totalSteps ?? (items.length || 10)
  const sequence = nextSequence ?? (acceptedSequence > 0 ? acceptedSequence + 1 : 1)
  if (sequence < 1 || sequence > total) return null
  // An accepted checkpoint must not fall back to the first sealed item.
  if (acceptedSequence > 0 || sequence === 1) return itemAtSequence(items, sequence)
  return null
}

function parsePlacementModel(value: unknown, contentLocale: string): PlacementReadModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const completed = isRecord(source.completedResult) ? source.completedResult : isRecord(source.finalResult) ? source.finalResult : null
  const reportValue = source.report ?? source.finalReport ?? (completed && completed.resultKind !== 'SKIPPED' ? completed : null)
  const report = parseReport(reportValue)
  const formalReport = readFormalReport(reportValue)
  const skipBaseline = parseSkipBaseline(source) ?? (completed?.resultKind === 'SKIPPED' ? parseSkipBaseline(completed) : null)
  const manifest = isRecord(source.manifest) ? source.manifest : null
  const items = Array.isArray(source.items) ? source.items : []
  const totalSteps = readNumber(manifest?.totalItemCount) ?? (items.length || null)
  const acceptedSequence = readSequence(source.acceptedSequence) ?? 0
  const nextSequence = readSequence(source.nextSequence) ?? (source.acceptedSequence != null ? acceptedSequence + 1 : null)
  const stateVersion = readStateVersion(source.stateVersion) ?? readStateVersion(source.state_version)
  const sessionId = readString(source.sessionId) ?? readString(source.sessionUuid)
  const current = selectPlacementItem(source, items, acceptedSequence, nextSequence, totalSteps)
  const stepHint = nextSequence != null && nextSequence >= 1 && (totalSteps == null || nextSequence <= totalSteps) ? nextSequence : null
  const question = parseQuestion(current, sessionId, stepHint, totalSteps)
  const rawStatus = readString(source.status)
  const contentPin = isRecord(source.contentPin) ? source.contentPin : null
  const heldSession = Boolean(sessionId?.startsWith('asess_'))
  const responseOutcome = source.outcome === 'FULL' || source.outcome === 'ZERO' ? source.outcome : null
  return {
    status: skipBaseline ? 'SKIPPED' : report || formalReport ? 'COMPLETED' : question ? rawStatus === 'IN_PROGRESS' || acceptedSequence > 0 ? 'IN_PROGRESS' : 'AVAILABLE' : heldSession ? 'IN_PROGRESS' : 'EMPTY',
    sessionId: sessionId ?? question?.sessionId ?? null,
    currentQuestion: question,
    report,
    formalReport,
    responseOutcome,
    skipBaseline,
    contentVersionId: readString(source.contentVersionId) ?? identifier(contentPin?.contentVersionId),
    contentLocale: readString(source.contentLocale) ?? contentLocale,
    stateVersion,
    acceptedSequence,
    nextSequence,
  }
}

function placementSubmitFromModel(model: PlacementReadModel, accepted: boolean): PlacementSubmitResult {
  return {
    accepted,
    isCompleted: Boolean(model.report || model.formalReport) || model.status === 'COMPLETED' || model.status === 'SKIPPED',
    nextQuestion: model.currentQuestion,
    report: model.report,
    formalReport: model.formalReport,
    responseOutcome: accepted ? model.responseOutcome : null,
    skipBaseline: model.skipBaseline,
    stateVersion: model.stateVersion,
    acceptedSequence: model.acceptedSequence,
    nextSequence: model.nextSequence,
    sessionId: model.sessionId,
  }
}

function parseHomeModel(learnerValue: unknown, contentValue: unknown, contentLocale: string): LearnerHomeReadModel {
  const learnerSource = isRecord(unwrap(learnerValue)) ? unwrap(learnerValue) as RecordValue : {}
  const contentSource = isRecord(unwrap(contentValue)) ? unwrap(contentValue) as RecordValue : {}
  const contentStatus = contentSource.contentStatus === 'UNAVAILABLE' || contentSource.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : parseContent(contentValue).length ? 'READY' : 'EMPTY'
  return {
    home: parseHome(learnerSource.home ?? learnerSource),
    today: parseHome(learnerSource.today ?? learnerSource),
    continueContext: parseContinue(learnerSource.continueContext ?? learnerSource.continue),
    content: parseContent(contentValue),
    contentStatus,
    contentLocale: readString(learnerSource.contentLocale) ?? readString(contentSource.contentLocale) ?? contentLocale,
    revision: readString(learnerSource.revision) ?? readString(contentSource.revision),
    plan: parsePlan(learnerSource.firstDay),
  }
}

function parsePlan(value: unknown): LearnerHomeReadModel['plan'] {
  // B9 READY first-day envelope embeds the owner-assembled plan facts; anything
  // else means no plan is ensured yet (honest null, not an empty plan).
  const source = isRecord(value) ? value : null
  if (!source || source.state !== 'READY') return null
  const plan = isRecord(source.plan) ? source.plan : null
  const planId = readString(plan?.planId)
  const tasks = Array.isArray(source.tasks) ? source.tasks.flatMap((entry) => {
    const item = isRecord(entry) ? entry : null
    const itemId = readString(item?.itemId)
    return itemId ? [{ itemId, taskType: readString(item?.taskType) ?? '', status: readString(item?.status) ?? '' }] : []
  }) : []
  if (!planId || !tasks.length) return null
  return { planId, taskCount: tasks.length, tasks }
}

let cachedActiveConsentVersion: string | null = null
let consentRefreshPromise: Promise<string> | null = null

async function fetchActiveConsentVersion(): Promise<string> {
  try {
    const raw = await requestOptional<unknown>('/iam/principal/me')
    const unwrapped = unwrap(raw)
    if (isRecord(unwrapped)) {
      const consentState = isRecord(unwrapped.consentState) ? unwrapped.consentState : undefined
      if (consentState && typeof consentState.version === 'string' && consentState.version.trim()) {
        return consentState.version.trim()
      }
    }
  } catch {
    // fallback to default
  }
  return 'b30-consent-v1'
}

async function refreshActiveConsentVersion(): Promise<string> {
  if (!consentRefreshPromise) {
    consentRefreshPromise = fetchActiveConsentVersion().then((v) => {
      cachedActiveConsentVersion = v
      consentRefreshPromise = null
      return v
    }).catch((err) => {
      consentRefreshPromise = null
      throw err
    })
  }
  return consentRefreshPromise
}

function parseAdultGateFact(value: unknown): string {
  if (value === 'PASSED' || value === 'REJECTED' || value === 'REQUIRED') return value
  if (!isRecord(value)) return 'UNKNOWN'
  if (value.status === 'PASSED' || value.status === 'APPROVED') return 'PASSED'
  if (value.status === 'REJECTED') return 'REJECTED'
  if (value.status === 'REQUIRED' || value.status === 'PENDING' || value.status === 'NOT_EVALUATED') return 'REQUIRED'
  return 'UNKNOWN'
}

function parseConsentFact(value: unknown): OnboardingResumeRead['consent'] {
  if (!isRecord(value)) return { readable: false, accepted: null, unsatisfiedPurposes: [] }
  const accepted = typeof value.accepted === 'boolean' ? value.accepted : null
  const purposes = Array.isArray(value.unsatisfiedPurposes)
    ? value.unsatisfiedPurposes.filter((item): item is string => typeof item === 'string')
    : null
  if (accepted === null && purposes === null) return { readable: false, accepted: null, unsatisfiedPurposes: [] }
  return { readable: true, accepted, unsatisfiedPurposes: purposes ?? [] }
}

async function readIamResumeFacts(): Promise<{ adultGate: string; consent: OnboardingResumeRead['consent'] }> {
  const raw = await apiClient.request<unknown>('/iam/principal/me')
  const source = unwrap(raw)
  const record = isRecord(source) ? source : {}
  const principal = isRecord(record.principal) ? record.principal : record
  const adultGate = parseAdultGateFact(record.adultGate ?? record.adultGateStatus ?? principal.adultGate ?? principal.adultGateStatus)
  const consentSource = isRecord(record.consentState) ? record.consentState : isRecord(principal.consentState) ? principal.consentState : null
  return { adultGate, consent: parseConsentFact(consentSource) }
}

async function readTargetFact(): Promise<OnboardingResumeRead['target'] & { consentRequired: boolean }> {
  try {
    const raw = await apiClient.request<unknown>('/learner/targets')
    const source = unwrap(raw)
    const record = isRecord(source) ? source : {}
    const goal = mapUiGoalCode(readString(record.goalCode) ?? readString(record.goal_code))
    const quota = readNumber(record.dailyQuotaMinutes) ?? readNumber(record.daily_quota_minutes)
    const saved = Boolean(goal && quota !== null && dailyQuotaOptions.includes(quota as DailyQuotaMinutes))
    return { readable: true, saved, goal: saved ? goal : null, quota: saved ? quota : null, consentRequired: false }
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0
    const code = error instanceof ApiError ? decisionCode(error.details) : null
    if (status === 404) return { readable: true, saved: false, goal: null, quota: null, consentRequired: false }
    if (status === 403 && code === 'CONSENT_REQUIRED') return { readable: true, saved: false, goal: null, quota: null, consentRequired: true }
    return { readable: false, saved: false, goal: null, quota: null, consentRequired: false }
  }
}

async function signConsent(type: string, keySuffix: string, clientEventId: string): Promise<void> {
  const version = cachedActiveConsentVersion ?? 'b30-consent-v1'
  try {
    await request<unknown>('/iam/consents', {
      method: 'PUT',
      body: { type, version, decision: 'ACCEPTED' },
      ...withIdempotency(`${clientEventId}-${keySuffix}`),
    })
  } catch (error) {
    const status = (error instanceof ApiError || error instanceof LearnerContentReadModelError)
      ? error.status
      : (isRecord(error) && typeof error.status === 'number' ? error.status : 0)
    if (status === 409) {
      let latestVersion = cachedActiveConsentVersion
      if (latestVersion === version || !latestVersion) {
        latestVersion = await refreshActiveConsentVersion()
      }
      if (latestVersion && latestVersion !== version) {
        await request<unknown>('/iam/consents', {
          method: 'PUT',
          body: { type, version: latestVersion, decision: 'ACCEPTED' },
          ...withIdempotency(`${clientEventId}-${keySuffix}`),
        })
        return
      }
    }
    throw error
  }
}

async function signRequiredConsents(clientEventId: string): Promise<void> {
  await Promise.all([
    signConsent('PRIVACY', 'privacy', clientEventId),
    signConsent('TERMS', 'terms', clientEventId),
    signConsent('ADULT_LEARNING', 'adult-learning', clientEventId),
  ])
  const [{ useSessionStore }, { pinia }] = await Promise.all([
    import('../stores/session'),
    import('../stores/pinia'),
  ])
  const session = useSessionStore(pinia)
  if (!await session.refreshSilently()) {
    throw new Error('必要同意已提交，但会话还没有更新。请重试。本页还没提交的内容，离开后不会保留。')
  }
}

export const learnerContentPort: LearnerContentPort = {
  async readOnboarding(contentLocale) {
    const [profile, target, preferences, options] = await Promise.all([
      requestOptional<unknown>(query(READ_MODEL_PATHS.profile, contentLocale)),
      requestOptional<unknown>(query(READ_MODEL_PATHS.target, contentLocale)),
      requestOptional<unknown>(query(READ_MODEL_PATHS.preferences, contentLocale)),
      requestOptional<unknown>(query(READ_MODEL_PATHS.onboardingOptions, contentLocale)),
    ])
    const profileValue = isRecord(unwrap(profile)) ? unwrap(profile) as RecordValue : {}
    const targetValue = isRecord(unwrap(target)) ? unwrap(target) as RecordValue : {}
    const preferencesValue = isRecord(unwrap(preferences)) ? unwrap(preferences) as RecordValue : {}
    const optionsValue = isRecord(unwrap(options)) ? unwrap(options) as RecordValue : {}
    return parseOnboardingModel({
      profile: {
        ...profileValue,
        ...preferencesValue,
        targetGoal: mapUiGoalCode(readString(targetValue.goalCode) ?? readString(targetValue.goal_code) ?? readString(profileValue.targetGoal) ?? readString(profileValue.target_goal)),
        dailyQuotaMinutes: readNumber(targetValue.dailyQuotaMinutes) ?? readNumber(targetValue.daily_quota_minutes) ?? readNumber(profileValue.dailyQuotaMinutes) ?? readNumber(profileValue.daily_quota_minutes),
      },
      goals: optionsValue.goals,
      quotas: optionsValue.quotas ?? optionsValue.dailyQuotaMinutes,
      contentLocale: readString(profileValue.contentLocale) ?? contentLocale,
    }, contentLocale, false)
  },

  async readOnboardingResume() {
    const iam = await readIamResumeFacts()
    if (iam.adultGate !== 'PASSED') {
      return { ...iam, target: { readable: true, saved: false, goal: null, quota: null } }
    }
    const target = await readTargetFact()
    if (target.consentRequired) {
      return {
        adultGate: iam.adultGate,
        consent: { readable: true, accepted: false, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] },
        target: { readable: true, saved: false, goal: null, quota: null },
      }
    }
    return { adultGate: iam.adultGate, consent: iam.consent, target }
  },

  async recordRequiredConsents(clientEventId: string) {
    await signRequiredConsents(clientEventId)
    const iam = await readIamResumeFacts()
    const accepted = iam.consent.readable && iam.consent.accepted === true
      && !iam.consent.unsatisfiedPurposes.some((item) => item === 'ACCOUNT_TERMS' || item === 'PRIVACY_NOTICE' || item === 'ADULT_LEARNING_ELIGIBILITY')
    if (iam.adultGate === 'PASSED' && !accepted) {
      throw new Error('必要同意尚未在服务端生效，请重试。本页还没提交的内容，离开后不会保留。')
    }
  },

  async saveOnboarding(input: SaveOnboardingInput) {
    const hasTarget = Boolean(input.profile.targetGoal && input.profile.dailyQuotaMinutes)
    const hasConsentFields = Boolean(input.profile.ageConfirmed && input.profile.privacyConsent && input.profile.termsConsent && input.profile.birthYear)
    if (!hasTarget || (!input.consentsRecorded && !hasConsentFields)) {
      throw new Error(input.consentsRecorded ? '请先选择学习目标和每天时长。' : '成人 Gate、隐私/条款同意和学习目标必须全部完成后才能保存。')
    }
    const targetLevel = input.profile.targetGoal === 'ZERO_BASIS' ? 'A1' : input.profile.targetGoal === 'CET_4_6' ? 'B1' : 'B2'

    await signRequiredConsents(input.clientEventId)
    const [{ useSessionStore }, { pinia }] = await Promise.all([
      import('../stores/session'),
      import('../stores/pinia'),
    ])
    const session = useSessionStore(pinia)
    if (!session.isLearningReady && !input.consentsRecorded) {
      throw new Error('学习资格尚未生效，请重新登录后继续。')
    }
    // Target and preferences carry the same learner-owned profile version.
    // Read the profile last so its version is the latest owner checkpoint.
    const [targetValue, preferencesValue] = await Promise.all([
      requestOptional<unknown>(READ_MODEL_PATHS.target),
      requestOptional<unknown>(READ_MODEL_PATHS.preferences),
    ])
    const profileValue = await requestOptional<unknown>(READ_MODEL_PATHS.profile)
    const target = ownerSnapshot(targetValue, '学习目标')
    const preferences = ownerSnapshot(preferencesValue, '学习偏好')
    const profile = ownerSnapshot(profileValue, '学员资料')
    let version = profile?.version ?? 0
    if ((target?.version ?? 0) > version || (preferences?.version ?? 0) > version) {
      throw new Error('学员资料版本已更新，请刷新后重试。')
    }

    // The first write establishes an owned row. On retry, skip it when the
    // owner already confirms the requested locale and timezone.
    const profileReady = profile !== null && profile.version > 0
      && profile.data.uiLocale === 'zh-CN' && profile.data.contentLocale === 'en-US'
      && profile.data.timezone === 'Asia/Shanghai'
    if (!profileReady) {
      const patched = ownerSnapshot(await request<unknown>(READ_MODEL_PATHS.profile, {
        method: 'PATCH',
        body: {
          expectedStateVersion: version,
          uiLocale: 'zh-CN',
          contentLocale: 'en-US',
          timezone: 'Asia/Shanghai',
        },
        ...withIdempotency(`${input.clientEventId}-profile`),
      }), '学员资料')
      if (!patched) throw new Error('学员资料写入未返回服务端版本。')
      version = patched.version
    }

    const targetReady = target !== null && target.data.goalCode === input.profile.targetGoal
      && target.data.targetLevel === targetLevel
      && target.data.dailyQuotaMinutes === input.profile.dailyQuotaMinutes
      && target.data.status === 'ACTIVE'
    if (!targetReady) {
      const saved = ownerSnapshot(await request<unknown>(READ_MODEL_PATHS.target, {
        method: 'PUT',
        body: { expectedStateVersion: version, goalCode: input.profile.targetGoal, targetLevel, dailyQuotaMinutes: input.profile.dailyQuotaMinutes, status: 'ACTIVE' },
        ...withIdempotency(`${input.clientEventId}-target`),
      }), '学习目标')
      if (!saved) throw new Error('学习目标写入未返回服务端版本。')
      version = saved.version
    }

    const preferencesReady = preferences !== null
      && preferences.data.uiLocale === 'zh-CN' && preferences.data.contentLocale === 'en-US'
      && preferences.data.timezone === 'Asia/Shanghai' && preferences.data.themeMode === 'SYSTEM'
      && preferences.data.highContrast === false && preferences.data.motionMode === 'FULL'
    if (!preferencesReady) {
      await request<unknown>(READ_MODEL_PATHS.preferences, {
        method: 'PATCH',
        body: { expectedStateVersion: version, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
        ...withIdempotency(`${input.clientEventId}-preferences`),
      })
    }
    // Read the owner rows back after every write. The UI must continue from the
    // learner-service/MySQL projection, not from the request body echo.
    return learnerContentPort.readOnboarding('en-US')
  },

  async readContent(contentId) {
    return parseContentDetail(await request(`/content/learner/${encodeURIComponent(contentId)}`))
  },

  async readPlacement(input) {
    if (!input.sessionId) return emptyPlacement(input.contentLocale)
    return parsePlacementModel(await request(`${READ_MODEL_PATHS.placementSessions}/${encodeURIComponent(input.sessionId)}`), input.contentLocale)
  },

  async startPlacement(input) {
    return parsePlacementModel(await request(READ_MODEL_PATHS.placementSessions, {
      method: 'POST',
      body: {},
      ...withIdempotency(input.clientEventId),
    }), input.contentLocale)
  },

  async submitPlacementAnswer(input: PlacementAnswerInput): Promise<PlacementSubmitResult> {
    const stateVersion = input.stateVersion
    const itemId = input.itemId
    const itemSequence = input.itemSequence
    if (stateVersion == null || itemId == null || itemSequence == null || !Number.isSafeInteger(stateVersion) || !Number.isSafeInteger(itemId) || !Number.isSafeInteger(itemSequence) || itemId < 1 || itemSequence < 1 || itemSequence > 10) {
      throw new LearnerContentReadModelError({ code: 'INVALID', status: 0, retryable: false, message: '这题还没有服务端检查点，没有提交。' })
    }
    const idempotencyKey = input.idempotencyKey?.trim() || `placement-response-${input.sessionId}-${itemId}-${itemSequence}-${stateVersion}`
    const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [input.selectedKey] }
    const responseDigest = await sha256Hex(JSON.stringify([input.sessionId, itemId, itemSequence, candidateResponse]))
    const body = { expectedStateVersion: stateVersion, itemId, itemSequence, candidateResponse, responseDigest, timeSpentSec: input.timeSpentSec }
    const path = `${READ_MODEL_PATHS.placementSessions}/${encodeURIComponent(input.sessionId)}/responses`
    const post = () => request<unknown>(path, { method: 'POST', body, ...withIdempotency(idempotencyKey) })
    const reconcile = async (retried: boolean): Promise<PlacementSubmitResult> => {
      const latest = await learnerContentPort.readPlacement({ contentLocale: input.contentLocale, sessionId: input.sessionId })
      const action = placementConflictAction({ stateVersion, itemSequence, itemId }, latest, retried)
      if (action !== 'retry') return placementSubmitFromModel(latest, false)
      try {
        const receipt = parsePlacementModel(await post(), input.contentLocale)
        return placementSubmitFromModel(receipt, true)
      } catch (error) {
        if (!isPlacementConflict(error)) throw error
        const afterRetry = await learnerContentPort.readPlacement({ contentLocale: input.contentLocale, sessionId: input.sessionId })
        return placementSubmitFromModel(afterRetry, false)
      }
    }
    try {
      const receipt = parsePlacementModel(await post(), input.contentLocale)
      return placementSubmitFromModel(receipt, true)
    } catch (error) {
      if (!isPlacementConflict(error)) throw error
      return reconcile(false)
    }
  },

  async retestPlacement(input) {
    return parsePlacementModel(await request(`${READ_MODEL_PATHS.placementSessions}/${encodeURIComponent(input.sessionId)}/retest`, {
      method: 'POST',
      body: {},
      ...withIdempotency(input.clientEventId),
    }), input.contentLocale)
  },

  async skipPlacement(input) {
    const response = await request<unknown>(READ_MODEL_PATHS.placementSkipCommand, {
      method: 'POST',
      body: placementSkipBody(input),
      ...withIdempotency(input.clientEventId),
    })
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return {
      isCompleted: true,
      nextQuestion: null,
      report: parseReport(source.report ?? source.finalReport),
      skipBaseline: parseSkipBaseline(source.report ?? source.finalReport ?? source),
    }
  },

  async readHome(contentLocale) {
    const [learnerResult, contentResult] = await Promise.allSettled([
      request(query(READ_MODEL_PATHS.home, contentLocale)),
      request(query(READ_MODEL_PATHS.contentCatalog, contentLocale)),
    ])
    if (learnerResult.status === 'rejected') throw toReadModelError(learnerResult.reason)
    if (contentResult.status === 'rejected') {
      const error = toReadModelError(contentResult.reason)
      if (error.code === 'FORBIDDEN') throw error
      return {
        ...parseHomeModel(learnerResult.value, {}, contentLocale),
        content: [],
        contentStatus: 'UNAVAILABLE',
      }
    }
    return parseHomeModel(learnerResult.value, contentResult.value, contentLocale)
  },

  async readToday(contentLocale) {
    const [learnerResult, contentResult] = await Promise.allSettled([
      request(query(READ_MODEL_PATHS.home, contentLocale)),
      request(query(READ_MODEL_PATHS.contentCatalog, contentLocale)),
    ])
    if (learnerResult.status === 'rejected') throw toReadModelError(learnerResult.reason)
    if (contentResult.status === 'rejected') {
      const error = toReadModelError(contentResult.reason)
      if (error.code === 'FORBIDDEN') throw error
      return { ...parseHomeModel(learnerResult.value, {}, contentLocale), content: [], contentStatus: 'UNAVAILABLE' }
    }
    return parseHomeModel(learnerResult.value, contentResult.value, contentLocale)
  },

  async completeTask(input) {
    const response = await request<unknown>(`${READ_MODEL_PATHS.taskCompleteCommand}/${encodeURIComponent(input.taskId)}/complete`, {
      method: 'POST',
      body: input,
      ...withIdempotency(input.clientEventId),
    })
    if (response === undefined) return null
    return parseHomeModel(response, response, input.contentLocale)
  },
}

export function createLocalPlacementSnapshot(sessionId: string | null, answers: AssessmentSnapshot['answers']): PlacementReadModel {
  const question = assessmentQuestions[answers.length]
  return {
    status: question ? 'IN_PROGRESS' : 'EMPTY',
    sessionId: sessionId ?? 'offline-placement',
    currentQuestion: question ? { ...question, sessionId: sessionId ?? 'offline-placement', correctKey: null } : null,
    report: null,
    formalReport: null,
    responseOutcome: null,
    skipBaseline: null,
    contentVersionId: null,
    contentLocale: 'en-US',
    stateVersion: null,
    acceptedSequence: answers.length,
    nextSequence: question ? answers.length + 1 : null,
  }
}

export function createEmptyHomeModel(): LearnerHomeReadModel {
  return { home: emptyHome(), today: emptyHome(), continueContext: null, content: [], contentStatus: 'EMPTY', contentLocale: 'en-US', revision: null }
}

export function createDefaultLocalAssessment(): AssessmentSnapshot {
  return createDefaultAssessment()
}
