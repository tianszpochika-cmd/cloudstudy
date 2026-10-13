<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { useExperienceText } from '../platform/experience-ui'
const router = useRouter()
const session = useSessionStore()
const et = useExperienceText()
async function logout() { await session.logout(); await router.replace({ name: 'login' }) }
import ExperienceHeader from '../components/ExperienceHeader.vue'
import NotificationPreferencesPanel from '../components/NotificationPreferencesPanel.vue'
import { computed, onMounted, ref } from 'vue'
import LearningPreferences from '../components/LearningPreferences.vue'
import { useB1Store } from '../stores/b1'
import { dailyQuotaOptions, type DailyQuotaMinutes } from '../domain/b1'
import { privacyNotices } from '../domain/it7-closure'
import { readClosureBoard } from '../api/support'
import { withdrawLearningConsent } from '../api/learning-consent-withdrawal'
import { WITHDRAW_BUTTON_LABEL, WITHDRAW_CONFIRM_COPY } from '../domain/learning-consent-withdrawal'

const props = defineProps<{ section?: string }>()
const b1 = useB1Store()
const quota = ref<DailyQuotaMinutes>(15)
const saving = ref(false)
const saved = ref(false)
const section = computed(() => props.section ?? 'profile')
const privacyLines = ref<string[]>([])
const withdrawConfirming = ref(false)
const withdrawing = ref(false)
const withdrawNotice = ref('')

onMounted(async () => {
  await b1.loadAccountData()
  if (b1.profileStatus === 'ready') quota.value = b1.profile.dailyQuotaMinutes
  privacyLines.value = privacyNotices(await readClosureBoard().catch(() => null))
})

async function refreshProfile(): Promise<void> {
  saved.value = false
  await b1.refreshProfileTarget()
  if (b1.profileStatus === 'ready') quota.value = b1.profile.dailyQuotaMinutes
}

async function saveQuota(): Promise<void> {
  saving.value = true
  saved.value = false
  try {
    saved.value = await b1.saveDailyQuota(quota.value)
    if (saved.value) quota.value = b1.profile.dailyQuotaMinutes
  } finally {
    saving.value = false
  }
}

async function confirmWithdrawLearningConsent(): Promise<void> {
  if (withdrawing.value) return
  withdrawing.value = true
  withdrawNotice.value = ''
  try {
    const result = await withdrawLearningConsent(`withdraw-adult-learning-${Date.now()}`)
    withdrawNotice.value = result.notice
    if (result.withdrawn) {
      withdrawConfirming.value = false
      if (typeof session.markLearningConsentWithdrawn === 'function') session.markLearningConsentWithdrawn()
    }
  } finally {
    withdrawing.value = false
  }
}
async function revokeDevice(deviceId: string): Promise<void> { await b1.removeDevice(deviceId) }
async function revokeOthers(): Promise<void> { await b1.removeOtherDevices() }
async function refreshDevices(): Promise<void> { await b1.refreshDevices() }
</script>

