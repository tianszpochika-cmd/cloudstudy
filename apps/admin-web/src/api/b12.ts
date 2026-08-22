import { adminClient } from './client'
import { createClientId } from '../platform/client-id'

export const B12_ADMIN_PATHS = {
  moderationReports: '/admin/moderation/reports',
  moderationCommands: (reportId: string) => `/admin/moderation/reports/${encodeURIComponent(reportId)}/commands`,
  recoveryTasks: '/admin/recovery/tasks',
  recoveryCommands: (taskId: string) => `/admin/recovery/tasks/${encodeURIComponent(taskId)}/commands`,
} as const

function idempotencyKey(prefix: string): string {
  return createClientId(prefix)
}

function commandOptions(commandCode: string): { method: 'POST'; body: { commandCode: string }; headers: { 'Idempotency-Key': string } } {
  return { method: 'POST', body: { commandCode }, headers: { 'Idempotency-Key': idempotencyKey(`b12-admin-${commandCode.toLowerCase()}`) } }
}

export async function listB12ModerationReports(status = 'OPEN'): Promise<unknown> {
  return adminClient.request(`${B12_ADMIN_PATHS.moderationReports}?status=${encodeURIComponent(status)}`)
}

export async function runB12ModerationCommand(reportId: string, commandCode: string): Promise<unknown> {
  return adminClient.request(B12_ADMIN_PATHS.moderationCommands(reportId), commandOptions(commandCode))
}

export async function listB12RecoveryTasks(status = 'PENDING'): Promise<unknown> {
  return adminClient.request(`${B12_ADMIN_PATHS.recoveryTasks}?status=${encodeURIComponent(status)}`)
}

export async function runB12RecoveryCommand(taskId: string, commandCode: string): Promise<unknown> {
  return adminClient.request(B12_ADMIN_PATHS.recoveryCommands(taskId), commandOptions(commandCode))
}
