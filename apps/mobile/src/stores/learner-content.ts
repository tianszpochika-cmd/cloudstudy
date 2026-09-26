import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { mobileLearnerContentApi, mobileLearnerContentError } from '../api/learner-content'
import type { MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileLearnerAccount, MobileMotionMode, MobileOnboardingModel, MobilePlacementModel, MobileReadModelStatus, MobileThemeMode } from '../domain/learner-content'
import { getUniRuntime } from '../platform/uni-runtime'
import { createClientId } from '../platform/client-id'
import { mobileI18n } from '../platform/v2-foundation'
import { useSessionStore } from './session'
import { LEARNER_CONTENT_STORAGE_KEY, removeLearningCache } from './learning-cache'

const STORAGE_KEY = LEARNER_CONTENT_STORAGE_KEY

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

const fallbackAccount: MobileLearnerAccount = { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: null, quota: null, stateVersion: 0 }

interface PersistedState { subject: string; onboarding?: MobileOnboardingModel; home?: MobileHomeModel | null; firstDay?: MobileFirstDayModel | null }

function eventId(prefix: string): string { return createClientId(prefix) }

export const useLearnerContentStore = defineStore('mobile-learner-content', () => {
  const session = useSessionStore()
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

  type Scope = { subject: string; revision: number }
  let accountOwner: Scope | null = null
  let contentLocaleOwner: Scope | null = null
  function scope(): Scope | null {
    return session.isAuthenticated && session.verifiedSubject
      ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
  }
  function sameIdentity(value: Scope | null): boolean {
    return Boolean(value && session.verifiedSubject === value.subject && session.identityRevision === value.revision)
  }
  function sameScope(left: Scope | null, right: Scope | null): boolean {
    return Boolean(left && right && left.subject === right.subject && left.revision === right.revision)
  }
  function stillCurrent(value: Scope | null): boolean { return sameIdentity(value) && session.isAuthenticated }
  function applyAccount(remote: MobileLearnerAccount, owner: Scope): boolean {
    if (!stillCurrent(owner)) return false
    account.value = remote
    accountOwner = owner
    contentLocaleOwner = owner
    onboarding.value = { ...onboarding.value, uiLocale: remote.uiLocale, contentLocale: remote.contentLocale }
    mobileI18n.setContentLocale(remote.contentLocale)
    return true
  }
  function applyOnboarding(remote: MobileOnboardingModel, owner: Scope): boolean {
    if (!stillCurrent(owner)) return false
    onboarding.value = remote
    contentLocaleOwner = owner
    mobileI18n.setContentLocale(remote.contentLocale)
    if (sameScope(accountOwner, owner)) account.value = { ...account.value, uiLocale: remote.uiLocale, contentLocale: remote.contentLocale }
    return true
  }
  async function ensureContentLocale(owner: Scope): Promise<string | null> {
    if (!stillCurrent(owner)) return null
    if (sameScope(contentLocaleOwner, owner)) return onboarding.value.contentLocale
    await loadAccountFor(owner)
    if (!stillCurrent(owner) || !sameScope(contentLocaleOwner, owner)) return null
    return account.value.contentLocale
  }
  function reset(): void {
    restored.value = false
    onboarding.value = { ...fallbackOnboarding, goals: [...fallbackGoals], quotas: [...fallbackQuotas] }
    goals.value = [...fallbackGoals]; quotas.value = [...fallbackQuotas]
    account.value = { ...fallbackAccount }; accountStatus.value = 'idle'
    accountOwner = null; contentLocaleOwner = null
    mobileI18n.setContentLocale('en-US')
    home.value = null; firstDay.value = null
    placement.value = { sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false }
    placementStatus.value = 'idle'; onboardingStatus.value = 'idle'; homeStatus.value = 'idle'; firstDayStatus.value = 'idle'; lastError.value = null
  }
  watch(() => session.identityRevision, reset, { flush: 'sync' })

  function persist(): void { const owner = scope(); if (!owner) return; getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ subject: owner.subject, onboarding: onboarding.value, home: home.value, firstDay: firstDay.value } satisfies PersistedState)) }
  function restore(): void {
    const owner = scope()
    if (!owner) return
    if (restored.value) return
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw === 'string') {
      try {
        const saved = JSON.parse(raw) as PersistedState
        if (saved.subject !== owner.subject) { removeLearningCache(STORAGE_KEY); restored.value = true; return }
        if (saved.onboarding) onboarding.value = { ...fallbackOnboarding, ...saved.onboarding }
        // Local storage can keep drafts and recovery hints, but the real build
        // must re-read home/first-day facts from learner/content services.
        if (!LOCAL_REAL_RUNTIME) {
          if (saved.home) home.value = saved.home
          if (saved.firstDay) firstDay.value = saved.firstDay
        }
      } catch { removeLearningCache(STORAGE_KEY) }
    }
    restored.value = true
  }
  async function loadOnboarding(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); onboardingStatus.value = 'forbidden'; return }
    restore(); onboardingStatus.value = 'loading'; lastError.value = null
    try {
      const remote = await mobileLearnerContentApi.readOnboarding()
      if (!stillCurrent(owner)) return
      applyOnboarding(remote, owner)
      goals.value = onboarding.value.goals.length ? [...onboarding.value.goals] : [...fallbackGoals]
      quotas.value = onboarding.value.quotas.length ? [...onboarding.value.quotas] : [...fallbackQuotas]
      onboardingStatus.value = 'ready'
      persist()
    }
    catch (error) {
      if (!stillCurrent(owner)) return
      onboardingStatus.value = 'offline'
      goals.value = [...fallbackGoals]
      lastError.value = mobileLearnerContentError(error).message
      persist()
    }
  }
  async function saveOnboarding(goal: string, quota: number, consent: { birthYear: number; ageConfirmed: boolean; privacyConsent: boolean; termsConsent: boolean }): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); onboardingStatus.value = 'forbidden'; return }
    restore(); onboarding.value = { ...onboarding.value, goal, quota, completed: false }; persist(); onboardingStatus.value = 'loading'; lastError.value = null
    try {
      const remote = await mobileLearnerContentApi.saveOnboarding({ goal, quota, ...consent, clientEventId: eventId('mobile-onboarding') }, () => sameIdentity(owner))
      if (!stillCurrent(owner)) return
      applyOnboarding(remote, owner)
      goals.value = onboarding.value.goals.length ? [...onboarding.value.goals] : [...fallbackGoals]
      quotas.value = onboarding.value.quotas.length ? [...onboarding.value.quotas] : [...fallbackQuotas]
      onboardingStatus.value = 'ready'
      persist()
    }
    catch (error) { if (!stillCurrent(owner)) return; onboardingStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function loadAccountFor(owner: Scope): Promise<void> {
    if (!stillCurrent(owner)) return
    // A store can be created after an account transition, before its identity
    // watcher has ever seen the previous account. Start that scope at the
    // neutral locale while B9 is being read; never inherit the former user's
    // in-memory locale if this GET fails.
    if (!sameScope(contentLocaleOwner, owner)) {
      onboarding.value = { ...onboarding.value, contentLocale: 'en-US' }
      mobileI18n.setContentLocale('en-US')
    }
    accountStatus.value = 'loading'; lastError.value = null
    try { const remote = await mobileLearnerContentApi.readAccount(); if (!applyAccount(remote, owner)) return; accountStatus.value = 'ready' }
    catch (error) { if (!stillCurrent(owner)) return; accountStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message }
  }
  async function loadAccount(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); accountStatus.value = 'forbidden'; return }
    await loadAccountFor(owner)
  }
  async function savePreferences(input: { themeMode: MobileThemeMode; highContrast: boolean; motionMode: MobileMotionMode }): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); accountStatus.value = 'forbidden'; return }
    accountStatus.value = 'loading'; lastError.value = null
    try { const remote = await mobileLearnerContentApi.savePreferences({ ...input, clientEventId: eventId('mobile-preferences') }, () => sameIdentity(owner)); if (!applyAccount(remote, owner)) return; accountStatus.value = 'ready' }
    catch (error) { if (!stillCurrent(owner)) return; accountStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message }
  }
  async function saveContentLocale(contentLocale: 'en-US' | 'zh-CN'): Promise<boolean> {
    const owner = scope()
    if (!owner) { reset(); accountStatus.value = 'forbidden'; return false }
    accountStatus.value = 'loading'; lastError.value = null
    try {
      const remote = await mobileLearnerContentApi.savePreferences({ contentLocale, clientEventId: eventId('mobile-content-locale') }, () => sameIdentity(owner))
      if (!applyAccount(remote, owner)) return false
      accountStatus.value = 'ready'
      return remote.contentLocale === contentLocale
    } catch (error) {
      if (!stillCurrent(owner)) return false
      accountStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
      return false
    }
  }
  async function loadFirstDay(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); firstDayStatus.value = 'forbidden'; return }
    restore(); firstDayStatus.value = 'loading'
    try { const contentLocale = await ensureContentLocale(owner); if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。'); const remote = await mobileLearnerContentApi.readFirstDay(contentLocale); if (!stillCurrent(owner)) return; firstDay.value = remote; firstDayStatus.value = firstDay.value.state === 'DEGRADED' ? 'unavailable' : 'ready'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; firstDayStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  async function loadPlacement(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); placementStatus.value = 'forbidden'; return }
    restore(); placementStatus.value = 'loading'; lastError.value = null
    try {
      const contentLocale = await ensureContentLocale(owner)
      if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。')
      let remote = await mobileLearnerContentApi.readPlacement(contentLocale, placement.value.sessionId)
      if (!stillCurrent(owner)) return
      if (remote.status === 'EMPTY') remote = await mobileLearnerContentApi.startPlacement(contentLocale, eventId('mobile-placement-start'))
      if (!stillCurrent(owner)) return
      // A successful start can race the read-model projection during a fresh
      // H5 session. Re-read the same server-owned session once before exposing
      // an empty state; never synthesize a question on the client.
      if (!remote.report && !remote.currentQuestion) remote = await mobileLearnerContentApi.readPlacement(contentLocale, remote.sessionId)
      if (!stillCurrent(owner)) return
      placement.value = remote
      placementStatus.value = remote.report || remote.currentQuestion ? 'ready' : 'empty'
    } catch (error) {
      if (!stillCurrent(owner)) return
      placementStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
    }
  }
  async function submitPlacementAnswer(selectedKey: string, timeSpentSec: number): Promise<void> {
    const owner = scope()
    if (!owner) return
    const current = placement.value.currentQuestion
    const sessionId = placement.value.sessionId
    if (!current || !sessionId || !selectedKey || placementStatus.value === 'loading') return
    placementStatus.value = 'loading'; lastError.value = null
    try {
      const contentLocale = await ensureContentLocale(owner)
      if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。')
      let remote = await mobileLearnerContentApi.submitPlacementAnswer({
        sessionId,
        questionId: current.questionId,
        selectedKey,
        timeSpentSec: Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec))),
        contentLocale,
        clientEventId: eventId(`mobile-placement-${current.questionId}`),
      })
      if (!stillCurrent(owner)) return
      if (!remote.report && !remote.currentQuestion) remote = await mobileLearnerContentApi.readPlacement(contentLocale, remote.sessionId || sessionId)
      if (!stillCurrent(owner)) return
      placement.value = remote
      placementStatus.value = placement.value.report || placement.value.currentQuestion ? 'ready' : 'empty'
    } catch (error) {
      if (!stillCurrent(owner)) return
      placementStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
    }
  }
  async function loadHome(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); homeStatus.value = 'forbidden'; return }
    restore(); homeStatus.value = 'loading'; lastError.value = null
    try { const contentLocale = await ensureContentLocale(owner); if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。'); const remote = await mobileLearnerContentApi.readHome(contentLocale); if (!stillCurrent(owner)) return; home.value = remote; homeStatus.value = home.value.contentStatus === 'UNAVAILABLE' ? 'unavailable' : home.value.tasks.length || home.value.content.length ? 'ready' : 'empty'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; homeStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
  }
  function preserveContentProjectionAfterCompletion(model: MobileHomeModel): MobileHomeModel {
    // Completion returns the updated task stream, not the content catalog.
    // Keep the catalog already read from content-service across that write.
    const current = home.value
    if (!current || model.content.length > 0) return model
    return { ...model, content: current.content, contentStatus: current.contentStatus }
  }
  async function completeTask(taskId: string): Promise<void> {
    const owner = scope()
    if (!owner || !home.value?.tasks.some((task) => task.id === taskId)) return
    // In the real build, completion is authoritative only after the learner
    // service confirms the write.  Optimistic local completion is retained only
    // for the explicitly selected preview/test-double runtime.
    if (!LOCAL_REAL_RUNTIME && home.value) {
      home.value = { ...home.value, tasks: home.value.tasks.map((task) => task.id === taskId ? { ...task, status: 'COMPLETED' } : task), completedMinutes: Math.min(home.value.targetMinutes, home.value.completedMinutes + (home.value.tasks.find((task) => task.id === taskId)?.minutes ?? 0)) }
      persist()
    }
    try {
      const remote = await mobileLearnerContentApi.completeTask(taskId, eventId(`mobile-task-${taskId}`))
      if (!stillCurrent(owner)) return
      if (!remote && LOCAL_REAL_RUNTIME) throw new Error('学习服务没有确认任务完成。')
      if (remote) home.value = preserveContentProjectionAfterCompletion(remote)
      homeStatus.value = 'ready'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      homeStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
      persist()
    }
  }
  return { onboarding, goals, quotas, account, accountStatus, home, firstDay, placement, onboardingStatus, homeStatus, firstDayStatus, placementStatus, lastError, progress, restore, persist, loadOnboarding, saveOnboarding, loadAccount, savePreferences, saveContentLocale, loadFirstDay, loadPlacement, submitPlacementAnswer, loadHome, completeTask }
})
