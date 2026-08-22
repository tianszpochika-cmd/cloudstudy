import { mobileApiClient, MobileApiError } from './client'
import type { MobileContentCard, MobileFirstDayModel, MobileHomeModel, MobileOnboardingModel, MobileTask } from '../domain/learner-content'

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
function query(path: string, contentLocale: string): string { return `${path}?contentLocale=${encodeURIComponent(contentLocale)}` }

function mapError(error: unknown): MobileApiError {
  if (error instanceof MobileApiError) return error
  return new MobileApiError('学习数据暂时不可用，请稍后重试。', 0, error)
}

function parseOnboarding(profileValue: unknown, targetValue: unknown, preferenceValue: unknown): MobileOnboardingModel {
  const profile = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const target = isRecord(unwrap(targetValue)) ? unwrap(targetValue) as RecordValue : {}
  const preferences = isRecord(unwrap(preferenceValue)) ? unwrap(preferenceValue) as RecordValue : {}
  return {
    goal: text(target.goalCode ?? profile.targetGoal) || null,
    quota: number(target.dailyQuotaMinutes, 0) || null,
    uiLocale: text(preferences.uiLocale ?? profile.uiLocale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? profile.contentLocale, 'en-US'),
    completed: text(profile.status) === 'ACTIVE',
    stateVersion: number(profile.stateVersion, 0),
  }
}

function parseTask(value: unknown, index: number): MobileTask | null {
  if (!isRecord(value)) return null
  const id = text(value.taskId ?? value.id)
  if (!id) return null
  const status = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE'].includes(text(value.status)) ? text(value.status) as MobileTask['status'] : 'AVAILABLE'
  return {
    id,
    type: text(value.taskType ?? value.type, 'LESSON'),
    title: text(value.title, `今日任务 ${index + 1}`),
    description: text(value.description ?? value.summary, '按服务端内容版本继续学习。'),
    minutes: number(value.minutes ?? value.estimatedMinutes, 5),
    status,
    contentCode: text(value.contentCode) || undefined,
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
    const [profile, target, preferences] = await Promise.all([
      mobileApiClient.request<unknown>(query('/learner/profile', contentLocale)),
      mobileApiClient.request<unknown>(query('/learner/targets', contentLocale)),
      mobileApiClient.request<unknown>(query('/learner/preferences', contentLocale)),
    ])
    return parseOnboarding(profile, target, preferences)
  },

  async saveOnboarding(input: { goal: string; quota: number; clientEventId: string }): Promise<MobileOnboardingModel> {
    const targetLevel = input.goal === 'ZERO_BASIS' ? 'A1' : input.goal === 'CET_4_6' ? 'B1' : 'B2'
    await Promise.all([
      mobileApiClient.request('/learner/profile', { method: 'PATCH', data: { expectedStateVersion: 0, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai' }, header: { 'Idempotency-Key': `${input.clientEventId}-profile` } }),
      mobileApiClient.request('/learner/targets', { method: 'PUT', data: { expectedStateVersion: 0, goalCode: input.goal, targetLevel, dailyQuotaMinutes: input.quota, status: 'ACTIVE' }, header: { 'Idempotency-Key': `${input.clientEventId}-target` } }),
      mobileApiClient.request('/learner/preferences', { method: 'PATCH', data: { expectedStateVersion: 0, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' }, header: { 'Idempotency-Key': `${input.clientEventId}-preferences` } }),
    ])
    return mobileLearnerContentApi.readOnboarding()
  },

  async readFirstDay(contentLocale = 'en-US'): Promise<MobileFirstDayModel> {
    const response = await mobileApiClient.request<unknown>(query('/learner/first-day', contentLocale))
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return { state: ['NOT_READY', 'READY', 'DEGRADED'].includes(text(source.state)) ? text(source.state) as MobileFirstDayModel['state'] : 'NOT_READY', profileReady: source.profileReady === true, targetReady: source.targetReady === true, placementStatus: text(source.placementStatus, 'NOT_STARTED'), taskCount: number(source.taskCount), contentEpoch: number(source.contentEpoch), projectionVersion: number(source.projectionVersion, 1) }
  },

  async readHome(contentLocale = 'en-US'): Promise<MobileHomeModel> {
    const [learner, content] = await Promise.all([
      mobileApiClient.request<unknown>(query('/learner/home', contentLocale)),
      mobileApiClient.request<unknown>(query('/content/learner/catalog', contentLocale)),
    ])
    return parseHome(learner, content)
  },

  async completeTask(taskId: string, clientEventId: string): Promise<MobileHomeModel | null> {
    const response = await mobileApiClient.request<unknown>(`/onboarding/daily-tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', data: { taskId }, header: { 'Idempotency-Key': clientEventId } })
    return response === undefined ? null : parseHome(response, response)
  },
}

export function mobileLearnerContentError(error: unknown): Error {
  const apiError = mapError(error)
  if (apiError.status === 403) return new Error('当前会话没有访问该学习投影的权限。')
  if (apiError.status === 404) return new Error('当前内容版本已下线或暂不可用。')
  return apiError
}
