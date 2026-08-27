import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchContinueContext, fetchDevices, fetchHomeFeed, fetchPrivacy, fetchProfile, fetchDeletion, kickDevice, kickOtherDevices, loginWithPhone, patchPrivacy, patchProfile, requestDataExport, requestDeletion, requestSmsCode, saveContinueContext, saveOnboardingProfile, sendCheckpoint, skipPlacement, startPlacement, submitPlacementStep, type AuthTokens } from '../api/b1'
import { readAccessToken, useSessionStore } from './session'
import { createClientId } from '../platform/client-id'
import {
  B1_STORAGE_KEY,
  assessmentQuestions,
  calculateAssessmentReport,
  createDefaultAssessment,
  createDefaultContinueContext,
  createDefaultDeletion,
  createDefaultHome,
  createDefaultOnboarding,
  createDefaultPrivacy,
  createDefaultProfile,
  getLocalQuestion,
  getTargetLabel,
  isOnline,
  type AssessmentReport,
  type AssessmentSnapshot,
  type AssessmentStatus,
  type ContinueContext,
  type DailyQuotaMinutes,
  type DeletionStatus,
  type DeviceSession,
  type HomeSnapshot,
  type OnboardingProfile,
  type PrivacySettings,
  type ProfileSnapshot,
  type SubTag,
  type TargetGoal,
} from '../domain/b1'

const LOCAL_REAL_RUNTIME = import.meta.env.VITE_RUNTIME_MODE !== 'preview'

interface PersistedState {
  onboarding?: OnboardingProfile
  assessment?: AssessmentSnapshot
  continueContext?: ContinueContext | null
  home?: HomeSnapshot | null
  profile?: ProfileSnapshot
  privacy?: PrivacySettings
  devices?: DeviceSession[]
  deletion?: DeletionStatus
}

type B1ViewStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline'

function readPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(B1_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as PersistedState : null
  } catch {
    return null
  }
}

function createDeviceId(): string {
  return createClientId('web')
}

