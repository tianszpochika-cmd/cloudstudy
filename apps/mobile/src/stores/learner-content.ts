import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { mobileLearnerContentApi, mobileLearnerContentError } from '../api/learner-content'
import type { MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileLearnerAccount, MobileMotionMode, MobileOnboardingModel, MobilePlacementModel, MobileReadModelStatus, MobileThemeMode } from '../domain/learner-content'
import { getUniRuntime } from '../platform/uni-runtime'
import { createClientId } from '../platform/client-id'

const STORAGE_KEY = 'yx.v2.learner-content.mobile.v1'

// The default Mobile H5 build is the local-real build.  Preview/test-double
// behavior is an explicit opt-in and must never turn a cached projection into
// an authoritative learning fact after a reload.
const LOCAL_REAL_RUNTIME = import.meta.env.VITE_RUNTIME_MODE !== 'preview'

const fallbackGoals: MobileGoalOption[] = [
  { value: 'ZERO_BASIS', label: '成人零基础', description: '从发音、核心词和短句开始。' },
  { value: 'CET_4_6', label: '四六级备考', description: '围绕词汇、听力和真题节奏推进。' },
  { value: 'POSTGRADUATE', label: '考研英语', description: '围绕长难句、阅读和考研节奏推进。' },
  { value: 'WORKPLACE_DAILY', label: '职场与日常', description: '优先解决邮件、会议和日常表达。' },
]
const fallbackQuotas = [5, 15, 30, 45]
const fallbackOnboarding: MobileOnboardingModel = { goal: null, quota: null, goals: [...fallbackGoals], quotas: [...fallbackQuotas], birthYear: null, ageConfirmed: false, privacyConsent: false, termsConsent: false, uiLocale: 'zh-CN', contentLocale: 'en-US', completed: false, stateVersion: 0 }

const fallbackAccount: MobileLearnerAccount = { nickname: '学习者', accentPref: 'US', birthYear: null, ageConfirmed: false, privacyConsent: false, termsConsent: false, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: null, quota: null, stateVersion: 0 }

interface PersistedState { onboarding?: MobileOnboardingModel; home?: MobileHomeModel | null; firstDay?: MobileFirstDayModel | null }

function eventId(prefix: string): string { return createClientId(prefix) }

