<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MobileApiError } from '../../api/client'
import { useB4Store } from '../../stores/b4'
import { B12_REPORT_REASONS, createB12SocialReport, getB12SocialLeaderboard, listB12Notifications, type B12Leaderboard, type B12ReportReason } from '../../api/b12'
import { b12T } from '../../platform/b12-i18n'
import { openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

type B12ViewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'unauthenticated' | 'permission' | 'offline' | 'recovery' | 'error'
const b4 = useB4Store(); const session = useSessionStore(); const roomIndex = ref(0); const leaderboard = ref<B12Leaderboard | null>(null); const reportReason = ref<B12ReportReason>('SPAM'); const reasons = [...B12_REPORT_REASONS]; const status = ref<B12ViewStatus>('idle'); const actionKey = ref<string | null>(null); const reportPendingKey = ref<string | null>(null); const lastError = ref<string | null>(null); const lastReport = ref<{ reportId: string; roomId: string; targetSeatIndex: number; status: string; reviewMode: 'MANUAL' } | null>(null); const notificationCount = ref<number | null>(null); const lastLoadedRoomId = ref('')
const roomNames = computed(() => b4.rooms.map((room) => room.name)); const selectedRoomId = computed(() => b4.rooms[roomIndex.value]?.roomId ?? '')
const canReadLeaderboard = computed(() => session.permissions.includes('social.leaderboard.read'))
const canCreateSocialReport = computed(() => session.permissions.includes('social.report.create.self'))
const canReadNotifications = computed(() => session.permissions.includes('notification.message.read.self'))
const permissionKey = computed(() => [...session.permissions].sort().join('\u0000'))
const reportableEntries = computed(() => leaderboard.value?.entries.some((entry) => !entry.isSelf && Boolean(entry.targetSeatIndex)) ?? false)
const reportPendingRequest = ref<number | null>(null)
type UncertainReportRetry = { subject: string; revision: number; permissions: string; viewVersion: number; roomId: string; targetSeatIndex: number; reasonCode: B12ReportReason; clientEventId: string }
const uncertainReportRetry = ref<UncertainReportRetry | null>(null)
const reportReceiptStatuses = ['RECEIVED', 'TRIAGED', 'ACTIONED', 'REJECTED', 'APPEALED', 'CLOSED'] as const
let localReportEventSequence = 0
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function sourceOf(value: unknown): Record<string, unknown> { const root = isRecord(value) && isRecord(value.data) ? value.data : value; return isRecord(root) ? root : {} }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value : fallback }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function errorStatus(error: unknown): B12ViewStatus { if (error instanceof MobileApiError) return error.status === 0 ? 'offline' : error.status === 401 ? 'unauthenticated' : error.status === 403 ? 'permission' : error.status === 409 ? 'recovery' : 'error'; return 'error' }
function errorMessage(error: unknown, fallback: string): string { if (error instanceof MobileApiError && error.status === 401) return '请先登录后查看社交数据。'; return error instanceof Error && error.message ? error.message : fallback }
function parseLeaderboard(value: unknown): B12Leaderboard | null { const root = sourceOf(value); if (!Array.isArray(root.entries)) return null; return { kind: text(root.kind, 'FOCUS_MINUTES'), period: text(root.period, 'DAY'), entries: root.entries.filter(isRecord).map((entry) => ({ rank: number(entry.rank), displayMode: text(entry.displayMode, 'ANONYMOUS'), displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined, score: number(entry.score), qualifiedUnits: number(entry.qualifiedUnits), isSelf: entry.isSelf === true, targetSeatIndex: typeof entry.targetSeatIndex === 'number' ? entry.targetSeatIndex : undefined })).filter((entry) => entry.rank > 0) } }
function parseReportReceipt(value: unknown, expectedRoomId: string, expectedSeatIndex: number, expectedReason: B12ReportReason, expectedClientEventId: string): { reportId: string; roomId: string; targetSeatIndex: number; status: typeof reportReceiptStatuses[number]; reviewMode: 'MANUAL' } | null {
  const envelope = sourceOf(value)
  const root = isRecord(envelope.report) ? envelope.report : envelope
  const idempotentReplay = envelope.idempotentReplay === true || root.idempotentReplay === true
  const reportId = text(root.reportId)
  const roomId = text(root.roomId)
  const targetSeatIndex = number(root.targetSeatIndex, -1)
  const reasonCode = text(root.reasonCode)
  const receiptStatus = text(root.status)
  const reviewMode = text(root.reviewMode)
  const createdAt = text(root.createdAt)
  const updatedAt = text(root.updatedAt)
  const clientEventId = text(root.clientEventId)
  const validStatus = reportReceiptStatuses.includes(receiptStatus as typeof reportReceiptStatuses[number])
  const createdAtTime = Date.parse(createdAt)
  const updatedAtTime = Date.parse(updatedAt)
  const validDates = Number.isFinite(createdAtTime) && Number.isFinite(updatedAtTime) && updatedAtTime >= createdAtTime
  if (!reportId || roomId !== expectedRoomId || !Number.isInteger(targetSeatIndex) || targetSeatIndex !== expectedSeatIndex
    || reasonCode !== expectedReason || !validStatus || reviewMode !== 'MANUAL' || !validDates || !clientEventId
    || (clientEventId !== expectedClientEventId && !idempotentReplay)) return null
  return { reportId, roomId, targetSeatIndex, status: receiptStatus as typeof reportReceiptStatuses[number], reviewMode: 'MANUAL' }
}
type Owner = { subject: string; revision: number; accessToken: string; permissions: string; viewVersion: number }
let viewVersion = 0
let leaderboardRequest = 0
let notificationRequest = 0
let reportRequest = 0
let roomSelectionVersion = 0
let observedRoomId = ''
function currentOwner(): Owner | null {
  const identity = session.getMobileApiIdentity()
  if (!identity || !session.isAuthenticated || !session.accessToken) return null
  return { ...identity, accessToken: session.accessToken, permissions: permissionKey.value, viewVersion }
}
function sameOwner(owner: Owner | null): boolean {
  const current = currentOwner()
  return Boolean(owner && current && owner.subject === current.subject && owner.revision === current.revision
    && owner.accessToken === current.accessToken && owner.permissions === current.permissions && owner.viewVersion === current.viewVersion)
}
function sameReportRetry(retry: UncertainReportRetry | null, owner: Owner | null, roomId: string, targetSeatIndex: number, reasonCode: B12ReportReason): boolean {
  return Boolean(retry && owner && retryMatchesOwner(retry, owner)
    && retry.roomId === roomId && retry.targetSeatIndex === targetSeatIndex && retry.reasonCode === reasonCode)
}
function retryMatchesOwner(retry: UncertainReportRetry | null, owner: Owner | null): boolean {
  return Boolean(retry && owner && retry.subject === owner.subject && retry.revision === owner.revision
    && retry.permissions === owner.permissions && retry.viewVersion === owner.viewVersion)
}
function retryMatchesConfirmedScope(retry: UncertainReportRetry | null): boolean {
  const identity = session.getMobileApiIdentity()
  return Boolean(retry && identity && retry.subject === identity.subject && retry.revision === identity.revision
    && retry.permissions === permissionKey.value && retry.viewVersion === viewVersion)
}
function newReportClientEventId(): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${++localReportEventSequence}`
  return `b12-report-${randomId}`
}
function isDefiniteReportRejection(error: unknown): boolean {
  return error instanceof MobileApiError && error.status >= 400 && error.status < 500 && error.status !== 408
}
function makeUncertainReportRetry(owner: Owner, roomId: string, targetSeatIndex: number, reasonCode: B12ReportReason, clientEventId: string): UncertainReportRetry {
  return { subject: owner.subject, revision: owner.revision, permissions: owner.permissions, viewVersion: owner.viewVersion, roomId, targetSeatIndex, reasonCode, clientEventId }
}
function clearPersonal(preservedRetry: UncertainReportRetry | null = null): void {
  viewVersion += 1
  leaderboardRequest += 1
  notificationRequest += 1
  reportRequest += 1
  roomSelectionVersion += 1
  leaderboard.value = null
  notificationCount.value = null
  lastReport.value = null
  uncertainReportRetry.value = preservedRetry ? { ...preservedRetry, viewVersion } : null
  reportPendingKey.value = null
  reportPendingRequest.value = null
  lastLoadedRoomId.value = ''
  actionKey.value = null
  status.value = 'idle'
  lastError.value = null
}
function reloadCurrentOwner(): void {
  const owner = currentOwner()
  if (!owner) {
    status.value = session.status === 'refreshing' ? 'loading' : session.isAuthenticated ? 'permission' : 'unauthenticated'
    return
  }
  if (uncertainReportRetry.value && !retryMatchesOwner(uncertainReportRetry.value, owner)) uncertainReportRetry.value = null
  const version = viewVersion
  void nextTick(() => { if (version === viewVersion && sameOwner(owner)) reloadForCurrentOwner(owner) })
}
function handleAccessTokenChange(nextToken: string | null, previousToken: string | null): void {
  if (nextToken === previousToken || session.status === 'refreshing') return
  if (!nextToken || session.status !== 'authenticated') {
    clearPersonal()
    reloadCurrentOwner()
    return
  }
  const owner = currentOwner()
  const retry = uncertainReportRetry.value
  clearPersonal(retryMatchesOwner(retry, owner) ? retry : null)
  reloadCurrentOwner()
}
function handleSessionStatusChange(nextStatus: string, previousStatus: string): void {
  if (nextStatus === 'refreshing') {
    const retry = previousStatus === 'authenticated' && retryMatchesConfirmedScope(uncertainReportRetry.value)
      ? uncertainReportRetry.value
      : null
    clearPersonal(retry)
    status.value = 'loading'
    return
  }
  if (nextStatus === 'authenticated') {
    reloadCurrentOwner()
    return
  }
  clearPersonal()
  status.value = nextStatus === 'unauthenticated' ? 'unauthenticated' : nextStatus === 'error' ? 'error' : 'idle'
}
async function loadLeaderboard(roomId: string, owner = currentOwner()): Promise<void> {
  if (!roomId || !sameOwner(owner) || actionKey.value === `leaderboard.${roomId}`) return
  if (!canReadLeaderboard.value) { leaderboard.value = null; status.value = 'permission'; return }
  const request = ++leaderboardRequest
  lastLoadedRoomId.value = roomId; leaderboard.value = null; lastError.value = null; actionKey.value = `leaderboard.${roomId}`; status.value = 'loading'
  try {
    const result = parseLeaderboard(await getB12SocialLeaderboard(roomId))
    if (!sameOwner(owner) || request !== leaderboardRequest || selectedRoomId.value !== roomId) return
    leaderboard.value = result
    status.value = result?.entries.length ? 'success' : 'empty'
  } catch (error) {
    if (!sameOwner(owner) || request !== leaderboardRequest || selectedRoomId.value !== roomId) return
    if (error instanceof MobileApiError && (error.status === 401 || error.status === 403)) leaderboard.value = null
    status.value = errorStatus(error); lastError.value = errorMessage(error, '排行榜读取失败；未在本地计算或修改排名。')
  } finally { if (sameOwner(owner) && request === leaderboardRequest && actionKey.value === `leaderboard.${roomId}`) actionKey.value = null }
}
function activateRoom(roomId: string): void {
  if (observedRoomId === roomId) {
    if (roomId && roomId !== lastLoadedRoomId.value) void loadLeaderboard(roomId)
    return
  }
  observedRoomId = roomId
  roomSelectionVersion += 1
  leaderboardRequest += 1
  leaderboard.value = null
  lastReport.value = null
  uncertainReportRetry.value = null
  lastError.value = null
  lastLoadedRoomId.value = ''
  actionKey.value = null
  if (roomId) void loadLeaderboard(roomId)
}
function selectRoom(event: { detail: { value: number } }): void { roomIndex.value = Number(event.detail.value) || 0; activateRoom(selectedRoomId.value) }
async function report(entry: { targetSeatIndex?: number; isSelf: boolean }): Promise<void> {
  const owner = currentOwner()
  const roomId = selectedRoomId.value
  const targetSeatIndex = entry.targetSeatIndex ?? -1
  const reasonCode = reportReason.value
  if (uncertainReportRetry.value && !sameReportRetry(uncertainReportRetry.value, owner, roomId, targetSeatIndex, reasonCode)) uncertainReportRetry.value = null
  if (!sameOwner(owner) || !canCreateSocialReport.value || reportPendingRequest.value !== null || entry.isSelf || !entry.targetSeatIndex || !roomId || actionKey.value) return
  const roomVersion = roomSelectionVersion
  const retry = uncertainReportRetry.value
  const clientEventId = sameReportRetry(retry, owner, roomId, targetSeatIndex, reasonCode) ? retry!.clientEventId : newReportClientEventId()
  const request = ++reportRequest
  const key = `report.${roomId}.${targetSeatIndex}`
  reportPendingKey.value = key
  reportPendingRequest.value = request
  actionKey.value = key
  lastReport.value = null
  lastError.value = null
  uncertainReportRetry.value = makeUncertainReportRetry(owner, roomId, targetSeatIndex, reasonCode, clientEventId)
  try {
    const value = await createB12SocialReport(roomId, targetSeatIndex, reasonCode, clientEventId)
    if (!sameOwner(owner) || request !== reportRequest || roomVersion !== roomSelectionVersion || selectedRoomId.value !== roomId || reportReason.value !== reasonCode) return
    const receipt = parseReportReceipt(value, roomId, targetSeatIndex, reasonCode, clientEventId)
    if (!receipt) { uncertainReportRetry.value = makeUncertainReportRetry(owner!, roomId, targetSeatIndex, reasonCode, clientEventId); status.value = 'recovery'; lastError.value = b12T('social.reportUncertain'); return }
    uncertainReportRetry.value = null
    lastReport.value = receipt; status.value = 'success'; lastError.value = null
  } catch (error) {
    if (!sameOwner(owner) || request !== reportRequest || roomVersion !== roomSelectionVersion || selectedRoomId.value !== roomId || reportReason.value !== reasonCode) return
    if (isDefiniteReportRejection(error)) uncertainReportRetry.value = null
    else uncertainReportRetry.value = makeUncertainReportRetry(owner!, roomId, targetSeatIndex, reasonCode, clientEventId)
    if (error instanceof MobileApiError && (error.status === 401 || error.status === 403)) lastReport.value = null
    status.value = errorStatus(error); lastError.value = errorMessage(error, '举报提交失败；未使用自由文本或本地审核结果。')
  } finally {
    if (reportPendingRequest.value === request) { reportPendingRequest.value = null; reportPendingKey.value = null }
    if (sameOwner(owner) && request === reportRequest && actionKey.value === key) actionKey.value = null
  }
}
function selectReason(event: { detail: { value: number } }): void { const nextReason = reasons[Number(event.detail.value)] ?? 'SPAM'; if (nextReason !== reportReason.value) uncertainReportRetry.value = null; reportReason.value = nextReason }
function openLogin(): void { openUniPage('/pages/login/login') }
async function loadNotificationCount(owner = currentOwner()): Promise<void> {
  if (!sameOwner(owner) || !canReadNotifications.value) { notificationCount.value = null; return }
  const request = ++notificationRequest
  notificationCount.value = null
  try {
    const messages = await listB12Notifications()
    if (!sameOwner(owner) || request !== notificationRequest) return
    const envelope = isRecord(messages) ? messages.data : undefined
    const root = sourceOf(messages)
    const items = Array.isArray(messages) ? messages : Array.isArray(envelope) ? envelope : Array.isArray(root.items) ? root.items : []
    notificationCount.value = items.length
  } catch {
    if (sameOwner(owner) && request === notificationRequest) notificationCount.value = null
  }
}
function reloadForCurrentOwner(owner: Owner | null): void {
  if (!sameOwner(owner)) return
  if (canReadNotifications.value) void loadNotificationCount(owner)
  if (!canReadLeaderboard.value) { status.value = session.isAuthenticated ? 'permission' : 'idle'; return }
  if (selectedRoomId.value) void loadLeaderboard(selectedRoomId.value, owner)
}
watch([() => session.verifiedSubject, () => session.identityRevision, permissionKey], () => {
  clearPersonal()
  reloadCurrentOwner()
}, { flush: 'sync', immediate: true })
watch(() => session.accessToken, handleAccessTokenChange, { flush: 'sync' })
watch(() => session.status, handleSessionStatusChange, { flush: 'sync' })
watch(() => b4.rooms, (rooms) => {
  if (roomIndex.value >= rooms.length) roomIndex.value = 0
  activateRoom(selectedRoomId.value)
}, { deep: true, immediate: true })
onBeforeUnmount(clearPersonal)
</script>

<template>
  <view class="b12-card"><view class="b12-heading"><view><text class="b12-kicker">{{ b12T('social.kicker') }}</text><text class="b12-title">{{ b12T('social.leaderboard') }}</text></view><text class="b12-muted">{{ b12T('social.privacy') }}</text></view><picker v-if="roomNames.length" :range="roomNames" :value="roomIndex" @change="selectRoom"><view class="b12-picker">{{ roomNames[roomIndex] }}</view></picker><view v-if="actionKey?.startsWith('leaderboard.')" class="b12-state-box">{{ b12T('social.loadingLeaderboard') }}</view><view v-else-if="leaderboard?.entries.length" class="b12-list"><view v-for="entry in leaderboard.entries" :key="`${entry.rank}-${entry.targetSeatIndex ?? 'global'}`" class="b12-entry"><view><text class="b12-strong">#{{ entry.rank }} · {{ entry.displayName ?? b12T('social.anonymousMember') }}</text><text class="b12-muted">{{ entry.displayMode }} · {{ b12T('social.focusSeconds') }} {{ entry.qualifiedUnits * 60 }}s</text></view><button tabindex="0" role="button" v-if="canCreateSocialReport && !entry.isSelf && entry.targetSeatIndex" class="b12-button secondary" type="button" :disabled="Boolean(actionKey) || Boolean(reportPendingKey) || !b4.online" @click="report(entry)">{{ reportPendingKey === `report.${selectedRoomId}.${entry.targetSeatIndex}` ? b12T('social.submittingReport') : b12T('social.report') }}</button><text v-else class="b12-muted">{{ entry.isSelf ? b12T('social.noSelfReport') : b12T('social.privacy') }}</text></view></view><text v-else class="b12-state-box">{{ selectedRoomId ? b12T('social.emptyLeaderboard') : b12T('social.noRooms') }}</text><picker v-if="reportableEntries && canCreateSocialReport" :range="reasons" :value="reasons.indexOf(reportReason)" @change="selectReason"><view class="b12-picker">{{ b12T('social.reportReason') }}：{{ reportReason }}</view></picker><text v-if="lastReport && lastReport.roomId === selectedRoomId" class="b12-result">{{ b12T('social.reportReceived') }} · {{ lastReport.status }} · {{ lastReport.reviewMode }}</text><text v-if="status === 'permission'" class="b12-state-box">{{ b12T('status.permission') }}</text><button tabindex="0" role="button" v-if="status === 'unauthenticated'" class="b12-button secondary" type="button" @click="openLogin">{{ b12T('status.login') }}</button><text v-else-if="status === 'offline'" class="b12-state-box">{{ b12T('status.offline') }}</text><text v-else-if="status === 'recovery'" class="b12-state-box">{{ lastError ?? b12T('status.recovery') }}</text><text v-else-if="lastError" class="b12-state-box">{{ lastError }}</text></view>
  <view class="b12-card"><view class="b12-heading"><view><text class="b12-kicker">{{ b12T('notifications.kicker') }}</text><text class="b12-title">{{ b12T('notifications.preferences') }}</text></view><text class="b12-muted">{{ notificationCount === null ? b12T('notifications.notLoaded') : b12T('notifications.loadedCount', { count: notificationCount }) }}</text></view><text class="b12-muted">{{ b12T('notifications.hint') }}</text><navigator class="b12-settings-link" url="/pages/settings/settings">{{ b12T('notifications.preferences') }} ›</navigator></view>
</template>

<style scoped lang="scss">
.b12-card{display:grid;gap:16rpx;margin-top:24rpx;padding:22rpx;border:1rpx solid var(--yx-border);border-radius:16rpx;background:var(--yx-surface-card)}.b12-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.b12-kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.b12-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.b12-muted{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.6}.b12-strong{display:block;color:var(--yx-text-primary);font-size:25rpx;font-weight:700}.b12-state-box{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:23rpx;line-height:1.6}.b12-picker{min-height:64rpx;padding:0 16rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.b12-list{display:grid;gap:12rpx}.b12-entry{display:flex;align-items:center;justify-content:space-between;gap:12rpx;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx}.b12-entry>view{display:grid;gap:6rpx}.b12-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:var(--yx-on-brand);background:var(--yx-action);font-size:22rpx;line-height:64rpx}.b12-button.secondary{border:1rpx solid var(--yx-border);color:var(--yx-brand);background:var(--yx-surface-card)}.b12-button:disabled{opacity:.5}.b12-result{display:block;padding:14rpx;border-radius:10rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:22rpx;line-height:1.6}.b12-settings-link{color:var(--yx-brand);font-size:24rpx;font-weight:700}@media(max-width:520px){.b12-entry{align-items:flex-start;flex-direction:column}.b12-button{width:100%}}
</style>
