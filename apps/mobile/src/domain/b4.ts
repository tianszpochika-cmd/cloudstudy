export const B4_PERFORMANCE_LEVELS = ['Ultra', 'High', 'Medium', 'Performance'] as const
export const B4_GAME_RELEASE_PHASES = ['P0', 'P1', 'LONG_TERM'] as const
import { createClientId } from '../platform/client-id'
export type B4PerformanceLevel = (typeof B4_PERFORMANCE_LEVELS)[number]
export type B4GameReleasePhase = (typeof B4_GAME_RELEASE_PHASES)[number]
export type B4Status = 'idle' | 'loading' | 'ready' | 'offline' | 'error' | 'empty' | 'permission' | 'recovery' | 'processing' | 'success'
export type B4GameCode = 'SENTENCE_TRAIN' | 'WORD_MATCH' | 'WORD_DEFENSE' | 'WORD_PUZZLE' | 'GRAMMAR_BLASTER' | 'CATCH_MEANING'
export type B4FocusAction = 'PAUSE' | 'RESUME' | 'COMPLETE' | 'AUTO_RELEASE' | 'HEARTBEAT'
export type B4InteractionCode = 'CHEER_UP' | 'STUDY_TOGETHER' | 'CONGRATS' | 'TRY_AGAIN' | 'TONIGHT_20_MIN'
export const B4_REPORT_REASONS = ['SPAM', 'HARASSMENT', 'SENSITIVE_CONTENT', 'IMPERSONATION', 'OTHER'] as const
export type B4ReportReason = (typeof B4_REPORT_REASONS)[number]