<template>
  <section class="page-stack v2-page v2-page--settings" aria-labelledby="settings-title">
    <ExperienceHeader page="Settings" icon="user" title-id="settings-title" />
    <div class="v2-settings-grid">
    <nav class="settings-nav v2-settings-nav" aria-label="设置分组"><h3 class="v2-settings-nav__title">通知、账号与隐私</h3><RouterLink :class="{ active: section === 'profile' }" to="/settings/profile">{{ et('settingsProfileTab') }}</RouterLink><RouterLink :class="{ active: section === 'notifications' }" to="/settings/notifications">通知设置</RouterLink><RouterLink :class="{ active: section === 'privacy' }" to="/settings/privacy">{{ et('settingsPrivacyTab') }}</RouterLink><RouterLink :class="{ active: section === 'devices' }" to="/settings/devices">{{ et('settingsDevicesTab') }}</RouterLink><RouterLink to="/platform">{{ et('settingsDisplayTab') }}</RouterLink></nav>
    <article v-if="section === 'notifications'" class="form-card"><NotificationPreferencesPanel /></article>
    <article v-else-if="section === 'profile'" class="form-card">
      <h3>{{ et('settingsProfileTab') }}</h3>
      <p v-if="b1.profileStatus === 'loading' || b1.profileStatus === 'idle'" class="muted" role="status">{{ et('settingsLoadingGoal') }}</p>
      <div v-else-if="b1.profileStatus === 'error'">
        <p class="error-text" role="alert">{{ et('settingsGoalUnavailable') }}</p>
        <button class="button button--secondary" type="button" @click="refreshProfile">{{ et('settingsRetry') }}</button>
      </div>
      <template v-else>
        <label>{{ et('settingsDailyGoal') }}<select v-model="quota" :disabled="saving" @change="saved = false"><option v-for="item in dailyQuotaOptions" :key="item" :value="item">{{ item }} {{ et('minutes') }}</option></select></label>
        <button class="button button--primary" type="button" :disabled="saving || quota === b1.profile.dailyQuotaMinutes" @click="saveQuota">{{ saving ? et('settingsSaving') : et('settingsSaveGoal') }}</button><small v-if="!saving && quota === b1.profile.dailyQuotaMinutes" class="disabled-reason" data-disabled-reason>调整每日目标后即可保存。</small>
        <p v-if="saved" class="success-text" role="status">{{ et('settingsGoalSaved') }}</p>
      </template>
      <p class="muted">{{ et('settingsNicknameUnavailable') }}</p>
      <h3>{{ et('settingsDisplay') }}</h3>
      <p class="muted">{{ et('settingsLocalOnly') }}</p>
      <LearningPreferences />
    </article>
    <article v-else-if="section === 'privacy'" class="form-card">
      <h3>{{ et('settingsPrivacyTab') }}</h3>
      <p class="muted it7-closure">{{ et('settingsPrivacyUnavailable') }}</p>
      <p v-for="line in privacyLines" :key="line" class="muted">{{ line }}</p>
      <h3>学习同意</h3>
      <p class="muted">{{ WITHDRAW_CONFIRM_COPY }}</p>
      <button v-if="!withdrawConfirming" class="button button--secondary" type="button" :disabled="withdrawing" @click="withdrawConfirming = true">{{ WITHDRAW_BUTTON_LABEL }}</button>
      <div v-else class="consent-withdraw-confirm">
        <p role="alert">{{ WITHDRAW_CONFIRM_COPY }}</p>
        <button class="button button--primary" type="button" :disabled="withdrawing" @click="confirmWithdrawLearningConsent">{{ withdrawing ? '正在撤回…' : '确认撤回' }}</button>
        <button class="button button--ghost" type="button" :disabled="withdrawing" @click="withdrawConfirming = false">取消</button>
      </div>
      <p v-if="withdrawNotice" class="success-text" role="status">{{ withdrawNotice }}</p>
    </article>
    <article v-else class="form-card">
      <h3>{{ et('settingsDevicesTab') }}</h3>
      <p v-if="b1.deviceStatus === 'loading'" class="muted" role="status">{{ et('settingsLoadingDevices') }}</p>
      <p v-else-if="b1.deviceStatus === 'error'" class="error-text" role="alert">{{ et('settingsDevicesUnavailable') }}</p>
      <p v-else-if="!b1.devices.length" class="muted">{{ et('settingsNoDevices') }}</p>
      <div v-for="device in b1.deviceStatus === 'ready' ? b1.devices : []" :key="device.deviceId" class="device">
        <div><strong>{{ device.deviceName }}</strong><p>{{ et(device.deviceType === 'WEB' ? 'settingsWeb' : device.deviceType === 'H5' ? 'settingsMobileWeb' : 'settingsMobileDevice') }}</p></div>
        <span>{{ et(device.current ? 'settingsCurrentDevice' : device.status === 'ACTIVE' ? 'settingsSignedIn' : 'settingsSignedOut') }}</span>
        <button v-if="!device.current && device.status === 'ACTIVE'" class="button button--ghost" type="button" @click="revokeDevice(device.deviceId)">{{ et('settingsRevokeDevice') }}</button>
      </div>
      <div class="device-actions"><button class="button button--secondary" type="button" :disabled="b1.deviceStatus === 'loading'" @click="refreshDevices">{{ et('settingsRefreshDevices') }}</button><button class="button button--secondary" type="button" :disabled="b1.deviceStatus !== 'ready' || !b1.devices.some((device) => !device.current && device.status === 'ACTIVE')" @click="revokeOthers">{{ et('settingsRevokeOthers') }}</button></div>
    </article>
    <aside class="v2-settings-side"><h3>学习同意与档案</h3><p class="muted">查看已签署的学习同意，管理数据导出与删除请求。</p><RouterLink class="button button--secondary" to="/settings/privacy">管理同意和隐私</RouterLink></aside>
    </div>
    <div class="account-signout"><span>{{ et('authNote') }}</span><button class="button button--ghost" type="button" @click="logout">{{ et('logout') }}</button></div>
    <p v-if="b1.lastError && !(section === 'profile' && b1.profileStatus === 'error')" class="error-text" role="alert">{{ b1.lastError }}</p>
  </section>
