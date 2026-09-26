import { apiClient } from './client'

export const B12_REPORT_REASONS = ['SPAM', 'HARASSMENT', 'SENSITIVE_CONTENT', 'IMPERSONATION', 'OTHER'] as const
export type B12ReportReason = (typeof B12_REPORT_REASONS)[number]

let localSequence = 0

function idempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`
  localSequence += 1
  return `${prefix}-${Date.now()}-${localSequence}`
}

function withKey(prefix: string): { headers: { 'Idempotency-Key': string } } {
  return { headers: { 'Idempotency-Key': idempotencyKey(prefix) } }
}

export interface B12RewardGrant {
  grantId: string
  rewardCode: string
  status: 'GRANTED' | 'CLAIMED'
  probabilityVersion: string
  outcomeCode?: string
  grantedAt?: string
  claimedAt?: string
}

export interface B12RewardProbability {
  grantId: string
  rewardCode: string
  probabilityVersion: string
  outcomes: Array<{ outcomeCode: string; probability: number }>
  totalProbability: number
  disclosedBeforeClaim: boolean
  probabilitySnapshotHash?: string
}

export interface B12RewardClaim {
  grantId: string
  claimed: boolean
  replayed: boolean
  outcomeCode?: string
  probabilityVersion?: string
  claimedAt?: string
}

export interface B12LeaderboardEntry {
  rank: number
  displayMode: string
  displayName?: string
  score: number
  qualifiedUnits: number
  isSelf: boolean
  targetSeatIndex?: number
}

export interface B12Leaderboard {
  kind: string
  period: string
  entries: B12LeaderboardEntry[]
}

export interface B12Report {
  reportId: string
  roomId: string
  targetSeatIndex: number
  reasonCode: B12ReportReason
  status: string
  reviewMode: string
  createdAt?: string
}

export interface B12NotificationMessage {
  messageId: string
  title?: string
  safeBody?: string
  state?: string
}

export async function listB12RewardGrants(): Promise<unknown> { return apiClient.get('/gamification/me/rewards') }
export async function getB12RewardProbability(grantId: string): Promise<unknown> {
  return apiClient.get(`/gamification/me/rewards/${encodeURIComponent(grantId)}/probability`)
}
export async function claimB12Reward(grantId: string): Promise<unknown> {
  return apiClient.post(`/gamification/me/rewards/${encodeURIComponent(grantId)}/claim`, { commandCode: 'CLAIM' }, withKey(`b12-reward-claim-${grantId}`))
}

export async function getB12SocialLeaderboard(roomId: string): Promise<unknown> {
  return apiClient.get(`/social/leaderboards?kind=FOCUS_MINUTES&period=DAY&roomId=${encodeURIComponent(roomId)}`)
}
export async function createB12SocialReport(roomId: string, targetSeatIndex: number, reasonCode: B12ReportReason): Promise<unknown> {
  const clientEventId = idempotencyKey(`b12-report-${roomId}-${targetSeatIndex}`)
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/reports`, {
    targetSeatIndex,
    reasonCode,
    clientEventId,
  }, withKey(clientEventId))
}

export async function listB12Notifications(limit = 20): Promise<unknown> { return apiClient.get(`/notifications/messages?limit=${limit}`) }
