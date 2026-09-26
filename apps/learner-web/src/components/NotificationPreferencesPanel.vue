<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  DEFAULT_DND_WINDOW,
  NO_DND_WINDOW,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  listNotificationPreferences,
  setNotificationPreference,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationDndWindow,
  type NotificationPreference,
} from '../api/notifications'
import { useExperienceText } from '../platform/experience-ui'
import { getInMemoryAuthSnapshot } from '../auth/access-token'
import { useSessionStore } from '../stores/session'

type PanelState = 'loading' | 'ready' | 'error'

const preferences = ref<NotificationPreference[]>([])
const state = ref<PanelState>('loading')
const savingKey = ref<string | null>(null)
const notice = ref('')
const noticeTone = ref<'success' | 'error'>('success')
const startLocalTime = ref(DEFAULT_DND_WINDOW.startLocalTime)
const endLocalTime = ref(DEFAULT_DND_WINDOW.endLocalTime)
const dndEnabled = ref(false)
const dndMixed = ref(false)
const t = useExperienceText()
const session = useSessionStore()
const canWrite = computed(() => session.permissions.includes('notification.preference.write.self'))
type PreferenceIdentity = { subject: string; generation: number }
let loadSequence = 0
let loadedIdentity: PreferenceIdentity | null = null

function currentIdentity(): PreferenceIdentity | null {
  const snapshot = getInMemoryAuthSnapshot()
  return snapshot.authenticated && snapshot.subject && Number.isSafeInteger(snapshot.generation)
    ? { subject: snapshot.subject, generation: snapshot.generation }
    : null
}

function sameIdentity(identity: PreferenceIdentity): boolean {
  const current = currentIdentity()
  return Boolean(current && current.subject === identity.subject && current.generation === identity.generation)
}

function canReadFor(identity: PreferenceIdentity): boolean {
  return (session.status === 'authenticated' || session.status === 'refreshing')
    && session.principal?.subject.trim() === identity.subject
    && session.authGeneration === identity.generation
    && session.permissions.includes('notification.preference.read.self')
}

function clearPrivateState(): void {
  loadSequence += 1
  loadedIdentity = null
  preferences.value = []
  state.value = 'error'
  notice.value = ''
}

const options = computed(() => NOTIFICATION_CATEGORIES.map((category) => ({
  ...category,
  label: t(category.labelKey.replace(/^experience\./, '')),
  channels: NOTIFICATION_CHANNELS
    .filter((channel) => channel.code === 'IN_APP')
    .map((channel) => ({ ...channel, label: t(channel.labelKey.replace(/^experience\./, '')) })),
})))

function keyOf(category: NotificationCategory, channel: NotificationChannel): string {
  return `${category}:${channel}`
}

function rowFor(category: NotificationCategory, channel: NotificationChannel): NotificationPreference | undefined {
  return preferences.value.find((item) => item.category === category && item.channel === channel)
}

function isEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
  const row = rowFor(category, channel)
  return row?.enabled === true && row.frequencyPolicy === 'IMMEDIATE'
}

function windowKey(window: NotificationPreference['dndWindow']): string {
  return `${window.startLocalTime}/${window.endLocalTime}`
}

function isNoDnd(window: NotificationPreference['dndWindow']): boolean {
  return window.startLocalTime === window.endLocalTime
}

function refreshDndDraft(rows: NotificationPreference[]): void {
  const active = rows.filter((row) => row.channel === 'IN_APP' && row.enabled && row.frequencyPolicy === 'IMMEDIATE')
  if (!active.length) {
    dndEnabled.value = false
    dndMixed.value = false
    startLocalTime.value = DEFAULT_DND_WINDOW.startLocalTime
    endLocalTime.value = DEFAULT_DND_WINDOW.endLocalTime
    return
  }
  const signatures = new Set(active.map((row) => windowKey(row.dndWindow)))
  dndMixed.value = signatures.size > 1
  const representative = active.find((row) => !isNoDnd(row.dndWindow)) ?? active[0]
  dndEnabled.value = !isNoDnd(representative.dndWindow)
  startLocalTime.value = dndEnabled.value ? representative.dndWindow.startLocalTime : DEFAULT_DND_WINDOW.startLocalTime
  endLocalTime.value = dndEnabled.value ? representative.dndWindow.endLocalTime : DEFAULT_DND_WINDOW.endLocalTime
}

async function load(expectedIdentity?: PreferenceIdentity): Promise<void> {
  const identity = currentIdentity()
  if (!identity || !canReadFor(identity) || (expectedIdentity && !sameIdentity(expectedIdentity))) {
    clearPrivateState()
    return
  }
  const sequence = ++loadSequence
  state.value = 'loading'
  notice.value = ''
  try {
    const rows = await listNotificationPreferences()
    if (sequence !== loadSequence) return
    if (!sameIdentity(identity) || !canReadFor(identity)) { clearPrivateState(); return }
    preferences.value = rows
    loadedIdentity = identity
    refreshDndDraft(preferences.value)
    state.value = 'ready'
  } catch {
    if (sequence !== loadSequence) return
    if (!sameIdentity(identity) || !canReadFor(identity)) { clearPrivateState(); return }
    state.value = 'error'
  }
}

