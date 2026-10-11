export class ConsentHttpError extends Error {
  readonly status: number

  constructor(status: number, message = '请求没有完成') {
    super(message)
    this.name = 'ConsentHttpError'
    this.status = status
  }
}

export const WITHDRAW_BUTTON_LABEL = '撤回学习同意'
export const WITHDRAW_CONFIRM_COPY = '确认撤回后，学习能力会收回。账号仍会保留。'
export const WITHDRAW_DONE_COPY = '学习同意已撤回。学习能力已收回，账号仍保留。'
export const WITHDRAW_FAILED_COPY = '撤回没有完成。学习同意仍在。'

export type ConsentRequest = (path: string, init: {
  method: 'GET' | 'PUT'
  body?: unknown
  idempotencyKey?: string
}) => Promise<unknown>

export interface LearningConsentWithdrawalResult {
  withdrawn: boolean
  targetsStatus: number | null
  notice: string
  version: string
}

export function adultLearningWithdrawalBody(version: string): { type: 'ADULT_LEARNING'; version: string; decision: 'WITHDRAWN' } {
  return { type: 'ADULT_LEARNING', version, decision: 'WITHDRAWN' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Published document version from principal/me, otherwise the Phase 1 candidate version. */
export function consentDocumentVersion(payload: unknown): string {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload
  const record = isRecord(root) ? root : null
  const principal = record && isRecord(record.principal) ? record.principal : record
  const consent = record && isRecord(record.consentState)
    ? record.consentState
    : principal && isRecord(principal.consentState)
      ? principal.consentState
      : null
  const version = consent && typeof consent.version === 'string' ? consent.version.trim() : ''
  return version || 'b30-consent-v1'
}

export async function runLearningConsentWithdrawal(request: ConsentRequest, idempotencyKey: string): Promise<LearningConsentWithdrawalResult> {
  const me = await request('/iam/principal/me', { method: 'GET' })
  const version = consentDocumentVersion(me)
  try {
    await request('/iam/consents', {
      method: 'PUT',
      body: adultLearningWithdrawalBody(version),
      idempotencyKey,
    })
  } catch {
    return { withdrawn: false, targetsStatus: null, notice: WITHDRAW_FAILED_COPY, version }
  }
  try {
    await request('/learner/targets', { method: 'GET' })
    return { withdrawn: false, targetsStatus: 200, notice: WITHDRAW_FAILED_COPY, version }
  } catch (error) {
    const status = error instanceof ConsentHttpError ? error.status : null
    if (status === 403) return { withdrawn: true, targetsStatus: 403, notice: WITHDRAW_DONE_COPY, version }
    return { withdrawn: false, targetsStatus: status, notice: WITHDRAW_FAILED_COPY, version }
  }
}
