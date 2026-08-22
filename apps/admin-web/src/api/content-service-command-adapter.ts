import { adminClient, AdminApiError, type AdminApiClient } from './client'
import { createClientId } from '../platform/client-id'
import {
  toRequestId,
  type ContentCommandReceipt,
  type ContentDraftCommand,
  type ContentDraftSaveCommand,
  type ContentRollbackCommand,
  type ContentSnapshot,
  type ContentWorkspaceProjection,
  type ReviewDecision,
  type ReviewStage,
  type ReviewTaskProjection,
} from '../domain/content'

/**
 * Stable frontend port for the B9 content-service command boundary.
 *
 * The browser talks only to Gateway/admin-ops. Every write is an intent command
 * with an optimistic state version; no page code knows content-service tables or
 * fabricates actor/tenant/role facts.
 */
export interface ContentServiceCommandPort {
  readonly target: 'content-service'
  getWorkspaceProjection(): Promise<ContentWorkspaceProjection>
  createDraft(command: ContentDraftCommand): Promise<ContentCommandReceipt>
  saveDraft(contentId: string, command: ContentDraftSaveCommand): Promise<ContentCommandReceipt>
  validateDraft(contentId: string): Promise<ContentCommandReceipt>
  submitReview(contentId: string): Promise<ContentCommandReceipt>
  decideReview(taskId: string, stage: ReviewStage, decision: ReviewDecision): Promise<ContentCommandReceipt>
  publish(contentId: string): Promise<ContentCommandReceipt>
  rollback(contentId: string, command: ContentRollbackCommand): Promise<ContentCommandReceipt>
}

export class ContentCommandError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  readonly requestId: string | null

  constructor(message: string, options: { code?: string; status?: number; retryable?: boolean; requestId?: string | null } = {}) {
    super(message)
    this.name = 'ContentCommandError'
    this.code = options.code ?? 'CONTENT_COMMAND_FAILED'
    this.status = options.status ?? 0
    this.retryable = options.retryable ?? false
    this.requestId = options.requestId ?? null
  }
}

type RecordValue = Record<string, unknown>
type B9AdminState = RecordValue
type B9Version = RecordValue

