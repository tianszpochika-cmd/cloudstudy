export type EmptyReason = 'NO_PLAN' | 'NO_DUE_REVIEW' | 'COMPLETED' | 'READY' | 'NO_CONTENT'
export type FirstLearningReason = 'NO_PLAN' | 'NO_CONTENT' | 'INCOMPLETE' | 'COMPLETED'

export const ALGORITHM_VERSION = 'SM2_Q03_V1'
export const DEFERRED_COPY = '今天排不下，已顺延，这不是欠账。'
export const MINUTES_PER_ITEM = 5

export interface DueArrangement {
  itemId: string
  arrangement: 'DUE' | 'DEFERRED'
  arrangementCopy: string
}

export interface PlanTodayQueue {
  planId: string
  status: string
  planVersion: number
  targetMinutes: number
  emptyReason: EmptyReason | null
  explanation: string | null
  explanationPinVersion: number | null
  firstLearning: { guideVisible: boolean; reason: FirstLearningReason } | null
  itemCount: number
  algorithmVersion: string
  deferredCount: number
  arrangements: DueArrangement[]
}

export interface EmptyStateView {
  title: string
  description: string
  action: string
  to: 'onboarding' | 'courses' | 'home' | 'retry'
}

const EMPTY_REASONS: readonly EmptyReason[] = ['NO_PLAN', 'NO_DUE_REVIEW', 'COMPLETED', 'READY', 'NO_CONTENT']
const FIRST_REASONS: readonly FirstLearningReason[] = ['NO_PLAN', 'NO_CONTENT', 'INCOMPLETE', 'COMPLETED']

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  return record(value) && 'data' in value ? value.data : value
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function whole(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return null
}

export function ensureIdempotencyKey(reportId: string): string {
  return `plan-ensure-${reportId}`
}

export function replanIdempotencyKey(planVersion: number, clientEventId: string): string {
  return `plan-replan-${planVersion}-${clientEventId}`
}

/** Version written by plans:ensure. Today may still be loading; 0 means unknown. */
export function planVersionFromEnsure(value: unknown): number {
  const source = record(unwrap(value)) ? unwrap(value) as Record<string, unknown> : {}
  const nested = record(source.plan) ? source.plan : null
  return whole(source.planVersion) ?? whole(nested?.planVersion) ?? 0
}

/** A formal report id may ensure a plan. A skip baseline must not. */
export function shouldEnsurePlan(input: { reportId?: string | null; resultKind?: string | null } | null): boolean {
  const reportId = input?.reportId?.trim()
  if (!reportId) return false
  return input?.resultKind !== 'SKIPPED'
}

export function parsePlanTodayQueue(value: unknown): PlanTodayQueue {
  const source = record(unwrap(value)) ? unwrap(value) as Record<string, unknown> : {}
  const reason = text(source.emptyReason)
  const first = record(source.firstLearning) ? source.firstLearning : null
  const firstReason = text(first?.reason)
  const items = Array.isArray(source.items) ? source.items.length : whole(source.count) ?? 0
  return {
    planId: text(source.planId) ?? '',
    status: text(source.status) ?? '',
    planVersion: whole(source.planVersion) ?? 0,
    targetMinutes: whole(source.targetMinutes) ?? 0,
    emptyReason: reason && EMPTY_REASONS.includes(reason as EmptyReason) ? reason as EmptyReason : null,
    explanation: text(source.explanation),
    explanationPinVersion: whole(source.explanationPinVersion),
    firstLearning: first && firstReason && FIRST_REASONS.includes(firstReason as FirstLearningReason)
      ? { guideVisible: first.guideVisible === true, reason: firstReason as FirstLearningReason }
      : null,
    itemCount: items,
    algorithmVersion: text(source.algorithmVersion) ?? ALGORITHM_VERSION,
    deferredCount: whole(source.deferredCount) ?? 0,
    arrangements: parseArrangements(source.items, whole(source.targetMinutes) ?? 0),
  }
}

