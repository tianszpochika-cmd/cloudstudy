import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { createAdaptivePerformanceEngine, type PerformanceStrategy } from '@englishflow/performance'
import { MobileApiError } from '../api/client'
import { authorizeB4OfflinePackage, cleanupB4OfflineDownload, createB4GameSession, equipB4Loadout, finishB4GameSession, getB4AvatarProfile, getB4AvatarResources, getB4Profile, getB4Season, getB4Streak, joinB4Room, leaveB4Room, listB4AvatarItems, listB4Games, listB4Loadouts, listB4Notifications, listB4OfflinePackages, listB4Quests, listB4Rooms, pauseB4GameSession, pushB4SyncEvents, readAllB4Notifications, readB4Notification, rescueB4Streak, resumeB4GameSession, saveB4AvatarProfile, saveB4StreakSettings, sendB4Interaction, startB4Focus, submitB4GameEvent, updateB4Focus, updateB4OfflineDownload, getB4GameSession } from '../api/b4'
import { B4_GAME_RELEASE_PHASES, B4_PERFORMANCE_LEVELS, createB4ClientEventId, isRecord, numberValue, recordList, recordValue, stringValue, unwrapB4, type B4AvatarItem, type B4AvatarProfile, type B4AvatarResources, type B4FocusAction, type B4FocusSession, type B4GameCatalogItem, type B4GameCode, type B4GameFinishResult, type B4GameSession, type B4Galaxy, type B4InteractionCode, type B4Loadout, type B4Notification, type B4OfflinePackage, type B4PerformanceLevel, type B4Profile, type B4Quest, type B4Room, type B4Season, type B4Status, type B4Streak, type B4SyncEvent, type B4GameReleasePhase } from '../domain/b4'
import { createB4OfflineQueue } from '../platform/b4-offline'
import { useSessionStore } from './session'
import { getUniRuntime } from '../platform/uni-runtime'
import { createB4ModerationReport, getB4ChestProbability, getB4SocialLeaderboard, listB4Chests, openB4Chest } from '../api/b4'
import { B4_REPORT_REASONS, type B4ChestOpenResult, type B4ChestProbability, type B4Leaderboard, type B4LeaderboardEntry, type B4ModerationReceipt, type B4ReportReason, type B4RewardChest } from '../domain/b4'

