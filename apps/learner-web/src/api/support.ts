import { apiClient } from './client'

export type SupportTicketState =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED'

export interface SupportTicket {
  ticketId: string
  categoryCode: string
  state: SupportTicketState
  priority: string
  slaState: string | null
  slaDueAt: string | null
  redactionVersion: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  return 'data' in value ? value.data : value
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function ticketOf(value: unknown): SupportTicket | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const ticketId = text(source.ticketId)
  if (!ticketId) return null
  return {
    ticketId,
    categoryCode: text(source.categoryCode, 'TECHNICAL'),
    state: (text(source.state, 'OPEN') as SupportTicket['state']),
    priority: text(source.priority, 'NORMAL'),
    slaState: typeof source.slaState === 'string' ? source.slaState : null,
    slaDueAt: typeof source.slaDueAt === 'string' ? source.slaDueAt : null,
    redactionVersion: typeof source.redactionVersion === 'string' ? source.redactionVersion : null,
  }
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const raw = await apiClient.get<unknown>('/support/tickets')
  const data = unwrap(raw)
  const items = isRecord(data) && Array.isArray(data.items) ? data.items : []
  return items.flatMap((item) => {
    const ticket = ticketOf(item)
    return ticket ? [ticket] : []
  })
}

export async function getSupportTicket(ticketId: string): Promise<SupportTicket | null> {
  return ticketOf(await apiClient.get<unknown>(`/support/tickets/${encodeURIComponent(ticketId)}`))
}
