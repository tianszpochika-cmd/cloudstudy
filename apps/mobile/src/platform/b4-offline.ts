import { getUniRuntime } from './uni-runtime'
import type { B4OfflineRecord, B4SyncEvent } from '../domain/b4'

const STORAGE_KEY = 'yx.b4.mobile.sync.v1'
const SCHEMA_VERSION = 1
interface PersistedState { schemaVersion: number; records: B4OfflineRecord[] }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function isEvent(value: unknown): value is B4SyncEvent { return isRecord(value) && typeof value.clientEventId === 'string' && typeof value.eventType === 'string' && typeof value.occurredAt === 'string' && typeof value.entityId === 'string' && typeof value.entityVersion === 'number' && isRecord(value.payload) }
function empty(): PersistedState { return { schemaVersion: SCHEMA_VERSION, records: [] } }
function read(): PersistedState {
  const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
  const parsed: unknown = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw
  if (!isRecord(parsed) || !Array.isArray(parsed.records)) return empty()
  const records = parsed.records.filter((item): item is B4OfflineRecord => isRecord(item) && typeof item.id === 'string' && isEvent(item.event) && typeof item.status === 'string' && typeof item.attemptCount === 'number').map((item): B4OfflineRecord => ({ id: item.id, event: item.event, status: item.status === 'SYNCING' || item.status === 'FAILED' ? item.status : 'PENDING', attemptCount: Math.max(0, item.attemptCount), lastError: typeof item.lastError === 'string' ? item.lastError : null, queuedAt: typeof item.queuedAt === 'string' ? item.queuedAt : new Date().toISOString() }))
  return { schemaVersion: SCHEMA_VERSION, records }
}
function write(state: PersistedState): void { getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION })) }

export interface B4OfflineQueue { readonly records: B4OfflineRecord[]; enqueue(event: B4SyncEvent): void; markSyncing(id: string): void; markFailed(id: string, message: string): void; remove(ids: string[]): void }
export function createB4OfflineQueue(): B4OfflineQueue {
  const state = read()
  return {
    get records(): B4OfflineRecord[] { return state.records },
    enqueue(event): void { if (!state.records.some((item) => item.id === event.clientEventId)) state.records.push({ id: event.clientEventId, event, status: 'PENDING', attemptCount: 0, lastError: null, queuedAt: new Date().toISOString() }); write(state) },
    markSyncing(id): void { const item = state.records.find((entry) => entry.id === id); if (item) item.status = 'SYNCING'; write(state) },
    markFailed(id, message): void { const item = state.records.find((entry) => entry.id === id); if (item) { item.status = 'FAILED'; item.attemptCount += 1; item.lastError = message }; write(state) },
    remove(ids): void { const remove = new Set(ids); state.records.splice(0, state.records.length, ...state.records.filter((item) => !remove.has(item.id))); write(state) },
  }
}