function windowDraft(): NotificationDndWindow {
  return dndEnabled.value
    ? { startLocalTime: startLocalTime.value, endLocalTime: endLocalTime.value }
    : NO_DND_WINDOW
}

async function savePreference(category: NotificationCategory, channel: NotificationChannel, enabled: boolean): Promise<void> {
  const key = keyOf(category, channel)
  if (savingKey.value || !canWrite.value) return
  const identity = currentIdentity()
  if (!identity || !canReadFor(identity)) { clearPrivateState(); return }
  const existing = rowFor(category, channel) ?? null
  const desiredWindow = enabled ? windowDraft() : existing?.dndWindow ?? NO_DND_WINDOW
  const wasSaved = () => {
    const current = rowFor(category, channel)
    return Boolean(current && current.version > (existing?.version ?? 0)
      && current.enabled === enabled
      && current.frequencyPolicy === (enabled ? 'IMMEDIATE' : 'DISABLED')
      && current.dndWindow.startLocalTime === desiredWindow.startLocalTime
      && current.dndWindow.endLocalTime === desiredWindow.endLocalTime)
  }
  savingKey.value = key
  notice.value = ''
  try {
    await setNotificationPreference({ category, channel, enabled, existing, dndWindow: enabled ? desiredWindow : undefined })
    await load(identity)
    if (state.value === 'ready') {
      const confirmed = wasSaved()
      noticeTone.value = confirmed ? 'success' : 'error'
      notice.value = t(confirmed ? 'notificationPreferences.saved' : 'notificationPreferences.saveUncertain')
    }
  } catch (error) {
    await load(identity)
    if (state.value === 'ready') {
      const confirmed = wasSaved()
      noticeTone.value = confirmed ? 'success' : 'error'
      notice.value = confirmed ? t('notificationPreferences.saved')
        : (error as { status?: number })?.status === 409
          ? t('notificationPreferences.conflict')
          : t('notificationPreferences.saveUncertain')
    }
  } finally {
    savingKey.value = null
  }
}

const activeRows = computed(() => preferences.value.filter((row) => row.channel === 'IN_APP' && row.enabled && row.frequencyPolicy === 'IMMEDIATE'))
const dndDirty = computed(() => {
  if (!activeRows.value.length) return false
  if (dndMixed.value) return true
  const desired = windowDraft()
  return activeRows.value.some((row) => row.dndWindow.startLocalTime !== desired.startLocalTime
    || row.dndWindow.endLocalTime !== desired.endLocalTime)
})
const dndIntervalValid = computed(() => !dndEnabled.value || startLocalTime.value !== endLocalTime.value)

async function saveDnd(): Promise<void> {
  if (savingKey.value || !canWrite.value || !activeRows.value.length || !dndDirty.value || !dndIntervalValid.value) return
  const identity = currentIdentity()
  if (!identity || !canReadFor(identity)) { clearPrivateState(); return }
  savingKey.value = 'dnd'
  notice.value = ''
  const desired = windowDraft()
  const targetRows = [...activeRows.value]
  const confirmed = () => targetRows.every((target) => {
    const current = rowFor(target.category, target.channel)
    return Boolean(current && current.enabled && current.frequencyPolicy === 'IMMEDIATE'
      && current.dndWindow.startLocalTime === desired.startLocalTime
      && current.dndWindow.endLocalTime === desired.endLocalTime)
  })
  const reconcile = async () => {
    await load(identity)
    if (state.value !== 'ready') return
    const saved = confirmed()
    if (!saved) {
      dndEnabled.value = desired.startLocalTime !== desired.endLocalTime
      if (dndEnabled.value) {
        startLocalTime.value = desired.startLocalTime
        endLocalTime.value = desired.endLocalTime
      }
    }
    noticeTone.value = saved ? 'success' : 'error'
    notice.value = t(saved ? 'notificationPreferences.dndSaved' : 'notificationPreferences.dndPartialSave')
  }
  try {
    for (const row of targetRows) {
      if (!sameIdentity(identity) || !canReadFor(identity) || !canWrite.value) { clearPrivateState(); return }
      await setNotificationPreference({
        category: row.category,
        channel: row.channel,
        enabled: row.enabled,
        existing: row,
        dndWindow: desired,
        frequencyPolicy: row.frequencyPolicy,
      })
    }
    await reconcile()
  } catch {
    await reconcile()
  } finally {
    savingKey.value = null
  }
}

watch([() => session.authGeneration, () => session.status, () => session.principal?.subject,
  () => session.permissions.join('|')], () => {
  const identity = currentIdentity()
  if (!identity || !canReadFor(identity)) { clearPrivateState(); return }
  if (!loadedIdentity || loadedIdentity.subject !== identity.subject || loadedIdentity.generation !== identity.generation) {
    void load(identity)
  }
})

