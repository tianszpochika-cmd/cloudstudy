import { unavailableOperation } from './unavailable'
import { apiClient } from './client'
import { createClientId } from '../platform/client-id'
import { listNotificationPreferences, setNotificationPreference, type NotificationPreference, type UpdateNotificationPreferenceInput } from './notifications'
import type {
  B4FocusAction,
  B4GameCode,
  B4InteractionCode,
  B4PerformanceLevel,
  B4ReportReason,
  B4SyncEvent,
} from '../domain/b4'

function idempotencyKey(prefix: string): string {
  return createClientId(prefix)
}

function withKey(prefix: string): { headers: { 'Idempotency-Key': string } } {
  return { headers: { 'Idempotency-Key': idempotencyKey(prefix) } }
}

export async function getB4Profile(): Promise<unknown> { return apiClient.get('/gamification/me/summary') }
export async function getB4Ledger(limit = 20): Promise<unknown> { return apiClient.get(`/gamification/me/ledger?limit=${limit}`) }
export async function settleB4LearningEvent(sourceType: string, sourceEventId: string): Promise<unknown> {
  throw new Error(`Trusted gamification settlement is server-owned (${sourceType}:${sourceEventId})`)
}
export async function getB4Streak(): Promise<unknown> { return apiClient.get('/gamification/streak') }
export async function saveB4StreakSettings(timeZone: string, weekendProtectionEnabled: boolean): Promise<unknown> {
  return apiClient.put('/gamification/streak/settings', { timeZone, weekendProtectionEnabled }, withKey('b4-streak-settings'))
}
export async function rescueB4Streak(rescueMethod: 'CARD' | 'CHALLENGE'): Promise<unknown> {
  return apiClient.post('/gamification/streak/rescue', { rescueMethod }, withKey('b4-streak-rescue'))
}
export async function listB4Quests(): Promise<unknown> { return apiClient.get('/gamification/quests') }
export async function claimB4Quest(questId: string): Promise<unknown> {
  return apiClient.post(`/gamification/quests/${encodeURIComponent(questId)}/claim`, {}, withKey(`b4-quest-${questId}`))
}
export async function getB4Season(): Promise<unknown> { return apiClient.get('/gamification/season') }
export async function listB4Chests(): Promise<unknown> {
  const raw = await apiClient.get<unknown>('/gamification/me/rewards')
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const items = Array.isArray(source.items) ? source.items : []
  return { items: items.flatMap((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
    const item = value as Record<string, unknown>
    const grantId = typeof item.grantId === 'string' ? item.grantId : null
    if (!grantId) return []
    return [{ chestGrantId: grantId, chestType: 'LEARNING_REWARD', kind: 'FREE_LEARNING_REWARD', status: item.state === 'CLAIMED' ? 'OPENED' : 'GRANTED', probabilityVersion: item.probabilityVersion, createdAt: item.issuedAt }]
  }) }
}
export async function getB4ChestProbability(chestGrantId: string): Promise<unknown> {
  const raw = await apiClient.get<unknown>(`/gamification/me/rewards/${encodeURIComponent(chestGrantId)}/probability`)
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const tiers = Array.isArray(source.tiers) ? source.tiers : []
  const mappedTiers = tiers.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
    const tier = value as Record<string, unknown>
    return { tierCode: tier.tierCode, weightBps: tier.basisPoints, itemProbabilityMode: 'SERVER_POOL' }
  })
  const totalWeightBps = tiers.reduce((sum, value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return sum
    const basisPoints = (value as Record<string, unknown>).basisPoints
    return typeof basisPoints === 'number' ? sum + basisPoints : sum
  }, 0)
  return { probability: { chestGrantId, chestType: 'LEARNING_REWARD', probabilityVersion: source.probabilityVersion, algorithmVersion: 'server', tiers: mappedTiers, totalWeightBps, disclosedBeforeClaim: true } }
}
export async function openB4Chest(chestGrantId: string): Promise<unknown> {
  const raw = await apiClient.post<unknown>(`/gamification/me/rewards/${encodeURIComponent(chestGrantId)}/claim`, { commandCode: 'CLAIM' }, withKey(`b4-chest-open-${chestGrantId}`))
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  return { result: { chestGrantId, opened: source.state === 'CLAIMED' || source.state === 'ALREADY_CLAIMED', replayed: source.replayed === true, outcomeCode: source.outcomeCode, probabilityVersion: source.probabilityVersion } }
}

