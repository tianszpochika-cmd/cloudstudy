<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'
import { authT } from '../../auth/i18n'

const store = useLearnerContentStore()
const session = useSessionStore()
const step = ref<1 | 2>(1)
const goal = ref<string | null>(store.onboarding.goal)
const quota = ref<number>(store.onboarding.quota ?? 15)
const birthYear = ref<number | null>(null)
const ageConfirmed = ref(false)
const privacyConsent = ref(false)
const termsConsent = ref(false)
const saving = ref(false)
const saveAttempted = ref(false)
const adultError = ref<string | null>(null)
let loaded = false
watch(() => session.identityRevision, () => {
  loaded = false
  step.value = 1
  goal.value = null
  quota.value = 15
  birthYear.value = null
  ageConfirmed.value = false
  privacyConsent.value = false
  termsConsent.value = false
  saveAttempted.value = false
  adultError.value = null
}, { flush: 'sync' })

const adultBirthYearValid = computed(() => Boolean(birthYear.value && birthYear.value >= 1900 && birthYear.value <= new Date().getFullYear() - 18))
const canContinue = computed(() => {
  if (session.adultGate === 'REJECTED') return false
  return step.value === 1
    ? adultBirthYearValid.value && ageConfirmed.value && privacyConsent.value && termsConsent.value
    : Boolean(goal.value && quota.value)
})

function goLogin(url = '/pages/login/login'): void {
  const runtime = getUniRuntime()
  if (runtime.reLaunch) runtime.reLaunch({ url })
  else runtime.navigateTo({ url })
}

function nextPath(): string {
  const returnTo = session.consumeReturnTo()
  return returnTo === '/pages/home/home' || returnTo === '/pages/onboarding/onboarding'
    ? '/pages/assessment/assessment'
    : returnTo
}

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { goLogin('/pages/login/login?returnTo=%2Fpages%2Fonboarding%2Fonboarding'); return }
  if (loaded) return
  const revision = session.identityRevision
  // Learner reads are protected until the adult gate and consents are complete.
  // The bounded goal choices are available locally for first-time onboarding.
  if (session.isLearningReady) {
    await store.loadOnboarding()
    if (revision !== session.identityRevision || !session.isAuthenticated) return
    goal.value = store.onboarding.goal
    quota.value = store.onboarding.quota ?? 15
  } else {
    goal.value = null
    quota.value = 15
  }
  loaded = true
})

async function next(): Promise<void> {
  if (!canContinue.value || saving.value) return

  if (step.value === 1) {
    saving.value = true
    adultError.value = null
    try {
      if (session.adultGate !== 'PASSED' && !(await session.confirmAdultGate(Number(birthYear.value)))) {
        adultError.value = session.lastError ?? authT('adult.rejected')
        return
      }
      step.value = 2
    } finally {
      saving.value = false
    }
    return
  }

  saving.value = true
  adultError.value = null
  saveAttempted.value = true
  try {
    await store.saveOnboarding(goal.value as string, quota.value, {
      birthYear: Number(birthYear.value),
      ageConfirmed: true,
      privacyConsent: true,
      termsConsent: true,
    })
    if (store.onboardingStatus === 'ready') openUniPage(nextPath())
  } finally {
    saving.value = false
  }
}

async function cancel(): Promise<void> {
  if (saving.value) return
  saving.value = true
  await session.logout()
  goLogin()
  saving.value = false
}
</script>

<template>
  <view class="yx-page yx-onboarding" :aria-busy="saving || store.onboardingStatus === 'loading'" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="onboarding" />

    <view class="yx-setup-progress" aria-label="首次设置进度">
      <view :class="['yx-setup-progress__item', { active: step === 1, done: step === 2 }]">
        <text class="yx-setup-progress__number">1</text>
        <text>确认身份</text>
      </view>
      <view :class="['yx-setup-progress__item', { active: step === 2 }]">
        <text class="yx-setup-progress__number">2</text>
        <text>选择目标</text>
      </view>
    </view>

    <view class="yx-card yx-onboarding-card">
      <view v-if="session.adultGate === 'REJECTED'" class="yx-onboarding-step" role="alert">
        <text class="section-kicker">访问受限</text>
        <text class="section-title">暂未开放学习</text>
        <text class="section-description">当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。</text>
        <text class="flow-note">根据平台合规要求，Phase 1 仅面向 18 周岁以上成年人开放。你可以访问账号设置、隐私与客服支持功能。</text>
        <view class="onboarding-actions" style="margin-top: 24rpx;">
          <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="openUniPage('/pages/profile/profile')">前往个人中心与设置</button>
          <button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="openUniPage('/pages/support/support')">帮助与反馈</button>
        </view>
      </view>

      <view v-else-if="step === 1" class="yx-onboarding-step">
        <text class="section-kicker">确认身份与同意事项</text>
        <text class="section-title">确认成人身份</text>
        <text class="section-description">仅限已满 18 岁的学习者。</text>
        <label class="birth-year"><text>出生年份</text><input v-model.number="birthYear" type="number" inputmode="numeric" placeholder="例如 1995" aria-label="出生年份" /></label>
        <label class="consent"><checkbox :checked="ageConfirmed" @click="ageConfirmed = !ageConfirmed" /><text>我确认自己已满 18 周岁</text></label>
        <label class="consent"><checkbox :checked="privacyConsent" @click="privacyConsent = !privacyConsent" /><text>我同意隐私说明</text></label>
        <label class="consent"><checkbox :checked="termsConsent" @click="termsConsent = !termsConsent" /><text>我同意学习服务条款</text></label>
      </view>

      <view v-else class="yx-onboarding-step">
        <text class="section-kicker">选择学习目标</text>
        <text class="section-title">你想先解决什么？</text>
        <text class="section-description">选一个最重要的方向，我们会据此准备首日测评和学习任务。</text>
        <text class="field-title">学习目标</text>
        <view class="choice-list">
          <button tabindex="0" role="button" v-for="item in store.goals" :key="item.value" :class="['choice', { selected: goal === item.value }]" type="button" :aria-pressed="goal === item.value" @click="goal = item.value"><text>{{ item.label }}</text><text class="choice-description">{{ item.description }}</text></button>
        </view>
        <text class="field-title">每天愿意投入多久？</text>
        <view class="choice-list choice-list--quota">
          <button tabindex="0" role="button" v-for="item in store.quotas" :key="item" :class="['choice', 'quota-choice', { selected: quota === item }]" type="button" :aria-pressed="quota === item" @click="quota = item">{{ item }} 分钟</button>
        </view>
        <text class="flow-note">目标和学习偏好之后都可以在设置中调整。</text>
      </view>

      <text v-if="adultError" class="error" role="alert">{{ adultError }}</text>
      <text v-if="step === 2 && saveAttempted && store.onboardingStatus === 'offline'" class="error" role="alert">学习目标尚未保存，请重试。</text>
      <view class="onboarding-actions">
        <button tabindex="0" role="button" v-if="step === 2" class="yx-button yx-button--secondary" type="button" :disabled="saving" @click="step = 1">上一步</button>
        <button tabindex="0" role="button" class="yx-button" type="button" :disabled="!canContinue || saving || store.onboardingStatus === 'loading'" @click="next">{{ saving ? (step === 1 ? '正在确认…' : '正在保存…') : step === 1 ? '继续' : '保存并开始测评' }}</button>
      </view>
    </view>

    <button tabindex="0" role="button" class="yx-flow-cancel" type="button" :disabled="saving" @click="cancel">退出登录</button>
  </view>
