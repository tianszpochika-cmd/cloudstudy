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
  type LearnerContentDetail,
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
  onboardingOptions: '/onboarding/options',
  firstDay: '/learner/first-day',
  home: '/learner/home',
  contentCatalog: '/content/learner/catalog',
  taskEnsureCommand: '/onboarding/daily-tasks/ensure',
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
  const targetGoal = isTargetGoal(profileSource.targetGoal ?? profileSource.target_goal) ? (profileSource.targetGoal ?? profileSource.target_goal) as TargetGoal : null
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
  const rawScore = readNumber(reportSource.score)
  if (!cefrLevel || rawScore === null || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrLevel)) return null
  // The placement service stores score as a 0..1 ratio, while the learner-web
  // domain presents the same fact as a 0..100 score (the preview path already
  // uses that shape). Normalize at the adapter boundary so all pages agree.
  const score = rawScore >= 0 && rawScore <= 1 ? rawScore * 100 : rawScore
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
        targetGoal: readString(targetValue.goalCode) ?? readString(targetValue.goal_code) ?? readString(profileValue.targetGoal) ?? readString(profileValue.target_goal),
        dailyQuotaMinutes: readNumber(targetValue.dailyQuotaMinutes) ?? readNumber(targetValue.daily_quota_minutes) ?? readNumber(profileValue.dailyQuotaMinutes) ?? readNumber(profileValue.daily_quota_minutes),
      },
      goals: optionsValue.goals,
      quotas: optionsValue.quotas ?? optionsValue.dailyQuotaMinutes,
      contentLocale: readString(profileValue.contentLocale) ?? contentLocale,
    }, contentLocale, false)
  },

  async saveOnboarding(input: SaveOnboardingInput) {
    if (!input.profile.ageConfirmed || !input.profile.privacyConsent || !input.profile.termsConsent || !input.profile.birthYear || !input.profile.targetGoal || !input.profile.dailyQuotaMinutes) {
      throw new Error('成人 Gate、隐私/条款同意和学习目标必须全部完成后才能保存。')
    }
    const targetLevel = input.profile.targetGoal === 'ZERO_BASIS' ? 'A1' : input.profile.targetGoal === 'CET_4_6' ? 'B1' : 'B2'
    let featuredContent: ContentProjection | null = null
    try {
      featuredContent = parseContent(await request(query(READ_MODEL_PATHS.contentCatalog, 'en-US'))).find((item) => item.status === 'PUBLISHED') ?? null
    } catch {
      // Onboarding remains valid when content publication is temporarily unavailable;
      // the task projection is created on the next explicit save/retry.
    }
    await Promise.all([
      request<unknown>('/iam/consents', {
        method: 'PUT',
        body: { type: 'PRIVACY', version: 'b30-consent-v1', decision: 'ACCEPTED' },
        ...withIdempotency(`${input.clientEventId}-privacy`),
      }),
      request<unknown>('/iam/consents', {
        method: 'PUT',
        body: { type: 'TERMS', version: 'b30-consent-v1', decision: 'ACCEPTED' },
        ...withIdempotency(`${input.clientEventId}-terms`),
      }),
      // P1-LIVE-014: the server requires ADULT_LEARNING (LEARNING_REQUIRED) for
      // learning access; without it every learner endpoint stays 403 after an
      // otherwise complete UI onboarding.
      request<unknown>('/iam/consents', {
        method: 'PUT',
        body: { type: 'ADULT_LEARNING', version: 'b30-consent-v1', decision: 'ACCEPTED' },
        ...withIdempotency(`${input.clientEventId}-adult-learning`),
      }),
    ])
    // P1-LIVE-014: access tokens freeze eligibility at issuance, so the token
    // minted before these consents still carries UNKNOWN. Rotate once here so
    // the profile/targets/preferences writes below are evaluated as granted.
    // The browser sends the HttpOnly refresh cookie automatically.
    const rotated = (await request<unknown>('/auth/token/refresh', {
      method: 'POST',
      ...withIdempotency(`${input.clientEventId}-refresh`),
    })) as Record<string, unknown>
    const freshAccess =
      (rotated?.data as Record<string, unknown> | undefined)?.accessToken ?? rotated?.accessToken
    if (typeof freshAccess === 'string' && freshAccess.trim()) {
      const { setInMemoryAccessToken } = await import('../auth/access-token')
      setInMemoryAccessToken(freshAccess)
    }
    // P1-LIVE-014: the profile PATCH bumps the profile to version 1, and the
    // targets PUT is version-guarded against the PROFILE version, so it must
    // use the PATCH response (not a hardcoded 0), or every first save 409s.
    const patchedProfile = (await request<unknown>(READ_MODEL_PATHS.profile, {
      method: 'PATCH',
      body: {
        expectedStateVersion: 0,
        status: 'ACTIVE',
        birthYear: input.profile.birthYear,
        ageConfirmed: input.profile.ageConfirmed,
        privacyConsent: input.profile.privacyConsent,
        termsConsent: input.profile.termsConsent,
        uiLocale: 'zh-CN',
        contentLocale: 'en-US',
        timezone: 'Asia/Shanghai',
      },
      ...withIdempotency(`${input.clientEventId}-profile`),
    })) as Record<string, unknown>
    const profileData = (patchedProfile as Record<string, unknown>)?.data as Record<string, unknown> | undefined
    const profileVersion =
      typeof profileData?.stateVersion === 'number' ? profileData.stateVersion : 1
    // P1-LIVE-014: all learner writes share ONE profile version counter, so
    // parallel writes race (each bumps it; losers 409). Chain sequentially,
    // threading each response version into the next write.
    const savedTarget = (await request<unknown>(READ_MODEL_PATHS.target, {
      method: 'PUT',
      body: { expectedStateVersion: profileVersion, goalCode: input.profile.targetGoal, targetLevel, dailyQuotaMinutes: input.profile.dailyQuotaMinutes, status: 'ACTIVE' },
      ...withIdempotency(`${input.clientEventId}-target`),
    })) as Record<string, unknown>
    const targetData = (savedTarget as Record<string, unknown>)?.data as Record<string, unknown> | undefined
    const afterTargetVersion =
      typeof targetData?.stateVersion === 'number'
        ? targetData.stateVersion
        : typeof (savedTarget as Record<string, unknown>)?.stateVersion === 'number'
          ? ((savedTarget as Record<string, unknown>).stateVersion as number)
          : profileVersion + 1
    await request<unknown>(READ_MODEL_PATHS.preferences, {
      method: 'PATCH',
      body: { expectedStateVersion: afterTargetVersion, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
      ...withIdempotency(`${input.clientEventId}-preferences`),
    })
    if (featuredContent) {
      await request<unknown>(READ_MODEL_PATHS.taskEnsureCommand, {
        method: 'POST',
        body: { contentCode: featuredContent.contentId, title: featuredContent.title, minutes: input.profile.dailyQuotaMinutes },
        ...withIdempotency(`${input.clientEventId}-daily-task`),
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
    return parsePlacementModel(await request(query(READ_MODEL_PATHS.placement, input.contentLocale, { sessionId: input.sessionId })), input.contentLocale)
  },

  async startPlacement(input) {
    return parsePlacementModel(await request(READ_MODEL_PATHS.placement, {
      method: 'POST',
      body: { contentLocale: input.contentLocale },
      ...withIdempotency(input.clientEventId),
    }), input.contentLocale)
  },

  async submitPlacementAnswer(input: PlacementAnswerInput): Promise<PlacementSubmitResult> {
    const response = await request<unknown>(READ_MODEL_PATHS.placementAnswerCommand, {
      method: 'POST',
      body: input,
      ...withIdempotency(`placement-answer-${input.sessionId}-${input.questionId}-${input.selectedKey}`),
    })
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    const report = parseReport(source.report ?? source.finalReport ?? source)
    return {
      isCompleted: source.isCompleted === true || Boolean(report),
      nextQuestion: parseQuestion(source.nextQuestion ?? source.currentQuestion, input.sessionId),
      report,
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
