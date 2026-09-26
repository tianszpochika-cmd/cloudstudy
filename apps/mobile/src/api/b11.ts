import { mobileApiClient, MobileApiError } from './client'
import type { DictationResult, ListeningMaterial, Phoneme, ReadingArticle, ReadingAttemptResult, ReadingQuestion, SpeakingRecording } from '../domain/b3'
import type { B11Conflict, B11MediaManifest, B11OfflineEvent, B11ReadingWorkspace, B11RecordingResult, B11ListeningWorkspace, B11SyncResponse } from '../domain/b11'
import { contentVersionOf } from '../domain/b11'

type RecordValue = Record<string, unknown>

export interface B11RequestContext { uiLocale: string; contentLocale: string }

export const B11_GATEWAY_PATHS = {
  media: { manifest: '/media/assets', signedUrl: '/media/assets', progress: '/learning/media-progress' },
  listening: { materials: '/listening/materials', sessions: '/listening/sessions', dictation: '/listening/sessions' },
  reading: { articles: '/reading/articles', questions: '/reading/questions', progress: '/reading/progress', attempts: '/reading/attempts' },
  speaking: { phonetics: '/phonetics/catalog', recordings: '/speaking/recordings', shadowing: '/speaking/shadowing/completions' },
  offline: { sync: '/sync/changes' },
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
function serverError(error: unknown): boolean { return error instanceof MobileApiError && (error.status === 0 || error.status >= 500) }

function contentVersion(value: unknown, fallback: string | number): string | number { return contentVersionOf(value, fallback) }

function parseManifest(value: unknown, fallbackAssetId: string): B11MediaManifest | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const ownerManifest = 'assetStatus' in source || 'transcodingStatus' in source || Array.isArray(source.items)
  const variants = ownerManifest
    ? (Array.isArray(source.items) ? source.items : []).filter(isRecord).flatMap((item) => {
      const renditionKey = text(item.renditionKey)
      if (!renditionKey || item.status !== 'READY') return []
      return [{ variant: renditionKey === 'original' ? 'default' : renditionKey, mimeType: optionalText(item.mimeType), sizeBytes: number(item.sizeBytes) ?? undefined, checksum: optionalText(item.checksumSha256), signedUrl: null }]
    })
    : Array.isArray(source.variants)
      ? source.variants.filter(isRecord).map((item) => ({ variant: text(item.variant ?? item.name) ?? 'default', mimeType: optionalText(item.mimeType), codec: optionalText(item.codec), bitrate: number(item.bitrate) ?? undefined, sizeBytes: number(item.sizeBytes) ?? undefined, checksum: optionalText(item.checksum ?? item.sha256), signedUrl: text(item.signedUrl ?? item.url), expiresAt: text(item.expiresAt) }))
      : []
  const clips = Array.isArray(source.clips) ? source.clips.filter(isRecord).map((item, index) => ({ clipId: text(item.clipId ?? item.id) ?? `${fallbackAssetId}-clip-${index + 1}`, title: text(item.title ?? item.label) ?? `Clip ${index + 1}`, startMs: number(item.startMs) ?? 0, endMs: number(item.endMs) ?? 0, mediaAssetId: optionalText(item.mediaAssetId), signedUrl: text(item.signedUrl ?? item.url), expiresAt: text(item.expiresAt) })) : []
  const rights = text(source.rightsStatus)
  const ownerRights = source.assetStatus === 'REVOKED' || source.assetStatus === 'DELETED' ? 'REVOKED' : rights === 'ACTIVE' ? 'AUTHORIZED' : rights === 'REVOKED' || rights === 'EXPIRED' ? rights : 'PENDING'
  const legacyRights = rights && ['AUTHORIZED', 'REVOKED', 'EXPIRED', 'PENDING'].includes(rights) ? rights as B11MediaManifest['rightsStatus'] : 'PENDING'
  const ownerReady = source.assetStatus === 'ACTIVE' && rights === 'ACTIVE' && (source.transcodingStatus === 'READY' || source.transcodingStatus === 'NOT_REQUIRED') && variants.length > 0
  const ownerAvailability = ownerReady ? 'READY' : source.transcodingStatus === 'FAILED' ? 'FAILED' : 'NOT_READY'
  const legacyAvailability = source.availability === 'READY' || source.availability === 'FAILED' ? source.availability : 'NOT_READY'
  return { assetId: text(source.assetId) ?? fallbackAssetId, contentVersion: contentVersion(source.contentVersion ?? source.contentVersionId, 'unknown'), rightsStatus: ownerManifest ? ownerRights : legacyRights, availability: ownerManifest ? ownerAvailability : legacyAvailability, checksum: text(source.checksumSha256 ?? source.checksum ?? source.sha256), sizeBytes: number(source.sizeBytes), durationMs: number(source.durationMs), expiresAt: text(source.expiresAt), revokedAt: text(source.revokedAt), variants, clips }
}

