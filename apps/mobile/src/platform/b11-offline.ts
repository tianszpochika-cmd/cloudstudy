import { getUniRuntime } from './uni-runtime'
import type { B11Conflict, B11OfflineEvent, B11OfflineRecord } from '../domain/b11'

const STORAGE_KEY = 'yx.b11.mobile.offline.v1'
const MAX_STORAGE_BYTES = 512 * 1024
const SENSITIVE_KEYS = /^(blob|base64|bytes|dataUrl|mediaData|payloadData)$/i

interface PersistedQueue {
  cursor: string
  records: B11OfflineRecord[]
  conflicts: B11Conflict[]
  entityVersions: Record<string, number>
}

export interface B11QueueResult {
  accepted: boolean
  duplicate: boolean
  reason?: 'STORAGE_FULL' | 'SENSITIVE_PAYLOAD' | 'INVALID_EVENT'
  record?: B11OfflineRecord
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function sanitizeValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEYS.test(key)) return undefined
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined)
  if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeValue(childValue, childKey)
      if (sanitized !== undefined) result[childKey] = sanitized
    }
    return result
  }
  return value
}

function containsSensitiveKey(value: unknown, key = ''): boolean {
  if (SENSITIVE_KEYS.test(key)) return true
  if (Array.isArray(value)) return value.some((item) => containsSensitiveKey(item))
  return isRecord(value) && Object.entries(value).some(([childKey, childValue]) => containsSensitiveKey(childValue, childKey))
}

function emptyState(): PersistedQueue {
  return { cursor: '', records: [], conflicts: [], entityVersions: {} }
}

function readState(): PersistedQueue {
  try {
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw !== 'string') return emptyState()
    const parsed = JSON.parse(raw) as Partial<PersistedQueue>
    return {
      cursor: typeof parsed.cursor === 'string' ? parsed.cursor : '',
      records: Array.isArray(parsed.records) ? parsed.records : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      entityVersions: isRecord(parsed.entityVersions) ? Object.fromEntries(Object.entries(parsed.entityVersions).filter(([, value]) => typeof value === 'number')) as Record<string, number> : {},
    }
  } catch {
    return emptyState()
  }
}

function writeState(state: PersistedQueue): boolean {
  try {
    const serialized = JSON.stringify(state)
    if (serialized.length > MAX_STORAGE_BYTES) return false
    getUniRuntime().setStorageSync(STORAGE_KEY, serialized)
    return true
  } catch {
    return false
  }
}

export async function hashB11Payload(value: unknown): Promise<string> {
  const serialized = JSON.stringify(value)
  const cryptoValue = globalThis.crypto
  if (cryptoValue?.subtle) {
    const digest = await cryptoValue.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const char of serialized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `${Math.abs(hash).toString(16).padStart(8, '0')}${'0'.repeat(56)}`
}

export class B11OfflineQueue {
  private state: PersistedQueue = readState()

  get cursor(): string { return this.state.cursor }
  get records(): B11OfflineRecord[] { return clone(this.state.records) }
  get conflicts(): B11Conflict[] { return clone(this.state.conflicts) }
  get pendingCount(): number { return this.state.records.filter((item) => item.status !== 'SYNCING').length }

  refresh(): void { this.state = readState() }

  enqueue(event: B11OfflineEvent): B11QueueResult {
    if (!event.clientEventId || !event.entityId || !event.entityType || !event.payloadHash) return { accepted: false, duplicate: false, reason: 'INVALID_EVENT' }
    const existing = this.state.records.find((item) => item.clientEventId === event.clientEventId)
    if (existing) return { accepted: true, duplicate: true, record: clone(existing) }
    if (containsSensitiveKey(event.payload)) return { accepted: false, duplicate: false, reason: 'SENSITIVE_PAYLOAD' }
    const payload = sanitizeValue(event.payload)
    if (!isRecord(payload)) return { accepted: false, duplicate: false, reason: 'SENSITIVE_PAYLOAD' }
    const record: B11OfflineRecord = { ...clone(event), payload, status: 'PENDING', attempts: 0, queuedAt: new Date().toISOString() }
    const next: PersistedQueue = { ...this.state, records: [...this.state.records, record] }
    if (!writeState(next)) return { accepted: false, duplicate: false, reason: 'STORAGE_FULL' }
    this.state = next
    return { accepted: true, duplicate: false, record: clone(record) }
  }

  markSyncing(clientEventId: string): void {
    this.state.records = this.state.records.map((item) => item.clientEventId === clientEventId ? { ...item, status: 'SYNCING', attempts: item.attempts + 1 } : item)
    writeState(this.state)
  }

  markFailed(clientEventId: string, reason: string): void {
    this.state.records = this.state.records.map((item) => item.clientEventId === clientEventId ? { ...item, status: 'FAILED', lastError: reason } : item)
    writeState(this.state)
  }

  remove(clientEventIds: string[]): void {
    const ids = new Set(clientEventIds)
    this.state.records = this.state.records.filter((item) => !ids.has(item.clientEventId))
    writeState(this.state)
  }

  setCursor(cursor: string): void {
    this.state.cursor = cursor
    writeState(this.state)
  }

  recordConflict(conflict: B11Conflict): void {
    if (!this.state.conflicts.some((item) => item.conflictId === conflict.conflictId)) this.state.conflicts.push(conflict)
    writeState(this.state)
  }

  reconcileEntityVersion(entityId: string, serverVersion: number, localVersion: number): B11Conflict | null {
    const knownVersion = this.state.entityVersions[entityId] ?? 0
    this.state.entityVersions[entityId] = Math.max(knownVersion, serverVersion)
    writeState(this.state)
    if (serverVersion > localVersion) {
      const conflict: B11Conflict = { conflictId: `b11-conflict-${entityId}-${serverVersion}`, clientEventId: '', entityId, localVersion, serverVersion, resolution: 'REVIEW_REQUIRED', reason: '服务端版本较新，未静默覆盖本地进度。', occurredAt: new Date().toISOString() }
      this.recordConflict(conflict)
      return conflict
    }
    return null
  }

  clearConflicts(): void { this.state.conflicts = []; writeState(this.state) }
}

export function clearB11OfflineStorage(): void {
  try { getUniRuntime().removeStorageSync(STORAGE_KEY) } catch { /* runtime not ready */ }
}
