import { apiClient, type ApiRequestOptions } from './client'
import { createClientId } from '../platform/client-id'
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
  exportId: string
  status: 'QUEUED' | 'READY' | 'FAILED'
  redactionPolicy: 'learner-self'
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
  const key = createClientId('b1')
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
  // The old /onboarding/profile command belonged to the core-api compatibility
  // surface. The v2 learner owner stores profile, target and preference facts
  // through their canonical resources; keeping this adapter aligned prevents
  // the legacy B1 store from silently writing to a retired contract.
  const stateVersion = 0
  await Promise.all([
    apiClient.patch('/learner/profile', {
      expectedStateVersion: stateVersion,
      uiLocale: 'zh-CN',
      contentLocale: 'en-US',
      timezone: 'Asia/Shanghai',
    }, withIdempotency()),
    apiClient.put('/learner/targets', {
      expectedStateVersion: stateVersion,
      goalCode: profile.targetGoal ?? 'ZERO_BASIS',
      targetLevel: 'A1',
      dailyQuotaMinutes: profile.dailyQuotaMinutes ?? 15,
      status: 'ACTIVE',
    }, withIdempotency()),
    apiClient.patch('/learner/preferences', {
      expectedStateVersion: stateVersion,
      uiLocale: 'zh-CN',
      contentLocale: 'en-US',
      timezone: 'Asia/Shanghai',
      themeMode: 'SYSTEM',
      highContrast: false,
      motionMode: 'FULL',
    }, withIdempotency()),
  ])
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
  return apiClient.get('/learner/home')
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
  const [profileResponse, targetResponse] = await Promise.all([
    apiClient.get<unknown>('/learner/profile'),
    apiClient.get<unknown>('/learner/targets').catch(() => null),
  ])
  const profileSource = unwrap(profileResponse)
  const source = isRecord(profileSource) && isRecord(profileSource.data) ? profileSource.data : profileSource
  const targetEnvelope = targetResponse === null ? null : unwrap(targetResponse)
  const targetSource = isRecord(targetEnvelope) && isRecord(targetEnvelope.data) ? targetEnvelope.data : targetEnvelope
  if (!isRecord(source)) return null
  const targetGoal = (isRecord(targetSource) ? readString(targetSource.goalCode) : null)
    ?? readString(source.targetGoal) ?? readString(source.target_goal)
    ?? (isRecord(source) && isRecord(source.goal) ? readString(source.goal.goalCode) : null)
  const normalizedGoal = targetGoal === 'FOUNDATION' || targetGoal === 'WORKPLACE' ? (targetGoal === 'WORKPLACE' ? 'WORKPLACE_DAILY' : 'ZERO_BASIS') : targetGoal
  if (!['ZERO_BASIS', 'CET_4_6', 'POSTGRADUATE', 'WORKPLACE_DAILY'].includes(String(normalizedGoal))) return null
  const quota = (isRecord(targetSource) ? readNumber(targetSource.dailyQuotaMinutes) : null)
    ?? readNumber(source.dailyQuotaMinutes)
    ?? readNumber(source.daily_quota_minutes)
  if (![5, 15, 30, 45].includes(quota ?? 0)) return null
  return {
    nickname: readString(source.nickname) ?? '学习者',
    accentPref: source.accentPref === 'UK' || source.accent_pref === 'UK' ? 'UK' : 'US',
    dailyQuotaMinutes: quota as DailyQuotaMinutes,
    targetGoal: normalizedGoal as TargetGoal,
    profileVersion: readString(source.profileVersion) ?? (typeof source.stateVersion === 'number' ? String(source.stateVersion) : 'server'),
  }
}

export async function patchProfile(input: { nickname: string; accentPref: 'US' | 'UK'; dailyQuotaMinutes: DailyQuotaMinutes }): Promise<void> {
  const [current, target] = await Promise.all([
    apiClient.get<unknown>('/learner/profile'),
    apiClient.get<unknown>('/learner/targets').catch(() => null),
  ])
  const currentEnvelope = unwrap(current)
  const currentSource = isRecord(currentEnvelope) && isRecord(currentEnvelope.data) ? currentEnvelope.data : currentEnvelope
  const targetEnvelope = target === null ? null : unwrap(target)
  const targetSource = isRecord(targetEnvelope) && isRecord(targetEnvelope.data) ? targetEnvelope.data : targetEnvelope
  const stateVersion = isRecord(currentSource) && typeof currentSource.stateVersion === 'number' ? currentSource.stateVersion : 0
  const rawTargetGoal = (isRecord(targetSource) ? readString(targetSource.goalCode) : null)
    ?? (isRecord(currentSource) ? readString(currentSource.targetGoal) ?? readString(currentSource.target_goal) : null)
    ?? (isRecord(currentSource) && isRecord(currentSource.goal) ? readString(currentSource.goal.goalCode) : null)
    ?? 'ZERO_BASIS'
  const targetGoal = rawTargetGoal === 'FOUNDATION' || rawTargetGoal === 'WORKPLACE' ? (rawTargetGoal === 'WORKPLACE' ? 'WORKPLACE_DAILY' : 'ZERO_BASIS') : rawTargetGoal
  await apiClient.patch('/learner/profile', {
    expectedStateVersion: stateVersion,
    nickname: input.nickname,
    accentPref: input.accentPref,
  }, withIdempotency())
  await apiClient.put('/learner/targets', {
    expectedStateVersion: stateVersion,
    goalCode: targetGoal,
    targetLevel: targetGoal === 'ZERO_BASIS' ? 'A1' : targetGoal === 'CET_4_6' ? 'B1' : 'B2',
    dailyQuotaMinutes: input.dailyQuotaMinutes,
    status: 'ACTIVE',
  }, withIdempotency())
}

