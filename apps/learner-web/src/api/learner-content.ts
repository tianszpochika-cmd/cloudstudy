import { ApiError, apiClient, type ApiRequestOptions } from './client'
import {
  assessmentQuestions,
  createDefaultAssessment,
  createDefaultOnboarding,
  dailyQuotaOptions,
  targetGoals,
  type AssessmentReport,
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
  type LearnerContentPort,
  type LearnerHomeReadModel,
  type LearnerGoalOption,
  type LearnerOnboardingReadModel,
  type PlacementAnswerInput,
  type PlacementReadModel,
  type PlacementSubmitResult,
  type SaveOnboardingInput,
} from '../domain/learner-content'

type RecordValue = Record<string, unknown>

const READ_MODEL_PATHS = {
  profile: '/learner/profile',
  target: '/learner/targets',
  preferences: '/learner/preferences',
  firstDay: '/learner/first-day',
  home: '/learner/home',
  contentCatalog: '/content/learner/catalog',
  placement: '/assessment/placement/start',
  placementAnswerCommand: '/assessment/placement/submit-step',
  placementSkipCommand: '/assessment/placement/skip',
  taskCompleteCommand: '/onboarding/daily-tasks',
} as const

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

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isTargetGoal(value: unknown): value is TargetGoal {
  return targetGoals.some((item) => item.value === value)
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

function parseGoals(value: unknown): LearnerGoalOption[] {
  if (!Array.isArray(value)) return targetGoals.map((item) => ({ value: item.value, label: item.label, description: item.description }))
  return value.flatMap((item): LearnerGoalOption[] => {
    if (!isRecord(item) || !isTargetGoal(item.value)) return []
    const fallback = targetGoals.find((goal) => goal.value === item.value)
    return fallback ? [{ value: item.value, label: readString(item.label) ?? fallback.label, description: readString(item.description) ?? fallback.description }] : []
  })
}

function parseQuotas(value: unknown): DailyQuotaMinutes[] {
  if (!Array.isArray(value)) return [...dailyQuotaOptions]
  return value.filter((item): item is DailyQuotaMinutes => dailyQuotaOptions.includes(item as DailyQuotaMinutes))
}

function parseOnboarding(value: unknown): OnboardingProfile {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const profileSource = isRecord(source.profile) ? source.profile : source
  const targetGoal = isTargetGoal(profileSource.targetGoal) ? profileSource.targetGoal : null
  const quota = readNumber(profileSource.dailyQuotaMinutes)
  return {
    ...createDefaultOnboarding(),
    ageConfirmed: readBoolean(profileSource.ageConfirmed) ?? false,
    privacyConsent: readBoolean(profileSource.privacyConsent) ?? false,
    termsConsent: readBoolean(profileSource.termsConsent) ?? false,
    birthYear: readNumber(profileSource.birthYear),
    targetGoal,
    subTags: Array.isArray(profileSource.subTags) ? profileSource.subTags.filter(isSubTag).slice(0, 3) : [],
    dailyQuotaMinutes: dailyQuotaOptions.includes(quota as DailyQuotaMinutes) ? quota as DailyQuotaMinutes : null,
    completed: readBoolean(profileSource.completed) ?? false,
    updatedAt: readString(profileSource.updatedAt),
  }
}

function parseQuestion(value: unknown, fallbackSessionId: string | null, fallbackStepIndex = 1): PlacementQuestion | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const questionSource = isRecord(source.question) ? source.question : source
  const questionId = readString(questionSource.questionId) ?? readString(questionSource.id)
  const stemText = readString(questionSource.stemText) ?? readString(questionSource.prompt)
  const options = Array.isArray(questionSource.options)
    ? questionSource.options.flatMap((item): Array<{ key: string; text: string }> => {
        if (!isRecord(item)) return []
        const key = readString(item.key)
        const text = readString(item.text)
        return key && text ? [{ key, text }] : []
      })
    : []
  if (!questionId || !stemText || options.length === 0) return null
  const dimension = questionSource.dimension === 'GRAMMAR' || questionSource.dimension === 'LISTENING' ? questionSource.dimension : 'VOCABULARY'
  return {
    questionId,
    sessionId: readString(source.sessionId) ?? readString(source.sessionUuid) ?? fallbackSessionId ?? 'placement',
    stepIndex: readNumber(source.stepIndex) ?? fallbackStepIndex,
    totalSteps: readNumber(source.totalSteps) ?? 10,
    dimension,
    difficulty: readNumber(questionSource.difficulty) ?? 2,
    stemText,
    helperText: readString(questionSource.helperText) ?? '',
    options,
    correctKey: null,
    timeLimitSec: readNumber(questionSource.timeLimitSec) ?? 25,
  }
}

