import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { learnerI18n } from '../platform/v2-foundation'
import { readAccessToken, useSessionStore } from './session'
import { createClientId } from '../platform/client-id'
import {
  calculateAssessmentReport,
  createDefaultAssessment,
  createDefaultOnboarding,
  getLocalQuestion,
  isOnline,
  type AssessmentReport,
  type AssessmentSnapshot,
  type DailyQuotaMinutes,
  type HomeSnapshot,
  type OnboardingProfile,
  type SubTag,
  type TargetGoal,
} from '../domain/b1'
import {
  createLocalPlacementSnapshot,
  learnerContentPort,
} from '../api/learner-content'
import {
  readPracticeToday,
  submitPracticeTodayTask as submitPracticeTodayAnswer,
  type PracticeTodayTask,
} from '../api/practice-today'
import { ensureLearningPlan, readPlanTodayQueue, replanLearningPlan } from '../api/plan-today'
import { planVersionFromEnsure, shouldEnsurePlan, type PlanTodayQueue } from '../domain/plan-today'
import {
  LearnerContentReadModelError,
  type LearnerContentPersistedState,
  type LearnerContentSnapshot,
  type LearnerHomeReadModel,
  type LearnerGoalOption,
  type PlacementAnswerInput,
  type PlacementFormalReport,
  type ReadModelSource,
  type ReadModelStatus,
} from '../domain/learner-content'
import { mapUiGoal, type OnboardingResumeFacts } from '../domain/onboarding-resume'

const STORAGE_KEY = 'yx.v2.learner-content.web.v1'

// The default shipped build is the local-real build.  Preview/test-double is an
// explicit opt-in only; it must never be selected by a missing environment value.
const LOCAL_REAL_RUNTIME = import.meta.env.VITE_RUNTIME_MODE !== 'preview'

type ContentStatus = 'idle' | 'ready' | 'empty' | 'unavailable'

interface LearnerContentPersistedEnvelope extends LearnerContentPersistedState {
  subject: string
  onboardingOptions?: LearnerGoalOption[]
  onboardingQuotas?: DailyQuotaMinutes[]
  /** Server session pointer only. Placement answers are not stored on this device. */
  placementSessionId?: string | null
}

function eventId(prefix: string): string {
  return createClientId(prefix)
}

function isAdultBirthYear(value: number | null): boolean {
  const currentYear = new Date().getFullYear()
  return Number.isInteger(value) && (value as number) >= 1900 && (value as number) <= currentYear - 18
}

function readPersisted(subject: string): LearnerContentPersistedEnvelope | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && (parsed as LearnerContentPersistedEnvelope).subject === subject) return parsed as LearnerContentPersistedEnvelope
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    return null
  }
}

function statusForError(error: unknown): ReadModelStatus {
  if (error instanceof LearnerContentReadModelError) {
    if (error.code === 'FORBIDDEN') return 'forbidden'
    if (error.code === 'CONTENT_UNAVAILABLE') return 'content-unavailable'
    if (error.code === 'NETWORK' || !isOnline()) return 'offline'
  }
  return isOnline() ? 'error' : 'offline'
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof LearnerContentReadModelError ? error.message : error instanceof Error && error.message ? error.message : fallback
}

function httpStatus(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 0
}

function mergeAssessmentReport(current: AssessmentReport | null, next: AssessmentReport | null): AssessmentReport | null {
  return next ? { ...next } : current
}