export async function fetchPrivacy(): Promise<PrivacySettings | null> {
  const response = await apiClient.get<unknown>('/learner/preferences')
  const envelope = unwrap(response)
  const source = isRecord(envelope) && isRecord(envelope.data) ? envelope.data : envelope
  if (!isRecord(source)) return null
  return {
    leaderboardVisibility: 'ANONYMOUS' as LeaderboardVisibility,
    feedVisibility: 'ROOM_ONLY' as FeedVisibility,
    showMinutes: (source.motionMode ?? source.motion_mode) !== 'OFF',
    showStreak: true,
    showCourse: false,
    showAssessment: false,
  }
}

export async function patchPrivacy(settings: PrivacySettings): Promise<void> {
  await apiClient.patch('/learner/preferences', {
    expectedStateVersion: 0,
    uiLocale: 'zh-CN',
    contentLocale: 'en-US',
    timezone: 'Asia/Shanghai',
    themeMode: 'SYSTEM',
    highContrast: settings.leaderboardVisibility === 'OPT_OUT',
    motionMode: settings.showMinutes ? 'FULL' : 'REDUCED',
  }, withIdempotency())
}

export async function fetchDevices(): Promise<DeviceSession[]> {
  const response = await apiClient.get<unknown>('/iam/devices')
  const source = unwrap(response)
  if (!isRecord(source) || !Array.isArray(source.items)) return []
  return source.items.flatMap((item): DeviceSession[] => {
    if (!isRecord(item)) return []
    const deviceId = readString(item.deviceId)
    if (!deviceId) return []
    return [{
      deviceId,
      deviceName: readString(item.deviceName) ?? '本地登录设备',
      deviceType: item.platform === 'IOS' || item.platform === 'ANDROID' || item.platform === 'H5' ? item.platform : 'WEB',
      clientVersion: readString(item.clientVersion) ?? 'unknown',
      lastActiveAt: readString(item.lastActiveAt) ?? new Date().toISOString(),
      region: readString(item.region) ?? '本地',
      current: item.current === true,
      status: item.status === 'KICKED' || item.status === 'REVOKED' ? 'KICKED' : 'ACTIVE',
    }]
  })
}

export async function kickDevice(deviceId: string): Promise<void> {
  await apiClient.post(`/iam/devices/${encodeURIComponent(deviceId)}/kickout`, {}, withIdempotency())
}

export async function kickOtherDevices(deviceIds: string[]): Promise<void> {
  // The Phase 1 contract has no batch revoke endpoint: kick one device per request,
  // each with its own idempotency key. Callers pass every non-current device id.
  for (const deviceId of deviceIds) {
    if (!deviceId) continue
    await apiClient.post(`/iam/devices/${encodeURIComponent(deviceId)}/kickout`, {}, withIdempotency())
  }
}

export async function fetchDeletion(): Promise<{ state: 'ACTIVE' | 'DELETION_PENDING'; executeAt: string | null } | null> {
  // Account deletion is deliberately not exposed as an uncontracted legacy call.
  // The Phase 1 web surface only exposes privacy export; deletion will be wired
  // when the IAM/learner privacy-request contract is published.
  return null
}

export async function requestDeletion(): Promise<{ state: 'ACTIVE' | 'DELETION_PENDING'; executeAt: string | null }> {
  throw new Error('账号注销流程尚未进入当前 Phase 1 Web 契约。')
}

export async function cancelDeletion(): Promise<void> {
  throw new Error('账号注销流程尚未进入当前 Phase 1 Web 契约。')
}

export async function requestDataExport(): Promise<DataExportResponse> {
  const response = await apiClient.post<unknown>('/privacy/export', { policyName: 'learner-self' }, withIdempotency())
  const source = unwrap(response)
  if (!isRecord(source)) throw new Error('隐私导出服务未返回导出作业。')
  const exportId = readString(source.exportId)
  if (!exportId) throw new Error('隐私导出服务未返回导出编号。')
  const status = source.status === 'READY' || source.status === 'FAILED' ? source.status : 'QUEUED'
  return { exportId, status, redactionPolicy: 'learner-self' }
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
