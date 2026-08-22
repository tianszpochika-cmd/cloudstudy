export interface AdminFlag {
  flagKey: string
  enabled: boolean
  rolloutPercent: number
  ruleVersion: string
  allowedPlatforms: string[]
  defaultOff: boolean
}

export interface ReviewTask {
  reviewTaskId: string
  contentId: string
  versionId: string
  stage: string
  requiredRole: string
  status: string
}

export interface AuditEntry {
  auditId: string
  actionCode: string
  resourceType: string
  resourceRef: string
  resultCode: string
  redacted: boolean
  occurredAt: string
}

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function unwrap(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
export function recordList(value: unknown, key = 'items'): Array<Record<string, unknown>> { const source = unwrap(value); return isRecord(source) && Array.isArray(source[key]) ? source[key].filter(isRecord) : [] }
export function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback }
export function bool(value: unknown, fallback = false): boolean { return typeof value === 'boolean' ? value : fallback }
export function num(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
export function toFlag(value: Record<string, unknown>): AdminFlag { return { flagKey: text(value.flagKey), enabled: bool(value.enabled), rolloutPercent: num(value.rolloutPercent), ruleVersion: text(value.ruleVersion), allowedPlatforms: Array.isArray(value.allowedPlatforms) ? value.allowedPlatforms.filter((item): item is string => typeof item === 'string') : [], defaultOff: bool(value.defaultOff, !bool(value.enabled)) } }
export function toReview(value: Record<string, unknown>): ReviewTask { return { reviewTaskId: text(value.reviewTaskId), contentId: text(value.contentId), versionId: text(value.versionId), stage: text(value.stage), requiredRole: text(value.requiredRole), status: text(value.status) } }
export function toAudit(value: Record<string, unknown>): AuditEntry { return { auditId: text(value.auditId), actionCode: text(value.actionCode), resourceType: text(value.resourceType), resourceRef: text(value.resourceRef), resultCode: text(value.resultCode), redacted: bool(value.redacted, true), occurredAt: text(value.occurredAt) } }
