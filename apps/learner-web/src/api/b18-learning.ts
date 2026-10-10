import { apiClient, type ApiRequestOptions } from './client'
import { learnerI18n } from '../platform/v2-foundation'

export interface B18ReviewQueueItem {
  queueItemId: string
  itemId: number | null
  source: 'NEW' | 'REVIEW' | 'MISTAKE' | 'RETRY' | 'UNKNOWN'
  state: string
  dueAt: string | null
  priority: number
  stateVersion: number
  completable: boolean
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function unwrap(value: unknown): unknown {
  const source = record(value)
  return 'data' in source ? source.data : value
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function requestOptions(stableKey?: string): ApiRequestOptions {
  const headers = new Headers()
  headers.set('X-UI-Locale', learnerI18n.locale)
  headers.set('X-Content-Locale', learnerI18n.contentLocale)
  headers.set('X-Device-Id', 'learner-web')
  headers.set('X-Client-Version', 'b18-learner-web')
  if (stableKey) headers.set('Idempotency-Key', stableKey)
  return { headers }
}

function query(path: string): string {
  const params = new URLSearchParams({ contentLocale: learnerI18n.contentLocale, limit: '20' })
  return `${path}?${params.toString()}`
}

function parseItem(value: unknown): B18ReviewQueueItem | null {
  const source = record(value)
  const queueItemId = text(source.queueItemId) ?? text(source.id)
  if (!queueItemId) return null
  const rawSource = text(source.source)?.toUpperCase()
  const sourceCode = rawSource === 'NEW' || rawSource === 'REVIEW' || rawSource === 'MISTAKE' || rawSource === 'RETRY' ? rawSource : 'UNKNOWN'
  return {
    queueItemId,
    itemId: typeof source.itemId === 'number' ? source.itemId : null,
    source: sourceCode,
    state: text(source.state) ?? 'UNKNOWN',
    dueAt: text(source.dueAt),
    priority: Math.max(0, number(source.priority)),
    stateVersion: Math.max(0, number(source.stateVersion)),
    completable: source.completable === true,
  }
}

export interface ReviewHistoryEntry { itemId: string; disposition: 'COMPLETED' | 'DEFERRED' }
export interface ReviewQueueView { items: B18ReviewQueueItem[]; emptyStatus: string; emptyCopy: string; history: ReviewHistoryEntry[] }

export async function listB18ReviewQueue(): Promise<ReviewQueueView> {
  const response = await apiClient.get<unknown>(query('/learning/review-queue'), requestOptions())
  const source = unwrap(response)
  const payload = record(source)
  const candidate = payload.items
  const items: unknown[] = Array.isArray(source) ? source : Array.isArray(candidate) ? candidate : []
  const history = (Array.isArray(payload.history) ? payload.history : []).flatMap((item) => {
    const row = record(item)
    const disposition = text(row.disposition)
    if (disposition !== 'COMPLETED' && disposition !== 'DEFERRED') return []
    return [{ itemId: text(row.itemId) ?? '', disposition }]
  })
  return {
    items: items.flatMap((item) => { const parsed = parseItem(item); return parsed ? [parsed] : [] }),
    emptyStatus: text(payload.emptyStatus) ?? '',
    emptyCopy: text(payload.emptyCopy) ?? '',
    history,
  }
}
