import { apiClient } from './client'
import {
  ensureIdempotencyKey,
  parsePlanTodayQueue,
  replanIdempotencyKey,
  type PlanTodayQueue,
} from '../domain/plan-today'

export async function readPlanTodayQueue(): Promise<PlanTodayQueue> {
  return parsePlanTodayQueue(await apiClient.get<unknown>('/learning/today'))
}

export async function ensureLearningPlan(placementReportId: string): Promise<unknown> {
  return apiClient.post('/learning/plans:ensure', { placementReportId }, {
    headers: { 'Idempotency-Key': ensureIdempotencyKey(placementReportId) },
  })
}

export async function replanLearningPlan(planVersion: number, clientEventId: string): Promise<unknown> {
  return apiClient.post('/learning/plans:replan', {
    baseStateVersion: planVersion,
    confirmImpact: true,
    clientEventId,
  }, {
    headers: {
      'Idempotency-Key': replanIdempotencyKey(planVersion, clientEventId),
      'If-Match': String(planVersion),
    },
  })
}