export function arrangeBudget(count: number, targetMinutes: number): Array<'DUE' | 'DEFERRED'> {
  const budget = Math.max(0, targetMinutes)
  const marks: Array<'DUE' | 'DEFERRED'> = []
  let used = 0
  for (let index = 0; index < count; index += 1) {
    if (used + MINUTES_PER_ITEM <= budget) {
      marks.push('DUE')
      used += MINUTES_PER_ITEM
    } else {
      marks.push('DEFERRED')
    }
  }
  return marks
}

export function arrangementLabel(arrangement: string, copy?: string | null): string {
  if (arrangement === 'DEFERRED') return copy?.trim() || DEFERRED_COPY
  if (arrangement === 'DUE') return '到期复习'
  return ''
}

function parseArrangements(value: unknown, targetMinutes: number): DueArrangement[] {
  if (!Array.isArray(value)) return []
  const fallback = arrangeBudget(value.length, targetMinutes)
  return value.flatMap((item, index) => {
    if (!record(item)) return []
    const itemId = text(item.itemId) ?? String(index + 1)
    const server = text(item.arrangement)
    const arrangement = server === 'DUE' || server === 'DEFERRED' ? server : fallback[index]
    return [{ itemId, arrangement, arrangementCopy: text(item.arrangementCopy) ?? (arrangement === 'DEFERRED' ? DEFERRED_COPY : '') }]
  })
}

export function emptyStateView(input: { failed: boolean; reason: EmptyReason | null; hasTasks: boolean }): EmptyStateView | null {
  if (input.failed) {
    return { title: '今日任务没有加载成功', description: '已提交的进度会保留。', action: '重试', to: 'retry' }
  }
  if (input.hasTasks || input.reason === 'READY') return null
  switch (input.reason) {
    case 'NO_PLAN':
      return { title: '还没有学习计划', description: '先完成设置，再开始今天的练习。', action: '开始设置', to: 'onboarding' }
    case 'COMPLETED':
      return { title: '今天的学习已经完成', description: '已保存的练习还在。', action: '结束学习', to: 'home' }
    case 'NO_CONTENT':
      return { title: '暂时没有可学习的内容', description: '可以先看现在能打开的内容。', action: '看可用内容', to: 'courses' }
    case 'NO_DUE_REVIEW':
      return { title: '今天没有到期的复习', description: '可以新学一节，或先结束今天。', action: '新学或结束', to: 'courses' }
    default:
      return null
  }
}

export function firstLearningGuideCopy(reason: FirstLearningReason | null): string | null {
  if (reason === 'NO_PLAN') return '继续设置，开始学习'
  if (reason === 'NO_CONTENT') return '第一次学习还没有可完成的任务'
  if (reason === 'INCOMPLETE') return '继续完成第一次学习'
  return null
}

export function isAccessibleContent(item: { status?: string; availability?: string }): boolean {
  return (item.availability ?? item.status) === 'PUBLISHED'
}

export type ShelfSearchState = 'error' | 'catalog-empty' | 'no-matches' | 'results'

export function shelfSearchState(accessibleCount: number, matchCount: number, failed: boolean): ShelfSearchState {
  if (failed) return 'error'
  if (accessibleCount <= 0) return 'catalog-empty'
  if (matchCount <= 0) return 'no-matches'
  return 'results'
}

export function samePlanReadback(
  left: { planId: string; planVersion: number } | null,
  right: { planId: string; planVersion: number } | null,
): boolean {
  if (!left || !right || !left.planId || !right.planId) return false
  return left.planId === right.planId && left.planVersion === right.planVersion
}

export function continueCheckpoint(context: { status?: string; lessonId?: string; stepIndex?: number } | null): { contentId: string; step: string } | null {
  if (!context || context.status !== 'ACTIVE' || !context.lessonId) return null
  return { contentId: context.lessonId, step: String(context.stepIndex ?? 0) }
}