export async function getB4AvatarProfile(): Promise<unknown> { return apiClient.get('/avatar/profile') }
export async function saveB4AvatarProfile(renderMode: '3D' | '2D_FALLBACK', resourceVersion?: string): Promise<unknown> {
  return apiClient.put('/avatar/profile', { renderMode, ...(resourceVersion ? { resourceVersion } : {}) }, withKey('b4-avatar-profile'))
}
export async function listB4AvatarItems(): Promise<unknown> { return apiClient.get('/avatar/items') }
export async function listB4Loadouts(): Promise<unknown> { return apiClient.get('/avatar/loadouts') }
export async function equipB4Loadout(loadoutId: string): Promise<unknown> {
  return apiClient.post(`/avatar/loadouts/${encodeURIComponent(loadoutId)}/equip`, {}, withKey(`b4-avatar-equip-${loadoutId}`))
}
export async function getB4AvatarResources(): Promise<unknown> { return apiClient.get('/avatar/resources') }
export async function getB4StudySpace(): Promise<unknown> { return apiClient.get('/avatar/study-space') }

export async function listB4Games(): Promise<unknown> { return apiClient.get('/games/catalog') }
export async function createB4GameSession(gameCode: B4GameCode, performanceTier: B4PerformanceLevel): Promise<unknown> {
  return apiClient.post('/games/sessions', { gameCode, performanceTier }, withKey(`b4-game-session-${gameCode}`))
}
export async function getB4GameSession(sessionId: string): Promise<unknown> {
  return apiClient.get(`/games/sessions/${encodeURIComponent(sessionId)}`)
}
export async function submitB4GameEvent(sessionId: string, seq: number, responseToken: string, itemCode: string): Promise<unknown> {
  return apiClient.post(`/games/sessions/${encodeURIComponent(sessionId)}/events`, {
    eventId: idempotencyKey('b4-game-event'),
    seq,
    responseToken,
    itemCode,
  }, withKey(`b4-game-event-${sessionId}-${seq}`))
}
export async function pauseB4GameSession(sessionId: string): Promise<unknown> {
  return apiClient.post(`/games/sessions/${encodeURIComponent(sessionId)}/pause`, {}, withKey(`b4-game-pause-${sessionId}`))
}
export async function resumeB4GameSession(sessionId: string): Promise<unknown> {
  return apiClient.post(`/games/sessions/${encodeURIComponent(sessionId)}/resume`, {}, withKey(`b4-game-resume-${sessionId}`))
}
export async function finishB4GameSession(sessionId: string): Promise<unknown> {
  return apiClient.post(`/games/sessions/${encodeURIComponent(sessionId)}/finish`, {}, withKey(`b4-game-finish-${sessionId}`))
}