export const useLearnerContentStore = defineStore('mobile-learner-content', () => {
  const restored = ref(false)
  const onboarding = ref<MobileOnboardingModel>({ ...fallbackOnboarding })
  // Goal choices are a bounded Phase 1 domain catalog, not learner fixture data.
  // Keep them available in the real build so a newly authenticated learner can
  // complete onboarding before any personalized projection exists.
  const goals = ref<MobileGoalOption[]>([...fallbackGoals])
  const quotas = ref<number[]>([...fallbackQuotas])
  const account = ref<MobileLearnerAccount>({ ...fallbackAccount })
  const accountStatus = ref<MobileReadModelStatus>('idle')
  const home = ref<MobileHomeModel | null>(null)
  const firstDay = ref<MobileFirstDayModel | null>(null)
  const placement = ref<MobilePlacementModel>({ sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false })
  const placementStatus = ref<MobileReadModelStatus>('idle')
  const onboardingStatus = ref<MobileReadModelStatus>('idle')
  const homeStatus = ref<MobileReadModelStatus>('idle')
  const firstDayStatus = ref<MobileReadModelStatus>('idle')
  const lastError = ref<string | null>(null)
  const progress = computed(() => {
    const value = home.value
    return value && value.targetMinutes > 0 ? Math.min(100, Math.round(value.completedMinutes / value.targetMinutes * 100)) : 0
  })

  function persist(): void { getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ onboarding: onboarding.value, home: home.value, firstDay: firstDay.value } satisfies PersistedState)) }
  function restore(): void {
    if (restored.value) return
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw === 'string') {
      try {
        const saved = JSON.parse(raw) as PersistedState
        if (saved.onboarding) onboarding.value = { ...fallbackOnboarding, ...saved.onboarding }
        // Local storage can keep drafts and recovery hints, but the real build
        // must re-read home/first-day facts from learner/content services.
        if (!LOCAL_REAL_RUNTIME) {
          if (saved.home) home.value = saved.home
          if (saved.firstDay) firstDay.value = saved.firstDay
        }
      } catch { /* ignore corrupt local cache */ }
    }
    restored.value = true
  }
  async function loadOnboarding(): Promise<void> {
    restore(); onboardingStatus.value = 'loading'; lastError.value = null
    try {
      onboarding.value = await mobileLearnerContentApi.readOnboarding(onboarding.value.contentLocale)
      goals.value = onboarding.value.goals.length ? [...onboarding.value.goals] : [...fallbackGoals]
      quotas.value = onboarding.value.quotas.length ? [...onboarding.value.quotas] : [...fallbackQuotas]
      onboardingStatus.value = 'ready'
      persist()
    }
    catch (error) {
      onboardingStatus.value = 'offline'
      goals.value = [...fallbackGoals]
      lastError.value = mobileLearnerContentError(error).message
      persist()
    }
  }
  async function saveOnboarding(goal: string, quota: number, consent: { birthYear: number; ageConfirmed: boolean; privacyConsent: boolean; termsConsent: boolean }): Promise<void> {
    restore(); onboarding.value = { ...onboarding.value, goal, quota, completed: false }; persist(); onboardingStatus.value = 'loading'; lastError.value = null
    try {
      onboarding.value = await mobileLearnerContentApi.saveOnboarding({ goal, quota, ...consent, clientEventId: eventId('mobile-onboarding') })
      goals.value = onboarding.value.goals.length ? [...onboarding.value.goals] : [...fallbackGoals]
      quotas.value = onboarding.value.quotas.length ? [...onboarding.value.quotas] : [...fallbackQuotas]
      onboardingStatus.value = 'ready'
      persist()
    }
    catch (error) { onboardingStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function loadAccount(): Promise<void> {
    accountStatus.value = 'loading'; lastError.value = null
    try { account.value = await mobileLearnerContentApi.readAccount(); accountStatus.value = 'ready' }
    catch (error) { accountStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message }
  }
  async function saveProfile(input: { nickname: string; accentPref: 'US' | 'UK' }): Promise<void> {
    accountStatus.value = 'loading'; lastError.value = null
    try { account.value = await mobileLearnerContentApi.saveProfile({ ...input, clientEventId: eventId('mobile-profile') }); accountStatus.value = 'ready' }
    catch (error) { accountStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message }
  }
  async function savePreferences(input: { themeMode: MobileThemeMode; highContrast: boolean; motionMode: MobileMotionMode }): Promise<void> {
    accountStatus.value = 'loading'; lastError.value = null
    try { account.value = await mobileLearnerContentApi.savePreferences({ ...input, clientEventId: eventId('mobile-preferences') }); accountStatus.value = 'ready' }
    catch (error) { accountStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message }
  }
  async function loadFirstDay(): Promise<void> {
    restore(); firstDayStatus.value = 'loading'
    try { firstDay.value = await mobileLearnerContentApi.readFirstDay(onboarding.value.contentLocale); firstDayStatus.value = firstDay.value.state === 'DEGRADED' ? 'unavailable' : 'ready'; persist() }
    catch (error) { firstDayStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function loadPlacement(): Promise<void> {
    restore(); placementStatus.value = 'loading'; lastError.value = null
    try {
      let remote = await mobileLearnerContentApi.readPlacement(onboarding.value.contentLocale, placement.value.sessionId)
      if (remote.status === 'EMPTY') remote = await mobileLearnerContentApi.startPlacement(onboarding.value.contentLocale, eventId('mobile-placement-start'))
      // A successful start can race the read-model projection during a fresh
      // H5 session. Re-read the same server-owned session once before exposing
      // an empty state; never synthesize a question on the client.
      if (!remote.report && !remote.currentQuestion) remote = await mobileLearnerContentApi.readPlacement(onboarding.value.contentLocale, remote.sessionId)
      placement.value = remote
      placementStatus.value = remote.report || remote.currentQuestion ? 'ready' : 'empty'
    } catch (error) {
      placementStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
    }
  }
  async function submitPlacementAnswer(selectedKey: string, timeSpentSec: number): Promise<void> {
    const current = placement.value.currentQuestion
    const sessionId = placement.value.sessionId
    if (!current || !sessionId || !selectedKey || placementStatus.value === 'loading') return
    placementStatus.value = 'loading'; lastError.value = null
    try {
      let remote = await mobileLearnerContentApi.submitPlacementAnswer({
        sessionId,
        questionId: current.questionId,
        selectedKey,
        timeSpentSec: Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec))),
        contentLocale: onboarding.value.contentLocale,
        clientEventId: eventId(`mobile-placement-${current.questionId}`),
      })
      if (!remote.report && !remote.currentQuestion) remote = await mobileLearnerContentApi.readPlacement(onboarding.value.contentLocale, remote.sessionId || sessionId)
      placement.value = remote
      placementStatus.value = placement.value.report || placement.value.currentQuestion ? 'ready' : 'empty'
    } catch (error) {
      placementStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
    }
  }
  async function loadHome(): Promise<void> {
    restore(); homeStatus.value = 'loading'; lastError.value = null
    try { home.value = await mobileLearnerContentApi.readHome(onboarding.value.contentLocale); homeStatus.value = home.value.contentStatus === 'UNAVAILABLE' ? 'unavailable' : home.value.tasks.length || home.value.content.length ? 'ready' : 'empty'; persist() }
    catch (error) { homeStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  function preserveContentProjectionAfterCompletion(model: MobileHomeModel): MobileHomeModel {
    // Completion returns the updated task stream, not the content catalog.
    // Keep the catalog already read from content-service across that write.
    const current = home.value
    if (!current || model.content.length > 0) return model
    return { ...model, content: current.content, contentStatus: current.contentStatus }
  }
  async function completeTask(taskId: string): Promise<void> {
    // In the real build, completion is authoritative only after the learner
    // service confirms the write.  Optimistic local completion is retained only
    // for the explicitly selected preview/test-double runtime.
    if (!LOCAL_REAL_RUNTIME && home.value) {
      home.value = { ...home.value, tasks: home.value.tasks.map((task) => task.id === taskId ? { ...task, status: 'COMPLETED' } : task), completedMinutes: Math.min(home.value.targetMinutes, home.value.completedMinutes + (home.value.tasks.find((task) => task.id === taskId)?.minutes ?? 0)) }
      persist()
    }
    try {
      const remote = await mobileLearnerContentApi.completeTask(taskId, eventId(`mobile-task-${taskId}`))
      if (!remote && LOCAL_REAL_RUNTIME) throw new Error('学习服务没有确认任务完成。')
      if (remote) home.value = preserveContentProjectionAfterCompletion(remote)
      homeStatus.value = 'ready'
      persist()
    } catch (error) {
      homeStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
      persist()
    }
  }
  return { onboarding, goals, quotas, account, accountStatus, home, firstDay, placement, onboardingStatus, homeStatus, firstDayStatus, placementStatus, lastError, progress, restore, persist, loadOnboarding, saveOnboarding, loadAccount, saveProfile, savePreferences, loadFirstDay, loadPlacement, submitPlacementAnswer, loadHome, completeTask }
})
