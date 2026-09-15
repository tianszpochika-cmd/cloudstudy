import { mobileApiClient } from './client'

export interface MobileSupportTicket {
  ticketId: string
  categoryCode: string
  state: string
  priority: string
  slaState: string | null
}

export const MOBILE_SUPPORT_CATEGORIES = [
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

function ticketOf(value: unknown): MobileSupportTicket | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const ticketId = text(source.ticketId)
  if (!ticketId) return null
  return {
    ticketId,
    categoryCode: text(source.categoryCode, 'TECHNICAL'),
    state: text(source.state, 'OPEN'),
    priority: text(source.priority, 'NORMAL'),
    slaState: typeof source.slaState === 'string' ? source.slaState : null,
  }
}

function idempotencyKey(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}`
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function listMobileSupportTickets(): Promise<MobileSupportTicket[]> {
  const raw = await mobileApiClient.request<unknown>('/support/tickets')
  const data = unwrap(raw)
  const items = isRecord(data) && Array.isArray(data.items) ? data.items : []
  return items.flatMap((item) => {
    const ticket = ticketOf(item)
    return ticket ? [ticket] : []
  })
}

export async function createMobileSupportTicket(input: {
  categoryCode: string
  resourceRef?: string
  description: string
}): Promise<MobileSupportTicket | null> {
  const raw = await mobileApiClient.request<unknown>('/support/tickets', {
    method: 'POST',
    data: {
      categoryCode: input.categoryCode,
      resourceRef: input.resourceRef?.trim() || undefined,
      descriptionFingerprint: await sha256Hex(input.description),
      priority: 'NORMAL',
      attachments: [],
    },
    header: { 'Idempotency-Key': idempotencyKey('support') },
  })
  const data = unwrap(raw)
  return isRecord(data) && 'ticket' in data ? ticketOf(data.ticket) : ticketOf(data)
}