function parseReport(value: unknown): AssessmentReport | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const reportSource = isRecord(source.report) ? source.report : isRecord(source.finalReport) ? source.finalReport : source
  const cefrLevel = readString(reportSource.cefrLevel)
  const score = readNumber(reportSource.score)
  if (!cefrLevel || score === null || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrLevel)) return null
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

function parseTask(value: unknown): DailyTask | null {
  if (!isRecord(value)) return null
  const id = readString(value.id) ?? readString(value.taskId)
  const title = readString(value.title)
  if (!id || !title) return null
  const kind = value.kind === 'REVIEW' || value.kind === 'MISTAKE' ? value.kind : 'NEW'
  return {
    id,
    title,
    description: readString(value.description) ?? '',
    kind,
    minutes: Math.max(0, Math.round(readNumber(value.minutes) ?? 0)),
    count: Math.max(0, Math.round(readNumber(value.count) ?? 0)),
    completed: value.completed === true,
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
    const contentId = readString(item.contentId) ?? readString(item.id)
    const title = readString(item.title)
    if (!contentId || !title) return []
    const status = item.status === 'WITHDRAWN' ? 'WITHDRAWN' : item.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'PUBLISHED'
    return [{
      contentId,
      contentVersionId: readString(item.contentVersionId) ?? readString(item.versionId),
      kind: readString(item.kind) ?? 'LESSON',
      title,
      description: readString(item.description) ?? readString(item.summary) ?? '',
      contentLocale: readString(item.contentLocale) ?? 'en-US',
      status,
    }]
  })
}

function toReadModelError(error: unknown): LearnerContentReadModelError {
  if (error instanceof LearnerContentReadModelError) return error
  const status = error instanceof ApiError ? error.status : 0
  const details = error instanceof ApiError && isRecord(error.details) ? error.details : {}
  const code = readString(details.code) ?? readString(details.errorCode)
  if (status === 401 || status === 403 || code === 'FORBIDDEN' || code === 'ACCESS_DENIED') {
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

function emptyHome(): HomeSnapshot | null {
  return null
}

function parseOnboardingModel(value: unknown, contentLocale: string): LearnerOnboardingReadModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const optionsSource = isRecord(source.options) ? source.options : {}
  return {
    profile: parseOnboarding(source),
    goals: parseGoals(source.goals ?? optionsSource.goals),
    quotas: parseQuotas(source.quotas ?? optionsSource.dailyQuotaMinutes),
    contentLocale: readString(source.contentLocale) ?? contentLocale,
    revision: readString(source.revision) ?? readString(source.profileVersion),
  }
}

function parsePlacementModel(value: unknown, contentLocale: string): PlacementReadModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const report = parseReport(source.report ?? source.finalReport)
  const question = parseQuestion(source.currentQuestion ?? source.nextQuestion ?? source.question, readString(source.sessionId) ?? readString(source.sessionUuid))
  const rawStatus = readString(source.status)
  return {
    status: report ? 'COMPLETED' : question ? rawStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'AVAILABLE' : 'EMPTY',
    sessionId: readString(source.sessionId) ?? readString(source.sessionUuid) ?? question?.sessionId ?? null,
    currentQuestion: question,
    report,
    contentVersionId: readString(source.contentVersionId),
    contentLocale: readString(source.contentLocale) ?? contentLocale,
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
  }
}

