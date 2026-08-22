import type { ListeningMaterial, Phoneme, ReadingArticle, ReadingQuestion, SpeakingRecording } from './b3'
import { createClientId } from '../platform/client-id'

export type B11Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'expired' | 'recovering' | 'error'
export type B11SyncRecordStatus = 'PENDING' | 'SYNCING' | 'FAILED'
export type B11RecordingStatus = 'IDLE' | 'RECORDING' | 'LOCAL_ONLY' | 'SUBMITTING' | 'SAVED' | 'FAILED'
export type B11PermissionStatus = 'UNKNOWN' | 'REQUESTING' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED'
export type B11SelfRating = 'NEEDS_PRACTICE' | 'BASIC' | 'FLUENT' | 'UNCERTAIN'

export interface B11MediaVariant {
  variant: string
  mimeType?: string
  codec?: string
  bitrate?: number
  sizeBytes?: number
  checksum?: string
  signedUrl?: string | null
  expiresAt?: string | null
}

export interface B11MediaClip {
  clipId: string
  title: string
  startMs: number
  endMs: number
  mediaAssetId?: string
  signedUrl?: string | null
  expiresAt?: string | null
}

export interface B11MediaManifest {
  assetId: string
  contentVersion: string | number
  rightsStatus: 'AUTHORIZED' | 'REVOKED' | 'EXPIRED' | 'PENDING'
  availability: 'READY' | 'NOT_READY' | 'FAILED'
  checksum?: string | null
  sizeBytes?: number | null
  durationMs?: number | null
  expiresAt?: string | null
  revokedAt?: string | null
  variants: B11MediaVariant[]
  clips: B11MediaClip[]
}

export interface B11ListeningWorkspace {
  material: ListeningMaterial
  manifest: B11MediaManifest | null
  sessionId: string | null
  contentVersion: string | number
}

export interface B11ReadingWorkspace {
  article: ReadingArticle
  questions: ReadingQuestion[]
  contentVersion: string | number
}

export interface B11RecordingDraft {
  sourceSegmentId: string
  durationMs: number
  contentHash: string
  storageMode: 'LOCAL_ENCRYPTED' | 'LOCAL_TEMP'
  localEncryptedPath?: string
  status: B11RecordingStatus
  recordingId?: string
  selfRating?: B11SelfRating
  clientEventId: string
  contentVersion: string | number
  createdAt: string
}

export interface B11OfflineEvent {
  clientEventId: string
  entityType: 'MEDIA_PROGRESS' | 'READING_PROGRESS' | 'READING_QUESTION' | 'RECORDING' | 'SELF_RATING' | 'SHADOWING'
  entityId: string
  entityVersion: number
  operation: 'UPSERT' | 'DELETE'
  contentVersion: string | number
  payloadHash: string
  occurredAt: string
  payload: Record<string, unknown>
}

export interface B11OfflineRecord extends B11OfflineEvent {
  status: B11SyncRecordStatus
  attempts: number
  lastError?: string
  queuedAt: string
}

export interface B11Conflict {
  conflictId: string
  clientEventId: string
  entityId: string
  localVersion: number
  serverVersion: number
  resolution: 'REVIEW_REQUIRED' | 'SERVER_WINS' | 'CLIENT_WINS'
  reason: string
  occurredAt: string
}

export interface B11SyncResponse {
  clientBatchId: string
  acceptedEventIds: string[]
  nextCursor: string
  conflicts: B11Conflict[]
}

export interface B11ListeningQuestionState {
  questionId: string
  prompt: string
  options?: Array<{ optionCode: string; label: string }>
  answer?: string
  submitted?: boolean
  feedback?: string
}

export interface B11RecordingResult {
  recording: SpeakingRecording
  aiScoringAvailable: false
  localCopyRetained: boolean
}

export function createB11ClientEventId(prefix: string): string {
  return createClientId(`b11-mobile-${prefix}`).slice(0, 120)
}

export function contentVersionOf(value: unknown, fallback: string | number = 'unknown'): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

export function isB11PermissionDenied(value: unknown): boolean {
  return value === 'denied' || value === 'PERMISSION_DENIED' || value === 'MIC_PERMISSION_DENIED'
}

export function isB11AiDisabled(value: unknown): value is false {
  return value === false
}

export type B11PhonemeCatalog = Phoneme[]
