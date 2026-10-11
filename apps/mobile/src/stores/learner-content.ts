import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { mobileLearnerContentApi, mobileLearnerContentError } from '../api/learner-content'
import { ensureLearningPlan, readPlanToday, replanLearningPlan } from '../api/plan-today'
import { planVersionFromEnsure, shouldEnsurePlan, type PlanTodayQueue } from '../domain/plan-today'
import type { MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileLearnerAccount, MobileMotionMode, MobileOnboardingModel, MobilePlacementModel, MobileReadModelStatus, MobileThemeMode } from '../domain/learner-content'
import { getUniRuntime } from '../platform/uni-runtime'
import { createClientId } from '../platform/client-id'
import { mobileI18n } from '../platform/v2-foundation'
import { mapUiGoal, type OnboardingResumeFacts } from '../domain/onboarding-resume'
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

interface PersistedState { subject: string; onboarding?: MobileOnboardingModel; home?: MobileHomeModel | null; firstDay?: MobileFirstDayModel | null; placementSessionId?: string | null }

function emptyPlacementModel(): MobilePlacementModel {
  return { sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false, stateVersion: null, acceptedSequence: 0, nextSequence: null, reconciledWithoutReceipt: false, responseOutcome: null }
}

function eventId(prefix: string): string { return createClientId(prefix) }

