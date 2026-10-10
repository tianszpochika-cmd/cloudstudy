import { mobileApiClient } from './client'
import type { ClosureBoard } from '../domain/it7-closure'

export interface MobileSupportTicket {
  ticketId: string
  categoryCode: string
  state: string
  priority: string
  slaState: string | null
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

export async function readMobileClosureBoard(): Promise<ClosureBoard | null> {
  const raw = await mobileApiClient.request<unknown>('/support/tickets?projection=it7')
  const data = unwrap(raw)
  return isRecord(data) ? data as ClosureBoard : null
}

export async function loadMobileSupportDesk(): Promise<{ tickets: MobileSupportTicket[]; board: ClosureBoard | null }> {
  const raw = await mobileApiClient.request<unknown>('/support/tickets')
  const data = unwrap(raw)
  const items = isRecord(data) && Array.isArray(data.items) ? data.items : []
  const tickets = items.flatMap((item) => {
    const ticket = ticketOf(item)
    return ticket ? [ticket] : []
  })
  const board = isRecord(data) && (typeof data.ticketCopy === 'string' || typeof data.supportNumber === 'string')
    ? data as ClosureBoard
    : null
  return { tickets, board }
}

export async function listMobileSupportTickets(): Promise<MobileSupportTicket[]> {
  return (await loadMobileSupportDesk()).tickets
}
