import { adminClient, AdminApiError } from './client'

/**
 * B1 word-master port for the tenant control plane.
 *
 * The browser talks only to Gateway (`/api/v1/admin/content-commands`).
 * Reads use `kind=LEXEME` list projection; writes are LEXEME_* intent
 * commands with Idempotency-Key and expectedStateVersion. No page code
 * knows content-service tables or fabricates actor/tenant/role facts.
 */

export const LEXEME_PACK = 'VOCAB-PHASE1'

export interface LexemeSense {
  pos: string
  /** Legacy Chinese gloss slot; retained for compatibility. */
  meaningCn?: string
  /** Generic local-language gloss slot (B4 ribbon); one of meaningCn/meaningLocal is required. */
  meaningLocal?: string
  meaningEn?: string
  examples?: Array<{ en: string; cn: string; source?: string }>
  synonyms?: string[]
  antonyms?: string[]
  confusables?: string[]
  usageNote?: string
}

export interface LexemeFields {
  headword: string
  /** BCP-47 language ribbon (en-US default, fr-FR, de-DE). Omit to inherit en-US. */
  language?: string
  lemma?: string
  pos?: string[]
  /** B4 morphology ribbon: MASCULINE/FEMININE/NEUTER (fr-* nouns required). */
  gender?: string
  /** B4 morphology ribbon: SINGULAR/PLURAL (fr-* nouns required). */
  number?: string
  /** B4 morphology ribbon: six-case enum (French rows omit). */
  grammaticalCase?: string
  /** B4 morphology ribbon: verb conjugation class (fr-* verbs require verbGroup). */
  conjugation?: { verbGroup?: string; irregular?: boolean }
  cefr?: string
  difficulty?: number
  syllables?: string[]
  stressIndex?: number
  /** Legacy English-only slot; new languages use pronunciation rows. */
  phoneticUS?: string
  /** Legacy English-only slot; new languages use pronunciation rows. */
  phoneticUK?: string
  audioUsAssetId?: string
  audioUkAssetId?: string
  audioSlowAssetId?: string
  senses?: LexemeSense[]
  collocations?: Array<{ text: string; meaningCn: string }>
  morphology?: { root?: string; prefix?: string; suffix?: string }
  mnemonics?: { keyword?: string; storyCn?: string }
  examFreq?: number
  tags?: string[]
  sourceCode?: string
  licenseCode?: string
  [key: string]: unknown
}

export interface LexemePronunciation {
  pronunciationId: string
  /** Open accent tag; US/UK/SLOW remain the conventional English values (e.g. FR-PARIS). */
  accent: string
  ipa: string
  audioAssetId: string
  sourceType: 'HUMAN' | 'TTS'
  voiceName?: string | null
  durationMs?: number | null
  sampleRate?: number | null
  bitrateKbps?: number | null
  qcStatus: 'PENDING' | 'READY' | 'CLEAN' | 'FAILED'
  qcBy?: string | null
  qcAt?: string | null
  createdAt?: string | null
}

export interface LexemeRow {
  lexemeId: string
  headword: string
  /** BCP-47 language ribbon; legacy rows read as en-US. */
  language: string
  packCode: string
  cefr: string | null
  availability: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
  stateVersion: number
  contentVersion: number
  fields: LexemeFields
  publishedFields: Record<string, unknown> | null
  pronunciations: LexemePronunciation[]
  createdBy: string
  updatedBy: string | null
}

