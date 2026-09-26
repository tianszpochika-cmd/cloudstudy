<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '../../api/client'
import { getInMemoryAuthSnapshot } from '../../auth/access-token'
import { B4_REPORT_REASONS, formatSeconds } from '../../domain/b4'
import { useB4Store } from '../../stores/b4'
import { useSessionStore } from '../../stores/session'
import { B12_REPORT_REASONS, createB12SocialReport, getB12SocialLeaderboard, listB12Notifications, type B12Leaderboard, type B12ReportReason } from '../../api/b12'
import { b12T } from '../../platform/b12-i18n'

type B12ViewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'permission' | 'offline' | 'recovery' | 'error'

const b4 = useB4Store()
const session = useSessionStore()
const verifiedSubject = computed(() => {
  const subject = session.principal?.subject?.trim()
  return session.accessToken && subject && (!session.userId || session.userId === subject) ? subject : null
})
const permissionSnapshot = computed(() => Array.isArray(session.permissions) ? [...session.permissions] : [])
const permissionKey = computed(() => permissionSnapshot.value.slice().sort().join('\u0000'))
const canReadLeaderboard = computed(() => permissionSnapshot.value.includes('social.leaderboard.read'))
const canCreateSocialReport = computed(() => permissionSnapshot.value.includes('social.report.create.self'))
const canReadNotifications = computed(() => permissionSnapshot.value.includes('notification.message.read.self'))
const selectedRoomId = ref('')
const leaderboard = ref<B12Leaderboard | null>(null)
const reportReason = ref<B12ReportReason>('SPAM')
const reasonOptions = computed<readonly B12ReportReason[]>(() => B12_REPORT_REASONS.length ? B12_REPORT_REASONS : B4_REPORT_REASONS as readonly B12ReportReason[])
const notificationCount = ref(0)
const lastReport = ref<{ status: string; reviewMode: string } | null>(null)
const status = ref<B12ViewStatus>('idle')
const actionKey = ref<string | null>(null)
const lastError = ref<string | null>(null)
const lastLoadedRoomId = ref('')
type Owner = { subject: string; generation: number; accessToken: string; permissions: string; viewVersion: number }
let viewVersion = 0
let leaderboardRequest = 0
let notificationRequest = 0
let mounted = false

function currentOwner(): Owner | null {
  const subject = verifiedSubject.value
  const accessToken = session.accessToken
  const snapshot = getInMemoryAuthSnapshot()
  if (!subject || !accessToken || session.status !== 'authenticated' || !snapshot.authenticated
    || snapshot.subject !== subject || snapshot.accessToken !== accessToken || snapshot.generation !== session.authGeneration) return null
  return { subject, generation: session.authGeneration, accessToken, permissions: permissionKey.value, viewVersion }
}

function sameOwner(owner: Owner | null): boolean {
  const current = currentOwner()
  return Boolean(owner && current && owner.subject === current.subject && owner.generation === current.generation
    && owner.accessToken === current.accessToken && owner.permissions === current.permissions && owner.viewVersion === current.viewVersion)
}

function clearPersonal(): void {
  viewVersion += 1
  leaderboardRequest += 1
  notificationRequest += 1
  selectedRoomId.value = ''
  lastLoadedRoomId.value = ''
  leaderboard.value = null
  notificationCount.value = 0
  lastReport.value = null
  actionKey.value = null
  status.value = 'idle'
  lastError.value = null
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function sourceOf(value: unknown): Record<string, unknown> { const root = isRecord(value) && isRecord(value.data) ? value.data : value; return isRecord(root) ? root : {} }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value : fallback }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function errorStatus(error: unknown): B12ViewStatus { if (error instanceof ApiError) return error.status === 403 ? 'permission' : error.status === 409 ? 'recovery' : 'error'; return error instanceof TypeError ? 'offline' : 'error' }
function errorMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback }

function parseLeaderboard(value: unknown): B12Leaderboard | null {
  const root = sourceOf(value)
  if (!Array.isArray(root.entries)) return null
  return { kind: text(root.kind, 'FOCUS_MINUTES'), period: text(root.period, 'DAY'), entries: root.entries.filter(isRecord).map((entry) => ({ rank: number(entry.rank), displayMode: text(entry.displayMode, 'ANONYMOUS'), displayName: typeof entry.displayName === 'string' ? entry.displayName : undefined, score: number(entry.score), qualifiedUnits: number(entry.qualifiedUnits), isSelf: entry.isSelf === true, targetSeatIndex: typeof entry.targetSeatIndex === 'number' ? entry.targetSeatIndex : undefined })).filter((entry) => entry.rank > 0) }
}

