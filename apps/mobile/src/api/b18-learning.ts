import { mobileApiClient } from './client'
import { mobileI18n } from '../platform/v2-foundation'

export interface MobileB18ReviewQueueItem {
  queueItemId: string
  source: 'NEW' | 'REVIEW' | 'MISTAKE' | 'RETRY' | 'UNKNOWN'
  state: string
  dueAt: string | null
  priority: number
  stateVersion: number
  completable: boolean
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function unwrap(value: unknown): unknown { const source = record(value); return 'data' in source ? source.data : value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function query(path: string): string { return `${path}?contentLocale=${encodeURIComponent(mobileI18n.state.contentLocale)}&limit=20` }
function headers(clientEventId?: string): Record<string, string> {
  const result: Record<string, string> = { 'X-UI-Locale': mobileI18n.state.locale, 'X-Content-Locale': mobileI18n.state.contentLocale, 'X-Device-Id': 'mobile', 'X-Client-Version': 'b18-mobile' }
  if (clientEventId) result['Idempotency-Key'] = clientEventId
  return result
}

function parse(value: unknown): MobileB18ReviewQueueItem | null {
  const source = record(value)
  const queueItemId = text(source.queueItemId) ?? text(source.id)
  if (!queueItemId) return null
  const rawSource = text(source.source)?.toUpperCase()
  return { queueItemId, source: rawSource === 'NEW' || rawSource === 'REVIEW' || rawSource === 'MISTAKE' || rawSource === 'RETRY' ? rawSource : 'UNKNOWN', state: text(source.state) ?? 'UNKNOWN', dueAt: text(source.dueAt), priority: Math.max(0, number(source.priority)), stateVersion: Math.max(0, number(source.stateVersion)), completable: source.completable === true }
}

export async function listMobileB18ReviewQueue(): Promise<MobileB18ReviewQueueItem[]> {
  const response = await mobileApiClient.request<unknown>(query('/learning/review-queue'), { header: headers() })
  const source = unwrap(response)
  const candidate = record(source).items
  const items: unknown[] = Array.isArray(source) ? source : Array.isArray(candidate) ? candidate : []
  return items.flatMap((item) => { const parsed = parse(item); return parsed ? [parsed] : [] })
}
