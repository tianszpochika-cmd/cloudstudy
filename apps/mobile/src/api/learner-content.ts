import { mobileApiClient, MobileApiError } from './client'
import type { MobileContentCard, MobileContentDetail, MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileLearnerAccount, MobileMotionMode, MobileOnboardingModel, MobilePlacementModel, MobilePlacementQuestion, MobilePlacementReport, MobileTask, MobileThemeMode } from '../domain/learner-content'

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}
function text(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value.trim() : fallback }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
type QueryParams = string | Record<string, string | null | undefined>

function query(path: string, params: QueryParams): string {
  const values = typeof params === 'string' ? { contentLocale: params } : params
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  return `${path}?${search.toString()}`
}

async function requestOptional(path: string): Promise<unknown | null> {
  try { return await mobileApiClient.request<unknown>(path) }
  catch (error) { if (error instanceof MobileApiError && error.status === 404) return null; throw error }
}

function mapError(error: unknown): MobileApiError {
  if (error instanceof MobileApiError) return error
  return new MobileApiError('学习数据暂时不可用，请稍后重试。', 0, error)
}

function parseGoalOptions(value: unknown): MobileGoalOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): MobileGoalOption[] => {
    if (!isRecord(item)) return []
    const valueText = text(item.value ?? item.code)
    const label = text(item.label, valueText)
    return valueText && label ? [{ value: valueText, label, description: text(item.description) || undefined }] : []
  })
}

function parseQuotas(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === 'number' && [5, 15, 30, 45].includes(item))
}

function parseOnboarding(profileValue: unknown, targetValue: unknown, preferenceValue: unknown, optionsValue: unknown): MobileOnboardingModel {
  const profile = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const target = isRecord(unwrap(targetValue)) ? unwrap(targetValue) as RecordValue : {}
  const preferences = isRecord(unwrap(preferenceValue)) ? unwrap(preferenceValue) as RecordValue : {}
  const options = isRecord(unwrap(optionsValue)) ? unwrap(optionsValue) as RecordValue : {}
  return {
    goal: text(target.goalCode ?? target.goal_code ?? profile.targetGoal ?? profile.target_goal) || null,
    quota: number(target.dailyQuotaMinutes ?? target.daily_quota_minutes, 0) || null,
    goals: parseGoalOptions(options.goals),
    quotas: parseQuotas(options.dailyQuotaMinutes ?? options.quotas),
    birthYear: number(profile.birthYear ?? profile.birth_year, 0) || null,
    ageConfirmed: profile.ageConfirmed === true || profile.age_confirmed === true,
    privacyConsent: profile.privacyConsent === true || profile.privacy_consent === true,
    termsConsent: profile.termsConsent === true || profile.terms_consent === true,
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    completed: text(profile.status).toUpperCase() === 'ACTIVE',
    stateVersion: number(profile.stateVersion ?? profile.state_version, 0),
  }
}

function parseAccount(value: unknown): MobileLearnerAccount {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const profile = isRecord(source.profile) ? source.profile : source
  const goal = isRecord(source.goal) ? source.goal : {}
  const preferences = isRecord(source.preferences) ? source.preferences : {}
  const themeMode = text(preferences.themeMode ?? preferences.theme_mode ?? profile.themeMode ?? profile.theme_mode, 'SYSTEM')
  const motionMode = text(preferences.motionMode ?? preferences.motion_mode, 'FULL')
  return {
    nickname: text(profile.nickname, '学习者'),
    accentPref: text(profile.accentPref ?? profile.accent_pref, 'US') === 'UK' ? 'UK' : 'US',
    birthYear: number(profile.birthYear ?? profile.birth_year, 0) || null,
    ageConfirmed: profile.ageConfirmed === true || profile.age_confirmed === true,
    privacyConsent: profile.privacyConsent === true || profile.privacy_consent === true,
    termsConsent: profile.termsConsent === true || profile.terms_consent === true,
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    timezone: text(preferences.timezone ?? preferences.timezone ?? profile.timezone, 'Asia/Shanghai'),
    themeMode: ['SYSTEM', 'LIGHT', 'DARK'].includes(themeMode) ? themeMode as MobileThemeMode : 'SYSTEM',
    highContrast: preferences.highContrast === true || preferences.high_contrast === true,
    motionMode: ['FULL', 'REDUCED', 'OFF'].includes(motionMode) ? motionMode as MobileMotionMode : 'FULL',
    goal: text(goal.goalCode ?? goal.goal_code) || null,
    quota: number(goal.dailyQuotaMinutes ?? goal.daily_quota_minutes, 0) || null,
    stateVersion: number(profile.stateVersion ?? profile.state_version, 0),
  }
}

