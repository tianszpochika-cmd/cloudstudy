import type { B4OfflineRecord, B4SyncEvent } from '../domain/b4'

const STORAGE_KEY = 'yx.b4.learner-web.sync.v1'
const SCHEMA_VERSION = 1

interface PersistedState {
  schemaVersion: number
  records: B4OfflineRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSyncEvent(value: unknown): value is B4SyncEvent {
  if (!isRecord(value)) return false
  return typeof value.clientEventId === 'string'
    && typeof value.eventType === 'string'
    && typeof value.occurredAt === 'string'
    && typeof value.entityId === 'string'
    && typeof value.entityVersion === 'number'
    && isRecord(value.payload)
}

function emptyState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, records: [] }
}

function readState(): PersistedState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.records)) return emptyState()
    const records = parsed.records.filter((item): item is B4OfflineRecord => {
      if (!isRecord(item) || !isSyncEvent(item.event)) return false
      return typeof item.id === 'string' && typeof item.status === 'string' && typeof item.attemptCount === 'number'
    }).map((item): B4OfflineRecord => {
      const status: B4OfflineRecord['status'] = item.status === 'SYNCING' || item.status === 'FAILED' ? item.status : 'PENDING'
      return {
        id: item.id,
        event: item.event,
        status,
        attemptCount: Math.max(0, item.attemptCount),
        lastError: typeof item.lastError === 'string' ? item.lastError : null,
        queuedAt: typeof item.queuedAt === 'string' ? item.queuedAt : new Date().toISOString(),
      }
    })
    return { schemaVersion: SCHEMA_VERSION, records }
  } catch {
    return emptyState()
  }
}

function writeState(state: PersistedState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }))
  } catch {
    // The store surfaces a queue write failure through its own error state.
  }
}

export interface B4OfflineQueue {
  readonly records: B4OfflineRecord[]
  enqueue(event: B4SyncEvent): void
  markSyncing(id: string): void
  markFailed(id: string, message: string): void
  remove(ids: string[]): void
  clear(): void
}

export function createB4OfflineQueue(): B4OfflineQueue {
  const state = readState()
  return {
    get records(): B4OfflineRecord[] { return state.records },
    enqueue(event): void {
      if (state.records.some((item) => item.id === event.clientEventId)) return
      state.records.push({ id: event.clientEventId, event, status: 'PENDING', attemptCount: 0, lastError: null, queuedAt: new Date().toISOString() })
      writeState(state)
    },
    markSyncing(id): void {
      const item = state.records.find((record) => record.id === id)
      if (!item) return
      item.status = 'SYNCING'
      writeState(state)
    },
    markFailed(id, message): void {
      const item = state.records.find((record) => record.id === id)
      if (!item) return
      item.status = 'FAILED'
      item.attemptCount += 1
      item.lastError = message
      writeState(state)
    },
    remove(ids): void {
      const remove = new Set(ids)
      state.records.splice(0, state.records.length, ...state.records.filter((item) => !remove.has(item.id)))
      writeState(state)
    },
    clear(): void {
      state.records.splice(0, state.records.length)
      writeState(state)
    },
  }
}

export function isB4NetworkAvailable(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}
