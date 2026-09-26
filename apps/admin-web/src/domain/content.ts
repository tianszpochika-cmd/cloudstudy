export const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'REJECTED',
  'ROLLBACK_PENDING',
  'CONFLICT',
] as const

export type ContentStatus = (typeof CONTENT_STATUSES)[number]
export type ReviewStage = 'FIRST' | 'FINAL'
export type ReviewDecision = 'APPROVED' | 'REJECTED'

export interface ContentDraftCommand {
  readonly contentCode: string
  readonly contentType: string
  readonly title: string
  readonly contentHash: string
  readonly sourceCode: string
  readonly licenseCode: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface ContentDraftSaveCommand {
  readonly baseVersionId?: string
  readonly baseStateVersion?: string
  readonly title: string
  readonly contentHash: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface ContentRollbackCommand {
  readonly targetVersionId: string
  readonly baseStateVersion?: string
  readonly reason: string
}

export interface ContentSnapshot {
  readonly contentId: string
  readonly contentCode: string
  readonly versionId: string
  readonly title: string
  readonly status: ContentStatus
  readonly stateVersion: string
  readonly authorSubject: string | null
  readonly publishedVersionId: string | null
  readonly updatedAt: string | null
  /** Content owner decision for this exact latest version; absent means closed. */
  readonly reviewSubmissionReady: boolean
}

export interface ReviewTaskProjection {
  readonly reviewTaskId: string
  readonly contentId: string
  readonly versionId: string
  readonly stage: ReviewStage
  readonly requiredPermission: 'admin.content.review.l1' | 'admin.content.review.l2'
  readonly status: string
  readonly authorSubject: string | null
  readonly reviewerSubject: string | null
}

export interface ContentWorkspaceProjection {
  readonly contents: readonly ContentSnapshot[]
  readonly reviewTasks: readonly ReviewTaskProjection[]
  readonly requestId: string | null
}

export interface ContentCommandReceipt {
  readonly requestId: string | null
  readonly content: ContentSnapshot | null
  readonly status: string | null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function unwrap(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}
  if (isRecord(value.data)) return value.data
  if (isRecord(value.result)) return value.result
  return value
}

function status(value: unknown): ContentStatus {
  const candidate = text(value).toUpperCase() as ContentStatus
  return CONTENT_STATUSES.includes(candidate) ? candidate : 'DRAFT'
}

function stage(value: unknown): ReviewStage {
  return text(value).toUpperCase() === 'FINAL' ? 'FINAL' : 'FIRST'
}

export function requiredReviewPermission(reviewStage: ReviewStage): ReviewTaskProjection['requiredPermission'] {
  return reviewStage === 'FINAL' ? 'admin.content.review.l2' : 'admin.content.review.l1'
}

export function toContentSnapshot(value: unknown): ContentSnapshot | null {
  const source = unwrap(value)
  const content = isRecord(source.content) ? source.content : source
  const contentId = text(content.contentId ?? content.id)
  if (!contentId) return null
  return {
    contentId,
    contentCode: text(content.contentCode),
    versionId: text(content.versionId ?? content.contentVersionId),
    title: text(content.title),
    status: status(content.status),
    stateVersion: text(content.stateVersion ?? content.version ?? content.cacheEpoch),
    authorSubject: nullableText(content.authorSubject ?? content.createdBySubject ?? content.ownerSubject),
    publishedVersionId: nullableText(content.publishedVersionId),
    updatedAt: nullableText(content.updatedAt),
    reviewSubmissionReady: content.reviewSubmissionReady === true,
  }
}

export function toReviewTask(value: unknown): ReviewTaskProjection | null {
  const source = unwrap(value)
  const task = isRecord(source.task) ? source.task : source
  const reviewTaskId = text(task.reviewTaskId ?? task.id)
  if (!reviewTaskId) return null
  const reviewStage = stage(task.stage)
  return {
    reviewTaskId,
    contentId: text(task.contentId),
    versionId: text(task.versionId ?? task.contentVersionId),
    stage: reviewStage,
    requiredPermission: requiredReviewPermission(reviewStage),
    status: text(task.status, 'PENDING').toUpperCase(),
    authorSubject: nullableText(task.authorSubject ?? task.createdBySubject ?? task.ownerSubject),
    reviewerSubject: nullableText(task.reviewerSubject ?? task.decidedBySubject),
  }
}

function listFrom(value: unknown, key: string): unknown[] {
  const source = unwrap(value)
  return Array.isArray(source[key]) ? source[key] : []
}

export function toContentList(value: unknown): ContentSnapshot[] {
  return listFrom(value, 'contents').map(toContentSnapshot).filter((item): item is ContentSnapshot => item !== null)
}

export function toReviewTaskList(value: unknown): ReviewTaskProjection[] {
  return listFrom(value, 'items').map(toReviewTask).filter((item): item is ReviewTaskProjection => item !== null)
}

export function toRequestId(value: unknown): string | null {
  const source = isRecord(value) ? value : {}
  const meta = isRecord(source.meta) ? source.meta : {}
  return nullableText(source.requestId ?? meta.requestId)
}

export function toCommandReceipt(value: unknown): ContentCommandReceipt {
  const source = unwrap(value)
  return {
    requestId: toRequestId(value),
    content: toContentSnapshot(source.content ?? source),
    status: nullableText(source.status),
  }
}
