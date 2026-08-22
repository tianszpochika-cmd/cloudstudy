export type B11Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error' | 'permission' | 'revoked' | 'expired' | 'recovering'
export type B11MediaStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'

export interface B11MediaRendition {
  renditionId: string
  codec: string
  mimeType: string
  byteLength: number
  checksumSha256: string
  status: B11MediaStatus
}

export interface B11MediaSegment {
  segmentId: string
  startMs: number
  endMs: number
  renditionId: string
  checksumSha256: string
}

export interface B11MediaManifest {
  assetId: string
  assetVersion: number
  contentVersionId: number
  checksumSha256: string
  mimeType: string
  durationMs: number
  renditions: B11MediaRendition[]
  segments: B11MediaSegment[]
}

export interface B11SignedUrl {
  assetId: string
  renditionId: string
  url: string
  expiresAt: string
  checksumSha256: string
}

export interface B11NotificationPreference {
  enabledChannels: Array<'IN_APP' | 'EMAIL' | 'PUSH'>
  learningReminders: boolean
  marketing: boolean
  version: number
}

export interface B11OfflineChange {
  clientEventId: string
  clientSeq: number
  entityType: string
  entityId: string
  entityVersion: number
  operation: 'UPSERT' | 'DELETE' | 'APPEND'
  payloadHash: string
  occurredAt: string
}

export interface B11OfflineConflict {
  clientEventId: string
  entityType: string
  entityId: string
  clientVersion: number
  serverVersion: number
  resolutionCode: 'SERVER_VERSION_WINS' | 'CLIENT_RETRY_REQUIRED' | 'MANUAL_RECOVERY'
}

export interface B11SyncResult {
  nextCursor: string
  acceptedClientEventIds: string[]
  conflicts: B11OfflineConflict[]
  recoveryCodes: string[]
}

export interface B11RecordingMetadata {
  recordingId: string
  sourceSegmentId: string
  durationMs: number
  contentHash: string
  contentVersionId?: number
  storageMode: 'LOCAL_ENCRYPTED' | 'AUTHORIZED_OBJECT'
  status: 'LOCAL_ONLY' | 'SAVED' | 'FAILED' | 'REVOKED'
  aiScoringEnabled: false
  createdAt?: string
}

export interface B11ListeningProgress {
  assetId: string
  contentVersionId: number
  positionMs: number
  positionVersion: number
  playbackRate: number
  subtitleMode: 'HIDDEN' | 'VISIBLE'
}
