import { mobileApiClient, MobileApiError } from './client'
import { createListeningSession as legacyCreateListeningSession, createRecording as legacyCreateRecording, getPhonetics as legacyGetPhonetics, getReadingArticle as legacyGetReadingArticle, listListeningMaterials as legacyListListeningMaterials, listReadingArticles as legacyListReadingArticles, listReadingQuestions as legacyListReadingQuestions, pushOfflineChanges as legacyPushOfflineChanges, saveReadingProgress as legacySaveReadingProgress, submitDictation as legacySubmitDictation, submitReadingAttempt as legacySubmitReadingAttempt, submitSelfRating as legacySubmitSelfRating, deleteRecording as legacyDeleteRecording } from './b3'
import type { B3SyncResult, DictationResult, ListeningMaterial, Phoneme, ReadingArticle, ReadingAttemptResult, ReadingQuestion, SpeakingRecording } from '../domain/b3'
import type { B11Conflict, B11MediaManifest, B11OfflineEvent, B11ReadingWorkspace, B11RecordingResult, B11ListeningWorkspace, B11SyncResponse } from '../domain/b11'
import { contentVersionOf } from '../domain/b11'

type RecordValue = Record<string, unknown>

export interface B11RequestContext { uiLocale: string; contentLocale: string }

export const B11_GATEWAY_PATHS = {
  media: { manifest: '/media/assets', access: '/media/assets', legacyPlayback: '/media/assets', progress: '/learning/media-progress' },
  listening: { materials: '/listening/materials', sessions: '/listening/sessions', dictation: '/listening/sessions' },
  reading: { articles: '/reading/articles', questions: '/reading/questions', progress: '/reading/progress', attempts: '/reading/attempts' },
  speaking: { phonetics: '/phonetics/catalog', recordings: '/speaking/recordings', shadowing: '/speaking/shadowing/completions' },
  offline: { sync: '/sync/changes', legacySync: '/offline/sync' },
} as const

