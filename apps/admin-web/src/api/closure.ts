import { adminClient } from './client'
import type { ClosureBoard } from '../domain/it7-closure'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readClosureBoard(): Promise<ClosureBoard | null> {
  const raw = await adminClient.request<unknown>('/support/tickets?projection=it7')
  if (!record(raw) || !record(raw.data)) return null
  return raw.data as ClosureBoard
}

export async function postClosure(command: string, input: Record<string, unknown> = {}): Promise<ClosureBoard | null> {
  const raw = await adminClient.request<unknown>('/admin/ops/commands', {
    method: 'POST',
    body: { closureCommand: command, closureInput: input },
    headers: { 'Idempotency-Key': `it7-${command}-${Date.now()}` },
  })
  if (!record(raw)) return null
  return (record(raw.data) ? raw.data : raw) as ClosureBoard
}
