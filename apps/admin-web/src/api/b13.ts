import { adminClient } from './client'

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
export function listB13Audit(): Promise<unknown> { return adminClient.request(B13_ADMIN_PATHS.audit) }
export function prepareB13Command(body: Record<string, unknown>): Promise<unknown> {
  return adminClient.request(B13_ADMIN_PATHS.prepareCommand, { method: 'POST', body, ...withKey('b13-admin-prepare') })
}
export function executeB13Command(body: Record<string, unknown>, confirmationToken?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey('b13-admin-command') }
  if (confirmationToken) headers['X-Confirmation-Token'] = confirmationToken
  return adminClient.request(B13_ADMIN_PATHS.commands, { method: 'POST', body, headers })
}
