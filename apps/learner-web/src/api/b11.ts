import { ApiError, apiClient } from './client'
import type { B11ListeningProgress, B11MediaManifest, B11NotificationPreference, B11OfflineChange, B11RecordingMetadata, B11SignedUrl, B11SyncResult } from '../domain/b11'

type RecordValue = Record<string, unknown>

export const B11_GATEWAY_ROUTES = {
  manifest: (assetId: string) => `/media/assets/${encodeURIComponent(assetId)}/manifest`,
  access: (assetId: string) => `/media/assets/${encodeURIComponent(assetId)}/access`,
  legacySignedUrl: (assetId: string) => `/media/assets/${encodeURIComponent(assetId)}/signed-url`,
  notificationPreferences: '/settings/notifications',
  legacyNotificationPreferences: '/notification/preferences',
  offlineChanges: '/sync/changes',
  recordings: '/multimodal/recordings',
} as const

function withB11Headers(idempotencyKey?: string): { headers: Headers } {
  const headers = new Headers()
  headers.set('X-Client-Version', 'b11-learner-web')
  headers.set('X-UI-Locale', 'zh-CN')
  headers.set('X-Content-Locale', 'en-US')
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
  return { headers }
}

function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : {}
}

function unwrap(value: unknown): unknown {
  const source = record(value)
  return 'data' in source ? source.data : value
}

function stringValue(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback }
function numberValue(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }

function parseManifest(value: unknown): B11MediaManifest {
  const source = record(unwrap(value))
  const renditions = Array.isArray(source.renditions) ? source.renditions.flatMap((entry) => {
    const item = record(entry)
    const renditionId = stringValue(item.renditionId)
    return renditionId ? [{ renditionId, codec: stringValue(item.codec), mimeType: stringValue(item.mimeType), byteLength: numberValue(item.byteLength), checksumSha256: stringValue(item.checksumSha256), status: stringValue(item.status, 'PENDING') as B11MediaManifest['renditions'][number]['status'] }] : []
  }) : []
  const segments = Array.isArray(source.segments) ? source.segments.flatMap((entry) => {
    const item = record(entry)
    const segmentId = stringValue(item.segmentId)
    return segmentId ? [{ segmentId, startMs: numberValue(item.startMs), endMs: numberValue(item.endMs), renditionId: stringValue(item.renditionId), checksumSha256: stringValue(item.checksumSha256) }] : []
  }) : []
  return { assetId: stringValue(source.assetId), assetVersion: numberValue(source.assetVersion), contentVersionId: numberValue(source.contentVersionId), checksumSha256: stringValue(source.checksumSha256), mimeType: stringValue(source.mimeType), durationMs: numberValue(source.durationMs), renditions, segments }
}

export async function getMediaManifest(assetId: string): Promise<B11MediaManifest> {
  return parseManifest(await apiClient.get(B11_GATEWAY_ROUTES.manifest(assetId), withB11Headers()))
}

export async function issueMediaSignedUrl(assetId: string, renditionId: string, contentVersionId: number): Promise<B11SignedUrl> {
  const request = () => apiClient.post(B11_GATEWAY_ROUTES.access(assetId), { renditionId, contentVersionId }, withB11Headers(`b11-media-url-${assetId}-${renditionId}-${contentVersionId}`))
  let raw: unknown
  try { raw = await request() } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) throw error
    raw = await apiClient.post(B11_GATEWAY_ROUTES.legacySignedUrl(assetId), { renditionId, contentVersionId }, withB11Headers(`b11-media-url-${assetId}-${renditionId}-${contentVersionId}`))
  }
  const response = record(unwrap(raw))
  return { assetId: stringValue(response.assetId, assetId), renditionId: stringValue(response.renditionId, renditionId), url: stringValue(response.url), expiresAt: stringValue(response.expiresAt), checksumSha256: stringValue(response.checksumSha256) }
}