function blockedPlayback(assetId: string, version: string | number): B11MediaManifest {
  return { assetId, contentVersion: version, rightsStatus: 'PENDING', availability: 'NOT_READY', variants: [], clips: [] }
}

export async function loadB11ListeningMaterials(context: B11RequestContext): Promise<ListeningMaterial[]> {
  return list<ListeningMaterial>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.listening.materials, { limit: 20, contentLocale: context.contentLocale })))
}

export async function startB11ListeningSession(materialId: number, context: B11RequestContext, clientEventId: string, version: string | number): Promise<string | null> {
  const source = unwrap(await mobileApiClient.request('/listening/sessions', { method: 'POST', data: { materialId, contentVersion: version, contentVersionId: version, mode: 'LISTEN', clientEventId }, header: headers(context, clientEventId) }))
  return isRecord(source) ? text(source.sessionId ?? source.id) : null
}

export async function fetchB11MediaManifest(assetId: string, context: B11RequestContext, version?: string | number): Promise<B11MediaManifest | null> {
  const path = query(`${B11_GATEWAY_PATHS.media.manifest}/${encodeURIComponent(assetId)}/manifest`, { contentLocale: context.contentLocale, contentVersion: version })
  const manifest = parseManifest(await mobileApiClient.request(path), assetId)
  if (!manifest || manifest.assetId !== assetId) throw new Error('媒体清单无效。')
  return manifest
}

export async function authorizeB11Playback(assetId: string, variant: string, context: B11RequestContext, clientEventId: string, version: string | number): Promise<B11MediaManifest | null> {
  const request = { method: 'POST' as const, data: { renditionId: variant, contentVersionId: version }, header: headers(context, clientEventId) }
  try {
    const source = unwrap(await mobileApiClient.request(`${B11_GATEWAY_PATHS.media.signedUrl}/${encodeURIComponent(assetId)}/signed-url`, request))
    if (!isRecord(source)) return blockedPlayback(assetId, version)
    const url = text(source.url)
    const expiresAt = text(source.expiresAt)
    const expiry = expiresAt ? Date.parse(expiresAt) : NaN
    if (text(source.assetId) !== assetId || !url || !/^https?:\/\//i.test(url) || !Number.isFinite(expiry) || expiry <= Date.now()) return blockedPlayback(assetId, version)
    return { assetId, contentVersion: version, rightsStatus: 'AUTHORIZED', availability: 'READY', checksum: text(source.checksumSha256), sizeBytes: number(source.sizeBytes), expiresAt, variants: [{ variant, signedUrl: url, expiresAt }], clips: [] }
  } catch {
    // Do not fall back to a stale URL embedded in content when the media owner denies access.
    return blockedPlayback(assetId, version)
  }
}

export async function saveB11MediaProgress(input: { sessionId?: string | null; assetId: string; positionMs: number; durationMs: number; contentVersion: string | number; entityVersion: number; clientEventId: string }, context: B11RequestContext): Promise<void> {
  await mobileApiClient.request(B11_GATEWAY_PATHS.media.progress, { method: 'PUT', data: { ...input, clientEventId: input.clientEventId }, header: headers(context, input.clientEventId) })
}

export async function submitB11Dictation(sessionId: string, segmentId: string, answer: string, context: B11RequestContext, clientEventId: string, version: string | number): Promise<DictationResult> {
  return unwrap(await mobileApiClient.request(`/listening/sessions/${encodeURIComponent(sessionId)}/dictation`, { method: 'POST', data: { segmentId, mode: 'SENTENCE', answer, attemptNo: 1, clientEventId, contentVersion: version, contentVersionId: version }, header: headers(context, clientEventId) })) as DictationResult
}

export async function loadB11ReadingWorkspace(context: B11RequestContext): Promise<B11ReadingWorkspace | null> {
  const articles = list<ReadingArticle>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.reading.articles, { limit: 20, contentLocale: context.contentLocale })))
  const first = articles[0]
  if (!first) return null
  const article = unwrap(await mobileApiClient.request(query(`${B11_GATEWAY_PATHS.reading.articles}/${first.articleId}`, { contentLocale: context.contentLocale, contentVersion: first.contentVersionId }))) as ReadingArticle
  const questions = list<ReadingQuestion>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.reading.questions, { limit: 20, articleId: article.articleId, contentLocale: context.contentLocale })))
  return { article, questions, contentVersion: contentVersion(article.contentVersionId, 'unknown') }
}

export async function saveB11ReadingProgress(article: ReadingArticle, blockId: string, progressPercent: number, entityVersion: number, context: B11RequestContext, clientEventId: string): Promise<void> {
  await mobileApiClient.request(B11_GATEWAY_PATHS.reading.progress, { method: 'PUT', data: { articleId: article.articleId, blockId, progressPercent, positionVersion: entityVersion, contentVersion: contentVersion(article.contentVersionId, 'unknown'), clientEventId }, header: headers(context, clientEventId) })
}

