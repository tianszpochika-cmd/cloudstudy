import type { OfflineChange } from '../domain/b3'

const STORAGE_KEY = 'yx.b3.offline.v2'
const LEGACY_STORAGE_KEY = 'yx.b3.offline.v1'
const SCHEMA_VERSION = 2

export type OfflineRecordStatus = 'PENDING' | 'SYNCING' | 'FAILED'

export interface B3OfflineRecord {
  id: string
  change: OfflineChange
  status: OfflineRecordStatus
  attemptCount: number
  nextRetryAt: string | null
  lastError: string | null
  queuedAt: string
}

interface PersistedState {
  schemaVersion: number
  cursor: string
  records: B3OfflineRecord[]
}

export interface B3OfflineQueue {
  readonly records: B3OfflineRecord[]
  readonly cursor: string
  enqueue(change: OfflineChange): void
  markSyncing(id: string): void
  markFailed(id: string, message: string): void
  remove(ids: string[]): void
  setCursor(cursor: string): void
  clearFailed(): void
  clearCompleted(): void
  reset(): void
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function isChange(value: unknown): value is OfflineChange {
  if (!isRecord(value)) return false
  return typeof value.changeId === 'string' && typeof value.entityType === 'string' && typeof value.entityId === 'string'
    && typeof value.entityVersion === 'number' && (value.operation === 'UPSERT' || value.operation === 'DELETE')
    && typeof value.payloadHash === 'string' && typeof value.occurredAt === 'string'
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return { schemaVersion: SCHEMA_VERSION, cursor: '0', records: [] }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return { schemaVersion: SCHEMA_VERSION, cursor: '0', records: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { schemaVersion: SCHEMA_VERSION, cursor: '0', records: [] }
    const records = Array.isArray(parsed.records) ? parsed.records.filter((item): item is B3OfflineRecord => {
      if (!isRecord(item) || !isChange(item.change)) return false
      return typeof item.id === 'string' && typeof item.status === 'string' && typeof item.attemptCount === 'number'
    }).map((item): B3OfflineRecord => ({ ...item, status: (item.status === 'SYNCING' || item.status === 'FAILED' ? item.status : 'PENDING') as OfflineRecordStatus, lastError: typeof item.lastError === 'string' ? item.lastError : null, nextRetryAt: typeof item.nextRetryAt === 'string' ? item.nextRetryAt : null })) : []
    const state = { schemaVersion: SCHEMA_VERSION, cursor: typeof parsed.cursor === 'string' ? parsed.cursor : '0', records }
    if (window.localStorage.getItem(STORAGE_KEY) === null) { persist(state); window.localStorage.removeItem(LEGACY_STORAGE_KEY) }
    return state
  } catch { return { schemaVersion: SCHEMA_VERSION, cursor: '0', records: [] } }
}

function persist(state: PersistedState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }))
}

export function createB3OfflineQueue(): B3OfflineQueue {
  const state = loadState()
  const api: B3OfflineQueue = {
    get records(): B3OfflineRecord[] { return state.records },
    get cursor(): string { return state.cursor },
    enqueue(change: OfflineChange): void {
      if (state.records.some((item) => item.id === change.changeId)) return
      state.records.push({ id: change.changeId, change, status: 'PENDING', attemptCount: 0, nextRetryAt: null, lastError: null, queuedAt: new Date().toISOString() })
      persist(state)
    },
    markSyncing(id: string): void { const record = state.records.find((item) => item.id === id); if (record) { record.status = 'SYNCING'; persist(state) } },
    markFailed(id: string, message: string): void { const record = state.records.find((item) => item.id === id); if (record) { record.status = 'FAILED'; record.attemptCount += 1; record.lastError = message; record.nextRetryAt = new Date(Date.now() + Math.min(record.attemptCount * 30000, 300000)).toISOString(); persist(state) } },
    remove(ids: string[]): void { const set = new Set(ids); state.records.splice(0, state.records.length, ...state.records.filter((item) => !set.has(item.id))); persist(state) },
    setCursor(cursor: string): void { state.cursor = cursor || '0'; persist(state) },
    clearFailed(): void { state.records.splice(0, state.records.length, ...state.records.filter((item) => item.status !== 'FAILED')); persist(state) },
    clearCompleted(): void { state.records.splice(0, state.records.length, ...state.records.filter((item) => item.status !== 'SYNCING')); persist(state) },
    reset(): void { state.records.splice(0, state.records.length); state.cursor = '0'; persist(state) },
  }
  return api
}

export async function sha256Text(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('当前环境不支持安全哈希，未创建离线变更。')
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isB3NetworkAvailable(): boolean { return typeof navigator === 'undefined' || navigator.onLine !== false }
