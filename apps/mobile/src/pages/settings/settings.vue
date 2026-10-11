<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileThemeController } from '../../platform/v2-foundation'
import { b10ContentLocale, b10UiLocale } from '../../platform/b10-foundation'
import { mobileExperienceEngine, mobileMotionMode, restoreMobileQualityDefault, setMobileMotion, setMobileQuality, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { privacyNotices } from '../../domain/it7-closure'
import { readMobileClosureBoard } from '../../api/support'
import { withdrawLearningConsent } from '../../api/learning-consent-withdrawal'
import { WITHDRAW_BUTTON_LABEL, WITHDRAW_CONFIRM_COPY } from '../../domain/learning-consent-withdrawal'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'
import { listB12NotificationPreferences, updateB12NotificationPreference } from '../../api/b12'
import { DEFAULT_NOTIFICATION_DND_WINDOW, NOTIFICATION_CATEGORIES, NOTIFICATION_DND_OFF, isNotificationDndEnabled, makeNotificationPreferenceCommand, notificationPreferenceMatchesCommand, type NotificationCategory, type NotificationChannel } from '../../domain/notification-preferences'
import type { M1016NotificationPreference, M1016NotificationPreferenceCommand } from '@englishflow/contracts'
import { getUniRuntime } from '../../platform/uni-runtime'
import { hasPendingMobilePreferenceSync, sameMobilePreferenceIdentity, setPendingMobilePreferenceSync, transitionMobilePreferenceSubject } from '../../domain/mobile-preference-sync'
import type { PerformanceLevel } from '@englishflow/performance'
import type { MobileMotionMode, MobileThemeMode } from '../../domain/learner-content'

const store = useLearnerContentStore()
const privacyLines = ref<string[]>([])
const withdrawConfirming = ref(false)
const withdrawing = ref(false)
const withdrawNotice = ref('')
const session = useSessionStore()
function preferenceSyncStorage() { try { return getUniRuntime() } catch { return null } }
let preferenceSubject: string | null = null
let settingsVisible = false
let saveEpoch = 0
let notificationEpoch = 0
function syncPreferenceSubject(subject: string | null | undefined): void {
  const scope = transitionMobilePreferenceSubject(preferenceSubject, subject, preferenceSyncStorage())
  preferenceSubject = scope.subject
  preferenceDraftDirty.value = scope.pendingSync
}
const initialPreferenceScope = transitionMobilePreferenceSubject(null, session.verifiedSubject, preferenceSyncStorage())
preferenceSubject = initialPreferenceScope.subject

const themeMode = ref<MobileThemeMode>(mobileThemeController.theme === 'dark' ? 'DARK' : mobileThemeController.theme === 'light' ? 'LIGHT' : 'SYSTEM')
const motionMode = ref<MobileMotionMode>(mobileMotionMode.value as MobileMotionMode)
const highContrast = ref(mobileThemeController.theme === 'high-contrast')
const qualityLevel = ref<PerformanceLevel>(mobileExperienceEngine.state.level)
const preferenceDraftDirty = ref(initialPreferenceScope.pendingSync)
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')
const localeSaving = ref(false)
const localeSaved = ref(false)
const localeError = ref('')
let applyingAccountPreferences = false
type NotificationSetting = { category: NotificationCategory; label: string; enabled: boolean; unsupportedCadence: boolean }
type NotificationDndRetryTarget = { enabled: boolean; startLocalTime: string; endLocalTime: string }
const notificationSettings = ref<NotificationSetting[]>([])
const notificationRows = ref<M1016NotificationPreference[]>([])
const notificationStatus = ref<'loading' | 'ready' | 'error'>('loading')
const notificationBusy = ref<string | null>(null)
const notificationError = ref('')
const notificationSuccess = ref('')
const notificationDndEnabled = ref(false)
const notificationDndStart = ref(DEFAULT_NOTIFICATION_DND_WINDOW.startLocalTime)
const notificationDndEnd = ref(DEFAULT_NOTIFICATION_DND_WINDOW.endLocalTime)
const notificationDndDirty = ref(false)
const notificationDndConflict = ref(false)
const notificationDndRetryPending = ref(false)
const notificationDndRetryTarget = ref<NotificationDndRetryTarget | null>(null)
watch([themeMode, highContrast], () => mobileThemeController.setTheme(highContrast.value ? 'high-contrast' : themeMode.value.toLowerCase() as 'light' | 'dark' | 'system'))
watch(motionMode, (mode) => setMobileMotion(mode))
watch([themeMode, highContrast, motionMode], () => {
  if (applyingAccountPreferences) return
  const subject = session.verifiedSubject
  if (!subject || subject !== preferenceSubject) return
  preferenceDraftDirty.value = true
  saved.value = false
  saveError.value = ''
  setPendingMobilePreferenceSync(subject, true, preferenceSyncStorage())
}, { flush: 'sync' })
watch([() => session.verifiedSubject, () => session.identityRevision], ([subject]) => {
  syncPreferenceSubject(subject)
  saveEpoch += 1
  saving.value = false
  saved.value = false
  saveError.value = ''
  localeSaving.value = false
  localeSaved.value = false
  localeError.value = ''
  notificationEpoch += 1
  notificationSettings.value = []
  notificationRows.value = []
  notificationStatus.value = 'loading'
  notificationBusy.value = null
  notificationError.value = ''
  notificationSuccess.value = ''
  notificationDndEnabled.value = false
  notificationDndStart.value = DEFAULT_NOTIFICATION_DND_WINDOW.startLocalTime
  notificationDndEnd.value = DEFAULT_NOTIFICATION_DND_WINDOW.endLocalTime
  notificationDndDirty.value = false
  notificationDndConflict.value = false
  notificationDndRetryPending.value = false
  notificationDndRetryTarget.value = null
  withdrawConfirming.value = false
  withdrawing.value = false
  withdrawNotice.value = ''
  applyingAccountPreferences = true
  try {
    themeMode.value = 'SYSTEM'
    highContrast.value = false
    motionMode.value = 'FULL'
  } finally { applyingAccountPreferences = false }
  if (settingsVisible && subject && session.getMobileApiIdentity()) {
    void loadAccountPreferences()
    void loadNotificationSettings()
  }
}, { flush: 'post' })
const unsubscribeQuality = mobileExperienceEngine.subscribe((state) => { qualityLevel.value = state.level })
const themeOptions: Array<{ value: MobileThemeMode; label: string }> = [{ value: 'SYSTEM', label: '跟随系统' }, { value: 'LIGHT', label: '浅色' }, { value: 'DARK', label: '深色' }]
const motionOptions: Array<{ value: MobileMotionMode; label: string }> = [{ value: 'FULL', label: '完整动效' }, { value: 'REDUCED', label: '减少动效' }, { value: 'OFF', label: '关闭动效' }]
const qualityOptions: Array<{ value: PerformanceLevel; label: string }> = [{ value: 'Ultra', label: '超高' }, { value: 'High', label: '高' }, { value: 'Medium', label: '均衡' }, { value: 'Performance', label: '省资源' }]
const localeLabels: Record<string, string> = { 'zh-CN': '简体中文', 'en-US': 'English (US)', 'en-GB': 'English (UK)', 'de-DE': 'Deutsch', 'fr-FR': 'Français', 'es-ES': 'Español' }
function restoreDisplayDefaults(): void {
  if (saving.value || localeSaving.value) return
  themeMode.value = 'SYSTEM'
  highContrast.value = false
  motionMode.value = 'FULL'
  restoreMobileQualityDefault()
  const subject = session.verifiedSubject
  preferenceDraftDirty.value = Boolean(subject && subject === preferenceSubject)
  saved.value = false
  saveError.value = ''
  if (preferenceDraftDirty.value && subject) setPendingMobilePreferenceSync(subject, true, preferenceSyncStorage())
}

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/settings/settings')) { settingsVisible = false; return }
  settingsVisible = true
  syncPreferenceSubject(session.verifiedSubject)
  void loadNotificationSettings()
  privacyLines.value = privacyNotices(await readMobileClosureBoard().catch(() => null))
  await loadAccountPreferences()
})

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
      if (typeof store.forgetOnboardingResume === 'function') store.forgetOnboardingResume()
    }
  } finally {
    withdrawing.value = false
  }
}

