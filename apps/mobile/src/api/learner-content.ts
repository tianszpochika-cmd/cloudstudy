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
function requireStateVersion(value: unknown): number {
  const source = unwrap(value)
  if (isRecord(source) && typeof source.stateVersion === 'number' && Number.isSafeInteger(source.stateVersion) && source.stateVersion >= 0) {
    return source.stateVersion
  }
  throw new Error('学习设置版本暂时无法读取，请重试。')
}
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
  catch (error) {
    if (error instanceof MobileApiError && error.status === 404) return null
    if (error instanceof MobileApiError && error.status === 403 && isConsentRequired(error.details)) return null
    throw error
  }
}

function isConsentRequired(details: unknown): boolean {
  if (!isRecord(details)) return false
  const source = isRecord(details.error) ? details.error : details
  return source.code === 'CONSENT_REQUIRED'
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

function parseAccount(profileValue: unknown, targetValue: unknown, preferencesValue: unknown): MobileLearnerAccount {
  const source = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const profile = isRecord(source.profile) ? source.profile : source
  const target = unwrap(targetValue)
  const goal = isRecord(target) ? target : isRecord(source.goal) ? source.goal : {}
  const remotePreferences = unwrap(preferencesValue)
  const preferences = isRecord(remotePreferences) ? remotePreferences : isRecord(source.preferences) ? source.preferences : {}
  const themeMode = text(preferences.themeMode ?? preferences.theme_mode ?? profile.themeMode ?? profile.theme_mode, 'SYSTEM')
  const motionMode = text(preferences.motionMode ?? preferences.motion_mode, 'FULL')
  return {
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    timezone: text(preferences.timezone ?? preferences.timezone ?? profile.timezone, 'Asia/Shanghai'),
    themeMode: ['SYSTEM', 'LIGHT', 'DARK'].includes(themeMode) ? themeMode as MobileThemeMode : 'SYSTEM',
    highContrast: preferences.highContrast === true || preferences.high_contrast === true,
    motionMode: ['FULL', 'REDUCED', 'OFF'].includes(motionMode) ? motionMode as MobileMotionMode : 'FULL',
    goal: text(goal.goalCode ?? goal.goal_code) || null,
    quota: number(goal.dailyQuotaMinutes ?? goal.daily_quota_minutes, 0) || null,
    // The preferences aggregate owns this version. The profile version may
    // have changed independently (for example, after an onboarding update).
    stateVersion: requireStateVersion(preferencesValue),
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
  const skipped = value.resultKind === 'SKIPPED'
  const requestedStartingLevel = isRecord(value.requestedStartingLevel) ? text(value.requestedStartingLevel.level) : null
  const mistakes = Array.isArray(value.mistakes) ? value.mistakes.filter((item): item is string => typeof item === 'string') : []
  return {
    reportId, sessionId, resultKind: skipped ? 'SKIPPED' : 'ASSESSED',
    cefrLevel: skipped ? null : text(value.cefrLevel) || null,
    score: skipped ? null : typeof value.score === 'number' ? value.score : null,
    requestedStartingLevel: skipped ? requestedStartingLevel : null,
    mistakes,
  }
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

function requireSameIdentity(isCurrent?: () => boolean): void {
  if (isCurrent && !isCurrent()) throw new Error('账号已变化，请重新打开页面后操作。')
}

export const mobileLearnerContentApi = {
  async readOnboarding(): Promise<MobileOnboardingModel> {
    // Preferences are the canonical source for content locale. Resolve them
    // before requesting locale-specific onboarding options so a cached or
    // former account locale cannot leak into this learning read.
    const preferences = await requestOptional('/learner/preferences')
    const preferenceData = unwrap(preferences)
    const contentLocale = isRecord(preferenceData)
      ? text(preferenceData.contentLocale ?? preferenceData.content_locale, 'en-US')
      : 'en-US'
    const [profile, target, options] = await Promise.all([
      requestOptional(query('/learner/profile', contentLocale)),
      requestOptional(query('/learner/targets', contentLocale)),
      requestOptional(query('/onboarding/options', contentLocale)),
    ])
    return parseOnboarding(profile, target, preferences, options)
  },

  async saveOnboarding(input: { goal: string; quota: number; clientEventId: string; birthYear?: number; ageConfirmed?: boolean; privacyConsent?: boolean; termsConsent?: boolean }, isCurrent?: () => boolean): Promise<MobileOnboardingModel> {
    requireSameIdentity(isCurrent)
    if (!input.birthYear || !input.ageConfirmed || !input.privacyConsent || !input.termsConsent || !input.goal || !input.quota) {
      throw new Error('请先完成成人确认、同意事项和学习目标。')
    }
    const targetLevel = input.goal === 'ZERO_BASIS' ? 'A1' : input.goal === 'CET_4_6' ? 'B1' : 'B2'
    // Consent is an IAM fact. Learner writes require a freshly issued access
    // token carrying that fact, and each write advances one profile version.
    await Promise.all([
      mobileApiClient.request('/iam/consents', { method: 'PUT', data: { type: 'PRIVACY', version: 'b30-consent-v1', decision: 'ACCEPTED' }, header: { 'Idempotency-Key': `${input.clientEventId}-privacy` } }),
      mobileApiClient.request('/iam/consents', { method: 'PUT', data: { type: 'TERMS', version: 'b30-consent-v1', decision: 'ACCEPTED' }, header: { 'Idempotency-Key': `${input.clientEventId}-terms` } }),
      mobileApiClient.request('/iam/consents', { method: 'PUT', data: { type: 'ADULT_LEARNING', version: 'b30-consent-v1', decision: 'ACCEPTED' }, header: { 'Idempotency-Key': `${input.clientEventId}-adult-learning` } }),
    ])
    requireSameIdentity(isCurrent)
    const [{ useSessionStore }, { pinia }] = await Promise.all([import('../stores/session'), import('../stores/pinia')])
    requireSameIdentity(isCurrent)
    const session = useSessionStore(pinia)
    if (!await session.refreshSilently()) throw new Error(session.lastError || '会话更新失败，请重新登录。')
    requireSameIdentity(isCurrent)

    // Re-read the owner after IAM refresh. A previous attempt may have saved
    // only some steps before the network failed; its new retry key must not
    // start again at version zero or invent a daily task from client content.
    const [profile, existingTarget, existingPreferences] = await Promise.all([
      mobileApiClient.request<unknown>('/learner/profile'),
      mobileApiClient.request<unknown>('/learner/targets').catch((error: unknown) => {
        if (error instanceof MobileApiError && error.status === 404) return null
        throw error
      }),
      mobileApiClient.request<unknown>('/learner/preferences'),
    ])
    requireSameIdentity(isCurrent)
    let currentVersion = requireStateVersion(profile)
    const targetData = unwrap(existingTarget)
    const targetMatches = isRecord(targetData)
      && text(targetData.goalCode) === input.goal
      && number(targetData.dailyQuotaMinutes, -1) === input.quota
      && text(targetData.targetLevel) === targetLevel
      && text(targetData.status) === 'ACTIVE'
    if (!targetMatches) {
      const target = await mobileApiClient.request<unknown>('/learner/targets', {
        method: 'PUT',
        data: { expectedStateVersion: currentVersion, goalCode: input.goal, targetLevel, dailyQuotaMinutes: input.quota, status: 'ACTIVE' },
        header: { 'Idempotency-Key': `${input.clientEventId}-target` },
      })
      requireSameIdentity(isCurrent)
      currentVersion = requireStateVersion(target)
    }
    requireSameIdentity(isCurrent)
    const preferences = unwrap(existingPreferences)
    const preferencesMatch = isRecord(preferences)
      && text(preferences.uiLocale) === 'zh-CN'
      && text(preferences.contentLocale) === 'en-US'
      && text(preferences.timezone) === 'Asia/Shanghai'
      && text(preferences.themeMode) === 'SYSTEM'
      && preferences.highContrast === false
      && text(preferences.motionMode) === 'FULL'
    if (!preferencesMatch) {
      await mobileApiClient.request('/learner/preferences', {
        method: 'PATCH',
        data: { expectedStateVersion: currentVersion, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
        header: { 'Idempotency-Key': `${input.clientEventId}-preferences` },
      })
      requireSameIdentity(isCurrent)
    }
    const result = await mobileLearnerContentApi.readOnboarding()
    requireSameIdentity(isCurrent)
    return result
  },

  async readAccount(): Promise<MobileLearnerAccount> {
    const [profile, target, preferences] = await Promise.all([
      mobileApiClient.request<unknown>('/learner/profile'),
      requestOptional('/learner/targets'),
      requestOptional('/learner/preferences'),
    ])
    return parseAccount(profile, target, preferences)
  },

  async savePreferences(input: { themeMode?: MobileThemeMode; highContrast?: boolean; motionMode?: MobileMotionMode; contentLocale?: string; clientEventId: string }, isCurrent?: () => boolean): Promise<MobileLearnerAccount> {
    requireSameIdentity(isCurrent)
    const current = await mobileLearnerContentApi.readAccount()
    requireSameIdentity(isCurrent)
    const data: Record<string, unknown> = { expectedStateVersion: current.stateVersion }
    if (input.contentLocale !== undefined) data.contentLocale = input.contentLocale
    if (input.themeMode !== undefined || input.highContrast !== undefined || input.motionMode !== undefined) {
      data.uiLocale = current.uiLocale
      data.contentLocale = input.contentLocale ?? current.contentLocale
      data.timezone = current.timezone
      data.themeMode = input.themeMode ?? current.themeMode
      data.highContrast = input.highContrast ?? current.highContrast
      data.motionMode = input.motionMode ?? current.motionMode
    }
    if (Object.keys(data).length === 1) throw new Error('没有可保存的学习偏好。')
    await mobileApiClient.request('/learner/preferences', { method: 'PATCH', data, header: { 'Idempotency-Key': input.clientEventId } })
    requireSameIdentity(isCurrent)
    const result = await mobileLearnerContentApi.readAccount()
    requireSameIdentity(isCurrent)
    if (input.contentLocale !== undefined && result.contentLocale !== input.contentLocale) {
      throw new Error('学习内容语言尚未由账户确认，请重试。')
    }
    return result
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