export async function submitB11ReadingQuestion(question: ReadingQuestion, answer: string, context: B11RequestContext, clientEventId: string): Promise<ReadingAttemptResult> {
  return unwrap(await mobileApiClient.request(B11_GATEWAY_PATHS.reading.attempts, { method: 'POST', data: { questionId: question.questionId, answer, contentVersion: contentVersion(question.contentVersionId, 'unknown'), contentVersionId: question.contentVersionId, clientEventId }, header: headers(context, clientEventId) })) as ReadingAttemptResult
}

export async function loadB11Phonetics(context: B11RequestContext): Promise<Phoneme[]> {
  return list<Phoneme>(await mobileApiClient.request(query(B11_GATEWAY_PATHS.speaking.phonetics, { setCode: 'EN_48_PHASE1', contentLocale: context.contentLocale })))
}

export async function registerB11Recording(input: { sourceSegmentId: string; durationMs: number; contentHash: string; storageMode: 'LOCAL_ENCRYPTED' | 'LOCAL_TEMP'; contentVersion: string | number; clientEventId: string }, context: B11RequestContext): Promise<B11RecordingResult> {
  const source = unwrap(await mobileApiClient.request(B11_GATEWAY_PATHS.speaking.recordings, { method: 'POST', data: { sourceSegmentId: input.sourceSegmentId, durationMs: input.durationMs, contentHash: input.contentHash, storageMode: input.storageMode, contentVersion: input.contentVersion, contentVersionId: input.contentVersion, clientEventId: input.clientEventId, aiScoringAvailable: false }, header: headers(context, input.clientEventId) }))
  return { recording: source as SpeakingRecording, aiScoringAvailable: false, localCopyRetained: true }
}

export async function deleteB11Recording(recordingId: string, context: B11RequestContext, clientEventId: string): Promise<void> {
  await mobileApiClient.request(`${B11_GATEWAY_PATHS.speaking.recordings}/${encodeURIComponent(recordingId)}`, { method: 'DELETE', header: headers(context, clientEventId) })
}

export async function submitB11SelfRating(recordingId: string, rating: string, context: B11RequestContext, clientEventId: string, version: string | number): Promise<void> {
  await mobileApiClient.request(`${B11_GATEWAY_PATHS.speaking.recordings}/${encodeURIComponent(recordingId)}/self-rating`, { method: 'POST', data: { recordingId, rating, contentVersion: version, clientEventId, aiScoringAvailable: false }, header: headers(context, clientEventId) })
}

export async function completeB11Shadowing(input: { recordingId: string; sourceSegmentId: string; contentVersion: string | number; clientEventId: string }, context: B11RequestContext): Promise<RecordValue> {
  const source = unwrap(await mobileApiClient.request(B11_GATEWAY_PATHS.speaking.shadowing, { method: 'POST', data: { ...input, clientEventId: input.clientEventId, aiScoringAvailable: false }, header: headers(context, input.clientEventId) }))
  return isRecord(source) ? source : {}
}

function parseSync(value: unknown, clientBatchId: string, fallbackIds: string[]): B11SyncResponse {
  const source = unwrap(value)
  if (!isRecord(source)) return { clientBatchId, acceptedEventIds: [], nextCursor: '', conflicts: [] }
  const conflicts: B11Conflict[] = Array.isArray(source.conflicts) ? source.conflicts.filter(isRecord).map((item, index) => ({ conflictId: text(item.conflictId ?? item.id) ?? `${clientBatchId}-conflict-${index}`, clientEventId: text(item.clientEventId) ?? '', entityId: text(item.entityId) ?? '', localVersion: number(item.localVersion) ?? 0, serverVersion: number(item.serverVersion) ?? 0, resolution: text(item.resolution) as B11Conflict['resolution'] ?? 'REVIEW_REQUIRED', reason: text(item.reason) ?? '服务端版本冲突，未静默覆盖。', occurredAt: text(item.occurredAt) ?? new Date().toISOString() })) : []
  const accepted = Array.isArray(source.acceptedEventIds) ? source.acceptedEventIds.filter((item): item is string => typeof item === 'string') : source.accepted === true ? fallbackIds : []
  return { clientBatchId: text(source.clientBatchId) ?? clientBatchId, acceptedEventIds: accepted, nextCursor: text(source.nextCursor ?? source.cursor) ?? '', conflicts }
}

export async function syncB11Offline(events: B11OfflineEvent[], cursor: string, context: B11RequestContext, clientBatchId: string): Promise<B11SyncResponse> {
  return parseSync(await mobileApiClient.request(B11_GATEWAY_PATHS.offline.sync, { method: 'POST', data: { clientBatchId, baseCursor: cursor, changes: events, contentLocale: context.contentLocale }, header: headers(context, clientBatchId) }), clientBatchId, events.map((item) => item.clientEventId))
}

export function isB11OfflineError(error: unknown): boolean { return serverError(error) }
export function isB11ForbiddenError(error: unknown): boolean { return error instanceof MobileApiError && error.status === 403 }
export function isB11ExpiredError(error: unknown): boolean { return error instanceof MobileApiError && [404, 410].includes(error.status) }
