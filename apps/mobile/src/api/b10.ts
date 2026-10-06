import { unavailableOperation } from './unavailable'
import { mobileApiClient, MobileApiError } from './client'
import { listGrammarExercises as listB3GrammarExercises, submitGrammarAttempt as submitB3GrammarAttempt } from './b3'
import { createClientId } from '../platform/client-id'
import type {
  B10AnswerInput,
  B10AnswerResult,
  B10AssessmentSession,
  B10ContentVersionContext,
  B10Exercise,
  B10GrammarPoint,
  B10Mistake,
  B10ReadingArticle,
  B10ReadingAttempt,
  B10ReadingQuestion,
  B10Report,
  B10RequestContext,
  B10RuleFeedback,
  B10SrsBatch,
  B10SrsCard,
  B10SyntaxGraph,
  B10Verification,
  B10WritingPrompt,
} from '../domain/b10'

type RecordValue = Record<string, unknown>

/**
 * These are Gateway routes, not service URLs. Gateway owns the public prefix;
 * the mobile app never selects a learner/content/assessment service directly.
 */
export const B10_GATEWAY_PATHS = {
  content: {
    catalog: '/content/learner/catalog',
    projection: '/content/learner',
    vocabularyDetail: '/content/learner/vocabulary',
    grammarPoints: '/grammar/points',
    readingArticles: '/reading/articles',
    readingQuestions: '/reading/questions',
    writingPrompts: '/writing/prompts',
  },
  learning: {
    srsBatch: '/learning/srs/batches',
    srsReview: '/learning/srs/reviews',
    srsSync: '/learning/srs/reviews:sync',
  },
  assessment: {
    dailyStream: '/assessment/daily-stream',
    sessions: '/assessment/sessions',
    masteryMistakes: '/mastery/mistakes',
    masteryVerifications: '/mastery/verifications',
    dailyReport: '/learning/stats/daily-report',
    weeklyReport: '/learning/stats/weekly-report',
  },
} as const

