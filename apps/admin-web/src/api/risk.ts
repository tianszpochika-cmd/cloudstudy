import { adminClient } from './client'
import { createClientId } from '../platform/client-id'

export interface RiskCaseRecord {
  caseId: string
  category: string
  severity: string
  status: string
  source: string
  ruleId: string | null
  ruleVersion: string | null
  title: string
  subjectRef: string | null
  evidenceRefs: string[]
  assigneeNote: string | null
  containmentRef: string | null
  escalationTarget: string | null
  escalationRef: string | null
  closedReason: string | null
  decisions: Record<string, unknown>[]
  lastAuditId: string | null
  stateVersion: number
  createdAt: string | null
  updatedAt: string | null
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function parseRiskCase(value: unknown): RiskCaseRecord | null {
  if (!record(value)) return null
  const caseId = text(value.caseId)
  const category = text(value.category)
  const severity = text(value.severity)
  const status = text(value.status)
  const source = text(value.source)
  const title = text(value.title)
  if (!caseId || !category || !severity || !status || !source || !title) return null
  return {
    caseId,
    category,
    severity,
    status,
    source,
    ruleId: text(value.ruleId),
    ruleVersion: text(value.ruleVersion),
    title,
    subjectRef: text(value.subjectRef),
    evidenceRefs: textList(value.evidenceRefs),
    assigneeNote: text(value.assigneeNote),
    containmentRef: text(value.containmentRef),
    escalationTarget: text(value.escalationTarget),
    escalationRef: text(value.escalationRef),
    closedReason: text(value.closedReason),
    decisions: Array.isArray(value.decisions) ? value.decisions.filter(record) : [],
    lastAuditId: text(value.lastAuditId),
    stateVersion: typeof value.stateVersion === 'number' ? value.stateVersion : 0,
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
  }
}

export interface RiskCasePage {
  items: RiskCaseRecord[]
  nextCursor: string | null
}

export function parseRiskCasePage(response: unknown): RiskCasePage {
  if (!record(response) || !record(response.data) || !Array.isArray(response.data.items)) {
    throw new Error('RISK_CASE_PAGE_INVALID')
  }
  const items = response.data.items.map(parseRiskCase)
  if (items.some((item) => item === null)) throw new Error('RISK_CASE_PAGE_INVALID')
  const cursor = 'nextCursor' in response.data ? response.data.nextCursor : null
  return {
    items: items.filter((item): item is RiskCaseRecord => item !== null),
    nextCursor: typeof cursor === 'string' && cursor.trim() ? cursor : null,
  }
}

export const RISK_PATHS = {
  cases: '/admin/ops/risk/cases',
  commands: (caseId: string) => `/admin/ops/risk/cases/${encodeURIComponent(caseId)}/commands`,
  evaluate: '/admin/ops/risk/rules:evaluate',
} as const

function idempotencyKey(prefix: string): string {
  return createClientId(prefix)
}

export async function listRiskCases(): Promise<RiskCasePage> {
  return parseRiskCasePage(await adminClient.request<unknown>(RISK_PATHS.cases))
}

export interface RiskFileInput {
  category: string
  severity: string
  title: string
  subjectRef?: string
  evidenceRefs?: string[]
  note?: string
}

export async function fileRiskCase(input: RiskFileInput): Promise<unknown> {
  return adminClient.request(RISK_PATHS.cases, {
    method: 'POST',
    body: { ...input },
    headers: { 'Idempotency-Key': idempotencyKey('risk-admin-file') },
  })
}

export interface RiskDecisionInput {
  command: string
  reason: string
  assigneeNote?: string
  containmentRef?: string
  escalationTarget?: string
  escalationRef?: string
}

export async function decideRiskCase(caseId: string, input: RiskDecisionInput): Promise<unknown> {
  return adminClient.request(RISK_PATHS.commands(caseId), {
    method: 'POST',
    body: { ...input },
    headers: { 'Idempotency-Key': idempotencyKey(`risk-admin-${input.command.toLowerCase()}`) },
  })
}

export async function evaluateRiskRules(rules?: string[]): Promise<unknown> {
  return adminClient.request(RISK_PATHS.evaluate, {
    method: 'POST',
    body: rules?.length ? { rules } : {},
    headers: { 'Idempotency-Key': idempotencyKey('risk-admin-evaluate') },
  })
}
