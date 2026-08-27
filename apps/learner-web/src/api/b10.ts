import { ApiError, apiClient, type ApiRequestOptions } from './client'
import { learnerI18n } from '../platform/v2-foundation'
import type {
  B10DictionaryEntry,
  B10Feedback,
  B10GrammarExercise,
  B10GrammarMastery,
  B10GrammarPoint,
  B10PracticeQuestion,
  B10PracticeSession,
  B10ProofreadingIssue,
  B10ReadingArticle,
  B10ReadingAttemptResult,
  B10ReadingQuestion,
  B10Report,
  B10ReviewEvent,
  B10ReviewResult,
  B10SentenceGraph,
  B10VocabularyBack,
  B10VocabularyCard,
  B10WritingFeedback,
  B10WritingHistoryItem,
  B10WritingMaterial,
  B10WritingPrompt,
  B10WritingTemplate,
} from '../domain/b10'

interface RecordValue { [key: string]: unknown }

export const B10_GATEWAY_ROUTES = {
  learning: {
    vocabularyBatch: '/learning/srs/batches',
    vocabularyReview: '/learning/srs/reviews',
    vocabularySync: '/learning/srs/reviews:sync',
    readingProgress: '/reading/progress',
    readingMining: '/reading/mining',
    grammarBlocks: '/grammar/sentences',
    grammarImitation: '/grammar/sentences',
    writingHistory: '/writing/history',
    reportDaily: '/learning/stats/daily-report',
    reportWeekly: '/learning/stats/weekly-report',
  },
  assessment: {
    sessions: '/assessment/sessions',
    grammarAttempts: '/grammar/practice/attempts',
    readingAttempts: '/reading/attempts',
    writingSubmissions: '/writing/submissions',
    proofreading: '/writing/corrections',
  },
  content: {
    vocabularyItem: '/content/learner/vocabulary',
    vocabularyChunk: '/vocab/chunks',
    vocabularyExpression: '/vocab/expressions',
    readingArticles: '/reading/articles',
    readingQuestions: '/reading/questions',
    grammarPoints: '/grammar/points',
    grammarExercises: '/grammar/exercises',
    grammarMastery: '/grammar/mastery',
    grammarSentences: '/grammar/sentences',
    writingPrompts: '/writing/prompts',
    writingTemplates: '/writing/templates',
    writingMaterials: '/writing/materials',
    proofreadingExercises: '/writing/proofreading/exercises',
  },
} as const

export class B10ContentStaleError extends Error {
  readonly code = 'CONTENT_VERSION_STALE'

  constructor(message = '内容版本已失效或已下线，请重新读取最新内容。') {
    super(message)
    this.name = 'B10ContentStaleError'
  }
}

function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
function boolValue(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null }
function recordValue(value: unknown): RecordValue { return isRecord(value) ? value : {} }
function contentVersionId(value: RecordValue): number | null { return numberValue(value.contentVersionId) ?? numberValue(value.versionId) }
function pinnedContentVersionId(value: RecordValue): number | null { return contentVersionId(value) ?? contentVersionId(recordValue(value.pin)) }
function contentLocale(value: RecordValue): string { return stringValue(value.contentLocale) ?? learnerI18n.contentLocale ?? 'en-US' }

function listFrom(value: unknown, keys: string[] = ['items', 'records', 'questions']): unknown[] {
  const source = unwrap(value)
  if (Array.isArray(source)) return source
  const record = recordValue(source)
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[]
  return []
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value))
  const result = search.toString()
  return result ? `?${result}` : ''
}

function withB10Headers(stableKey?: string, options: ApiRequestOptions = {}): ApiRequestOptions {
  const headers = new Headers(options.headers)
  headers.set('X-Device-Id', 'learner-web')
  headers.set('X-Client-Version', 'b10-learner-web')
  headers.set('X-Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai')
  headers.set('X-UI-Locale', learnerI18n.locale || 'zh-CN')
  headers.set('X-Content-Locale', learnerI18n.contentLocale || 'en-US')
  if (stableKey) headers.set('Idempotency-Key', stableKey)
  return { ...options, headers }
}

function assertPublished(value: RecordValue): void {
  const status = stringValue(value.status)?.toUpperCase()
  const rights = stringValue(value.rightsStatus)?.toUpperCase()
  const availability = stringValue(value.availability)?.toUpperCase()
  if (['WITHDRAWN', 'UNPUBLISHED', 'REVOKED', 'EXPIRED'].includes(status ?? '') || rights === 'REVOKED' || availability === 'WITHDRAWN') throw new B10ContentStaleError()
}

function parseItem(value: unknown): { itemType: B10VocabularyCard['itemType']; itemId: number | string } | null {
  const source = recordValue(value)
  const id = numberValue(source.vocabId) ?? numberValue(source.chunkId) ?? numberValue(source.expressionId) ?? numberValue(source.itemId)
  const textId = stringValue(source.vocabularyId) ?? stringValue(source.itemId)
  const resolvedId = id ?? textId
  if (resolvedId === null) return null
  const rawType = stringValue(source.itemType)?.toUpperCase()
  if (rawType === 'CHUNK' || numberValue(source.chunkId) !== null) return { itemType: 'CHUNK', itemId: resolvedId }
  if (rawType === 'EXPRESSION' || numberValue(source.expressionId) !== null) return { itemType: 'EXPRESSION', itemId: resolvedId }
  return { itemType: 'VOCAB', itemId: resolvedId }
}

