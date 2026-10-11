import { mobileApiClient, MobileApiError } from './client'
import type { MobileContentCard, MobileContentDetail, MobileFirstDayModel, MobileGoalOption, MobileHomeModel, MobileLearnerAccount, MobileMotionMode, MobileOnboardingModel, MobilePlacementModel, MobilePlacementQuestion, MobilePlacementReport, MobileTask, MobileThemeMode } from '../domain/learner-content'

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
function requireStateVersion(value: unknown): number {
  const source = unwrap(value)
  if (isRecord(source) && typeof source.stateVersion === 'number' && Number.isSafeInteger(source.stateVersion) && source.stateVersion >= 0) {
    return source.stateVersion
  }
  throw new Error('学习设置版本暂时无法读取，请重试。')
}
type QueryParams = string | Record<string, string | null | undefined>

function query(path: string, params: QueryParams): string {
  const values = typeof params === 'string' ? { contentLocale: params } : params
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  return `${path}?${search.toString()}`
}

async function requestOptional(path: string): Promise<unknown | null> {
  try { return await mobileApiClient.request<unknown>(path) }
  catch (error) {
    if (error instanceof MobileApiError && error.status === 404) return null
    if (error instanceof MobileApiError && error.status === 403 && isConsentRequired(error.details)) return null
    throw error
  }
}

function isConsentRequired(details: unknown): boolean {
  if (!isRecord(details)) return false
  const source = isRecord(details.error) ? details.error : details
  return source.code === 'CONSENT_REQUIRED'
}

function mapError(error: unknown): MobileApiError {
  if (error instanceof MobileApiError) return error
  return new MobileApiError('学习数据暂时不可用，请稍后重试。', 0, error)
}

function parseGoalOptions(value: unknown): MobileGoalOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): MobileGoalOption[] => {
    if (!isRecord(item)) return []
    const valueText = text(item.value ?? item.code)
    const label = text(item.label, valueText)
    return valueText && label ? [{ value: valueText, label, description: text(item.description) || undefined }] : []
  })
}

function parseQuotas(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === 'number' && [5, 15, 30, 45].includes(item))
}

function mapUiGoalCode(value: string): string | null {
  switch (value) {
    case 'FOUNDATION':
    case 'ZERO_BASIS':
      return 'ZERO_BASIS'
    case 'COLLEGE_CET':
    case 'CET_4_6':
      return 'CET_4_6'
    case 'POSTGRADUATE_ENGLISH':
    case 'POSTGRADUATE':
      return 'POSTGRADUATE'
    case 'WORKPLACE_DAILY':
    case 'WORKPLACE':
      return 'WORKPLACE_DAILY'
    default:
      return null
  }
}

function decisionCode(details: unknown): string | null {
  if (!isRecord(details)) return null
  const source = isRecord(details.error) ? details.error : details
  return typeof source.code === 'string' && source.code.trim() ? source.code.trim() : null
}

function parseOnboarding(profileValue: unknown, targetValue: unknown, preferenceValue: unknown, optionsValue: unknown): MobileOnboardingModel {
  const profile = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const target = isRecord(unwrap(targetValue)) ? unwrap(targetValue) as RecordValue : {}
  const preferences = isRecord(unwrap(preferenceValue)) ? unwrap(preferenceValue) as RecordValue : {}
  const options = isRecord(unwrap(optionsValue)) ? unwrap(optionsValue) as RecordValue : {}
  return {
    goal: mapUiGoalCode(text(target.goalCode ?? target.goal_code ?? profile.targetGoal ?? profile.target_goal)) || null,
    quota: number(target.dailyQuotaMinutes ?? target.daily_quota_minutes, 0) || null,
    goals: parseGoalOptions(options.goals),
    quotas: parseQuotas(options.dailyQuotaMinutes ?? options.quotas),
    birthYear: number(profile.birthYear ?? profile.birth_year, 0) || null,
    ageConfirmed: profile.ageConfirmed === true || profile.age_confirmed === true,
    privacyConsent: profile.privacyConsent === true || profile.privacy_consent === true,
    termsConsent: profile.termsConsent === true || profile.terms_consent === true,
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    completed: text(profile.status).toUpperCase() === 'ACTIVE',
    stateVersion: number(profile.stateVersion ?? profile.state_version, 0),
  }
}

