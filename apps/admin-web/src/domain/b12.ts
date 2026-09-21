import { adminT } from '../platform/admin-i18n'

export const B12_MODERATION_COMMANDS = ['START_REVIEW', 'RESOLVE', 'DISMISS', 'ESCALATE'] as const
export type B12ModerationCommand = (typeof B12_MODERATION_COMMANDS)[number]
export const B12_RECOVERY_COMMANDS = ['RETRY', 'REPLAY', 'CANCEL', 'MANUAL_REVIEW'] as const
export type B12RecoveryCommand = (typeof B12_RECOVERY_COMMANDS)[number]

export type B12AdminViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'permission' | 'recovery' | 'error' | 'success'

export interface B12ModerationReport {
  reportId: string
  status: string
  reasonCode: string
  reviewMode: string
  targetRef: string
  roomRef: string | null
  createdAt: string | null
}

export interface B12RecoveryTask {
  taskId: string
  domain: string
  status: string
  reasonCode: string
  updatedAt: string | null
  retryable: boolean
}

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function unwrapB12(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }
function firstText(source: Record<string, unknown>, keys: string[], fallback: string): string { for (const key of keys) { const value = text(source[key]); if (value) return value } return fallback }
export function recordList(value: unknown): Array<Record<string, unknown>> {
  const source = unwrapB12(value)
  if (Array.isArray(source)) return source.filter(isRecord)
  if (!isRecord(source)) return []
  return Array.isArray(source.items) ? source.items.filter(isRecord) : []
}

export function parseModerationReport(value: Record<string, unknown>): B12ModerationReport | null {
  const reportId = text(value.reportId)
  if (!reportId) return null
  return { reportId, status: firstText(value, ['status', 'reviewStatus'], 'UNKNOWN'), reasonCode: firstText(value, ['reasonCode', 'reason'], 'UNKNOWN'), reviewMode: firstText(value, ['reviewMode', 'handlingMode'], 'MANUAL'), targetRef: firstText(value, ['targetPublicRef', 'targetRef', 'targetDisplay'], adminT('domainB12.maskedTargetRef')), roomRef: text(value.roomPublicRef) ?? text(value.roomRef), createdAt: text(value.createdAt) ?? text(value.updatedAt) }
}

export function parseRecoveryTask(value: Record<string, unknown>): B12RecoveryTask | null {
  const taskId = text(value.taskId)
  if (!taskId) return null
  return { taskId, domain: firstText(value, ['domain', 'serviceCode'], 'UNKNOWN'), status: firstText(value, ['status', 'taskStatus'], 'UNKNOWN'), reasonCode: firstText(value, ['reasonCode', 'failureCode'], 'UNKNOWN'), updatedAt: text(value.updatedAt) ?? text(value.createdAt), retryable: value.retryable === true }
}

export function responseRequestId(value: unknown): string | null { const source = unwrapB12(value); return isRecord(source) ? text(source.requestId) ?? text(source.correlationId) : null }