function parseSrs(value: unknown): B10VocabularyCard['srs'] {
  const source = recordValue(value)
  if (!Object.keys(source).length) return null
  return {
    stateVersion: numberValue(source.stateVersion) ?? 0,
    masteryStatus: stringValue(source.masteryStatus) ?? stringValue(source.stage) ?? 'NEW',
    delayedVerifyStage: stringValue(source.delayedVerifyStage) ?? 'NONE',
    riskBand: stringValue(source.riskBand) ?? 'UNKNOWN',
    dueLocalDate: stringValue(source.dueLocalDate) ?? stringValue(source.dueAt),
    nextReviewLocalDate: stringValue(source.nextReviewLocalDate),
    reviewCount: numberValue(source.reviewCount) ?? 0,
    consecutiveCorrect: numberValue(source.consecutiveCorrect) ?? 0,
  }
}

function parseVocabularyBack(value: unknown): B10VocabularyBack | null {
  const source = recordValue(value)
  const back = recordValue(source.back ?? source.detail ?? source)
  if (back.answerAvailable === false) return null
  const examples = arrayValue(back.examples).flatMap((entry) => {
    const item = recordValue(entry)
    const sentence = stringValue(item.sentence)
    return sentence ? [{ sentence, translation: stringValue(item.translation) }] : []
  })
  const collocations = arrayValue(back.collocations).flatMap((entry) => stringValue(entry) ? [String(entry)] : [])
  const hasContent = stringValue(back.meaningCn) !== null || stringValue(back.definitionEn) !== null || examples.length > 0 || collocations.length > 0
  if (!hasContent) return null
  return {
    meaningCn: stringValue(back.meaningCn),
    definitionEn: stringValue(back.definitionEn),
    partOfSpeech: stringValue(back.partOfSpeech),
    examples,
    collocations,
    rootSummary: stringValue(back.rootSummary),
  }
}

function parseVocabularyCard(value: unknown, position: number, total: number): B10VocabularyCard | null {
  const source = recordValue(value)
  assertPublished(source)
  const item = parseItem(source.item ?? source)
  const title = stringValue(source.title) ?? stringValue(source.word) ?? stringValue(source.text)
  if (!item || !title) return null
  return {
    id: stringValue(source.id) ?? `${item.itemType}-${item.itemId}-${position}`,
    ...item,
    snapshotId: numberValue(source.snapshotId),
    snapshotItemId: numberValue(source.snapshotItemId),
    title,
    phoneticUs: stringValue(source.phoneticUs),
    phoneticUk: stringValue(source.phoneticUk),
    frontHint: stringValue(source.frontHint) ?? stringValue(source.prompt),
    contentVersionId: contentVersionId(source),
    contentLocale: contentLocale(source),
    position: numberValue(source.position) ?? position,
    total: numberValue(source.total) ?? total,
    srs: parseSrs(source.srs ?? source.srsSummary),
    back: parseVocabularyBack(source),
  }
}

function parsePracticeQuestion(value: unknown): B10PracticeQuestion | null {
  const source = recordValue(value)
  const id = stringValue(source.id) ?? (numberValue(source.exerciseId) !== null ? String(source.exerciseId) : null) ?? (numberValue(source.questionId) !== null ? String(source.questionId) : null) ?? (numberValue(source.itemId) !== null ? String(source.itemId) : null)
  const prompt = stringValue(source.prompt) ?? stringValue(source.stemText) ?? stringValue(source.stem)
  const rawType = stringValue(source.type ?? source.questionType)?.toUpperCase() ?? (stringValue(source.itemType) ? 'CHOICE' : null)
  if (!id || !prompt || !['CHOICE', 'FILL_BLANK', 'CLOZE', 'DRAG_SORTER', 'ANAGRAM', 'TRANSLATION'].includes(rawType ?? '')) return null
  const options = arrayValue(source.options).flatMap((entry) => {
    const item = recordValue(entry)
    const key = stringValue(item.key) ?? stringValue(item.optionKey) ?? stringValue(item.optionCode) ?? stringValue(item.optionId)
    const text = stringValue(item.text) ?? stringValue(item.label)
    return key && text ? [{ key, text }] : []
  })
  const tokens = arrayValue(source.tokens).flatMap((entry) => {
    const item = recordValue(entry)
    const tokenId = stringValue(item.tokenId) ?? stringValue(item.id)
    const text = stringValue(item.text)
    return tokenId && text ? [{ tokenId, text }] : []
  })
  const type = rawType === 'FILL_BLANK' || rawType === 'CLOZE' ? 'FILL_BLANK' : rawType === 'DRAG_SORTER' || rawType === 'ANAGRAM' ? 'DRAG_SORTER' : rawType === 'TRANSLATION' ? 'TRANSLATION' : 'CHOICE'
  return {
    id,
    type,
    prompt,
    helperText: stringValue(source.helperText),
    sentence: stringValue(source.sentence),
    sourceText: stringValue(source.sourceText),
    placeholder: stringValue(source.placeholder),
    options,
    tokens,
    contentVersionId: pinnedContentVersionId(source),
    contentLocale: contentLocale(source),
  }
}

