import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { fetchContinueContext, fetchDevices, fetchHomeFeed, fetchPrivacy, fetchProfile, fetchDeletion, kickDevice, kickOtherDevices, loginWithPhone, patchPrivacy, putDailyQuota, requestDataExport, requestDeletion, requestSmsCode, saveContinueContext, saveOnboardingProfile, sendCheckpoint, skipPlacement, startPlacement, submitPlacementStep, type AuthTokens, type ProfileTargetSnapshot } from '../api/b1'
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
  subject: string
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

function readPersisted(subject: string): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(B1_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && (parsed as PersistedState).subject === subject) return parsed as PersistedState
    // Legacy snapshots have no owner. A different verified account must never inherit them.
    window.localStorage.removeItem(B1_STORAGE_KEY)
    return null
  } catch {
    try { window.localStorage.removeItem(B1_STORAGE_KEY) } catch { /* ignore */ }
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
  const session = useSessionStore()
  const verifiedSubject = computed(() => {
    const subject = session.principal?.subject?.trim()
    return session.accessToken && subject && (!session.userId || session.userId === subject) ? subject : null
  })
  const activeSubject = ref<string | null>(verifiedSubject.value)
  const activeGeneration = ref(session.authGeneration)
  const restored = ref(false)
  const syncState = ref<'local' | 'syncing' | 'synced' | 'offline' | 'error'>('local')
  const lastError = ref<string | null>(null)
  const onboarding = ref<OnboardingProfile>(createDefaultOnboarding())
  const assessment = ref<AssessmentSnapshot>(createDefaultAssessment())
  const continueContext = ref<ContinueContext | null>(null)
  const home = ref<HomeSnapshot | null>(null)
  const homeStatus = ref<B1ViewStatus>('idle')
  const profile = ref<ProfileSnapshot>(createDefaultProfile(onboarding.value))
  const profileStatus = ref<B1ViewStatus>('idle')
  const privacy = ref<PrivacySettings>(createDefaultPrivacy())
  const devices = ref<DeviceSession[]>(LOCAL_REAL_RUNTIME ? [] : [getCurrentDevice()])
  const deviceStatus = ref<B1ViewStatus>('idle')
  const deletion = ref<DeletionStatus>(createDefaultDeletion())
  const accountActionStatus = ref<B1ViewStatus>('idle')
  let continueReadVersion = 0

  function resetForSubject(subject: string | null): void {
    ++continueReadVersion
    activeSubject.value = subject
    activeGeneration.value = session.authGeneration
    restored.value = false
    syncState.value = 'local'
    lastError.value = null
    onboarding.value = createDefaultOnboarding()
    assessment.value = createDefaultAssessment()
    continueContext.value = null
    home.value = null
    homeStatus.value = 'idle'
    profile.value = createDefaultProfile(onboarding.value)
    profileStatus.value = 'idle'
    privacy.value = createDefaultPrivacy()
    devices.value = LOCAL_REAL_RUNTIME ? [] : [getCurrentDevice()]
    deviceStatus.value = 'idle'
    deletion.value = createDefaultDeletion()
    accountActionStatus.value = 'idle'
  }

  watch([verifiedSubject, () => session.authGeneration], ([subject, generation], [previous]) => {
    if (subject === activeSubject.value && generation === activeGeneration.value) return
    if (previous && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(B1_STORAGE_KEY) } catch { /* restore still verifies the owner */ }
    }
    resetForSubject(subject)
  }, { flush: 'sync' })

  function stillCurrent(subject: string | null, generation: number): boolean {
    return Boolean(subject && session.status === 'authenticated'
      && generation === session.authGeneration && generation === activeGeneration.value
      && subject === activeSubject.value && subject === verifiedSubject.value)
  }

  const hasOnboardingConsent = computed(() => onboarding.value.ageConfirmed && onboarding.value.privacyConsent && onboarding.value.termsConsent)
  const hasPreferences = computed(() => Boolean(onboarding.value.targetGoal && onboarding.value.dailyQuotaMinutes))
  const assessmentProgress = computed(() => Math.min(assessment.value.answers.length, 10))
  const todayProgress = computed(() => {
    const data = home.value?.dailyStream
    return data && data.targetMinutes > 0 ? Math.min(100, Math.round(data.completedMinutes / data.targetMinutes * 100)) : 0
  })

  function persist(): void {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (typeof window === 'undefined' || !subject || !stillCurrent(subject, generation)) return
    const payload: PersistedState = {
      subject,
      onboarding: onboarding.value,
      assessment: assessment.value,
      // The learning owner is authoritative for a real checkpoint. Never restore
      // a stale local checkpoint before its current read has succeeded.
      ...(!LOCAL_REAL_RUNTIME ? { continueContext: continueContext.value } : {}),
      home: home.value,
      profile: profile.value,
      privacy: privacy.value,
      // Device/session facts belong to IAM. Never restore a cached local list as
      // current account authority in the real runtime.
      ...(!LOCAL_REAL_RUNTIME ? { devices: devices.value } : {}),
      deletion: deletion.value,
    }
    try {
      window.localStorage.setItem(B1_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      lastError.value = '本地空间不足，当前进度未能完整保存。'
    }
  }

  function restore(): void {
    const subject = verifiedSubject.value
    if (!subject) {
      if (activeSubject.value) resetForSubject(null)
      return
    }
    if (activeSubject.value !== subject) resetForSubject(subject)
    if (restored.value) return
    const saved = readPersisted(subject)
    if (saved?.onboarding) onboarding.value = { ...createDefaultOnboarding(), ...saved.onboarding }
    if (saved?.assessment) assessment.value = { ...createDefaultAssessment(), ...saved.assessment }
    if (!LOCAL_REAL_RUNTIME && saved && 'continueContext' in saved) continueContext.value = saved.continueContext ?? null
    if (saved && 'home' in saved) home.value = saved.home ?? null
    profile.value = saved?.profile ?? createDefaultProfile(onboarding.value)
    if (saved?.privacy) privacy.value = { ...createDefaultPrivacy(), ...saved.privacy }
    if (!LOCAL_REAL_RUNTIME && saved?.devices?.length) devices.value = saved.devices
    if (saved?.deletion) deletion.value = { ...createDefaultDeletion(), ...saved.deletion }
    if (assessment.value.answers.length > 0 && assessment.value.status !== 'completed') {
      assessment.value.resumed = true
      assessment.value.status = 'ready'
      if (!assessment.value.currentQuestion) assessment.value.currentQuestion = getLocalQuestion(assessment.value.answers.length, assessment.value.sessionId ?? 'local-placement')
    }
    if (!LOCAL_REAL_RUNTIME && !continueContext.value && onboarding.value.completed) continueContext.value = createDefaultContinueContext()
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
    restore()
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) throw new Error('请重新登录后重试。')
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
      if (!stillCurrent(subject, generation)) return
      syncState.value = 'synced'
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      markSyncError(error, '目标偏好已保存在本地，服务端同步稍后重试。')
    }
  }

  async function beginAssessment(): Promise<void> {
    restore()
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    if (assessment.value.status === 'completed') return
    assessment.value.status = 'loading'
    lastError.value = null
    if (!readAccessToken()) {
      assessment.value.currentQuestion = null
      assessment.value.status = 'error'
      lastError.value = '请先登录后再开始定级。'
      persist()
      return
    }
    try {
      const question = await startPlacement()
      if (!stillCurrent(subject, generation)) return
      if (!question?.sessionId?.startsWith('asess_')) {
        assessment.value.sessionId = null
        assessment.value.currentQuestion = null
        assessment.value.status = 'error'
        lastError.value = '定级题没有从服务端开始，没有改用本地题目。'
      } else {
        assessment.value.sessionId = question.sessionId
        assessment.value.currentQuestion = question
        assessment.value.status = 'ready'
      }
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      assessment.value.sessionId = null
      assessment.value.currentQuestion = null
      assessment.value.status = 'error'
      markSyncError(error, '定级题暂时无法开始，没有创建本地题目。')
    }
    assessment.value.lastSavedAt = new Date().toISOString()
    persist()
  }

  async function submitAnswer(selectedKey: string, timeSpentSec: number): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
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
        if (!stillCurrent(subject, generation)) return
        if (response.finalReport) assessment.value.report = { ...response.finalReport, source: 'PLACEMENT' }
        if (response.nextQuestion) assessment.value.currentQuestion = response.nextQuestion
        if (response.isCompleted || assessment.value.answers.length >= 10) assessment.value.report ??= calculateAssessmentReport(assessment.value.answers)
      } catch (error) {
        if (!stillCurrent(subject, generation)) return
        markSyncError(error, '本题已记录在本地，联网后可继续同步。')
      }
    }
    if (assessment.value.answers.length >= 10 || assessment.value.report) {
      assessment.value.status = 'completed'
      assessment.value.report ??= calculateAssessmentReport(assessment.value.answers)
      onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
      home.value = createDefaultHome(onboarding.value, assessment.value.report)
      continueContext.value = LOCAL_REAL_RUNTIME ? null : createDefaultContinueContext()
    } else {
      assessment.value.currentQuestion = assessment.value.currentQuestion ?? getLocalQuestion(assessment.value.answers.length, sessionId)
      assessment.value.status = assessment.value.currentQuestion ? 'ready' : 'error'
    }
    assessment.value.lastSavedAt = new Date().toISOString()
    persist()
  }

  async function applyFastTrack(fastTrackLevel: 'ZERO_A1' | 'CET4_B1' | 'CET6_B2' | 'POSTGRAD_B2_PLUS'): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
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
    continueContext.value = LOCAL_REAL_RUNTIME ? null : createDefaultContinueContext()
    persist()
    if (readAccessToken()) {
      try { await skipPlacement(fastTrackLevel); if (stillCurrent(subject, generation)) syncState.value = 'synced' }
      catch (error) { if (stillCurrent(subject, generation)) markSyncError(error, '快速定级已保存在本地，服务端同步稍后重试。') }
    }
  }

  async function loadHome(): Promise<void> {
    restore()
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    homeStatus.value = 'loading'
    lastError.value = null
    if (!home.value) home.value = createDefaultHome(onboarding.value, assessment.value.report)
    if (!LOCAL_REAL_RUNTIME && !continueContext.value && onboarding.value.completed) continueContext.value = createDefaultContinueContext()
    if (!readAccessToken()) {
      homeStatus.value = 'ready'
      persist()
      return
    }
    try {
      const remote = await fetchHomeFeed()
      if (!stillCurrent(subject, generation)) return
      const source = remote as { dailyStream?: { completedMinutes?: number; targetMinutes?: DailyQuotaMinutes } }
      if (source.dailyStream) {
        const completedMinutes = typeof source.dailyStream.completedMinutes === 'number' ? source.dailyStream.completedMinutes : home.value.dailyStream.completedMinutes
        home.value = { ...home.value, dailyStream: { ...home.value.dailyStream, completedMinutes, targetMinutes: source.dailyStream.targetMinutes ?? home.value.dailyStream.targetMinutes }, lastSyncedAt: new Date().toISOString() }
      }
      syncState.value = 'synced'
      homeStatus.value = 'ready'
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      homeStatus.value = isOnline() ? 'error' : 'offline'
      markSyncError(error, '今日任务暂时无法同步，正在显示最近一次本地快照。')
    }
    persist()
  }

  async function loadContinueContext(): Promise<void> {
    restore()
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (LOCAL_REAL_RUNTIME) continueContext.value = null
    if (!stillCurrent(subject, generation)) return
    lastError.value = null
    const readVersion = ++continueReadVersion
    try {
      const remote = await fetchContinueContext()
      if (!stillCurrent(subject, generation) || readVersion !== continueReadVersion) return
      continueContext.value = remote
      persist()
    } catch (error) {
      if (!stillCurrent(subject, generation) || readVersion !== continueReadVersion) return
      if (LOCAL_REAL_RUNTIME) continueContext.value = null
      markSyncError(error, '断点暂时无法读取，请稍后重试。')
    }
  }

  async function updateContinueContext(input: Partial<ContinueContext>): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) { lastError.value = '请重新登录后重试。'; return }
    ++continueReadVersion
    lastError.value = null
    const current = continueContext.value ?? createDefaultContinueContext()
    const next = { ...current, ...input, updatedAt: new Date().toISOString(), status: 'ACTIVE' as const }
    if (!LOCAL_REAL_RUNTIME) { continueContext.value = next; persist() }
    try {
      await saveContinueContext(next)
      if (!stillCurrent(subject, generation)) return
      // In local-real mode the learning-service owner is authoritative. The legacy
      // checkpoint endpoint belongs to the compatibility core-api and must not turn
      // a successful v2 write into a false error.
      if (!LOCAL_REAL_RUNTIME) await sendCheckpoint(next)
      if (!stillCurrent(subject, generation)) return
      continueContext.value = next
      persist()
      syncState.value = 'synced'
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      if (LOCAL_REAL_RUNTIME) continueContext.value = null
      markSyncError(error, LOCAL_REAL_RUNTIME ? '断点未确认保存，请重试。' : '断点已保存在本地，恢复联网后会继续同步。')
    }
  }

  function completeContinue(): void {
    ++continueReadVersion
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
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    accountActionStatus.value = 'loading'
    profileStatus.value = 'loading'
    deviceStatus.value = 'loading'
    lastError.value = null
    if (!readAccessToken()) { accountActionStatus.value = 'error'; profileStatus.value = 'error'; deviceStatus.value = 'error'; devices.value = []; return }
    const results = await Promise.allSettled([fetchProfile(), fetchPrivacy(),
      session.deviceId ? fetchDevices(session.deviceId) : Promise.reject(new Error('当前设备身份不可用')),
      fetchDeletion()])
    if (!stillCurrent(subject, generation)) return
    const [remoteProfile, remotePrivacy, remoteDevices, remoteDeletion] = results
    if (remoteProfile.status === 'fulfilled') applyProfileTarget(remoteProfile.value)
    profileStatus.value = remoteProfile.status === 'fulfilled' ? 'ready' : 'error'
    if (remotePrivacy.status === 'fulfilled' && remotePrivacy.value) privacy.value = remotePrivacy.value
    devices.value = remoteDevices.status === 'fulfilled' ? remoteDevices.value : []
    deviceStatus.value = remoteDevices.status === 'fulfilled' ? 'ready' : 'error'
    if (remoteDeletion.status === 'fulfilled' && remoteDeletion.value) deletion.value = remoteDeletion.value
    const failed = results.find((result) => result.status === 'rejected')
    if (failed?.status === 'rejected') {
      accountActionStatus.value = 'ready'
      lastError.value = '部分账户资料未能读取，请重试。'
    } else {
      accountActionStatus.value = 'ready'
    }
    persist()
  }

  function applyProfileTarget(remote: ProfileTargetSnapshot): void {
    profile.value = { ...profile.value, targetGoal: remote.targetGoal,
      dailyQuotaMinutes: remote.dailyQuotaMinutes, profileVersion: remote.profileVersion }
    onboarding.value = { ...onboarding.value, targetGoal: remote.targetGoal,
      dailyQuotaMinutes: remote.dailyQuotaMinutes }
  }

  async function refreshProfileTarget(): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    profileStatus.value = 'loading'
    lastError.value = null
    if (!readAccessToken()) { profileStatus.value = 'error'; lastError.value = '请重新登录后重试。'; return }
    try {
      const remote = await fetchProfile()
      if (!stillCurrent(subject, generation)) return
      applyProfileTarget(remote)
      profileStatus.value = 'ready'
      persist()
    } catch {
      if (!stillCurrent(subject, generation)) return
      profileStatus.value = 'error'
      lastError.value = '学习资料读取失败，请重试。'
    }
  }

  async function saveDailyQuota(minutes: DailyQuotaMinutes): Promise<boolean> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return false
    if (!readAccessToken() || profileStatus.value !== 'ready') {
      lastError.value = '请先刷新学习资料。'
      return false
    }
    lastError.value = null
    syncState.value = 'syncing'
    try {
      const remote = await putDailyQuota(minutes)
      if (!stillCurrent(subject, generation)) return false
      applyProfileTarget(remote)
      profileStatus.value = 'ready'
      syncState.value = 'synced'
      persist()
      return true
    } catch {
      if (!stillCurrent(subject, generation)) return false
      // A failed readback may follow a committed write. Reload before showing
      // any old or locally edited value as the server's current target.
      profileStatus.value = 'error'
      syncState.value = 'error'
      lastError.value = '每日目标未确认保存，请刷新后重试。'
      return false
    }
  }

  async function savePrivacy(settings: PrivacySettings): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    privacy.value = settings
    persist()
    if (!readAccessToken()) return
    try { await patchPrivacy(settings); if (stillCurrent(subject, generation)) syncState.value = 'synced' }
    catch (error) { if (stillCurrent(subject, generation)) markSyncError(error, '隐私设置已保存本地，服务端同步稍后重试。') }
  }

  async function refreshDevices(): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    devices.value = []
    deviceStatus.value = 'loading'
    if (!readAccessToken()) { deviceStatus.value = 'error'; return }
    try {
      const remote = await fetchDevices(session.deviceId)
      if (!stillCurrent(subject, generation)) return
      devices.value = remote
      deviceStatus.value = 'ready'
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      deviceStatus.value = 'error'
      markSyncError(error, '设备列表暂时无法刷新。')
    }
  }

  async function removeDevice(deviceId: string): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    const device = devices.value.find((item) => item.deviceId === deviceId)
    if (!device || device.current || device.status !== 'ACTIVE') {
      lastError.value = '无法确认目标设备，请刷新列表。'; return
    }
    try { await kickDevice(deviceId); if (stillCurrent(subject, generation)) await refreshDevices() }
    catch (error) { if (stillCurrent(subject, generation)) markSyncError(error, '设备操作未完成，请联网后重试。') }
  }

  async function removeOtherDevices(): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    if (deviceStatus.value !== 'ready') return
    const others = devices.value.filter((item) => !item.current && item.status === 'ACTIVE').map((item) => item.deviceId)
    if (!others.length) return
    try {
      await kickOtherDevices(others)
      if (!stillCurrent(subject, generation)) return
      await refreshDevices()
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      markSyncError(error, '部分设备尚未下线，已重新同步列表。')
      await refreshDevices()
    }
  }

  async function exportData(): Promise<string | null> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return null
    accountActionStatus.value = 'loading'
    try {
      const response = await requestDataExport()
      if (!stillCurrent(subject, generation)) return null
      accountActionStatus.value = 'ready'
      lastError.value = `隐私导出作业已创建：${response.exportId}（${response.status}）。`
      return response.exportId
    } catch (error) {
      if (!stillCurrent(subject, generation)) return null
      accountActionStatus.value = isOnline() ? 'error' : 'offline'
      markSyncError(error, '导出申请需要已接入的隐私服务，当前未提交成功。')
      return null
    }
  }

  async function requestAccountDeletion(): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    accountActionStatus.value = 'loading'
    try {
      const remote = await requestDeletion()
      if (!stillCurrent(subject, generation)) return
      deletion.value = remote; accountActionStatus.value = 'ready'; persist()
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      accountActionStatus.value = isOnline() ? 'error' : 'offline'; markSyncError(error, '注销申请未提交，账号仍保持可用。')
    }
  }

  async function cancelAccountDeletion(): Promise<void> {
    const subject = verifiedSubject.value
    const generation = session.authGeneration
    if (!stillCurrent(subject, generation)) return
    accountActionStatus.value = 'loading'
    try {
      await (await import('../api/b1')).cancelDeletion()
      if (!stillCurrent(subject, generation)) return
      deletion.value = createDefaultDeletion(); accountActionStatus.value = 'ready'; persist()
    } catch (error) {
      if (!stillCurrent(subject, generation)) return
      accountActionStatus.value = isOnline() ? 'error' : 'offline'; markSyncError(error, '注销取消未提交，请联网后重试。')
    }
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
    restored, syncState, lastError, onboarding, assessment, continueContext, home, homeStatus, profile, profileStatus, privacy, devices, deviceStatus, deletion, accountActionStatus,
    hasOnboardingConsent, hasPreferences, assessmentProgress, todayProgress,
    restore, persist, setConsent, setPreferences, commitOnboarding, beginAssessment, submitAnswer, applyFastTrack, loadHome, loadContinueContext, updateContinueContext, completeContinue, completeTask,
    loadAccountData, refreshProfileTarget, saveDailyQuota, savePrivacy, refreshDevices, removeDevice, removeOtherDevices, exportData, requestAccountDeletion, cancelAccountDeletion, sendLoginCode, login, getTargetLabel,
    assessmentQuestions,
  }
})
