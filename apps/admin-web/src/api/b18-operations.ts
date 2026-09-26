import { adminClient } from './client'

export async function listB18SupportTickets(): Promise<unknown> {
  return adminClient.request('/admin/ops/tickets?limit=50&includeAll=true')
}

export async function getB18SupportTicket(ticketId: string): Promise<unknown> {
  return adminClient.request(`/admin/ops/tickets/${encodeURIComponent(ticketId)}`)
}