function parseSession(value: unknown): B10PracticeSession | null {
  const source = recordValue(unwrap(value))
  const sessionId = stringValue(source.sessionId) ?? stringValue(source.id)
  if (!sessionId) return null
  const statusValue = stringValue(source.status)?.toUpperCase()
  const allowedStatuses: B10PracticeSession['status'][] = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'INTERRUPTED', 'AUTO_SUBMITTED', 'EXPIRED']
  const questions = listFrom(source.items ?? source.questions ?? source.exercises, ['items', 'questions', 'exercises']).flatMap((item) => { const question = parsePracticeQuestion(item); return question ? [question] : [] })
  const mode = stringValue(source.mode)?.toUpperCase()
  const status = statusValue === 'SUBMITTED' || statusValue === 'ASSESSED' ? 'COMPLETED' : statusValue
  const pin = recordValue(source.pin)
  return {
    sessionId,
    sessionType: mode === 'REVIEW' ? 'QUICK' : mode === 'MOCK' ? 'CHECKPOINT' : 'DAILY',
    status: allowedStatuses.includes(status as B10PracticeSession['status']) ? status as B10PracticeSession['status'] : 'CREATED',
    questions,
    currentIndex: numberValue(source.currentIndex) ?? 0,
    checkpointSeq: numberValue(source.checkpointSeq) ?? 0,
    answerRevision: numberValue(source.answerRevision) ?? 0,
    contentVersionId: pinnedContentVersionId(source),
    stateVersion: numberValue(source.stateVersion) ?? 1,
    lastAttemptId: stringValue(source.lastAttemptId),
    reportId: stringValue(source.reportId),
  }
}

function parseFeedback(value: unknown): B10Feedback {
  const source = recordValue(unwrap(value))
  const correct = boolValue(source.correct)
  const nextAction = stringValue(source.nextAction)?.toUpperCase()
  return {
    correct,
    feedbackCode: stringValue(source.feedbackCode) ?? stringValue(source.code),
    message: stringValue(source.feedback) ?? stringValue(source.message) ?? stringValue(source.explanation),
    errorCategory: stringValue(source.errorCategory),
    ruleVersion: stringValue(source.ruleVersion),
    nextAction: nextAction === 'RETRY' || nextAction === 'REVIEW' || nextAction === 'NEXT' ? nextAction : correct === false ? 'RETRY' : 'NEXT',
    evidence: stringValue(source.evidence) ?? stringValue(source.evidenceText),
    attemptId: stringValue(source.attemptId),
    reportId: stringValue(source.reportId),
  }
}

function parseReport(value: unknown, reportType: B10Report['reportType']): B10Report | null {
  const source = recordValue(unwrap(value))
  const report = recordValue(source.report ?? source)
  const reportId = stringValue(report.reportId) ?? stringValue(report.id)
  if (!reportId) return null
  const weakness = arrayValue(report.weakness ?? report.weaknessRadar).flatMap((entry) => {
    const item = recordValue(entry)
    const label = stringValue(item.label) ?? stringValue(item.name)
    const valueNumber = numberValue(item.value) ?? numberValue(item.score)
    return label && valueNumber !== null ? [{ label, value: valueNumber, evidence: stringValue(item.evidence), nextAction: stringValue(item.nextAction) }] : []
  })
  return {
    reportId,
    reportType,
    generatedAt: stringValue(report.generatedAt) ?? new Date().toISOString(),
    calculationVersion: stringValue(report.calculationVersion),
    studyMinutes: numberValue(report.studyMinutes),
    newItems: numberValue(report.newItems),
    reviewItems: numberValue(report.reviewItems),
    accuracy: numberValue(report.accuracy),
    masteredIncrement: numberValue(report.masteredIncrement),
    forgettingRate: numberValue(report.forgettingRate),
    d1Pending: numberValue(report.d1Pending),
    d7Pending: numberValue(report.d7Pending),
    weakness,
  }
}

function parseReadingArticle(value: unknown): B10ReadingArticle | null {
  const source = recordValue(value)
  assertPublished(source)
  const articleId = numberValue(source.articleId) ?? numberValue(source.id)
  const contentVersion = contentVersionId(source)
  const title = stringValue(source.title)
  if (articleId === null || contentVersion === null || !title) return null
  const blocks = arrayValue(source.blocks ?? source.paragraphs).flatMap((entry, index) => {
    const item = recordValue(entry)
    const blockId = stringValue(item.blockId) ?? stringValue(item.id)
    const text = stringValue(item.text)
    if (!blockId || !text) return []
    const tokens = arrayValue(item.tokens).flatMap((token) => {
      const tokenItem = recordValue(token)
      const tokenId = stringValue(tokenItem.tokenId) ?? stringValue(tokenItem.id)
      const tokenText = stringValue(tokenItem.text)
      return tokenId && tokenText ? [{ tokenId, text: tokenText }] : []
    })
    return [{ blockId, blockIndex: numberValue(item.blockIndex) ?? index, text, translation: stringValue(item.translation), tokens }]
  })
  return {
    articleId,
    title,
    cefrLevel: stringValue(source.cefrLevel) ?? '—',
    wordCount: numberValue(source.wordCount) ?? 0,
    estimatedMinutes: numberValue(source.estimatedMinutes) ?? 0,
    rightsStatus: stringValue(source.rightsStatus)?.toUpperCase() === 'REVOKED' ? 'REVOKED' : 'AUTHORIZED',
    contentVersionId: contentVersion,
    contentLocale: contentLocale(source),
    blocks,
  }
}

