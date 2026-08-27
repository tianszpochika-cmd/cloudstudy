import { adminClient } from './client'
import { createClientId } from '../platform/client-id'

export interface B18SupportCommand {
  resourceRef: string
  action: 'SUPPORT_RESOLVE' | 'SUPPORT_ESCALATE'
  reasonCode: string
}

export async function listB18SupportTickets(): Promise<unknown> {
  return adminClient.request('/admin/ops/tickets?limit=50&includeAll=true')
}

export async function executeB18SupportCommand(command: B18SupportCommand, confirmationToken?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'Idempotency-Key': createClientId(`b18-support-${command.resourceRef}`) }
  if (confirmationToken) headers['X-Confirmation-Token'] = confirmationToken
  return adminClient.request('/admin/ops/commands', {
    method: 'POST',
    body: {
      aggregateType: 'SUPPORT',
      aggregateRef: command.resourceRef,
      actionCode: command.action,
      reasonCode: command.reasonCode,
    },
    headers,
  })
}
