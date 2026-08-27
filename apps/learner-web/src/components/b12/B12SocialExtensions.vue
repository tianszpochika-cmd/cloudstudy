<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError } from '../../api/client'
import { B4_REPORT_REASONS, formatSeconds } from '../../domain/b4'
import { useB4Store } from '../../stores/b4'
import { B12_REPORT_REASONS, createB12SocialReport, getB12SocialLeaderboard, listB12NotificationPreferences, listB12Notifications, updateB12NotificationPreference, type B12Leaderboard, type B12ReportReason } from '../../api/b12'
import { b12T } from '../../platform/b12-i18n'

type B12ViewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'permission' | 'offline' | 'recovery' | 'error'
type PreferenceKey = 'roomInteractions' | 'focusReminders' | 'system' | 'doNotDisturb'

const CANONICAL_NOTIFICATION_TYPE_BY_KEY: Record<PreferenceKey, string> = {
  roomInteractions: 'ROOM_INTERACTIONS',
  focusReminders: 'FOCUS_REMINDERS',
  system: 'SYSTEM',
  doNotDisturb: 'DO_NOT_DISTURB',
}
const PREFERENCE_KEY_BY_NOTIFICATION_TYPE: Record<string, PreferenceKey> = {
  ROOM_INTERACTIONS: 'roomInteractions',
  FOCUS_REMINDERS: 'focusReminders',
  SYSTEM: 'system',
  DO_NOT_DISTURB: 'doNotDisturb',
  roomInteractions: 'roomInteractions',
  focusReminders: 'focusReminders',
  system: 'system',
  doNotDisturb: 'doNotDisturb',
}
const CANONICAL_NOTIFICATION_TYPES = new Set(Object.values(CANONICAL_NOTIFICATION_TYPE_BY_KEY))

const b4 = useB4Store()
const selectedRoomId = ref('')
const leaderboard = ref<B12Leaderboard | null>(null)
const reportReason = ref<B12ReportReason>('SPAM')
const reasonOptions = computed<readonly B12ReportReason[]>(() => B12_REPORT_REASONS.length ? B12_REPORT_REASONS : B4_REPORT_REASONS as readonly B12ReportReason[])
const notificationPreferences = ref<Record<PreferenceKey, boolean>>({ roomInteractions: true, focusReminders: true, system: true, doNotDisturb: false })
const preferenceVersions = ref<Partial<Record<PreferenceKey, number>>>({})
const notificationCount = ref(0)
const lastReport = ref<{ status: string; reviewMode: string } | null>(null)
const status = ref<B12ViewStatus>('idle')
const actionKey = ref<string | null>(null)
const lastError = ref<string | null>(null)
const lastLoadedRoomId = ref('')

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

function parsePreference(value: unknown): void {
  const source = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.data) ? value.data : []
  const canonicalSeen = new Set<PreferenceKey>()
  for (const item of source) {
    if (!isRecord(item) || typeof item.notificationType !== 'string') continue
    const key = PREFERENCE_KEY_BY_NOTIFICATION_TYPE[item.notificationType]
    if (!key || (canonicalSeen.has(key) && !CANONICAL_NOTIFICATION_TYPES.has(item.notificationType))) continue
    notificationPreferences.value[key] = item.enabled !== false
    if (CANONICAL_NOTIFICATION_TYPES.has(item.notificationType)) {
      if (typeof item.version === 'number') preferenceVersions.value[key] = item.version
      canonicalSeen.add(key)
    } else {
      delete preferenceVersions.value[key]
    }
  }
}

async function loadLeaderboard(roomId: string): Promise<void> {
  if (!roomId || actionKey.value) return
  selectedRoomId.value = roomId; lastLoadedRoomId.value = roomId; actionKey.value = `leaderboard.${roomId}`; status.value = 'loading'; lastError.value = null
  try { leaderboard.value = parseLeaderboard(await getB12SocialLeaderboard(roomId)); status.value = leaderboard.value?.entries.length ? 'success' : 'empty'; if (!leaderboard.value) lastError.value = '服务端未返回排行榜投影。' }
  catch (error) { status.value = errorStatus(error); lastError.value = errorMessage(error, '排行榜读取失败；未在本地计算或修改排名。') }
  finally { actionKey.value = null }
}

