import { mobileApiClient } from './client'
import {
  ensureIdempotencyKey,
  parsePlanTodayQueue,
  replanIdempotencyKey,
  type PlanTodayQueue,
} from '../domain/plan-today'

export async function readPlanToday(): Promise<PlanTodayQueue> {
  return parsePlanTodayQueue(await mobileApiClient.request<unknown>('/learning/today'))
}

export async function ensureLearningPlan(placementReportId: string): Promise<unknown> {
  return mobileApiClient.request('/learning/plans:ensure', {
    method: 'POST',
    data: { placementReportId },
    header: { 'Idempotency-Key': ensureIdempotencyKey(placementReportId) },
  })
}

export async function replanLearningPlan(planVersion: number, clientEventId: string): Promise<unknown> {
  return mobileApiClient.request('/learning/plans:replan', {
    method: 'POST',
    data: { baseStateVersion: planVersion, confirmImpact: true, clientEventId },
    header: {
      'Idempotency-Key': replanIdempotencyKey(planVersion, clientEventId),
      'If-Match': String(planVersion),
    },
  })
}