const CONTENT_STATE_LIST_PATH = '/admin/content-commands?limit=50'
const COMMAND_PATH = '/admin/content-commands'

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): RecordValue {
  if (!isRecord(value)) return {}
  if (isRecord(value.data)) return value.data
  if (isRecord(value.result)) return value.result
  return value
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function nullableText(value: unknown): string | null {
  const result = text(value)
  return result ? result : null
}

function integer(value: unknown, fallback = 0): number {
  const result = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isInteger(result) && result >= 0 ? result : fallback
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function latestVersion(state: B9AdminState): B9Version {
  return list(state.versions)
    .filter(isRecord)
    .sort((left, right) => integer(right.versionNumber) - integer(left.versionNumber))
    .at(0) ?? {}
}

function contentStatus(value: unknown): ContentSnapshot['status'] {
  const candidate = text(value).toUpperCase()
  if (candidate === 'IN_REVIEW' || candidate === 'APPROVED' || candidate === 'PUBLISHED' || candidate === 'ARCHIVED' || candidate === 'REJECTED' || candidate === 'ROLLBACK_PENDING' || candidate === 'CONFLICT') return candidate
  if (candidate === 'UNPUBLISHED' || candidate === 'ROLLED_BACK') return candidate === 'UNPUBLISHED' ? 'ARCHIVED' : 'ROLLBACK_PENDING'
  return 'DRAFT'
}

function toSnapshot(state: B9AdminState): ContentSnapshot | null {
  const contentCode = text(state.contentCode)
  if (!contentCode) return null
  const versions = list(state.versions).filter(isRecord)
  const publishedVersions = versions.filter((version) => ['PUBLISHED', 'UNPUBLISHED', 'ROLLED_BACK'].includes(text(version.status).toUpperCase()))
  const previousPublished = publishedVersions
    .sort((left, right) => integer(right.versionNumber) - integer(left.versionNumber))
    .at(1)
  const latest = latestVersion(state)
  return {
    contentId: contentCode,
    contentCode,
    versionId: text(latest.contentVersionId ?? latest.versionNumber),
    title: text(state.title, contentCode),
    status: contentStatus(state.latestStatus),
    stateVersion: text(state.stateVersion, '1'),
    authorSubject: nullableText(state.authorSubject),
    publishedVersionId: nullableText(previousPublished?.contentVersionId ?? previousPublished?.versionNumber),
    updatedAt: nullableText(latest.publishedAt),
  }
}

function reviewTasks(state: B9AdminState, contexts: Map<string, { contentCode: string; expectedStateVersion: number; targetVersionNumber: number }>): ReviewTaskProjection[] {
  const contentCode = text(state.contentCode)
  const latest = latestVersion(state)
  const versionId = text(latest.contentVersionId ?? latest.versionNumber, '1')
  const targetVersionNumber = integer(latest.versionNumber, 1)
  const expectedStateVersion = integer(state.stateVersion, 1)
  return list(state.reviewStages).flatMap((rawStage): ReviewTaskProjection[] => {
    const stageValue = text(rawStage).toUpperCase()
    const stage: ReviewStage | null = stageValue.startsWith('FIRST') ? 'FIRST' : stageValue.startsWith('FINAL') ? 'FINAL' : null
    if (!stage) return []
    const reviewTaskId = `b9-review:${encodeURIComponent(contentCode)}:${encodeURIComponent(versionId)}:${stage}`
    contexts.set(reviewTaskId, { contentCode, expectedStateVersion, targetVersionNumber })
    return [{
      reviewTaskId,
      contentId: contentCode,
      versionId,
      stage,
      requiredPermission: stage === 'FINAL' ? 'admin.content.review.l2' : 'admin.content.review.l1',
      status: stageValue.endsWith('APPROVED') ? 'APPROVED' : stageValue === 'REJECTED' ? 'REJECTED' : 'PENDING',
      authorSubject: nullableText(state.authorSubject),
      reviewerSubject: null,
    }]
  })
}

function stateList(value: unknown): B9AdminState[] {
  const source = unwrap(value)
  const items = list(source.items)
  if (items.length) return items.filter(isRecord)
  return source.contentCode ? [source] : []
}

function idempotencyKey(prefix: string): string {
  const value = createClientId()
  return `${prefix}-${value}`
}

function toCommandError(error: unknown): ContentCommandError {
  if (error instanceof ContentCommandError) return error
  if (error instanceof AdminApiError) {
    const details = isRecord(error.details) ? error.details : {}
    const nested = isRecord(details.error) ? details.error : {}
    const code = typeof nested.errorCode === 'string' ? nested.errorCode : error.status === 403 ? 'FORBIDDEN' : error.status === 409 ? 'CONTENT_CONFLICT' : 'CONTENT_COMMAND_FAILED'
    return new ContentCommandError(error.message, {
      code,
      status: error.status,
      retryable: error.status === 408 || error.status === 429 || error.status >= 500,
      requestId: toRequestId(error.details),
    })
  }
  return new ContentCommandError(error instanceof Error ? error.message : '内容服务暂时不可用。', { code: 'NETWORK_OR_SERVICE_FAILURE', retryable: true })
}

function expectedStateVersion(value: string | undefined, fallback = 0): number {
  const parsed = value === undefined ? fallback : integer(value, -1)
  if (parsed < 0) throw new ContentCommandError('缺少有效的服务端状态版本，请刷新内容投影后重试。', { code: 'CONTENT_STATE_VERSION_REQUIRED', status: 409, retryable: true })
  return parsed
}

function requireSha256(value: string): string {
  if (!/^[a-f0-9]{64}$/i.test(value.trim())) throw new ContentCommandError('内容 hash 必须是 64 位 SHA-256；不会由前端伪造版权事实。', { code: 'CONTENT_HASH_INVALID', status: 400 })
  return value.trim().toLowerCase()
}

function contentType(value: string): string {
  const candidate = value.trim().toUpperCase() === 'UNIT' ? 'COURSE_UNIT' : value.trim().toUpperCase()
  return ['COURSE', 'COURSE_UNIT', 'VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'QUESTION'].includes(candidate) ? candidate : 'COURSE_UNIT'
}

function itemType(value: string): string {
  const candidate = contentType(value)
  return ['VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'QUESTION'].includes(candidate) ? candidate : 'PHRASE'
}

function draftInput(command: ContentDraftCommand): RecordValue {
  const payload = isRecord(command.payload) ? command.payload : {}
  const rawItems = list(payload.items).filter(isRecord)
  const items = rawItems.length ? rawItems : [{
    itemCode: `${command.contentCode}:item-1`,
    itemType: itemType(command.contentType),
    displayOrder: 0,
    stimulusRef: `content:${command.contentCode}:item-1`,
    definition: payload,
  }]
  return {
    contentType: contentType(command.contentType),
    title: command.title.trim(),
    contentLocale: 'en-US',
    targetLevel: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(text(payload.targetLevel)) ? text(payload.targetLevel) : 'A1',
    sourceCode: command.sourceCode.trim(),
    licenseCode: command.licenseCode.trim(),
    contentHash: requireSha256(command.contentHash),
    items,
  }
}

function acceptedReceipt(value: unknown): ContentCommandReceipt {
  const source = unwrap(value)
  return { requestId: toRequestId(value), content: null, status: nullableText(source.status) }
}

export function createContentServiceCommandAdapter(options: { readonly client: AdminApiClient } = { client: adminClient }): ContentServiceCommandPort {
  const stateByCode = new Map<string, B9AdminState>()
  const reviewContexts = new Map<string, { contentCode: string; expectedStateVersion: number; targetVersionNumber: number }>()

  async function request(path: string, method: 'GET' | 'POST', body: unknown, key: string): Promise<unknown> {
    try {
      return await options.client.request(path, {
        method,
        ...(body === undefined ? {} : { body }),
        ...(method === 'POST' ? { headers: { 'Idempotency-Key': idempotencyKey(key) } } : {}),
      })
    } catch (error) {
      throw toCommandError(error)
    }
  }

  async function command(body: RecordValue, key: string): Promise<ContentCommandReceipt> {
    return acceptedReceipt(await request(COMMAND_PATH, 'POST', body, key))
  }

  function stateFor(contentId: string): B9AdminState {
    const state = stateByCode.get(contentId)
    if (!state) throw new ContentCommandError('内容投影已过期，请刷新后重试。', { code: 'CONTENT_STATE_STALE', status: 409, retryable: true })
    return state
  }

  return {
    target: 'content-service',
    async getWorkspaceProjection() {
      const response = await request(CONTENT_STATE_LIST_PATH, 'GET', undefined, 'content-state-read')
      const states = stateList(response)
      stateByCode.clear()
      reviewContexts.clear()
      states.forEach((state) => { const code = text(state.contentCode); if (code) stateByCode.set(code, state) })
      return {
        contents: states.map(toSnapshot).filter((item): item is ContentSnapshot => item !== null),
        reviewTasks: states.flatMap((state) => reviewTasks(state, reviewContexts)),
        requestId: toRequestId(response),
      }
    },
    async createDraft(input) {
      return command({ command: 'CREATE_DRAFT', contentCode: input.contentCode.trim(), expectedStateVersion: 0, content: draftInput(input) }, 'content-create')
    },
    async saveDraft(contentId, input) {
      const state = stateFor(contentId)
      const latest = latestVersion(state)
      const sourceCode = text(latest.sourceCode)
      const licenseCode = text(latest.licenseCode)
      if (!sourceCode || !licenseCode) throw new ContentCommandError('当前投影缺少版权来源，不能在前端补写或伪造；请回到内容导入流程。', { code: 'CONTENT_RIGHTS_CONTEXT_REQUIRED', status: 409, retryable: false })
      return command({
        command: 'SAVE_DRAFT',
        contentCode: contentId,
        expectedStateVersion: expectedStateVersion(input.baseStateVersion, integer(state.stateVersion, 1)),
        targetVersionNumber: integer(latest.versionNumber, 1),
        content: draftInput({ ...input, contentCode: contentId, contentType: text(state.contentType, 'COURSE_UNIT'), sourceCode, licenseCode }),
      }, `content-save-${contentId}`)
    },
    async validateDraft(contentId) {
      const state = stateFor(contentId)
      const latest = latestVersion(state)
      return command({ command: 'VALIDATE_DRAFT', contentCode: contentId, expectedStateVersion: integer(state.stateVersion, 1), targetVersionNumber: integer(latest.versionNumber, 1) }, `content-validate-${contentId}`)
    },
    async submitReview(contentId) {
      const state = stateFor(contentId)
      const latest = latestVersion(state)
      return command({ command: 'SUBMIT_REVIEW', contentCode: contentId, expectedStateVersion: integer(state.stateVersion, 1), targetVersionNumber: integer(latest.versionNumber, 1) }, `content-submit-${contentId}`)
    },
    async decideReview(taskId, stage, decision) {
      const context = reviewContexts.get(taskId)
      if (!context) throw new ContentCommandError('审核任务投影已过期，请刷新后重试。', { code: 'REVIEW_TASK_STALE', status: 409, retryable: true })
      return command({ command: stage === 'FINAL' ? 'REVIEW_FINAL' : 'REVIEW_FIRST', contentCode: context.contentCode, expectedStateVersion: context.expectedStateVersion, targetVersionNumber: context.targetVersionNumber, reviewDecision: decision }, `review-${taskId}`)
    },
    async publish(contentId) {
      const state = stateFor(contentId)
      const latest = latestVersion(state)
      return command({ command: 'PUBLISH', contentCode: contentId, expectedStateVersion: integer(state.stateVersion, 1), targetVersionNumber: integer(latest.versionNumber, 1) }, `content-publish-${contentId}`)
    },
    async rollback(contentId, input) {
      const state = stateFor(contentId)
      const targetVersionNumber = integer(input.targetVersionId, -1)
      if (targetVersionNumber < 1) throw new ContentCommandError('回滚目标必须是服务端返回的数字版本号。', { code: 'ROLLBACK_TARGET_INVALID', status: 400 })
      return command({ command: 'ROLLBACK', contentCode: contentId, expectedStateVersion: expectedStateVersion(input.baseStateVersion, integer(state.stateVersion, 1)), targetVersionNumber, reasonCode: input.reason.trim() }, `content-rollback-${contentId}`)
    },
  }
}

export const contentServiceCommandAdapter = createContentServiceCommandAdapter()