function parseAccount(profileValue: unknown, targetValue: unknown, preferencesValue: unknown): MobileLearnerAccount {
  const source = isRecord(unwrap(profileValue)) ? unwrap(profileValue) as RecordValue : {}
  const profile = isRecord(source.profile) ? source.profile : source
  const target = unwrap(targetValue)
  const goal = isRecord(target) ? target : isRecord(source.goal) ? source.goal : {}
  const remotePreferences = unwrap(preferencesValue)
  const preferences = isRecord(remotePreferences) ? remotePreferences : isRecord(source.preferences) ? source.preferences : {}
  const themeMode = text(preferences.themeMode ?? preferences.theme_mode ?? profile.themeMode ?? profile.theme_mode, 'SYSTEM')
  const motionMode = text(preferences.motionMode ?? preferences.motion_mode, 'FULL')
  return {
    uiLocale: text(preferences.uiLocale ?? preferences.ui_locale ?? profile.uiLocale ?? profile.ui_locale, 'zh-CN'),
    contentLocale: text(preferences.contentLocale ?? preferences.content_locale ?? profile.contentLocale ?? profile.content_locale, 'en-US'),
    timezone: text(preferences.timezone ?? preferences.timezone ?? profile.timezone, 'Asia/Shanghai'),
    themeMode: ['SYSTEM', 'LIGHT', 'DARK'].includes(themeMode) ? themeMode as MobileThemeMode : 'SYSTEM',
    highContrast: preferences.highContrast === true || preferences.high_contrast === true,
    motionMode: ['FULL', 'REDUCED', 'OFF'].includes(motionMode) ? motionMode as MobileMotionMode : 'FULL',
    goal: text(goal.goalCode ?? goal.goal_code) || null,
    quota: number(goal.dailyQuotaMinutes ?? goal.daily_quota_minutes, 0) || null,
    // The preferences aggregate owns this version. The profile version may
    // have changed independently (for example, after an onboarding update).
    stateVersion: requireStateVersion(preferencesValue),
  }
}