function isRecord(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function unwrap(value: unknown): unknown { if (!isRecord(value)) return value; if ('data' in value) return value.data; if ('result' in value) return value.result; return value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function optionalText(value: unknown): string | undefined { return text(value) ?? undefined }
function number(value: unknown): number | null { const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null }
function list<T>(value: unknown): T[] { const source = unwrap(value); if (Array.isArray(source)) return source as T[]; if (isRecord(source) && Array.isArray(source.items)) return source.items as T[]; return [] }
function query(path: string, values: Record<string, string | number | undefined>): string { const entries = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`); return entries.length ? `${path}?${entries.join('&')}` : path }
function idempotencyKey(clientEventId: string): string { return `b11-${clientEventId}`.slice(0, 120) }
function headers(context: B11RequestContext, clientEventId?: string): Record<string, string> { return { 'Accept-Language': context.uiLocale, ...(clientEventId ? { 'Idempotency-Key': idempotencyKey(clientEventId) } : {}) } }
function isLegacyShape(error: unknown): boolean { return error instanceof MobileApiError && [404, 405, 501].includes(error.status) }
function serverError(error: unknown): boolean { return error instanceof MobileApiError && (error.status === 0 || error.status >= 500) }

function contentVersion(value: unknown, fallback: string | number): string | number { return contentVersionOf(value, fallback) }

function parseManifest(value: unknown, fallbackAssetId: string): B11MediaManifest | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const variants = Array.isArray(source.variants) ? source.variants.filter(isRecord).map((item) => ({ variant: text(item.variant ?? item.name) ?? 'default', mimeType: optionalText(item.mimeType), codec: optionalText(item.codec), bitrate: number(item.bitrate) ?? undefined, sizeBytes: number(item.sizeBytes) ?? undefined, checksum: optionalText(item.checksum ?? item.sha256), signedUrl: text(item.signedUrl ?? item.url), expiresAt: text(item.expiresAt) })) : text(source.signedUrl ?? source.url) ? [{ variant: text(source.variant) ?? 'default', signedUrl: text(source.signedUrl ?? source.url), expiresAt: text(source.expiresAt) }] : []
  const clips = Array.isArray(source.clips) ? source.clips.filter(isRecord).map((item, index) => ({ clipId: text(item.clipId ?? item.id) ?? `${fallbackAssetId}-clip-${index + 1}`, title: text(item.title ?? item.label) ?? `Clip ${index + 1}`, startMs: number(item.startMs) ?? 0, endMs: number(item.endMs) ?? 0, mediaAssetId: optionalText(item.mediaAssetId), signedUrl: text(item.signedUrl ?? item.url), expiresAt: text(item.expiresAt) })) : []
  const rights = text(source.rightsStatus) as B11MediaManifest['rightsStatus'] | null
  const availability = text(source.availability) as B11MediaManifest['availability'] | null
  return { assetId: text(source.assetId) ?? fallbackAssetId, contentVersion: contentVersion(source.contentVersion ?? source.contentVersionId, 'unknown'), rightsStatus: rights && ['AUTHORIZED', 'REVOKED', 'EXPIRED', 'PENDING'].includes(rights) ? rights : 'PENDING', availability: availability && ['READY', 'NOT_READY', 'FAILED'].includes(availability) ? availability : 'NOT_READY', checksum: text(source.checksum ?? source.sha256), sizeBytes: number(source.sizeBytes), durationMs: number(source.durationMs), expiresAt: text(source.expiresAt), revokedAt: text(source.revokedAt), variants, clips }
}

export async function loadB11ListeningMaterials(context: B11RequestContext): Promise<ListeningMaterial[]> {
  try {
    return list<ListeningMaterial>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.listening.materials, { limit: 20, contentLocale: context.contentLocale })))
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    return legacyListListeningMaterials()
  }
}

export async function startB11ListeningSession(materialId: number, context: B11RequestContext, clientEventId: string, version: string | number): Promise<string | null> {
  try {
    const source = unwrap(await mobileApiClient.request('/listening/sessions', { method: 'POST', data: { materialId, contentVersion: version, contentVersionId: version, mode: 'LISTEN', clientEventId }, header: headers(context, clientEventId) }))
    return isRecord(source) ? text(source.sessionId ?? source.id) : null
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    return legacyCreateListeningSession(materialId, clientEventId)
  }
}

export async function fetchB11MediaManifest(assetId: string, context: B11RequestContext, version?: string | number): Promise<B11MediaManifest | null> {
  const path = query(`${B11_GATEWAY_PATHS.media.manifest}/${encodeURIComponent(assetId)}/manifest`, { contentLocale: context.contentLocale, contentVersion: version })
  try { return parseManifest(await mobileApiClient.request(path), assetId) } catch (error) { if (error instanceof MobileApiError && error.status === 404) return null; throw error }
}

export async function authorizeB11Playback(assetId: string, variant: string, context: B11RequestContext, clientEventId: string, version: string | number): Promise<B11MediaManifest | null> {
  const request = { method: 'POST' as const, data: { renditionId: variant, contentVersionId: version }, header: headers(context, clientEventId) }
  const legacyRequest = { method: 'POST' as const, data: { assetId, variant, contentVersion: version, clientEventId }, header: headers(context, clientEventId) }
  let source: unknown
  try {
    source = await mobileApiClient.request(`${B11_GATEWAY_PATHS.media.access}/${encodeURIComponent(assetId)}/access`, request)
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    source = await mobileApiClient.request(`${B11_GATEWAY_PATHS.media.legacyPlayback}/${encodeURIComponent(assetId)}/playback`, legacyRequest)
  }
  return parseManifest(source, assetId)
}

export async function saveB11MediaProgress(input: { sessionId?: string | null; assetId: string; positionMs: number; durationMs: number; contentVersion: string | number; entityVersion: number; clientEventId: string }, context: B11RequestContext): Promise<void> {
  await mobileApiClient.request(B11_GATEWAY_PATHS.media.progress, { method: 'PUT', data: { ...input, clientEventId: input.clientEventId }, header: headers(context, input.clientEventId) })
}

export async function submitB11Dictation(sessionId: string, segmentId: string, answer: string, context: B11RequestContext, clientEventId: string, version: string | number): Promise<DictationResult> {
  try {
    return unwrap(await mobileApiClient.request(`/listening/sessions/${encodeURIComponent(sessionId)}/dictation`, { method: 'POST', data: { segmentId, mode: 'SENTENCE', answer, attemptNo: 1, clientEventId, contentVersion: version, contentVersionId: version }, header: headers(context, clientEventId) })) as DictationResult
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    return legacySubmitDictation(sessionId, segmentId, answer, clientEventId)
  }
}

export async function loadB11ReadingWorkspace(context: B11RequestContext): Promise<B11ReadingWorkspace | null> {
  let articles: ReadingArticle[]
  try { articles = list<ReadingArticle>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.reading.articles, { limit: 20, contentLocale: context.contentLocale }))) } catch (error) { if (!isLegacyShape(error)) throw error; articles = await legacyListReadingArticles() }
  const first = articles[0]
  if (!first) return null
  let article: ReadingArticle
  try { article = unwrap(await mobileApiClient.request(query(`${B11_GATEWAY_PATHS.reading.articles}/${first.articleId}`, { contentLocale: context.contentLocale, contentVersion: first.contentVersionId }))) as ReadingArticle } catch (error) { if (!isLegacyShape(error)) throw error; article = await legacyGetReadingArticle(first.articleId) }
  let questions: ReadingQuestion[]
  try { questions = list<ReadingQuestion>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.reading.questions, { limit: 20, articleId: article.articleId, contentLocale: context.contentLocale }))) } catch (error) { if (!isLegacyShape(error)) throw error; questions = await legacyListReadingQuestions(article.articleId) }
  return { article, questions, contentVersion: contentVersion(article.contentVersionId, 'unknown') }
}

export async function saveB11ReadingProgress(article: ReadingArticle, blockId: string, progressPercent: number, entityVersion: number, context: B11RequestContext, clientEventId: string): Promise<void> {
  try {
    await mobileApiClient.request(B11_GATEWAY_PATHS.reading.progress, { method: 'PUT', data: { articleId: article.articleId, blockId, progressPercent, positionVersion: entityVersion, contentVersion: contentVersion(article.contentVersionId, 'unknown'), clientEventId }, header: headers(context, clientEventId) })
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    await legacySaveReadingProgress(article.articleId, blockId, progressPercent, entityVersion, clientEventId)
  }
}

export async function submitB11ReadingQuestion(question: ReadingQuestion, answer: string, context: B11RequestContext, clientEventId: string): Promise<ReadingAttemptResult> {
  try {
    return unwrap(await mobileApiClient.request(B11_GATEWAY_PATHS.reading.attempts, { method: 'POST', data: { questionId: question.questionId, answer, contentVersion: contentVersion(question.contentVersionId, 'unknown'), contentVersionId: question.contentVersionId, clientEventId }, header: headers(context, clientEventId) })) as ReadingAttemptResult
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    return legacySubmitReadingAttempt(question.questionId, answer, clientEventId)
  }
}

export async function loadB11Phonetics(context: B11RequestContext): Promise<Phoneme[]> {
  try { return list<Phoneme>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.speaking.phonetics, { setCode: 'EN_48_PHASE1', contentLocale: context.contentLocale }))) } catch (error) { if (!isLegacyShape(error)) throw error; return legacyGetPhonetics() }
}

export async function registerB11Recording(input: { sourceSegmentId: string; durationMs: number; contentHash: string; storageMode: 'LOCAL_ENCRYPTED' | 'LOCAL_TEMP'; contentVersion: string | number; clientEventId: string }, context: B11RequestContext): Promise<B11RecordingResult> {
  try {
    const source = unwrap(await mobileApiClient.request(B11_GATEWAY_PATHS.speaking.recordings, { method: 'POST', data: { sourceSegmentId: input.sourceSegmentId, durationMs: input.durationMs, contentHash: input.contentHash, storageMode: input.storageMode, contentVersion: input.contentVersion, contentVersionId: input.contentVersion, clientEventId: input.clientEventId, aiScoringAvailable: false }, header: headers(context, input.clientEventId) }))
    return { recording: source as SpeakingRecording, aiScoringAvailable: false, localCopyRetained: true }
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    return { recording: await legacyCreateRecording(input.sourceSegmentId, input.durationMs, input.contentHash, input.clientEventId), aiScoringAvailable: false, localCopyRetained: true }
  }
}

export async function deleteB11Recording(recordingId: string, context: B11RequestContext, clientEventId: string): Promise<void> {
  try { await mobileApiClient.request(`${B11_GATEWAY_PATHS.speaking.recordings}/${encodeURIComponent(recordingId)}`, { method: 'DELETE', header: headers(context, clientEventId) }) } catch (error) { if (!isLegacyShape(error)) throw error; await legacyDeleteRecording(recordingId, clientEventId) }
}

export async function submitB11SelfRating(recordingId: string, rating: string, context: B11RequestContext, clientEventId: string, version: string | number): Promise<void> {
  try { await mobileApiClient.request(`${B11_GATEWAY_PATHS.speaking.recordings}/${encodeURIComponent(recordingId)}/self-rating`, { method: 'POST', data: { recordingId, rating, contentVersion: version, clientEventId, aiScoringAvailable: false }, header: headers(context, clientEventId) }) } catch (error) { if (!isLegacyShape(error)) throw error; await legacySubmitSelfRating(recordingId, rating, clientEventId) }
}

export async function completeB11Shadowing(input: { recordingId: string; sourceSegmentId: string; contentVersion: string | number; clientEventId: string }, context: B11RequestContext): Promise<RecordValue> {
  const source = unwrap(await mobileApiClient.request(B11_GATEWAY_PATHS.speaking.shadowing, { method: 'POST', data: { ...input, clientEventId: input.clientEventId, aiScoringAvailable: false }, header: headers(context, input.clientEventId) }))
  return isRecord(source) ? source : {}
}

function legacyChanges(events: B11OfflineEvent[]): Array<{ changeId: string; entityType: 'READING_PROGRESS' | 'MEDIA_PROGRESS' | 'RECORDING' | 'SETTINGS'; entityId: string; entityVersion: number; operation: 'UPSERT' | 'DELETE'; payloadHash: string; occurredAt: string; clientEventId: string }> {
  return events.filter((event) => ['READING_PROGRESS', 'MEDIA_PROGRESS', 'RECORDING'].includes(event.entityType)).map((event) => ({ changeId: event.clientEventId, entityType: event.entityType as 'READING_PROGRESS' | 'MEDIA_PROGRESS' | 'RECORDING', entityId: event.entityId, entityVersion: event.entityVersion, operation: event.operation, payloadHash: event.payloadHash, occurredAt: event.occurredAt, clientEventId: event.clientEventId }))
}

function parseSync(value: unknown, clientBatchId: string, fallbackIds: string[]): B11SyncResponse {
  const source = unwrap(value)
  if (!isRecord(source)) return { clientBatchId, acceptedEventIds: [], nextCursor: '', conflicts: [] }
  const conflicts: B11Conflict[] = Array.isArray(source.conflicts) ? source.conflicts.filter(isRecord).map((item, index) => ({ conflictId: text(item.conflictId ?? item.id) ?? `${clientBatchId}-conflict-${index}`, clientEventId: text(item.clientEventId) ?? '', entityId: text(item.entityId) ?? '', localVersion: number(item.localVersion) ?? 0, serverVersion: number(item.serverVersion) ?? 0, resolution: text(item.resolution) as B11Conflict['resolution'] ?? 'REVIEW_REQUIRED', reason: text(item.reason) ?? '服务端版本冲突，未静默覆盖。', occurredAt: text(item.occurredAt) ?? new Date().toISOString() })) : []
  const accepted = Array.isArray(source.acceptedEventIds) ? source.acceptedEventIds.filter((item): item is string => typeof item === 'string') : source.accepted === true ? fallbackIds : []
  return { clientBatchId: text(source.clientBatchId) ?? clientBatchId, acceptedEventIds: accepted, nextCursor: text(source.nextCursor ?? source.cursor) ?? '', conflicts }
}

export async function syncB11Offline(events: B11OfflineEvent[], cursor: string, context: B11RequestContext, clientBatchId: string): Promise<B11SyncResponse> {
  try {
    return parseSync(await mobileApiClient.request(B11_GATEWAY_PATHS.offline.sync, { method: 'POST', data: { clientBatchId, baseCursor: cursor, changes: events, contentLocale: context.contentLocale }, header: headers(context, clientBatchId) }), clientBatchId, events.map((item) => item.clientEventId))
  } catch (error) {
    if (!isLegacyShape(error)) throw error
    let response: unknown
    try {
      response = await mobileApiClient.request(B11_GATEWAY_PATHS.offline.legacySync, { method: 'POST', data: { clientBatchId, baseCursor: cursor, changes: events, contentLocale: context.contentLocale }, header: headers(context, clientBatchId) })
    } catch (legacyError) {
      if (!isLegacyShape(legacyError)) throw legacyError
      const legacy = await legacyPushOfflineChanges(legacyChanges(events), cursor) as B3SyncResult
      return { clientBatchId, acceptedEventIds: legacy.acceptedChangeIds, nextCursor: legacy.nextCursor, conflicts: legacy.conflicts.map((item) => ({ conflictId: String(item.conflictId), clientEventId: item.changeId, entityId: '', localVersion: 0, serverVersion: 0, resolution: 'REVIEW_REQUIRED', reason: item.resolution, occurredAt: new Date().toISOString() })) }
    }
    return parseSync(response, clientBatchId, events.map((item) => item.clientEventId))
  }
}

export function isB11OfflineError(error: unknown): boolean { return serverError(error) }
export function isB11ForbiddenError(error: unknown): boolean { return error instanceof MobileApiError && error.status === 403 }
export function isB11ExpiredError(error: unknown): boolean { return error instanceof MobileApiError && [404, 410].includes(error.status) }