</template>

<style scoped>
.yx-onboarding { padding-top: 24rpx; }
.yx-onboarding .yx-eyebrow { margin-top: 48rpx; }
.yx-setup-progress { display: flex; gap: 12rpx; margin-top: 32rpx; }
.yx-setup-progress__item { display: flex; flex: 1; align-items: center; gap: 10rpx; min-width: 0; padding: 14rpx; border: 1rpx solid var(--yx-border); border-radius: 14rpx; color: var(--yx-text-tertiary); background: var(--yx-brand-soft); font-size: 23rpx; font-weight: 600; }
.yx-setup-progress__item.active, .yx-setup-progress__item.done { border-color: var(--yx-brand); color: var(--yx-brand); background: var(--yx-brand-soft); }
.yx-setup-progress__number { display: flex; width: 34rpx; height: 34rpx; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; color: var(--yx-text-secondary); background: var(--yx-surface-page); font-size: 21rpx; }
.yx-setup-progress__item.active .yx-setup-progress__number, .yx-setup-progress__item.done .yx-setup-progress__number { color:var(--yx-on-brand); background: var(--yx-action); }
.yx-onboarding-card { padding: 32rpx; }
.yx-onboarding-step { display: flex; flex-direction: column; }
.section-kicker { color: var(--yx-brand); font-size: 22rpx; font-weight: 700; letter-spacing: 2rpx; }
.section-title { display: block; margin-top: 16rpx; color: var(--yx-text-primary); font-size: 38rpx; font-weight: 700; line-height: 1.3; }
.section-description { display: block; margin-top: 14rpx; color: var(--yx-text-secondary); font-size: 25rpx; line-height: 1.65; }
.field-title { display: block; margin: 30rpx 0 16rpx; color: var(--yx-text-primary); font-size: 25rpx; font-weight: 700; }
.birth-year { display: grid; gap: 12rpx; margin-top: 30rpx; color: var(--yx-text-primary); font-size: 25rpx; font-weight: 700; }
.birth-year input { box-sizing: border-box; width: 100%; height: 80rpx; padding: 0 18rpx; border: 1rpx solid var(--yx-border); border-radius: 12rpx; color: var(--yx-text-primary); background: var(--yx-surface-page); font-size: 28rpx; }
.consent { display: flex; align-items: center; gap: 10rpx; margin-top: 22rpx; color: var(--yx-text-secondary); font-size: 25rpx; line-height: 1.5; }
.flow-note { display: block; margin-top: 24rpx; color: var(--yx-text-tertiary); font-size: 22rpx; line-height: 1.6; }
.choice-list { display: grid; gap: 14rpx; }
.choice { display: grid; gap: 6rpx; width: 100%; margin: 0; padding: 18rpx 20rpx; border: 1rpx solid var(--yx-border); border-radius: 14rpx; color: var(--yx-text-primary); background: var(--yx-surface-card); font-size: 26rpx; text-align: left; }
.choice.selected { border-color: var(--yx-brand); color: var(--yx-brand); background: var(--yx-brand-soft); }
.choice-description { color: var(--yx-text-secondary); font-size: 22rpx; line-height: 1.5; }
.choice-list--quota { display: flex; flex-wrap: wrap; gap: 12rpx; }
.quota-choice { display: block; width: auto; padding: 16rpx 22rpx; }
.error { display: block; margin-top: 20rpx; color: var(--yx-danger); font-size: 22rpx; line-height: 1.6; }
.onboarding-actions { display: grid; gap: 12rpx; margin-top: 30rpx; }
.onboarding-actions .yx-button { margin-top: 0; }
.yx-flow-cancel { display: block; margin: 20rpx auto 0; border: 0; color: var(--yx-text-tertiary); background: transparent; font-size: 23rpx; }
@media (min-width: 700px) { .yx-onboarding { max-width: 760rpx; margin: 0 auto; } }
</style>
