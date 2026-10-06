import { unavailableOperation } from './unavailable'
import { adminClient, AdminApiError } from './client'
import { adminT } from '../platform/admin-i18n'

/**
 * B4-02 phonetics catalog browser for the tenant control plane.
 *
 * The owner-bound Gateway projection is pending. Catalog and pair reads reject
 * locally with a translated unavailable state until that projection is verified.
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

export async function listPhonemes(language?: string): Promise<PhonemeRow[]> {
  const params = new URLSearchParams()
  if (language?.trim()) params.set('language', language.trim())
  const query = params.toString() ? `?${params.toString()}` : ''
  try {
    const rows = unwrapItems(await unavailableOperation())
    return rows.map((row) => ({
      ...row,
      phonemeId: (row.phonemeId ?? '') as number | string,
      symbol: text(row.symbol, '—'),
      group: text(row.group, '—'),
    }))
  } catch (error) {
    throw friendlyError(error)
  }
}

export async function listPhoneticPairs(language?: string): Promise<MinimalPairRow[]> {
  const params = new URLSearchParams({ limit: '20' })
  if (language?.trim()) params.set('language', language.trim())
  try {
    const rows = unwrapItems(await unavailableOperation())
    return rows.map((row) => ({
      ...row,
      pairId: (row.pairId ?? '') as number | string,
    }))
  } catch (error) {
    throw friendlyError(error)
  }
}