function parseTask(value: unknown, index: number): MobileTask | null {
  if (!isRecord(value)) return null
  const id = text(value.taskId ?? value.task_id ?? value.id)
  if (!id) return null
  const statusValue = text(value.status ?? value.task_status)
  const status = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE'].includes(statusValue) ? statusValue as MobileTask['status'] : 'AVAILABLE'
  return {
    id,
    type: text(value.taskType ?? value.task_type ?? value.type, 'LESSON'),
    title: text(value.title, `今日任务 ${index + 1}`),
    description: text(value.description ?? value.summary, '按服务端内容版本继续学习。'),
    minutes: number(value.minutes ?? value.estimatedMinutes, 5),
    status,
    contentCode: text(value.contentCode ?? value.content_code) || undefined,
    contentVersionPin: number(value.contentVersionPin, 0) || undefined,
    unavailableReason: text(value.unavailableReason) || undefined,
  }
}

function parseContent(value: unknown): MobileContentCard[] {
  const source = unwrap(value)
  const record = isRecord(source) ? source : {}
  const items = Array.isArray(record.items) ? record.items : Array.isArray(source) ? source : []
  return items.flatMap((item): MobileContentCard[] => {
    if (!isRecord(item)) return []
    const contentCode = text(item.contentCode ?? item.id)
    if (!contentCode) return []
    const availability = ['PUBLISHED', 'UNPUBLISHED', 'RIGHTS_PENDING', 'RIGHTS_EXPIRED', 'NOT_READY'].includes(text(item.availability)) ? text(item.availability) as MobileContentCard['availability'] : 'NOT_READY'
    return [{ contentCode, contentType: text(item.contentType, 'COURSE'), title: text(item.title, contentCode), summary: text(item.summary ?? item.description), contentLocale: text(item.contentLocale, 'en-US'), contentVersionId: number(item.contentVersionId, 0) || null, availability }]
  })
}

function parseContentDetail(value: unknown): MobileContentDetail {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const detail = isRecord(source.content) ? source.content : source
  const contentCode = text(detail.contentCode ?? detail.contentId ?? detail.id)
  const title = text(detail.title)
  if (!contentCode || !title) throw new Error('服务端课程内容格式无效。')
  const items = Array.isArray(detail.items) ? detail.items.flatMap((item, index) => {
    if (!isRecord(item)) return []
    return [{
      itemId: text(item.itemId ?? item.itemCode ?? item.id, `${contentCode}:item:${index + 1}`),
      itemType: text(item.itemType ?? item.type, 'LESSON'),
      text: text(item.text ?? item.displayText ?? item.prompt ?? item.content),
      options: Array.isArray(item.options) ? item.options.flatMap((option) => {
        if (!isRecord(option)) return []
        const key = text(option.key); const optionText = text(option.text)
        return key && optionText ? [{ key, text: optionText }] : []
      }) : [],
    }]
  }) : []
  return {
    contentCode,
    contentVersionId: number(detail.contentVersionId ?? detail.versionId, 0) || null,
    contentType: text(detail.contentType ?? detail.kind, 'COURSE_UNIT'),
    title,
    summary: text(detail.summary ?? detail.description),
    contentLocale: text(detail.contentLocale, 'en-US'),
    items,
  }
}

function parsePlacementQuestion(value: unknown): MobilePlacementQuestion | null {
  if (!isRecord(value)) return null
  const questionId = text(value.questionId ?? value.itemId)
  if (!questionId) return null
  const rawOptions = Array.isArray(value.options) ? value.options : []
  return {
    questionId,
    stemText: text(value.stemText ?? value.prompt, '请完成本题。'),
    options: rawOptions.flatMap((option): Array<{ key: string; text: string }> => {
      if (!isRecord(option)) return []
      const key = text(option.key ?? option.optionCode)
      const optionText = text(option.text ?? option.label)
      return key && optionText ? [{ key, text: optionText }] : []
    }),
    dimension: text(value.dimension, 'VOCABULARY'),
    difficulty: number(value.difficulty, 1),
    stepIndex: number(value.stepIndex, 1),
    totalSteps: number(value.totalSteps, 2),
    timeLimitSec: number(value.timeLimitSec, 25),
  }
}

function parsePlacementReport(value: unknown): MobilePlacementReport | null {
  if (!isRecord(value)) return null
  const reportId = text(value.reportId)
  const sessionId = text(value.sessionId)
  if (!reportId || !sessionId) return null
  const mistakes = Array.isArray(value.mistakes) ? value.mistakes.filter((item): item is string => typeof item === 'string') : []
  return { reportId, sessionId, cefrLevel: text(value.cefrLevel, 'A1'), score: number(value.score, 0), mistakes }
}