export async function listB4Rooms(): Promise<unknown> { return apiClient.get('/social/rooms?limit=20') }
export async function getB4Room(roomId: string): Promise<unknown> { return apiClient.get(`/social/rooms/${encodeURIComponent(roomId)}`) }
export async function joinB4Room(roomId: string): Promise<unknown> {
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/join`, {}, withKey(`b4-room-join-${roomId}`))
}
export async function leaveB4Room(roomId: string): Promise<unknown> {
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/leave`, {}, withKey(`b4-room-leave-${roomId}`))
}
export async function startB4Focus(roomId: string, durationMinutes: 25 | 45 = 25): Promise<unknown> {
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/focus`, { durationMinutes, clientEventId: idempotencyKey(`b4-focus-start-${roomId}`) }, withKey(`b4-focus-start-${roomId}-${durationMinutes}`))
}
export async function updateB4Focus(roomId: string, sessionId: string, action: B4FocusAction): Promise<unknown> {
  const command = action === 'COMPLETE' ? 'FINISH' : action === 'AUTO_RELEASE' ? 'ABORT' : action
  return apiClient.patch(`/social/rooms/${encodeURIComponent(roomId)}/focus`, { focusId: sessionId, action: command, clientEventId: idempotencyKey(`b4-focus-${sessionId}-${action}`) }, withKey(`b4-focus-${sessionId}-${action}`))
}
export async function sendB4Interaction(roomId: string, interactionCode: B4InteractionCode): Promise<unknown> {
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/interactions`, { presetCode: interactionCode, targetSeatIndex: 0, clientEventId: idempotencyKey(`b4-interaction-${roomId}`) }, withKey(`b4-interaction-${roomId}-${interactionCode}`))
}
export async function getB4SocialLeaderboard(roomId: string): Promise<unknown> {
  const raw = await apiClient.get<unknown>(`/social/leaderboards?kind=FOCUS_MINUTES&period=DAY&roomId=${encodeURIComponent(roomId)}`)
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const data = typeof source.data === 'object' && source.data !== null && !Array.isArray(source.data) ? source.data as Record<string, unknown> : source
  return { leaderboard: { ...data, roomId, items: Array.isArray(data.entries) ? data.entries : [] } }
}
export async function createB4ModerationReport(reasonCode: B4ReportReason, targetUserId: string, roomId?: string): Promise<unknown> {
  return apiClient.post('/social/moderation/reports', { reasonCode, targetUserId, ...(roomId ? { roomId } : {}) }, withKey(`b4-report-${targetUserId}-${reasonCode}`))
}
export async function appealB4ModerationReport(reportId: string, appealCode: 'FALSE_POSITIVE' | 'CONTEXT' | 'OTHER'): Promise<unknown> {
  return apiClient.post(`/social/moderation/reports/${encodeURIComponent(reportId)}/appeal`, { appealCode }, withKey(`b4-report-appeal-${reportId}`))
}
export async function createB4WsTicket(roomId?: string): Promise<unknown> {
  return apiClient.post('/social/ws-ticket', { ...(roomId ? { roomId } : {}) }, withKey('b4-ws-ticket'))
}
export async function listB4Notifications(): Promise<unknown> {
  const raw = await apiClient.get<unknown>('/notifications/messages?limit=20')
  return { items: Array.isArray(raw) ? raw.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
    const item = value as Record<string, unknown>
    return { messageId: item.messageId, title: item.title, body: item.safeBody, category: item.notificationType, createdAt: item.createdAt, read: item.read === true }
  }) : [] }
}
export async function readB4Notification(messageId: string): Promise<unknown> {
  return apiClient.put(`/notifications/messages/${encodeURIComponent(messageId)}/read`, {}, withKey(`b4-notification-${messageId}`))
}
export async function readAllB4Notifications(): Promise<unknown> {
  return apiClient.put('/notifications/messages/read-all', {}, withKey('b4-notification-all'))
}
export async function getB4NotificationPreferences(): Promise<NotificationPreference[]> {
  return listNotificationPreferences()
}
export async function saveB4NotificationPreferences(input: UpdateNotificationPreferenceInput): Promise<NotificationPreference> {
  return setNotificationPreference(input)
}

export async function listB4OfflinePackages(): Promise<unknown> { return apiClient.get('/sync/offline-packages') }
export async function authorizeB4OfflinePackage(packageId: string): Promise<unknown> {
  return unavailableOperation()
}
export async function updateB4OfflineDownload(downloadId: string, action: 'PAUSE' | 'RESUME' | 'PART_RECEIVED', partIndex?: number, etag?: string): Promise<unknown> {
  return unavailableOperation()
}
export async function cleanupB4OfflineDownload(downloadId: string): Promise<unknown> {
  return unavailableOperation()
}
export async function listB4SyncChanges(cursor = '0'): Promise<unknown> {
  return unavailableOperation()
}
export async function pushB4SyncEvents(events: B4SyncEvent[]): Promise<unknown> {
  return unavailableOperation()
}