onMounted(() => { void load() })
</script>

<template>
  <section class="notification-preferences" aria-labelledby="notification-preferences-title">
    <header>
      <div><h3 id="notification-preferences-title">{{ t('notificationPreferences.title') }}</h3></div>
    </header>
    <p class="hint">{{ t('notificationPreferences.hint') }}</p>
    <p v-if="notice" :class="['notice', { 'notice--error': noticeTone === 'error' }]" :role="noticeTone === 'error' ? 'alert' : 'status'">{{ notice }}</p>
    <div v-if="state === 'loading'" class="state" role="status">{{ t('notificationPreferences.loading') }}</div>
    <div v-else-if="state === 'error'" class="state" role="alert">
      <span>{{ t('notificationPreferences.unavailable') }}</span><button class="button button--ghost" type="button" @click="load()">{{ t('notificationPreferences.retry') }}</button>
    </div>
    <template v-else>
      <div class="category-list">
        <section v-for="category in options" :key="category.code" class="category" :aria-labelledby="`notification-${category.code}`">
          <h4 :id="`notification-${category.code}`">{{ category.label }}</h4>
          <div class="channel-list">
            <label v-for="channel in category.channels" :key="channel.code" class="channel-option">
              <input
                type="checkbox"
                :checked="isEnabled(category.code, channel.code)"
                :disabled="Boolean(savingKey) || !canWrite"
                @change="savePreference(category.code, channel.code, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ channel.label }}</span>
            </label>
          </div>
        </section>
      </div>

      <section class="quiet-hours" aria-labelledby="notification-dnd-title">
        <div class="quiet-heading"><div><h4 id="notification-dnd-title">{{ t('notificationPreferences.dndTitle') }}</h4><p class="hint">{{ t('notificationPreferences.dndHint') }}</p></div>
          <label class="dnd-toggle"><input v-model="dndEnabled" type="checkbox" :disabled="Boolean(savingKey) || !canWrite || !activeRows.length"><span>{{ t('notificationPreferences.enabled') }}</span></label>
        </div>
        <p v-if="!activeRows.length" class="hint">{{ t('notificationPreferences.dndNoActive') }}</p>
        <p v-if="dndMixed" class="hint">{{ t('notificationPreferences.dndMixed') }}</p>
        <p v-if="!dndIntervalValid" class="hint" role="alert">{{ t('notificationPreferences.dndEqualTimes') }}</p>
        <div class="time-fields">
          <label>{{ t('notificationPreferences.dndStart') }}<input v-model="startLocalTime" type="time" :disabled="Boolean(savingKey) || !canWrite || !dndEnabled || !activeRows.length"></label>
          <label>{{ t('notificationPreferences.dndEnd') }}<input v-model="endLocalTime" type="time" :disabled="Boolean(savingKey) || !canWrite || !dndEnabled || !activeRows.length"></label>
          <button class="button button--secondary" type="button" :disabled="Boolean(savingKey) || !canWrite || !dndDirty || !dndIntervalValid" @click="saveDnd">{{ savingKey === 'dnd' ? t('notificationPreferences.saving') : t('notificationPreferences.dndSave') }}</button>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.notification-preferences{display:grid;gap:16px}.notification-preferences header{display:flex;align-items:center;justify-content:space-between}.notification-preferences h3,.notification-preferences h4{margin:0}.notification-preferences h3{font-size:22px}.notification-preferences h4{font-size:15px}.yx-kicker{margin:0 0 6px;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.hint{margin:0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.6}.notice{margin:0;color:var(--yx-color-success);font-size:13px}.notice--error{color:var(--yx-color-danger)}.state{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary)}.category-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.category{display:grid;gap:12px;padding:16px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card)}.channel-list{display:flex;flex-wrap:wrap;gap:8px}.channel-option,.dnd-toggle{display:flex;align-items:center;gap:8px;min-height:40px;padding:7px 10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary);font-size:13px;cursor:pointer}.channel-option input,.dnd-toggle input{width:18px;height:18px;accent-color:var(--yx-color-brand-primary)}.quiet-hours{display:grid;gap:14px;padding:18px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card)}.quiet-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.quiet-heading>div{display:grid;gap:5px}.time-fields{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.time-fields label{display:grid;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.time-fields input{min-height:40px;padding:7px 10px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card);color:var(--yx-color-text-primary)}.button--ghost,.button--secondary{min-height:40px;border:1px solid var(--yx-color-border);border-radius:10px;background:transparent;color:var(--yx-color-brand-primary)}@media(max-width:700px){.category-list{grid-template-columns:1fr}.time-fields{align-items:stretch;flex-direction:column}.time-fields label,.time-fields input{width:100%}.time-fields button{width:100%}}
</style>
