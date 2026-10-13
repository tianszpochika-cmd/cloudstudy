import { AdminApiError } from '../api/client'

/**
 * Content-ops R2 shared review helpers: server error codes → plain Chinese
 * explanations, and the reviewTrail read model (who submitted, last verdict,
 * reason, live-revision flag). The server is the authority; these helpers
 * only explain its decisions.
 */

export class ContentCommandError extends Error {
  readonly code: string | null
  readonly status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.name = 'ContentCommandError'
    this.code = code
    this.status = status
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function errorCodeOf(details: unknown): string | null {
  const envelope = record(details) && record(details.error) ? details.error : details
  return record(envelope) && typeof envelope.code === 'string' ? envelope.code : null
}

const EXPLAIN: Array<[RegExp, string]> = [
  [/_SELF_APPROVAL_DENIED$|^FOUR_EYES_REQUIRED$/, '你是这次提交的作者，不能审核自己的提交。请换一位审核员处理。'],
  [/_SELF_REVIEW_DENIED$|^DUAL_REVIEW_REQUIRED$/, '一审和二审必须由两个不同的账号完成。'],
  [/VERSION_CONFLICT$/, '保存失败：这条内容在你打开之后已被其他人修改。请重新加载最新版本后再改。'],
  [/_REJECT_REASON_REQUIRED$/, '退回必须填写原因，作者会看到这条说明。'],
  [/_REJECT_REASON_INVALID$/, '退回原因最多 500 个字。'],
  [/_REVIEW_ORDER_INVALID$/, '需要先完成一审，才能进行二审。'],
  [/_REVIEW_DUPLICATE$/, '一审已经完成，不能重复审核。'],
  [/_REVISION_LIVE$/, '这是线上内容的修订稿，学员仍能看到旧版。请先下线旧版再归档。'],
  [/^LEXEME_DUPLICATE$/, '同一词包里已经有这个单词，请在列表里打开它编辑。'],
  [/_STATE_INVALID$/, '当前状态不允许这个操作（例如审核中的内容不能编辑），请刷新后再试。'],
]

export function explainContentError(error: unknown, fallback = '操作失败。'): string {
  if (error instanceof ContentCommandError && error.code) {
    const hit = EXPLAIN.find(([pattern]) => pattern.test(error.code as string))
    if (hit) return hit[1]
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof ContentCommandError && error.status === 409 && /VERSION_CONFLICT$/.test(error.code ?? '')
}

/** Normalises transport errors into ContentCommandError so views can branch on code/status. */
export function toContentCommandError(error: unknown, fallback: string): Error {
  if (error instanceof AdminApiError) return new ContentCommandError(error.message, errorCodeOf(error.details), error.status)
  return error instanceof Error ? error : new Error(fallback)
}

export interface ReviewTrailView {
  submittedBy: string | null
  lastDecision: string | null
  lastNote: string | null
  lastReviewer: string | null
  lastReviewedAt: string | null
  revisionOfLive: boolean
}

export function readReviewTrail(raw: unknown): ReviewTrailView {
  const value = record(raw) ? raw : {}
  const str = (key: string): string | null => (typeof value[key] === 'string' && (value[key] as string).trim() ? (value[key] as string) : null)
  return {
    submittedBy: str('submittedBy'),
    lastDecision: str('lastDecision'),
    lastNote: str('lastNote'),
    lastReviewer: str('lastReviewer'),
    lastReviewedAt: str('lastReviewedAt'),
    revisionOfLive: value.revisionOfLive === true,
  }
}

export function isRejection(trail: ReviewTrailView): boolean {
  return /^(REJECTED|CHANGES_REQUESTED)_/.test(trail.lastDecision ?? '')
}

export function decisionLabel(decision: string | null): string {
  switch (decision) {
    case 'APPROVED_FIRST': return '一审通过'
    case 'APPROVED_FINAL': return '二审通过'
    case 'REJECTED_FIRST': return '一审驳回'
    case 'REJECTED_FINAL': return '二审驳回'
    case 'CHANGES_REQUESTED_FIRST': return '一审要求修改'
    case 'CHANGES_REQUESTED_FINAL': return '二审要求修改'
    default: return ''
  }
}

/** True when the signed-in subject submitted the row and therefore cannot review it (server enforces too). */
export function isOwnSubmission(trail: ReviewTrailView, subject: string | null | undefined): boolean {
  return Boolean(subject && trail.submittedBy && trail.submittedBy === subject.trim())
}
