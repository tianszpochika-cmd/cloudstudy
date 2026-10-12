<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
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
const hasLoadedAccount = ref(false)
const goalNames: Record<string, string> = {
  FOUNDATION: '成人零基础', ZERO_BASIS: '成人零基础',
  COLLEGE_CET: '四六级备考', CET_4_6: '四六级备考',
  POSTGRADUATE_ENGLISH: '考研英语', POSTGRADUATE: '考研英语',
  WORKPLACE_DAILY: '职场与日常',
}
const goalLabel = computed(() => store.account.goal
  ? goalNames[store.account.goal] ?? store.goals.find((item) => item.value === store.account.goal)?.label ?? '目标暂未识别'
  : '尚未设置')
const dailyGoal = computed(() => store.account.quota && store.account.quota > 0 ? `${store.account.quota} 分钟/天` : '')
const localeLabels: Record<string, string> = { 'zh-CN': '中文', 'en-US': '英语', 'en-GB': '英语', 'de-DE': '德语', 'fr-FR': '法语', 'es-ES': '西班牙语' }
const uiLocaleLabel = computed(() => localeLabels[store.account.uiLocale] ?? '暂未识别')
const contentLocaleLabel = computed(() => localeLabels[store.account.contentLocale] ?? '暂未识别')
const accountFailure = computed(() => !hasLoadedAccount.value && !['idle', 'loading', 'ready'].includes(store.accountStatus))

async function refreshAccount(): Promise<void> {
  hasLoadedAccount.value = false
  await store.loadAccount()
  hasLoadedAccount.value = store.accountStatus === 'ready'
}

onShow(async () => {
  if (await ensureMobilePageAccess('/pages/profile/profile')) await refreshAccount()
})


// After a successful logout leave the account page for the login entry.
async function logoutAndLeave(): Promise<void> {
  if (await session.logout()) openUniPage('/pages/login/login')
}
</script>

<template>
  <view class="yx-page v2-profile-body" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="profile" />

    <view v-if="!hasLoadedAccount && !accountFailure" class="yx-card profile-state card v2-profile-card v2-profile-fb" role="status"><AppIcon name="refresh" :size="14" />正在读取学习资料…</view>
    <view v-else-if="accountFailure" class="yx-card profile-state card v2-profile-card" role="alert">
      <text class="card-title v2-profile-title v2-profile-h2">学习资料暂不可用</text>
      <text class="error d v2-profile-d">{{ store.lastError || '请稍后重试。' }}</text>
      <button tabindex="0" role="button" class="yx-button btn v2-profile-btn v2-profile-opt v2-profile-submit" type="button" @click="refreshAccount">重试<AppIcon name="refresh" :size="14" /></button>
    </view>
    <view v-if="hasLoadedAccount" class="yx-card mobile-profile-banner card v2-profile-card v2-profile-summary"><view class="mobile-profile-avatar v2-profile-dot" aria-hidden="true">学</view><view class="v2-profile-titles"><view class="v2-profile-h2"><AppIcon name="me" :size="20" /><text class="mobile-profile-name v2-profile-title">我的学习</text></view><text class="mobile-profile-caption d v2-profile-d">{{ goalLabel }}<text v-if="dailyGoal"> · {{ dailyGoal }}</text></text></view></view>
    <view v-if="hasLoadedAccount" class="yx-card profile-facts card v2-profile-card">
      <view class="eyebrow v2-profile-eyebrow"><AppIcon name="gear" :size="14" /><text>设置与帮助</text></view>
      <text class="card-title v2-profile-title v2-profile-h2">账号与语言</text>
      <text class="d v2-profile-d">成人核验：{{ session.adultGate === 'PASSED' ? '已通过' : session.adultGate === 'REJECTED' ? '未通过' : '待核验' }}</text>
      <text class="d v2-profile-d">界面语言：{{ uiLocaleLabel }}</text>
      <text class="d v2-profile-d">学习语言：{{ contentLocaleLabel }}</text>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-profile-btn v2-profile-opt" type="button" @click="openUniPage('/pages/onboarding/onboarding')">修改学习目标<AppIcon name="chev" :size="14" /></button>
    </view>
    <view class="yx-card card v2-profile-card v2-profile-links"><view class="eyebrow v2-profile-eyebrow"><AppIcon name="list" :size="14" /><text>发现</text></view><text class="card-title v2-profile-title v2-profile-h2">{{ mobileT('profileLinks') }}</text><view class="v2-profile-list"><button tabindex="0" role="button" v-for="page in servicePages" :key="page" class="mobile-menu-row opt btn v2-profile-btn v2-profile-opt v2-profile-row" @click="openUniPage(`/pages/${page}/${page}`)"><text>{{ mobileT(`pages.${page}.short`) }}</text><AppIcon name="chev" :size="14" /></button></view></view>
    <button tabindex="0" role="button" v-if="session.isAuthenticated" class="yx-button btn v2-profile-btn v2-profile-opt v2-profile-submit" type="button" @click="logoutAndLeave"><AppIcon name="back" :size="14" />{{ authT('session.logout') }}</button>
  </view>
</template>

<style scoped>
.profile-state,.profile-facts{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.profile-facts text:not(.card-title){color:var(--yx-text-secondary);font-size:24rpx}.mobile-profile-banner>view:last-child{min-width:0;overflow-wrap:anywhere}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}.error{display:block;color:var(--yx-danger);font-size:24rpx}
</style>
