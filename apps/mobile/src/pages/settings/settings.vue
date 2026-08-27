<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useLearnerContentStore } from '../../stores/learner-content'
import type { MobileMotionMode, MobileThemeMode } from '../../domain/learner-content'

const store = useLearnerContentStore()
const themeMode = ref<MobileThemeMode>('SYSTEM')
const motionMode = ref<MobileMotionMode>('FULL')
const highContrast = ref(false)
const saving = ref(false)
const saved = ref(false)
const themeOptions: Array<{ value: MobileThemeMode; label: string }> = [{ value: 'SYSTEM', label: '跟随系统' }, { value: 'LIGHT', label: '浅色' }, { value: 'DARK', label: '深色' }]
const motionOptions: Array<{ value: MobileMotionMode; label: string }> = [{ value: 'FULL', label: '完整动效' }, { value: 'REDUCED', label: '减少动效' }, { value: 'OFF', label: '关闭动效' }]

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/settings/settings')) return
  await store.loadAccount()
  themeMode.value = store.account.themeMode
  motionMode.value = store.account.motionMode
  highContrast.value = store.account.highContrast
})

async function save(): Promise<void> {
  saving.value = true
  saved.value = false
  await store.savePreferences({ themeMode: themeMode.value, highContrast: highContrast.value, motionMode: motionMode.value })
  saved.value = store.accountStatus === 'ready' && !store.lastError
  saving.value = false
}
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">ACCOUNT & PRIVACY</text>
    <text class="yx-title">设置</text>
    <view class="yx-card settings-card">
      <text class="card-title">学习目标</text>
      <text class="setting-row">当前目标 <text>{{ store.account.goal || '尚未设置' }}</text></text>
      <text class="setting-row">每日目标 <text>{{ store.account.quota ?? '—' }} 分钟</text></text>
      <navigator class="settings-link" url="/pages/onboarding/onboarding">修改目标</navigator>
    </view>
    <view class="yx-card settings-card">
      <text class="card-title">偏好设置</text>
      <text class="setting-label">主题</text>
      <view class="setting-options"><button v-for="option in themeOptions" :key="option.value" :class="['setting-option', { selected: themeMode === option.value }]" @click="themeMode = option.value">{{ option.label }}</button></view>
      <text class="setting-label">动效</text>
      <view class="setting-options"><button v-for="option in motionOptions" :key="option.value" :class="['setting-option', { selected: motionMode === option.value }]" @click="motionMode = option.value">{{ option.label }}</button></view>
      <label class="setting-check"><checkbox :checked="highContrast" @click="highContrast = !highContrast" />高对比度</label>
      <text class="setting-row">界面语言 <text>{{ store.account.uiLocale }}</text></text>
      <text class="setting-row">学习内容语言 <text>{{ store.account.contentLocale }}</text></text>
      <button class="yx-button" :loading="saving" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存偏好' }}</button>
      <text v-if="saved" class="success" role="status">偏好已保存到服务端。</text>
    </view>
    <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
  </view>
</template>

<style scoped>
.settings-card{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.setting-row{display:flex;justify-content:space-between;gap:20rpx;color:#666d80;font-size:25rpx}.setting-row>text{color:#202332}.settings-link{color:#596bff;font-size:25rpx}.setting-label{color:#666d80;font-size:24rpx}.setting-options{display:flex;flex-wrap:wrap;gap:12rpx}.setting-option{margin:0;padding:14rpx 18rpx;border:1rpx solid #e6e8f0;border-radius:12rpx;color:#666d80;background:#fff;font-size:24rpx}.setting-option.selected{border-color:#596bff;color:#596bff;background:#eef0ff}.setting-check{display:flex;align-items:center;color:#666d80;font-size:24rpx}.success{color:#25855a;font-size:24rpx}.error{display:block;color:#b54747;font-size:24rpx}
</style>
