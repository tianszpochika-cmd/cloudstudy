import { adminClient } from './client'
import { createClientId } from '../platform/client-id'

/** P1R decision 1A: recovery console reads/writes (M6-009). */

export interface RecoveryView {
  recoveryId: string
  status: string | null
  requestedBy: string | null
  approvedBy: string | null
  subjectType: string | null
  subjectId: string | null
  action: string | null
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

function viewOf(value: unknown): RecoveryView | null {
  const source = unwrap(value)
  if (!isRecord(source)) return null
  const recoveryId = text(source.recoveryId)
  if (!recoveryId) return null
  return {
    recoveryId,
    status: typeof source.status === 'string' ? source.status : null,
    requestedBy: typeof source.requestedBy === 'string' ? source.requestedBy : null,
    approvedBy: typeof source.approvedBy === 'string' ? source.approvedBy : null,
    subjectType: typeof source.subjectType === 'string' ? source.subjectType : null,
    subjectId: typeof source.subjectId === 'string' ? source.subjectId : null,
    action: typeof source.action === 'string' ? source.action : null,
  }
}

function key(suffix: string): Record<string, string> {
  return { 'Idempotency-Key': createClientId(`recovery-${suffix}`) }
}

export async function requestRecovery(input: {
  subjectType: string
  subjectId: string
  action: string
  reason: string
}): Promise<RecoveryView | null> {
  const raw = await adminClient.request('/admin/recovery/recoveries', {
    method: 'POST',
    body: input,
    headers: key('request'),
  })
  return viewOf(raw)
}

export async function approveRecovery(recoveryId: string): Promise<RecoveryView | null> {
  const raw = await adminClient.request(
    `/admin/recovery/recoveries/${encodeURIComponent(recoveryId)}/approve`,
    { method: 'POST', body: {}, headers: key('approve') },
  )
  return viewOf(raw)
}

export async function rejectRecovery(recoveryId: string, reason: string): Promise<RecoveryView | null> {
  const raw = await adminClient.request(
    `/admin/recovery/recoveries/${encodeURIComponent(recoveryId)}/reject`,
    { method: 'POST', body: { reason }, headers: key('reject') },
  )
  return viewOf(raw)
}

export async function executeRecovery(recoveryId: string): Promise<RecoveryView | null> {
  const raw = await adminClient.request(
    `/admin/recovery/recoveries/${encodeURIComponent(recoveryId)}/execute`,
    { method: 'POST', body: {}, headers: key('execute') },
  )
  return viewOf(raw)
}

export async function listUnfinishedSagas(): Promise<string[]> {
  const raw = await adminClient.request('/admin/recovery/sagas/unfinished')
  const data = unwrap(raw)
  return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []
}
