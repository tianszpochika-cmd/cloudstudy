import { apiClient } from './client'
import { createClientId } from '../platform/client-id'
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

export async function getB4Profile(): Promise<unknown> { return apiClient.get('/gamification/profile') }
export async function getB4Ledger(limit = 20): Promise<unknown> { return apiClient.get(`/gamification/ledger?limit=${limit}`) }
export async function settleB4LearningEvent(sourceType: string, sourceEventId: string): Promise<unknown> {
  return apiClient.post('/gamification/events', { sourceType, sourceEventId }, withKey(`b4-learning-${sourceEventId}`))
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
export async function getB4Season(): Promise<unknown> { return apiClient.get('/gamification/seasons/current') }
export async function listB4Chests(): Promise<unknown> { return apiClient.get('/gamification/chests') }
export async function getB4ChestProbability(chestGrantId: string): Promise<unknown> {
  return apiClient.get(`/gamification/chests/${encodeURIComponent(chestGrantId)}/probability`)
}
export async function openB4Chest(chestGrantId: string): Promise<unknown> {
  return apiClient.post(`/gamification/chests/${encodeURIComponent(chestGrantId)}/open`, {}, withKey(`b4-chest-open-${chestGrantId}`))
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
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/focus-sessions`, { durationMinutes }, withKey(`b4-focus-start-${roomId}-${durationMinutes}`))
}
export async function updateB4Focus(sessionId: string, action: B4FocusAction): Promise<unknown> {
  return apiClient.patch(`/social/focus-sessions/${encodeURIComponent(sessionId)}`, { action }, withKey(`b4-focus-${sessionId}-${action}`))
}
export async function sendB4Interaction(roomId: string, interactionCode: B4InteractionCode): Promise<unknown> {
  return apiClient.post(`/social/rooms/${encodeURIComponent(roomId)}/interactions`, { interactionCode }, withKey(`b4-interaction-${roomId}-${interactionCode}`))
}
export async function getB4SocialLeaderboard(roomId: string): Promise<unknown> {
  return apiClient.get(`/social/leaderboards?roomId=${encodeURIComponent(roomId)}`)
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
export async function listB4Notifications(): Promise<unknown> { return apiClient.get('/user/notifications?limit=20') }
export async function readB4Notification(messageId: string): Promise<unknown> {
  return apiClient.put(`/user/notifications/${encodeURIComponent(messageId)}/read`, {}, withKey(`b4-notification-${messageId}`))
}
export async function readAllB4Notifications(): Promise<unknown> {
  return apiClient.put('/user/notifications/read-all', {}, withKey('b4-notification-all'))
}
export async function getB4NotificationPreferences(): Promise<unknown> { return apiClient.get('/user/notification-preferences') }
export async function saveB4NotificationPreferences(preferences: Record<string, boolean>): Promise<unknown> {
  return apiClient.patch('/user/notification-preferences', preferences, withKey('b4-notification-preferences'))
}

export async function listB4OfflinePackages(): Promise<unknown> { return apiClient.get('/sync/offline-packages?limit=20') }
export async function authorizeB4OfflinePackage(packageId: string): Promise<unknown> {
  return apiClient.post(`/sync/offline-packages/${encodeURIComponent(packageId)}/authorize`, {}, withKey(`b4-offline-authorize-${packageId}`))
}
export async function updateB4OfflineDownload(downloadId: string, action: 'PAUSE' | 'RESUME' | 'PART_RECEIVED', partIndex?: number, etag?: string): Promise<unknown> {
  return apiClient.patch(`/sync/offline-downloads/${encodeURIComponent(downloadId)}`, { action, ...(partIndex === undefined ? {} : { partIndex }), ...(etag ? { etag } : {}) }, withKey(`b4-offline-download-${downloadId}-${action}-${partIndex ?? 'none'}`))
}
export async function cleanupB4OfflineDownload(downloadId: string): Promise<unknown> {
  return apiClient.post(`/sync/offline-downloads/${encodeURIComponent(downloadId)}/cleanup`, {}, withKey(`b4-offline-cleanup-${downloadId}`))
}
export async function listB4SyncChanges(cursor = '0'): Promise<unknown> {
  return apiClient.get(`/sync/changes?cursor=${encodeURIComponent(cursor)}&limit=50`)
}
export async function pushB4SyncEvents(events: B4SyncEvent[]): Promise<unknown> {
  return apiClient.post('/sync/events', { clientBatchId: idempotencyKey('b4-sync-batch'), events }, withKey('b4-sync-events'))
}