function parsePlacement(value: unknown): MobilePlacementModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  return {
    sessionId: text(source.sessionId) || null,
    status: text(source.status, 'EMPTY'),
    currentQuestion: parsePlacementQuestion(source.currentQuestion ?? source.nextQuestion),
    report: parsePlacementReport(source.report),
    isCompleted: source.isCompleted === true || text(source.status) === 'COMPLETED',
  }
}

function parseHome(learnerValue: unknown, contentValue: unknown): MobileHomeModel {
  const source = isRecord(unwrap(learnerValue)) ? unwrap(learnerValue) as RecordValue : {}
  const firstDay = isRecord(source.firstDay) ? source.firstDay : {}
  const dailyStream = isRecord(source.dailyStream) ? source.dailyStream : {}
  const rawTasks = Array.isArray(source.tasks) ? source.tasks : Array.isArray(firstDay.tasks) ? firstDay.tasks : []
  const tasks = rawTasks.flatMap((item, index) => { const task = parseTask(item, index); return task ? [task] : [] })
  const content = parseContent(contentValue)
  const contentStatus = content.length ? 'READY' : text(source.contentStatus) === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'EMPTY'
  return {
    projectionVersion: number(source.projectionVersion, 1),
    contentEpoch: number(source.contentEpoch, 0),
    tasks,
    content,
    contentStatus,
    completedMinutes: number(source.completedMinutes ?? dailyStream.completedMinutes, 0),
    targetMinutes: number(source.targetMinutes ?? dailyStream.targetMinutes, 15),
    stale: source.stale === true || text(source.degradedReason) !== '',
  }
}

