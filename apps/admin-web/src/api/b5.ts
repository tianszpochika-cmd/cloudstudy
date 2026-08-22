import { adminClient } from './client'

let b13KeySequence = 0
function key(prefix: string): { headers: { 'Idempotency-Key': string } } {
  b13KeySequence += 1
  const value = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${b13KeySequence}`
  return { headers: { 'Idempotency-Key': `${prefix}-${value}` } }
}

export async function getDashboardMetrics(): Promise<unknown> { return adminClient.request('/admin/dashboard/metrics') }
export async function listFeatureFlags(): Promise<unknown> { return adminClient.request('/admin/feature-flags') }
export async function updateFeatureFlag(flagKey: string, body: Record<string, unknown>): Promise<unknown> { return adminClient.request(`/admin/feature-flags/${encodeURIComponent(flagKey)}`, { method: 'PUT', body, ...key(`flag-${flagKey}`) }) }
export async function createContentDraft(body: Record<string, unknown>): Promise<unknown> { return adminClient.request('/admin/content', { method: 'POST', body, ...key('content-create') }) }
export async function validateContentDraft(contentId: string): Promise<unknown> { return adminClient.request(`/admin/content/${encodeURIComponent(contentId)}/validate`, { method: 'POST', ...key(`content-validate-${contentId}`) }) }
export async function submitContentReview(contentId: string): Promise<unknown> { return adminClient.request(`/admin/content/${encodeURIComponent(contentId)}/submit-review`, { method: 'POST', ...key(`content-submit-${contentId}`) }) }
export async function listReviewTasks(): Promise<unknown> { return adminClient.request('/admin/reviews?limit=50') }
export async function decideReviewTask(taskId: string, stage: 'FIRST' | 'FINAL', decision: 'APPROVED' | 'REJECTED'): Promise<unknown> { return adminClient.request(`/admin/reviews/${encodeURIComponent(taskId)}/decision`, { method: 'POST', body: { stage, decision }, ...key(`review-${taskId}`) }) }
export async function publishContent(contentId: string): Promise<unknown> { return adminClient.request(`/admin/content/${encodeURIComponent(contentId)}/publish`, { method: 'POST', ...key(`content-publish-${contentId}`) }) }
export async function getRiskProfile(userId: number): Promise<unknown> { return adminClient.request(`/admin/risk/users/${userId}`) }
export async function applyRiskAction(userId: number, actionCode: string): Promise<unknown> { return adminClient.request(`/admin/risk/users/${userId}/actions`, { method: 'POST', body: { actionCode, ttlSeconds: 3600 }, ...key(`risk-${userId}-${actionCode}`) }) }
export async function listReconciliationBatches(): Promise<unknown> { return adminClient.request('/admin/reconciliation/batches') }
export async function searchAuditLogs(): Promise<unknown> { return adminClient.request('/admin/audit-logs?limit=50') }
export async function exportAuditReport(): Promise<unknown> { return adminClient.request('/admin/audit-logs/export', { method: 'POST', ...key('audit-export') }) }

// B13 admin-ops Gateway routes. The compatibility page consumes these read projections and
// command seams; it never accepts client tenant, owner, role, or permission facts.
export const B13_ADMIN_COMMERCE_ROUTES = {
  orders: '/admin/ops/commerce/orders?limit=50',
  tickets: '/admin/ops/tickets?limit=50&includeAll=true',
  metrics: '/admin/ops/metrics?limit=50',
  paymentIntent: '/commerce/orders/{orderId}/payment-intents',
} as const
export async function listB13AdminOrders(): Promise<unknown> { return adminClient.request(B13_ADMIN_COMMERCE_ROUTES.orders) }
export async function listB13SupportTickets(): Promise<unknown> { return adminClient.request(B13_ADMIN_COMMERCE_ROUTES.tickets) }
export async function listB13Metrics(): Promise<unknown> { return adminClient.request(B13_ADMIN_COMMERCE_ROUTES.metrics) }
export async function executeB13AdminCommand(body: Record<string, unknown>, confirmationToken?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'Idempotency-Key': `b13-admin-command-${Date.now()}-${++b13KeySequence}` }
  if (confirmationToken) headers['X-Confirmation-Token'] = confirmationToken
  return adminClient.request('/admin/ops/commands', { method: 'POST', body, headers })
}