export async function getNotificationPreference(): Promise<B11NotificationPreference> {
  let raw: unknown
  try { raw = await apiClient.get(B11_GATEWAY_ROUTES.notificationPreferences, withB11Headers()) } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) throw error
    raw = await apiClient.get(B11_GATEWAY_ROUTES.legacyNotificationPreferences, withB11Headers())
  }
  const source = record(unwrap(raw))
  const channels: B11NotificationPreference['enabledChannels'] = Array.isArray(source.enabledChannels) ? source.enabledChannels.filter((item): item is B11NotificationPreference['enabledChannels'][number] => item === 'IN_APP' || item === 'EMAIL' || item === 'PUSH') : ['IN_APP']
  return { enabledChannels: channels, learningReminders: source.learningReminders !== false, marketing: source.marketing === true, version: numberValue(source.version, 1) }
}

export async function updateNotificationPreference(preference: B11NotificationPreference): Promise<B11NotificationPreference> {
  const body = { ...preference, expectedVersion: preference.version }
  const headers = withB11Headers(`b11-pref-${preference.version}-${preference.enabledChannels.join('-')}`)
  let raw: unknown
  try { raw = await apiClient.put(B11_GATEWAY_ROUTES.notificationPreferences, body, headers) } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) throw error
    raw = await apiClient.put(B11_GATEWAY_ROUTES.legacyNotificationPreferences, body, headers)
  }
  const response = record(unwrap(raw))
  return { enabledChannels: Array.isArray(response.enabledChannels) ? response.enabledChannels as B11NotificationPreference['enabledChannels'] : preference.enabledChannels, learningReminders: response.learningReminders !== false, marketing: response.marketing === true, version: numberValue(response.version, preference.version + 1) }
}

export async function pushB11OfflineChanges(changes: B11OfflineChange[], baseCursor: string): Promise<B11SyncResult> {
  const value = unwrap(await apiClient.post(B11_GATEWAY_ROUTES.offlineChanges, { baseCursor, changes }, withB11Headers(`b11-sync-${baseCursor}-${changes.map((item) => item.clientEventId).join('-')}`)))
  const source = record(value)
  return { nextCursor: stringValue(source.nextCursor, baseCursor), acceptedClientEventIds: Array.isArray(source.acceptedClientEventIds) ? source.acceptedClientEventIds.filter((item): item is string => typeof item === 'string') : [], conflicts: Array.isArray(source.conflicts) ? source.conflicts as B11SyncResult['conflicts'] : [], recoveryCodes: Array.isArray(source.recoveryCodes) ? source.recoveryCodes.filter((item): item is string => typeof item === 'string') : [] }
}

export async function pullB11OfflineChanges(cursor: string): Promise<{ nextCursor: string; changes: B11OfflineChange[] }> {
  const source = record(unwrap(await apiClient.get(`${B11_GATEWAY_ROUTES.offlineChanges}?cursor=${encodeURIComponent(cursor)}`, withB11Headers())))
  return { nextCursor: stringValue(source.nextCursor, cursor), changes: Array.isArray(source.changes) ? source.changes as B11OfflineChange[] : [] }
}

export async function saveB11RecordingMetadata(metadata: Omit<B11RecordingMetadata, 'status' | 'aiScoringEnabled'>): Promise<B11RecordingMetadata> {
  const response = record(unwrap(await apiClient.post(B11_GATEWAY_ROUTES.recordings, { ...metadata, clientEventId: metadata.recordingId }, withB11Headers(`b11-recording-${metadata.recordingId}`))))
  return { recordingId: stringValue(response.recordingId, metadata.recordingId), sourceSegmentId: metadata.sourceSegmentId, durationMs: metadata.durationMs, contentHash: metadata.contentHash, storageMode: metadata.storageMode, status: response.status === 'REVOKED' || response.status === 'FAILED' || response.status === 'LOCAL_ONLY' ? response.status : 'SAVED', aiScoringEnabled: false, createdAt: stringValue(response.createdAt) }
}

export function isB11OfflineError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500)
}

export function isB11PermissionError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

export function isB11RevokedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 410
}

export function isB11ExpiredError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 412)
}

export function progressChange(progress: B11ListeningProgress, sequence: number, payloadHash: string): B11OfflineChange {
  return { clientEventId: `b11-progress-${progress.assetId}-${progress.positionVersion}`, clientSeq: sequence, entityType: 'LISTENING_PROGRESS', entityId: progress.assetId, entityVersion: progress.positionVersion, operation: 'UPSERT', payloadHash, occurredAt: new Date().toISOString() }
}