export const learnerContentPort: LearnerContentPort = {
  async readOnboarding(contentLocale) {
    const [profile, target, preferences] = await Promise.all([
      request<unknown>(query(READ_MODEL_PATHS.profile, contentLocale)),
      request<unknown>(query(READ_MODEL_PATHS.target, contentLocale)),
      request<unknown>(query(READ_MODEL_PATHS.preferences, contentLocale)),
    ])
    const profileValue = isRecord(unwrap(profile)) ? unwrap(profile) as RecordValue : {}
    const targetValue = isRecord(unwrap(target)) ? unwrap(target) as RecordValue : {}
    const preferencesValue = isRecord(unwrap(preferences)) ? unwrap(preferences) as RecordValue : {}
    return parseOnboardingModel({
      profile: {
        ...profileValue,
        ...preferencesValue,
        targetGoal: readString(targetValue.goalCode) ?? readString(profileValue.targetGoal),
        dailyQuotaMinutes: readNumber(targetValue.dailyQuotaMinutes) ?? readNumber(profileValue.dailyQuotaMinutes),
      },
      contentLocale: readString(profileValue.contentLocale) ?? contentLocale,
    }, contentLocale)
  },

  async saveOnboarding(input: SaveOnboardingInput) {
    const targetLevel = input.profile.targetGoal === 'ZERO_BASIS' ? 'A1' : input.profile.targetGoal === 'CET_4_6' ? 'B1' : 'B2'
    await Promise.all([
      request<unknown>(READ_MODEL_PATHS.profile, {
        method: 'PATCH',
        body: { expectedStateVersion: 0, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai' },
        ...withIdempotency(`${input.clientEventId}-profile`),
      }),
      request<unknown>(READ_MODEL_PATHS.target, {
        method: 'PUT',
        body: { expectedStateVersion: 0, goalCode: input.profile.targetGoal, targetLevel, dailyQuotaMinutes: input.profile.dailyQuotaMinutes, status: 'ACTIVE' },
        ...withIdempotency(`${input.clientEventId}-target`),
      }),
      request<unknown>(READ_MODEL_PATHS.preferences, {
        method: 'PATCH',
        body: { expectedStateVersion: 0, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
        ...withIdempotency(`${input.clientEventId}-preferences`),
      }),
    ])
    return parseOnboardingModel({ profile: input.profile, contentLocale: 'en-US' }, 'en-US')
  },

  async readPlacement(input) {
    return parsePlacementModel(await request(query(READ_MODEL_PATHS.placement, input.contentLocale, { sessionId: input.sessionId })), input.contentLocale)
  },

  async submitPlacementAnswer(input: PlacementAnswerInput): Promise<PlacementSubmitResult> {
    const response = await request<unknown>(READ_MODEL_PATHS.placementAnswerCommand, {
      method: 'POST',
      body: input,
      ...withIdempotency(`placement-answer-${input.sessionId}-${input.questionId}-${input.selectedKey}`),
    })
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return {
      isCompleted: source.isCompleted === true || Boolean(parseReport(source.report ?? source.finalReport)),
      nextQuestion: parseQuestion(source.nextQuestion ?? source.currentQuestion, input.sessionId),
      report: parseReport(source.report ?? source.finalReport),
    }
  },

  async skipPlacement(input) {
    const response = await request<unknown>(READ_MODEL_PATHS.placementSkipCommand, {
      method: 'POST',
      body: input,
      ...withIdempotency(input.clientEventId),
    })
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return {
      isCompleted: true,
      nextQuestion: null,
      report: parseReport(source.report ?? source.finalReport),
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
    currentQuestion: question ? { ...question, sessionId: sessionId ?? 'offline-placement' } : null,
    report: null,
    contentVersionId: null,
    contentLocale: 'en-US',
  }
}

export function createEmptyHomeModel(): LearnerHomeReadModel {
  return { home: emptyHome(), today: emptyHome(), continueContext: null, content: [], contentStatus: 'EMPTY', contentLocale: 'en-US', revision: null }
}

export function createDefaultLocalAssessment(): AssessmentSnapshot {
  return createDefaultAssessment()
}