function parseTask(value: unknown, index: number): MobileTask | null {
  if (!isRecord(value)) return null
  const id = text(value.taskId ?? value.task_id ?? value.id)
  if (!id) return null
  const statusValue = text(value.status ?? value.task_status)
  const status = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'UNAVAILABLE'].includes(statusValue) ? statusValue as MobileTask['status'] : 'AVAILABLE'
  return {
    id,
    type: text(value.taskType ?? value.task_type ?? value.type, 'LESSON'),
    title: text(value.title, `今日任务 ${index + 1}`),
    description: text(value.description ?? value.summary, '按服务端内容版本继续学习。'),
    minutes: number(value.minutes ?? value.estimatedMinutes, 5),
    status,
    contentCode: text(value.contentCode ?? value.content_code) || undefined,
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

function parseContentDetail(value: unknown): MobileContentDetail {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const detail = isRecord(source.content) ? source.content : source
  const contentCode = text(detail.contentCode ?? detail.contentId ?? detail.id)
  const title = text(detail.title)
  if (!contentCode || !title) throw new Error('服务端课程内容格式无效。')
  const items = Array.isArray(detail.items) ? detail.items.flatMap((item, index) => {
    if (!isRecord(item)) return []
    return [{
      itemId: text(item.itemId ?? item.itemCode ?? item.id, `${contentCode}:item:${index + 1}`),
      itemType: text(item.itemType ?? item.type, 'LESSON'),
      text: text(item.text ?? item.displayText ?? item.prompt ?? item.content),
      options: Array.isArray(item.options) ? item.options.flatMap((option) => {
        if (!isRecord(option)) return []
        const key = text(option.key); const optionText = text(option.text)
        return key && optionText ? [{ key, text: optionText }] : []
      }) : [],
    }]
  }) : []
  return {
    contentCode,
    contentVersionId: number(detail.contentVersionId ?? detail.versionId, 0) || null,
    contentType: text(detail.contentType ?? detail.kind, 'COURSE_UNIT'),
    title,
    summary: text(detail.summary ?? detail.description),
    contentLocale: text(detail.contentLocale, 'en-US'),
    items,
  }
}

function identifier(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  return text(value)
}

function readItemId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function readSequence(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function readStateVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('当前环境无法生成作答摘要，这题没有提交。')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function itemAtSequence(items: unknown[], sequence: number): unknown {
  for (const item of items) {
    if (!isRecord(item)) continue
    if (readSequence(item.itemSequence) === sequence || readSequence(item.displayOrder) === sequence) return item
  }
  const index = sequence - 1
  return index >= 0 && index < items.length ? items[index] : null
}

function parsePlacementQuestion(value: unknown, totalSteps: number | null = null, stepHint: number | null = null): MobilePlacementQuestion | null {
  if (!isRecord(value)) return null
  const questionId = text(value.questionId) || identifier(value.itemId)
  const stemText = text(value.stemText) || text(value.stem) || text(value.prompt)
  if (!questionId || !stemText) return null
  const rawOptions = Array.isArray(value.options) ? value.options : []
  const options = rawOptions.flatMap((option): Array<{ key: string; text: string }> => {
    if (!isRecord(option)) return []
    const key = text(option.key) || text(option.optionId) || text(option.optionCode)
    const optionText = text(option.text) || text(option.label)
    return key && optionText ? [{ key, text: optionText }] : []
  })
  if (!options.length) return null
  const rawDimension = text(value.dimension) || text(value.itemType)
  return {
    questionId,
    stemText,
    options,
    dimension: rawDimension === 'GRAMMAR' || rawDimension === 'BASIC_GRAMMAR' ? 'GRAMMAR' : rawDimension === 'LISTENING' ? 'LISTENING' : rawDimension || 'VOCABULARY',
    difficulty: number(value.difficulty, 1),
    stepIndex: stepHint ?? number(value.stepIndex, number(value.displayOrder, 1)),
    totalSteps: totalSteps ?? number(value.totalSteps, 10),
    timeLimitSec: number(value.timeLimitSec, 25),
    itemId: readItemId(value.itemId),
  }
}

function optionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function parsePlacementReport(value: unknown, sessionFallback: string | null = null): MobilePlacementReport | null {
  if (!isRecord(value)) return null
  const summary = isRecord(value.summary) ? value.summary : value
  if (value.resultKind === 'SKIPPED' || summary.resultKind === 'SKIPPED') {
    const reportId = text(value.reportId) || text(summary.reportId)
    const sessionId = text(value.sessionId) || text(summary.sessionId) || sessionFallback || ''
    if (!reportId || !sessionId) return null
    const requested = isRecord(value.requestedStartingLevel) ? value.requestedStartingLevel : isRecord(summary.requestedStartingLevel) ? summary.requestedStartingLevel : null
    return {
      reportId,
      sessionId,
      resultKind: 'SKIPPED',
      cefrLevel: null,
      score: null,
      requestedStartingLevel: requested ? text(requested.level) || null : null,
      mistakes: [],
      fullCount: null,
      zeroCount: null,
      itemCount: null,
    }
  }
  const reportId = text(value.reportId) || text(summary.reportId)
  const sessionId = text(value.sessionId) || text(summary.sessionId) || sessionFallback || ''
  if (!reportId) return null
  const measuredScore = typeof value.score === 'number' ? value.score : typeof value.aggregateScore === 'number' ? value.aggregateScore : typeof summary.score === 'number' ? summary.score : typeof summary.aggregateScore === 'number' ? summary.aggregateScore : null
  const measuredLevel = text(value.cefrLevel) || text(value.referenceLevel) || text(summary.cefrLevel) || text(summary.referenceLevel) || null
  return {
    reportId,
    sessionId,
    resultKind: 'ASSESSED',
    cefrLevel: measuredLevel,
    score: measuredScore,
    requestedStartingLevel: null,
    mistakes: [],
    fullCount: optionalCount(summary.fullCount),
    zeroCount: optionalCount(summary.zeroCount),
    itemCount: optionalCount(summary.itemCount),
  }
}

function emptyPlacement(): MobilePlacementModel {
  return { sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false, stateVersion: null, acceptedSequence: 0, nextSequence: null, reconciledWithoutReceipt: false, responseOutcome: null }
}

function selectPlacementItem(source: RecordValue, items: unknown[], acceptedSequence: number, nextSequence: number | null, totalSteps: number | null): unknown {
  const explicit = source.currentItem ?? source.currentQuestion ?? source.nextItem ?? source.nextQuestion
  if (explicit != null) return explicit
  const total = totalSteps ?? (items.length || 10)
  const sequence = nextSequence ?? (acceptedSequence > 0 ? acceptedSequence + 1 : 1)
  if (sequence < 1 || sequence > total) return null
  if (acceptedSequence > 0 || sequence === 1) return itemAtSequence(items, sequence)
  return null
}

function parsePlacement(value: unknown, reconciledWithoutReceipt = false): MobilePlacementModel {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const manifest = isRecord(source.manifest) ? source.manifest : null
  const items = Array.isArray(source.items) ? source.items : []
  const totalSteps = typeof manifest?.totalItemCount === 'number' ? manifest.totalItemCount : items.length || null
  const acceptedSequence = readSequence(source.acceptedSequence) ?? 0
  const nextSequence = readSequence(source.nextSequence) ?? (source.acceptedSequence != null ? acceptedSequence + 1 : null)
  const completed = isRecord(source.completedResult) ? source.completedResult : isRecord(source.finalResult) ? source.finalResult : null
  const current = selectPlacementItem(source, items, acceptedSequence, nextSequence, totalSteps)
  const stepHint = nextSequence != null && nextSequence >= 1 && (totalSteps == null || nextSequence <= totalSteps) ? nextSequence : null
  const sessionId = text(source.sessionId) || null
  const reportValue = source.report ?? source.finalReport ?? (completed && completed.resultKind !== 'SKIPPED' ? completed : null)
  const report = parsePlacementReport(reportValue, sessionId) ?? parsePlacementReport(isRecord(source.summary) ? source.summary : null, sessionId)
  const responseOutcome = source.outcome === 'FULL' || source.outcome === 'ZERO' ? source.outcome : null
  return {
    sessionId,
    status: text(source.status, sessionId ? 'IN_PROGRESS' : 'EMPTY'),
    currentQuestion: parsePlacementQuestion(current, totalSteps, stepHint),
    report,
    isCompleted: source.isCompleted === true || text(source.status) === 'COMPLETED' || completed?.resultKind === 'ASSESSED' || Boolean(report && report.resultKind === 'ASSESSED'),
    stateVersion: readStateVersion(source.stateVersion) ?? readStateVersion(source.state_version),
    acceptedSequence,
    nextSequence,
    reconciledWithoutReceipt,
    responseOutcome,
  }
}

function placementConflictAction(
  attempt: { stateVersion: number; itemSequence: number; itemId: number },
  latest: MobilePlacementModel,
  retried: boolean,
): 'adopt' | 'retry' | 'stop' {
  if (latest.acceptedSequence >= attempt.itemSequence) return 'adopt'
  const sequence = latest.nextSequence ?? latest.currentQuestion?.stepIndex ?? null
  const sameItem = latest.currentQuestion?.itemId == null || latest.currentQuestion.itemId === attempt.itemId
  const unchanged = latest.stateVersion === attempt.stateVersion && sequence === attempt.itemSequence && sameItem
  return unchanged && !retried ? 'retry' : 'stop'
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

function requireSameIdentity(isCurrent?: () => boolean): void {
  if (isCurrent && !isCurrent()) throw new Error('账号已变化，请重新打开页面后操作。')
}

let cachedActiveConsentVersion: string | null = null
let consentRefreshPromise: Promise<string> | null = null

async function fetchActiveConsentVersion(): Promise<string> {
  try {
    const raw = await requestOptional('/iam/principal/me')
    const unwrapped = unwrap(raw)
    if (isRecord(unwrapped)) {
      const consentState = isRecord(unwrapped.consentState) ? unwrapped.consentState : undefined
      if (consentState && typeof consentState.version === 'string' && consentState.version.trim()) {
        return consentState.version.trim()
      }
    }
  } catch {
    // fallback to default
  }
  return 'b30-consent-v1'
}

async function refreshActiveConsentVersion(): Promise<string> {
  if (!consentRefreshPromise) {
    consentRefreshPromise = fetchActiveConsentVersion().then((v) => {
      cachedActiveConsentVersion = v
      consentRefreshPromise = null
      return v
    }).catch((err) => {
      consentRefreshPromise = null
      throw err
    })
  }
  return consentRefreshPromise
}

export interface MobileOnboardingResumeRead {
  adultGate: string
  consent: { readable: boolean; accepted: boolean | null; unsatisfiedPurposes: readonly string[] }
  target: { readable: boolean; saved: boolean; goal: string | null; quota: number | null }
}

function parseAdultGateFact(value: unknown): string {
  if (value === 'PASSED' || value === 'REJECTED' || value === 'REQUIRED') return value
  if (!isRecord(value)) return 'UNKNOWN'
  if (value.status === 'PASSED' || value.status === 'APPROVED') return 'PASSED'
  if (value.status === 'REJECTED') return 'REJECTED'
  if (value.status === 'REQUIRED' || value.status === 'PENDING' || value.status === 'NOT_EVALUATED') return 'REQUIRED'
  return 'UNKNOWN'
}

function parseConsentFact(value: unknown): MobileOnboardingResumeRead['consent'] {
  if (!isRecord(value)) return { readable: false, accepted: null, unsatisfiedPurposes: [] }
  const accepted = typeof value.accepted === 'boolean' ? value.accepted : null
  const purposes = Array.isArray(value.unsatisfiedPurposes)
    ? value.unsatisfiedPurposes.filter((item): item is string => typeof item === 'string')
    : null
  if (accepted === null && purposes === null) return { readable: false, accepted: null, unsatisfiedPurposes: [] }
  return { readable: true, accepted, unsatisfiedPurposes: purposes ?? [] }
}

async function readIamResumeFacts(): Promise<{ adultGate: string; consent: MobileOnboardingResumeRead['consent'] }> {
  const raw = await mobileApiClient.request<unknown>('/iam/principal/me')
  const source = unwrap(raw)
  const record = isRecord(source) ? source : {}
  const principal = isRecord(record.principal) ? record.principal : record
  const adultGate = parseAdultGateFact(record.adultGate ?? record.adultGateStatus ?? principal.adultGate ?? principal.adultGateStatus)
  const consentSource = isRecord(record.consentState) ? record.consentState : isRecord(principal.consentState) ? principal.consentState : null
  return { adultGate, consent: parseConsentFact(consentSource) }
}

async function readTargetFact(): Promise<MobileOnboardingResumeRead['target'] & { consentRequired: boolean }> {
  try {
    const raw = await mobileApiClient.request<unknown>('/learner/targets')
    const source = unwrap(raw)
    const record = isRecord(source) ? source : {}
    const goal = mapUiGoalCode(text(record.goalCode ?? record.goal_code))
    const quota = number(record.dailyQuotaMinutes ?? record.daily_quota_minutes, 0)
    const saved = Boolean(goal && [5, 15, 30, 45].includes(quota))
    return { readable: true, saved, goal: saved ? goal : null, quota: saved ? quota : null, consentRequired: false }
  } catch (error) {
    if (error instanceof MobileApiError && error.status === 404) return { readable: true, saved: false, goal: null, quota: null, consentRequired: false }
    if (error instanceof MobileApiError && error.status === 403 && decisionCode(error.details) === 'CONSENT_REQUIRED') {
      return { readable: true, saved: false, goal: null, quota: null, consentRequired: true }
    }
    return { readable: false, saved: false, goal: null, quota: null, consentRequired: false }
  }
}

async function signConsent(type: string, keySuffix: string, clientEventId: string): Promise<void> {
  // Read the published version first; the b30 constant is only a last-resort fallback.
  const version = cachedActiveConsentVersion ?? await refreshActiveConsentVersion()
  try {
    await mobileApiClient.request('/iam/consents', {
      method: 'PUT',
      data: { type, version, decision: 'ACCEPTED' },
      header: { 'Idempotency-Key': `${clientEventId}-${keySuffix}` },
    })
  } catch (error) {
    if (error instanceof MobileApiError && error.status === 409) {
      let latestVersion = cachedActiveConsentVersion
      if (latestVersion === version || !latestVersion) latestVersion = await refreshActiveConsentVersion()
      if (latestVersion && latestVersion !== version) {
        await mobileApiClient.request('/iam/consents', {
          method: 'PUT',
          data: { type, version: latestVersion, decision: 'ACCEPTED' },
          // A different body needs its own key; reusing the first key is rejected as key_reused.
          header: { 'Idempotency-Key': `${clientEventId}-${keySuffix}-${latestVersion}` },
        })
        return
      }
    }
    throw error
  }
}

async function signRequiredConsents(clientEventId: string, isCurrent?: () => boolean): Promise<void> {
  requireSameIdentity(isCurrent)
  await Promise.all([
    signConsent('PRIVACY', 'privacy', clientEventId),
    signConsent('TERMS', 'terms', clientEventId),
    signConsent('ADULT_LEARNING', 'adult-learning', clientEventId),
  ])
  requireSameIdentity(isCurrent)
  const [{ useSessionStore }, { pinia }] = await Promise.all([import('../stores/session'), import('../stores/pinia')])
  requireSameIdentity(isCurrent)
  const session = useSessionStore(pinia)
  if (!await session.refreshSilently()) throw new Error(session.lastError || '必要同意已提交，但会话还没有更新。请重试。本页还没提交的内容，离开后不会保留。')
  requireSameIdentity(isCurrent)
}

export const mobileLearnerContentApi = {
  async readOnboardingResume(): Promise<MobileOnboardingResumeRead> {
    const iam = await readIamResumeFacts()
    if (iam.adultGate !== 'PASSED') return { ...iam, target: { readable: true, saved: false, goal: null, quota: null } }
    const target = await readTargetFact()
    if (target.consentRequired) {
      return {
        adultGate: iam.adultGate,
        consent: { readable: true, accepted: false, unsatisfiedPurposes: ['ADULT_LEARNING_ELIGIBILITY'] },
        target: { readable: true, saved: false, goal: null, quota: null },
      }
    }
    return { adultGate: iam.adultGate, consent: iam.consent, target }
  },

  async recordRequiredConsents(clientEventId: string, isCurrent?: () => boolean): Promise<void> {
    await signRequiredConsents(clientEventId, isCurrent)
    const iam = await readIamResumeFacts()
    const accepted = iam.consent.readable && iam.consent.accepted === true
      && !iam.consent.unsatisfiedPurposes.some((item) => item === 'ACCOUNT_TERMS' || item === 'PRIVACY_NOTICE' || item === 'ADULT_LEARNING_ELIGIBILITY')
    if (iam.adultGate === 'PASSED' && !accepted) {
      throw new Error('必要同意尚未在服务端生效，请重试。本页还没提交的内容，离开后不会保留。')
    }
  },

  async readOnboarding(): Promise<MobileOnboardingModel> {
    // Preferences are the canonical source for content locale. Resolve them
    // before requesting locale-specific onboarding options so a cached or
    // former account locale cannot leak into this learning read.
    const preferences = await requestOptional('/learner/preferences')
    const preferenceData = unwrap(preferences)
    const contentLocale = isRecord(preferenceData)
      ? text(preferenceData.contentLocale ?? preferenceData.content_locale, 'en-US')
      : 'en-US'
    const [profile, target, options] = await Promise.all([
      requestOptional(query('/learner/profile', contentLocale)),
      requestOptional(query('/learner/targets', contentLocale)),
      requestOptional(query('/onboarding/options', contentLocale)),
    ])
    return parseOnboarding(profile, target, preferences, options)
  },

  async saveOnboarding(input: { goal: string; quota: number; clientEventId: string; birthYear?: number; ageConfirmed?: boolean; privacyConsent?: boolean; termsConsent?: boolean; consentsRecorded?: boolean }, isCurrent?: () => boolean): Promise<MobileOnboardingModel> {
    requireSameIdentity(isCurrent)
    const consentFields = Boolean(input.birthYear && input.ageConfirmed && input.privacyConsent && input.termsConsent)
    if (!input.goal || !input.quota || (!input.consentsRecorded && !consentFields)) {
      throw new Error(input.consentsRecorded ? '请先选择学习目标和每天时长。' : '请先完成成人确认、同意事项和学习目标。')
    }
    const targetLevel = input.goal === 'ZERO_BASIS' ? 'A1' : input.goal === 'CET_4_6' ? 'B1' : 'B2'

    // Consent is an IAM fact. Learner writes require a freshly issued access
    // token carrying that fact, and each write advances one profile version.
    await signRequiredConsents(input.clientEventId, isCurrent)

    // Re-read the owner after IAM refresh. A previous attempt may have saved
    // only some steps before the network failed; its new retry key must not
    // start again at version zero or invent a daily task from client content.
    const [profile, existingTarget, existingPreferences] = await Promise.all([
      mobileApiClient.request<unknown>('/learner/profile'),
      mobileApiClient.request<unknown>('/learner/targets').catch((error: unknown) => {
        if (error instanceof MobileApiError && error.status === 404) return null
        throw error
      }),
      mobileApiClient.request<unknown>('/learner/preferences'),
    ])
    requireSameIdentity(isCurrent)
    let currentVersion = requireStateVersion(profile)
    const targetData = unwrap(existingTarget)
    const targetMatches = isRecord(targetData)
      && text(targetData.goalCode) === input.goal
      && number(targetData.dailyQuotaMinutes, -1) === input.quota
      && text(targetData.targetLevel) === targetLevel
      && text(targetData.status) === 'ACTIVE'
    if (!targetMatches) {
      const target = await mobileApiClient.request<unknown>('/learner/targets', {
        method: 'PUT',
        data: { expectedStateVersion: currentVersion, goalCode: input.goal, targetLevel, dailyQuotaMinutes: input.quota, status: 'ACTIVE' },
        header: { 'Idempotency-Key': `${input.clientEventId}-target` },
      })
      requireSameIdentity(isCurrent)
      currentVersion = requireStateVersion(target)
    }
    requireSameIdentity(isCurrent)
    const preferences = unwrap(existingPreferences)
    const preferencesMatch = isRecord(preferences)
      && text(preferences.uiLocale) === 'zh-CN'
      && text(preferences.contentLocale) === 'en-US'
      && text(preferences.timezone) === 'Asia/Shanghai'
      && text(preferences.themeMode) === 'SYSTEM'
      && preferences.highContrast === false
      && text(preferences.motionMode) === 'FULL'
    if (!preferencesMatch) {
      await mobileApiClient.request('/learner/preferences', {
        method: 'PATCH',
        data: { expectedStateVersion: currentVersion, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' },
        header: { 'Idempotency-Key': `${input.clientEventId}-preferences` },
      })
      requireSameIdentity(isCurrent)
    }
    const result = await mobileLearnerContentApi.readOnboarding()
    requireSameIdentity(isCurrent)
    return result
  },

  async readAccount(): Promise<MobileLearnerAccount> {
    const [profile, target, preferences] = await Promise.all([
      mobileApiClient.request<unknown>('/learner/profile'),
      requestOptional('/learner/targets'),
      requestOptional('/learner/preferences'),
    ])
    return parseAccount(profile, target, preferences)
  },

  async savePreferences(input: { themeMode?: MobileThemeMode; highContrast?: boolean; motionMode?: MobileMotionMode; contentLocale?: string; clientEventId: string }, isCurrent?: () => boolean): Promise<MobileLearnerAccount> {
    requireSameIdentity(isCurrent)
    const current = await mobileLearnerContentApi.readAccount()
    requireSameIdentity(isCurrent)
    const data: Record<string, unknown> = { expectedStateVersion: current.stateVersion }
    if (input.contentLocale !== undefined) data.contentLocale = input.contentLocale
    if (input.themeMode !== undefined || input.highContrast !== undefined || input.motionMode !== undefined) {
      data.uiLocale = current.uiLocale
      data.contentLocale = input.contentLocale ?? current.contentLocale
      data.timezone = current.timezone
      data.themeMode = input.themeMode ?? current.themeMode
      data.highContrast = input.highContrast ?? current.highContrast
      data.motionMode = input.motionMode ?? current.motionMode
    }
    if (Object.keys(data).length === 1) throw new Error('没有可保存的学习偏好。')
    await mobileApiClient.request('/learner/preferences', { method: 'PATCH', data, header: { 'Idempotency-Key': input.clientEventId } })
    requireSameIdentity(isCurrent)
    const result = await mobileLearnerContentApi.readAccount()
    requireSameIdentity(isCurrent)
    if (input.contentLocale !== undefined && result.contentLocale !== input.contentLocale) {
      throw new Error('学习内容语言尚未由账户确认，请重试。')
    }
    return result
  },

  async readFirstDay(contentLocale = 'en-US'): Promise<MobileFirstDayModel> {
    const response = await mobileApiClient.request<unknown>(query('/learner/first-day', contentLocale))
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return { state: ['NOT_READY', 'READY', 'DEGRADED'].includes(text(source.state)) ? text(source.state) as MobileFirstDayModel['state'] : 'NOT_READY', profileReady: source.profileReady === true, targetReady: source.targetReady === true, placementStatus: text(source.placementStatus, 'NOT_STARTED'), taskCount: number(source.taskCount), contentEpoch: number(source.contentEpoch), projectionVersion: number(source.projectionVersion, 1) }
  },

  async readPlacement(contentLocale = 'en-US', sessionId?: string | null): Promise<MobilePlacementModel> {
    void contentLocale
    if (!sessionId) return emptyPlacement()
    return parsePlacement(await mobileApiClient.request<unknown>(`/assessment/placement/sessions/${encodeURIComponent(sessionId)}`))
  },

  async startPlacement(contentLocale = 'en-US', clientEventId: string): Promise<MobilePlacementModel> {
    void contentLocale
    return parsePlacement(await mobileApiClient.request<unknown>('/assessment/placement/sessions', {
      method: 'POST',
      data: {},
      header: { 'Idempotency-Key': clientEventId },
    }))
  },

  async retestPlacement(contentLocale = 'en-US', sessionId: string, clientEventId: string): Promise<MobilePlacementModel> {
    void contentLocale
    return parsePlacement(await mobileApiClient.request<unknown>(`/assessment/placement/sessions/${encodeURIComponent(sessionId)}/retest`, {
      method: 'POST',
      data: {},
      header: { 'Idempotency-Key': clientEventId },
    }))
  },

  async submitPlacementAnswer(input: { sessionId: string; questionId: string; selectedKey: string; timeSpentSec: number; contentLocale: string; clientEventId: string; stateVersion?: number | null; itemId?: number | null; itemSequence?: number | null }): Promise<MobilePlacementModel> {
    const stateVersion = input.stateVersion
    const itemId = input.itemId
    const itemSequence = input.itemSequence
    if (stateVersion == null || itemId == null || itemSequence == null || !Number.isSafeInteger(stateVersion) || !Number.isSafeInteger(itemId) || !Number.isSafeInteger(itemSequence) || itemId < 1 || itemSequence < 1 || itemSequence > 10) {
      throw new Error('这题还没有服务端检查点，没有提交。')
    }
    const idempotencyKey = input.clientEventId
    const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [input.selectedKey] }
    const responseDigest = await sha256Hex(JSON.stringify([input.sessionId, itemId, itemSequence, candidateResponse]))
    const data = { expectedStateVersion: stateVersion, itemId, itemSequence, candidateResponse, responseDigest, timeSpentSec: input.timeSpentSec }
    const path = `/assessment/placement/sessions/${encodeURIComponent(input.sessionId)}/responses`
    const post = () => mobileApiClient.request<unknown>(path, { method: 'POST', data, header: { 'Idempotency-Key': idempotencyKey } })
    const readBack = () => mobileLearnerContentApi.readPlacement(input.contentLocale, input.sessionId)
    const reconcile = async (retried: boolean): Promise<MobilePlacementModel> => {
      const latest = await readBack()
      if (placementConflictAction({ stateVersion, itemSequence, itemId }, latest, retried) !== 'retry') {
        return { ...latest, reconciledWithoutReceipt: true }
      }
      try {
        return parsePlacement(await post(), false)
      } catch (error) {
        if (!(error instanceof MobileApiError) || error.status !== 409) throw error
        const afterRetry = await readBack()
        return { ...afterRetry, reconciledWithoutReceipt: true }
      }
    }
    try {
      return parsePlacement(await post(), false)
    } catch (error) {
      if (!(error instanceof MobileApiError) || error.status !== 409) throw error
      return reconcile(false)
    }
  },

  async readHome(contentLocale = 'en-US'): Promise<MobileHomeModel> {
    const [learner, content] = await Promise.all([
      mobileApiClient.request<unknown>(query('/learner/home', contentLocale)),
      mobileApiClient.request<unknown>(query('/content/learner/catalog', contentLocale)),
    ])
    return parseHome(learner, content)
  },

  async readContent(contentCode: string): Promise<MobileContentDetail> {
    return parseContentDetail(await mobileApiClient.request<unknown>(`/content/learner/${encodeURIComponent(contentCode)}`))
  },

  async completeTask(taskId: string, clientEventId: string): Promise<MobileHomeModel | null> {
    const response = await mobileApiClient.request<unknown>(`/onboarding/daily-tasks/${encodeURIComponent(taskId)}/complete`, { method: 'POST', data: { taskId }, header: { 'Idempotency-Key': clientEventId } })
    return response === undefined ? null : parseHome(response, response)
  },
}

export function mobileLearnerContentError(error: unknown): Error {
  const apiError = mapError(error)
  if (apiError.status === 401) return new Error('请先登录后再保存学习目标。')
  if (apiError.status === 403) return new Error('当前会话没有访问该学习投影的权限。')
  if (apiError.status === 404) return new Error('当前内容版本已下线或暂不可用。')
  return apiError
}