function parseGrammarPoint(value: unknown): B10GrammarPoint | null {
  const source = recordValue(value)
  assertPublished(source)
  const grammarPointId = numberValue(source.grammarPointId) ?? numberValue(source.id)
  const version = contentVersionId(source)
  const title = stringValue(source.title)
  if (grammarPointId === null || version === null || !title) return null
  return {
    grammarPointId,
    code: stringValue(source.code) ?? `GRAMMAR-${grammarPointId}`,
    title,
    ruleSummary: stringValue(source.ruleSummary) ?? stringValue(source.meaningCn),
    meaningCn: stringValue(source.meaningCn),
    cefrLevel: stringValue(source.cefrLevel),
    trapTags: arrayValue(source.trapTags).flatMap((tag) => stringValue(tag) ? [String(tag)] : []),
    contentVersionId: version,
    sentenceId: numberValue(source.sentenceId),
  }
}

function parseGrammarExercise(value: unknown): B10GrammarExercise | null {
  const source = recordValue(value)
  assertPublished(source)
  const exerciseId = numberValue(source.exerciseId) ?? numberValue(source.id)
  const grammarPointId = numberValue(source.grammarPointId)
  const version = contentVersionId(source)
  const promptText = stringValue(source.promptText) ?? stringValue(source.prompt)
  const type = stringValue(source.type)?.toUpperCase()
  if (exerciseId === null || grammarPointId === null || version === null || !promptText || !['FILL_BLANK', 'CHOICE', 'SENTENCE_BUILD', 'PARAPHRASE', 'CORRECTION'].includes(type ?? '')) return null
  const options = arrayValue(source.options).flatMap((entry) => { const item = recordValue(entry); const key = stringValue(item.optionCode) ?? stringValue(item.key); const text = stringValue(item.label) ?? stringValue(item.text); return key && text ? [{ key, text }] : [] })
  const tokens = arrayValue(source.tokens).flatMap((entry) => { const item = recordValue(entry); const tokenId = stringValue(item.tokenId) ?? stringValue(item.id); const text = stringValue(item.text); return tokenId && text ? [{ tokenId, text }] : [] })
  return { exerciseId, grammarPointId, type: type as B10GrammarExercise['type'], promptText, options, tokens, contentVersionId: version, contentLocale: contentLocale(source) }
}

function parseGrammarMastery(value: unknown): B10GrammarMastery | null {
  const source = recordValue(value)
  const grammarPointId = numberValue(source.grammarPointId) ?? numberValue(source.id)
  if (grammarPointId === null) return null
  const level = stringValue(source.level)?.toUpperCase()
  return { grammarPointId, dimensions: isRecord(source.dimensions) ? Object.fromEntries(Object.entries(source.dimensions).flatMap(([key, item]) => numberValue(item) === null ? [] : [[key, numberValue(item) as number]])) : {}, overall: numberValue(source.overall) ?? 0, level: level === 'MASTERED' || level === 'DEVELOPING' ? level : 'REVIEW' }
}

function parseSentenceGraph(value: unknown): B10SentenceGraph | null {
  const source = recordValue(unwrap(value))
  const sentenceId = numberValue(source.sentenceId) ?? numberValue(source.id)
  const version = contentVersionId(source)
  const text = stringValue(source.text) ?? stringValue(source.sentence)
  if (sentenceId === null || version === null || !text) return null
  const nodes = arrayValue(source.nodes).flatMap((entry) => { const item = recordValue(entry); const nodeId = stringValue(item.nodeId) ?? stringValue(item.id); const nodeText = stringValue(item.text); const role = stringValue(item.role); const startToken = numberValue(item.startToken); const endToken = numberValue(item.endToken); return nodeId && nodeText && role && startToken !== null && endToken !== null ? [{ nodeId, role, text: nodeText, startToken, endToken }] : [] })
  const edges = arrayValue(source.edges).flatMap((entry) => { const item = recordValue(entry); const fromNodeId = stringValue(item.fromNodeId); const toNodeId = stringValue(item.toNodeId); const relation = stringValue(item.relation); return fromNodeId && toNodeId && relation ? [{ fromNodeId, toNodeId, relation }] : [] })
  return { sentenceId, text, translation: stringValue(source.translation), contentVersionId: version, nodes, edges, blockOrder: arrayValue(source.blockOrder).flatMap((item) => stringValue(item) ? [String(item)] : []), imitationSlots: isRecord(source.imitationSlots) ? Object.fromEntries(Object.entries(source.imitationSlots).flatMap(([key, item]) => stringValue(item) ? [[key, String(item)]] : [])) : {} }
}

