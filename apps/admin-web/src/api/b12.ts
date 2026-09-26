import { adminClient } from './client'
import { createClientId } from '../platform/client-id'

export interface B12ModerationReportPage {
  items: Record<string, unknown>[]
  nextCursor: string | null
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseB12ModerationReportPage(response: unknown): B12ModerationReportPage {
  if (!record(response) || !record(response.data) || !record(response.meta)
    || !Array.isArray(response.data.items) || !response.data.items.every(record)
    || typeof response.meta.hasMore !== 'boolean') {
    throw new Error('B12_REPORT_PAGE_INVALID')
  }
  const cursor = response.meta.nextCursor
  if (response.meta.hasMore
    ? typeof cursor !== 'string' || !cursor.trim() || !response.data.items.length
    : cursor != null) {
    throw new Error('B12_REPORT_PAGE_INVALID')
  }
  return {
    items: response.data.items,
    nextCursor: response.meta.hasMore ? cursor as string : null,
  }
}

export const B12_ADMIN_PATHS = {
  moderationReports: '/admin/moderation/reports',
  moderationCommands: (reportId: string) => `/admin/moderation/reports/${encodeURIComponent(reportId)}/commands`,
  recoveryTasks: '/admin/recovery/tasks',
  recoveryCommands: (taskId: string) => `/admin/recovery/tasks/${encodeURIComponent(taskId)}/commands`,
} as const

function idempotencyKey(prefix: string): string {
  return createClientId(prefix)
}

function moderationCommandOptions(commandCode: string): { method: 'POST'; body: { commandCode: string }; headers: { 'Idempotency-Key': string } } {
  return { method: 'POST', body: { commandCode }, headers: { 'Idempotency-Key': idempotencyKey(`b12-admin-${commandCode.toLowerCase()}`) } }
}

function recoveryCommandOptions(action: string): { method: 'POST'; body: { action: string }; headers: { 'Idempotency-Key': string } } {
  return { method: 'POST', body: { action }, headers: { 'Idempotency-Key': idempotencyKey(`b12-admin-${action.toLowerCase()}`) } }
}

export async function listB12ModerationReports(status = 'OPEN', cursor?: string): Promise<B12ModerationReportPage> {
  const path = `${B12_ADMIN_PATHS.moderationReports}?status=${encodeURIComponent(status)}`
    + (cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`)
  return parseB12ModerationReportPage(await adminClient.request<unknown>(path))
}

export async function runB12ModerationCommand(reportId: string, commandCode: string): Promise<unknown> {
  return adminClient.request(B12_ADMIN_PATHS.moderationCommands(reportId), moderationCommandOptions(commandCode))
}

export async function listB12RecoveryTasks(status = 'PENDING'): Promise<unknown> {
  return adminClient.request(`${B12_ADMIN_PATHS.recoveryTasks}?status=${encodeURIComponent(status)}`)
}

export async function runB12RecoveryCommand(taskId: string, commandCode: string): Promise<unknown> {
  return adminClient.request(B12_ADMIN_PATHS.recoveryCommands(taskId), recoveryCommandOptions(commandCode))
}
