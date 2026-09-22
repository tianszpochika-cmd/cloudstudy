<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'
import { authT } from '../../auth/i18n'

const session = useSessionStore()
const store = useLearnerContentStore()
const servicePages = ['b10-report', 'today', 'b5-commerce', 'b4-offline', 'b4-avatar', 'settings', 'b6-platform', 'support']
const nickname = ref('')
const accent = ref<'US' | 'UK'>('US')
const saving = ref(false)
const saved = ref(false)
const goalLabel = computed(() => store.goals.find((item) => item.value === store.account.goal)?.label ?? store.account.goal ?? '尚未设置')

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/profile/profile')) return
  await store.loadAccount()
  nickname.value = store.account.nickname
  accent.value = store.account.accentPref
})

async function save(): Promise<void> {
  saving.value = true
  saved.value = false
  await store.saveProfile({ nickname: nickname.value.trim() || '学习者', accentPref: accent.value })
  saved.value = store.accountStatus === 'ready' && !store.lastError
  saving.value = false
}
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="profile" />

    <view class="yx-card mobile-profile-banner"><view class="mobile-profile-avatar" aria-hidden="true">{{ (nickname || 'S').slice(0, 1) }}</view><view><text class="mobile-profile-name">{{ nickname || '学习者' }}</text><text class="mobile-profile-caption">{{ goalLabel }} · {{ store.account.quota ?? '—' }} 分钟 / 天</text></view></view>
    <view class="yx-card profile-card">
      <text class="card-title">学习资料</text>
      <label class="field"><text>昵称</text><input v-model="nickname" aria-label="昵称" /></label>
      <label class="field"><text>发音偏好</text><picker :range="['US', 'UK']" :value="accent === 'US' ? 0 : 1" @change="accent = Number($event.detail.value) === 1 ? 'UK' : 'US'"><view class="picker-value">{{ accent === 'US' ? '美式英语' : '英式英语' }}</view></picker></label>
      <button tabindex="0" role="button" class="yx-button" :loading="saving" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存资料' }}</button>
      <text v-if="saved" class="success" role="status">资料已保存。</text>
    </view>
    <view class="yx-card profile-facts">
      <text class="card-title">我的学习档案</text>
      <text>学习目标：{{ goalLabel }}</text>
      <text>每日目标：{{ store.account.quota ?? '—' }} 分钟</text>
      <text>年龄确认：{{ store.account.ageConfirmed ? '已确认' : '待确认' }}</text>
      <text>界面：{{ store.account.uiLocale }} · 内容：{{ store.account.contentLocale }}</text>
    </view>
    <view class="yx-card"><text class="card-title">{{ mobileT('profileLinks') }}</text><button tabindex="0" role="button" v-for="page in servicePages" :key="page" class="mobile-menu-row" @click="openUniPage(`/pages/${page}/${page}`)"><text>{{ mobileT(`pages.${page}.short`) }}</text><text aria-hidden="true">›</text></button></view>
    <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
    <button tabindex="0" role="button" v-if="session.isAuthenticated" class="yx-button" type="button" @click="session.logout">{{ authT('session.logout') }}</button>
  </view>
</template>

<style scoped>
.b6-profile-entry{display:flex;flex-direction:column;gap:8rpx;color:var(--yx-text-primary);font-size:30rpx;font-weight:600}.b6-profile-entry__hint{color:var(--yx-text-secondary);font-size:24rpx;font-weight:400}.profile-card,.profile-facts{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.field{display:grid;gap:8rpx;color:var(--yx-text-secondary);font-size:24rpx}.field input,.picker-value{box-sizing:border-box;min-height:76rpx;padding:20rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card)}.profile-facts text:not(.card-title){color:var(--yx-text-secondary);font-size:24rpx}.success{color:var(--yx-success);font-size:24rpx}.error{display:block;color:var(--yx-danger);font-size:24rpx}
</style>