async function loadLeaderboard(roomId: string): Promise<void> {
  const owner = currentOwner()
  if (!roomId || !sameOwner(owner) || actionKey.value) return
  if (!canReadLeaderboard.value) { leaderboard.value = null; status.value = 'permission'; return }
  const request = ++leaderboardRequest
  selectedRoomId.value = roomId; lastLoadedRoomId.value = roomId; actionKey.value = `leaderboard.${roomId}`; status.value = 'loading'; lastError.value = null
  try {
    const value = parseLeaderboard(await getB12SocialLeaderboard(roomId))
    if (!sameOwner(owner) || request !== leaderboardRequest || selectedRoomId.value !== roomId) return
    leaderboard.value = value; status.value = value?.entries.length ? 'success' : 'empty'; if (!value) lastError.value = '服务端未返回排行榜投影。'
  } catch (error) {
    if (!sameOwner(owner) || request !== leaderboardRequest || selectedRoomId.value !== roomId) return
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) leaderboard.value = null
    status.value = errorStatus(error); lastError.value = errorMessage(error, '排行榜读取失败；未在本地计算或修改排名。')
  } finally { if (sameOwner(owner) && request === leaderboardRequest && actionKey.value === `leaderboard.${roomId}`) actionKey.value = null }
}

async function loadNotificationCount(owner = currentOwner()): Promise<void> {
  if (!sameOwner(owner) || !canReadNotifications.value) return
  const request = ++notificationRequest
  try {
    const messages = await listB12Notifications()
    if (!sameOwner(owner) || request !== notificationRequest) return
    const root = sourceOf(messages)
    const data = isRecord(messages) ? messages.data : undefined
    const items = Array.isArray(messages) ? messages
      : Array.isArray(data) ? data
        : Array.isArray(root.items) ? root.items
          : isRecord(root.data) && Array.isArray(root.data.items) ? root.data.items : []
    notificationCount.value = items.length
  } catch {
    // Inbox availability is shown on its own page; stale or denied reads never retain an old count.
    if (sameOwner(owner) && request === notificationRequest) notificationCount.value = 0
  }
}

async function reportUser(entry: { targetSeatIndex?: number; isSelf: boolean }): Promise<void> {
  const owner = currentOwner()
  if (!sameOwner(owner) || !canCreateSocialReport.value || entry.isSelf || !entry.targetSeatIndex || !selectedRoomId.value || actionKey.value) return
  const roomId = selectedRoomId.value
  const key = `report.${roomId}.${entry.targetSeatIndex}`; actionKey.value = key
  try {
    const value = await createB12SocialReport(roomId, entry.targetSeatIndex, reportReason.value)
    if (!sameOwner(owner)) return
    const root = sourceOf(value); lastReport.value = { status: text(root.status, 'RECEIVED'), reviewMode: text(root.reviewMode, 'MANUAL') }; status.value = 'success'; lastError.value = null
  } catch (error) {
    if (!sameOwner(owner)) return
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) lastReport.value = null
    status.value = errorStatus(error); lastError.value = errorMessage(error, '举报提交失败；未使用自由文本或本地审核结果。')
  } finally { if (sameOwner(owner) && actionKey.value === key) actionKey.value = null }
}

function reloadForCurrentOwner(): void {
  const owner = currentOwner()
  if (!sameOwner(owner)) return
  if (canReadNotifications.value) void loadNotificationCount(owner)
  if (!canReadLeaderboard.value) { status.value = 'permission'; return }
  const roomId = b4.rooms.some((room) => room.roomId === selectedRoomId.value) ? selectedRoomId.value : b4.rooms[0]?.roomId ?? ''
  if (roomId) void loadLeaderboard(roomId)
}

watch([verifiedSubject, () => session.authGeneration, () => session.accessToken, () => session.status, permissionKey], () => {
  clearPersonal()
  if (!mounted) return
  const refreshVersion = viewVersion
  void nextTick(() => { if (mounted && refreshVersion === viewVersion) reloadForCurrentOwner() })
}, { flush: 'sync' })

watch(() => b4.rooms, (rooms) => {
  const validSelection = rooms.some((room) => room.roomId === selectedRoomId.value)
  if (!validSelection) {
    selectedRoomId.value = ''; lastLoadedRoomId.value = ''; leaderboard.value = null; leaderboardRequest += 1
    if (actionKey.value?.startsWith('leaderboard.')) actionKey.value = null
  }
  if (!selectedRoomId.value && rooms[0]?.roomId) selectedRoomId.value = rooms[0].roomId
  if (selectedRoomId.value && selectedRoomId.value !== lastLoadedRoomId.value) void loadLeaderboard(selectedRoomId.value)
}, { deep: true, immediate: true })

onMounted(() => { mounted = true; reloadForCurrentOwner() })
onUnmounted(() => { mounted = false; clearPersonal() })
</script>

