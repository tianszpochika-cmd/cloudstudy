import type { B4OfflineRecord, B4SyncEvent } from '../domain/b4'

export const B4_OFFLINE_STORAGE_KEY = 'yx.b4.learner-web.sync.v1'
const SCHEMA_VERSION = 2
interface PersistedState { schemaVersion: number; subject: string; records: B4OfflineRecord[] }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function isSyncEvent(value: unknown): value is B4SyncEvent {
  return isRecord(value) && typeof value.clientEventId === 'string' && typeof value.eventType === 'string'
    && typeof value.occurredAt === 'string' && typeof value.entityId === 'string'
    && typeof value.entityVersion === 'number' && isRecord(value.payload)
}
export function clearB4OfflineSnapshot(): void {
  try { if (typeof window !== 'undefined') window.localStorage.removeItem(B4_OFFLINE_STORAGE_KEY) } catch { /* storage may be unavailable */ }
}
function read(subject: string): B4OfflineRecord[] {
  if (typeof window === 'undefined') return []
  let raw: string | null = null
  try { raw = window.localStorage.getItem(B4_OFFLINE_STORAGE_KEY) } catch { return [] }
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { clearB4OfflineSnapshot(); return [] }
  if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION || parsed.subject !== subject || !Array.isArray(parsed.records)) {
    // Never inherit an unowned legacy queue or a prior account's events.
    clearB4OfflineSnapshot()
    return []
  }
  return parsed.records.filter((item): item is B4OfflineRecord => isRecord(item) && isSyncEvent(item.event)
    && typeof item.id === 'string' && item.id === item.event.clientEventId
    && typeof item.status === 'string' && typeof item.attemptCount === 'number')
    .map((item): B4OfflineRecord => ({ id: item.id, event: item.event,
      status: item.status === 'SYNCING' || item.status === 'FAILED' ? 'FAILED' : 'PENDING',
      attemptCount: Math.max(0, item.attemptCount), lastError: typeof item.lastError === 'string' ? item.lastError : null,
      queuedAt: typeof item.queuedAt === 'string' ? item.queuedAt : new Date().toISOString() }))
}

export interface B4OfflineQueue {
  readonly subject: string | null
  readonly records: B4OfflineRecord[]
  bindSubject(subject: string | null): void
  enqueue(event: B4SyncEvent): boolean
  markSyncing(id: string): void
  markFailed(id: string, message: string): void
  remove(ids: string[]): void
  clear(): void
}

export function createB4OfflineQueue(): B4OfflineQueue {
  let subject: string | null = null
  let records: B4OfflineRecord[] = []
  function write(): boolean {
    if (!subject || typeof window === 'undefined') return false
    try { window.localStorage.setItem(B4_OFFLINE_STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, subject, records } satisfies PersistedState)); return true }
    catch { return false }
  }
  return {
    get subject(): string | null { return subject },
    get records(): B4OfflineRecord[] { return subject ? records : [] },
    bindSubject(next): void {
      if (subject === next) return
      subject = next
      records = next ? read(next) : []
      if (!next) clearB4OfflineSnapshot()
    },
    enqueue(event): boolean {
      if (!subject) return false
      if (records.some((item) => item.id === event.clientEventId)) return true
      records.push({ id: event.clientEventId, event, status: 'PENDING', attemptCount: 0, lastError: null, queuedAt: new Date().toISOString() })
      if (write()) return true
      records.pop()
      return false
    },
    markSyncing(id): void { if (!subject) return; const item = records.find((entry) => entry.id === id); if (item) { item.status = 'SYNCING'; write() } },
    markFailed(id, message): void { if (!subject) return; const item = records.find((entry) => entry.id === id); if (item) { item.status = 'FAILED'; item.attemptCount += 1; item.lastError = message; write() } },
    remove(ids): void { if (!subject) return; const removed = new Set(ids); records = records.filter((item) => !removed.has(item.id)); write() },
    clear(): void { records = []; if (subject) write(); else clearB4OfflineSnapshot() },
  }
}

export function isB4NetworkAvailable(): boolean { return typeof navigator === 'undefined' || navigator.onLine !== false }
