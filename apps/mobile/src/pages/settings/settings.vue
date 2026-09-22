<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileThemeController } from '../../platform/v2-foundation'
import { b10ContentLocale, setB10ContentLocale } from '../../platform/b10-foundation'
import { mobileMotionMode, setMobileMotion, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useLearnerContentStore } from '../../stores/learner-content'
import type { MobileMotionMode, MobileThemeMode } from '../../domain/learner-content'

const store = useLearnerContentStore()
const themeMode = ref<MobileThemeMode>(mobileThemeController.theme === 'dark' ? 'DARK' : mobileThemeController.theme === 'light' ? 'LIGHT' : 'SYSTEM')
const motionMode = ref<MobileMotionMode>(mobileMotionMode.value as MobileMotionMode)
const highContrast = ref(mobileThemeController.theme === 'high-contrast')
const saving = ref(false)
const saved = ref(false)
watch([themeMode, highContrast], () => mobileThemeController.setTheme(highContrast.value ? 'high-contrast' : themeMode.value.toLowerCase() as 'light' | 'dark' | 'system'))
watch(motionMode, (mode) => setMobileMotion(mode))
const themeOptions: Array<{ value: MobileThemeMode; label: string }> = [{ value: 'SYSTEM', label: '跟随系统' }, { value: 'LIGHT', label: '浅色' }, { value: 'DARK', label: '深色' }]
const motionOptions: Array<{ value: MobileMotionMode; label: string }> = [{ value: 'FULL', label: '完整动效' }, { value: 'REDUCED', label: '减少动效' }, { value: 'OFF', label: '关闭动效' }]

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/settings/settings')) return
  await store.loadAccount()
  if (store.accountStatus !== 'ready' || store.lastError) return
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
      <text class="setting-label">主题</text>
      <view class="setting-options"><button tabindex="0" role="button" v-for="option in themeOptions" :key="option.value" :class="['setting-option', { selected: themeMode === option.value }]" @click="themeMode = option.value">{{ option.label }}</button></view>
      <text class="setting-label">动效</text>
      <view class="setting-options"><button tabindex="0" role="button" v-for="option in motionOptions" :key="option.value" :class="['setting-option', { selected: motionMode === option.value }]" @click="motionMode = option.value">{{ option.label }}</button></view>
      <label class="setting-check"><checkbox :checked="highContrast" @click="highContrast = !highContrast" />高对比度</label>
      <text class="setting-row">界面语言 <text>{{ store.account.uiLocale }}</text></text>
      <view class="setting-row"><text>学习内容语言</text><picker :range="['en-US', 'zh-CN']" :value="b10ContentLocale === 'zh-CN' ? 1 : 0" @change="setB10ContentLocale(Number($event.detail.value) === 1 ? 'zh-CN' : 'en-US')"><view class="mobile-locale-picker">{{ b10ContentLocale }} ▾</view></picker></view>
      <button tabindex="0" role="button" class="yx-button" :loading="saving" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存偏好' }}</button>
      <text v-if="saved" class="success" role="status">偏好已保存。</text>
    </view>
    <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
  </view>
</template>

<style scoped>
.settings-card{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.setting-row{display:flex;justify-content:space-between;gap:20rpx;color:var(--yx-text-secondary);font-size:25rpx}.setting-row>text{color:var(--yx-text-primary)}.settings-link{color:var(--yx-brand);font-size:25rpx}.setting-label{color:var(--yx-text-secondary);font-size:24rpx}.setting-options{display:flex;flex-wrap:wrap;gap:12rpx}.setting-option{margin:0;padding:14rpx 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:24rpx}.setting-option.selected{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.setting-check{display:flex;align-items:center;color:var(--yx-text-secondary);font-size:24rpx}.success{color:var(--yx-success);font-size:24rpx}.error{display:block;color:var(--yx-danger);font-size:24rpx}
</style>