const GAME_CODES: readonly B4GameCode[] = ['SENTENCE_TRAIN', 'WORD_MATCH', 'WORD_DEFENSE', 'WORD_PUZZLE', 'GRAMMAR_BLASTER', 'CATCH_MEANING']
function code(value: unknown): B4GameCode | null { return typeof value === 'string' && GAME_CODES.includes(value as B4GameCode) ? value as B4GameCode : null }
function offlineError(error: unknown): boolean { return error instanceof TypeError || error instanceof MobileApiError && (error.status === 0 || error.status >= 500) }
function message(error: unknown, fallback: string): string {
  if (error instanceof MobileApiError && error.status === 401) return '请先登录后查看成长数据。'
  return error instanceof Error && error.message ? error.message : fallback
}
function parseProfile(value: unknown): B4Profile | null { const source = recordValue(unwrapB4(value), 'profile') ?? unwrapB4(value); if (!isRecord(source)) return null; const xp = numberValue(source.xp) ?? numberValue(source.serverScore); const level = numberValue(source.level); const coins = numberValue(source.coins) ?? (source.serverScore !== undefined ? 0 : null); const userId = stringValue(source.userId) ?? stringValue(source.subjectRef) ?? (typeof source.userId === 'number' ? String(source.userId) : null); return xp === null || level === null || coins === null || !userId ? null : { userId, xp, level, coins, rank: stringValue(source.rank) ?? 'UNKNOWN', nextLevelXp: numberValue(source.nextLevelXp), streak: numberValue(source.streak) ?? 0, dailyRewardCount: numberValue(source.dailyRewardCount) ?? 0, ruleVersion: stringValue(source.ruleVersion) }
}
function parseStreak(value: unknown): B4Streak | null { const source = recordValue(unwrapB4(value), 'streak') ?? unwrapB4(value); if (!isRecord(source)) return null; const currentStreak = numberValue(source.currentStreak); return currentStreak === null ? null : { currentStreak, lastValidDate: stringValue(source.lastValidDate), timeZone: stringValue(source.timeZone) ?? 'Asia/Shanghai', weekendProtectionEnabled: source.weekendProtectionEnabled === true, status: stringValue(source.status) ?? 'UNKNOWN' } }
function parseQuest(value: Record<string, unknown>): B4Quest | null { const questId = stringValue(value.questId); return questId ? { questId, period: stringValue(value.period) ?? 'UNKNOWN', title: stringValue(value.title) ?? questId, target: numberValue(value.target) ?? 0, progress: numberValue(value.progress) ?? 0, completed: value.completed === true, claimed: value.claimed === true, xpReward: numberValue(value.xpReward) ?? 0, coinReward: numberValue(value.coinReward) ?? 0 } : null }
/** SEASON_2026_Q4 -> 2026 年第四季度赛季 (the server names seasons by calendar quarter). */
function seasonTitle(seasonId: string): string { const m = /^SEASON_(\d{4})_Q([1-4])$/.exec(seasonId); return m ? `${m[1]} 年第${'一二三四'[Number(m[2]) - 1]}季度赛季` : '本季赛季' }
function parseSeason(value: unknown): B4Season | null { const source = unwrapB4(value); if (!isRecord(source) || !stringValue(source.seasonId)) return null; const tiers = Array.isArray(source.tiers) ? source.tiers.filter(isRecord).map((item) => ({ tier: numberValue(item.tier) ?? 0, requiredPoints: numberValue(item.requiredPoints) ?? 0 })) : []; return { seasonId: stringValue(source.seasonId) as string, title: stringValue(source.title) ?? seasonTitle(stringValue(source.seasonId) as string), status: stringValue(source.status) ?? 'ACTIVE', points: numberValue(source.points) ?? 0, tiers } }
function parseAvatar(value: unknown): B4AvatarProfile | null { const source = recordValue(unwrapB4(value), 'profile') ?? unwrapB4(value); if (!isRecord(source)) return null; const avatarId = stringValue(source.avatarId); const resourceVersion = stringValue(source.resourceVersion); const loadoutId = stringValue(source.loadoutId); return avatarId && resourceVersion && loadoutId ? { avatarId, resourceVersion, loadoutId, renderMode: source.renderMode === '3D' ? '3D' : '2D_FALLBACK' } : null }
function parseItem(value: Record<string, unknown>): B4AvatarItem | null { const itemCode = stringValue(value.itemCode); return itemCode ? { itemCode, quality: stringValue(value.quality) ?? 'UNKNOWN', slot: stringValue(value.slot) ?? 'UNKNOWN', resourceVersion: stringValue(value.resourceVersion) ?? 'UNKNOWN', owned: typeof value.owned === 'boolean' ? value.owned : undefined } : null }
function parseLoadout(value: Record<string, unknown>): B4Loadout | null { const loadoutId = stringValue(value.loadoutId); if (!loadoutId) return null; return { loadoutId, name: stringValue(value.name) ?? loadoutId, equipped: value.equipped === true, items: Array.isArray(value.items) ? value.items.filter((item): item is string => typeof item === 'string') : [] } }
function parseResources(value: unknown): B4AvatarResources | null { const source = unwrapB4(value); if (!isRecord(source) || !stringValue(source.resourceVersion)) return null; const tiers = Array.isArray(source.performanceTiers) ? source.performanceTiers.filter((item): item is B4PerformanceLevel => typeof item === 'string' && B4_PERFORMANCE_LEVELS.includes(item as B4PerformanceLevel)) : [...B4_PERFORMANCE_LEVELS]; return { resourceVersion: stringValue(source.resourceVersion) as string, manifestHash: stringValue(source.manifestHash), fallbackMode: source.fallbackMode === '3D' ? '3D' : '2D_FALLBACK', performanceTiers: tiers } }
function parseGameItem(value: Record<string, unknown>): B4GameCatalogItem | null {
  const gameCode = code(value.gameCode)
  const releasePhase = typeof value.releasePhase === 'string' && B4_GAME_RELEASE_PHASES.includes(value.releasePhase as B4GameReleasePhase)
    ? value.releasePhase as B4GameReleasePhase
    : null
  if (!gameCode || !releasePhase) return null
  return { gameCode, releasePhase, enabled: value.enabled === true, maxMinutes: numberValue(value.maxMinutes), pauseLimitMinutes: numberValue(value.pauseLimitMinutes), passAccuracyPercent: numberValue(value.passAccuracyPercent), passCompletionPercent: numberValue(value.passCompletionPercent) }
}
function parseGame(value: unknown): B4GameSession | null { const source = recordValue(unwrapB4(value), 'session') ?? unwrapB4(value); if (!isRecord(source)) return null; const sessionId = stringValue(source.sessionId); const gameCode = code(source.gameCode); const challenges = Array.isArray(source.challenges) ? source.challenges.filter(isRecord).map((item) => ({ roundNo: numberValue(item.roundNo) ?? 0, itemCode: stringValue(item.itemCode) ?? '', challengeToken: stringValue(item.challengeToken) ?? '' })).filter((item) => item.roundNo > 0 && item.itemCode && item.challengeToken) : []; return sessionId && gameCode ? { sessionId, gameCode, status: stringValue(source.status) ?? 'UNKNOWN', seq: numberValue(source.seq) ?? 0, attemptCount: numberValue(source.attemptCount) ?? 0, createdAt: stringValue(source.createdAt), maxMinutes: numberValue(source.maxMinutes), pauseLimitMinutes: numberValue(source.pauseLimitMinutes), challenges } : null }
function parseFinish(value: unknown): B4GameFinishResult | null { const source = unwrapB4(value); if (!isRecord(source)) return null; const sessionId = stringValue(source.sessionId); const accuracyPercent = numberValue(source.accuracyPercent); const completionPercent = numberValue(source.completionPercent); const serverScore = numberValue(source.serverScore); return sessionId && accuracyPercent !== null && completionPercent !== null && serverScore !== null ? { sessionId, status: stringValue(source.status) ?? 'UNKNOWN', passed: source.passed === true, accuracyPercent, completionPercent, serverScore, rewardEligible: source.rewardEligible === true } : null }
function parseRoom(value: Record<string, unknown>): B4Room | null { const roomId = stringValue(value.roomId); return roomId ? { roomId, name: stringValue(value.name) ?? roomId, templateCode: stringValue(value.templateCode) ?? 'UNKNOWN', capacity: numberValue(value.capacity) ?? 0, memberCount: numberValue(value.memberCount) ?? 0, joined: value.joined === true, chatMode: stringValue(value.chatMode) ?? 'PRESET_ONLY' } : null }
function parseFocus(value: unknown): B4FocusSession | null { const source = recordValue(unwrapB4(value), 'session') ?? unwrapB4(value); if (!isRecord(source)) return null; const sessionId = stringValue(source.sessionId); const roomId = stringValue(source.roomId); return sessionId && roomId ? { sessionId, roomId, status: stringValue(source.status) ?? 'UNKNOWN', startedAt: stringValue(source.startedAt), serverDurationSeconds: numberValue(source.serverDurationSeconds) ?? 0 } : null }
function parseNotification(value: Record<string, unknown>): B4Notification | null { const messageId = stringValue(value.messageId); return messageId ? { messageId, title: stringValue(value.title) ?? '通知', body: stringValue(value.safeBody) ?? '', read: value.read === true, category: stringValue(value.notificationType), createdAt: stringValue(value.createdAt) } : null }
function notificationRows(value: unknown): Array<Record<string, unknown>> { const source = unwrapB4(value); return Array.isArray(source) ? source.filter(isRecord) : recordList(value) }
function identifier(value: unknown): string | null { return stringValue(value) ?? (typeof value === 'number' && Number.isFinite(value) ? String(value) : null) }
function reportReason(value: unknown): B4ReportReason { return typeof value === 'string' && B4_REPORT_REASONS.includes(value as B4ReportReason) ? value as B4ReportReason : 'OTHER' }
function parseChest(value: Record<string, unknown>): B4RewardChest | null { const chestGrantId = stringValue(value.chestGrantId); return chestGrantId ? { chestGrantId, chestType: stringValue(value.chestType) ?? 'UNKNOWN', kind: stringValue(value.kind) ?? 'FREE_LEARNING_REWARD', status: stringValue(value.status) ?? 'UNKNOWN', probabilityVersion: stringValue(value.probabilityVersion), auditId: stringValue(value.auditId), tierCode: stringValue(value.tierCode), itemCode: stringValue(value.itemCode), duplicateConverted: value.duplicateConverted === true, shardAmount: numberValue(value.shardAmount) ?? 0, freeOnly: value.freeOnly !== false, createdAt: stringValue(value.createdAt) } : null }
function parseChestProbability(value: unknown): B4ChestProbability | null { const source = recordValue(unwrapB4(value), 'probability') ?? unwrapB4(value); if (!isRecord(source)) return null; const chestGrantId = stringValue(source.chestGrantId); if (!chestGrantId) return null; const tiers = Array.isArray(source.tiers) ? source.tiers.filter(isRecord).map((tier) => ({ tierCode: stringValue(tier.tierCode) ?? 'UNKNOWN', weightBps: numberValue(tier.weightBps) ?? 0, itemProbabilityMode: stringValue(tier.itemProbabilityMode) ?? 'SERVER_POOL' })) : []; return { chestGrantId, chestType: stringValue(source.chestType) ?? 'UNKNOWN', probabilityVersion: stringValue(source.probabilityVersion), algorithmVersion: stringValue(source.algorithmVersion), tiers, totalWeightBps: numberValue(source.totalWeightBps) ?? 0, probabilitySnapshotHash: stringValue(source.probabilitySnapshotHash), pityEnabled: source.pityEnabled === true } }
function parseChestOpen(value: unknown): B4ChestOpenResult | null { const source = recordValue(unwrapB4(value), 'result') ?? unwrapB4(value); if (!isRecord(source)) return null; const chestGrantId = stringValue(source.chestGrantId); return chestGrantId ? { opened: source.opened === true, replayed: source.replayed === true, auditId: stringValue(source.auditId), chestGrantId, chestType: stringValue(source.chestType) ?? 'UNKNOWN', tierCode: stringValue(source.tierCode), itemCode: stringValue(source.itemCode), duplicateConverted: source.duplicateConverted === true, shardAmount: numberValue(source.shardAmount) ?? 0, probabilityVersion: stringValue(source.probabilityVersion), probabilitySnapshotHash: stringValue(source.probabilitySnapshotHash), balanceAfter: numberValue(source.balanceAfter), ruleVersion: stringValue(source.ruleVersion) } : null }
function parseLeaderboard(value: unknown): B4Leaderboard | null { const source = recordValue(unwrapB4(value), 'leaderboard') ?? unwrapB4(value); if (!isRecord(source)) return null; const roomId = stringValue(source.roomId); if (!roomId) return null; const items = Array.isArray(source.items) ? source.items.filter(isRecord).map((item) => { const userId = identifier(item.userId); return userId ? { userId, completedFocusSeconds: numberValue(item.completedFocusSeconds) ?? 0, status: stringValue(item.status) ?? 'UNKNOWN', displayMode: stringValue(item.displayMode) ?? 'DEIDENTIFIED' } : null }).filter((item): item is B4LeaderboardEntry => Boolean(item)) : []; return { roomId, items, source: stringValue(source.source), serverTime: stringValue(source.serverTime) } }
function parseModerationReceipt(value: unknown): B4ModerationReceipt | null { const source = recordValue(unwrapB4(value), 'report') ?? unwrapB4(value); if (!isRecord(source)) return null; const reportId = stringValue(source.reportId); const targetUserId = identifier(source.targetUserId); return reportId && targetUserId ? { reportId, status: stringValue(source.status) ?? 'RECEIVED', reviewMode: stringValue(source.reviewMode) ?? 'MANUAL', targetUserId, roomId: identifier(source.roomId), reasonCode: reportReason(source.reasonCode), createdAt: stringValue(source.createdAt), appealed: source.appealed === true, appealId: identifier(source.appealId) } : null }
function parsePackage(value: Record<string, unknown>): B4OfflinePackage | null { const packageId = stringValue(value.packageId); return packageId ? { packageId, packageCode: stringValue(value.packageCode) ?? packageId, version: stringValue(value.version) ?? 'UNKNOWN', state: stringValue(value.state) ?? 'UNKNOWN', sizeBytes: numberValue(value.sizeBytes) ?? 0, partCount: numberValue(value.partCount) ?? 0, sha256: stringValue(value.sha256), signature: stringValue(value.signature), minClientVersion: stringValue(value.minClientVersion), downloadId: stringValue(value.downloadId), downloadState: stringValue(value.downloadState), completedPartCount: numberValue(value.completedPartCount) ?? 0, downloadedBytes: numberValue(value.downloadedBytes) ?? 0, signedPartUrls: Array.isArray(value.signedPartUrls) ? value.signedPartUrls.filter((item): item is string => typeof item === 'string') : [], expiresAt: stringValue(value.expiresAt) } : null }