export const mobileLearnerContentApi = {
  async readOnboarding(contentLocale = 'en-US'): Promise<MobileOnboardingModel> {
    const [profile, target, preferences, options] = await Promise.all([
      requestOptional(query('/learner/profile', contentLocale)),
      requestOptional(query('/learner/targets', contentLocale)),
      requestOptional(query('/learner/preferences', contentLocale)),
      requestOptional(query('/learner/onboarding/options', contentLocale)),
    ])
    return parseOnboarding(profile, target, preferences, options)
  },

  async saveOnboarding(input: { goal: string; quota: number; clientEventId: string; birthYear?: number; ageConfirmed?: boolean; privacyConsent?: boolean; termsConsent?: boolean }): Promise<MobileOnboardingModel> {
    const targetLevel = input.goal === 'ZERO_BASIS' ? 'A1' : input.goal === 'CET_4_6' ? 'B1' : 'B2'
    let featuredContent: MobileContentCard | null = null
    try {
      featuredContent = parseContent(await mobileApiClient.request<unknown>(query('/content/learner/catalog', 'en-US')))
        .find((item) => item.availability === 'PUBLISHED') ?? null
    } catch {
      // Onboarding remains authoritative even when the optional content projection is temporarily unavailable.
    }
    await Promise.all([
      mobileApiClient.request('/iam/consents', { method: 'PUT', data: { consentType: 'PRIVACY', consentVersion: 'b30-consent-v1', decision: 'ACCEPTED' }, header: { 'Idempotency-Key': `${input.clientEventId}-privacy` } }),
      mobileApiClient.request('/iam/consents', { method: 'PUT', data: { consentType: 'TERMS', consentVersion: 'b30-consent-v1', decision: 'ACCEPTED' }, header: { 'Idempotency-Key': `${input.clientEventId}-terms` } }),
      mobileApiClient.request('/learner/profile', { method: 'PATCH', data: { expectedStateVersion: 0, status: 'ACTIVE', ...(input.birthYear ? { birthYear: input.birthYear, ageConfirmed: input.ageConfirmed ?? true, privacyConsent: input.privacyConsent ?? true, termsConsent: input.termsConsent ?? true } : {}), uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai' }, header: { 'Idempotency-Key': `${input.clientEventId}-profile` } }),
      mobileApiClient.request('/learner/targets', { method: 'PUT', data: { expectedStateVersion: 0, goalCode: input.goal, targetLevel, dailyQuotaMinutes: input.quota, status: 'ACTIVE' }, header: { 'Idempotency-Key': `${input.clientEventId}-target` } }),
      mobileApiClient.request('/learner/preferences', { method: 'PATCH', data: { expectedStateVersion: 0, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' }, header: { 'Idempotency-Key': `${input.clientEventId}-preferences` } }),
    ])
    if (featuredContent) {
      await mobileApiClient.request('/onboarding/daily-tasks/ensure', {
        method: 'POST',
        data: { contentCode: featuredContent.contentCode, title: featuredContent.title, minutes: input.quota },
        header: { 'Idempotency-Key': `${input.clientEventId}-daily-task` },
      })
    }
    return mobileLearnerContentApi.readOnboarding()
  },

  async readAccount(): Promise<MobileLearnerAccount> {
    return parseAccount(await mobileApiClient.request<unknown>('/learner/profile'))
  },

  async saveProfile(input: { nickname: string; accentPref: 'US' | 'UK'; clientEventId: string }): Promise<MobileLearnerAccount> {
    const current = await mobileLearnerContentApi.readAccount()
    await mobileApiClient.request('/learner/profile', { method: 'PATCH', data: { expectedStateVersion: current.stateVersion, nickname: input.nickname, accentPref: input.accentPref }, header: { 'Idempotency-Key': input.clientEventId } })
    return mobileLearnerContentApi.readAccount()
  },

  async savePreferences(input: { themeMode: MobileThemeMode; highContrast: boolean; motionMode: MobileMotionMode; clientEventId: string }): Promise<MobileLearnerAccount> {
    const current = await mobileLearnerContentApi.readAccount()
    await mobileApiClient.request('/learner/preferences', { method: 'PATCH', data: { expectedStateVersion: current.stateVersion, uiLocale: current.uiLocale, contentLocale: current.contentLocale, timezone: current.timezone, themeMode: input.themeMode, highContrast: input.highContrast, motionMode: input.motionMode }, header: { 'Idempotency-Key': input.clientEventId } })
    return mobileLearnerContentApi.readAccount()
  },

  async readFirstDay(contentLocale = 'en-US'): Promise<MobileFirstDayModel> {
    const response = await mobileApiClient.request<unknown>(query('/learner/first-day', contentLocale))
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return { state: ['NOT_READY', 'READY', 'DEGRADED'].includes(text(source.state)) ? text(source.state) as MobileFirstDayModel['state'] : 'NOT_READY', profileReady: source.profileReady === true, targetReady: source.targetReady === true, placementStatus: text(source.placementStatus, 'NOT_STARTED'), taskCount: number(source.taskCount), contentEpoch: number(source.contentEpoch), projectionVersion: number(source.projectionVersion, 1) }
  },

  async readPlacement(contentLocale = 'en-US', sessionId?: string | null): Promise<MobilePlacementModel> {
    return parsePlacement(await mobileApiClient.request<unknown>(query('/assessment/placement/start', { contentLocale, ...(sessionId ? { sessionId } : {}) })))
  },

  async startPlacement(contentLocale = 'en-US', clientEventId: string): Promise<MobilePlacementModel> {
    return parsePlacement(await mobileApiClient.request<unknown>('/assessment/placement/start', {
      method: 'POST',
      data: { contentCode: 'course-b25-basics', contentLocale },
      header: { 'Idempotency-Key': clientEventId },
    }))
  },

  async submitPlacementAnswer(input: { sessionId: string; questionId: string; selectedKey: string; timeSpentSec: number; contentLocale: string; clientEventId: string }): Promise<MobilePlacementModel> {
    return parsePlacement(await mobileApiClient.request<unknown>('/assessment/placement/submit-step', {
      method: 'POST',
      data: input,
      header: { 'Idempotency-Key': input.clientEventId },
    }))
  },

  async readHome(contentLocale = 'en-US'): Promise<MobileHomeModel> {
    const [learner, content] = await Promise.all([
      mobileApiClient.request<unknown>(query('/learner/home', contentLocale)),
      mobileApiClient.request<unknown>(query('/content/learner/catalog', contentLocale)),
    ])
    return parseHome(learner, content)
  },

  async readContent(contentCode: string): Promise<MobileContentDetail> {
    return parseContentDetail(await mobileApiClient.request<unknown>(`/content/learner/${encodeURIComponent(contentCode)}`))
  },

  async completeTask(taskId: string, clientEventId: string): Promise<MobileHomeModel | null> {
    const response = await mobileApiClient.request<unknown>(`/onboarding/daily-tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', data: { taskId }, header: { 'Idempotency-Key': clientEventId } })
    return response === undefined ? null : parseHome(response, response)
  },
}

export function mobileLearnerContentError(error: unknown): Error {
  const apiError = mapError(error)
  if (apiError.status === 401) return new Error('请先登录后再保存学习目标。')
  if (apiError.status === 403) return new Error('当前会话没有访问该学习投影的权限。')
  if (apiError.status === 404) return new Error('当前内容版本已下线或暂不可用。')
  return apiError
}