function parseWritingPrompt(value: unknown): B10WritingPrompt | null {
  const source = recordValue(value)
  assertPublished(source)
  const promptId = numberValue(source.promptId) ?? numberValue(source.id)
  const version = contentVersionId(source)
  const title = stringValue(source.title)
  const taskText = stringValue(source.taskText) ?? stringValue(source.prompt)
  if (promptId === null || version === null || !title || !taskText) return null
  return { promptId, promptType: stringValue(source.promptType) ?? 'RULED_WRITING', title, taskText, targetStructure: arrayValue(source.targetStructure).flatMap((item) => stringValue(item) ? [String(item)] : []), contentVersionId: version, contentLocale: contentLocale(source) }
}

function parseWritingTemplate(value: unknown): B10WritingTemplate | null {
  const source = recordValue(value)
  const templateId = numberValue(source.templateId) ?? numberValue(source.id)
  const version = contentVersionId(source)
  const title = stringValue(source.title)
  if (templateId === null || version === null || !title) return null
  const structure = arrayValue(source.structure).flatMap((entry) => { const item = recordValue(entry); const slotCode = stringValue(item.slotCode); const label = stringValue(item.label); return slotCode && label ? [{ slotCode, label, required: item.required === true }] : [] })
  return { templateId, title, structure, contentVersionId: version }
}

function parseWritingMaterial(value: unknown): B10WritingMaterial | null {
  const source = recordValue(value)
  const materialId = numberValue(source.materialId) ?? numberValue(source.id)
  const version = contentVersionId(source)
  const title = stringValue(source.title)
  const bodyText = stringValue(source.bodyText) ?? stringValue(source.body)
  return materialId !== null && version !== null && title && bodyText ? { materialId, title, bodyText, contentVersionId: version } : null
}

function parseProofreadingIssue(value: unknown): B10ProofreadingIssue | null {
  const source = recordValue(value)
  assertPublished(source)
  const issueId = numberValue(source.issueId) ?? numberValue(source.id)
  const promptId = numberValue(source.promptId)
  const version = contentVersionId(source)
  const errorType = stringValue(source.errorType)
  const wrongText = stringValue(source.wrongText) ?? stringValue(source.prompt)
  return issueId !== null && promptId !== null && version !== null && errorType && wrongText ? { issueId, promptId, errorType, wrongText, contentVersionId: version } : null
}

function parseWritingFeedback(value: unknown): B10WritingFeedback | null {
  const source = recordValue(unwrap(value))
  const submissionId = numberValue(source.submissionId) ?? numberValue(source.id)
  const promptId = numberValue(source.promptId)
  if (submissionId === null || promptId === null) return null
  const feedback = parseFeedback(source)
  const items = arrayValue(source.items ?? source.rubricResults).flatMap((entry) => { const item = recordValue(entry); const code = stringValue(item.code); const feedbackCode = stringValue(item.feedbackCode) ?? stringValue(item.code); return code && feedbackCode ? [{ code, feedbackCode, message: stringValue(item.message), evidence: stringValue(item.evidence), score: numberValue(item.score) }] : [] })
  return { ...feedback, submissionId, promptId, score: numberValue(source.score), band: stringValue(source.band), items }
}

function parseWritingHistory(value: unknown): B10WritingHistoryItem | null {
  const feedback = parseWritingFeedback(value)
  if (!feedback) return null
  const source = recordValue(unwrap(value))
  return { ...feedback, submittedAt: stringValue(source.submittedAt), promptTitle: stringValue(source.promptTitle) }
}

export function errorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const details = recordValue(error.details)
  const nested = recordValue(details.error)
  return stringValue(details.errorCode) ?? stringValue(nested.errorCode) ?? stringValue(details.code)
}

export type B10FailureKind = 'offline' | 'forbidden' | 'stale' | 'error'

export function failureKind(error: unknown): B10FailureKind {
  if (error instanceof B10ContentStaleError) return 'stale'
  if (error instanceof ApiError) {
    const code = errorCode(error)?.toUpperCase() ?? ''
    if (error.status === 403) return 'forbidden'
    if (error.status === 409 || error.status === 412 || code.includes('STALE') || code.includes('WITHDRAW') || code.includes('VERSION_CONFLICT')) return 'stale'
    if (error.status >= 500 || error.status === 0) return 'offline'
    return 'error'
  }
  return error instanceof TypeError ? 'offline' : 'error'
}

export function isB10OfflineError(error: unknown): boolean { return failureKind(error) === 'offline' }

