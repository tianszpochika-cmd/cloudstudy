import { adminClient } from './client'
import { executeB13Command, listB13Audit, listB13Metrics as listCanonicalB13Metrics, type B13AuditPage } from './b13'

/**
 * B5 pages are kept as compatibility imports, but they now use the B13 owner contract.
 * Historical B5 admin paths are intentionally not callable from the browser anymore. B13 writes use Idempotency-Key
 * in the canonical adapter and payment-intents is the only payment command seam.
 */
export async function getDashboardMetrics(): Promise<unknown> { return listCanonicalB13Metrics() }
export async function searchAuditLogs(cursor?: string, pageSize = 20): Promise<B13AuditPage> {
  return listB13Audit(cursor, pageSize)
}

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
  return executeB13Command(body, confirmationToken)
}