<template>
  <section class="b12-extension b12-card" aria-labelledby="b12-leaderboard-title">
    <div class="b12-heading"><div><p class="b12-kicker">LEADERBOARD · REPORT</p><h2 id="b12-leaderboard-title">{{ b12T('social.leaderboard') }}</h2></div><span class="b12-state">{{ b12T('social.privacy') }}</span></div>
    <div v-if="b4.rooms.length" class="b12-room-tabs" role="tablist"><button v-for="room in b4.rooms" :key="room.roomId" type="button" :aria-selected="selectedRoomId === room.roomId" :class="{ active: selectedRoomId === room.roomId }" @click="loadLeaderboard(room.roomId)">{{ room.name }}</button></div>
    <div v-if="actionKey?.startsWith('leaderboard.')" class="b12-inline-state" role="status">{{ b12T('social.loadingLeaderboard') }}</div>
    <div v-else-if="leaderboard?.entries.length" class="b12-leaderboard" role="list"><article v-for="entry in leaderboard.entries" :key="`${entry.rank}-${entry.targetSeatIndex ?? 'global'}`" class="b12-entry" role="listitem"><div><strong>#{{ entry.rank }} · {{ entry.displayName ?? '匿名学员' }}</strong><small>{{ entry.displayMode }} · {{ b12T('social.focusSeconds') }} {{ formatSeconds(entry.qualifiedUnits * 60) }}</small></div><button v-if="canCreateSocialReport && !entry.isSelf && entry.targetSeatIndex" class="button button--ghost" type="button" :disabled="Boolean(actionKey) || !b4.online" @click="reportUser(entry)">{{ actionKey === `report.${selectedRoomId}.${entry.targetSeatIndex}` ? b12T('social.submittingReport') : b12T('social.report') }}</button><span v-else class="b12-self">{{ entry.isSelf ? b12T('social.noSelfReport') : b12T('social.privacy') }}</span></article></div>
    <p v-else class="b12-inline-state">{{ b12T('social.emptyLeaderboard') }}</p>
    <div class="b12-report-controls"><label>{{ b12T('social.reportReason') }}<select v-model="reportReason" aria-label="预设举报原因"><option v-for="reason in reasonOptions" :key="reason" :value="reason">{{ reason }}</option></select></label><small>{{ b12T('social.privacy') }}</small></div>
    <p v-if="lastReport" class="b12-result" role="status">{{ b12T('social.reportReceived') }} · {{ lastReport.status }} · {{ lastReport.reviewMode }}</p>
    <p v-if="status === 'permission'" class="b12-inline-state">{{ b12T('status.permission') }}</p><p v-else-if="status === 'offline'" class="b12-inline-state">{{ b12T('status.offline') }}</p><p v-else-if="status === 'recovery'" class="b12-inline-state">{{ b12T('status.recovery') }}</p><p v-else-if="lastError" class="b12-inline-state">{{ lastError }}</p>
  </section>
  <section class="b12-extension b12-card" aria-labelledby="b12-notification-preferences-title">
    <div class="b12-heading"><div><p class="b12-kicker">NOTIFICATION CENTER</p><h2 id="b12-notification-preferences-title">{{ b12T('notifications.preferences') }}</h2></div><span class="b12-state">{{ b12T('notifications.loadedCount', { count: notificationCount }) }}</span></div>
    <p class="b12-muted">{{ b12T('notifications.inAppOnly') }}</p><RouterLink class="b12-settings-link" to="/settings/notifications">{{ b12T('notifications.preferences') }}</RouterLink>
  </section>
</template>

<style scoped>
.b12-card{display:grid;gap:16px;padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.b12-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.b12-kicker{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.b12-heading h2{margin:8px 0 0;font-size:22px}.b12-state,.b12-muted,.b12-entry small,.b12-report-controls small{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.6}.b12-room-tabs{display:flex;gap:8px;overflow:auto}.b12-room-tabs button{min-height:40px;padding:0 14px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary);background:var(--yx-color-surface-card);white-space:nowrap}.b12-room-tabs button.active{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.b12-leaderboard{display:grid;gap:10px}.b12-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px}.b12-entry>div{display:grid;gap:4px}.b12-entry .button{min-height:36px}.b12-self{color:var(--yx-color-text-tertiary);font-size:12px}.b12-inline-state{margin:0;padding:16px;border:1px dashed var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);line-height:1.6}.b12-report-controls{display:grid;gap:8px}.b12-report-controls label{display:grid;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.b12-report-controls select{min-height:40px;padding:0 10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card)}.b12-result{margin:0;padding:12px;border-radius:10px;color:var(--yx-color-success);background:color-mix(in srgb,var(--yx-color-success) 10%,transparent);font-size:13px}.b12-settings-link{width:fit-content;padding:8px 0;color:var(--yx-color-brand-primary);font-size:14px}@media(max-width:640px){.b12-entry{align-items:flex-start;flex-direction:column}}
</style>
