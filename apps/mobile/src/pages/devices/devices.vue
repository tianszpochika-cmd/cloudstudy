<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import type { B8Device } from '@englishflow/contracts'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { listMobileDevices, kickoutMobileDevice } from '../../api/devices'
import { canRevokeMobileDevice, isCurrentMobileDevice } from '../../domain/devices'
import { useSessionStore } from '../../stores/session'
import { useMobileExperience } from '../../platform/experience'
import { sameMobilePreferenceIdentity } from '../../domain/mobile-preference-sync'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const devices = ref<B8Device[]>([])
const deviceStatus = ref<'loading' | 'ready' | 'empty' | 'error'>('loading')
const errorMessage = ref('')
const actionError = ref('')
const actionMessage = ref('')
const busyAction = ref<string | null>(null)
let devicesVisible = false
let loadEpoch = 0
const revocableDevices = computed(() => devices.value.filter(device => canRevokeMobileDevice(device, session.deviceId)))

function currentAccount(identity: { subject: string; revision: number } | null): boolean {
  return sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())
}

watch(() => session.identityRevision, () => {
  loadEpoch += 1
  devices.value = []
  deviceStatus.value = 'loading'
  errorMessage.value = ''
  actionError.value = ''
  actionMessage.value = ''
  busyAction.value = null
  if (devicesVisible && session.getMobileApiIdentity()) void loadDevices()
}, { flush: 'sync' })

function deviceTypeLabel(type: string): string {
  const labels: Record<string, string> = { IOS: 'iOS 设备', ANDROID: 'Android 设备', H5: '移动网页', WEB: '网页浏览器', WEB_COOKIE: '网页或移动浏览器' }
  return labels[type.toUpperCase()] ?? '其他设备'
}

function lastLoginLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
}

function shortDeviceId(deviceId: string): string {
  return deviceId.length > 10 ? `…${deviceId.slice(-8)}` : deviceId
}

async function loadDevices(): Promise<boolean> {
  const identity = session.getMobileApiIdentity()
  if (!identity) return false
  const epoch = ++loadEpoch
  deviceStatus.value = 'loading'
  errorMessage.value = ''
  actionError.value = ''
  actionMessage.value = ''
  devices.value = []
  try {
    const nextDevices = await listMobileDevices()
    if (epoch !== loadEpoch || !currentAccount(identity)) return false
    devices.value = nextDevices
    deviceStatus.value = devices.value.length ? 'ready' : 'empty'
    return true
  } catch (error) {
    if (epoch !== loadEpoch || !currentAccount(identity)) return false
    devices.value = []
    deviceStatus.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '设备列表暂时无法读取，请重试。'
    return false
  }
}

