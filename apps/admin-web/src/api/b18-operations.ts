import { adminClient } from './client'

export async function listB18SupportTickets(): Promise<unknown> {
  return adminClient.request('/admin/ops/tickets?limit=50&includeAll=true')
}

export async function getB18SupportTicket(ticketId: string): Promise<unknown> {
  return adminClient.request(`/admin/ops/tickets/${encodeURIComponent(ticketId)}`)
}

export type SupportTransitionAction =
  | 'ACKNOWLEDGE' | 'START' | 'WAIT_CUSTOMER' | 'RESOLVE' | 'CLOSE' | 'REOPEN' | 'ASSIGN'

function idempotencyKey(action: string, ticketId: string): string {
  return `support-${action.toLowerCase()}-${ticketId}-${Date.now()}`
}

/** Prepare a confirmation challenge for RESOLVE/CLOSE. */
export async function prepareSupportTransition(
  ticketId: string,
  action: SupportTransitionAction,
): Promise<{ token?: string }> {
  const response = await adminClient.request(
    `/admin/ops/tickets/${encodeURIComponent(ticketId)}/transitions/prepare`,
    { method: 'POST', body: action },
  ) as { data?: { token?: string }; token?: string }
  const data = response?.data ?? response
  return { token: typeof data === 'object' && data && 'token' in data ? String((data as { token?: string }).token ?? '') : undefined }
}

export async function transitionSupportTicket(
  ticketId: string,
  action: SupportTransitionAction,
  confirmationToken?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Idempotency-Key': idempotencyKey(action, ticketId),
  }
  if (confirmationToken) headers['X-Confirmation-Token'] = confirmationToken
  return adminClient.request(`/admin/ops/tickets/${encodeURIComponent(ticketId)}/transitions`, {
    method: 'POST',
    body: action,
    headers,
  })
}
