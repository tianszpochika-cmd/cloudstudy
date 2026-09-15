import { apiClient } from './client'
import { createClientId } from '../platform/client-id'

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

export const SUPPORT_CATEGORIES = [
  'CONTENT_CORRECTION',
  'ACCOUNT_ACCESS',
  'BILLING',
  'LEARNING_DATA',
  'PRIVACY_REQUEST',
  'TECHNICAL',
] as const

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function key(): string {
  return createClientId('support')
}

/** Raw text never crosses this boundary: only its SHA-256 fingerprint is sent. */
export async function createSupportTicket(input: {
  categoryCode: string
  resourceRef?: string
  description: string
  priority?: string
}): Promise<SupportTicket | null> {
  const raw = await apiClient.post<unknown>(
    '/support/tickets',
    {
      categoryCode: input.categoryCode,
      resourceRef: input.resourceRef?.trim() || undefined,
      descriptionFingerprint: await sha256Hex(input.description),
      priority: input.priority ?? 'NORMAL',
      attachments: [],
    },
    { headers: { 'Idempotency-Key': key() } },
  )
  const data = unwrap(raw)
  const ticket = isRecord(data) && 'ticket' in data ? ticketOf(data.ticket) : ticketOf(data)
  return ticket
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

export async function reopenSupportTicket(ticketId: string): Promise<SupportTicket | null> {
  const prepared = unwrap(
    await apiClient.post<unknown>(
      `/support/tickets/${encodeURIComponent(ticketId)}/transitions/prepare`,
      'REOPEN',
      { headers: { 'Idempotency-Key': key() } },
    ),
  )
  const token = isRecord(prepared) && typeof prepared.token === 'string' ? prepared.token : null
  const raw = await apiClient.post<unknown>(
    `/support/tickets/${encodeURIComponent(ticketId)}/transitions`,
    'REOPEN',
    {
      headers: {
        'Idempotency-Key': key(),
        ...(token ? { 'X-Confirmation-Token': token } : {}),
      },
    },
  )
  const data = unwrap(raw)
  return isRecord(data) && 'ticket' in data ? ticketOf(data.ticket) : ticketOf(data)
}
