import { adminClient } from './client'

/**
 * B4-02 phonetics catalog browser for the tenant control plane.
 *
 * Read-only: the page renders the published `b3_content_experience`
 * PHONETICS projection through the existing learner `/phonetics/*`
 * gateway channel (no new gateway path). `language=fr-FR` reads the
 * `PHONETICS-FR` domain; omitting it keeps the legacy English catalog.
 * Audio bytes never flow through this page (symbols/profiles only).
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

export async function listPhonemes(language?: string): Promise<PhonemeRow[]> {
  const params = new URLSearchParams()
  if (language?.trim()) params.set('language', language.trim())
  const query = params.toString() ? `?${params.toString()}` : ''
  const rows = unwrapItems(await adminClient.request(`/phonetics/catalog${query}`))
  return rows.map((row) => ({
    ...row,
    phonemeId: (row.phonemeId ?? '') as number | string,
    symbol: text(row.symbol, '—'),
    group: text(row.group, '—'),
  }))
}

export async function listPhoneticPairs(language?: string): Promise<MinimalPairRow[]> {
  const params = new URLSearchParams({ limit: '20' })
  if (language?.trim()) params.set('language', language.trim())
  const rows = unwrapItems(await adminClient.request(`/phonetics/minimal-pairs?${params.toString()}`))
  return rows.map((row) => ({
    ...row,
    pairId: (row.pairId ?? '') as number | string,
  }))
}
