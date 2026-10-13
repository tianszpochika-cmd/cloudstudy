import { adminClient, AdminApiError } from './client'
import { adminT } from '../platform/admin-i18n'

/**
 * B4-02 phonetics catalog browser for the tenant control plane.
 *
 * Reads go through the content admin channel (kind=PHONETICS), not the withheld
 * learner /api/v1/phonetics route. Maintenance reuses the ITEM_* lifecycle with
 * kind PHONEME / MINIMAL_PAIR in the PHONETICS[-LANG] pack (see api/content-items).
 */

export interface PhonemeRow {
  phonemeId: number | string
  symbol: string
  group: string
  exampleWord?: string
  description?: string
  mouthProfile?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface MinimalPairRow {
  pairId: number | string
  leftWord?: string
  rightWord?: string
  [key: string]: unknown
}

type Row = Record<string, unknown>

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapItems(value: unknown): Row[] {
  const root = isRecord(value) && isRecord(value.data) ? value.data : value
  const data = isRecord(root) && isRecord(root.data) ? root.data : root
  const items = isRecord(data) ? data.items : null
  if (!Array.isArray(items)) return []
  return items.filter(isRecord)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback
}

function friendlyError(error: unknown): Error {
  // /api/v1/phonetics/* is a fail-closed withheld route until the M3/M4 owner
  // adjudication lands a gateway projection. Browsers surface that as a CORS-blocked
  // preflight (TypeError) rather than the gateway 404, so both map here.
  if (error instanceof AdminApiError && error.status === 404) {
    return new Error(adminT('apiPhonetics.gatewayPending'))
  }
  if (error instanceof TypeError) {
    return new Error(adminT('apiPhonetics.channelUnreachable'))
  }
  if (error instanceof AdminApiError) return new Error(error.message)
  return error instanceof Error ? error : new Error(adminT('apiPhonetics.loadFailed'))
}

/** Admin pack for a language: English → PHONETICS, others → PHONETICS-{PRIMARY}. Mirrors the server mapping. */
export function phoneticsPack(language?: string): string {
  const tag = language?.trim() ?? ''
  const primary = (tag.includes('-') ? tag.slice(0, tag.indexOf('-')) : tag).toUpperCase()
  return !primary || primary === 'EN' ? 'PHONETICS' : `PHONETICS-${primary}`
}

async function catalog(language: string | undefined, itemKind: 'PHONEME' | 'MINIMAL_PAIR'): Promise<Row[]> {
  const params = new URLSearchParams({ kind: 'PHONETICS', itemKind, pageSize: '100' })
  if (language?.trim()) params.set('language', language.trim())
  return unwrapItems(await adminClient.request(`/admin/content-commands?${params.toString()}`))
}

/** Catalog rows in every availability; learnerVisible says whether learners can see the row today. */
export async function listPhonemes(language?: string): Promise<PhonemeRow[]> {
  try {
    const rows = await catalog(language, 'PHONEME')
    return rows.map((row) => ({
      ...row,
      phonemeId: (row.phonemeId ?? row.resourceKey ?? '') as number | string,
      symbol: text(row.symbol, '—'),
      group: text(row.group, '—'),
    }))
  } catch (error) {
    throw friendlyError(error)
  }
}

export async function listPhoneticPairs(language?: string): Promise<MinimalPairRow[]> {
  try {
    const rows = await catalog(language, 'MINIMAL_PAIR')
    return rows.map((row) => ({
      ...row,
      pairId: (row.pairId ?? row.resourceKey ?? '') as number | string,
    }))
  } catch (error) {
    throw friendlyError(error)
  }
}