type Row = Record<string, unknown>

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapList(value: unknown): Row[] {
  // Canonical cursor envelope: data is the item array.
  if (Array.isArray(value)) return value.filter(isRecord)
  const root = isRecord(value) && isRecord(value.data) ? value.data : value
  if (Array.isArray(root)) return root.filter(isRecord)
  const items = isRecord(root) ? root.items : null
  if (!Array.isArray(items)) return []
  return items.filter(isRecord)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asLexemeRow(item: Row): LexemeRow | null {
  const lexeme = isRecord(item.lexeme) ? item.lexeme : null
  if (!lexeme || !text(lexeme.lexemeId)) return null
  const fields: LexemeFields = { ...(lexeme.fields as LexemeFields) }
  if (!fields.headword) fields.headword = text(lexeme.headword, text(item.title))
  return {
    lexemeId: text(lexeme.lexemeId),
    headword: text(lexeme.headword, text(item.title)),
    language: text(lexeme.language, 'en-US'),
    packCode: text(lexeme.packCode, LEXEME_PACK),
    cefr: typeof lexeme.cefr === 'string' ? lexeme.cefr : null,
    availability: (lexeme.availability ?? item.latestStatus ?? 'DRAFT') as LexemeRow['availability'],
    stateVersion: typeof lexeme.stateVersion === 'number' ? lexeme.stateVersion : 0,
    contentVersion: typeof lexeme.contentVersion === 'number' ? lexeme.contentVersion : 1,
    fields: fields as LexemeFields,
    publishedFields: isRecord(lexeme.publishedFields) ? (lexeme.publishedFields as Record<string, unknown>) : null,
    pronunciations: Array.isArray(lexeme.pronunciations)
      ? (lexeme.pronunciations.filter(isRecord) as unknown as LexemePronunciation[])
      : [],
    createdBy: text(lexeme.createdBy),
    updatedBy: typeof lexeme.updatedBy === 'string' ? lexeme.updatedBy : null,
  }
}

function idempotencyKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return `lexeme-${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export async function listLexemes(input: {
  q?: string
  cefr?: string
  availability?: string
  packCode?: string
  language?: string
  cursor?: string
  limit?: number
}): Promise<{ rows: LexemeRow[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ kind: 'LEXEME', pageSize: String(input.limit ?? 50) })
  if (input.q?.trim()) params.set('q', input.q.trim())
  if (input.cefr) params.set('cefr', input.cefr)
  if (input.availability) params.set('availability', input.availability)
  if (input.packCode?.trim()) params.set('packCode', input.packCode.trim())
  if (input.language?.trim()) params.set('language', input.language.trim())
  if (input.cursor) params.set('cursor', input.cursor)
  const response: unknown = await adminClient.request(`/admin/content-commands?${params.toString()}`)
  // Canonical cursor envelope: data is the item array, cursor state lives in meta.
  const root = isRecord(response) ? response : {}
  const items = unwrapList(root.data)
  const rows = items.map(asLexemeRow).filter((row): row is LexemeRow => row !== null)
  const meta = isRecord(root.meta) ? root.meta : null
  const nextCursor = meta && typeof meta.nextCursor === 'string' ? meta.nextCursor : null
  return { rows, nextCursor }
}

async function sendLexemeCommand(body: Row): Promise<Row> {
  try {
    const response = await adminClient.request('/admin/content-commands', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey() },
    })
    return isRecord(response) && isRecord(response.data) ? response.data : {}
  } catch (error) {
    if (error instanceof AdminApiError) throw new Error(error.message)
    throw error instanceof Error ? error : new Error('单词命令提交失败。')
  }
}

export function upsertLexeme(fields: LexemeFields, lexemeId?: string): Promise<Row> {
  return sendLexemeCommand({
    command: 'LEXEME_UPSERT',
    contentCode: LEXEME_PACK,
    expectedStateVersion: 0,
    lexemeId: lexemeId ?? '',
    lexeme: fields,
  })
}

export function lexemeLifecycle(
  lexeme: LexemeRow,
  command: 'LEXEME_SUBMIT_REVIEW' | 'LEXEME_PUBLISH' | 'LEXEME_UNPUBLISH' | 'LEXEME_ARCHIVE',
  reasonCode = 'TENANT_ADMIN',
): Promise<Row> {
  return sendLexemeCommand({
    command,
    contentCode: lexeme.packCode,
    expectedStateVersion: lexeme.stateVersion,
    lexemeId: lexeme.lexemeId,
    reasonCode,
  })
}

export function lexemeReview(
  lexeme: LexemeRow,
  stage: 'FIRST' | 'FINAL',
  decision: 'APPROVED' = 'APPROVED',
): Promise<Row> {
  return sendLexemeCommand({
    command: stage === 'FIRST' ? 'LEXEME_REVIEW_FIRST' : 'LEXEME_REVIEW_FINAL',
    contentCode: lexeme.packCode,
    expectedStateVersion: lexeme.stateVersion,
    lexemeId: lexeme.lexemeId,
    reviewDecision: decision,
  })
}

export function upsertPronunciation(
  lexeme: LexemeRow,
  pronunciation: {
    pronunciationId?: string
    accent: string
    ipa: string
    audioAssetId: string
    sourceType: 'HUMAN' | 'TTS'
    voiceName?: string
  },
): Promise<Row> {
  return sendLexemeCommand({
    command: 'LEXEME_PRONUNCIATION_UPSERT',
    contentCode: lexeme.packCode,
    expectedStateVersion: lexeme.stateVersion,
    lexemeId: lexeme.lexemeId,
    pronunciation,
  })
}

export function qcPronunciation(
  lexeme: LexemeRow,
  pronunciationId: string,
  qcStatus: 'READY' | 'CLEAN' | 'FAILED',
): Promise<Row> {
  return sendLexemeCommand({
    command: 'LEXEME_PRONUNCIATION_QC',
    contentCode: lexeme.packCode,
    expectedStateVersion: lexeme.stateVersion,
    lexemeId: lexeme.lexemeId,
    pronunciation: { pronunciationId, qcStatus },
    reasonCode: 'PRONUNCIATION_QC',
  })
}
