import { mobileApiClient } from './client'
import type { B4FocusAction, B4GameCode, B4InteractionCode, B4PerformanceLevel, B4ReportReason, B4SyncEvent } from '../domain/b4'
import { createClientId } from '../platform/client-id'

function key(prefix: string): string { return createClientId(prefix) }
function withKey(prefix: string): { header: Record<string, string> } { return { header: { 'Idempotency-Key': key(prefix) } } }
function request<T>(path: string, options: Parameters<typeof mobileApiClient.request>[1] = {}): Promise<T> { return mobileApiClient.request<T>(path, options) }

export async function getB4Profile(): Promise<unknown> { return request('/gamification/me/summary') }
export async function getB4Streak(): Promise<unknown> { return request('/gamification/streak') }
export async function saveB4StreakSettings(timeZone: string, weekendProtectionEnabled: boolean): Promise<unknown> { return request('/gamification/streak/settings', { method: 'PUT', data: { timeZone, weekendProtectionEnabled }, ...withKey('b4-streak-settings') }) }
export async function rescueB4Streak(method: 'CARD' | 'CHALLENGE'): Promise<unknown> { return request('/gamification/streak/rescue', { method: 'POST', data: { rescueMethod: method }, ...withKey('b4-streak-rescue') }) }
export async function listB4Quests(): Promise<unknown> { return request('/gamification/quests') }
export async function getB4Season(): Promise<unknown> { return request('/gamification/season') }
export async function listB4Chests(): Promise<unknown> { return request('/gamification/me/rewards') }
export async function getB4ChestProbability(chestGrantId: string): Promise<unknown> { return request(`/gamification/me/rewards/${encodeURIComponent(chestGrantId)}/probability`) }
export async function openB4Chest(chestGrantId: string): Promise<unknown> { return request(`/gamification/me/rewards/${encodeURIComponent(chestGrantId)}/claim`, { method: 'POST', data: { commandCode: 'CLAIM' }, ...withKey(`b4-chest-open-${chestGrantId}`) }) }

export async function getB4AvatarProfile(): Promise<unknown> { return request('/avatar/profile') }
export async function saveB4AvatarProfile(renderMode: '3D' | '2D_FALLBACK', resourceVersion?: string): Promise<unknown> { return request('/avatar/profile', { method: 'PUT', data: { renderMode, ...(resourceVersion ? { resourceVersion } : {}) }, ...withKey('b4-avatar-profile') }) }
export async function listB4AvatarItems(): Promise<unknown> { return request('/avatar/items') }
export async function listB4Loadouts(): Promise<unknown> { return request('/avatar/loadouts') }
export async function equipB4Loadout(loadoutId: string): Promise<unknown> { return request(`/avatar/loadouts/${encodeURIComponent(loadoutId)}/equip`, { method: 'POST', ...withKey(`b4-avatar-equip-${loadoutId}`) }) }
export async function getB4AvatarResources(): Promise<unknown> { return request('/avatar/resources') }

export async function listB4Games(): Promise<unknown> { return request('/games/catalog') }
export async function createB4GameSession(gameCode: B4GameCode, performanceTier: B4PerformanceLevel): Promise<unknown> { return request('/games/sessions', { method: 'POST', data: { gameCode, performanceTier }, ...withKey(`b4-game-session-${gameCode}`) }) }
export async function getB4GameSession(sessionId: string): Promise<unknown> { return request(`/games/sessions/${encodeURIComponent(sessionId)}`) }
export async function submitB4GameEvent(sessionId: string, seq: number, responseToken: string, itemCode: string): Promise<unknown> { return request(`/games/sessions/${encodeURIComponent(sessionId)}/events`, { method: 'POST', data: { eventId: key('b4-game-event'), seq, responseToken, itemCode }, ...withKey(`b4-game-event-${sessionId}-${seq}`) }) }
export async function pauseB4GameSession(sessionId: string): Promise<unknown> { return request(`/games/sessions/${encodeURIComponent(sessionId)}/pause`, { method: 'POST', ...withKey(`b4-game-pause-${sessionId}`) }) }
export async function resumeB4GameSession(sessionId: string): Promise<unknown> { return request(`/games/sessions/${encodeURIComponent(sessionId)}/resume`, { method: 'POST', ...withKey(`b4-game-resume-${sessionId}`) }) }
export async function finishB4GameSession(sessionId: string): Promise<unknown> { return request(`/games/sessions/${encodeURIComponent(sessionId)}/finish`, { method: 'POST', ...withKey(`b4-game-finish-${sessionId}`) }) }

