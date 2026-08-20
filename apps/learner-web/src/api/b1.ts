import { apiClient, type ApiRequestOptions } from './client'
import type {
  AssessmentReport,
  ContinueContext,
  DailyQuotaMinutes,
  DeviceSession,
  FeedVisibility,
  LeaderboardVisibility,
  OnboardingProfile,
  PlacementQuestion,
  PrivacySettings,
  ProfileSnapshot,
  SubTag,
  TargetGoal,
} from '../domain/b1'

interface RecordValue {
  [key: string]: unknown
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  devicePublicId: string
  userId?: string
}

export interface AssessmentStepResponse {
  isCompleted: boolean
  nextQuestion: PlacementQuestion | null
  finalReport: AssessmentReport | null
}

export interface DataExportResponse {
  status: 'READY' | 'PROCESSING'
  downloadUrl: string | null
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  return 'data' in value ? value.data : value
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function withIdempotency(options: ApiRequestOptions = {}): ApiRequestOptions {
  const key = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `b1-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return { ...options, headers: { ...(options.headers ?? {}), 'Idempotency-Key': key } }
}

function parseQuestion(value: unknown, fallbackSessionId: string, fallbackStepIndex: number): PlacementQuestion | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const questionSource = isRecord(source.question) ? source.question : source
  const questionId = readString(questionSource.questionId) ?? readString(questionSource.id)
  const stemText = readString(questionSource.stemText) ?? readString(questionSource.prompt)
  const optionsSource = Array.isArray(questionSource.options) ? questionSource.options : []
  const options = optionsSource.flatMap((item): Array<{ key: string; text: string }> => {
    if (!isRecord(item)) return []
    const key = readString(item.key)
    const text = readString(item.text)
    return key && text ? [{ key, text }] : []
  })
  const dimension = questionSource.dimension === 'GRAMMAR' || questionSource.dimension === 'LISTENING' ? questionSource.dimension : 'VOCABULARY'
  if (!questionId || !stemText || options.length === 0) return null
  return {
    questionId,
    sessionId: readString(source.sessionUuid) ?? readString(source.sessionId) ?? fallbackSessionId,
    stepIndex: readNumber(source.stepIndex) ?? fallbackStepIndex,
    totalSteps: readNumber(source.totalSteps) ?? 10,
    dimension,
    difficulty: readNumber(questionSource.difficulty) ?? 2,
    stemText,
    helperText: readString(questionSource.helperText) ?? `${dimension === 'VOCABULARY' ? '词汇识别' : dimension === 'GRAMMAR' ? '基础语法' : '听力理解'} · 规则化测评`,
    options,
    correctKey: null,
    timeLimitSec: readNumber(questionSource.timeLimitSec) ?? 25,
  }
}

function parseReport(value: unknown): AssessmentReport | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const reportSource = isRecord(source.finalReport) ? source.finalReport : source
  const score = readNumber(reportSource.score)
  const cefr = readString(reportSource.cefrLevel)
  if (score === null || !cefr || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefr)) return null
  const radar = isRecord(reportSource.radarScores) ? reportSource.radarScores : {}
  return {
    score,
    level: cefr === 'A1' ? 1 : cefr === 'A2' ? 2 : cefr === 'B1' ? 3 : cefr === 'B2' ? 4 : cefr === 'C1' ? 5 : 6,
    cefrLevel: cefr as AssessmentReport['cefrLevel'],
    estimatedVocabulary: readNumber(reportSource.estimatedVocabulary) ?? 0,
    radarScores: {
      vocab: readNumber(radar.vocab) ?? 0,
      grammar: readNumber(radar.grammar) ?? 0,
      listening: readNumber(radar.listening) ?? 0,
      speed: readNumber(radar.speed) ?? 0,
      scenario: readNumber(radar.scenario) ?? 0,
    },
    recommendedAdvice: readString(reportSource.recommendedAdvice) ?? '根据本次作答结果，系统会为你安排首周学习建议。',
    source: 'PLACEMENT',
    completedAt: new Date().toISOString(),
  }
}

function parseTokens(value: unknown): AuthTokens | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const accessToken = readString(source.accessToken)
  const refreshToken = readString(source.refreshToken)
  const devicePublicId = readString(source.devicePublicId)
  if (!accessToken || !refreshToken || !devicePublicId) return null
  return {
    accessToken,
    refreshToken,
    devicePublicId,
    expiresIn: readNumber(source.expiresIn) ?? 7200,
    refreshExpiresIn: readNumber(source.refreshExpiresIn) ?? 2592000,
    userId: readString(source.userId) ?? undefined,
  }
}

export async function requestSmsCode(phone: string): Promise<void> {
  await apiClient.post('/auth/sms/send-code', { phone, adultConfirmed: true, scene: 'LOGIN' }, withIdempotency())
}

export async function loginWithPhone(phone: string, code: string, deviceId: string): Promise<AuthTokens> {
  const response = await apiClient.post<unknown>('/auth/login/phone', {
    phone,
    code,
    adultConfirmed: true,
    privacyConsent: true,
    privacyPolicyVersion: 'phase1-privacy-v1',
    device: { deviceId, deviceType: 'WEB', deviceName: 'Learner Web', clientVersion: 'b1' },
  }, withIdempotency())
  const tokens = parseTokens(response)
  if (!tokens) throw new Error('登录响应缺少有效的双 Token，已阻止进入学习空间。')
  return tokens
}

export async function saveOnboardingProfile(profile: OnboardingProfile): Promise<void> {
  await apiClient.post('/onboarding/profile', {
    targetGoal: profile.targetGoal,
    subTags: profile.subTags,
    dailyQuotaMinutes: profile.dailyQuotaMinutes,
  }, withIdempotency())
}

export async function startPlacement(): Promise<PlacementQuestion | null> {
  const sessionId = `placement-${Date.now()}`
  const response = await apiClient.post<unknown>('/assessment/placement/start', {}, withIdempotency())
  return parseQuestion(response, sessionId, 1)
}

export async function submitPlacementStep(input: { sessionId: string; questionId: string; selectedKey: string; timeSpentSec: number }): Promise<AssessmentStepResponse> {
  const response = await apiClient.post<unknown>('/assessment/placement/submit-step', {
    sessionUuid: input.sessionId,
    questionId: input.questionId,
    selectedAnswer: input.selectedKey,
    timeSpentSec: input.timeSpentSec,
  }, withIdempotency())
  const source = unwrap(response)
  const sourceRecord = isRecord(source) ? source : {}
  return {
    isCompleted: readBoolean(sourceRecord.isCompleted) ?? Boolean(parseReport(sourceRecord)),
    nextQuestion: parseQuestion(sourceRecord.nextQuestion, input.sessionId, 1),
    finalReport: parseReport(sourceRecord.finalReport),
  }
}

export async function skipPlacement(fastTrackLevel: string): Promise<void> {
  await apiClient.post('/assessment/placement/skip', { fastTrackLevel }, withIdempotency())
}

export async function fetchHomeFeed(): Promise<unknown> {
  return apiClient.get('/home/feed')
}

export async function fetchContinueContext(): Promise<ContinueContext | null> {
  const response = await apiClient.get<unknown>('/learning/continue-context')
  const source = unwrap(response)
  if (!isRecord(source) || source.hasContext === false) return null
  const moduleId = readString(source.moduleId)
  const lessonId = readString(source.lessonId)
  if (!moduleId || !lessonId) return null
  return {
    moduleId,
    moduleLabel: readString(source.moduleLabel) ?? '学习任务',
    lessonId,
    lessonTitle: readString(source.lessonTitle) ?? '继续上次学习',
    stepIndex: readNumber(source.stepIndex) ?? 1,
    totalSteps: readNumber(source.totalSteps) ?? 1,
    elapsedTimeMs: readNumber(source.elapsedTimeMs) ?? 0,
    updatedAt: readString(source.updatedAt) ?? new Date().toISOString(),
    status: source.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
  }
}

export async function saveContinueContext(context: ContinueContext): Promise<void> {
  await apiClient.put('/learning/continue-context', context, withIdempotency())
}

export async function fetchProfile(): Promise<ProfileSnapshot | null> {
  const response = await apiClient.get<unknown>('/user/profile')
  const source = unwrap(response)
  if (!isRecord(source)) return null
  const targetGoal = source.targetGoal
  if (!['ZERO_BASIS', 'CET_4_6', 'POSTGRADUATE', 'WORKPLACE_DAILY'].includes(String(targetGoal))) return null
  const quota = readNumber(source.dailyQuotaMinutes)
  if (![5, 15, 30, 45].includes(quota ?? 0)) return null
  return {
    nickname: readString(source.nickname) ?? '学习者',
    accentPref: source.accentPref === 'UK' ? 'UK' : 'US',
    dailyQuotaMinutes: quota as DailyQuotaMinutes,
    targetGoal: targetGoal as TargetGoal,
    profileVersion: readString(source.profileVersion) ?? 'server',
  }
}

export async function patchProfile(input: { nickname: string; accentPref: 'US' | 'UK'; dailyQuotaMinutes: DailyQuotaMinutes }): Promise<void> {
  await apiClient.patch('/user/profile', input, withIdempotency())
}

export async function fetchPrivacy(): Promise<PrivacySettings | null> {
  const response = await apiClient.get<unknown>('/user/privacy')
  const source = unwrap(response)
  if (!isRecord(source)) return null
  const leaderboard = source.leaderboardVisibility
  const feed = source.feedVisibility
  if (!['NICKNAME', 'ANONYMOUS', 'OPT_OUT'].includes(String(leaderboard)) || !['PUBLIC', 'ROOM_ONLY', 'GROUP_ONLY', 'HIDDEN'].includes(String(feed))) return null
  return {
    leaderboardVisibility: leaderboard as LeaderboardVisibility,
    feedVisibility: feed as FeedVisibility,
    showMinutes: readBoolean(source.showMinutes) ?? true,
    showStreak: readBoolean(source.showStreak) ?? true,
    showCourse: readBoolean(source.showCourse) ?? false,
    showAssessment: readBoolean(source.showAssessment) ?? false,
  }
}

export async function patchPrivacy(settings: PrivacySettings): Promise<void> {
  await apiClient.patch('/user/privacy', settings, withIdempotency())
}

export async function fetchDevices(): Promise<DeviceSession[]> {
  const response = await apiClient.get<unknown>('/user/devices')
  const source = unwrap(response)
  if (!isRecord(source) || !Array.isArray(source.items)) return []
  return source.items.flatMap((item): DeviceSession[] => {
    if (!isRecord(item)) return []
    const deviceId = readString(item.deviceId)
    if (!deviceId) return []
    return [{
      deviceId,
      deviceName: readString(item.deviceName) ?? '未知设备',
      deviceType: item.deviceType === 'IOS' || item.deviceType === 'ANDROID' || item.deviceType === 'H5' ? item.deviceType : 'WEB',
      clientVersion: readString(item.clientVersion) ?? 'unknown',
      lastActiveAt: readString(item.lastActiveAt) ?? new Date().toISOString(),
      region: readString(item.region) ?? '未知区域',
      current: item.current === true,
      status: item.status === 'KICKED' ? 'KICKED' : 'ACTIVE',
    }]
  })
}

export async function kickDevice(deviceId: string): Promise<void> {
  await apiClient.post(`/user/devices/${encodeURIComponent(deviceId)}/kick`, {}, withIdempotency())
}

export async function kickOtherDevices(): Promise<void> {
  await apiClient.post('/user/devices/kickout', {}, withIdempotency())
}

export async function fetchDeletion(): Promise<{ state: 'ACTIVE' | 'DELETION_PENDING'; executeAt: string | null } | null> {
  const response = await apiClient.get<unknown>('/user/deletion')
  const source = unwrap(response)
  if (!isRecord(source)) return null
  return { state: source.state === 'DELETION_PENDING' ? 'DELETION_PENDING' : 'ACTIVE', executeAt: readString(source.executeAt) }
}

export async function requestDeletion(): Promise<{ state: 'ACTIVE' | 'DELETION_PENDING'; executeAt: string | null }> {
  const response = await apiClient.post<unknown>('/user/deletion', { reasonCode: 'USER_REQUEST', confirmation: true }, withIdempotency())
  const source = unwrap(response)
  return { state: 'DELETION_PENDING', executeAt: isRecord(source) ? readString(source.executeAt) : null }
}

export async function cancelDeletion(): Promise<void> {
  await apiClient.request('/user/deletion', withIdempotency({ method: 'DELETE' }))
}

export async function requestDataExport(): Promise<DataExportResponse> {
  const response = await apiClient.post<unknown>('/user/data-export', { format: 'JSON', scope: 'SELF' }, withIdempotency())
  const source = unwrap(response)
  if (!isRecord(source)) return { status: 'PROCESSING', downloadUrl: null }
  return { status: source.status === 'READY' ? 'READY' : 'PROCESSING', downloadUrl: readString(source.downloadUrl) }
}

export async function sendCheckpoint(context: ContinueContext): Promise<void> {
  await apiClient.put(`/sync/checkpoints/${encodeURIComponent(context.lessonId)}`, {
    moduleId: context.moduleId,
    stepIndex: context.stepIndex,
    totalSteps: context.totalSteps,
    elapsedTimeMs: context.elapsedTimeMs,
    updatedAt: context.updatedAt,
  }, withIdempotency())
}

export function isApiUnavailable(error: unknown): boolean {
  return error instanceof TypeError || (isRecord(error) && typeof error.status === 'number' && error.status >= 500)
}
