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
/* v2 我的页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.btn/.opt/.fb/.menu-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片数值，仅用 var(--v2-*)。 */
.v2-profile-body{box-sizing:border-box;display:flex;flex-direction:column;gap:var(--v2-space-4);min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-profile-body>view,.v2-profile-body>button{box-sizing:border-box;min-width:0;max-width:100%}
.v2-profile-card{box-sizing:border-box;display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-profile-card:hover{border-color:var(--v2-brand)}
.v2-profile-eyebrow{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-profile-title{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-profile-h2{box-sizing:border-box;display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);min-width:0;max-width:100%;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-profile-h2>*{min-width:0;max-width:100%}
.v2-profile-d{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-profile-summary{box-sizing:border-box;display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-4);min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-profile-summary>*{min-width:0;max-width:100%}
.v2-profile-dot{box-sizing:border-box;display:flex;flex:none;align-items:center;justify-content:center;width:var(--v2-space-12);height:var(--v2-space-12);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1}
.v2-profile-titles{box-sizing:border-box;display:grid;gap:var(--v2-space-1);flex:1 1 0;min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-profile-links{box-sizing:border-box;display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-profile-list{box-sizing:border-box;display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-profile-list>*{min-width:0;max-width:100%}
.v2-profile-row{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;text-align:left;white-space:normal;overflow-wrap:anywhere}
.v2-profile-row:hover{border-color:var(--v2-brand)}
.v2-profile-row>*{min-width:0;max-width:100%}
.v2-profile-btn,.v2-profile-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;text-align:center;white-space:nowrap;overflow-wrap:anywhere}
.v2-profile-btn>*,.v2-profile-opt>*{min-width:0;max-width:100%}
.v2-profile-opt:hover,.v2-profile-btn:hover{border-color:var(--v2-brand)}
.v2-profile-opt:active,.v2-profile-btn:active{transform:scale(.97)}
.v2-profile-opt:focus-visible,.v2-profile-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-profile-opt:disabled,.v2-profile-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-profile-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-profile-submit:hover{border-color:var(--v2-brand)}
.v2-profile-row.v2-profile-btn,.v2-profile-row.v2-profile-opt,.v2-profile-list .v2-profile-btn,.v2-profile-list .v2-profile-opt{justify-content:space-between;text-align:left;white-space:normal}
.v2-profile-fb{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