export interface B10ErrorInfo {
  status: number
  message: string
  retryable: boolean
  kind: 'offline' | 'forbidden' | 'stale' | 'error'
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback = 0): number {
  const candidate = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function nullableNumber(value: unknown): number | null {
  const candidate = number(value, NaN)
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function query(path: string, values: Record<string, string | number | boolean | undefined>): string {
  const params = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return params.length ? `${path}${path.includes('?') ? '&' : '?'}${params.join('&')}` : path
}

function idempotencyKey(clientEventId: string): string {
  return `b10-${clientEventId}`.slice(0, 120)
}

function headers(context: B10RequestContext, clientEventId?: string): Record<string, string> {
  return {
    'Accept-Language': context.uiLocale,
    ...(clientEventId ? { 'Idempotency-Key': idempotencyKey(clientEventId) } : {}),
  }
}

function contentContext(context: B10RequestContext, extra: Record<string, string | number | boolean | undefined> = {}): string {
  return query('', { contentLocale: context.contentLocale, ...extra }).replace(/^\?/, '')
}

function listFrom(value: unknown): unknown[] {
  const source = unwrap(value)
  if (Array.isArray(source)) return source
  if (!isRecord(source)) return []
  if (Array.isArray(source.items)) return source.items
  if (Array.isArray(source.cards)) return source.cards
  if (Array.isArray(source.exercises)) return source.exercises
  if (Array.isArray(source.mistakes)) return source.mistakes
  if (Array.isArray(source.questions)) return source.questions
  return []
}

function mapError(error: unknown, fallback: string): B10ErrorInfo {
  const apiError = error instanceof MobileApiError ? error : null
  const status = apiError?.status ?? 0
  const details = apiError?.details
  const detailRecord = isRecord(details) ? details : {}
  const nestedError = isRecord(detailRecord.error) ? detailRecord.error : {}
  const message = text(nestedError.message ?? detailRecord.message, error instanceof Error ? error.message : fallback) || fallback
  if (status === 401) return { status, message: '请先登录后再继续学习。', retryable: false, kind: 'forbidden' }
  if (status === 403) return { status, message, retryable: false, kind: 'forbidden' }
  if (status === 404 || status === 410) return { status, message: status === 410 ? '内容版本已失效，请重新读取当前版本。' : message, retryable: false, kind: 'stale' }
  if (status === 0 || status >= 500) return { status, message, retryable: true, kind: 'offline' }
  return { status, message, retryable: false, kind: 'error' }
}

function parseSrsCard(value: unknown, position: number, snapshotId: number | null): B10SrsCard | null {
  if (!isRecord(value)) return null
  const item = isRecord(value.item) ? value.item : value
  const itemType = item.itemType === 'PHRASE' || item.itemType === 'EXPRESSION' ? item.itemType : 'VOCAB'
  const numericItemId = nullableNumber(item.vocabId ?? item.phraseId ?? item.expressionId ?? item.chunkId)
  const stringItemId = text(item.itemId ?? item.vocabularyId ?? item.vocabCode) || null
  const itemId = numericItemId ?? stringItemId
  if (itemId === null) return null
  const srs = isRecord(value.srsState) ? value.srsState : isRecord(value.srs) ? value.srs : {}
  const title = text(value.title ?? value.word ?? value.canonicalText ?? value.sentenceText ?? item.word ?? item.canonicalText, `学习项 ${itemId}`)
  const contentVersion = text(value.contentVersion ?? value.contentVersionId ?? item.contentVersion) || null
  return {
    id: `${snapshotId ?? 'pending'}-${number(value.snapshotItemId, position + 1)}`,
    snapshotId,
    snapshotItemId: number(value.snapshotItemId, position + 1),
    sequenceNo: number(value.sequenceNo, position + 1),
    itemType,
    itemId,
    title,
    sourceReason: text(value.sourceReason, 'REVIEW'),
    contentVersion,
    contentVersionId: nullableNumber(value.contentVersionId),
    phonetic: text(value.phoneticUs ?? value.phoneticUk) || null,
    hint: text(value.frontHint ?? value.prompt) || null,
    meaningCn: null,
    definitionEn: null,
    examples: [],
    masteryStatus: ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED'].includes(text(srs.masteryStatus)) ? text(srs.masteryStatus) as B10SrsCard['masteryStatus'] : null,
    dueLocalDate: text(srs.dueLocalDate ?? srs.nextReviewLocalDate) || null,
    stateVersion: number(srs.stateVersion, 0),
    revealed: false,
    reviewStatus: 'PENDING',
  }
}

function parseSrsBatch(value: unknown): B10SrsBatch {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const snapshotId = nullableNumber(source.snapshotId)
  return {
    snapshotId,
    localDate: text(source.localDate, new Date().toISOString().slice(0, 10)),
    timezone: text(source.timezone, 'Asia/Shanghai'),
    status: text(source.status, 'READY'),
    algorithmVersion: text(source.algorithmVersion) || null,
    rulesVersion: text(source.rulesVersion) || null,
    contentEpoch: number(source.contentEpoch, 0),
    items: listFrom(source).flatMap((item, index) => {
      const card = parseSrsCard(item, index, snapshotId)
      return card ? [card] : []
    }),
  }
}

function parseExercise(value: unknown, sessionId: string): B10Exercise | null {
  if (!isRecord(value)) return null
  const exerciseId = nullableNumber(value.exerciseId ?? value.itemId)
  const questionId = nullableNumber(value.questionId) ?? exerciseId
  if (!exerciseId || !questionId) return null
  const promptValue = isRecord(value.prompt) ? value.prompt : {}
  const interaction = isRecord(value.interaction) ? value.interaction : {}
  const rawType = text(value.questionType ?? value.type, 'CHOICE')
  const questionTypes = ['CHOICE', 'CONNECT_LINE', 'DRAG_SORTER', 'FILL_BLANK', 'SPELL_INPUT', 'LISTEN_CHOICE', 'ERROR_CORRECTION', 'TRANSLATION_INPUT']
  const questionType = questionTypes.includes(rawType) ? rawType as B10Exercise['questionType'] : 'CHOICE'
  const optionsValue = Array.isArray(interaction.options) ? interaction.options : Array.isArray(value.options) ? value.options : []
  const tokensValue = Array.isArray(interaction.tokens) ? interaction.tokens : Array.isArray(value.tokens) ? value.tokens : []
  return {
    sessionId,
    exerciseId,
    questionId,
    itemId: nullableNumber(value.itemId),
    questionType,
    position: number(value.position, 0),
    prompt: text(promptValue.text ?? promptValue.stemText ?? value.promptText ?? value.stemText ?? value.stem, '请完成本题。'),
    sourceText: text(promptValue.sourceText ?? value.sourceText) || null,
    options: optionsValue.flatMap((entry): Array<{ key: string; text: string }> => {
      if (!isRecord(entry)) return []
      const key = text(entry.optionCode ?? entry.key ?? entry.optionId)
      const label = text(entry.label ?? entry.text)
      return key && label ? [{ key, text: label }] : []
    }),
    tokens: tokensValue.flatMap((entry): Array<{ tokenId: string; text: string }> => {
      if (!isRecord(entry)) return []
      const tokenId = text(entry.tokenId ?? entry.id)
      const label = text(entry.text ?? entry.label)
      return tokenId && label ? [{ tokenId, text: label }] : []
    }),
    blankIds: Array.isArray(interaction.blankIds) ? interaction.blankIds.filter((entry): entry is string => typeof entry === 'string') : [],
    sourceBucket: ['NEW', 'REVIEW', 'MISTAKE', 'EXAM'].includes(text(value.sourceBucket)) ? text(value.sourceBucket) as B10Exercise['sourceBucket'] : null,
    verificationStage: ['D0', 'D1', 'D7'].includes(text(value.verificationStage)) ? text(value.verificationStage) as B10Exercise['verificationStage'] : null,
    feedbackPolicy: ['IMMEDIATE', 'AFTER_SUBMIT', 'PENDING_MANUAL'].includes(text(value.feedbackPolicy)) ? text(value.feedbackPolicy) as B10Exercise['feedbackPolicy'] : 'AFTER_SUBMIT',
    contentVersionId: nullableNumber(value.contentVersionId ?? (isRecord(value.pin) ? value.pin.contentVersionId : null)),
    ruleVersion: text(value.ruleVersion) || null,
  }
}

function parseAssessmentSession(value: unknown): B10AssessmentSession {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const sessionId = text(source.sessionId ?? source.id, 'unknown-session')
  const exercises = listFrom(source.items ?? source).flatMap((item) => {
    const exercise = parseExercise(item, sessionId)
    return exercise ? [exercise] : []
  })
  const answerSheet = Array.isArray(source.answerSheet) ? source.answerSheet.flatMap((item): Array<{ exerciseId: number; saved: boolean; revision: number }> => {
    if (!isRecord(item)) return []
    const exerciseId = nullableNumber(item.exerciseId)
    return exerciseId ? [{ exerciseId, saved: item.saved === true, revision: number(item.revision, 0) }] : []
  }) : []
  const pin = isRecord(source.pin) ? source.pin : {}
  return {
    sessionId,
    sessionType: text(source.sessionType ?? source.mode, 'DAILY_STREAM'),
    status: text(source.status, 'IN_PROGRESS'),
    serverNow: text(source.serverNow) || null,
    deadlineAt: text(source.deadlineAt) || null,
    remainingSec: nullableNumber(source.remainingSec),
    lastCheckpointSeq: number(source.lastCheckpointSeq, 0),
    exercises: exercises.sort((left, right) => left.position - right.position),
    answerSheet,
    contentEpoch: number(source.contentEpoch ?? pin.contentEpoch, 0),
    degraded: source.degraded === true,
    stateVersion: number(source.stateVersion, 1),
    lastAttemptId: text(source.lastAttemptId) || null,
    reportId: text(source.reportId) || null,
  }
}

function parseAnswerResult(value: unknown, exerciseId: number): B10AnswerResult {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  return {
    requestId: text(source.requestId ?? source.attemptId) || null,
    exerciseId: number(source.exerciseId, exerciseId),
    accepted: source.accepted !== false && !['REJECTED', 'COMPENSATED'].includes(text(source.status)),
    revision: nullableNumber(source.revision ?? source.attemptVersion),
    scoringStatus: ['SCORED', 'PENDING_MANUAL', 'REJECTED', 'LATE', 'ACCEPTED'].includes(text(source.scoringStatus)) ? text(source.scoringStatus) as B10AnswerResult['scoringStatus'] : 'ACCEPTED',
    isCorrect: booleanOrNull(source.isCorrect) ?? (text(source.scoreBucket) === 'FULL' ? true : text(source.scoreBucket) === 'ZERO' ? false : null),
    score: typeof source.score === 'number' ? source.score : null,
    maxScore: typeof source.maxScore === 'number' ? source.maxScore : null,
    errorCauseCandidates: Array.isArray(source.errorCauseCandidates) ? source.errorCauseCandidates.filter((entry): entry is string => typeof entry === 'string') : [],
    masteryEffect: text(source.masteryEffect) || null,
    deduplicated: source.deduplicated === true,
    contentVersionStale: source.contentVersionStale === true || source.status === 'CONTENT_VERSION_STALE',
    attemptId: text(source.attemptId) || null,
    reportId: text(source.reportId) || null,
  }
}

function parseRuleFeedback(value: unknown): B10RuleFeedback {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const rawCauses = Array.isArray(source.errorCauses) ? source.errorCauses : Array.isArray(source.errorCauseCandidates) ? source.errorCauseCandidates : []
  const evidence = Array.isArray(source.evidence) ? source.evidence.flatMap((item): Array<{ label: string; sourceText?: string; explanation: string }> => {
    if (!isRecord(item)) return []
    const label = text(item.label ?? item.code)
    const explanation = text(item.explanation ?? item.detail)
    return label && explanation ? [{ label, explanation, ...(text(item.sourceText) ? { sourceText: text(item.sourceText) } : {}) }] : []
  }) : []
  return {
    accepted: source.accepted !== false,
    correct: booleanOrNull(source.correct ?? source.isCorrect),
    score: typeof source.score === 'number' ? source.score : null,
    ruleVersion: text(source.ruleVersion) || null,
    feedbackCode: text(source.feedbackCode) || null,
    errorCauses: rawCauses.filter((entry): entry is string => typeof entry === 'string'),
    evidence,
    nextAction: text(source.nextAction) || null,
    aiScoringAvailable: false,
    deduplicated: source.deduplicated === true,
    contentVersionStale: source.contentVersionStale === true || source.status === 'CONTENT_VERSION_STALE',
  }
}

function parseGrammarPoint(value: unknown): B10GrammarPoint | null {
  if (!isRecord(value)) return null
  const grammarPointId = nullableNumber(value.grammarPointId)
  if (!grammarPointId) return null
  return {
    grammarPointId,
    code: text(value.code, `GRAMMAR_${grammarPointId}`),
    title: text(value.title, '语法知识点'),
    ruleFormula: text(value.ruleFormula, '按服务端规则完成练习。'),
    meaningCn: text(value.meaningCn, '掌握规则与错误原因。'),
    cefrLevel: text(value.cefrLevel, 'B1'),
    trapTags: Array.isArray(value.trapTags) ? value.trapTags.filter((entry): entry is string => typeof entry === 'string') : [],
    prerequisites: Array.isArray(value.prerequisites) ? value.prerequisites.map((entry) => number(entry, 0)).filter((entry) => entry > 0) : [],
    sentenceId: nullableNumber(value.sentenceId ?? value.exampleSentenceId),
    masteryPercent: typeof value.masteryPercent === 'number' ? Math.round(value.masteryPercent * (value.masteryPercent <= 1 ? 100 : 1)) : null,
    contentVersionId: nullableNumber(value.contentVersionId),
  }
}

function parseSyntaxGraph(value: unknown): B10SyntaxGraph | null {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const sentenceId = nullableNumber(source.sentenceId)
  if (!sentenceId) return null
  const slices = Array.isArray(source.slices) ? source.slices.flatMap((item): Array<B10SyntaxGraph['slices'][number]> => {
    if (!isRecord(item)) return []
    const sliceId = text(item.sliceId ?? item.id)
    const sliceText = text(item.text)
    return sliceId && sliceText ? [{ sliceId, sliceCode: text(item.sliceCode, sliceId), role: text(item.role, '句法片段'), text: sliceText, startToken: number(item.startToken), endToken: number(item.endToken) }] : []
  }) : []
  const imitationSlots: Record<string, string> = {}
  if (isRecord(source.imitationSlots)) for (const [key, item] of Object.entries(source.imitationSlots)) if (typeof item === 'string') imitationSlots[key] = item
  return {
    sentenceId,
    text: text(source.text ?? source.sentenceText, '长难句内容暂不可用。'),
    translation: text(source.translation) || null,
    nodes: Array.isArray(source.nodes) ? source.nodes.flatMap((item): Array<{ nodeId: string; role: string; text: string }> => {
      if (!isRecord(item)) return []
      const nodeId = text(item.nodeId ?? item.id)
      const nodeText = text(item.text)
      return nodeId && nodeText ? [{ nodeId, role: text(item.role, '节点'), text: nodeText }] : []
    }) : [],
    edges: Array.isArray(source.edges) ? source.edges.flatMap((item): Array<{ fromNodeId: string; toNodeId: string; relation: string }> => {
      if (!isRecord(item)) return []
      const fromNodeId = text(item.fromNodeId)
      const toNodeId = text(item.toNodeId)
      return fromNodeId && toNodeId ? [{ fromNodeId, toNodeId, relation: text(item.relation, '依存') }] : []
    }) : [],
    slices,
    blockOrder: Array.isArray(source.blockOrder) ? source.blockOrder.filter((entry): entry is string => typeof entry === 'string') : slices.map((item) => item.sliceId),
    imitationSlots,
    contentVersionId: nullableNumber(source.contentVersionId),
    graphStatus: source.graphStatus === 'FAILED' ? 'FAILED' : source.graphStatus === 'DEGRADED' ? 'DEGRADED' : 'READY',
  }
}

function parseReadingArticle(value: unknown): B10ReadingArticle | null {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const articleId = nullableNumber(source.articleId)
  if (!articleId) return null
  const blocks = Array.isArray(source.blocks) ? source.blocks.flatMap((item, index): Array<B10ReadingArticle['blocks'][number]> => {
    if (!isRecord(item)) return []
    const textValue = text(item.text)
    return textValue ? [{ blockId: text(item.blockId, `block-${index + 1}`), blockIndex: number(item.blockIndex, index), text: textValue, translation: text(item.translation) || null }] : []
  }) : []
  return {
    articleId,
    title: text(source.title, '分级阅读'),
    cefrLevel: text(source.cefrLevel, 'B1'),
    wordCount: number(source.wordCount, 0),
    estimatedMinutes: number(source.estimatedMinutes, 5),
    blocks,
    rightsStatus: source.rightsStatus === 'REVOKED' ? 'REVOKED' : 'AUTHORIZED',
    contentVersionId: nullableNumber(source.contentVersionId),
    contentEpoch: number(source.contentEpoch, 0),
  }
}

function parseReadingQuestion(value: unknown): B10ReadingQuestion | null {
  if (!isRecord(value)) return null
  const questionId = nullableNumber(value.questionId)
  const articleId = nullableNumber(value.articleId)
  if (!questionId || !articleId) return null
  const rawType = text(value.questionType, 'DETAIL')
  const questionType = ['MAIN_IDEA', 'DETAIL', 'INFERENCE', 'VOCABULARY'].includes(rawType) ? rawType as B10ReadingQuestion['questionType'] : 'DETAIL'
  return {
    questionId,
    articleId,
    questionType,
    stemText: text(value.stemText, '请选择最符合文章信息的答案。'),
    options: Array.isArray(value.options) ? value.options.flatMap((item): Array<{ optionCode: string; label: string }> => {
      if (!isRecord(item)) return []
      const optionCode = text(item.optionCode ?? item.key)
      const label = text(item.label ?? item.text)
      return optionCode && label ? [{ optionCode, label }] : []
    }) : [],
    contentVersionId: nullableNumber(value.contentVersionId),
  }
}

function parseWritingPrompt(value: unknown): B10WritingPrompt | null {
  if (!isRecord(value)) return null
  const promptId = nullableNumber(value.promptId)
  if (!promptId) return null
  const promptType = ['TRANSLATION', 'CORRECTION', 'ESSAY', 'LETTER'].includes(text(value.promptType)) ? text(value.promptType) as B10WritingPrompt['promptType'] : 'TRANSLATION'
  return {
    promptId,
    promptType,
    title: text(value.title, '规则写作练习'),
    taskText: text(value.taskText, '请根据题目完成练习。'),
    sourceText: text(value.sourceText ?? value.taskText) || null,
    targetStructure: Array.isArray(value.targetStructure) ? value.targetStructure.filter((entry): entry is string => typeof entry === 'string') : [],
    contentVersionId: nullableNumber(value.contentVersionId),
    ruleVersion: text(value.ruleVersion) || null,
  }
}

function parseMistake(value: unknown): B10Mistake | null {
  if (!isRecord(value)) return null
  const mistakeId = nullableNumber(value.mistakeId)
  const itemId = nullableNumber(value.itemId)
  if (!mistakeId || !itemId) return null
  const rawStatus = text(value.mistakeStatus, 'PENDING_RETRY')
  const rawMastery = text(value.masteryStatus, 'NEW')
  return {
    mistakeId,
    itemId,
    questionId: nullableNumber(value.questionId),
    mistakeStatus: ['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'REOPENED'].includes(rawStatus) ? rawStatus as B10Mistake['mistakeStatus'] : 'PENDING_RETRY',
    masteryStatus: ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED'].includes(rawMastery) ? rawMastery as B10Mistake['masteryStatus'] : 'NEW',
    errorCategory: text(value.errorCategory, '需要复习'),
    reasonTrace: Array.isArray(value.reasonTrace) ? value.reasonTrace.flatMap((item): Array<{ code: string; label: string; evidence?: string }> => {
      if (!isRecord(item)) return []
      const code = text(item.code)
      const label = text(item.label ?? item.explanation)
      return code && label ? [{ code, label, ...(text(item.evidence) ? { evidence: text(item.evidence) } : {}) }] : []
    }) : [],
    prompt: text(value.prompt) || null,
    questionType: ['CHOICE', 'CONNECT_LINE', 'DRAG_SORTER', 'FILL_BLANK', 'SPELL_INPUT', 'LISTEN_CHOICE', 'ERROR_CORRECTION', 'TRANSLATION_INPUT'].includes(text(value.questionType)) ? text(value.questionType) as B10Mistake['questionType'] : null,
    contentVersionId: nullableNumber(value.contentVersionId),
    verificationId: nullableNumber(value.verificationId),
  }
}

function parseVerification(value: unknown): B10Verification | null {
  if (!isRecord(value)) return null
  const verificationId = nullableNumber(value.verificationId)
  const mistakeId = nullableNumber(value.mistakeId)
  if (!verificationId || !mistakeId) return null
  const stage = ['D0', 'D1', 'D7'].includes(text(value.stage)) ? text(value.stage) as B10Verification['stage'] : 'D0'
  const result = ['PENDING', 'PASSED', 'FAILED', 'NOT_DUE', 'EXPIRED'].includes(text(value.result)) ? text(value.result) as B10Verification['result'] : 'PENDING'
  return { verificationId, mistakeId, stage, result, dueAt: text(value.dueAt, new Date().toISOString()), score: typeof value.score === 'number' ? value.score : null, maxScore: typeof value.maxScore === 'number' ? value.maxScore : null, nextState: text(value.nextState) || null }
}

function parseReport(value: unknown, fallbackType: B10Report['reportType']): B10Report {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const reportType = ['EXAM_DIAGNOSTIC', 'DAILY', 'WEEKLY'].includes(text(source.reportType)) ? text(source.reportType) as B10Report['reportType'] : fallbackType
  const scoreBucket = text(source.scoreBucket)
  const canonicalMetrics = scoreBucket ? [{ code: 'scoreBucket', label: '评测结果', value: scoreBucket === 'FULL' ? 1 : scoreBucket === 'PARTIAL' ? 0.5 : 0, max: 1 }] : []
  const canonicalEvidence = Array.isArray(source.mistakeCodes) ? source.mistakeCodes.filter((entry): entry is string => typeof entry === 'string').map((entry) => ({ label: entry, detail: '服务端记录为待复习项。' })) : []
  return {
    reportId: text(source.reportId) || number(source.reportId, 0),
    reportType,
    status: ['GENERATING', 'READY', 'PARTIAL', 'FAILED'].includes(text(source.status)) ? text(source.status) as B10Report['status'] : 'PARTIAL',
    score: typeof source.score === 'number' ? source.score : null,
    reportedMaxScore: typeof source.reportedMaxScore === 'number' ? source.reportedMaxScore : null,
    percentile: typeof source.percentile === 'number' ? source.percentile : null,
    calculationVersion: text(source.calculationVersion, 'server-rule'),
    metrics: Array.isArray(source.metrics) ? source.metrics.flatMap((item): Array<{ code: string; label: string; value: number; max?: number }> => {
      if (!isRecord(item)) return []
      const code = text(item.code)
      return code ? [{ code, label: text(item.label, code), value: number(item.value), ...(typeof item.max === 'number' ? { max: item.max } : {}) }] : []
    }) : Object.keys(isRecord(source.metrics) ? source.metrics : {}).length ? Object.entries(isRecord(source.metrics) ? source.metrics : {}).map(([code, value]) => ({ code, label: code, value: number(value) })) : canonicalMetrics,
    evidence: Array.isArray(source.evidence) ? source.evidence.flatMap((item): Array<{ exerciseId?: number; mistakeId?: number; label: string; detail: string }> => {
      if (!isRecord(item)) return []
      const label = text(item.label ?? item.code)
      const detail = text(item.detail ?? item.explanation)
      return label && detail ? [{ label, detail, ...(nullableNumber(item.exerciseId) ? { exerciseId: nullableNumber(item.exerciseId) as number } : {}), ...(nullableNumber(item.mistakeId) ? { mistakeId: nullableNumber(item.mistakeId) as number } : {}) }] : []
    }) : canonicalEvidence,
    explanation: Array.isArray(source.explanation) ? source.explanation.filter((entry): entry is string => typeof entry === 'string') : Object.values(isRecord(source.explanation) ? source.explanation : {}).filter((entry): entry is string => typeof entry === 'string').concat(scoreBucket ? [`服务端报告：${scoreBucket}`] : []),
  }
}

function parseContentVersion(value: unknown): B10ContentVersionContext {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  return { contentVersionId: nullableNumber(source.contentVersionId), contentEpoch: number(source.contentEpoch, 0), projectionVersion: number(source.projectionVersion, 1), contentLocale: text(source.contentLocale, 'en-US') }
}

export function createB10ClientEventId(prefix: string): string {
  return createClientId(`b10-${prefix}`)
}

export function classifyB10Error(error: unknown, fallback = '服务暂时不可用，请稍后重试。'): B10ErrorInfo {
  return mapError(error, fallback)
}

export const b10LearningApi = {
  async createSrsBatch(context: B10RequestContext, clientEventId: string): Promise<B10SrsBatch> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.learning.srsBatch, { contentLocale: context.contentLocale }), {
      method: 'POST',
      data: { localDate: new Date().toISOString().slice(0, 10), timezone: 'Asia/Shanghai', dailyNewTarget: 20, maxDailyReview: 50, scheduleType: 'DAILY' },
      header: headers(context, clientEventId),
    })
    return parseSrsBatch(response)
  },

  async getSrsBatch(context: B10RequestContext, snapshotId: number): Promise<B10SrsBatch> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.learning.srsBatch}/${encodeURIComponent(String(snapshotId))}`, { contentLocale: context.contentLocale }))
    return parseSrsBatch(response)
  },

  async getVocabularyDetail(context: B10RequestContext, itemId: number | string, contentVersion?: string | null): Promise<Partial<B10SrsCard>> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.content.vocabularyDetail}/${encodeURIComponent(String(itemId))}`, { contentLocale: context.contentLocale, contentVersion: contentVersion ?? undefined }))
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return {
      meaningCn: text(source.meaningCn ?? source.definitions) || null,
      definitionEn: text(source.definitionEn ?? source.definition) || null,
      phonetic: text(source.phoneticUs ?? source.phoneticUk) || null,
      examples: Array.isArray(source.examples) ? source.examples.flatMap((entry): string[] => isRecord(entry) && text(entry.sentence) ? [text(entry.sentence)] : typeof entry === 'string' ? [entry] : []) : [],
      contentVersionId: nullableNumber(source.contentVersionId),
    }
  },

  async submitSrsReview(context: B10RequestContext, card: B10SrsCard, quality: 0 | 1 | 2 | 3, clientEventId: string): Promise<unknown> {
    const item = card.itemType === 'VOCAB' ? { itemType: 'VOCAB', vocabId: card.itemId } : card.itemType === 'PHRASE' ? { itemType: 'PHRASE', phraseId: card.itemId } : { itemType: 'EXPRESSION', expressionId: card.itemId }
    return mobileApiClient.request<unknown>(B10_GATEWAY_PATHS.learning.srsReview, {
      method: 'POST',
      data: { itemId: card.itemId, snapshotId: card.snapshotId, snapshotItemId: card.snapshotItemId, item, rawQuality: quality, answerOutcome: 'REVEALED_WITHOUT_ANSWER', responseTimeMs: 0, revealElapsedMs: 0, clientEventId, clientOccurredAt: new Date().toISOString(), baseStateVersion: card.stateVersion },
      header: { ...headers(context, clientEventId), 'X-Content-Version': card.contentVersion ?? '' },
    })
  },

  async syncSrsReviews(context: B10RequestContext, events: readonly Record<string, unknown>[], clientEventId: string): Promise<unknown> {
    return mobileApiClient.request<unknown>(B10_GATEWAY_PATHS.learning.srsSync, { method: 'POST', data: { events }, header: headers(context, clientEventId) })
  },

  async createAssessmentSession(context: B10RequestContext, input: { sessionType: 'DAILY_STREAM' | 'QUICK_PRACTICE' | 'CHECKPOINT'; targetCount?: number }, clientEventId: string): Promise<B10AssessmentSession> {
    const mode = input.sessionType === 'QUICK_PRACTICE' ? 'REVIEW' : input.sessionType === 'CHECKPOINT' ? 'MOCK' : 'PRACTICE'
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.sessions, { contentLocale: context.contentLocale }), { method: 'POST', data: { contentVersionId: 25001, mode, clientSessionRef: clientEventId }, header: headers(context, clientEventId) })
    return parseAssessmentSession(response)
  },

  async readAssessmentSession(context: B10RequestContext, sessionId: string): Promise<B10AssessmentSession> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(sessionId)}`, { contentLocale: context.contentLocale }))
    return parseAssessmentSession(response)
  },

  async submitAssessmentAnswer(context: B10RequestContext, sessionId: string, exerciseId: number, answer: B10AnswerInput, revision: number, checkpointSeq: number, clientEventId: string, expectedStateVersion = 1): Promise<B10AnswerResult> {
    const submissionId = `sub_${clientEventId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 112)}`
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(sessionId)}/attempts`, { method: 'POST', data: { expectedStateVersion, submissionId, items: [{ itemId: exerciseId, sequence: 0, response: answer, clientSubmissionId: clientEventId }], clientEventId }, header: headers(context, clientEventId) })
    return parseAnswerResult(response, exerciseId)
  },

  async saveAssessmentCheckpoint(context: B10RequestContext, sessionId: string, attemptId: string, checkpointSeq: number, currentExerciseId: number | null, clientStateHash: string, clientEventId: string): Promise<unknown> {
    return mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(sessionId)}/attempts/${encodeURIComponent(attemptId)}/checkpoint`, { method: 'PUT', data: { checkpointVersion: Math.max(1, checkpointSeq), itemCursor: Math.max(0, currentExerciseId ?? 0), completedItemIds: [], checkpointDigest: clientStateHash }, header: headers(context, clientEventId) })
  },

  async completeAssessmentSession(context: B10RequestContext, sessionId: string, clientEventId: string): Promise<B10Report> {
    const session = await this.readAssessmentSession(context, sessionId)
    if (!session.reportId) throw new Error('当前练习尚未生成服务端报告，请先提交至少一道题。')
    const response = await mobileApiClient.request<unknown>(`/assessment/reports/${encodeURIComponent(session.reportId)}`, { header: headers(context, clientEventId) })
    return parseReport(response, 'DAILY')
  },

  async listMistakes(context: B10RequestContext): Promise<B10Mistake[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.masteryMistakes, { contentLocale: context.contentLocale }))
    return listFrom(response).flatMap((item) => { const mistake = parseMistake(item); return mistake ? [mistake] : [] })
  },

  async startMistakeRetry(context: B10RequestContext, mistakeId: number, clientEventId: string): Promise<B10Verification> {
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.masteryMistakes}/${encodeURIComponent(String(mistakeId))}/retry`, { method: 'POST', header: headers(context, clientEventId) })
    const verification = parseVerification(response)
    if (!verification) throw new Error('错题服务没有返回可恢复的订正会话。')
    return verification
  },

  async listVerifications(context: B10RequestContext): Promise<B10Verification[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.masteryVerifications, { contentLocale: context.contentLocale }))
    return listFrom(response).flatMap((item) => { const verification = parseVerification(item); return verification ? [verification] : [] })
  },

  async submitVerification(context: B10RequestContext, verificationId: number, answer: B10AnswerInput, clientEventId: string): Promise<B10Verification> {
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.masteryVerifications}/${encodeURIComponent(String(verificationId))}/submit`, { method: 'POST', data: { ...answer, clientSubmissionId: clientEventId, revision: 1 }, header: headers(context, clientEventId) })
    const verification = parseVerification(response)
    if (!verification) throw new Error('验证服务没有返回状态。')
    return verification
  },

  async readReport(context: B10RequestContext, period: 'daily' | 'weekly'): Promise<B10Report> {
    const path = period === 'daily' ? B10_GATEWAY_PATHS.assessment.dailyReport : B10_GATEWAY_PATHS.assessment.weeklyReport
    return parseReport(await mobileApiClient.request<unknown>(query(path, { contentLocale: context.contentLocale })), period === 'daily' ? 'DAILY' : 'WEEKLY')
  },

  async listGrammarPoints(context: B10RequestContext): Promise<B10GrammarPoint[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.grammarPoints, { pageSize: 50 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const point = parseGrammarPoint(item); return point ? [point] : [] })
  },

  async getSentenceGraph(context: B10RequestContext, sentenceId: number): Promise<B10SyntaxGraph> {
    const graph = parseSyntaxGraph(await unavailableOperation<unknown>())
    if (!graph) throw new Error('句法服务没有返回可解析的结构图。')
    return graph
  },

  async createGrammarSession(context: B10RequestContext, grammarPointId: number, contentVersionId: number | null, clientEventId: string): Promise<B10AssessmentSession> {
    const rawExercises = await listB3GrammarExercises()
    const exercises = rawExercises.filter((item) => !isRecord(item) || item.grammarPointId === undefined || number(item.grammarPointId, grammarPointId) === grammarPointId)
    return parseAssessmentSession({
      sessionId: `grammar_${grammarPointId}_${clientEventId}`,
      mode: 'PRACTICE',
      status: 'IN_PROGRESS',
      contentEpoch: 1,
      stateVersion: 1,
      items: exercises.map((item) => isRecord(item) ? item : {}),
    })
  },

  async submitGrammarAnswer(context: B10RequestContext, sessionId: string, exerciseId: number, answer: B10AnswerInput, contentVersionId: number | null, clientEventId: string): Promise<B10RuleFeedback> {
    const response = await submitB3GrammarAttempt(exerciseId, answer as Record<string, unknown>)
    return parseRuleFeedback(response)
  },

  async listReadingArticles(context: B10RequestContext): Promise<B10ReadingArticle[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.readingArticles, { contentLocale: context.contentLocale, limit: 20 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const article = parseReadingArticle(item); return article ? [article] : [] })
  },

  async getReadingArticle(context: B10RequestContext, articleId: number): Promise<B10ReadingArticle> {
    const article = parseReadingArticle(await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.content.readingArticles}/${encodeURIComponent(String(articleId))}`, { contentLocale: context.contentLocale }), { header: headers(context) }))
    if (!article) throw new Error('阅读服务没有返回可用文章。')
    return article
  },

  async saveReadingProgress(context: B10RequestContext, article: B10ReadingArticle, blockId: string, progressPercent: number, positionVersion: number, clientEventId: string): Promise<void> {
    await unavailableOperation()
  },

  async listReadingQuestions(context: B10RequestContext, articleId: number): Promise<B10ReadingQuestion[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.readingQuestions, { contentLocale: context.contentLocale, articleId, limit: 20 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const question = parseReadingQuestion(item); return question ? [question] : [] })
  },

  async submitReadingAttempt(context: B10RequestContext, question: B10ReadingQuestion, answer: B10AnswerInput, clientEventId: string): Promise<B10ReadingAttempt> {
    const response = await unavailableOperation<unknown>()
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return { attemptId: nullableNumber(source.attemptId), questionId: question.questionId, correct: booleanOrNull(source.correct ?? source.isCorrect), score: typeof source.score === 'number' ? source.score : null, feedbackCode: text(source.feedbackCode) || null, reviewSignal: text(source.reviewSignal) || null, ruleVersion: text(source.ruleVersion) || null, contentVersionStale: source.contentVersionStale === true || source.status === 'CONTENT_VERSION_STALE' }
  },

  async mineReadingExpression(context: B10RequestContext, article: B10ReadingArticle, blockId: string, selectedText: string, clientEventId: string): Promise<unknown> {
    return unavailableOperation()
  },

  async listWritingPrompts(context: B10RequestContext, promptType?: B10WritingPrompt['promptType']): Promise<B10WritingPrompt[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.writingPrompts, { contentLocale: context.contentLocale, promptType, limit: 20 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const prompt = parseWritingPrompt(item); return prompt ? [prompt] : [] })
  },

  async submitWriting(context: B10RequestContext, prompt: B10WritingPrompt, answer: string, mode: 'TRANSLATION' | 'CORRECTION' | 'WRITING', clientEventId: string): Promise<B10RuleFeedback> {
    const response = await unavailableOperation<unknown>()
    return parseRuleFeedback(response)
  },

  async submitCorrection(context: B10RequestContext, prompt: B10WritingPrompt, answer: string, clientEventId: string): Promise<B10RuleFeedback> {
    const response = await unavailableOperation<unknown>()
    return parseRuleFeedback(response)
  },

  parseContentVersion,
}

export function b10ErrorInfo(error: unknown, fallback?: string): B10ErrorInfo {
  return mapError(error, fallback ?? '学习服务暂时不可用，请稍后重试。')
}