</template>

<style scoped>.muted{color:var(--yx-color-text-secondary)}.settings-nav{display:flex;gap:8px;flex-wrap:wrap}.settings-nav a{padding:10px 14px;border-radius:10px;color:var(--yx-color-text-secondary)}.settings-nav a.active{color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.form-card{display:grid;gap:18px;padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.form-card h3{margin:0 0 6px;font-size:24px}.form-card label{display:grid;gap:8px;color:var(--yx-color-text-secondary);font-weight:600}.form-card input,.form-card select{padding:12px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card);color:inherit}.privacy-toggle{display:flex!important;align-items:center;gap:8px}.privacy-toggle input{width:auto}.device{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--yx-color-border)}.device p{margin:6px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.device>span{color:var(--yx-color-success);font-size:13px}.success-text{color:var(--yx-color-success)}.error-text{color:var(--yx-color-danger)}</style>

<style>
.v2-page--settings .v2-settings-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 1fr); grid-template-areas: "main nav" "main side"; gap: 18px; align-items: start; }
.v2-page--settings .v2-settings-grid > article { grid-area: main; margin: 0; }
.v2-page--settings .v2-settings-nav { grid-area: nav; width: auto; display: flex; flex-direction: column; gap: 8px; padding: 22px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); }
.v2-page--settings .v2-settings-nav__title { margin: 0 0 6px; font-size: 16px; color: var(--v2-ink); }
.v2-page--settings .v2-settings-nav a { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 10px 14px; border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); background: var(--v2-card); color: var(--v2-ink); font-size: 13px; text-decoration: none; transition: background var(--v2-motion-fast), border-color var(--v2-motion-fast); }
.v2-page--settings .v2-settings-nav a::after { content: "›"; color: var(--v2-mut); }
.v2-page--settings .v2-settings-nav a:hover { background: var(--v2-surface); }
.v2-page--settings .v2-settings-nav a.active { border-color: var(--v2-brand); background: var(--v2-soft); color: var(--v2-brand); font-weight: 700; }
.v2-page--settings .v2-settings-side { grid-area: side; padding: 22px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.v2-page--settings .v2-settings-side h3 { margin: 0; font-size: 16px; }
.v2-page--settings .v2-settings-side p { margin: 0; font-size: 13px; }
.v2-page--settings .form-card select { min-height: 40px; border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); background: var(--v2-card); color: var(--v2-ink); padding: 0 10px; }
@media (max-width: 900px) { .v2-page--settings .v2-settings-grid { grid-template-columns: 1fr; grid-template-areas: "nav" "main" "side"; } }
</style>