function reportUser(entry: { targetSeatIndex?: number; isSelf: boolean }): void {
  if (entry.isSelf || !entry.targetSeatIndex || !selectedRoomId.value || actionKey.value) return
  const key = `report.${selectedRoomId.value}.${entry.targetSeatIndex}`; actionKey.value = key
  void createB12SocialReport(selectedRoomId.value, entry.targetSeatIndex, reportReason.value).then((value) => {
    const root = sourceOf(value); lastReport.value = { status: text(root.status, 'RECEIVED'), reviewMode: text(root.reviewMode, 'MANUAL') }; status.value = 'success'; lastError.value = null
  }).catch((error: unknown) => { status.value = errorStatus(error); lastError.value = errorMessage(error, '举报提交失败；未使用自由文本或本地审核结果。') }).finally(() => { actionKey.value = null })
}

function savePreference(key: PreferenceKey, value: boolean): void {
  if (actionKey.value) return
  actionKey.value = `preference.${key}`
  void updateB12NotificationPreference(key, value, preferenceVersions.value[key]).then((raw) => { parsePreference([raw]); status.value = 'success'; lastError.value = null }).catch((error: unknown) => { status.value = errorStatus(error); lastError.value = errorMessage(error, '通知偏好保存失败。') }).finally(() => { actionKey.value = null })
}

watch(() => b4.rooms, (rooms) => { const first = rooms[0]?.roomId ?? ''; if (!selectedRoomId.value && first) selectedRoomId.value = first; if (selectedRoomId.value && selectedRoomId.value !== lastLoadedRoomId.value) void loadLeaderboard(selectedRoomId.value) }, { deep: true, immediate: true })
onMounted(async () => { try { parsePreference(await listB12NotificationPreferences()); const messages = await listB12Notifications(); const root = Array.isArray(messages) ? messages : sourceOf(messages); notificationCount.value = Array.isArray(root) ? root.length : Array.isArray(root.items) ? root.items.length : 0 } catch { /* the panel keeps explicit defaults until the server confirms */ } })
</script>