function httpStatus(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 0
}

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
  const placement = ref<MobilePlacementModel>(emptyPlacementModel())
  const placementStatus = ref<MobileReadModelStatus>('idle')
  const onboardingStatus = ref<MobileReadModelStatus>('idle')
  const onboardingResume = ref<OnboardingResumeFacts | null>(null)
  let resumeCache: { key: string; facts: OnboardingResumeFacts } | null = null
  const homeStatus = ref<MobileReadModelStatus>('idle')
  const firstDayStatus = ref<MobileReadModelStatus>('idle')
  const lastError = ref<string | null>(null)
  const planQueue = ref<PlanTodayQueue | null>(null)
  const planQueueStatus = ref<MobileReadModelStatus>('idle')
  const planNotice = ref<string | null>(null)
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
  function sameOwner(owner: Scope | null): boolean {
    if (!owner || !sameIdentity(owner)) return false
    const status = session.status
    return status === 'authenticated' || status === 'refreshing' || status === 'restoring'
  }
  function markReplan(detail: string): void {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.replan = detail.slice(0, 180)
  }
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
  // Declared before the identity watch. That watch calls reset during setup.
  let ensuredPlanVersion = 0
  function reset(): void {
    restored.value = false
    onboarding.value = { ...fallbackOnboarding, goals: [...fallbackGoals], quotas: [...fallbackQuotas] }
    goals.value = [...fallbackGoals]; quotas.value = [...fallbackQuotas]
    account.value = { ...fallbackAccount }; accountStatus.value = 'idle'
    accountOwner = null; contentLocaleOwner = null
    mobileI18n.setContentLocale('en-US')
    home.value = null; firstDay.value = null
    placement.value = emptyPlacementModel()
    placementStatus.value = 'idle'; onboardingStatus.value = 'idle'; homeStatus.value = 'idle'; firstDayStatus.value = 'idle'; lastError.value = null
    planQueue.value = null; planQueueStatus.value = 'idle'; planNotice.value = null
    ensuredPlanVersion = 0
    onboardingResume.value = null
    resumeCache = null
  }
  watch(() => session.identityRevision, reset, { flush: 'sync' })

  function persist(): void {
    const owner = scope()
    if (!owner) return
    const placementSessionId = placement.value.sessionId?.startsWith('asess_') ? placement.value.sessionId : null
    getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ subject: owner.subject, onboarding: onboarding.value, home: home.value, firstDay: firstDay.value, placementSessionId } satisfies PersistedState))
  }
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
        if (typeof saved.placementSessionId === 'string' && saved.placementSessionId.startsWith('asess_')) {
          placement.value = { ...emptyPlacementModel(), sessionId: saved.placementSessionId }
        }
      } catch { removeLearningCache(STORAGE_KEY) }
    }
    restored.value = true
  }
  function resumeKey(owner: Scope | null): string {
    return owner ? `${owner.subject}:${owner.revision}` : ''
  }
  async function loadOnboardingResume(force = false): Promise<OnboardingResumeFacts> {
    const owner = scope()
    const key = resumeKey(owner)
    if (!force && resumeCache && resumeCache.key === key) return resumeCache.facts
    const remote = await mobileLearnerContentApi.readOnboardingResume()
    if (!stillCurrent(owner)) throw new Error('账号已变化')
    const quota = remote.target.quota
    const facts: OnboardingResumeFacts = {
      adultGate: remote.adultGate,
      consent: {
        readable: remote.consent.readable,
        accepted: remote.consent.accepted,
        unsatisfiedPurposes: [...remote.consent.unsatisfiedPurposes],
      },
      target: {
        readable: remote.target.readable,
        saved: remote.target.saved,
        goal: mapUiGoal(remote.target.goal),
        quota: quota === 5 || quota === 15 || quota === 30 || quota === 45 ? quota : null,
      },
    }
    if (facts.target.quota === null) facts.target.saved = false
    onboardingResume.value = facts
    resumeCache = { key, facts }
    return facts
  }
  function forgetOnboardingResume(): void {
    resumeCache = null
    onboardingResume.value = null
  }
  async function recordRequiredConsents(): Promise<boolean> {
    const owner = scope()
    if (!owner) { reset(); onboardingStatus.value = 'forbidden'; return false }
    lastError.value = null
    try {
      await mobileLearnerContentApi.recordRequiredConsents(eventId('mobile-onboarding-consent'), () => sameIdentity(owner))
      if (!stillCurrent(owner)) return false
      resumeCache = null
      await loadOnboardingResume(true)
      return true
    } catch (error) {
      if (!stillCurrent(owner)) return false
      lastError.value = mobileLearnerContentError(error).message
      return false
    }
  }
  async function saveTarget(goal: string, quota: number): Promise<boolean> {
    const owner = scope()
    if (!owner) { reset(); onboardingStatus.value = 'forbidden'; return false }
    if (session.adultGate !== 'PASSED') {
      lastError.value = '请先完成服务端成人确认。'
      onboardingStatus.value = 'offline'
      return false
    }
    onboardingStatus.value = 'loading'
    lastError.value = null
    try {
      // Learner stores platform:{subjectUuid}:{operation}:{Idempotency-Key} and rejects a dedupe key over 128 characters.
      // preference.update plus "-preferences" leaves 14 characters for this prefix.
      const remote = await mobileLearnerContentApi.saveOnboarding({ goal, quota, consentsRecorded: true, clientEventId: eventId('h5-goal') }, () => sameIdentity(owner))
      if (!stillCurrent(owner)) return false
      applyOnboarding(remote, owner)
      goals.value = onboarding.value.goals.length ? [...onboarding.value.goals] : [...fallbackGoals]
      quotas.value = onboarding.value.quotas.length ? [...onboarding.value.quotas] : [...fallbackQuotas]
      onboardingStatus.value = 'ready'
      resumeCache = null
      await loadOnboardingResume(true)
      persist()
      await replanAfterGoal(owner)
      return true
    } catch (error) {
      if (!stillCurrent(owner)) return false
      onboardingStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message || '学习目标尚未保存。本页还没提交的内容，离开后不会保留。'
      return false
    }
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
      const remote = await mobileLearnerContentApi.saveOnboarding({ goal, quota, ...consent, clientEventId: eventId('h5-setup') }, () => sameIdentity(owner))
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
      const storedSessionId = placement.value.sessionId
      const sessionId = storedSessionId && storedSessionId.startsWith('asess_') ? storedSessionId : null
      let remote: MobilePlacementModel
      if (sessionId) {
        remote = await mobileLearnerContentApi.readPlacement(contentLocale, sessionId)
      } else {
        remote = await mobileLearnerContentApi.startPlacement(contentLocale, eventId('mobile-placement-start'))
        if (!stillCurrent(owner)) return
        // A successful start can race the read-model projection during a fresh
        // H5 session. Re-read that same session once. Restoring an existing
        // asess_ session must not POST again.
        if (!remote.report && !remote.currentQuestion && remote.sessionId?.startsWith('asess_')) {
          remote = await mobileLearnerContentApi.readPlacement(contentLocale, remote.sessionId)
        }
      }
      if (!stillCurrent(owner)) return
      placement.value = { ...remote, reconciledWithoutReceipt: false }
      placementStatus.value = remote.report || remote.currentQuestion || remote.sessionId?.startsWith('asess_') ? 'ready' : 'empty'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      placementStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message
      // A failed read must not POST. Drop any answer payload and keep only the
      // server session pointer, when one was already stored.
      const sessionId = placement.value.sessionId?.startsWith('asess_') ? placement.value.sessionId : null
      placement.value = { ...emptyPlacementModel(), sessionId }
      persist()
    }
  }
  async function submitPlacementAnswer(selectedKey: string, timeSpentSec: number): Promise<void> {
    const owner = scope()
    if (!owner) return
    const current = placement.value.currentQuestion
    const sessionId = placement.value.sessionId
    if (!current || !sessionId || !selectedKey || placementStatus.value === 'loading') return
    if (placement.value.stateVersion == null || current.itemId == null) {
      placementStatus.value = 'offline'
      lastError.value = '这题还没有服务端检查点，没有提交。'
      return
    }
    placementStatus.value = 'loading'; lastError.value = null
    try {
      const contentLocale = await ensureContentLocale(owner)
      if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。')
      const remote = await mobileLearnerContentApi.submitPlacementAnswer({
        sessionId,
        questionId: current.questionId,
        selectedKey,
        timeSpentSec: Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec))),
        contentLocale,
        clientEventId: eventId(`mobile-placement-${sessionId}-${current.stepIndex}-${placement.value.stateVersion}`),
        stateVersion: placement.value.stateVersion,
        itemId: current.itemId,
        itemSequence: current.stepIndex,
      })
      if (!stillCurrent(owner)) return
      const sameQuestion = remote.currentQuestion?.questionId === current.questionId
      placement.value = remote
      if (remote.reconciledWithoutReceipt && sameQuestion) {
        placementStatus.value = 'offline'
        lastError.value = '这题还没提交成功。进度仍以服务端已接收的检查点为准。'
      } else {
        placementStatus.value = remote.report || remote.currentQuestion || remote.sessionId?.startsWith('asess_') ? 'ready' : 'empty'
        lastError.value = null
        if (remote.report?.resultKind === 'ASSESSED') {
          await ensurePlanFromReport(owner, remote.report.reportId, remote.report.resultKind)
        }
      }
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      placementStatus.value = 'offline'
      lastError.value = mobileLearnerContentError(error).message || '本题尚未提交成功。未提交的选择不会当成已保存。'
    }
  }
  async function retestPlacement(): Promise<void> {
    const owner = scope()
    if (!owner) return
    const sessionId = placement.value.sessionId
    if (!sessionId?.startsWith('asess_')) {
      placementStatus.value = 'error'
      lastError.value = '还没有可重测的服务端报告。'
      return
    }
    placementStatus.value = 'loading'
    lastError.value = null
    try {
      const contentLocale = await ensureContentLocale(owner)
      if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。')
      const remote = await mobileLearnerContentApi.retestPlacement(contentLocale, sessionId, eventId('mobile-placement-retest'))
      if (!stillCurrent(owner)) return
      placement.value = { ...remote, reconciledWithoutReceipt: false }
      placementStatus.value = remote.currentQuestion || remote.sessionId?.startsWith('asess_') ? 'ready' : 'empty'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      placementStatus.value = 'error'
      lastError.value = mobileLearnerContentError(error).message || '重测没有开出新题。原来的报告还在。'
      persist()
    }
  }
  async function loadHome(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); homeStatus.value = 'forbidden'; return }
    restore(); homeStatus.value = 'loading'; lastError.value = null
    try { const contentLocale = await ensureContentLocale(owner); if (!contentLocale) throw new Error(lastError.value || '学习语言设置暂时无法读取。'); const remote = await mobileLearnerContentApi.readHome(contentLocale); if (!stillCurrent(owner)) return; home.value = remote; homeStatus.value = home.value.contentStatus === 'UNAVAILABLE' ? 'unavailable' : home.value.tasks.length || home.value.content.length ? 'ready' : 'empty'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; homeStatus.value = 'offline'; lastError.value = mobileLearnerContentError(error).message; persist() }
    await refreshPlanQueue(owner)
  }
  async function refreshPlanQueue(owner: Scope | null = scope()): Promise<void> {
    if (!stillCurrent(owner)) return
    try {
      const queue = await readPlanToday()
      if (!stillCurrent(owner)) return
      planQueue.value = queue
      planQueueStatus.value = queue.planId || queue.itemCount > 0 ? 'ready' : 'empty'
    } catch {
      if (!stillCurrent(owner)) return
      planQueueStatus.value = 'error'
    }
  }
  async function ensurePlanFromReport(owner: Scope | null, reportId: string | null, resultKind: string | null): Promise<void> {
    if (!stillCurrent(owner) || !shouldEnsurePlan({ reportId, resultKind })) return
    try {
      const ensured = await ensureLearningPlan(reportId as string)
      if (!stillCurrent(owner)) return
      const version = planVersionFromEnsure(ensured)
      if (version >= 1) ensuredPlanVersion = version
      planNotice.value = null
      await refreshPlanQueue(owner)
    } catch (error) {
      if (!stillCurrent(owner)) return
      planNotice.value = mobileLearnerContentError(error).message || '学习计划还没有生成。定级结果已保存。'
    }
  }
  async function replanAfterGoal(owner: Scope | null): Promise<void> {
    if (!sameOwner(owner)) {
      markReplan(`skip-before status=${session.status}`)
      return
    }
    let version = Math.max(planQueue.value?.planVersion ?? 0, ensuredPlanVersion)
    let readError = ''
    try {
      const queue = await readPlanToday()
      if (queue.planVersion >= 1) version = Math.max(version, queue.planVersion)
      if (stillCurrent(owner)) {
        planQueue.value = queue
        planQueueStatus.value = queue.planId || queue.itemCount > 0 ? 'ready' : 'empty'
      }
    } catch (error) {
      readError = error instanceof Error ? error.message : 'read-failed'
    }
    if (!sameOwner(owner) || version < 1) {
      // No plan yet (the first goal save, before placement) is not a failure.
      markReplan(`skip-after version=${version} status=${session.status} err=${readError}`)
      return
    }
    ensuredPlanVersion = version
    markReplan(`post version=${version}`)
    const clientEventId = eventId('plan-replan')
    try {
      await replanLearningPlan(version, clientEventId)
      if (!stillCurrent(owner)) return
      await refreshPlanQueue(owner)
    } catch (error) {
      if (!stillCurrent(owner)) return
      if (httpStatus(error) === 409) {
        planNotice.value = '计划版本已变化，请重新读取。'
        await refreshPlanQueue(owner)
        return
      }
      planNotice.value = mobileLearnerContentError(error).message || '目标已保存。计划还没有按新目标重排。'
    }
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
  return { onboarding, goals, quotas, account, accountStatus, home, firstDay, placement, onboardingStatus, onboardingResume, homeStatus, firstDayStatus, placementStatus, lastError, planQueue, planQueueStatus, planNotice, progress, restore, persist, loadOnboarding, loadOnboardingResume, forgetOnboardingResume, recordRequiredConsents, saveTarget, saveOnboarding, loadAccount, savePreferences, saveContentLocale, loadFirstDay, loadPlacement, submitPlacementAnswer, retestPlacement, loadHome, refreshPlanQueue, completeTask }
})