export async function listVocabularyBatch(input: { localDate?: string; dailyNewTarget?: number; maxDailyReview?: number } = {}): Promise<B10VocabularyCard[]> {
  const localDate = input.localDate ?? new Date().toISOString().slice(0, 10)
  const response = await apiClient.post<unknown>(B10_GATEWAY_ROUTES.learning.vocabularyBatch, { localDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai', dailyNewTarget: input.dailyNewTarget ?? 20, maxDailyReview: input.maxDailyReview ?? 50, scheduleType: 'DAILY' }, withB10Headers(`b10-srs-batch-${localDate}`))
  const source = recordValue(unwrap(response))
  const items = listFrom(source.items ?? source.cards, ['items', 'cards'])
  const cards = await Promise.all(items.map(async (item, index) => {
    const raw = recordValue(item)
    const itemId = stringValue(raw.itemId) ?? stringValue(raw.vocabularyId)
    let enriched: unknown = raw
    if (itemId) enriched = { ...raw, ...(await getVocabularyFront(itemId)) }
    return parseVocabularyCard(enriched, index, items.length)
  }))
  return cards.flatMap((card) => card ? [card] : [])
}

async function getVocabularyFront(itemId: string | number): Promise<RecordValue> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.vocabularyItem}/${encodeURIComponent(String(itemId))}?projection=front`, withB10Headers())
  return recordValue(unwrap(response))
}

export async function getVocabularyDetail(card: Pick<B10VocabularyCard, 'itemType' | 'itemId' | 'contentVersionId'>): Promise<B10VocabularyBack> {
  const route = card.itemType === 'VOCAB' ? B10_GATEWAY_ROUTES.content.vocabularyItem : card.itemType === 'CHUNK' ? B10_GATEWAY_ROUTES.content.vocabularyChunk : B10_GATEWAY_ROUTES.content.vocabularyExpression
  const response = await apiClient.get<unknown>(`${route}/${card.itemId}`, withB10Headers(undefined, card.contentVersionId === null ? {} : { headers: { 'X-Snapshot-Id': String(card.contentVersionId) } }))
  const source = recordValue(unwrap(response))
  assertPublished(source)
  const back = parseVocabularyBack(source)
  if (!back) throw new Error('服务端暂未返回可展示的词卡背面内容。')
  return back
}

export async function submitVocabularyReview(event: B10ReviewEvent): Promise<B10ReviewResult> {
  const payload = typeof event.itemId === 'string'
    ? { itemId: event.itemId, quality: event.rawQuality, clientEventId: event.clientEventId }
    : event
  const response = await apiClient.post<unknown>(B10_GATEWAY_ROUTES.learning.vocabularyReview, payload, withB10Headers(event.clientEventId))
  const source = recordValue(unwrap(response))
  const status = stringValue(source.status)?.toUpperCase()
  const effectiveQuality = numberValue(source.effectiveQuality)
  return { status: ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED', 'CONFLICT', 'PENDING_SYNC', 'REJECTED'].includes(status ?? '') ? status as B10ReviewResult['status'] : 'REJECTED', effectiveQuality: effectiveQuality !== null && effectiveQuality >= 0 && effectiveQuality <= 3 ? effectiveQuality as B10ReviewResult['effectiveQuality'] : null, masteryStatus: stringValue(source.masteryStatus), delayedVerifyStage: stringValue(source.delayedVerifyStage), nextReviewLocalDate: stringValue(source.nextReviewLocalDate), feedbackCode: stringValue(source.feedbackCode) ?? stringValue(source.explanation) }
}

export async function syncVocabularyReviews(events: B10ReviewEvent[]): Promise<B10ReviewResult[]> {
  const key = events.map((event) => event.clientEventId).join('|').slice(0, 112)
  const response = await apiClient.post<unknown>(B10_GATEWAY_ROUTES.learning.vocabularySync, { events }, withB10Headers(key ? `b10-srs-sync-${key}` : undefined))
  return listFrom(unwrap(response), ['results', 'items']).map((item) => {
    const source = recordValue(item)
    const quality = numberValue(source.effectiveQuality)
    const status = stringValue(source.status)?.toUpperCase()
    return { status: ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED', 'CONFLICT', 'PENDING_SYNC', 'REJECTED'].includes(status ?? '') ? status as B10ReviewResult['status'] : 'REJECTED', effectiveQuality: quality !== null && quality >= 0 && quality <= 3 ? quality as B10ReviewResult['effectiveQuality'] : null, masteryStatus: stringValue(source.masteryStatus), delayedVerifyStage: stringValue(source.delayedVerifyStage), nextReviewLocalDate: stringValue(source.nextReviewLocalDate), feedbackCode: stringValue(source.feedbackCode) ?? stringValue(source.explanation) }
  })
}

export async function createPracticeSession(sessionType: 'DAILY' | 'QUICK' | 'CHECKPOINT', targetCount = 15): Promise<B10PracticeSession> {
  const mode = sessionType === 'QUICK' ? 'REVIEW' : sessionType === 'CHECKPOINT' ? 'MOCK' : 'PRACTICE'
  const stableKey = `b10-practice-session-${sessionType}`
  const response = await apiClient.post<unknown>(B10_GATEWAY_ROUTES.assessment.sessions, { contentVersionId: 25001, mode, clientSessionRef: stableKey, ...(targetCount > 0 ? { itemIds: undefined } : {}) }, withB10Headers(stableKey))
  const session = parseSession(response)
  if (!session) throw new Error('练习服务返回了无法识别的会话。')
  return session
}

export async function getPracticeSession(sessionId: string): Promise<B10PracticeSession> {
  const session = parseSession(await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.assessment.sessions}/${encodeURIComponent(sessionId)}`, withB10Headers()))
  if (!session) throw new Error('练习会话数据暂时无法读取。')
  return session
}

