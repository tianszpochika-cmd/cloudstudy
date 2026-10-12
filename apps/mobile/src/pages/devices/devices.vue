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
/* v2 设备页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 webDemo/mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-devices-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-devices-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-devices-body>*{min-width:0;max-width:100%}
.v2-devices-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-devices-card:hover{border-color:var(--v2-brand)}
.v2-devices-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-devices-head>*{min-width:0;max-width:100%}
.v2-devices-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-devices-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-devices-title{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-devices-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-devices-h2{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-devices-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-devices-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-devices-list>*{min-width:0;max-width:100%}
.v2-devices-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-devices-row:hover{border-color:var(--v2-brand)}
.v2-devices-row>*{min-width:0;max-width:100%}
.v2-devices-row-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 100%;font-family:var(--v2-font)}
.v2-devices-row-head>*{min-width:0;max-width:100%}
.v2-devices-copy{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-devices-tag{display:inline-flex;align-items:center;justify-self:start;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-devices-state{display:inline-flex;align-items:center;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-devices-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-devices-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-devices-btn>*,.v2-devices-opt>*{min-width:0;max-width:100%}
.v2-devices-btn:hover,.v2-devices-opt:hover{border-color:var(--v2-brand)}
.v2-devices-btn:active,.v2-devices-opt:active{transform:scale(.97)}
.v2-devices-btn:focus-visible,.v2-devices-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-devices-btn:disabled,.v2-devices-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-devices-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700;white-space:nowrap}
.v2-devices-submit:hover{border-color:var(--v2-brand)}
.v2-devices-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-devices-empty{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px dashed var(--v2-line);border-radius:var(--v2-radius-md);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