export async function listB4Rooms(): Promise<unknown> { return request('/social/rooms?limit=20') }
export async function joinB4Room(roomId: string): Promise<unknown> { return request(`/social/rooms/${encodeURIComponent(roomId)}/join`, { method: 'POST', data: {}, ...withKey(`b4-room-join-${roomId}`) }) }
export async function leaveB4Room(roomId: string): Promise<unknown> { return request(`/social/rooms/${encodeURIComponent(roomId)}/leave`, { method: 'POST', ...withKey(`b4-room-leave-${roomId}`) }) }
export async function startB4Focus(roomId: string, durationMinutes: 25 | 45 = 25): Promise<unknown> { return request(`/social/rooms/${encodeURIComponent(roomId)}/focus`, { method: 'POST', data: { durationMinutes, clientEventId: key(`b4-focus-start-${roomId}`) }, ...withKey(`b4-focus-start-${roomId}-${durationMinutes}`) }) }
export async function updateB4Focus(roomId: string, sessionId: string, action: B4FocusAction): Promise<unknown> {
  const command = action === 'COMPLETE' ? 'FINISH' : action === 'AUTO_RELEASE' ? 'ABORT' : action
  return request(`/social/rooms/${encodeURIComponent(roomId)}/focus`, { method: 'PATCH', data: { focusId: sessionId, action: command, clientEventId: key(`b4-focus-${sessionId}-${action}`) }, ...withKey(`b4-focus-${sessionId}-${action}`) })
}
export async function sendB4Interaction(roomId: string, interactionCode: B4InteractionCode): Promise<unknown> { return request(`/social/rooms/${encodeURIComponent(roomId)}/interactions`, { method: 'POST', data: { interactionCode }, ...withKey(`b4-interaction-${roomId}-${interactionCode}`) }) }
export async function getB4SocialLeaderboard(roomId: string): Promise<unknown> { return request(`/social/leaderboards?roomId=${encodeURIComponent(roomId)}`) }
export async function createB4ModerationReport(reasonCode: B4ReportReason, targetUserId: string, roomId?: string): Promise<unknown> { return request('/social/moderation/reports', { method: 'POST', data: { reasonCode, targetUserId, ...(roomId ? { roomId } : {}) }, ...withKey(`b4-report-${targetUserId}-${reasonCode}`) }) }
export async function appealB4ModerationReport(reportId: string, appealCode: 'FALSE_POSITIVE' | 'CONTEXT' | 'OTHER'): Promise<unknown> { return request(`/social/moderation/reports/${encodeURIComponent(reportId)}/appeal`, { method: 'POST', data: { appealCode }, ...withKey(`b4-report-appeal-${reportId}`) }) }
export async function listB4Notifications(): Promise<unknown> { return request('/notifications/messages?limit=20') }
export async function readB4Notification(messageId: string): Promise<unknown> { return request(`/notifications/messages/${encodeURIComponent(messageId)}/read`, { method: 'PUT', data: {}, ...withKey(`b4-notification-${messageId}`) }) }
export async function readAllB4Notifications(): Promise<unknown> { return request('/notifications/messages/read-all', { method: 'PUT', data: {}, ...withKey('b4-notification-all') }) }
export async function listB4OfflinePackages(): Promise<unknown> { return request('/sync/offline-packages?limit=20') }
export async function authorizeB4OfflinePackage(packageId: string): Promise<unknown> { return request(`/sync/offline-packages/${encodeURIComponent(packageId)}/authorize`, { method: 'POST', ...withKey(`b4-offline-authorize-${packageId}`) }) }
export async function updateB4OfflineDownload(downloadId: string, action: 'PAUSE' | 'RESUME' | 'PART_RECEIVED', partIndex?: number, etag?: string): Promise<unknown> { return request(`/sync/offline-downloads/${encodeURIComponent(downloadId)}`, { method: 'PATCH', data: { action, ...(partIndex === undefined ? {} : { partIndex }), ...(etag ? { etag } : {}) }, ...withKey(`b4-offline-download-${downloadId}-${action}-${partIndex ?? 'none'}`) }) }
export async function cleanupB4OfflineDownload(downloadId: string): Promise<unknown> { return request(`/sync/offline-downloads/${encodeURIComponent(downloadId)}/cleanup`, { method: 'POST', data: {}, ...withKey(`b4-offline-cleanup-${downloadId}`) }) }
export async function pushB4SyncEvents(events: B4SyncEvent[]): Promise<unknown> { return request('/sync/events', { method: 'POST', data: { clientBatchId: key('b4-sync-batch'), events }, ...withKey('b4-sync-events') }) }