export async function submitPracticeAnswer(sessionId: string, payload: { exerciseId: string; answer: unknown; clientAnswerId: string; contentVersionId: number | null; stateVersion: number }, stableKey: string): Promise<B10Feedback> {
  const itemId = Number(payload.exerciseId)
  if (!Number.isSafeInteger(itemId) || itemId <= 0) throw new Error('练习题缺少合法的服务端 itemId。')
  const response = await apiClient.post<unknown>(`${B10_GATEWAY_ROUTES.assessment.sessions}/${encodeURIComponent(sessionId)}/attempts`, {
    expectedStateVersion: payload.stateVersion,
    submissionId: `sub_${payload.clientAnswerId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 112)}`,
    items: [{ itemId, sequence: 0, response: isRecord(payload.answer) ? payload.answer : { text: String(payload.answer ?? '') }, clientSubmissionId: payload.clientAnswerId }],
    clientEventId: payload.clientAnswerId,
  }, withB10Headers(stableKey))
  const source = recordValue(unwrap(response))
  const scoreBucket = stringValue(source.scoreBucket)?.toUpperCase()
  return {
    ...parseFeedback({ ...source, correct: scoreBucket === 'FULL' ? true : scoreBucket === 'ZERO' ? false : null, message: scoreBucket ? `服务端已完成判分：${scoreBucket}` : '服务端已接收本次作答。' }),
    attemptId: stringValue(source.attemptId),
    reportId: stringValue(source.reportId),
  }
}

export async function savePracticeCheckpoint(sessionId: string, attemptId: string, payload: { checkpointSeq: number; currentIndex: number; elapsedTimeMs: number; answerRevision: number }, stableKey: string): Promise<void> {
  const digest = await checkpointDigest({ sessionId, attemptId, ...payload })
  await apiClient.put(`${B10_GATEWAY_ROUTES.assessment.sessions}/${encodeURIComponent(sessionId)}/attempts/${encodeURIComponent(attemptId)}/checkpoint`, { checkpointVersion: Math.max(1, payload.checkpointSeq), itemCursor: Math.max(0, payload.currentIndex), completedItemIds: [], checkpointDigest: digest }, withB10Headers(stableKey))
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

export async function getLearningReport(reportType: 'DAILY' | 'WEEKLY' = 'DAILY', date = new Date().toISOString().slice(0, 10)): Promise<B10Report> {
  const path = reportType === 'DAILY' ? B10_GATEWAY_ROUTES.learning.reportDaily : B10_GATEWAY_ROUTES.learning.reportWeekly
  const response = await apiClient.get<unknown>(`${path}${query(reportType === 'DAILY' ? { date } : { weekStart: date })}`, withB10Headers())
  const report = parseReport(response, reportType)
  if (!report) throw new Error('报告服务暂未返回可展示的报告快照。')
  return report
}

export async function listReadingArticles(): Promise<B10ReadingArticle[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.readingArticles}${query({ limit: 20 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const article = parseReadingArticle(item); return article ? [article] : [] })
}

export async function getReadingArticle(articleId: number): Promise<B10ReadingArticle> {
  // Detail responses use the same Gateway `{ source, data }` envelope as the
  // list projection.  The list path unwraps through listFrom(), so the detail
  // path must do the same before applying the published-article parser.
  const article = parseReadingArticle(unwrap(await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.readingArticles}/${articleId}`, withB10Headers())))
  if (!article) throw new Error('阅读内容数据暂时无法读取。')
  return article
}

export async function getReadingDictionary(articleId: number, tokenId: string, snapshotVersionId: number): Promise<B10DictionaryEntry> {
  const source = recordValue(unwrap(await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.readingArticles}/${articleId}/dictionary${query({ tokenId })}`, withB10Headers(undefined, { headers: { 'X-Snapshot-Id': String(snapshotVersionId) } }))))
  assertPublished(source)
  const tokenIdValue = stringValue(source.tokenId) ?? tokenId
  const lemma = stringValue(source.lemma)
  const meaningCn = stringValue(source.meaningCn)
  if (!lemma || !meaningCn) throw new Error('词典服务暂未返回可展示的释义。')
  return { tokenId: tokenIdValue, lemma, partOfSpeech: stringValue(source.partOfSpeech), meaningCn, exampleText: stringValue(source.exampleText), contentVersionId: contentVersionId(source) }
}

