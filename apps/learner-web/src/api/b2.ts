import { apiClient, type ApiRequestOptions } from './client'
import { createClientId } from '../platform/client-id'
import type {
  ChoiceQuestion,
  ContinueContext,
  DelayedVerifyStage,
  DragSorterQuestion,
  FillBlankQuestion,
  ItemType,
  LearningReport,
  LearningItemRef,
  ListenQuestion,
  MasteryStatus,
  PracticeQuestion,
  PracticeSession,
  ReviewEventInput,
  ReviewResult,
  SrsSummary,
  TranslationQuestion,
  VocabularyCard,
  VocabularyCardBack,
} from '../domain/b2'

interface RecordValue { [key: string]: unknown }

function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null }
function unwrap(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
function itemIdValue(value: unknown): number | string | null {
  const numeric = numberValue(value)
  if (numeric !== null) return numeric
  return stringValue(value)
}
function boolValue(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }

function withB2Headers(options: ApiRequestOptions = {}, stableKey?: string): ApiRequestOptions {
  const key = stableKey ?? createClientId('b2')
  const headers = { ...(options.headers ?? {}), 'Idempotency-Key': key, 'X-Device-Id': 'learner-web', 'X-Client-Version': 'b2-web', 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' }
  return { ...options, headers }
}

function parseItem(value: unknown): LearningItemRef | null {
  if (!isRecord(value)) return null
  const itemType = value.itemType
  const vocabId = itemIdValue(value.vocabId ?? value.vocabularyId ?? (itemType === 'VOCAB' ? value.itemId : null))
  const chunkId = itemIdValue(value.chunkId ?? (itemType === 'CHUNK' ? value.itemId : null))
  const expressionId = itemIdValue(value.expressionId ?? (itemType === 'EXPRESSION' ? value.itemId : null))
  const id = vocabId ?? chunkId ?? expressionId
  if (id === null) return null
  if (itemType === 'VOCAB' && vocabId !== null) return { itemType, vocabId }
  if (itemType === 'CHUNK' && chunkId !== null) return { itemType, chunkId }
  if (itemType === 'EXPRESSION' && expressionId !== null) return { itemType, expressionId }
  return null
}

function parseSrs(value: unknown): SrsSummary | null {
  if (!isRecord(value)) return null
  const masteryStatus = value.masteryStatus
  const delayedVerifyStage = value.delayedVerifyStage
  const riskBand = value.riskBand
  const validMastery: MasteryStatus[] = ['NEW', 'LEARNING', 'SHORT_TERM', 'CONSOLIDATING', 'MASTERED', 'CONSOLIDATED', 'AT_RISK', 'SUSPENDED']
  const validStage: DelayedVerifyStage[] = ['NONE', 'D1_PENDING', 'D7_PENDING', 'PASSED', 'FAILED']
  const validRisk = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] as const
  if (!validMastery.includes(masteryStatus as MasteryStatus)) return null
  return {
    srsStateId: numberValue(value.srsStateId), stateVersion: numberValue(value.stateVersion) ?? 0,
    masteryStatus: masteryStatus as MasteryStatus,
    delayedVerifyStage: validStage.includes(delayedVerifyStage as DelayedVerifyStage) ? delayedVerifyStage as DelayedVerifyStage : 'NONE',
    riskBand: validRisk.includes(riskBand as typeof validRisk[number]) ? riskBand as typeof validRisk[number] : 'UNKNOWN',
    dueLocalDate: stringValue(value.dueLocalDate), nextReviewLocalDate: stringValue(value.nextReviewLocalDate),
    reviewCount: numberValue(value.reviewCount) ?? 0, consecutiveCorrect: numberValue(value.consecutiveCorrect) ?? 0,
    explanation: stringValue(value.explanation),
  }
}

function parseBack(value: unknown): VocabularyCardBack | null {
  if (!isRecord(value)) return null
  const source = isRecord(value.back) ? value.back : value
  if (source.answerAvailable === false) return null
  const examples = arrayValue(source.examples).flatMap((entry) => {
    if (!isRecord(entry)) return []
    const sentence = stringValue(entry.sentence)
    return sentence ? [{ sentence, translation: stringValue(entry.translation) }] : []
  })
  const collocations = arrayValue(source.collocations).flatMap((entry) => stringValue(entry) ? [String(entry)] : [])
  const hasAnswer = source.answerAvailable === true || stringValue(source.meaningCn) !== null || stringValue(source.definitionEn) !== null || examples.length > 0
  if (!hasAnswer) return null
  return { meaningCn: stringValue(source.meaningCn), definitionEn: stringValue(source.definitionEn), partOfSpeech: stringValue(source.partOfSpeech), examples, collocations, rootSummary: stringValue(source.rootSummary), answerAvailable: true }
}

function parseCard(value: unknown, position = 0, total = 0): VocabularyCard | null {
  if (!isRecord(value)) return null
  const item = parseItem(value.item ?? value)
  const title = stringValue(value.title) ?? stringValue(value.word) ?? stringValue(value.text)
  if (!item || !title) return null
  return {
    id: stringValue(value.id) ?? `${item.itemType}-${position}`,
    snapshotId: numberValue(value.snapshotId), snapshotItemId: numberValue(value.snapshotItemId), item, title,
    phoneticUs: stringValue(value.phoneticUs), phoneticUk: stringValue(value.phoneticUk),
    audioUsNormal: stringValue(value.audioUsNormal), audioUkNormal: stringValue(value.audioUkNormal),
    frontHint: stringValue(value.frontHint) ?? stringValue(value.prompt), contentVersion: stringValue(value.contentVersion),
    position: numberValue(value.position) ?? position, total: numberValue(value.total) ?? total, srs: parseSrs(value.srs ?? value.srsSummary), back: parseBack(value),
  }
}

function parseQuestion(value: unknown): PracticeQuestion | null {
  if (!isRecord(value)) return null
  const id = stringValue(value.id) ?? stringValue(value.exerciseId) ?? stringValue(value.questionId) ?? stringValue(value.itemId)
  const prompt = stringValue(value.prompt) ?? stringValue(value.stemText) ?? stringValue(value.stem)
  const type = value.type ?? value.questionType ?? 'CHOICE'
  if (!id || !prompt) return null
  const base = { id, prompt, helperText: stringValue(value.helperText), explanation: stringValue(value.explanation), item: parseItem(value.item) }
  const options = arrayValue(value.options).flatMap((entry) => {
    if (!isRecord(entry)) return []
    const key = stringValue(entry.key) ?? stringValue(entry.optionKey) ?? stringValue(entry.optionId)
    const text = stringValue(entry.text) ?? stringValue(entry.label)
    return key && text ? [{ key, text }] : []
  })
  if ((type === 'CHOICE' || type === 'MEANING_CHOICE') && options.length > 0) return { ...base, type: 'CHOICE', options } satisfies ChoiceQuestion
  if ((type === 'FILL_BLANK' || type === 'CLOZE') && options.length > 0) return { ...base, type: 'FILL_BLANK', sentence: stringValue(value.sentence) ?? prompt, options, placeholder: stringValue(value.placeholder) ?? '[BLANK]' } satisfies FillBlankQuestion
  if (type === 'DRAG_SORTER' || type === 'ANAGRAM') {
    const tokens = arrayValue(value.tokens).flatMap((entry) => {
      if (!isRecord(entry)) return []
      const tokenId = stringValue(entry.tokenId) ?? stringValue(entry.id)
      const text = stringValue(entry.text)
      return tokenId && text ? [{ tokenId, text }] : []
    })
    if (tokens.length > 0) return { ...base, type: 'DRAG_SORTER', tokens } satisfies DragSorterQuestion
  }
  if ((type === 'LISTEN' || type === 'AUDIO_CHOICE') && options.length > 0) return { ...base, type: 'LISTEN', audioUrl: stringValue(value.audioUrl), options, transcript: stringValue(value.transcript) } satisfies ListenQuestion
  if (type === 'TRANSLATION') return { ...base, type: 'TRANSLATION', sourceText: stringValue(value.sourceText) ?? prompt, placeholder: stringValue(value.placeholder) ?? '输入你的译文' } satisfies TranslationQuestion
  return null
}

function parseSession(value: unknown): PracticeSession | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const sessionId = stringValue(source.sessionId) ?? stringValue(source.id)
  if (!sessionId) return null
  const mode = stringValue(source.mode)?.toUpperCase()
  const statusValue = stringValue(source.status)?.toUpperCase()
  const status = statusValue === 'SUBMITTED' || statusValue === 'ASSESSED' ? 'COMPLETED' : statusValue
  return {
    sessionId,
    sessionType: mode === 'REVIEW' ? 'QUICK' : mode === 'MOCK' ? 'CHECKPOINT' : 'DAILY',
    status: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'INTERRUPTED', 'EXPIRED'].includes(String(status)) ? status as PracticeSession['status'] : 'CREATED',
    questions: arrayValue(source.items ?? source.questions ?? source.exercises).flatMap((item) => { const question = parseQuestion(item); return question ? [question] : [] }),
    currentIndex: numberValue(source.currentIndex) ?? 0,
    checkpointSeq: numberValue(source.checkpointSeq) ?? 0,
    answerRevision: numberValue(source.answerRevision) ?? 0,
    serverNow: stringValue(source.serverNow),
    stateVersion: numberValue(source.stateVersion) ?? 1,
    lastAttemptId: stringValue(source.lastAttemptId),
    reportId: stringValue(source.reportId),
  }
}