function getCurrentDevice(): DeviceSession {
  const deviceKey = 'yx.b1.device-id'
  let deviceId = ''
  if (typeof window !== 'undefined') deviceId = window.localStorage.getItem(deviceKey) ?? ''
  if (!deviceId) {
    deviceId = createDeviceId()
    if (typeof window !== 'undefined') window.localStorage.setItem(deviceKey, deviceId)
  }
  return { deviceId, deviceName: '当前浏览器', deviceType: 'WEB', clientVersion: 'B1', lastActiveAt: new Date().toISOString(), region: '本地', current: true, status: 'ACTIVE' }
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export const useB1Store = defineStore('b1', () => {
  const restored = ref(false)
  const syncState = ref<'local' | 'syncing' | 'synced' | 'offline' | 'error'>('local')
  const lastError = ref<string | null>(null)
  const onboarding = ref<OnboardingProfile>(createDefaultOnboarding())
  const assessment = ref<AssessmentSnapshot>(createDefaultAssessment())
  const continueContext = ref<ContinueContext | null>(null)
  const home = ref<HomeSnapshot | null>(null)
  const homeStatus = ref<B1ViewStatus>('idle')
  const profile = ref<ProfileSnapshot>(createDefaultProfile(onboarding.value))
  const privacy = ref<PrivacySettings>(createDefaultPrivacy())
  const devices = ref<DeviceSession[]>([getCurrentDevice()])
  const deletion = ref<DeletionStatus>(createDefaultDeletion())
  const accountActionStatus = ref<B1ViewStatus>('idle')

  const hasOnboardingConsent = computed(() => onboarding.value.ageConfirmed && onboarding.value.privacyConsent && onboarding.value.termsConsent)
  const hasPreferences = computed(() => Boolean(onboarding.value.targetGoal && onboarding.value.dailyQuotaMinutes))
  const assessmentProgress = computed(() => Math.min(assessment.value.answers.length, 10))
  const todayProgress = computed(() => {
    const data = home.value?.dailyStream
    return data && data.targetMinutes > 0 ? Math.min(100, Math.round(data.completedMinutes / data.targetMinutes * 100)) : 0
  })

  function persist(): void {
    if (typeof window === 'undefined') return
    const payload: PersistedState = {
      onboarding: onboarding.value,
      assessment: assessment.value,
      continueContext: continueContext.value,
      home: home.value,
      profile: profile.value,
      privacy: privacy.value,
      devices: devices.value,
      deletion: deletion.value,
    }
    try {
      window.localStorage.setItem(B1_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      lastError.value = '本地空间不足，当前进度未能完整保存。'
    }
  }

  function restore(): void {
    if (restored.value) return
    const saved = readPersisted()
    if (saved?.onboarding) onboarding.value = { ...createDefaultOnboarding(), ...saved.onboarding }
    if (saved?.assessment) assessment.value = { ...createDefaultAssessment(), ...saved.assessment }
    if (saved && 'continueContext' in saved) continueContext.value = saved.continueContext ?? null
    if (saved && 'home' in saved) home.value = saved.home ?? null
    profile.value = saved?.profile ?? createDefaultProfile(onboarding.value)
    if (saved?.privacy) privacy.value = { ...createDefaultPrivacy(), ...saved.privacy }
    if (saved?.devices?.length) devices.value = saved.devices
    if (saved?.deletion) deletion.value = { ...createDefaultDeletion(), ...saved.deletion }
    if (assessment.value.answers.length > 0 && assessment.value.status !== 'completed') {
      assessment.value.resumed = true
      assessment.value.status = 'ready'
      if (!assessment.value.currentQuestion) assessment.value.currentQuestion = getLocalQuestion(assessment.value.answers.length, assessment.value.sessionId ?? 'local-placement')
    }
    if (!continueContext.value && onboarding.value.completed) continueContext.value = createDefaultContinueContext()
    restored.value = true
  }

  function markSyncError(error: unknown, fallback: string): void {
    lastError.value = messageFor(error, fallback)
    syncState.value = isOnline() ? 'error' : 'offline'
  }

  function setConsent(input: { birthYear: number; ageConfirmed: boolean; privacyConsent: boolean; termsConsent: boolean }): void {
    onboarding.value = { ...onboarding.value, ...input, updatedAt: new Date().toISOString() }
    persist()
  }

  function setPreferences(targetGoal: TargetGoal, selectedSubTags: SubTag[], dailyQuotaMinutes: DailyQuotaMinutes): void {
    onboarding.value = { ...onboarding.value, targetGoal, subTags: selectedSubTags.slice(0, 3), dailyQuotaMinutes, updatedAt: new Date().toISOString() }
    profile.value = { ...profile.value, targetGoal, dailyQuotaMinutes }
    persist()
  }

  async function commitOnboarding(): Promise<void> {
    if (!hasOnboardingConsent.value || !hasPreferences.value) throw new Error('请先完成 18+、协议同意和目标偏好。')
    syncState.value = 'syncing'
    lastError.value = null
    onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
    persist()
    if (!readAccessToken()) {
      syncState.value = 'local'
      return
    }
    try {
      await saveOnboardingProfile(onboarding.value)
      syncState.value = 'synced'
    } catch (error) {
      markSyncError(error, '目标偏好已保存在本地，服务端同步稍后重试。')
    }
  }

  async function beginAssessment(): Promise<void> {
    restore()
    if (assessment.value.status === 'completed') return
    assessment.value.status = assessment.value.answers.length > 0 ? 'ready' : 'loading'
    lastError.value = null
    if (assessment.value.answers.length === 0) {
      assessment.value.sessionId = `local-${Date.now()}`
      assessment.value.currentQuestion = getLocalQuestion(0, assessment.value.sessionId)
    } else if (!assessment.value.currentQuestion) {
      assessment.value.currentQuestion = getLocalQuestion(assessment.value.answers.length, assessment.value.sessionId ?? 'local-placement')
    }
    if (readAccessToken()) {
      try {
        const question = await startPlacement()
        if (question) {
          assessment.value.sessionId = question.sessionId
          assessment.value.currentQuestion = question
        }
      } catch (error) {
        markSyncError(error, '测评题目暂时无法从服务端加载，已保留本地恢复路径。')
        assessment.value.status = isOnline() ? 'ready' : 'offline'
      }
    }
    assessment.value.status = assessment.value.currentQuestion ? 'ready' : 'error'
    assessment.value.lastSavedAt = new Date().toISOString()
    persist()
  }

  async function submitAnswer(selectedKey: string, timeSpentSec: number): Promise<void> {
    const current = assessment.value.currentQuestion
    const sessionId = assessment.value.sessionId ?? 'local-placement'
    if (!current || assessment.value.status === 'submitting' || assessment.value.status === 'completed') return
    if (assessment.value.answers.some((answer) => answer.questionId === current.questionId)) {
      assessment.value.currentQuestion = getLocalQuestion(assessment.value.answers.length, sessionId)
      persist()
      return
    }
    assessment.value.status = 'submitting'
    const answer: Parameters<typeof calculateAssessmentReport>[0][number] = {
      questionId: current.questionId,
      stepIndex: current.stepIndex,
      dimension: current.dimension,
      difficulty: current.difficulty,
      selectedKey,
      correct: current.correctKey ? current.correctKey === selectedKey : null,
      timeSpentSec: Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec))),
      submittedAt: new Date().toISOString(),
    }
    assessment.value.answers = [...assessment.value.answers, answer]
    assessment.value.currentQuestion = null
    persist()

    if (readAccessToken()) {
      try {
        const response = await submitPlacementStep({ sessionId, questionId: current.questionId, selectedKey, timeSpentSec: answer.timeSpentSec })
        if (response.finalReport) assessment.value.report = { ...response.finalReport, source: 'PLACEMENT' }
        if (response.nextQuestion) assessment.value.currentQuestion = response.nextQuestion
        if (response.isCompleted || assessment.value.answers.length >= 10) assessment.value.report ??= calculateAssessmentReport(assessment.value.answers)
      } catch (error) {
        markSyncError(error, '本题已记录在本地，联网后可继续同步。')
      }
    }
    if (assessment.value.answers.length >= 10 || assessment.value.report) {
      assessment.value.status = 'completed'
      assessment.value.report ??= calculateAssessmentReport(assessment.value.answers)
      onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
      home.value = createDefaultHome(onboarding.value, assessment.value.report)
      continueContext.value = createDefaultContinueContext()
    } else {
      assessment.value.currentQuestion = assessment.value.currentQuestion ?? getLocalQuestion(assessment.value.answers.length, sessionId)
      assessment.value.status = assessment.value.currentQuestion ? 'ready' : 'error'
    }
    assessment.value.lastSavedAt = new Date().toISOString()
    persist()
  }

  async function applyFastTrack(fastTrackLevel: 'ZERO_A1' | 'CET4_B1' | 'CET6_B2' | 'POSTGRAD_B2_PLUS'): Promise<void> {
    const levelMap = { ZERO_A1: { level: 1, cefrLevel: 'A1' }, CET4_B1: { level: 3, cefrLevel: 'B1' }, CET6_B2: { level: 4, cefrLevel: 'B2' }, POSTGRAD_B2_PLUS: { level: 4, cefrLevel: 'B2' } } as const
    const selected = levelMap[fastTrackLevel]
    const report: AssessmentReport = {
      score: selected.level * 16,
      level: selected.level,
      cefrLevel: selected.cefrLevel,
      estimatedVocabulary: selected.level === 1 ? 700 : selected.level === 3 ? 3200 : 5000,
      radarScores: { vocab: 60, grammar: 60, listening: 60, speed: 60, scenario: 60 },
      recommendedAdvice: '这是基于已有成绩的快速定级，后续可在设置中重新参加规则化测评。',
      source: 'FAST_TRACK',
      completedAt: new Date().toISOString(),
    }
    assessment.value = { ...createDefaultAssessment(), status: 'completed', report, lastSavedAt: new Date().toISOString() }
    onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
    home.value = createDefaultHome(onboarding.value, report)
    continueContext.value = createDefaultContinueContext()
    persist()
    if (readAccessToken()) {
      try { await skipPlacement(fastTrackLevel); syncState.value = 'synced' } catch (error) { markSyncError(error, '快速定级已保存在本地，服务端同步稍后重试。') }
    }
  }

  async function loadHome(): Promise<void> {
    restore()
    homeStatus.value = 'loading'
    lastError.value = null
    if (!home.value) home.value = createDefaultHome(onboarding.value, assessment.value.report)
    if (!continueContext.value && onboarding.value.completed) continueContext.value = createDefaultContinueContext()
    if (!readAccessToken()) {
      homeStatus.value = 'ready'
      persist()
      return
    }
    try {
      const remote = await fetchHomeFeed()
      const source = remote as { dailyStream?: { completedMinutes?: number; targetMinutes?: DailyQuotaMinutes } }
      if (source.dailyStream) {
        const completedMinutes = typeof source.dailyStream.completedMinutes === 'number' ? source.dailyStream.completedMinutes : home.value.dailyStream.completedMinutes
        home.value = { ...home.value, dailyStream: { ...home.value.dailyStream, completedMinutes, targetMinutes: source.dailyStream.targetMinutes ?? home.value.dailyStream.targetMinutes }, lastSyncedAt: new Date().toISOString() }
      }
      syncState.value = 'synced'
      homeStatus.value = 'ready'
    } catch (error) {
      homeStatus.value = isOnline() ? 'error' : 'offline'
      markSyncError(error, '今日任务暂时无法同步，正在显示最近一次本地快照。')
    }
    persist()
  }

  async function loadContinueContext(): Promise<void> {
    restore()
    if (!readAccessToken()) return
    try {
      const remote = await fetchContinueContext()
      if (remote) continueContext.value = remote
      persist()
    } catch (error) {
      markSyncError(error, '断点服务暂时不可用，已使用本地快照。')
    }
  }

  async function updateContinueContext(input: Partial<ContinueContext>): Promise<void> {
    const current = continueContext.value ?? createDefaultContinueContext()
    continueContext.value = { ...current, ...input, updatedAt: new Date().toISOString(), status: 'ACTIVE' }
    persist()
    if (!readAccessToken()) return
    try {
      await saveContinueContext(continueContext.value)
      // In local-real mode the learning-service owner is authoritative. The legacy
      // checkpoint endpoint belongs to the compatibility core-api and must not turn
      // a successful v2 write into a false error.
      if (!LOCAL_REAL_RUNTIME) await sendCheckpoint(continueContext.value)
      syncState.value = 'synced'
    } catch (error) { markSyncError(error, '断点已保存在本地，恢复联网后会继续同步。') }
  }

  function completeContinue(): void {
    continueContext.value = null
    if (home.value) home.value = { ...home.value, dailyStream: { ...home.value.dailyStream, completedMinutes: Math.min(home.value.dailyStream.targetMinutes, home.value.dailyStream.completedMinutes + 3) } }
    persist()
  }

  function completeTask(taskId: string): void {
    if (!home.value) home.value = createDefaultHome(onboarding.value, assessment.value.report)
    const task = home.value.dailyStream.tasks.find((item) => item.id === taskId)
    if (!task || task.completed) return
    const completedMinutes = Math.min(home.value.dailyStream.targetMinutes, home.value.dailyStream.completedMinutes + task.minutes)
    home.value = { ...home.value, dailyStream: { ...home.value.dailyStream, completedMinutes, tasks: home.value.dailyStream.tasks.map((item) => item.id === taskId ? { ...item, completed: true } : item) } }
    persist()
  }

  async function loadAccountData(): Promise<void> {
    restore()
    accountActionStatus.value = 'loading'
    lastError.value = null
    if (!readAccessToken()) { accountActionStatus.value = 'ready'; return }
    const results = await Promise.allSettled([fetchProfile(), fetchPrivacy(), fetchDevices(), fetchDeletion()])
    const [remoteProfile, remotePrivacy, remoteDevices, remoteDeletion] = results
    if (remoteProfile.status === 'fulfilled' && remoteProfile.value) profile.value = remoteProfile.value
    if (remotePrivacy.status === 'fulfilled' && remotePrivacy.value) privacy.value = remotePrivacy.value
    if (remoteDevices.status === 'fulfilled' && remoteDevices.value.length) devices.value = remoteDevices.value
    if (remoteDeletion.status === 'fulfilled' && remoteDeletion.value) deletion.value = remoteDeletion.value
    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') {
      accountActionStatus.value = 'ready'
      lastError.value = '账户资料、偏好和设备已从本地服务读取；注销请求暂未开放。'
    } else {
      accountActionStatus.value = 'ready'
    }
    persist()
  }

  async function saveProfile(input: { nickname: string; accentPref: 'US' | 'UK'; dailyQuotaMinutes: DailyQuotaMinutes }): Promise<void> {
    profile.value = { ...profile.value, ...input, profileVersion: `${Date.now()}` }
    onboarding.value = { ...onboarding.value, dailyQuotaMinutes: input.dailyQuotaMinutes }
    persist()
    if (!readAccessToken()) return
    try { await patchProfile(input); syncState.value = 'synced' } catch (error) { markSyncError(error, '资料已保存本地，服务端同步稍后重试。') }
  }

  async function savePrivacy(settings: PrivacySettings): Promise<void> {
    privacy.value = settings
    persist()
    if (!readAccessToken()) return
    try { await patchPrivacy(settings); syncState.value = 'synced' } catch (error) { markSyncError(error, '隐私设置已保存本地，服务端同步稍后重试。') }
  }

  async function refreshDevices(): Promise<void> {
    if (!readAccessToken()) return
    try { const remote = await fetchDevices(); if (remote.length) devices.value = remote; persist() } catch (error) { markSyncError(error, '设备列表暂时无法刷新。') }
  }

  async function removeDevice(deviceId: string): Promise<void> {
    const device = devices.value.find((item) => item.deviceId === deviceId)
    if (!device || device.current) { lastError.value = '当前设备不能从当前会话中踢出。'; return }
    try { await kickDevice(deviceId); devices.value = devices.value.map((item) => item.deviceId === deviceId ? { ...item, status: 'KICKED' } : item); persist() } catch (error) { markSyncError(error, '设备操作未完成，请联网后重试。') }
  }

  async function removeOtherDevices(): Promise<void> {
    try { await kickOtherDevices(); devices.value = devices.value.filter((item) => item.current); persist() } catch (error) { markSyncError(error, '其他设备尚未下线，请联网后重试。') }
  }

  async function exportData(): Promise<string | null> {
    accountActionStatus.value = 'loading'
    try {
      const response = await requestDataExport()
      accountActionStatus.value = 'ready'
      lastError.value = `隐私导出作业已创建：${response.exportId}（${response.status}）。`
      return response.exportId
    } catch (error) {
      accountActionStatus.value = isOnline() ? 'error' : 'offline'
      markSyncError(error, '导出申请需要已接入的隐私服务，当前未提交成功。')
      return null
    }
  }

  async function requestAccountDeletion(): Promise<void> {
    accountActionStatus.value = 'loading'
    try { deletion.value = await requestDeletion(); accountActionStatus.value = 'ready'; persist() } catch (error) { accountActionStatus.value = isOnline() ? 'error' : 'offline'; markSyncError(error, '注销申请未提交，账号仍保持可用。') }
  }

  async function cancelAccountDeletion(): Promise<void> {
    accountActionStatus.value = 'loading'
    try { await (await import('../api/b1')).cancelDeletion(); deletion.value = createDefaultDeletion(); accountActionStatus.value = 'ready'; persist() } catch (error) { accountActionStatus.value = isOnline() ? 'error' : 'offline'; markSyncError(error, '注销取消未提交，请联网后重试。') }
  }

  function applyLogin(tokens: AuthTokens): void {
    useSessionStore().setTokenPair(tokens)
    lastError.value = null
  }

  async function sendLoginCode(phone: string): Promise<void> {
    await requestSmsCode(phone)
  }

  async function login(phone: string, code: string): Promise<void> {
    const deviceId = devices.value.find((item) => item.current)?.deviceId ?? createDeviceId()
    applyLogin(await loginWithPhone(phone, code, deviceId))
  }

  return {
    restored, syncState, lastError, onboarding, assessment, continueContext, home, homeStatus, profile, privacy, devices, deletion, accountActionStatus,
    hasOnboardingConsent, hasPreferences, assessmentProgress, todayProgress,
    restore, persist, setConsent, setPreferences, commitOnboarding, beginAssessment, submitAnswer, applyFastTrack, loadHome, loadContinueContext, updateContinueContext, completeContinue, completeTask,
    loadAccountData, saveProfile, savePrivacy, refreshDevices, removeDevice, removeOtherDevices, exportData, requestAccountDeletion, cancelAccountDeletion, sendLoginCode, login, getTargetLabel,
    assessmentQuestions,
  }
})
