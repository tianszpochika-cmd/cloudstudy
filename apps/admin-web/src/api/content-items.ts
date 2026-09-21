import { adminClient, AdminApiError } from './client'
import { adminT } from '../platform/admin-i18n'
import { LEXEME_PACK } from './lexeme'

/**
 * B2 row-level item + scheduled publish port.
 * Reuses the executable Gateway content-commands channel; no new paths.
 */

export type ItemKind = 'QUESTION' | 'EXAMPLE' | 'GRAMMAR_POINT' | 'PASSAGE' | 'EXERCISE' | 'DICTATION' | 'SHADOWING'
export type ItemAvailability = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'

export interface ContentItemRow {
  itemId: string
  kind: ItemKind
  stem: string
  packCode: string
  availability: ItemAvailability
  stateVersion: number
  fields: Record<string, unknown>
  sourceCode: string | null
  licenseCode: string | null
  createdBy: string
}

export interface ScheduledTask {
  taskId: string
  packCode: string
  targetType: 'PACK' | 'LEXEME' | 'ITEM'
  targetRef: string
  expectedStateVersion: number | null
  runAt: string
  status: 'SCHEDULED' | 'CANCELLED' | 'EXECUTED' | 'FAILED'
  reasonCode: string | null
  cohort: string | null
  failureCode: string | null
  createdBy: string
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
  return Array.isArray(items) ? items.filter(isRecord) : []
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asItemRow(item: Row): ContentItemRow | null {
  const record = isRecord(item.item) ? item.item : null
  if (!record || !text(record.itemId)) return null
  return {
    itemId: text(record.itemId),
    kind: (record.kind ?? 'QUESTION') as ItemKind,
    stem: text(record.stem, text(item.title)),
    packCode: text(record.packCode, LEXEME_PACK),
    availability: (record.availability ?? item.latestStatus ?? 'DRAFT') as ItemAvailability,
    stateVersion: typeof record.stateVersion === 'number' ? record.stateVersion : 0,
    fields: isRecord(record.fields) ? record.fields : {},
    sourceCode: typeof record.sourceCode === 'string' ? record.sourceCode : null,
    licenseCode: typeof record.licenseCode === 'string' ? record.licenseCode : null,
    createdBy: text(record.createdBy),
  }
}

function idempotencyKey(prefix: string): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return `${prefix}-${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

async function sendCommand(body: Row): Promise<Row> {
  try {
    const response = await adminClient.request('/admin/content-commands', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey('item') },
    })
    return isRecord(response) && isRecord(response.data) ? response.data : {}
  } catch (error) {
    if (error instanceof AdminApiError) throw new Error(error.message)
    throw error instanceof Error ? error : new Error(adminT('apiContentItems.commandFailed'))
  }
}

export async function listItems(input: {
  kind?: string
  q?: string
  availability?: string
  cursor?: string
  limit?: number
}): Promise<{ rows: ContentItemRow[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ kind: 'ITEM', pageSize: String(input.limit ?? 50) })
  if (input.kind) params.set('itemKind', input.kind)
  if (input.q?.trim()) params.set('q', input.q.trim())
  if (input.availability) params.set('availability', input.availability)
  if (input.cursor) params.set('cursor', input.cursor)
  const response: unknown = await adminClient.request(`/admin/content-commands?${params.toString()}`)
  const rows = unwrapList(isRecord(response) ? response.data : response).map(asItemRow).filter((row): row is ContentItemRow => row !== null)
  const root = isRecord(response) ? response : null
  const meta = root && isRecord(root.meta) ? root.meta : null
  return { rows, nextCursor: meta && typeof meta.nextCursor === 'string' ? meta.nextCursor : null }
}

export function upsertItem(
  packCode: string,
  item: { itemId?: string; kind: ItemKind; stem: string; fields?: Record<string, unknown> },
): Promise<Row> {
  return sendCommand({
    command: 'ITEM_UPSERT',
    contentCode: packCode,
    expectedStateVersion: 0,
    itemId: item.itemId ?? '',
    item: { kind: item.kind, stem: item.stem, fields: item.fields ?? {} },
  })
}

export function itemLifecycle(
  row: ContentItemRow,
  command: 'ITEM_SUBMIT_REVIEW' | 'ITEM_PUBLISH' | 'ITEM_UNPUBLISH' | 'ITEM_ARCHIVE',
): Promise<Row> {
  return sendCommand({
    command,
    contentCode: row.packCode,
    expectedStateVersion: row.stateVersion,
    itemId: row.itemId,
    reasonCode: 'TENANT_ADMIN',
  })
}

export function itemReview(row: ContentItemRow, stage: 'FIRST' | 'FINAL'): Promise<Row> {
  return sendCommand({
    command: stage === 'FIRST' ? 'ITEM_REVIEW_FIRST' : 'ITEM_REVIEW_FINAL',
    contentCode: row.packCode,
    expectedStateVersion: row.stateVersion,
    itemId: row.itemId,
    reviewDecision: 'APPROVED',
  })
}

export interface BatchEntry {
  contentCode: string
  content?: Record<string, unknown>
  lexeme?: Record<string, unknown>
  lexemeId?: string
  item?: Record<string, unknown>
  itemId?: string
}

export async function importBatch(entries: BatchEntry[]): Promise<Row> {
  try {
    const response = await adminClient.request('/admin/content-commands/import/batch', {
      method: 'POST',
      body: { items: entries },
      headers: { 'Idempotency-Key': idempotencyKey('batch') },
    })
    return isRecord(response) && isRecord(response.data) ? response.data : {}
  } catch (error) {
    if (error instanceof AdminApiError) throw new Error(error.message)
    throw error instanceof Error ? error : new Error(adminT('apiContentItems.importFailed'))
  }
}

export async function schedulePublish(input: {
  packCode: string
  targetType: 'PACK' | 'LEXEME' | 'ITEM'
  targetRef: string
  expectedStateVersion?: number
  runAt: string
  reasonCode?: string
  cohort?: string
}): Promise<Row> {
  return sendCommand({
    command: 'SCHEDULE_PUBLISH',
    contentCode: input.packCode,
    expectedStateVersion: input.expectedStateVersion ?? 0,
    targetType: input.targetType,
    targetRef: input.targetRef,
    schedule: { scheduledAt: input.runAt },
    reasonCode: input.reasonCode ?? 'SCHEDULED_PUBLISH',
    cohort: input.cohort ?? '',
  })
}

export async function cancelSchedule(packCode: string, scheduledPublishTaskId: string): Promise<Row> {
  return sendCommand({
    command: 'CANCEL_SCHEDULED_PUBLISH',
    contentCode: packCode,
    expectedStateVersion: 0,
    scheduledPublishTaskId,
  })
}

export async function getPackDetail(packCode: string): Promise<Row> {
  try {
    const response = await adminClient.request(`/admin/content-commands/${encodeURIComponent(packCode)}`)
    return isRecord(response) && isRecord(response.data) ? response.data : {}
  } catch (error) {
    // A pack that was never created has no schedule state: report empty instead
    // of alarming. Any other failure still surfaces.
    if (error instanceof AdminApiError && error.status === 404) return {}
    throw error
  }
}

export function readScheduledTasks(pack: Row): ScheduledTask[] {
  if (!isRecord(pack) || !Array.isArray(pack.scheduledTasks)) return []
  return pack.scheduledTasks.filter(isRecord) as unknown as ScheduledTask[]
}