<template>
  <section class="b12-extension b12-card" aria-labelledby="b12-leaderboard-title">
    <div class="b12-heading"><div><p class="b12-kicker">LEADERBOARD · REPORT</p><h2 id="b12-leaderboard-title">{{ b12T('social.leaderboard') }}</h2></div><span class="b12-state">{{ b12T('social.privacy') }}</span></div>
    <div v-if="b4.rooms.length" class="b12-room-tabs" role="tablist"><button v-for="room in b4.rooms" :key="room.roomId" type="button" :aria-selected="selectedRoomId === room.roomId" :class="{ active: selectedRoomId === room.roomId }" @click="loadLeaderboard(room.roomId)">{{ room.name }}</button></div>
    <div v-if="actionKey?.startsWith('leaderboard.')" class="b12-inline-state" role="status">{{ b12T('social.loadingLeaderboard') }}</div>
    <div v-else-if="leaderboard?.entries.length" class="b12-leaderboard" role="list"><article v-for="entry in leaderboard.entries" :key="`${entry.rank}-${entry.targetSeatIndex ?? 'global'}`" class="b12-entry" role="listitem"><div><strong>#{{ entry.rank }} · {{ entry.displayName ?? '匿名学员' }}</strong><small>{{ entry.displayMode }} · {{ b12T('social.focusSeconds') }} {{ formatSeconds(entry.qualifiedUnits * 60) }}</small></div><button v-if="!entry.isSelf && entry.targetSeatIndex" class="button button--ghost" type="button" :disabled="Boolean(actionKey) || !b4.online" @click="reportUser(entry)">{{ actionKey === `report.${selectedRoomId}.${entry.targetSeatIndex}` ? b12T('social.submittingReport') : b12T('social.report') }}</button><span v-else class="b12-self">{{ entry.isSelf ? b12T('social.noSelfReport') : b12T('social.privacy') }}</span></article></div>
    <p v-else class="b12-inline-state">{{ b12T('social.emptyLeaderboard') }}</p>
    <div class="b12-report-controls"><label>{{ b12T('social.reportReason') }}<select v-model="reportReason" aria-label="预设举报原因"><option v-for="reason in reasonOptions" :key="reason" :value="reason">{{ reason }}</option></select></label><small>{{ b12T('social.privacy') }}</small></div>
    <p v-if="lastReport" class="b12-result" role="status">{{ b12T('social.reportReceived') }} · {{ lastReport.status }} · {{ lastReport.reviewMode }}</p>
    <p v-if="status === 'permission'" class="b12-inline-state">{{ b12T('status.permission') }}</p><p v-else-if="status === 'offline'" class="b12-inline-state">{{ b12T('status.offline') }}</p><p v-else-if="status === 'recovery'" class="b12-inline-state">{{ b12T('status.recovery') }}</p><p v-else-if="lastError" class="b12-inline-state">{{ lastError }}</p>
  </section>
  <section class="b12-extension b12-card" aria-labelledby="b12-notification-preferences-title">
    <div class="b12-heading"><div><p class="b12-kicker">NOTIFICATION CENTER</p><h2 id="b12-notification-preferences-title">{{ b12T('notifications.preferences') }}</h2></div><span class="b12-state">{{ notificationCount }} 条</span></div>
    <div class="b12-preferences"><label><input type="checkbox" :disabled="Boolean(actionKey)" :checked="notificationPreferences.roomInteractions" @change="savePreference('roomInteractions', ($event.target as HTMLInputElement).checked)"><span>{{ b12T('notifications.room') }}</span></label><label><input type="checkbox" :disabled="Boolean(actionKey)" :checked="notificationPreferences.focusReminders" @change="savePreference('focusReminders', ($event.target as HTMLInputElement).checked)"><span>{{ b12T('notifications.focus') }}</span></label><label><input type="checkbox" :disabled="Boolean(actionKey)" :checked="notificationPreferences.system" @change="savePreference('system', ($event.target as HTMLInputElement).checked)"><span>{{ b12T('notifications.system') }}</span></label><label><input type="checkbox" :disabled="Boolean(actionKey)" :checked="notificationPreferences.doNotDisturb" @change="savePreference('doNotDisturb', ($event.target as HTMLInputElement).checked)"><span>{{ b12T('notifications.dnd') }}</span></label></div>
  </section>
</template>

<style scoped>
.b12-card{display:grid;gap:16px;padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.b12-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.b12-kicker{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.b12-heading h2{margin:8px 0 0;font-size:22px}.b12-state,.b12-muted,.b12-entry small,.b12-report-controls small{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.6}.b12-room-tabs{display:flex;gap:8px;overflow:auto}.b12-room-tabs button{min-height:40px;padding:0 14px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary);background:var(--yx-color-surface-card);white-space:nowrap}.b12-room-tabs button.active{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.b12-leaderboard{display:grid;gap:10px}.b12-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px}.b12-entry>div{display:grid;gap:4px}.b12-entry .button{min-height:36px}.b12-self{color:var(--yx-color-text-tertiary);font-size:12px}.b12-inline-state{margin:0;padding:16px;border:1px dashed var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);line-height:1.6}.b12-report-controls{display:grid;gap:8px}.b12-report-controls label{display:grid;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.b12-report-controls select{min-height:40px;padding:0 10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card)}.b12-result{margin:0;padding:12px;border-radius:10px;color:var(--yx-color-success);background:color-mix(in srgb,var(--yx-color-success) 10%,transparent);font-size:13px}.b12-preferences{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.b12-preferences label{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary);font-size:13px}@media(max-width:640px){.b12-entry{align-items:flex-start;flex-direction:column}.b12-preferences{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
