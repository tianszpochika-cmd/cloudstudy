import { adminClient } from './client'

export interface B13AuditPage {
  items: Record<string, unknown>[]
  nextCursor: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseB13AuditPage(response: unknown): B13AuditPage {
  if (!isRecord(response) || !isRecord(response.data) || !isRecord(response.meta)
    || response.data.redacted !== true || !Array.isArray(response.data.items)
    || !response.data.items.every((item: unknown) => isRecord(item)
      && typeof item.auditId === 'string' && item.auditId.trim() && item.redacted === true)
    || typeof response.meta.hasMore !== 'boolean'
    || typeof response.meta.pageSize !== 'number' || !Number.isInteger(response.meta.pageSize)
    || response.meta.pageSize < 1 || response.meta.pageSize > 100
    || response.data.items.length > response.meta.pageSize) {
    throw new Error('审计记录响应无效，请刷新重试。')
  }
  const cursor = response.meta.nextCursor
  if (response.meta.hasMore
    ? typeof cursor !== 'string' || !cursor.trim() || !response.data.items.length
    : cursor != null) {
    throw new Error('审计分页响应无效，请刷新重试。')
  }
  return { items: response.data.items, nextCursor: response.meta.hasMore ? cursor as string : null }
}

export const B13_ADMIN_PATHS = {
  orders: '/admin/ops/commerce/orders?limit=50',
  tickets: '/admin/ops/tickets?limit=50&includeAll=true',
  metrics: '/admin/ops/metrics?limit=50',
  commands: '/admin/ops/commands',
  prepareCommand: '/admin/ops/commands/prepare',
  audit: '/admin/ops/audit',
} as const

let keySequence = 0
function idempotencyKey(prefix: string): string {
  keySequence += 1
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${keySequence}`
  return `${prefix}-${suffix}`
}

function withKey(prefix: string): { headers: { 'Idempotency-Key': string } } {
  return { headers: { 'Idempotency-Key': idempotencyKey(prefix) } }
}

export function listB13AdminOrders(): Promise<unknown> { return adminClient.request(B13_ADMIN_PATHS.orders) }
export function listB13SupportTickets(): Promise<unknown> { return adminClient.request(B13_ADMIN_PATHS.tickets) }
export function listB13Metrics(): Promise<unknown> { return adminClient.request(B13_ADMIN_PATHS.metrics) }
export async function listB13Audit(cursor?: string, pageSize = 20): Promise<B13AuditPage> {
  const boundedSize = Math.max(1, Math.min(pageSize, 100))
  const path = `${B13_ADMIN_PATHS.audit}?pageSize=${boundedSize}`
    + (cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`)
  return parseB13AuditPage(await adminClient.request<unknown>(path))
}
export function prepareB13Command(body: Record<string, unknown>): Promise<unknown> {
  return adminClient.request(B13_ADMIN_PATHS.prepareCommand, { method: 'POST', body, ...withKey('b13-admin-prepare') })
}
export function executeB13Command(body: Record<string, unknown>, confirmationToken?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey('b13-admin-command') }
  if (confirmationToken) headers['X-Confirmation-Token'] = confirmationToken
  return adminClient.request(B13_ADMIN_PATHS.commands, { method: 'POST', body, headers })
}
