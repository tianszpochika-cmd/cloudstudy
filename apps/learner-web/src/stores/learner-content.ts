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
import {
  LearnerContentReadModelError,
  type LearnerContentPersistedState,
  type LearnerContentSnapshot,
  type LearnerHomeReadModel,
  type LearnerGoalOption,
  type PlacementAnswerInput,
  type ReadModelSource,
  type ReadModelStatus,
} from '../domain/learner-content'

const STORAGE_KEY = 'yx.v2.learner-content.web.v1'

// The default shipped build is the local-real build.  Preview/test-double is an
// explicit opt-in only; it must never be selected by a missing environment value.
const LOCAL_REAL_RUNTIME = import.meta.env.VITE_RUNTIME_MODE !== 'preview'

type ContentStatus = 'idle' | 'ready' | 'empty' | 'unavailable'

interface LearnerContentPersistedEnvelope extends LearnerContentPersistedState {
  subject: string
  onboardingOptions?: LearnerGoalOption[]
  onboardingQuotas?: DailyQuotaMinutes[]
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
  const assessment = ref<AssessmentSnapshot>(createDefaultAssessment())
  const assessmentStatus = ref<ReadModelStatus>('idle')
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

  function resetForIdentity(subject: string | null, generation: number): void {
    activeIdentity = { subject, generation }
    restored.value = false
    syncState.value = 'local'
    lastError.value = null
    onboarding.value = createDefaultOnboarding()
    onboardingOptions.value = []
    onboardingQuotas.value = []
    onboardingStatus.value = 'idle'
    assessment.value = createDefaultAssessment()
    assessmentStatus.value = 'idle'
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

  const hasOnboardingConsent = computed(() => onboarding.value.ageConfirmed && isAdultBirthYear(onboarding.value.birthYear) && onboarding.value.privacyConsent && onboarding.value.termsConsent)
  const hasPreferences = computed(() => Boolean(onboarding.value.targetGoal && onboarding.value.dailyQuotaMinutes))
  const assessmentProgress = computed(() => {
    const totalSteps = assessment.value.currentQuestion?.totalSteps ?? 10
    if (assessment.value.status === 'completed') return totalSteps
    const questionProgress = Math.max(0, (assessment.value.currentQuestion?.stepIndex ?? 1) - 1)
    return Math.min(Math.max(assessment.value.answers.length, questionProgress), totalSteps)
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

  function persist(): void {
    const owner = identity()
    if (typeof window === 'undefined' || !owner || !stillCurrent(owner)) return
    const payload: LearnerContentPersistedEnvelope = {
      ...snapshot(),
      subject: owner.subject,
      pendingAssessmentAnswers: [...pendingAssessmentAnswers.value],
      pendingTaskIds: [...pendingTaskIds.value],
      onboardingOptions: onboardingOptions.value,
      onboardingQuotas: onboardingQuotas.value,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      lastError.value = '本地空间不足，当前断点未能完整保存。'
    }
  }

  function restore(): void {
    const owner = identity()
    if (!owner) return
    if (owner.subject !== activeIdentity.subject || owner.generation !== activeIdentity.generation) resetForIdentity(owner.subject, owner.generation)
    if (restored.value) return
    const saved = readPersisted(owner.subject)
    if (saved?.onboarding) onboarding.value = { ...createDefaultOnboarding(), ...saved.onboarding }
    // On a real local run, browser storage may retain a draft or an old cache but
    // it is never promoted to an authoritative assessment/home fact after reload.
    // Those facts must be re-read from the owner services.
    if (!LOCAL_REAL_RUNTIME) {
      if (saved?.assessment) assessment.value = { ...createDefaultAssessment(), ...saved.assessment }
      if (saved?.home) home.value = saved.home
      if (saved?.today) today.value = saved.today
    }
    if (saved?.onboardingOptions) onboardingOptions.value = saved.onboardingOptions
    if (saved?.onboardingQuotas) onboardingQuotas.value = saved.onboardingQuotas
    if (Array.isArray(saved?.pendingAssessmentAnswers)) pendingAssessmentAnswers.value = saved.pendingAssessmentAnswers
    if (Array.isArray(saved?.pendingTaskIds)) pendingTaskIds.value = saved.pendingTaskIds
    if (!LOCAL_REAL_RUNTIME && assessment.value.answers.length > 0 && assessment.value.status !== 'completed' && !assessment.value.currentQuestion) {
      assessment.value = {
        ...assessment.value,
        resumed: true,
        status: 'ready',
        currentQuestion: getLocalQuestion(assessment.value.answers.length, assessment.value.sessionId ?? 'offline-placement'),
      }
    }
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
      onboardingStatus.value = setError(error, '目标选项暂时无法加载，已保留本地草稿。')
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
    persist()
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
      onboardingStatus.value = setError(error, '目标草稿已保存在本地，恢复联网后可继续同步。')
      persist()
      return false
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
    try {
      let remote = await learnerContentPort.readPlacement({ contentLocale: learnerI18n.contentLocale, sessionId: assessment.value.sessionId })
      if (!stillCurrent(owner)) return
      if (remote.status === 'EMPTY') {
        remote = await learnerContentPort.startPlacement({
          contentLocale: learnerI18n.contentLocale,
          clientEventId: eventId('placement-start'),
        })
        if (!stillCurrent(owner)) return
      }
      assessment.value = {
        ...assessment.value,
        sessionId: remote.sessionId ?? assessment.value.sessionId,
        currentQuestion: remote.currentQuestion,
        report: remote.report,
        skipBaseline: remote.skipBaseline,
        resumed: Boolean(assessment.value.answers.length),
        status: remote.report || remote.skipBaseline ? 'completed' : remote.currentQuestion ? 'ready' : 'error',
        lastSavedAt: new Date().toISOString(),
      }
      assessmentStatus.value = remote.report || remote.skipBaseline || remote.currentQuestion ? 'ready' : 'empty'
      contentStatus.value = remote.currentQuestion || remote.report || remote.skipBaseline ? 'ready' : 'empty'
      syncState.value = 'remote'
      persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      assessmentStatus.value = setError(error, '测评入口暂时不可用，已保留可恢复草稿。')
      if (LOCAL_REAL_RUNTIME) {
        // A failed read is an unavailable server fact, not a permission to invent
        // the next question or a report in the browser.
        assessment.value = {
          ...assessment.value,
          currentQuestion: null,
          status: 'error',
        }
        contentStatus.value = 'unavailable'
      } else if (assessmentStatus.value !== 'forbidden' && assessmentStatus.value !== 'content-unavailable') {
        const local = createLocalPlacementSnapshot(assessment.value.sessionId, assessment.value.answers)
        assessment.value = {
          ...assessment.value,
          sessionId: local.sessionId,
          currentQuestion: assessment.value.currentQuestion ?? local.currentQuestion,
          resumed: assessment.value.answers.length > 0,
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
      assessment.value = { ...createDefaultAssessment(), sessionId: remote.sessionId, currentQuestion: remote.currentQuestion, report: null, status: remote.currentQuestion ? 'ready' : 'error', lastSavedAt: new Date().toISOString() }
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
    const boundedTime = Math.max(0, Math.min(current.timeLimitSec, Math.round(timeSpentSec)))
    assessment.value.status = 'submitting'
    try {
      const response = await learnerContentPort.submitPlacementAnswer({
        sessionId,
        questionId: current.questionId,
        selectedKey,
        timeSpentSec: boundedTime,
        contentLocale: learnerI18n.contentLocale,
      })
      if (!stillCurrent(owner)) return
      const answer = {
        questionId: current.questionId,
        stepIndex: current.stepIndex,
        dimension: current.dimension,
        difficulty: current.difficulty,
        selectedKey,
        correct: null,
        timeSpentSec: boundedTime,
        submittedAt: new Date().toISOString(),
      }
      const completed = response.isCompleted || Boolean(response.report)
      assessment.value = {
        ...assessment.value,
        answers: [...assessment.value.answers, answer],
        report: mergeAssessmentReport(assessment.value.report, response.report),
        currentQuestion: response.nextQuestion,
        status: completed ? 'completed' : response.nextQuestion ? 'ready' : 'error',
        lastSavedAt: new Date().toISOString(),
      }
      assessmentStatus.value = completed || response.nextQuestion ? 'ready' : 'empty'
      syncState.value = 'remote'
      if (completed) onboarding.value = { ...onboarding.value, completed: true, updatedAt: new Date().toISOString() }
    } catch (error) {
      if (!stillCurrent(owner)) return
      pendingAssessmentAnswers.value = [...pendingAssessmentAnswers.value, {
        sessionId,
        questionId: current.questionId,
        selectedKey,
        timeSpentSec: boundedTime,
        contentLocale: learnerI18n.contentLocale,
      }]
      assessment.value.status = 'error'
      assessmentStatus.value = setError(error, '本题尚未提交成功，服务恢复后请重试。')
      // Keep the server-provided question visible. There is no local question or
      // client-side score in local-real mode.
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
      if (!readAccessToken()) throw new LearnerContentReadModelError({ code: 'NETWORK', status: 0, retryable: true, message: '当前为离线测评，答案已保存在本地。' })
      const response = await learnerContentPort.submitPlacementAnswer({ sessionId, questionId: current.questionId, selectedKey, timeSpentSec: answer.timeSpentSec, contentLocale: learnerI18n.contentLocale })
      if (!stillCurrent(owner)) return
      remoteCompleted = response.isCompleted
      assessment.value.report = mergeAssessmentReport(assessment.value.report, response.report)
      assessment.value.currentQuestion = response.nextQuestion
      syncState.value = 'remote'
    } catch (error) {
      if (!stillCurrent(owner)) return
      const nextStatus = setError(error, '本题已保存在本地，恢复联网后可继续同步。')
      if (nextStatus !== 'forbidden' && nextStatus !== 'content-unavailable') {
        pendingAssessmentAnswers.value = [...pendingAssessmentAnswers.value, { sessionId, questionId: current.questionId, selectedKey, timeSpentSec: answer.timeSpentSec, contentLocale: learnerI18n.contentLocale }]
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
      const remote = await learnerContentPort.skipPlacement({ fastTrackLevel, contentLocale: learnerI18n.contentLocale, clientEventId: eventId('placement-skip') })
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
    assessment,
    assessmentStatus,
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
    saveOnboarding,
    loadAssessment,
    restartAssessment,
    submitAnswer,
    applyFastTrack,
    loadHome,
    loadToday,
    loadPracticeToday,
    submitPracticeTodayTask,
    completeTask,
    retry,
  }
})