export async function listReadingQuestions(articleId: number): Promise<B10ReadingQuestion[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.readingQuestions}${query({ limit: 20, articleId })}`, withB10Headers())
  return listFrom(response).flatMap((entry) => {
    const source = recordValue(entry)
    const questionId = numberValue(source.questionId) ?? numberValue(source.id)
    const version = contentVersionId(source)
    const stemText = stringValue(source.stemText) ?? stringValue(source.prompt)
    if (questionId === null || version === null || !stemText) return []
    const questionType = stringValue(source.questionType)?.toUpperCase()
    const options = arrayValue(source.options).flatMap((item) => { const option = recordValue(item); const optionCode = stringValue(option.optionCode) ?? stringValue(option.key); const label = stringValue(option.label) ?? stringValue(option.text); return optionCode && label ? [{ key: optionCode, text: label }] : [] })
    return [{ questionId, articleId: numberValue(source.articleId) ?? articleId, questionType: ['DETAIL', 'INFERENCE', 'VOCABULARY'].includes(questionType ?? '') ? questionType as B10ReadingQuestion['questionType'] : 'MAIN_IDEA', stemText, options, contentVersionId: version }]
  })
}

export async function submitReadingQuiz(questionId: number, answer: string, contentVersionId: number, stableKey: string): Promise<B10ReadingAttemptResult> {
  const source = recordValue(unwrap(await apiClient.post<unknown>(B10_GATEWAY_ROUTES.assessment.readingAttempts, { questionId, answer, contentVersionId, clientEventId: stableKey }, withB10Headers(stableKey))))
  return { ...parseFeedback(source), attemptId: numberValue(source.attemptId) ?? 0, questionId, score: numberValue(source.score), reviewSignal: stringValue(source.reviewSignal) }
}

export async function saveReadingProgress(payload: { articleId: number; blockId: string; progressPercent: number; positionVersion: number; contentVersionId: number }, stableKey: string): Promise<void> {
  await apiClient.put(B10_GATEWAY_ROUTES.learning.readingProgress, { ...payload, clientEventId: stableKey }, withB10Headers(stableKey))
}

export async function createReadingMining(articleId: number, blockId: string, selectedText: string, contentVersionId: number, stableKey: string): Promise<void> {
  await apiClient.post(B10_GATEWAY_ROUTES.learning.readingMining, { articleId, blockId, selectedText, contentVersionId, clientEventId: stableKey }, withB10Headers(stableKey))
}

export async function listGrammarPoints(): Promise<B10GrammarPoint[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.grammarPoints}${query({ limit: 50 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const point = parseGrammarPoint(item); return point ? [point] : [] })
}

export async function listGrammarExercises(grammarPointId?: number): Promise<B10GrammarExercise[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.grammarExercises}${query({ limit: 20, grammarPointId })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const exercise = parseGrammarExercise(item); return exercise ? [exercise] : [] })
}

export async function listGrammarMastery(grammarPointId?: number): Promise<B10GrammarMastery[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.grammarMastery}${query({ grammarPointId })}`, withB10Headers())
  return listFrom(response, ['items', 'mastery']).flatMap((item) => { const mastery = parseGrammarMastery(item); return mastery ? [mastery] : [] })
}

export async function getSentenceGraph(sentenceId: number): Promise<B10SentenceGraph> {
  const graph = parseSentenceGraph(await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.grammarSentences}/${sentenceId}`, withB10Headers()))
  if (!graph) throw new Error('句法结构暂时无法读取。')
  return graph
}

export async function submitGrammarAttempt(exerciseId: number, answer: unknown, contentVersionId: number, stableKey: string): Promise<B10Feedback> {
  return parseFeedback(await apiClient.post<unknown>(B10_GATEWAY_ROUTES.assessment.grammarAttempts, { exerciseId, answer, contentVersionId, clientAnswerId: stableKey }, withB10Headers(stableKey)))
}

export async function submitSentenceBlocks(sentenceId: number, blockOrder: string[], contentVersionId: number, stableKey: string): Promise<B10Feedback> {
  return parseFeedback(await apiClient.post<unknown>(`${B10_GATEWAY_ROUTES.learning.grammarBlocks}/${sentenceId}/blocks`, { blockOrder, contentVersionId, clientEventId: stableKey }, withB10Headers(stableKey)))
}

export async function submitSentenceImitation(sentenceId: number, slotValues: Record<string, string>, contentVersionId: number, stableKey: string): Promise<B10Feedback> {
  return parseFeedback(await apiClient.post<unknown>(`${B10_GATEWAY_ROUTES.learning.grammarImitation}/${sentenceId}/imitation`, { slotValues, contentVersionId, clientEventId: stableKey }, withB10Headers(stableKey)))
}

export async function listWritingPrompts(): Promise<B10WritingPrompt[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.writingPrompts}${query({ limit: 20 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const prompt = parseWritingPrompt(item); return prompt ? [prompt] : [] })
}

export async function listWritingTemplates(): Promise<B10WritingTemplate[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.writingTemplates}${query({ limit: 20 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const template = parseWritingTemplate(item); return template ? [template] : [] })
}

export async function listWritingMaterials(): Promise<B10WritingMaterial[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.writingMaterials}${query({ limit: 20 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const material = parseWritingMaterial(item); return material ? [material] : [] })
}

export async function listProofreadingExercises(): Promise<B10ProofreadingIssue[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.content.proofreadingExercises}${query({ limit: 20 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const issue = parseProofreadingIssue(item); return issue ? [issue] : [] })
}

export async function listWritingHistory(): Promise<B10WritingHistoryItem[]> {
  const response = await apiClient.get<unknown>(`${B10_GATEWAY_ROUTES.learning.writingHistory}${query({ limit: 20 })}`, withB10Headers())
  return listFrom(response).flatMap((item) => { const history = parseWritingHistory(item); return history ? [history] : [] })
}

export async function submitWriting(promptId: number, answer: string, contentVersionId: number, stableKey: string): Promise<B10WritingFeedback> {
  const result = parseWritingFeedback(await apiClient.post<unknown>(B10_GATEWAY_ROUTES.assessment.writingSubmissions, { promptId, answer, contentVersionId, mode: 'RULED_TRANSLATION', clientSubmissionId: stableKey }, withB10Headers(stableKey)))
  if (!result) throw new Error('写作服务暂未返回规则反馈。')
  return result
}

export async function submitProofreading(promptId: number, answer: string, contentVersionId: number, stableKey: string): Promise<B10Feedback> {
  return parseFeedback(await apiClient.post<unknown>(B10_GATEWAY_ROUTES.assessment.proofreading, { promptId, answer, contentVersionId, clientSubmissionId: stableKey }, withB10Headers(stableKey)))
}