export const useLearnerContentStore = defineStore('learner-content', () => {
  const session = useSessionStore()
  const verifiedSubject = computed(() => {
    const subject = session.principal?.subject?.trim()
    return session.accessToken && subject && (!session.userId || session.userId === subject) ? subject : null
  })
  let activeIdentity = { subject: verifiedSubject.value, generation: session.authGeneration }
  const restored = ref(false)
  const syncState = ref<ReadModelSource>('local')
  const lastError = ref<string | null>(null)
  const onboarding = ref<OnboardingProfile>(createDefaultOnboarding())
  const onboardingOptions = ref<LearnerGoalOption[]>([])
  const onboardingQuotas = ref<DailyQuotaMinutes[]>([])
  const onboardingStatus = ref<ReadModelStatus>('idle')
  const onboardingResume = ref<OnboardingResumeFacts | null>(null)
  let resumeCache: { key: string; facts: OnboardingResumeFacts } | null = null
  const assessment = ref<AssessmentSnapshot>(createDefaultAssessment())
  const assessmentStatus = ref<ReadModelStatus>('idle')
  const placementFeedback = ref<'FULL' | 'ZERO' | null>(null)
  const placementReport = ref<PlacementFormalReport | null>(null)
  const home = ref<LearnerHomeReadModel | null>(null)
  const homeStatus = ref<ReadModelStatus>('idle')
  const today = ref<HomeSnapshot | null>(null)
  const todayStatus = ref<ReadModelStatus>('idle')
  const contentStatus = ref<ContentStatus>('idle')
  const pendingAssessmentAnswers = ref<PlacementAnswerInput[]>([])
  const pendingTaskIds = ref<string[]>([])
  const practiceTasks = ref<PracticeTodayTask[]>([])
  const practiceStatus = ref<ReadModelStatus>('idle')
  const practiceAnswers = ref<Record<string, string>>({})
  const practiceResults = ref<Record<string, { correct: boolean; feedbackCode: string | null }>>({})
  const practiceError = ref<string | null>(null)
  const planQueue = ref<PlanTodayQueue | null>(null)
  const planQueueStatus = ref<ReadModelStatus>('idle')
  const planNotice = ref<string | null>(null)
  // Declared before the identity watch. That watch calls reset during setup.
  let ensuredPlanVersion = 0

  function resetForIdentity(subject: string | null, generation: number): void {
    activeIdentity = { subject, generation }
    restored.value = false
    syncState.value = 'local'
    lastError.value = null
    onboarding.value = createDefaultOnboarding()
    onboardingOptions.value = []
    onboardingQuotas.value = []
    onboardingStatus.value = 'idle'
    onboardingResume.value = null
    resumeCache = null
    assessment.value = createDefaultAssessment()
    assessmentStatus.value = 'idle'
    placementFeedback.value = null
    placementReport.value = null
    home.value = null
    homeStatus.value = 'idle'
    today.value = null
    todayStatus.value = 'idle'
    contentStatus.value = 'idle'
    pendingAssessmentAnswers.value = []
    pendingTaskIds.value = []
    practiceTasks.value = []
    practiceStatus.value = 'idle'
    practiceAnswers.value = {}
    practiceResults.value = {}
    practiceError.value = null
    planQueue.value = null
    planQueueStatus.value = 'idle'
    planNotice.value = null
    ensuredPlanVersion = 0
  }

  watch([verifiedSubject, () => session.authGeneration], ([subject, generation]) => {
    if (subject === activeIdentity.subject && generation === activeIdentity.generation) return
    if (activeIdentity.subject && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* restore still validates ownership */ }
    }
    resetForIdentity(subject, generation)
  }, { flush: 'sync' })

  function identity(): { subject: string; generation: number } | null {
    const subject = verifiedSubject.value
    return subject && session.status === 'authenticated'
      ? { subject, generation: session.authGeneration } : null
  }
  function stillCurrent(expected: { subject: string; generation: number } | null): boolean {
    return Boolean(expected && session.status === 'authenticated'
      && expected.subject === verifiedSubject.value
      && expected.subject === activeIdentity.subject
      && expected.generation === session.authGeneration
      && expected.generation === activeIdentity.generation)
  }

  /** Replan may run while a token refresh is in flight. A dead session may not. */
  function sameOwner(owner: { subject: string; generation: number } | null): boolean {
    if (!owner) return false
    const status = session.status
    if (status === 'unauthenticated' || status === 'revoking' || status === 'error') return false
    return owner.subject === verifiedSubject.value && owner.generation === session.authGeneration
  }

  function markReplan(detail: string): void {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.replan = detail.slice(0, 180)
  }

  const hasOnboardingConsent = computed(() => onboarding.value.ageConfirmed && isAdultBirthYear(onboarding.value.birthYear) && onboarding.value.privacyConsent && onboarding.value.termsConsent)
  const hasPreferences = computed(() => Boolean(onboarding.value.targetGoal && onboarding.value.dailyQuotaMinutes))
  const assessmentProgress = computed(() => {
    const totalSteps = assessment.value.currentQuestion?.totalSteps ?? 10
    if (assessment.value.status === 'completed' || (assessment.value.nextSequence ?? 0) > totalSteps) return totalSteps
    const fromCheckpoint = assessment.value.acceptedSequence ?? 0
    const fromQuestion = assessment.value.currentQuestion ? Math.max(0, assessment.value.currentQuestion.stepIndex - 1) : fromCheckpoint
    return Math.min(Math.max(fromCheckpoint, fromQuestion), totalSteps)
  })
  const todayProgress = computed(() => {
    const stream = today.value?.dailyStream ?? home.value?.home?.dailyStream
    return stream && stream.targetMinutes > 0 ? Math.min(100, Math.round(stream.completedMinutes / stream.targetMinutes * 100)) : 0
  })

  function snapshot(): LearnerContentSnapshot {
    return {
      onboarding: onboarding.value,
      assessment: assessment.value,
      home: home.value,
      today: today.value,
      pendingAssessmentAnswers: pendingAssessmentAnswers.value,
      pendingTaskIds: pendingTaskIds.value,
    }
  }

  function placementSessionPointer(): string | null {
    const sessionId = assessment.value.sessionId
    return sessionId && sessionId.startsWith('asess_') ? sessionId : null
  }

  function persist(): void {
    const owner = identity()
    if (typeof window === 'undefined' || !owner || !stillCurrent(owner)) return
    const placementSessionId = placementSessionPointer()
    // DEC-05 is not approved. Keep the server session id so a later visit can
    // GET it, and do not write placement answers or unsubmitted choices.
    const payload: LearnerContentPersistedEnvelope = {
      onboarding: onboarding.value,
      assessment: { ...createDefaultAssessment(), sessionId: placementSessionId },
      home: home.value,
      today: today.value,
      pendingAssessmentAnswers: [],
      pendingTaskIds: [...pendingTaskIds.value],
      subject: owner.subject,
      placementSessionId,
      onboardingOptions: onboardingOptions.value,
      onboardingQuotas: onboardingQuotas.value,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      lastError.value = '本地空间不足，定级会话号没有记下。答案不会写在本机。'
    }
  }

  function restore(): void {
    const owner = identity()
    if (!owner) return
    if (owner.subject !== activeIdentity.subject || owner.generation !== activeIdentity.generation) resetForIdentity(owner.subject, owner.generation)
    if (restored.value) return
    const saved = readPersisted(owner.subject)
    // Unsubmitted gate, consent and target fields stay on the open page only.
    // A stored onboarding object is not a server fact and is not restored.
    // The placement session id is only a pointer. Answers and unsubmitted
    // choices are not restored from this device.
    if (!LOCAL_REAL_RUNTIME) {
      if (saved?.home) home.value = saved.home
      if (saved?.today) today.value = saved.today
    }
    if (saved?.onboardingOptions) onboardingOptions.value = saved.onboardingOptions
    if (saved?.onboardingQuotas) onboardingQuotas.value = saved.onboardingQuotas
    if (Array.isArray(saved?.pendingTaskIds)) pendingTaskIds.value = saved.pendingTaskIds
    const placementSessionId = typeof saved?.placementSessionId === 'string' && saved.placementSessionId.startsWith('asess_')
      ? saved.placementSessionId
      : null
    if (placementSessionId) assessment.value = { ...createDefaultAssessment(), sessionId: placementSessionId }
    restored.value = true
  }

  function setError(error: unknown, fallback: string): ReadModelStatus {
    lastError.value = messageFor(error, fallback)
    syncState.value = statusForError(error) === 'offline' ? 'cache' : 'local'
    return statusForError(error)
  }

  function setConsent(input: { birthYear: number; ageConfirmed: boolean; privacyConsent: boolean; termsConsent: boolean }): void {
    restore()
    if (!stillCurrent(identity())) return
    onboarding.value = { ...onboarding.value, ...input, updatedAt: new Date().toISOString() }
    persist()
  }

  function setPreferences(targetGoal: TargetGoal, selectedSubTags: SubTag[], dailyQuotaMinutes: DailyQuotaMinutes): void {
    restore()
    if (!stillCurrent(identity())) return
    onboarding.value = { ...onboarding.value, targetGoal, subTags: selectedSubTags.slice(0, 3), dailyQuotaMinutes, updatedAt: new Date().toISOString() }
    persist()
  }

  async function loadOnboarding(): Promise<void> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return
    onboardingStatus.value = 'loading'
    lastError.value = null
    try {
      const remote = await learnerContentPort.readOnboarding(learnerI18n.contentLocale)
      if (!stillCurrent(owner)) return
      onboarding.value = { ...onboarding.value, ...remote.profile }
      onboardingOptions.value = [...remote.goals]
      onboardingQuotas.value = [...remote.quotas]
      onboardingStatus.value = remote.goals.length > 0 && remote.quotas.length > 0 ? 'ready' : 'empty'
      syncState.value = 'remote'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      onboardingStatus.value = setError(error, '目标选项暂时无法读取。本页还没提交的内容，离开后不会保留。')
      if (!onboardingOptions.value.length) onboardingStatus.value = onboardingStatus.value === 'forbidden' ? 'forbidden' : 'offline'
      persist()
    }
  }

  async function saveOnboarding(): Promise<boolean> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return false
    if (session.adultGate !== 'PASSED' || !hasOnboardingConsent.value || !hasPreferences.value) {
      onboardingStatus.value = 'error'
      lastError.value = session.adultGate === 'PASSED' ? '请先完成成人确认、隐私/条款同意和学习目标。' : '请先完成服务端成人 Gate。'
      return false
    }
    onboarding.value = { ...onboarding.value, updatedAt: new Date().toISOString() }
    lastError.value = null
    if (!readAccessToken()) {
      syncState.value = 'local'
      onboardingStatus.value = 'error'
      lastError.value = '当前会话已失效，请重新登录后再保存学习目标。'
      return false
    }
    try {
      const remote = await learnerContentPort.saveOnboarding({ profile: onboarding.value, clientEventId: eventId('onboarding') })
      if (!stillCurrent(owner)) return false
      if (remote) {
        onboarding.value = { ...onboarding.value, ...remote.profile }
        onboardingOptions.value = [...remote.goals]
        onboardingQuotas.value = [...remote.quotas]
      }
      syncState.value = 'remote'
      onboardingStatus.value = 'ready'
      persist()
      return true
    } catch (error) {
      if (!stillCurrent(owner)) return false
      onboardingStatus.value = setError(error, '学习目标尚未保存。本页还没提交的内容，离开后不会保留。')
      return false
    }
  }

  function applyServerPlacement(remote: { sessionId: string | null; currentQuestion: AssessmentSnapshot['currentQuestion']; report: AssessmentSnapshot['report']; skipBaseline?: AssessmentSnapshot['skipBaseline']; stateVersion?: number | null; acceptedSequence?: number; nextSequence?: number | null }, status: AssessmentSnapshot['status']): void {
    const acceptedSequence = remote.acceptedSequence ?? 0
    assessment.value = {
      ...createDefaultAssessment(),
      sessionId: remote.sessionId,
      currentQuestion: remote.currentQuestion,
      report: remote.report,
      skipBaseline: remote.skipBaseline ?? null,
      stateVersion: remote.stateVersion ?? null,
      acceptedSequence,
      nextSequence: remote.nextSequence ?? null,
      resumed: acceptedSequence > 0,
      status,
      lastSavedAt: new Date().toISOString(),
      answers: [],
    }
  }

  async function loadAssessment(): Promise<void> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return
    if (!LOCAL_REAL_RUNTIME && assessment.value.status === 'completed') {
      assessmentStatus.value = 'ready'
      return
    }
    assessmentStatus.value = 'loading'
    lastError.value = null
    placementFeedback.value = null
    const storedSessionId = assessment.value.sessionId
    const sessionId = storedSessionId && storedSessionId.startsWith('asess_') ? storedSessionId : null
    try {
      // An existing asess_ session is restored by GET only. POST is only for
      // a learner who has no server checkpoint to resume.
      const remote = sessionId
        ? await learnerContentPort.readPlacement({ contentLocale: learnerI18n.contentLocale, sessionId })
        : await learnerContentPort.startPlacement({
          contentLocale: learnerI18n.contentLocale,
          clientEventId: eventId('placement-start'),
        })
      if (!stillCurrent(owner)) return
      const placed = Boolean(remote.report || remote.formalReport || remote.skipBaseline)
      const status = placed ? 'completed' : remote.currentQuestion || remote.sessionId?.startsWith('asess_') ? 'ready' : 'error'
      applyServerPlacement(remote, status)
      placementReport.value = remote.formalReport ?? null
      assessmentStatus.value = placed || remote.currentQuestion || remote.sessionId?.startsWith('asess_') ? 'ready' : 'empty'
      contentStatus.value = remote.currentQuestion || remote.report || remote.formalReport || remote.skipBaseline ? 'ready' : 'empty'
      syncState.value = 'remote'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      assessmentStatus.value = setError(error, sessionId ? '定级会话暂时读不到。请稍后重新读取，不会因此新开一套题。' : '测评入口暂时不可用，没有新开一套题。')
      if (sessionId || LOCAL_REAL_RUNTIME) {
        assessment.value = {
          ...assessment.value,
          sessionId: sessionId ?? null,
          currentQuestion: null,
          answers: [],
          status: 'error',
        }
        contentStatus.value = 'unavailable'
      } else if (assessmentStatus.value !== 'forbidden' && assessmentStatus.value !== 'content-unavailable') {
        const local = createLocalPlacementSnapshot(null, [])
        assessment.value = {
          ...assessment.value,
          sessionId: null,
          currentQuestion: local.currentQuestion,
          answers: [],
          resumed: false,
          status: local.currentQuestion ? 'ready' : assessment.value.status,
        }
      }
      persist()
    }
  }

  async function restartAssessment(): Promise<void> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return
    if (!LOCAL_REAL_RUNTIME) {
      assessment.value = { ...createDefaultAssessment(), status: 'ready', currentQuestion: getLocalQuestion(0, 'offline-placement') }
      assessmentStatus.value = 'ready'
      persist()
      return
    }
    assessmentStatus.value = 'loading'
    lastError.value = null
    try {
      const remote = await learnerContentPort.startPlacement({ contentLocale: learnerI18n.contentLocale, clientEventId: eventId('placement-restart') })
      if (!stillCurrent(owner)) return
      applyServerPlacement({ ...remote, report: null }, remote.currentQuestion || remote.sessionId?.startsWith('asess_') ? 'ready' : 'error')
      assessmentStatus.value = remote.currentQuestion ? 'ready' : 'empty'
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      assessmentStatus.value = setError(error, '新的服务端测评会话暂时无法创建。')
      assessment.value = { ...assessment.value, status: 'error', currentQuestion: null, report: null }
    }
    persist()
  }

  async function submitAnswerAgainstServer(selectedKey: string, timeSpentSec: number): Promise<void> {
    const owner = identity()
    if (!stillCurrent(owner)) return
    const current = assessment.value.currentQuestion
    const sessionId = assessment.value.sessionId
    if (!current || !sessionId || assessment.value.status === 'submitting' || assessment.value.status === 'completed') return
    if (!readAccessToken()) {
      assessment.value.status = 'error'
      assessmentStatus.value = 'offline'
      lastError.value = '当前会话已失效，未提交本题；请重新登录后继续。'
      persist()
      return
    }
    const stateVersion = assessment.value.stateVersion
    const itemId = current.itemId ?? null
    const itemSequence = current.stepIndex
    if (stateVersion == null || itemId == null) {
      assessment.value.status = 'error'
      assessmentStatus.value = 'error'
      lastError.value = '这题还没有服务端检查点，没有提交。'
      return
    }
    const boundedTime = Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec)))
    assessment.value.status = 'submitting'
    const idempotencyKey = eventId(`placement-response-${sessionId}-${itemSequence}-${stateVersion}`)
    try {
      const response = await learnerContentPort.submitPlacementAnswer({
        sessionId,
        questionId: current.questionId,
        selectedKey,
        timeSpentSec: boundedTime,
        contentLocale: learnerI18n.contentLocale,
        stateVersion,
        itemId,
        itemSequence,
        idempotencyKey,
      })
      if (!stillCurrent(owner)) return
      const completed = response.isCompleted || Boolean(response.report) || Boolean(response.formalReport)
      const sameQuestion = Boolean(response.nextQuestion && response.nextQuestion.questionId === current.questionId)
      const rejected = response.accepted === false && sameQuestion
      placementReport.value = response.formalReport ?? null
      placementFeedback.value = response.accepted !== false && (response.responseOutcome === 'FULL' || response.responseOutcome === 'ZERO') ? response.responseOutcome : null
      applyServerPlacement({
        sessionId: response.sessionId ?? sessionId,
        currentQuestion: response.nextQuestion,
        report: mergeAssessmentReport(null, response.report),
        stateVersion: response.stateVersion,
        acceptedSequence: response.acceptedSequence ?? assessment.value.acceptedSequence,
        nextSequence: response.nextSequence,
      }, completed ? 'completed' : rejected ? 'error' : response.nextQuestion || response.sessionId ? 'ready' : 'error')
      assessmentStatus.value = completed || response.nextQuestion || response.sessionId ? 'ready' : 'empty'
      syncState.value = 'remote'
      lastError.value = rejected ? '这题还没提交成功。进度仍以服务端已接收的检查点为准。' : null
      if (completed) onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
      if (completed && stillCurrent(owner)) await ensurePlanFromReport(owner, placementReport.value?.reportId ?? null, 'ASSESSED')
    } catch (error) {
      if (!stillCurrent(owner)) return
      placementFeedback.value = null
      assessment.value = { ...assessment.value, answers: [], status: 'error' }
      assessmentStatus.value = setError(error, '本题尚未提交成功。未提交的选择不会当成已保存。')
    }
    persist()
  }

  async function submitAnswer(selectedKey: string, timeSpentSec: number): Promise<void> {
    if (LOCAL_REAL_RUNTIME) return submitAnswerAgainstServer(selectedKey, timeSpentSec)
    const owner = identity()
    if (!stillCurrent(owner)) return
    const current = assessment.value.currentQuestion
    const sessionId = assessment.value.sessionId ?? 'offline-placement'
    if (!current || assessment.value.status === 'submitting' || assessment.value.status === 'completed') return
    assessment.value.status = 'submitting'
    const answer = {
      questionId: current.questionId,
      stepIndex: current.stepIndex,
      dimension: current.dimension,
      difficulty: current.difficulty,
      selectedKey,
      correct: current.correctKey ? current.correctKey === selectedKey : null,
      timeSpentSec: Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec))),
      submittedAt: new Date().toISOString(),
    }
    assessment.value = { ...assessment.value, answers: [...assessment.value.answers, answer], currentQuestion: null, lastSavedAt: new Date().toISOString() }
    persist()

    let remoteCompleted = false
    try {
      if (!readAccessToken()) throw new LearnerContentReadModelError({ code: 'NETWORK', status: 0, retryable: true, message: '当前没有连上定级服务，这题还没有提交。' })
      const response = await learnerContentPort.submitPlacementAnswer({ sessionId, questionId: current.questionId, selectedKey, timeSpentSec: answer.timeSpentSec, contentLocale: learnerI18n.contentLocale, stateVersion: assessment.value.stateVersion, itemId: current.itemId, itemSequence: current.stepIndex })
      if (!stillCurrent(owner)) return
      remoteCompleted = response.isCompleted
      assessment.value.report = mergeAssessmentReport(assessment.value.report, response.report)
      assessment.value.currentQuestion = response.nextQuestion
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      const nextStatus = setError(error, '这题还没有提交成功，没有记成本机进度。')
      if (nextStatus !== 'forbidden' && nextStatus !== 'content-unavailable' && !sessionId.startsWith('asess_')) {
        assessment.value.currentQuestion = getLocalQuestion(assessment.value.answers.length, sessionId)
      }
      assessmentStatus.value = nextStatus
    }

    if (assessment.value.answers.length >= 10 || remoteCompleted || assessment.value.report) {
      assessment.value = {
        ...assessment.value,
        status: 'completed',
        report: assessment.value.report ?? calculateAssessmentReport(assessment.value.answers),
        currentQuestion: null,
      }
      onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
      assessmentStatus.value = 'ready'
    } else {
      assessment.value.status = assessment.value.currentQuestion ? 'ready' : 'error'
      if (assessmentStatus.value === 'loading' || assessmentStatus.value === 'ready') assessmentStatus.value = 'ready'
    }
    assessment.value.lastSavedAt = new Date().toISOString()
    persist()
  }

  async function applyFastTrackAgainstServer(fastTrackLevel: 'ZERO_A1' | 'CET4_B1' | 'CET6_B2' | 'POSTGRAD_B2_PLUS'): Promise<void> {
    const owner = identity()
    if (!stillCurrent(owner)) return
    if (!readAccessToken()) {
      assessmentStatus.value = 'offline'
      lastError.value = '当前会话已失效，未生成本地定级结果；请重新登录后重试。'
      return
    }
    assessmentStatus.value = 'loading'
    try {
      const remote = await learnerContentPort.skipPlacement({
        fastTrackLevel,
        sessionId: assessment.value.sessionId,
        contentLocale: learnerI18n.contentLocale,
        clientEventId: eventId('placement-skip'),
      })
      if (!stillCurrent(owner)) return
      if (!remote?.skipBaseline) {
        assessmentStatus.value = 'empty'
        lastError.value = '服务端尚未返回跳过记录，请稍后重试。'
        return
      }
      assessment.value = {
        ...createDefaultAssessment(),
        status: 'completed',
        skipBaseline: remote.skipBaseline,
        lastSavedAt: new Date().toISOString(),
      }
      assessmentStatus.value = 'ready'
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      assessmentStatus.value = setError(error, '快速定级服务暂时不可用，未生成本地替代报告。')
    }
    persist()
  }

  async function retestAssessment(): Promise<void> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return
    const sessionId = assessment.value.sessionId
    if (!LOCAL_REAL_RUNTIME || !sessionId?.startsWith('asess_') || !readAccessToken()) {
      assessmentStatus.value = 'error'
      lastError.value = '还没有可重测的服务端报告。'
      return
    }
    assessmentStatus.value = 'loading'
    lastError.value = null
    placementFeedback.value = null
    try {
      const remote = await learnerContentPort.retestPlacement({
        sessionId,
        contentLocale: learnerI18n.contentLocale,
        clientEventId: eventId('placement-retest'),
      })
      if (!stillCurrent(owner)) return
      applyServerPlacement({ ...remote, report: null, skipBaseline: null }, remote.currentQuestion ? 'ready' : 'error')
      placementReport.value = null
      assessmentStatus.value = remote.currentQuestion ? 'ready' : 'empty'
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      assessmentStatus.value = setError(error, '重测没有开出新题。原来的报告还在。')
    }
    persist()
  }

  async function applyFastTrack(fastTrackLevel: 'ZERO_A1' | 'CET4_B1' | 'CET6_B2' | 'POSTGRAD_B2_PLUS'): Promise<void> {
    if (LOCAL_REAL_RUNTIME) return applyFastTrackAgainstServer(fastTrackLevel)
    const owner = identity()
    if (!stillCurrent(owner)) return
    const levelMap = { ZERO_A1: { level: 1, cefrLevel: 'A1' }, CET4_B1: { level: 3, cefrLevel: 'B1' }, CET6_B2: { level: 4, cefrLevel: 'B2' }, POSTGRAD_B2_PLUS: { level: 4, cefrLevel: 'B2' } } as const
    const selected = levelMap[fastTrackLevel]
    const report: AssessmentReport = {
      score: selected.level * 16,
      level: selected.level,
      cefrLevel: selected.cefrLevel,
      estimatedVocabulary: selected.level === 1 ? 700 : selected.level === 3 ? 3200 : 5000,
      radarScores: { vocab: 60, grammar: 60, listening: 60, speed: 60, scenario: 60 },
      recommendedAdvice: '快速定级结果会作为首周计划的起点，之后仍可重新参加测评。',
      source: 'FAST_TRACK',
      completedAt: new Date().toISOString(),
    }
    assessment.value = { ...createDefaultAssessment(), status: 'completed', report, lastSavedAt: new Date().toISOString() }
    onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
    persist()
    if (!readAccessToken()) {
      syncState.value = 'local'
      return
    }
    try {
      const remote = await learnerContentPort.skipPlacement({ fastTrackLevel, sessionId: assessment.value.sessionId, contentLocale: learnerI18n.contentLocale, clientEventId: eventId('placement-skip') })
      if (!stillCurrent(owner)) return
      if (remote?.report) assessment.value.report = remote.report
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      assessmentStatus.value = setError(error, '快速定级已保存在本地，服务端同步稍后重试。')
    }
    persist()
  }

  function applyHomeModel(model: LearnerHomeReadModel): void {
    home.value = model
    today.value = model.today ?? model.home
    homeStatus.value = model.home ? 'ready' : 'empty'
    todayStatus.value = model.today || model.home ? 'ready' : 'empty'
    contentStatus.value = model.contentStatus === 'UNAVAILABLE' ? 'unavailable' : model.contentStatus === 'READY' ? 'ready' : 'empty'
  }

  function preserveContentProjectionAfterCompletion(model: LearnerHomeReadModel): LearnerHomeReadModel {
    // The completion endpoint returns the updated task stream, but it does not
    // include the content catalog. Keep the catalog already read from
    // content-service so completing a task cannot make courses disappear.
    const current = home.value
    if (!current || model.content.length > 0) return model
    return { ...model, content: current.content, contentStatus: current.contentStatus }
  }

  async function loadHome(): Promise<void> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return
    homeStatus.value = 'loading'
    lastError.value = null
    try {
      const remote = await learnerContentPort.readHome(learnerI18n.contentLocale)
      if (!stillCurrent(owner)) return
      applyHomeModel(remote)
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      homeStatus.value = setError(error, '学习首页暂时无法同步，已保留最近一次安全快照。')
      if (home.value) {
        today.value = today.value ?? home.value.today ?? home.value.home
        contentStatus.value = home.value.contentStatus === 'UNAVAILABLE' ? 'unavailable' : contentStatus.value
      }
    }
    persist()
    await refreshPlanQueue(owner)
  }

  async function refreshPlanQueue(owner: { subject: string; generation: number } | null = identity()): Promise<void> {
    if (!stillCurrent(owner)) return
    try {
      const queue = await readPlanTodayQueue()
      if (!stillCurrent(owner)) return
      planQueue.value = queue
      planQueueStatus.value = queue.planId || queue.itemCount > 0 ? 'ready' : 'empty'
    } catch {
      if (!stillCurrent(owner)) return
      planQueueStatus.value = 'error'
    }
  }

  async function ensurePlanFromReport(
    owner: { subject: string; generation: number } | null,
    reportId: string | null,
    resultKind: string | null,
  ): Promise<void> {
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
      planNotice.value = messageFor(error, '学习计划还没有生成。定级结果已保存。')
    }
  }

  async function replanAfterGoal(owner: { subject: string; generation: number } | null): Promise<void> {
    if (!sameOwner(owner)) {
      markReplan(`skip-before status=${session.status}`)
      return
    }
    let version = Math.max(planQueue.value?.planVersion ?? 0, ensuredPlanVersion)
    let readError = ''
    try {
      const queue = await readPlanTodayQueue()
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
      planNotice.value = messageFor(error, '目标已保存。计划还没有按新目标重排。')
    }
  }

  async function loadToday(): Promise<void> {
    restore()
    const owner = identity()
    if (!stillCurrent(owner)) return
    todayStatus.value = 'loading'
    lastError.value = null
    try {
      const remote = await learnerContentPort.readToday(learnerI18n.contentLocale)
      if (!stillCurrent(owner)) return
      applyHomeModel(remote)
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      todayStatus.value = setError(error, '今日任务暂时无法同步，已保留最近一次安全快照。')
      if (!today.value && home.value) today.value = home.value.today ?? home.value.home
    }
    persist()
    await refreshPlanQueue(owner)
    await loadPracticeToday(owner)
  }

  /**
   * Practice-bound today tasks. V2 today items carry answer-free practice
   * refs; one B10 session per content group resolves real stems, so titles
   * are server facts. A practice outage degrades to the local section error
   * without touching the legacy snapshot or its error state.
   */
  async function loadPracticeToday(owner: { subject: string; generation: number } | null = identity()): Promise<void> {
    if (!stillCurrent(owner)) return
    practiceStatus.value = 'loading'
    practiceError.value = null
    try {
      const tasks = await readPracticeToday()
      if (!stillCurrent(owner)) return
      practiceTasks.value = tasks
      practiceStatus.value = tasks.length ? 'ready' : 'empty'
    } catch (error) {
      if (!stillCurrent(owner)) return
      practiceStatus.value = 'error'
      practiceError.value = error instanceof Error ? error.message : '今日练习暂时无法读取。'
    }
  }

  async function submitPracticeTodayTask(taskId: string, optionKey: string): Promise<void> {
    const owner = identity()
    if (!stillCurrent(owner)) return
    const task = practiceTasks.value.find((item) => item.id === taskId)
    if (!task || !optionKey) return
    practiceAnswers.value = { ...practiceAnswers.value, [taskId]: optionKey }
    practiceError.value = null
    try {
      const key = `practice-today-${task.id}-${optionKey}`
      const feedback = await submitPracticeTodayAnswer(task, optionKey, key)
      if (!stillCurrent(owner)) return
      practiceResults.value = {
        ...practiceResults.value,
        [taskId]: { correct: feedback.correct === true, feedbackCode: feedback.feedbackCode },
      }
    } catch (error) {
      if (!stillCurrent(owner)) return
      practiceError.value = error instanceof Error ? error.message : '作答提交失败，已保留你的选项。'
    }
  }

  async function completeTaskAgainstServer(taskId: string): Promise<void> {
    const owner = identity()
    if (!stillCurrent(owner)) return
    const target = today.value ?? home.value?.today ?? home.value?.home
    if (!target) return
    if (!readAccessToken()) {
      todayStatus.value = 'offline'
      lastError.value = '当前会话已失效，任务尚未完成。'
      return
    }
    pendingTaskIds.value = pendingTaskIds.value.includes(taskId) ? pendingTaskIds.value : [...pendingTaskIds.value, taskId]
    persist()
    try {
      const remote = await learnerContentPort.completeTask({
        taskId,
        contentLocale: learnerI18n.contentLocale,
        clientEventId: eventId(`task-${taskId}`),
      })
      if (!stillCurrent(owner)) return
      if (!remote) throw new LearnerContentReadModelError({ code: 'NETWORK', status: 0, retryable: true, message: '服务端没有确认任务完成。' })
      applyHomeModel(preserveContentProjectionAfterCompletion(remote))
      pendingTaskIds.value = pendingTaskIds.value.filter((item) => item !== taskId)
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      todayStatus.value = setError(error, '任务尚未完成，服务恢复后请重试。')
    }
    persist()
  }

  async function completeTask(taskId: string): Promise<void> {
    if (LOCAL_REAL_RUNTIME) return completeTaskAgainstServer(taskId)
    const owner = identity()
    if (!stillCurrent(owner)) return
    const target = today.value ?? home.value?.today ?? home.value?.home
    if (!target) return
    const update = (snapshot: HomeSnapshot): HomeSnapshot => ({
      ...snapshot,
      dailyStream: {
        ...snapshot.dailyStream,
        completedMinutes: Math.min(snapshot.dailyStream.targetMinutes, snapshot.dailyStream.completedMinutes + (snapshot.dailyStream.tasks.find((task) => task.id === taskId)?.minutes ?? 0)),
        tasks: snapshot.dailyStream.tasks.map((task) => task.id === taskId ? { ...task, completed: true } : task),
      },
    })
    today.value = update(target)
    if (home.value?.home) home.value = { ...home.value, home: update(home.value.home) }
    if (home.value?.today) home.value = { ...home.value, today: update(home.value.today) }
    pendingTaskIds.value = pendingTaskIds.value.includes(taskId) ? pendingTaskIds.value : [...pendingTaskIds.value, taskId]
    persist()
    try {
      if (!readAccessToken()) throw new LearnerContentReadModelError({ code: 'NETWORK', status: 0, retryable: true, message: '任务已保存在本地，联网后同步。' })
      const remote = await learnerContentPort.completeTask({ taskId, contentLocale: learnerI18n.contentLocale, clientEventId: eventId(`task-${taskId}`) })
      if (!stillCurrent(owner)) return
      if (remote) applyHomeModel(preserveContentProjectionAfterCompletion(remote))
      pendingTaskIds.value = pendingTaskIds.value.filter((item) => item !== taskId)
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      todayStatus.value = setError(error, '任务完成状态已保存在本地，恢复联网后可重试。')
    }
    persist()
  }

  async function loadOnboardingResume(force = false): Promise<OnboardingResumeFacts> {
    const owner = identity()
    const key = owner ? `${owner.subject}:${owner.generation}` : ''
    if (!force && resumeCache && resumeCache.key === key) return resumeCache.facts
    const remote = await learnerContentPort.readOnboardingResume()
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

  async function recordRequiredConsents(): Promise<boolean> {
    const owner = identity()
    if (!stillCurrent(owner)) return false
    lastError.value = null
    try {
      await learnerContentPort.recordRequiredConsents(eventId('onboarding-consent'))
      if (!stillCurrent(owner)) return false
      resumeCache = null
      await loadOnboardingResume(true)
      return true
    } catch (error) {
      if (!stillCurrent(owner)) return false
      lastError.value = messageFor(error, '必要同意尚未保存。本页还没提交的内容，离开后不会保留。')
      return false
    }
  }

  async function saveTarget(targetGoal: TargetGoal, dailyQuotaMinutes: DailyQuotaMinutes): Promise<boolean> {
    const owner = identity()
    if (!stillCurrent(owner)) return false
    if (session.adultGate !== 'PASSED') {
      lastError.value = '请先完成服务端成人确认。'
      onboardingStatus.value = 'error'
      return false
    }
    lastError.value = null
    onboardingStatus.value = 'loading'
    try {
      const remote = await learnerContentPort.saveOnboarding({
        profile: { ...createDefaultOnboarding(), targetGoal, dailyQuotaMinutes },
        clientEventId: eventId('onboarding-target'),
        consentsRecorded: true,
      })
      if (!stillCurrent(owner)) return false
      if (remote) {
        onboarding.value = { ...onboarding.value, ...remote.profile, targetGoal, dailyQuotaMinutes }
        onboardingOptions.value = [...remote.goals]
        onboardingQuotas.value = [...remote.quotas]
      }
      onboardingStatus.value = 'ready'
      resumeCache = null
      await loadOnboardingResume(true)
      persist()
      await replanAfterGoal(owner)
      return true
    } catch (error) {
      if (!stillCurrent(owner)) return false
      onboardingStatus.value = setError(error, '学习目标尚未保存。本页还没提交的内容，离开后不会保留。')
      return false
    }
  }

  async function retry(section: 'onboarding' | 'assessment' | 'home' | 'today'): Promise<void> {
    if (section === 'onboarding') return loadOnboarding()
    if (section === 'assessment') return loadAssessment()
    if (section === 'home') return loadHome()
    return loadToday()
  }

  return {
    restored,
    syncState,
    lastError,
    onboarding,
    onboardingOptions,
    onboardingQuotas,
    onboardingStatus,
    onboardingResume,
    assessment,
    assessmentStatus,
    placementFeedback,
    placementReport,
    home,
    homeStatus,
    today,
    todayStatus,
    contentStatus,
    pendingAssessmentAnswers,
    pendingTaskIds,
    practiceTasks,
    practiceStatus,
    practiceAnswers,
    practiceResults,
    practiceError,
    planQueue,
    planQueueStatus,
    planNotice,
    hasOnboardingConsent,
    hasPreferences,
    assessmentProgress,
    todayProgress,
    snapshot,
    restore,
    persist,
    setConsent,
    setPreferences,
    loadOnboarding,
    loadOnboardingResume,
    recordRequiredConsents,
    saveTarget,
    saveOnboarding,
    loadAssessment,
    restartAssessment,
    retestAssessment,
    submitAnswer,
    applyFastTrack,
    loadHome,
    loadToday,
    refreshPlanQueue,
    loadPracticeToday,
    submitPracticeTodayTask,
    completeTask,
    retry,
  }
})