onHide(() => { settingsVisible = false })
onBeforeUnmount(unsubscribeQuality)

async function loadAccountPreferences(): Promise<void> {
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  syncPreferenceSubject(identity.subject)
  await store.loadAccount()
  if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
  if (store.accountStatus !== 'ready' || store.lastError) return
  if (preferenceDraftDirty.value || hasPendingMobilePreferenceSync(identity.subject, preferenceSyncStorage())) {
    preferenceDraftDirty.value = true
    return
  }
  applyingAccountPreferences = true
  try {
    themeMode.value = store.account.themeMode
    motionMode.value = store.account.motionMode
    highContrast.value = store.account.highContrast
  } finally { applyingAccountPreferences = false }
}

async function loadNotificationSettings(): Promise<void> {
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  const epoch = ++notificationEpoch
  notificationStatus.value = 'loading'
  notificationError.value = ''
  notificationSuccess.value = ''
  try {
    const rows = await listB12NotificationPreferences()
    if (epoch !== notificationEpoch || !sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationRows.value = rows
    notificationSettings.value = NOTIFICATION_CATEGORIES.map(({ category, label }) => {
      const row = preferenceFor(category, 'IN_APP', rows)
      return {
        category,
        label,
        enabled: row?.enabled === true,
        unsupportedCadence: row?.frequencyPolicy === 'DAILY_DIGEST' || row?.frequencyPolicy === 'WEEKLY_DIGEST',
      }
    })
    const inAppRows = rows.filter(row => row.channel === 'IN_APP')
    const configuredWindow = inAppRows.find(row => isNotificationDndEnabled(row.dndWindow))?.dndWindow
    const distinctWindows = new Set(inAppRows.map(row => isNotificationDndEnabled(row.dndWindow)
      ? `${row.dndWindow.startLocalTime}/${row.dndWindow.endLocalTime}`
      : 'OFF'))
    notificationDndConflict.value = distinctWindows.size > 1
    const retryTarget = notificationDndRetryTarget.value
    if (retryTarget) {
      notificationDndEnabled.value = retryTarget.enabled
      notificationDndStart.value = retryTarget.startLocalTime
      notificationDndEnd.value = retryTarget.endLocalTime
      notificationDndDirty.value = true
    } else {
      notificationDndEnabled.value = Boolean(configuredWindow)
      notificationDndStart.value = configuredWindow?.startLocalTime ?? DEFAULT_NOTIFICATION_DND_WINDOW.startLocalTime
      notificationDndEnd.value = configuredWindow?.endLocalTime ?? DEFAULT_NOTIFICATION_DND_WINDOW.endLocalTime
      notificationDndDirty.value = false
    }
    notificationStatus.value = 'ready'
  } catch {
    if (epoch !== notificationEpoch || !sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationSettings.value = []
    notificationRows.value = []
    notificationStatus.value = 'error'
    notificationError.value = '通知偏好暂时无法读取。'
  }
}

async function toggleNotification(setting: NotificationSetting): Promise<void> {
  if (notificationBusy.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  notificationBusy.value = setting.category
  notificationError.value = ''
  notificationSuccess.value = ''
  const current = preferenceFor(setting.category, 'IN_APP')
  const command = makeNotificationPreferenceCommand(
    setting.category,
    !setting.enabled,
    current,
    current?.dndWindow ?? (notificationDndEnabled.value
      ? { startLocalTime: notificationDndStart.value, endLocalTime: notificationDndEnd.value }
      : NOTIFICATION_DND_OFF),
    setting.enabled ? 'DISABLED' : 'IMMEDIATE',
  )
  try {
    await updateB12NotificationPreference(setting.category, 'IN_APP', command)
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    await loadNotificationSettings()
  } catch {
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    await loadNotificationSettings()
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    if (notificationStatus.value === 'ready'
      && notificationPreferenceMatchesCommand(preferenceFor(setting.category, 'IN_APP'), command)) {
      notificationSuccess.value = '设置已保存。'
      return
    }
    notificationError.value = notificationStatus.value === 'ready'
      ? '保存失败，已更新最新设置，请确认后重试。'
      : '保存失败，且无法读取最新设置；请先重试读取。'
  } finally {
    if (sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) notificationBusy.value = null
  }
}

function preferenceFor(category: NotificationCategory, channel: NotificationChannel, rows = notificationRows.value): M1016NotificationPreference | undefined {
  return rows.find(row => row.category === category && row.channel === channel)
}

function onNotificationDndTimeChange(which: 'start' | 'end', value: string): void {
  if (which === 'start') notificationDndStart.value = value
  else notificationDndEnd.value = value
  notificationDndDirty.value = true
}

async function saveNotificationDnd(enabled: boolean): Promise<void> {
  if (notificationBusy.value) return
  if (enabled && notificationDndStart.value === notificationDndEnd.value) {
    notificationError.value = '开始和结束时间不能相同。'
    return
  }
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  notificationBusy.value = 'dnd'
  notificationError.value = ''
  notificationSuccess.value = ''
  const window = enabled
    ? { startLocalTime: notificationDndStart.value, endLocalTime: notificationDndEnd.value }
    : NOTIFICATION_DND_OFF
  const retryTarget: NotificationDndRetryTarget = {
    enabled,
    startLocalTime: notificationDndStart.value,
    endLocalTime: notificationDndEnd.value,
  }
  notificationDndRetryTarget.value = retryTarget
  try {
    const updates: Array<Promise<M1016NotificationPreference>> = NOTIFICATION_CATEGORIES.map(({ category }) => {
      const current = preferenceFor(category, 'IN_APP')
      const command: M1016NotificationPreferenceCommand = makeNotificationPreferenceCommand(
        category,
        current?.enabled === true,
        current,
        window,
      )
      return updateB12NotificationPreference(category, 'IN_APP', command)
    })
    const results = await Promise.allSettled(updates)
    const failedCount = results.filter(result => result.status === 'rejected').length
    const savedCount = results.length - failedCount
    if (failedCount > 0) {
      await loadNotificationSettings()
      if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
      notificationDndRetryPending.value = true
      notificationDndDirty.value = true
      const result = savedCount > 0 ? `${savedCount} 项已保存，${failedCount} 项未保存。` : '免打扰设置未全部保存。'
      notificationError.value = notificationStatus.value === 'ready'
        ? `${result}已更新最新版本，可重试统一时段。`
        : `${result}无法读取最新版本，请先重试读取。`
      return
    }
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationDndRetryTarget.value = null
    notificationDndRetryPending.value = false
    notificationDndEnabled.value = enabled
    notificationDndDirty.value = false
    await loadNotificationSettings()
  } catch {
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    await loadNotificationSettings()
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationDndRetryPending.value = true
    notificationDndDirty.value = true
    notificationError.value = notificationStatus.value === 'ready'
      ? '免打扰未全部保存，已更新最新版本，可重试统一时段。'
      : '免打扰未全部保存，且无法读取最新版本；请先重试读取。'
  } finally {
    if (sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) notificationBusy.value = null
  }
}

async function save(): Promise<void> {
  if (saving.value || localeSaving.value || !preferenceDraftDirty.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity || identity.subject !== preferenceSubject) return
  const epoch = ++saveEpoch
  saving.value = true
  saved.value = false
  saveError.value = ''
  try {
    await store.savePreferences({ themeMode: themeMode.value, highContrast: highContrast.value, motionMode: motionMode.value })
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    if (store.accountStatus === 'ready' && !store.lastError) {
      saved.value = true
      preferenceDraftDirty.value = false
      setPendingMobilePreferenceSync(identity.subject, false, preferenceSyncStorage())
    } else {
      saveError.value = '本机设置已立即生效，但未同步到账户，请检查网络后重试。'
    }
  } catch {
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    saveError.value = '本机设置已立即生效，但未同步到账户，请检查网络后重试。'
  } finally {
    if (epoch === saveEpoch) saving.value = false
  }
}

async function selectContentLocale(index: number): Promise<void> {
  if (saving.value || localeSaving.value) return
  const contentLocale = index === 1 ? 'zh-CN' : 'en-US'
  if (contentLocale === b10ContentLocale.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity || identity.subject !== preferenceSubject) return
  localeSaving.value = true
  localeSaved.value = false
  localeError.value = ''
  try {
    const savedLocale = await store.saveContentLocale(contentLocale)
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    if (savedLocale && store.accountStatus === 'ready' && store.account.contentLocale === contentLocale) {
      localeSaved.value = true
    } else {
      localeError.value = '学习内容语言未保存，请重试。'
    }
  } finally {
    if (sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) localeSaving.value = false
  }
}
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="settings" />

    <view class="yx-card settings-card">
      <text class="card-title">学习目标</text>
      <text class="setting-row">当前目标 <text>{{ store.goals.find(item => item.value === store.account.goal)?.label || store.account.goal || '尚未设置' }}</text></text>
      <text class="setting-row">每日目标 <text>{{ store.account.quota ?? '—' }} 分钟</text></text>
      <navigator class="settings-link" url="/pages/onboarding/onboarding">修改目标</navigator>
    </view>
    <view class="yx-card settings-card">
      <text class="card-title">偏好设置</text>
      <text class="setting-note">主题、高对比度和动效会立即在本机预览；点保存后同步到账户。</text>
      <text class="setting-label">主题</text>
      <view class="setting-options"><button tabindex="0" role="button" v-for="option in themeOptions" :key="option.value" :class="['setting-option', { selected: themeMode === option.value }]" :disabled="saving || localeSaving" @click="themeMode = option.value">{{ option.label }}</button></view>
      <text class="setting-label">动效</text>
      <view class="setting-options"><button tabindex="0" role="button" v-for="option in motionOptions" :key="option.value" :class="['setting-option', { selected: motionMode === option.value }]" :disabled="saving || localeSaving" @click="motionMode = option.value">{{ option.label }}</button></view>
      <text class="setting-note">减少动效会缩短过渡；关闭动效会停用动画。系统设置优先。</text>
      <label class="setting-check"><checkbox :checked="highContrast" :disabled="saving || localeSaving" @click="highContrast = !highContrast" />高对比度</label>
      <text class="setting-label">画质 <text class="setting-inline-note">（本机生效）</text></text>
      <view class="setting-options"><button tabindex="0" role="button" v-for="option in qualityOptions" :key="option.value" :class="['setting-option', { selected: qualityLevel === option.value }]" :aria-pressed="qualityLevel === option.value" @click="setMobileQuality(option.value)">{{ option.label }}</button></view>
      <text class="setting-note">低帧率或内存不足时，画质可能自动降低。</text>
      <navigator class="settings-link" url="/pages/b6-platform/b6-platform">性能帮助与设备适配说明 ›</navigator>
      <text class="setting-row">界面语言（本机，只读） <text>{{ localeLabels[b10UiLocale] || b10UiLocale }}</text></text>
      <view class="setting-row"><text>学习内容语言</text><picker :disabled="saving || localeSaving" :range="['en-US', 'zh-CN']" :value="b10ContentLocale === 'zh-CN' ? 1 : 0" @change="selectContentLocale(Number($event.detail.value))"><view class="mobile-locale-picker">{{ localeSaving ? '保存中…' : `${b10ContentLocale} ▾` }}</view></picker></view>
      <text v-if="localeSaved" class="success" role="status">学习内容语言已同步到账户。</text>
      <text v-if="localeError" class="error" role="alert">{{ localeError }}</text>
      <text class="setting-note">恢复默认仅重置显示设置和画质；保存后同步账户。</text>
      <button tabindex="0" role="button" class="setting-option reset-defaults" :disabled="saving || localeSaving" @click="restoreDisplayDefaults">恢复显示默认</button>
      <button tabindex="0" role="button" class="yx-button" :loading="saving" :disabled="saving || localeSaving || !preferenceDraftDirty" @click="save">{{ saving ? '保存中…' : '保存主题、对比度与动效' }}</button>
      <text v-if="saved" class="success" role="status">主题、对比度与动效已同步到账户。</text>
      <text v-if="saveError" class="error" role="alert">{{ saveError }}</text>
      <view v-if="store.accountStatus === 'loading'" class="preference-state" role="status">正在读取账户偏好…</view>
      <view v-else-if="!saveError && store.lastError && store.accountStatus !== 'ready'" class="preference-state" role="alert"><text>账户偏好暂时无法读取；本机设置仍可使用。</text><button tabindex="0" role="button" class="setting-option" @click="loadAccountPreferences">重试读取</button></view>
    </view>
    <view class="yx-card settings-card it7-closure">
      <text class="card-title">隐私与数据</text>
      <text v-for="line in privacyLines" :key="line" class="setting-note">{{ line }}</text>
      <text class="card-title">学习同意</text>
      <text class="setting-note">{{ WITHDRAW_CONFIRM_COPY }}</text>
      <button v-if="!withdrawConfirming" tabindex="0" role="button" class="setting-option" type="button" :disabled="withdrawing" @click="withdrawConfirming = true">{{ WITHDRAW_BUTTON_LABEL }}</button>
      <view v-else>
        <text role="alert">{{ WITHDRAW_CONFIRM_COPY }}</text>
        <button tabindex="0" role="button" class="setting-option" type="button" :disabled="withdrawing" @click="confirmWithdrawLearningConsent">{{ withdrawing ? '正在撤回…' : '确认撤回' }}</button>
        <button tabindex="0" role="button" class="setting-option" type="button" :disabled="withdrawing" @click="withdrawConfirming = false">取消</button>
      </view>
      <text v-if="withdrawNotice" class="success" role="status">{{ withdrawNotice }}</text>
    </view>
    <view class="yx-card settings-card">
      <text class="card-title">设备与会话</text>
      <text class="setting-note">查看当前账号已登录的设备，或退出其他设备上的会话。</text>
      <navigator class="settings-link" url="/pages/devices/devices">管理设备与会话 ›</navigator>
    </view>
    <view class="yx-card settings-card" aria-label="站内通知偏好">
      <text class="card-title">站内通知偏好</text>
      <navigator class="settings-link" url="/pages/b4-social/b4-social">查看消息</navigator>
      <text class="setting-note">未设置的类型默认关闭；这里只管理站内消息。</text>
      <text v-if="notificationStatus === 'loading'" class="setting-label" role="status">正在读取…</text>
      <view v-else-if="notificationStatus === 'error'" class="notification-state" role="alert"><text>{{ notificationError }}</text><button tabindex="0" role="button" class="setting-option" @click="loadNotificationSettings">重试</button></view>
      <view v-else v-for="setting in notificationSettings" :key="setting.category" class="notification-row">
        <view><text>{{ setting.label }}</text><text v-if="setting.unsupportedCadence" class="setting-note">摘要投递暂不可用</text></view>
        <button tabindex="0" role="button" class="setting-option" :aria-pressed="setting.enabled" :disabled="Boolean(notificationBusy)" @click="toggleNotification(setting)">{{ notificationBusy === setting.category ? '保存中…' : setting.enabled ? '关闭' : '开启' }}</button>
      </view>
      <view v-if="notificationStatus === 'ready'" class="notification-quiet-hours">
        <view class="notification-row quiet-hours-heading">
          <view><text>站内免打扰</text><text class="setting-note">{{ notificationDndEnabled ? '开启中' : '已关闭' }}；只影响站内提醒</text></view>
          <button tabindex="0" role="button" class="setting-option" :aria-pressed="notificationDndEnabled" :disabled="Boolean(notificationBusy)" @click="saveNotificationDnd(!notificationDndEnabled)">{{ notificationBusy === 'dnd' ? '保存中…' : notificationDndEnabled ? '关闭' : '开启' }}</button>
        </view>
        <text v-if="notificationDndConflict" class="setting-note" role="status">各类型的免打扰时段不一致；保存后会统一。</text>
        <view class="quiet-hours-times">
          <view class="setting-row"><text>开始</text><picker mode="time" :value="notificationDndStart" :disabled="Boolean(notificationBusy)" @change="onNotificationDndTimeChange('start', String($event.detail.value))"><view class="mobile-locale-picker">{{ notificationDndStart }} ▾</view></picker></view>
          <view class="setting-row"><text>结束</text><picker mode="time" :value="notificationDndEnd" :disabled="Boolean(notificationBusy)" @change="onNotificationDndTimeChange('end', String($event.detail.value))"><view class="mobile-locale-picker">{{ notificationDndEnd }} ▾</view></picker></view>
          <button v-if="notificationDndDirty || notificationDndRetryPending" tabindex="0" role="button" class="setting-option" :disabled="Boolean(notificationBusy)" @click="saveNotificationDnd(notificationDndRetryPending ? notificationDndEnabled : true)">{{ notificationBusy === 'dnd' ? '保存中…' : notificationDndRetryPending ? '重试统一设置' : '保存时段' }}</button>
        </view>
      </view>
      <text v-if="notificationStatus === 'ready' && notificationError" class="error" role="alert">{{ notificationError }}</text>
      <text v-if="notificationStatus === 'ready' && notificationSuccess" class="success" role="status">{{ notificationSuccess }}</text>
    </view>
  </view>
</template>

<style scoped>
.settings-card{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.setting-row{display:flex;justify-content:space-between;gap:20rpx;color:var(--yx-text-secondary);font-size:25rpx}.setting-row>text{color:var(--yx-text-primary)}.settings-link{color:var(--yx-brand);font-size:25rpx}.setting-label{color:var(--yx-text-secondary);font-size:24rpx}.setting-note{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.setting-inline-note{font-size:21rpx}.setting-options{display:flex;flex-wrap:wrap;gap:12rpx}.setting-option{margin:0;padding:14rpx 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:24rpx}.setting-option:disabled{opacity:.6}.setting-option.selected{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.reset-defaults{justify-self:start}.setting-check{display:flex;align-items:center;color:var(--yx-text-secondary);font-size:24rpx}.preference-state{display:grid;gap:12rpx;color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.success{color:var(--yx-success);font-size:24rpx}.error{display:block;color:var(--yx-danger);font-size:24rpx}
.notification-row{display:flex;align-items:center;justify-content:space-between;gap:18rpx;padding:12rpx 0;border-top:1rpx solid var(--yx-border);font-size:25rpx}.notification-row .setting-option{min-width:106rpx}.notification-row>view{display:grid;gap:4rpx}.notification-state{display:flex;align-items:center;justify-content:space-between;gap:12rpx;color:var(--yx-danger);font-size:24rpx}.notification-quiet-hours{display:grid;gap:12rpx;margin-top:8rpx;padding-top:8rpx;border-top:1rpx solid var(--yx-border)}.quiet-hours-heading{border:0}.quiet-hours-times{display:grid;gap:10rpx}
</style>