function confirmExit(title: string, content: string): Promise<boolean> {
  return new Promise(resolve => {
    uni.showModal({
      title,
      content,
      confirmText: '确认退出',
      cancelText: '取消',
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
}

async function revokeDevice(device: B8Device): Promise<void> {
  if (busyAction.value || !canRevokeMobileDevice(device, session.deviceId)) return
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  if (!await confirmExit('退出这台设备？', `将结束设备 ${shortDeviceId(device.deviceId)} 的登录会话。`)) return
  if (!currentAccount(identity)) return
  busyAction.value = device.deviceId
  actionError.value = ''
  actionMessage.value = ''
  try {
    await kickoutMobileDevice(device.deviceId)
    if (!currentAccount(identity)) return
    const refreshed = await loadDevices()
    if (!currentAccount(identity)) return
    actionMessage.value = refreshed
      ? '该设备已退出，设备列表已刷新。'
      : '退出请求已提交，但列表刷新失败；请刷新核对最新状态。'
  } catch (error) {
    if (!currentAccount(identity)) return
    actionError.value = error instanceof Error ? error.message : '退出设备失败，请重试。'
  } finally {
    if (currentAccount(identity)) busyAction.value = null
  }
}

async function revokeOtherDevices(): Promise<void> {
  const targets = revocableDevices.value.slice()
  if (busyAction.value || !session.deviceId || !targets.length) return
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  if (!await confirmExit('退出其他设备？', `将结束其他 ${targets.length} 台设备的登录会话；当前设备会保留。`)) return
  if (!currentAccount(identity)) return
  busyAction.value = 'others'
  actionError.value = ''
  actionMessage.value = ''
  let revokedCount = 0
  let failedCount = 0
  for (const device of targets) {
    if (!currentAccount(identity)) return
    if (!canRevokeMobileDevice(device, session.deviceId)) continue
    try {
      await kickoutMobileDevice(device.deviceId)
      revokedCount += 1
    } catch {
      failedCount += 1
    }
  }
  if (!currentAccount(identity)) return
  const refreshed = await loadDevices()
  if (!currentAccount(identity)) return
  if (failedCount) actionError.value = `${revokedCount} 台已退出，${failedCount} 台未完成，请刷新后重试。`
  else actionMessage.value = `其他 ${revokedCount} 台设备已退出。`
  if (!refreshed) actionMessage.value = '退出请求已处理，但列表刷新失败；请刷新核对最新状态。'
  busyAction.value = null
}

onShow(async () => {
  if (await ensureMobilePageAccess('/pages/devices/devices')) { devicesVisible = true; await loadDevices() }
})
onHide(() => { devicesVisible = false })
</script>

<template>
  <view class="yx-page devices-page v2-devices-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="settings" kicker="账户安全" title="设备与会话" description="查看已登录设备，退出不再使用的会话。" />

    <view class="v2-devices-body">
    <view class="yx-card devices-card card v2-devices-card">
      <view class="devices-heading v2-devices-head">
        <view class="v2-devices-titles">
          <view class="v2-devices-eyebrow eyebrow"><AppIcon name="shield" :size="14" /><text>账户安全</text></view>
          <text class="devices-card-title h2 v2-devices-title v2-devices-h2">已登录设备</text>
          <text class="devices-note d v2-devices-d">退出设备后，该设备需要重新登录。</text>
        </view>
        <button tabindex="0" role="button" class="devices-secondary btn opt v2-devices-btn v2-devices-opt" :loading="deviceStatus === 'loading'" :disabled="deviceStatus === 'loading' || Boolean(busyAction)" @click="loadDevices">刷新<AppIcon name="refresh" :size="14" /></button>
      </view>

      <view v-if="deviceStatus === 'loading'" class="devices-state fb d v2-devices-state v2-devices-fb v2-devices-d v2-devices-empty" role="status"><AppIcon name="refresh" :size="14" /><text class="d v2-devices-d">正在读取设备列表…</text></view>
      <view v-else-if="deviceStatus === 'error'" class="devices-state devices-error fb d v2-devices-state v2-devices-fb v2-devices-d" role="alert"><text class="d v2-devices-d">{{ errorMessage }}</text><button tabindex="0" role="button" class="devices-secondary btn opt v2-devices-btn v2-devices-opt" :disabled="Boolean(busyAction)" @click="loadDevices">重试<AppIcon name="refresh" :size="14" /></button></view>
      <view v-else-if="deviceStatus === 'empty'" class="devices-state fb d v2-devices-state v2-devices-fb v2-devices-d v2-devices-empty" role="status"><AppIcon name="inbox" :size="14" /><text class="d v2-devices-d">当前账号还没有设备记录。</text></view>

      <template v-else>
        <text v-if="!session.deviceId" class="devices-safety fb d v2-devices-fb v2-devices-d" role="alert">当前设备标识暂不可确认。为避免退出正在使用的设备，撤销操作已停用；请重新登录后再试。</text>
        <button tabindex="0" role="button" class="devices-danger btn opt v2-devices-btn v2-devices-opt v2-devices-submit" :disabled="Boolean(busyAction) || !revocableDevices.length" :loading="busyAction === 'others'" @click="revokeOtherDevices">退出其他设备（{{ revocableDevices.length }}）<AppIcon name="swap" :size="14" /></button>
        <view class="device-list v2-devices-list">
          <view v-for="device in devices" :key="device.deviceId" class="device-row list-row row card v2-devices-row v2-devices-card">
            <view class="device-row-heading v2-devices-row-head">
              <view class="v2-devices-copy"><text class="device-name v2-devices-name v2-devices-h2">{{ deviceTypeLabel(device.deviceType) }}</text><text class="device-id d v2-devices-d">设备编号 {{ shortDeviceId(device.deviceId) }}</text></view>
              <text class="tag v2-devices-tag v2-devices-state" :class="['device-status', device.status === 'ACTIVE' ? 'device-status--active' : '']">{{ isCurrentMobileDevice(device, session.deviceId) ? '当前设备' : device.status === 'ACTIVE' ? '使用中' : '已退出' }}</text>
            </view>
            <text class="device-last-active d v2-devices-d">最近登录：{{ lastLoginLabel(device.lastActiveAt) }}</text>
            <text v-if="isCurrentMobileDevice(device, session.deviceId)" class="device-protected d v2-devices-d">当前设备不能从此处退出。</text>
            <button v-else-if="canRevokeMobileDevice(device, session.deviceId)" tabindex="0" role="button" class="devices-secondary device-revoke btn opt v2-devices-btn v2-devices-opt" :loading="busyAction === device.deviceId" :disabled="Boolean(busyAction)" @click="revokeDevice(device)">退出此设备<AppIcon name="x" :size="14" /></button>
          </view>
        </view>
      </template>

      <text v-if="actionMessage" class="devices-success fb d v2-devices-fb v2-devices-d" role="status">{{ actionMessage }}</text>
      <text v-if="actionError" class="devices-error fb d v2-devices-fb v2-devices-d" role="alert">{{ actionError }}</text>
    </view>
    </view>
  </view>
</template>

<style scoped>
.devices-page{padding-bottom:80rpx}.devices-card{display:grid;gap:20rpx}.devices-heading,.device-row-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18rpx}.devices-card-title,.device-name{display:block;font-size:30rpx;font-weight:700}.devices-note,.device-id,.device-last-active{display:block;margin-top:6rpx;color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.devices-secondary,.devices-danger{min-height:68rpx;margin:0;padding:0 20rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:23rpx;line-height:1.4}.devices-danger{border-color:var(--yx-danger);color:var(--yx-danger)}.devices-secondary:disabled,.devices-danger:disabled{opacity:.55}.devices-state{display:grid;gap:14rpx;padding:20rpx 0;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.5}.devices-error,.devices-safety{color:var(--yx-danger);font-size:23rpx;line-height:1.5}.device-list{display:grid}.device-row{display:grid;gap:12rpx;padding:20rpx 0;border-top:1rpx solid var(--yx-border)}.device-status{flex:none;color:var(--yx-text-secondary);font-size:22rpx}.device-status--active{color:var(--yx-success)}.device-protected{color:var(--yx-text-secondary);font-size:22rpx}.device-revoke{justify-self:start}.devices-success{color:var(--yx-success);font-size:23rpx;line-height:1.5}
</style>
