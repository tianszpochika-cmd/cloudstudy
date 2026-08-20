import type { OfflineChange } from '../domain/b3'
import { getUniRuntime } from './uni-runtime'

const STORAGE_KEY = 'yx.b3.mobile.offline.v2'
const LEGACY_STORAGE_KEY = 'yx.b3.mobile.offline.v1'
const SCHEMA_VERSION = 2

export interface MobileB3OfflineRecord { id: string; change: OfflineChange; status: 'PENDING' | 'SYNCING' | 'FAILED'; attemptCount: number; lastError: string | null; queuedAt: string }
interface State { schemaVersion: number; cursor: string; records: MobileB3OfflineRecord[] }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function isChange(value: unknown): value is OfflineChange {
  if (!isRecord(value)) return false
  return typeof value.changeId === 'string' && typeof value.entityType === 'string' && typeof value.entityId === 'string' && typeof value.entityVersion === 'number' && (value.operation === 'UPSERT' || value.operation === 'DELETE') && typeof value.payloadHash === 'string' && typeof value.occurredAt === 'string'
}
function empty(): State { return { schemaVersion: SCHEMA_VERSION, cursor: '0', records: [] } }
function parse(raw: unknown): State {
  const parsed: unknown = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw
  if (!isRecord(parsed)) return empty()
  const records = Array.isArray(parsed.records) ? parsed.records.map((item): MobileB3OfflineRecord | null => {
    if (!isRecord(item)) return null
    const change = isChange(item.change) ? item.change : isChange(item) ? item : null
    if (!change) return null
    const status = item.status === 'SYNCING' || item.status === 'FAILED' ? item.status : 'PENDING'
    return { id: typeof item.id === 'string' ? item.id : change.changeId, change, status, attemptCount: typeof item.attemptCount === 'number' ? Math.max(0, item.attemptCount) : 0, lastError: typeof item.lastError === 'string' ? item.lastError : null, queuedAt: typeof item.queuedAt === 'string' ? item.queuedAt : new Date().toISOString() }
  }).filter((item): item is MobileB3OfflineRecord => Boolean(item)) : []
  return { schemaVersion: SCHEMA_VERSION, cursor: typeof parsed.cursor === 'string' ? parsed.cursor : '0', records }
}
function write(state: State): void { getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION })) }

function read(): State {
  const runtime = getUniRuntime()
  const currentRaw = runtime.getStorageSync(STORAGE_KEY)
  if (currentRaw !== undefined && currentRaw !== null && currentRaw !== '') return parse(currentRaw)
  const legacyRaw = runtime.getStorageSync(LEGACY_STORAGE_KEY)
  const migrated = parse(legacyRaw)
  if (legacyRaw !== undefined && legacyRaw !== null && migrated.records.length) { write(migrated); runtime.removeStorageSync(LEGACY_STORAGE_KEY) }
  return migrated
}

export function readB3OfflineState(): State { return read() }
export function enqueueB3Offline(change: OfflineChange): MobileB3OfflineRecord[] { const state = read(); if (!state.records.some((item) => item.id === change.changeId)) state.records.push({ id: change.changeId, change, status: 'PENDING', attemptCount: 0, lastError: null, queuedAt: new Date().toISOString() }); write(state); return state.records }
export function markB3OfflineFailed(id: string, message: string): MobileB3OfflineRecord[] { const state = read(); const item = state.records.find((record) => record.id === id); if (item) { item.status = 'FAILED'; item.attemptCount += 1; item.lastError = message } write(state); return state.records }
export function clearB3Offline(ids: string[]): MobileB3OfflineRecord[] { const state = read(); const remove = new Set(ids); state.records = state.records.filter((item) => !remove.has(item.id)); write(state); return state.records }
export function clearFailedB3Offline(): MobileB3OfflineRecord[] { const state = read(); state.records = state.records.filter((item) => item.status !== 'FAILED'); write(state); return state.records }
export function setB3OfflineCursor(cursor: string): MobileB3OfflineRecord[] { const state = read(); state.cursor = cursor || '0'; write(state); return state.records }
export async function sha256Text(value: string): Promise<string> { const runtime = globalThis as typeof globalThis & { crypto?: Crypto }; if (!runtime.crypto?.subtle) throw new Error('当前平台不支持安全哈希，未创建离线变更。'); const digest = await runtime.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') }
