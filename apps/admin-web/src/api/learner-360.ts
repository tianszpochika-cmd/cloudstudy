import { adminClient, AdminApiError } from './client'
import { adminT } from '../platform/admin-i18n'

/**
 * B3 learner 360° port for the tenant control plane.
 * Reads fan out per owner through dedicated admin Gateway routes
 * (/api/v1/admin/learners/*); each owner enforces tenant-admin JWT auth.
 */

type Row = Record<string, unknown>

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapData(value: unknown): Row {
  if (isRecord(value) && isRecord(value.data)) return value.data
  return isRecord(value) ? value : {}
}

function errorOf(error: unknown, fallback: string): Error {
  if (error instanceof AdminApiError) return new Error(error.message)
  return error instanceof Error ? error : new Error(fallback)
}

function idempotencyKey(prefix: string): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return `${prefix}-${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export interface LearnerSubject {
  subjectId: string
  tenantId: string
}

export interface LearnerSubjectPage {
  subjects: LearnerSubject[]
  nextCursor: string | null
  hasMore: boolean
}

export async function searchLearners(q?: string, limit = 50, cursor?: string): Promise<LearnerSubjectPage> {
  const params = new URLSearchParams({ pageSize: String(limit) })
  if (q?.trim()) params.set('q', q.trim())
  if (cursor) params.set('cursor', cursor)
  const empty: LearnerSubjectPage = { subjects: [], nextCursor: null, hasMore: false }
  try {
    const response: unknown = await adminClient.request(`/admin/learners/search?${params.toString()}`)
    // Canonical contract shape: data is the item array, cursor state lives in meta.
    // (unwrapData cannot be used here: it drops top-level arrays.)
    const root = isRecord(response) ? response : {}
    const data = root.data
    const rows = Array.isArray(data) ? data : []
    const meta = isRecord(root.meta) ? root.meta : {}
    const subjects = rows.filter(isRecord).map((item) => ({
      subjectId: typeof item.subjectId === 'string' ? item.subjectId : '',
      tenantId: typeof item.tenantId === 'string' ? item.tenantId : 'platform',
    })).filter((s) => s.subjectId)
    return {
      subjects,
      nextCursor: typeof meta.nextCursor === 'string' ? meta.nextCursor : null,
      hasMore: meta.hasMore === true,
    }
  } catch (error) {
    throw errorOf(error, adminT('apiLearner360.searchFailed'))
  }
}

export async function getLearnerProfile(subjectId: string): Promise<Row> {
  try {
    return unwrapData(await adminClient.request(`/admin/learners/${encodeURIComponent(subjectId)}/profile`))
  } catch (error) {
    throw errorOf(error, adminT('apiLearner360.profileFailed'))
  }
}

export async function getLearnerPlans(subjectId: string): Promise<Row> {
  try {
    return unwrapData(await adminClient.request(`/admin/learners/${encodeURIComponent(subjectId)}/plans`))
  } catch (error) {
    throw errorOf(error, adminT('apiLearner360.plansFailed'))
  }
}

export async function getLearnerSrs(subjectId: string): Promise<Row> {
  try {
    return unwrapData(await adminClient.request(`/admin/learners/${encodeURIComponent(subjectId)}/srs`))
  } catch (error) {
    throw errorOf(error, adminT('apiLearner360.srsFailed'))
  }
}

export async function getLearnerAssessments(subjectId: string): Promise<Row> {
  try {
    return unwrapData(await adminClient.request(`/admin/learners/${encodeURIComponent(subjectId)}/assessments`))
  } catch (error) {
    throw errorOf(error, adminT('apiLearner360.assessmentsFailed'))
  }
}

async function sendCommand(path: string, body: Row): Promise<Row> {
  try {
    const response = await adminClient.request(path, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey('learner360') },
    })
    return unwrapData(response)
  } catch (error) {
    throw errorOf(error, adminT('apiLearner360.commandFailed'))
  }
}

export function setLearnerGoal(
  subjectId: string,
  input: { goalType: string; dailyMinutes: number; targetDate?: string; startingLevel?: string; examName?: string; language?: string; expectedVersion: number },
): Promise<Row> {
  return sendCommand(`/admin/learners/${encodeURIComponent(subjectId)}/commands`, {
    command: 'SET_GOAL',
    expectedStateVersion: input.expectedVersion,
    goalType: input.goalType,
    dailyMinutes: input.dailyMinutes,
    targetDate: input.targetDate ?? '',
    startingLevel: input.startingLevel ?? '',
    examName: input.examName ?? '',
    language: input.language ?? '',
  })
}

export function updateLearnerPreferences(
  subjectId: string,
  input: { uiLocale: string; contentLocale: string; themeMode: string; timezone: string; reducedMotion: boolean; expectedVersion: number },
): Promise<Row> {
  return sendCommand(`/admin/learners/${encodeURIComponent(subjectId)}/commands`, {
    command: 'UPDATE_PREFERENCES',
    expectedStateVersion: input.expectedVersion,
    ...input,
  })
}

export function resetSrsItem(subjectId: string, itemId: string, reasonCode = 'ADMIN_SRS_RESET'): Promise<Row> {
  return sendCommand(`/admin/learners/${encodeURIComponent(subjectId)}/learning-commands`, {
    command: 'RESET_SRS_ITEM',
    itemId,
    reasonCode,
  })
}