function parseReviewResult(value: unknown): ReviewResult {
  const source = unwrap(value)
  const record = isRecord(source) ? source : {}
  const statusValues: ReviewResult['status'][] = ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED', 'CONFLICT', 'PENDING_SYNC', 'REJECTED']
  const quality = numberValue(record.effectiveQuality)
  return { status: statusValues.includes(record.status as ReviewResult['status']) ? record.status as ReviewResult['status'] : 'REJECTED', reviewEventId: numberValue(record.reviewEventId), effectiveQuality: quality !== null && quality >= 0 && quality <= 3 ? quality as ReviewResult['effectiveQuality'] : null, masteryStatus: record.masteryStatus as ReviewResult['masteryStatus'] ?? null, delayedVerifyStage: record.delayedVerifyStage as ReviewResult['delayedVerifyStage'] ?? null, nextReviewLocalDate: stringValue(record.nextReviewLocalDate), explanation: stringValue(record.explanation) }
}

function parseReport(value: unknown, reportType: LearningReport['reportType']): LearningReport | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const report = isRecord(source.report) ? source.report : source
  const reportId = stringValue(report.reportId) ?? stringValue(report.id)
  if (!reportId) return null
  const weakness = arrayValue(report.weakness ?? report.weaknessRadar).flatMap((entry) => {
    if (!isRecord(entry)) return []
    const label = stringValue(entry.label) ?? stringValue(entry.name)
    const score = numberValue(entry.value) ?? numberValue(entry.score)
    return label && score !== null ? [{ label, value: score, evidence: stringValue(entry.evidence) }] : []
  })
  return { reportId, reportType, generatedAt: stringValue(report.generatedAt) ?? new Date().toISOString(), calculationVersion: stringValue(report.calculationVersion), studyMinutes: numberValue(report.studyMinutes), newItems: numberValue(report.newItems), reviewItems: numberValue(report.reviewItems), accuracy: numberValue(report.accuracy), xp: numberValue(report.xp), streakDays: numberValue(report.streakDays), masteredIncrement: numberValue(report.masteredIncrement), forgettingRate: numberValue(report.forgettingRate), d1Pending: numberValue(report.d1Pending), d7Pending: numberValue(report.d7Pending), weakness }
}