export interface B4Profile { userId: string; xp: number; level: number; rank: string; coins: number; nextLevelXp: number | null; streak: number; dailyRewardCount: number; ruleVersion: string | null }
export interface B4Streak { currentStreak: number; lastValidDate: string | null; timeZone: string; weekendProtectionEnabled: boolean; status: string }
export interface B4Quest { questId: string; period: string; title: string; target: number; progress: number; completed: boolean; claimed: boolean; xpReward: number; coinReward: number }
export interface B4Season { seasonId: string; title: string; status: string; points: number; tiers: Array<{ tier: number; requiredPoints: number }> }
export interface B4AvatarProfile { avatarId: string; resourceVersion: string; renderMode: '3D' | '2D_FALLBACK'; loadoutId: string }
export interface B4AvatarItem { itemCode: string; quality: string; slot: string; resourceVersion: string; owned?: boolean }
export interface B4Loadout { loadoutId: string; name: string; equipped: boolean; items: string[] }
export interface B4AvatarResources { resourceVersion: string; manifestHash: string | null; fallbackMode: '3D' | '2D_FALLBACK'; performanceTiers: B4PerformanceLevel[] }
export interface B4GameCatalogItem { gameCode: B4GameCode; releasePhase: B4GameReleasePhase; enabled: boolean; maxMinutes: number | null; pauseLimitMinutes: number | null; passAccuracyPercent: number | null; passCompletionPercent: number | null }
export interface B4GameChallenge { roundNo: number; itemCode: string; challengeToken: string }
export interface B4GameSession { sessionId: string; gameCode: B4GameCode; status: string; seq: number; attemptCount: number; createdAt: string | null; maxMinutes: number | null; pauseLimitMinutes: number | null; challenges: B4GameChallenge[] }
export interface B4GameFinishResult { sessionId: string; status: string; passed: boolean; accuracyPercent: number; completionPercent: number; serverScore: number; rewardEligible: boolean }
export interface B4Room { roomId: string; name: string; templateCode: string; capacity: number; memberCount: number; joined: boolean; chatMode: string }
export interface B4FocusSession { sessionId: string; roomId: string; status: string; startedAt: string | null; serverDurationSeconds: number }
export interface B4GalaxyNode { nodeCode: string; status: string; progress: number; requiredProgress: number; progressPercent: number }
export interface B4Galaxy { enabled: boolean; totalXp: number; nodes: B4GalaxyNode[]; trajectory: Array<{ sourceEventId: string | null; updatedAt: string | null }>; ruleVersion: string | null }
export interface B4Notification { messageId: string; title: string; body: string; read: boolean; category: string | null; createdAt: string | null }
export interface B4NotificationPreferences { roomInteractions: boolean; focusReminders: boolean; system: boolean; doNotDisturb: boolean; version: number }
export interface B4RewardChest { chestGrantId: string; chestType: string; kind: string; status: string; probabilityVersion: string | null; auditId: string | null; tierCode: string | null; itemCode: string | null; duplicateConverted: boolean; shardAmount: number; freeOnly: boolean; createdAt: string | null }
export interface B4ChestProbabilityTier { tierCode: string; weightBps: number; itemProbabilityMode: string }
export interface B4ChestProbability { chestGrantId: string; chestType: string; probabilityVersion: string | null; algorithmVersion: string | null; tiers: B4ChestProbabilityTier[]; totalWeightBps: number; probabilitySnapshotHash: string | null; pityEnabled: boolean }
export interface B4ChestOpenResult { opened: boolean; replayed: boolean; auditId: string | null; chestGrantId: string; chestType: string; tierCode: string | null; itemCode: string | null; duplicateConverted: boolean; shardAmount: number; probabilityVersion: string | null; probabilitySnapshotHash: string | null; balanceAfter: number | null; ruleVersion: string | null }
export interface B4LeaderboardEntry { userId: string; completedFocusSeconds: number; status: string; displayMode: string }
export interface B4Leaderboard { roomId: string; items: B4LeaderboardEntry[]; source: string | null; serverTime: string | null }
export interface B4ModerationReceipt { reportId: string; status: string; reviewMode: string; targetUserId: string; roomId: string | null; reasonCode: B4ReportReason; createdAt: string | null; appealed: boolean; appealId: string | null }
export interface B4OfflinePackage { packageId: string; packageCode: string; version: string; state: string; sizeBytes: number; partCount: number; sha256: string | null; signature: string | null; minClientVersion: string | null; downloadId: string | null; downloadState: string | null; completedPartCount: number; downloadedBytes: number; signedPartUrls: string[]; expiresAt: string | null }
export interface B4SyncEvent { clientEventId: string; eventType: string; occurredAt: string; entityId: string; entityVersion: number; payload: Record<string, unknown> }
export interface B4OfflineRecord { id: string; event: B4SyncEvent; status: 'PENDING' | 'SYNCING' | 'FAILED'; attemptCount: number; lastError: string | null; queuedAt: string }

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function unwrapB4(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
export function recordValue(value: unknown, key: string): Record<string, unknown> | null { return isRecord(value) && isRecord(value[key]) ? value[key] : null }
export function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }
export function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
export function recordList(value: unknown, key = 'items'): Array<Record<string, unknown>> { const source = unwrapB4(value); return isRecord(source) && Array.isArray(source[key]) ? source[key].filter(isRecord) : [] }
export function createB4ClientEventId(prefix: string): string { return createClientId(prefix) }
export function gameLabel(code: B4GameCode): string { return ({ SENTENCE_TRAIN: '拼句小火车', WORD_MATCH: '单词消消乐', WORD_DEFENSE: '单词保卫战', WORD_PUZZLE: '拼图解谜', GRAMMAR_BLASTER: '语法射击', CATCH_MEANING: '词义捕手' })[code] }
export function interactionLabel(code: B4InteractionCode): string { return ({ CHEER_UP: '给你打气', STUDY_TOGETHER: '一起学习', CONGRATS: '完成得好', TRY_AGAIN: '再试一次', TONIGHT_20_MIN: '今晚一起20分钟' })[code] }
export function formatSeconds(value: number): string { const seconds = Math.max(0, Math.floor(value)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` }