function parseGalaxy(value: unknown): B4Galaxy | null { const source = recordValue(unwrapB4(value), 'growth'); if (!source) return null; const nodes = Array.isArray(source.nodes) ? source.nodes.filter(isRecord).map((item) => ({ nodeCode: stringValue(item.nodeCode) ?? 'UNKNOWN', status: stringValue(item.status) ?? 'UNKNOWN', progress: numberValue(item.progress) ?? 0, requiredProgress: numberValue(item.requiredProgress) ?? 0, progressPercent: numberValue(item.progressPercent) ?? 0 })) : []; const trajectory = Array.isArray(source.trajectory) ? source.trajectory.filter(isRecord).map((item) => ({ sourceEventId: stringValue(item.sourceEventId), updatedAt: stringValue(item.updatedAt) })) : []; return { enabled: source.enabled !== false, totalXp: numberValue(source.totalXp) ?? 0, nodes, trajectory, ruleVersion: stringValue(source.ruleVersion) } }
function parseOfflineAuthorization(value: unknown): B4OfflinePackage | null { const source = unwrapB4(value); if (!isRecord(source)) return null; const manifest = recordValue(source, 'manifest') ?? recordValue(source, 'package') ?? source; return parsePackage({ ...manifest, downloadId: source.downloadId, signedPartUrls: source.signedPartUrls, expiresAt: source.expiresAt }) }

function performanceStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } { return { getItem: (key) => { try { const value = getUniRuntime().getStorageSync(key); return typeof value === 'string' ? value : null } catch { return null } }, setItem: (key, value) => { try { getUniRuntime().setStorageSync(key, value) } catch { /* runtime may not be ready during static analysis */ } } } }

export const useB4Store = defineStore('b4', () => {
  const session = useSessionStore()
  const engine = createAdaptivePerformanceEngine({ storage: performanceStorage() })
  const performanceLevel = ref<B4PerformanceLevel>(engine.level)
  const performanceStrategy = ref<PerformanceStrategy>(engine.state.strategy)
  const status = ref<B4Status>('idle')
  const online = ref(true)
  const lastError = ref<string | null>(null)
  const profile = ref<B4Profile | null>(null); const galaxy = ref<B4Galaxy | null>(null); const streak = ref<B4Streak | null>(null); const quests = ref<B4Quest[]>([]); const season = ref<B4Season | null>(null)
  const avatarProfile = ref<B4AvatarProfile | null>(null); const avatarItems = ref<B4AvatarItem[]>([]); const loadouts = ref<B4Loadout[]>([]); const avatarResources = ref<B4AvatarResources | null>(null)
  const games = ref<B4GameCatalogItem[]>([]); const activeGame = ref<B4GameSession | null>(null); const lastGameResult = ref<B4GameFinishResult | null>(null)
  const rooms = ref<B4Room[]>([]); const activeFocus = ref<B4FocusSession | null>(null); const notifications = ref<B4Notification[]>([]); const notificationStatus = ref<'loading' | 'ready' | 'error'>('loading'); const offlinePackages = ref<B4OfflinePackage[]>([]); const chests = ref<B4RewardChest[]>([]); const chestProbability = ref<B4ChestProbability | null>(null); const lastChestResult = ref<B4ChestOpenResult | null>(null); const leaderboard = ref<B4Leaderboard | null>(null); const lastModerationReport = ref<B4ModerationReceipt | null>(null); const actionKey = ref<string | null>(null)
  const offline = createB4OfflineQueue(); offline.bindSubject(session.verifiedSubject)
  const offlineRecords = ref(offline.records.slice()); const queueCount = computed(() => currentOwner() && offline.subject === session.verifiedSubject ? offlineRecords.value.length : 0); const effectiveAvatarRenderMode = computed<'3D' | '2D_FALLBACK'>(() => performanceLevel.value === 'Performance' ? '2D_FALLBACK' : avatarProfile.value?.renderMode ?? '2D_FALLBACK'); const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level; performanceStrategy.value = state.strategy })
  type Owner = { subject: string; revision: number; feedGeneration: number }
  const staleIdentity = Symbol('B4_STALE_IDENTITY')
  let worldRequest = 0
  let feedGeneration = 0
  function currentOwner(): Owner | null { return session.isAuthenticated && session.verifiedSubject ? { subject: session.verifiedSubject, revision: session.identityRevision, feedGeneration } : null }
  function sameOwner(owner: Owner | null): boolean { return Boolean(owner && session.isAuthenticated && session.verifiedSubject === owner.subject && session.identityRevision === owner.revision && feedGeneration === owner.feedGeneration) }
  async function owned<T>(request: () => Promise<T>, owner = currentOwner()): Promise<T> {
    if (!sameOwner(owner)) throw staleIdentity
    try { const result = await request(); if (!sameOwner(owner)) throw staleIdentity; return result }
    catch (error) { if (!sameOwner(owner)) throw staleIdentity; throw error }
  }
  function clearPersonalViews(): void {
    feedGeneration += 1
    profile.value = null; galaxy.value = null; streak.value = null; quests.value = []; season.value = null
    avatarProfile.value = null; avatarItems.value = []; loadouts.value = []; avatarResources.value = null
    games.value = []; activeGame.value = null; lastGameResult.value = null
    rooms.value = []; activeFocus.value = null; notifications.value = []; notificationStatus.value = 'loading'
    offlinePackages.value = []; chests.value = []; chestProbability.value = null; lastChestResult.value = null
    leaderboard.value = null; lastModerationReport.value = null
  }
  function resetPersonal(): void {
    worldRequest += 1
    clearPersonalViews()
    actionKey.value = null
    status.value = 'idle'; online.value = true; lastError.value = null
    offline.bindSubject(session.verifiedSubject)
    refreshQueue()
  }
  watch(() => session.identityRevision, resetPersonal, { flush: 'sync' })
  function refreshQueue(): void { offlineRecords.value = offline.records.slice() }
  function restore(): void { engine.restore() }
  function setPerformance(level: B4PerformanceLevel): void { engine.setLevel(level, 'manual') }
  function fail(error: unknown, fallback: string): void { if (error === staleIdentity) return; if (offlineError(error)) online.value = false; const httpStatus = error instanceof MobileApiError ? error.status : 0; status.value = offlineError(error) ? 'offline' : httpStatus === 401 || httpStatus === 403 ? 'permission' : httpStatus === 409 ? 'recovery' : 'error'; lastError.value = message(error, fallback) }
  async function guardedAction<T>(key: string, action: () => Promise<T>): Promise<T | undefined> { const owner = currentOwner(); if (!owner || actionKey.value) return undefined; actionKey.value = key; try { return await action() } finally { if (session.verifiedSubject === owner.subject && session.identityRevision === owner.revision && actionKey.value === key) actionKey.value = null } }
  async function loadWorld(): Promise<void> {
    const owner = currentOwner()
    if (!owner) return
    const request = ++worldRequest
    status.value = 'loading'
    lastError.value = null
    notificationStatus.value = 'loading'
    const results = await Promise.allSettled([
      getB4Profile(), getB4Streak(), listB4Quests(), getB4Season(), getB4AvatarProfile(),
      listB4AvatarItems(), listB4Loadouts(), getB4AvatarResources(), listB4Games(), listB4Rooms(),
      // Offline packages are not built yet (client returns unavailable); that is a known
      // coming-soon feature, not a failed read, so it must not raise the partial-failure banner.
      listB4Notifications(), listB4OfflinePackages().catch(() => ({ items: [] })),
    ])
    if (!sameOwner(owner) || request !== worldRequest) return
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    const denied = rejected.find((result) => result.reason instanceof MobileApiError && [401, 403].includes(result.reason.status))
    if (denied) { clearPersonalViews(); notificationStatus.value = 'error'; fail(denied.reason, '当前没有读取学习世界的权限。'); return }
    if (results.slice(0, 11).every((result) => result.status === 'rejected')) { clearPersonalViews(); notificationStatus.value = 'error'; fail(rejected[0].reason, '学习世界暂时无法读取。'); return }
    const value = (index: number, fallback: unknown): unknown => results[index]?.status === 'fulfilled' ? results[index].value : fallback
    const profileRaw = value(0, null)
    profile.value = parseProfile(profileRaw)
    galaxy.value = parseGalaxy(profileRaw)
    streak.value = parseStreak(value(1, null))
    quests.value = recordList(value(2, { items: [] })).map(parseQuest).filter((item): item is B4Quest => Boolean(item))
    season.value = parseSeason(value(3, null))
    avatarProfile.value = parseAvatar(value(4, null))
    avatarItems.value = recordList(value(5, { items: [] })).map(parseItem).filter((item): item is B4AvatarItem => Boolean(item))
    loadouts.value = recordList(value(6, { items: [] })).map(parseLoadout).filter((item): item is B4Loadout => Boolean(item))
    avatarResources.value = parseResources(value(7, null))
    games.value = recordList(value(8, { items: [] })).map(parseGameItem).filter((item): item is B4GameCatalogItem => Boolean(item))
    rooms.value = recordList(value(9, { items: [] })).map(parseRoom).filter((item): item is B4Room => Boolean(item))
    notifications.value = notificationRows(value(10, { items: [] })).map(parseNotification).filter((item): item is B4Notification => Boolean(item))
    notificationStatus.value = results[10]?.status === 'fulfilled' ? 'ready' : 'error'
    offlinePackages.value = recordList(value(11, { items: [] })).map(parsePackage).filter((item): item is B4OfflinePackage => Boolean(item))
    // A failed optional feed does not mean the device is offline when other owner reads succeeded.
    online.value = true
    status.value = 'ready'
    lastError.value = rejected.length ? '部分功能暂不可用，已显示可读取的内容。' : null
    refreshQueue()
  }
  async function loadChests(): Promise<void> { await guardedAction('chests.load', async () => { try { chests.value = recordList(await owned(() => listB4Chests())).map(parseChest).filter((item): item is B4RewardChest => Boolean(item)); status.value = chests.value.length ? 'ready' : 'empty'; lastError.value = chests.value.length ? null : '服务端当前没有待开启奖励箱。' } catch (error) { fail(error, '奖励箱读取失败，未使用本地奖励数据。') } }) }
  async function loadChestProbability(chestGrantId: string): Promise<void> { if (!chestGrantId.trim()) return; await guardedAction(`chest.probability.${chestGrantId}`, async () => { try { chestProbability.value = parseChestProbability(await owned(() => getB4ChestProbability(chestGrantId))); status.value = chestProbability.value ? 'ready' : 'error'; lastError.value = chestProbability.value ? null : '服务端未返回概率快照。' } catch (error) { fail(error, '奖励概率读取失败；未进行客户端抽取。') } }) }
  async function openChest(chestGrantId: string): Promise<void> { if (!chestGrantId.trim()) return; await guardedAction(`chest.open.${chestGrantId}`, async () => { try { const result = parseChestOpen(await owned(() => openB4Chest(chestGrantId))); if (!result) { status.value = 'error'; lastError.value = '服务端未返回奖励箱开启结果。'; return }; lastChestResult.value = result; chests.value = chests.value.map((item) => item.chestGrantId === chestGrantId && result.opened ? { ...item, status: 'OPENED', tierCode: result.tierCode, itemCode: result.itemCode, duplicateConverted: result.duplicateConverted, shardAmount: result.shardAmount, auditId: result.auditId, probabilityVersion: result.probabilityVersion } : item); status.value = 'success'; lastError.value = result.replayed ? '服务端返回了幂等重放结果。' : '奖励箱开启结果已由服务端确认。' } catch (error) { fail(error, '奖励箱开启失败，未在本地增加任何 XP、星币或奖励。') } }) }
  async function loadLeaderboard(roomId: string): Promise<void> { if (!roomId.trim()) return; await guardedAction(`leaderboard.${roomId}`, async () => { try { leaderboard.value = parseLeaderboard(await owned(() => getB4SocialLeaderboard(roomId))); status.value = leaderboard.value?.items.length ? 'ready' : 'empty'; lastError.value = leaderboard.value ? (leaderboard.value.items.length ? null : '当前房间暂无可展示的专注快照。') : '服务端未返回排行榜快照。' } catch (error) { fail(error, '排行榜读取失败；未在本地计算或修改排名。') } }) }
  async function reportUser(reasonCode: B4ReportReason, targetUserId: string, roomId?: string): Promise<void> { if (!B4_REPORT_REASONS.includes(reasonCode) || !targetUserId.trim() || targetUserId === profile.value?.userId) { lastError.value = '举报对象或预设原因无效；未提交请求。'; return }; await guardedAction(`report.${targetUserId}.${reasonCode}`, async () => { try { const receipt = parseModerationReceipt(await owned(() => createB4ModerationReport(reasonCode, targetUserId, roomId))); lastModerationReport.value = receipt; status.value = receipt ? 'success' : 'error'; lastError.value = receipt ? '举报已进入服务端审核队列。' : '服务端未返回举报回执。' } catch (error) { fail(error, '举报提交失败；未使用自由文本或本地审核结果。') } }) }
  async function saveStreakSettings(timeZone: string, weekendProtectionEnabled: boolean): Promise<void> { try { streak.value = parseStreak(await owned(() => saveB4StreakSettings(timeZone, weekendProtectionEnabled))); status.value = 'ready'; lastError.value = 'Streak 设置已由服务端确认。' } catch (error) { fail(error, 'Streak 设置保存失败，当前变更未标记为已同步。') } }
  async function rescueStreak(method: 'CARD' | 'CHALLENGE'): Promise<void> { try { streak.value = parseStreak(await owned(() => rescueB4Streak(method))); status.value = 'ready'; lastError.value = '破冰请求已由服务端返回结果。' } catch (error) { fail(error, '破冰请求失败，Streak 状态未在本地自行修改。') } }
  async function saveAvatarProfile(renderMode: '3D' | '2D_FALLBACK'): Promise<void> { try { avatarProfile.value = parseAvatar(await owned(() => saveB4AvatarProfile(renderMode, avatarProfile.value?.resourceVersion))); status.value = avatarProfile.value ? 'ready' : 'error'; lastError.value = avatarProfile.value ? 'Avatar 渲染模式已由服务端确认。' : '服务端未返回 Avatar 配置。' } catch (error) { fail(error, 'Avatar 渲染模式保存失败。') } }
  async function equipLoadout(loadoutId: string): Promise<void> { try { const source = unwrapB4(await owned(() => equipB4Loadout(loadoutId))); if (isRecord(source) && source.equipped === true) { loadouts.value = loadouts.value.map((item) => ({ ...item, equipped: item.loadoutId === loadoutId })); if (avatarProfile.value) avatarProfile.value = { ...avatarProfile.value, loadoutId }; status.value = 'ready'; lastError.value = '衣柜装备状态已由服务端确认。' } else { status.value = 'error'; lastError.value = '服务端未返回装备确认。' } } catch (error) { fail(error, '衣柜装备失败。') } }
  async function startGame(gameCode: B4GameCode): Promise<void> { lastGameResult.value = null; try { activeGame.value = parseGame(await owned(() => createB4GameSession(gameCode, performanceLevel.value))); status.value = activeGame.value ? 'ready' : 'error'; lastError.value = activeGame.value ? null : '服务端未返回游戏会话。' } catch (error) { fail(error, '游戏会话创建失败，未生成本地伪造会话。') } }
  async function refreshGame(): Promise<void> { if (!activeGame.value) return; try { activeGame.value = parseGame(await owned(() => getB4GameSession(activeGame.value!.sessionId))); status.value = 'ready' } catch (error) { fail(error, '游戏会话刷新失败。') } }
  async function submitGameEvent(responseToken: string, itemCode?: string): Promise<void> { if (!activeGame.value) { lastError.value = '请先创建服务端游戏会话。'; return }; if (!responseToken.trim()) { lastError.value = '题包未返回 responseToken，未提交空答案。'; return }; const challenge = activeGame.value.challenges.find((item) => item.roundNo === activeGame.value!.attemptCount + 1); const resolvedItemCode = itemCode?.trim() || challenge?.itemCode; if (!resolvedItemCode) { lastError.value = '当前回合没有服务端 itemCode；未提交不完整答案。'; return }; try { activeGame.value = parseGame(await owned(() => submitB4GameEvent(activeGame.value!.sessionId, activeGame.value!.seq + 1, responseToken.trim(), resolvedItemCode))) ?? activeGame.value; status.value = 'ready'; lastError.value = '本回合已收到服务端响应。' } catch (error) { fail(error, '游戏回合提交失败，未显示为完成。') } }
  async function pauseGame(): Promise<void> { if (!activeGame.value) return; try { activeGame.value = parseGame(await owned(() => pauseB4GameSession(activeGame.value!.sessionId))) ?? activeGame.value; status.value = 'ready' } catch (error) { fail(error, '游戏暂停未获服务端确认。') } }
  async function resumeGame(): Promise<void> { if (!activeGame.value) return; try { activeGame.value = parseGame(await owned(() => resumeB4GameSession(activeGame.value!.sessionId))) ?? activeGame.value; status.value = 'ready' } catch (error) { fail(error, '游戏恢复未获服务端确认。') } }
  async function finishGame(): Promise<void> { if (!activeGame.value) return; try { lastGameResult.value = parseFinish(await owned(() => finishB4GameSession(activeGame.value!.sessionId))); activeGame.value = null; status.value = 'ready'; lastError.value = lastGameResult.value ? '游戏结果已由服务端返回。' : '服务端未返回最终结果。' } catch (error) { fail(error, '游戏结束未获服务端确认。') } }
  async function joinRoom(roomId: string): Promise<void> { try { const source = recordValue(unwrapB4(await owned(() => joinB4Room(roomId))), 'room'); const room = source ? parseRoom(source) : null; if (room) rooms.value = rooms.value.map((item) => item.roomId === room.roomId ? room : item); status.value = 'ready'; lastError.value = room ? '入室状态已由服务端确认。' : '服务端未返回入室快照。' } catch (error) { fail(error, '加入自习室失败。') } }
  async function leaveRoom(roomId: string): Promise<void> { try { await owned(() => leaveB4Room(roomId)); rooms.value = rooms.value.map((item) => item.roomId === roomId ? { ...item, joined: false } : item); if (activeFocus.value?.roomId === roomId) activeFocus.value = null; status.value = 'ready'; lastError.value = '离室状态已由服务端确认。' } catch (error) { fail(error, '离开自习室失败。') } }
  async function startFocus(roomId: string, durationMinutes: 25 | 45 = 25): Promise<void> { if (!roomId) { lastError.value = '请先加入自习室。'; return }; try { activeFocus.value = parseFocus(await owned(() => startB4Focus(roomId, durationMinutes))); status.value = activeFocus.value ? 'ready' : 'error'; lastError.value = activeFocus.value ? '番茄专注已由服务端建立。' : '服务端未返回专注 session。' } catch (error) { fail(error, '番茄专注启动失败。') } }
  async function updateFocus(action: B4FocusAction): Promise<void> { if (!activeFocus.value) return; try { activeFocus.value = parseFocus(await owned(() => updateB4Focus(activeFocus.value!.roomId, activeFocus.value!.sessionId, action))); status.value = 'ready'; lastError.value = '专注状态已由服务端确认。' } catch (error) { fail(error, '专注状态更新失败。') } }
  async function sendInteraction(roomId: string, interactionCode: B4InteractionCode): Promise<void> { await guardedAction(`interaction.${roomId}.${interactionCode}`, async () => { try { await owned(() => sendB4Interaction(roomId, interactionCode)); status.value = 'ready'; lastError.value = '预设鼓励已收到服务端确认。' } catch (error) { if (!offlineError(error)) { fail(error, '预设互动发送失败。'); return }; const event: B4SyncEvent = { clientEventId: createB4ClientEventId('b4-interaction'), eventType: 'social.interaction.sent.v1', occurredAt: new Date().toISOString(), entityId: roomId, entityVersion: 0, payload: { roomId, interactionCode } }; const saved = offline.enqueue(event); refreshQueue(); online.value = false; status.value = 'offline'; lastError.value = saved ? '网络不可用，互动待同步。' : '离线保存失败，请重试。' } }) }
  async function readNotification(messageId: string): Promise<void> { await guardedAction(`notification.read.${messageId}`, async () => { try { await owned(() => readB4Notification(messageId)); notifications.value = notifications.value.map((item) => item.messageId === messageId ? { ...item, read: true } : item); status.value = 'ready' } catch (error) { fail(error, '通知已读状态未获服务端确认。') } }) }
  async function readAllNotifications(): Promise<void> { await guardedAction('notification.read-all', async () => { try { await owned(() => readAllB4Notifications()); notifications.value = notifications.value.map((item) => ({ ...item, read: true })); status.value = 'ready'; lastError.value = '全部已读状态已由服务端确认。' } catch (error) { fail(error, '全部已读操作未获服务端确认。') } }) }
  async function authorizeOfflinePackage(packageId: string): Promise<void> { try { const item = parseOfflineAuthorization(await owned(() => authorizeB4OfflinePackage(packageId))); if (item) offlinePackages.value = offlinePackages.value.map((entry) => entry.packageId === item.packageId ? item : entry); status.value = 'ready'; lastError.value = item ? '离线包授权已由服务端确认；资源下载仍需真实清单和校验。' : '服务端未返回授权状态。' } catch (error) { fail(error, '离线包授权失败，未显示为已下载。') } }
  async function updateOfflineDownload(downloadId: string, action: 'PAUSE' | 'RESUME' | 'PART_RECEIVED', partIndex?: number, etag?: string): Promise<void> { try { const source = recordValue(unwrapB4(await owned(() => updateB4OfflineDownload(downloadId, action, partIndex, etag))), 'download'); if (source) offlinePackages.value = offlinePackages.value.map((item) => item.downloadId === downloadId ? parsePackage({ ...item, ...source }) ?? item : item); status.value = 'ready'; lastError.value = '离线包下载状态已由服务端确认。' } catch (error) { fail(error, '离线包下载状态更新失败，未在本地标记为成功。') } }
  async function cleanupOfflineDownload(downloadId: string): Promise<void> { try { await owned(() => cleanupB4OfflineDownload(downloadId)); offlinePackages.value = offlinePackages.value.map((item) => item.downloadId === downloadId ? { ...item, downloadState: 'CLEANED', completedPartCount: 0, downloadedBytes: 0 } : item); status.value = 'ready'; lastError.value = '离线包临时分片已由服务端确认清理。' } catch (error) { fail(error, '离线包清理失败，未在本地删除未确认资源。') } }
  async function syncOffline(): Promise<void> {
    const owner = currentOwner()
    if (!owner || offline.subject !== owner.subject) return
    const pending = offline.records.filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
    if (!pending.length) { lastError.value = '当前没有待同步事件。'; return }
    if (!online.value) { status.value = 'offline'; lastError.value = '网络不可用，队列仍保留。'; return }
    pending.forEach((item) => offline.markSyncing(item.id))
    refreshQueue()
    try {
      const result = unwrapB4(await owned(() => pushB4SyncEvents(pending.map((item) => item.event)), owner))
      const accepted = isRecord(result) && result.accepted === true
      const acceptedIds = isRecord(result) && Array.isArray(result.acceptedEventIds) ? result.acceptedEventIds.filter((item): item is string => typeof item === 'string') : accepted ? pending.map((item) => item.id) : []
      if (acceptedIds.length) offline.remove(acceptedIds)
      pending.filter((item) => !acceptedIds.includes(item.id)).forEach((item) => offline.markFailed(item.id, '服务端未接受该事件。'))
      refreshQueue()
      online.value = true
      status.value = acceptedIds.length ? 'ready' : 'error'
      lastError.value = acceptedIds.length ? `服务端已接受 ${acceptedIds.length} 条事件。` : '服务端未接受事件，队列已保留。'
    } catch (error) {
      if (!sameOwner(owner)) {
        if (session.verifiedSubject === owner.subject && session.identityRevision === owner.revision && offline.subject === owner.subject) {
          pending.forEach((item) => offline.markFailed(item.id, '同步状态待确认，请重试。'))
          refreshQueue()
        }
        return
      }
      pending.forEach((item) => offline.markFailed(item.id, message(error, '同步请求失败')))
      refreshQueue()
      fail(error, '待同步事件提交失败，队列仍保留。')
    }
  }
  return { status, online, lastError, profile, galaxy, streak, quests, season, avatarProfile, avatarItems, loadouts, avatarResources, games, activeGame, lastGameResult, rooms, activeFocus, notifications, notificationStatus, offlinePackages, chests, chestProbability, lastChestResult, leaderboard, lastModerationReport, actionKey, performanceLevel, performanceStrategy, effectiveAvatarRenderMode, offlineRecords, queueCount, restore, setPerformance, loadWorld, loadChests, loadChestProbability, openChest, loadLeaderboard, reportUser, saveStreakSettings, rescueStreak, saveAvatarProfile, equipLoadout, startGame, refreshGame, submitGameEvent, pauseGame, resumeGame, finishGame, joinRoom, leaveRoom, startFocus, updateFocus, sendInteraction, readNotification, readAllNotifications, authorizeOfflinePackage, updateOfflineDownload, cleanupOfflineDownload, syncOffline, dispose: () => { unsubscribe(); engine.dispose() } }
})