export async function createSrsBatch(input: { localDate?: string; dailyNewTarget?: number; maxDailyReview?: number }): Promise<VocabularyCard[]> {
  const localDate = input.localDate ?? new Date().toISOString().slice(0, 10)
  const response = await apiClient.post<unknown>('/learning/srs/batches', { localDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai', dailyNewTarget: input.dailyNewTarget ?? 20, maxDailyReview: input.maxDailyReview ?? 50, scheduleType: 'DAILY' }, withB2Headers({}, `b2-batch-${localDate}`))
  const source = unwrap(response)
  return isRecord(source) ? arrayValue(source.items).flatMap((item, index) => { const card = parseCard(item, index, arrayValue(source.items).length); return card ? [card] : [] }) : []
}

export async function fetchVocabDetail(item: LearningItemRef, snapshotId: number | null): Promise<VocabularyCardBack> {
  const id = item.itemType === 'VOCAB' ? item.vocabId : item.itemType === 'CHUNK' ? item.chunkId : item.expressionId
  // Keep the public contract owner-specific: vocabulary front/back is content,
  // while chunks and mined expressions use the canonical /vocab resources.
  // The former /content/learner/{chunks|expressions} paths were never part of
  // the merged OpenAPI contract and caused a 404 after a card reveal.
  const path = item.itemType === 'VOCAB' ? `/content/learner/vocabulary/${encodeURIComponent(String(id))}` : item.itemType === 'CHUNK' ? `/vocab/chunks/${encodeURIComponent(String(id))}` : `/vocab/expressions/${encodeURIComponent(String(id))}`
  const response = await apiClient.get<unknown>(path, snapshotId === null ? undefined : { headers: { 'X-Snapshot-Id': String(snapshotId) } })
  const back = parseBack(unwrap(response))
  if (!back) throw new Error('服务端暂未返回可展示的词卡背面内容。')
  return back
}

export async function submitReviewEvent(event: ReviewEventInput): Promise<ReviewResult> {
  const response = await apiClient.post<unknown>('/learning/srs/reviews', event, withB2Headers({}, event.clientEventId))
  return parseReviewResult(response)
}

export async function syncReviewEvents(events: ReviewEventInput[]): Promise<ReviewResult[]> {
  const stableKey = events.map((event) => event.clientEventId).join('|').slice(0, 112) || undefined
  const response = await apiClient.post<unknown>('/learning/srs/reviews:sync', { events }, withB2Headers({}, stableKey ? `b2-sync-${stableKey}` : undefined))
  const source = unwrap(response)
  return isRecord(source) ? arrayValue(source.results ?? source.items).map(parseReviewResult) : []
}

export async function createPracticeSession(sessionType: 'DAILY' | 'QUICK' | 'CHECKPOINT', targetCount = 15): Promise<PracticeSession> {
  const mode = sessionType === 'QUICK' ? 'REVIEW' : sessionType === 'CHECKPOINT' ? 'MOCK' : 'PRACTICE'
  const stableKey = `b2-practice-session-${sessionType}`
  const response = await apiClient.post<unknown>('/assessment/sessions', { contentVersionId: 25001, mode, clientSessionRef: stableKey }, withB2Headers({}, stableKey))
  const session = parseSession(response)
  if (!session) throw new Error('练习服务返回了无法识别的会话。')
  return session
}

export async function fetchPracticeSession(sessionId: string): Promise<PracticeSession> {
  const response = await apiClient.get<unknown>(`/assessment/sessions/${encodeURIComponent(sessionId)}`)
  const session = parseSession(response)
  if (!session) throw new Error('练习会话数据暂时无法读取。')
  return session
}

export async function submitPracticeAnswer(sessionId: string, answer: { exerciseId: string; answer: unknown; clientAnswerId: string; stateVersion: number }): Promise<{ correct: boolean | null; feedback: string | null; errorCategory: string | null; attemptId: string | null; reportId: string | null }> {
  const itemId = Number(answer.exerciseId)
  if (!Number.isSafeInteger(itemId) || itemId <= 0) throw new Error('练习题缺少合法的服务端 itemId。')
  const response = await apiClient.post<unknown>(`/assessment/sessions/${encodeURIComponent(sessionId)}/attempts`, {
    expectedStateVersion: answer.stateVersion,
    submissionId: `sub_${answer.clientAnswerId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 112)}`,
    items: [{ itemId, sequence: 0, response: isRecord(answer.answer) ? answer.answer : { text: String(answer.answer ?? '') }, clientSubmissionId: answer.clientAnswerId }],
    clientEventId: answer.clientAnswerId,
  }, withB2Headers({}, answer.clientAnswerId))
  const source = unwrap(response)
  const record = isRecord(source) ? source : {}
  const scoreBucket = stringValue(record.scoreBucket)?.toUpperCase()
  return { correct: scoreBucket === 'FULL' ? true : scoreBucket === 'ZERO' ? false : null, feedback: scoreBucket ? `服务端已完成判分：${scoreBucket}` : '服务端已接收本次作答。', errorCategory: null, attemptId: stringValue(record.attemptId), reportId: stringValue(record.reportId) }
}

export async function savePracticeCheckpoint(sessionId: string, attemptId: string, context: ContinueContext): Promise<void> {
  const stableKey = `b2-checkpoint-${sessionId}-${context.updatedAt}`
  const digest = await checkpointDigest({ sessionId, attemptId, context })
  await apiClient.put(`/assessment/sessions/${encodeURIComponent(sessionId)}/attempts/${encodeURIComponent(attemptId)}/checkpoint`, { checkpointVersion: Math.max(1, context.stepIndex), itemCursor: Math.max(0, context.stepIndex), completedItemIds: [], checkpointDigest: digest }, withB2Headers({}, stableKey))
}

async function checkpointDigest(value: unknown): Promise<string> {
  const serialized = JSON.stringify(value)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const char of serialized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `${Math.abs(hash).toString(16).padStart(8, '0')}${'0'.repeat(56)}`
}

export async function fetchLearningReport(reportType: 'DAILY' | 'WEEKLY', date = new Date().toISOString().slice(0, 10)): Promise<LearningReport> {
  const path = reportType === 'DAILY' ? `/learning/stats/daily-report?date=${encodeURIComponent(date)}` : `/learning/stats/weekly-report?weekStart=${encodeURIComponent(date)}`
  const response = await apiClient.get<unknown>(path)
  const report = parseReport(response, reportType)
  if (!report) throw new Error('报告服务暂未返回可展示的报告快照。')
  return report
}

export function isB2OfflineError(error: unknown): boolean {
  return error instanceof TypeError || (isRecord(error) && typeof error.status === 'number' && (error.status === 0 || error.status >= 500))
}

export function itemTypeOf(item: LearningItemRef): ItemType { return item.itemType }
