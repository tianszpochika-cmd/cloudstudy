<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, reactive, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { mobileApiClient } from '../../api/client'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { currentBirthYearMax, isSubmittableBirthYear } from '../../domain/adult-birth-year'
import { emptyConsentChoices, readPublishedConsentVersion, requiredConsentItems, type RequiredConsentPurpose } from '../../domain/onboarding-consent-copy'
import { canonicalGoalOptions, mapUiGoal, onboardingProgressLabel, prefillSavedTarget, selectOnboardingResumeStep, type OnboardingResumeStep } from '../../domain/onboarding-resume'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const store = useLearnerContentStore()
const session = useSessionStore()
const step = ref<OnboardingResumeStep>('gate')
const goal = ref<string | null>(null)
const quota = ref<number>(15)
const birthYear = ref<number | null>(null)
const ageConfirmed = ref(false)
const consentChecked = reactive(emptyConsentChoices())
const publishedConsentVersion = ref<string | null>(null)
const saving = ref(false)
const savedGoal = ref<string | null>(null)
const savedQuota = ref<number | null>(null)
const resumeError = ref<string | null>(null)
const adultError = ref<string | null>(null)
let loaded = false
let leftPage = true

watch(() => session.identityRevision, () => {
  loaded = false
  leftPage = true
  step.value = 'gate'
  goal.value = null
  quota.value = 15
  birthYear.value = null
  ageConfirmed.value = false
  clearConsentChoices()
  savedGoal.value = null
  savedQuota.value = null
  resumeError.value = null
  adultError.value = null
}, { flush: 'sync' })

const birthYearMax = currentBirthYearMax()
const adultBirthYearValid = computed(() => isSubmittableBirthYear(birthYear.value, birthYearMax))
const targetDirty = computed(() => Boolean(savedGoal.value) && (goal.value !== savedGoal.value || quota.value !== savedQuota.value))
const goalOptions = computed(() => canonicalGoalOptions(store.goals))
const requiredConsentsChecked = computed(() => requiredConsentItems.every((item) => consentChecked[item.purpose]))
const canContinue = computed(() => {
  if (step.value === 'gate') return adultBirthYearValid.value && ageConfirmed.value
  if (step.value === 'consent') return requiredConsentsChecked.value && Boolean(publishedConsentVersion.value)
  if (step.value === 'assessment') return true
  return Boolean(goal.value && quota.value)
})
let consentVersionRequest = 0

function clearConsentChoices(): void {
  consentVersionRequest += 1
  for (const item of requiredConsentItems) consentChecked[item.purpose] = false
  publishedConsentVersion.value = null
}

function toggleConsent(purpose: RequiredConsentPurpose): void {
  consentChecked[purpose] = !consentChecked[purpose]
}

async function loadPublishedConsentVersion(): Promise<void> {
  const request = ++consentVersionRequest
  publishedConsentVersion.value = null
  try {
    const raw = await mobileApiClient.request<unknown>('/iam/principal/me')
    if (request !== consentVersionRequest || step.value !== 'consent') return
    publishedConsentVersion.value = readPublishedConsentVersion(raw)
  } catch {
    if (request !== consentVersionRequest || step.value !== 'consent') return
    publishedConsentVersion.value = null
  }
}
const progressLabel = computed(() => store.onboardingResume ? onboardingProgressLabel(store.onboardingResume) : '正在读取已保存进度')
const stepRank = computed(() => step.value === 'gate' ? 0 : step.value === 'consent' ? 1 : step.value === 'goal' ? 2 : 3)
const primaryLabel = computed(() => {
  if (saving.value && step.value !== 'assessment') return step.value === 'goal' ? '正在保存…' : '正在确认…'
  if (step.value === 'assessment') return '开始定级'
  if (step.value === 'goal') return '保存并开始测评'
  return '继续'
})
const targetUnreadable = computed(() => step.value === 'goal' && store.onboardingResume?.target.readable === false)

function goLogin(url = '/pages/login/login'): void {
  const runtime = getUniRuntime()
  if (runtime.reLaunch) runtime.reLaunch({ url })
  else runtime.navigateTo({ url })
}

function leaveRejected(): void {
  openUniPage('/pages/forbidden/forbidden')
}

function clearUnsubmitted(): void {
  birthYear.value = null
  ageConfirmed.value = false
  clearConsentChoices()
  savedGoal.value = null
  savedQuota.value = null
  adultError.value = null
}

async function loadResume(): Promise<void> {
  if (session.adultGate === 'REJECTED') { leaveRejected(); return }
  resumeError.value = null
  clearUnsubmitted()
  const revision = session.identityRevision
  try {
    const facts = await store.loadOnboardingResume(true)
    if (revision !== session.identityRevision || !session.isAuthenticated) return
    if (session.adultGate === 'REJECTED' || selectOnboardingResumeStep(facts) === 'rejected') { leaveRejected(); return }
    step.value = selectOnboardingResumeStep(facts)
    const filled = prefillSavedTarget(facts.target)
    if (filled.goal && filled.quota) {
      savedGoal.value = filled.goal
      savedQuota.value = filled.quota
      goal.value = filled.goal
      quota.value = filled.quota
    } else {
      goal.value = null
      quota.value = 15
    }
    if ((step.value === 'goal' || step.value === 'assessment') && session.isLearningReady) {
      try { await store.loadOnboarding() } catch { /* local goal catalog remains usable */ }
    }
    if (step.value === 'consent') void loadPublishedConsentVersion()
  } catch (error) {
    resumeError.value = error instanceof Error ? error.message : '已保存进度暂时无法读取。'
    step.value = session.adultGate === 'PASSED' ? 'consent' : 'gate'
    if (step.value === 'consent') void loadPublishedConsentVersion()
  }
}

onHide(() => { leftPage = true })

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { goLogin('/pages/login/login?returnTo=%2Fpages%2Fonboarding%2Fonboarding'); return }
  if (session.adultGate === 'REJECTED') { leaveRejected(); return }
  if (loaded && !leftPage) return
  leftPage = false
  await loadResume()
  loaded = true
})

function back(): void {
  if (saving.value) return
  if (step.value === 'consent') step.value = 'gate'
  else if (step.value === 'goal') {
    step.value = 'consent'
    void loadPublishedConsentVersion()
  }
}

async function saveEdits(): Promise<void> {
  const wireGoal = mapUiGoal(goal.value)
  if (!targetDirty.value || !wireGoal || !quota.value || saving.value) return
  saving.value = true
  try {
    if (await store.saveTarget(wireGoal, quota.value)) {
      savedGoal.value = goal.value
      savedQuota.value = quota.value
      step.value = 'assessment'
    }
  } finally {
    saving.value = false
  }
}

async function next(): Promise<void> {
  if (!canContinue.value || saving.value) return
  if (step.value === 'assessment') {
    openUniPage('/pages/assessment/assessment')
    return
  }
  saving.value = true
  adultError.value = null
  try {
    if (step.value === 'gate') {
      if (!(await session.confirmAdultGate(Number(birthYear.value)))) {
        if (session.adultGate === 'REJECTED') leaveRejected()
        else adultError.value = session.lastError ?? '身份确认未完成，请重试。本页还没提交的内容，离开后不会保留。'
        return
      }
      store.lastError = null
      step.value = 'consent'
      void loadPublishedConsentVersion()
      return
    }
    if (step.value === 'consent') {
      if (await store.recordRequiredConsents()) step.value = 'goal'
      return
    }
    const wireGoal = mapUiGoal(goal.value)
    if (!wireGoal || !quota.value) return
    if (await store.saveTarget(wireGoal, quota.value)) openUniPage('/pages/assessment/assessment')
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

    <text class="section-kicker">按已保存进度继续</text>
    <text class="section-description">{{ progressLabel }}</text>

    <view class="yx-setup-progress" aria-label="设置进度">
      <view :class="['yx-setup-progress__item', { active: stepRank === 0, done: stepRank > 0 }]">
        <text class="yx-setup-progress__number">1</text>
        <text>确认身份</text>
      </view>
      <view :class="['yx-setup-progress__item', { active: stepRank === 1, done: stepRank > 1 }]">
        <text class="yx-setup-progress__number">2</text>
        <text>必要同意</text>
      </view>
      <view :class="['yx-setup-progress__item', { active: stepRank === 2, done: stepRank > 2 }]">
        <text class="yx-setup-progress__number">3</text>
        <text>学习目标</text>
      </view>
    </view>

    <view class="yx-card yx-onboarding-card">
      <text v-if="session.adultGate === 'REJECTED'" class="flow-note" role="status">正在打开无权限页。</text>

      <view v-else-if="step === 'gate'" class="yx-onboarding-step">
        <text class="section-kicker">确认成人身份</text>
        <text class="section-title">确认成人身份</text>
        <text class="section-description">只收集出生年份，用来判断是否已满 18 岁。现有成人门不需要月和日，所以不收集完整生日。成人门还没通过时，停在这一步。</text>
        <text class="flow-note">如果没有通过，仍可前往账号设置、帮助与反馈或退出登录。这里不提供再试一次，也不提供改年份。</text>
        <label class="birth-year"><text>出生年份</text><input v-model.number="birthYear" type="number" inputmode="numeric" min="1900" :max="birthYearMax" placeholder="例如 1995" aria-label="出生年份" /></label>
        <label class="consent"><checkbox :checked="ageConfirmed" @click="ageConfirmed = !ageConfirmed" /><text>我确认自己已满 18 周岁</text></label>
      </view>

      <view v-else-if="step === 'consent'" class="yx-onboarding-step">
        <text class="section-kicker">必要同意</text>
        <text class="section-title">完成必要同意</text>
        <text class="section-description">账号条款、隐私说明和成人学习资格要逐项看见。开始时不勾选，也不默认全选。</text>
        <label v-for="item in requiredConsentItems" :key="item.purpose" class="consent">
          <checkbox :checked="consentChecked[item.purpose]" @click="toggleConsent(item.purpose)" />
          <view class="consent-copy">
            <text>{{ item.label }}</text>
            <text>用途码 {{ item.purpose }}</text>
            <text>必要</text>
            <text>已发布版本 {{ publishedConsentVersion || '版本未读到' }}</text>
          </view>
        </label>
        <text v-if="!requiredConsentsChecked" class="flow-note">未勾选时，受影响的是学习资格，不是把账号设置、帮助与反馈和退出登录一起禁掉。</text>
        <text v-if="!publishedConsentVersion" class="flow-note">版本未读到。已发布版本暂时读不到，这一步先不提交同意。</text>
      </view>

      <view v-else class="yx-onboarding-step">
        <text class="section-kicker">{{ step === 'assessment' ? '目标已保存' : '选择学习目标' }}</text>
        <text class="section-title">{{ step === 'assessment' ? '目标已保存' : '你想先解决什么？' }}</text>
        <text class="section-description">{{ step === 'assessment' ? '已保存的目标仍在服务端。没有改目标的话，直接开始定级，不必重填。' : '选一个目标并保存后，进入现有定级入口。' }}</text>
        <text v-if="targetUnreadable" class="flow-note" role="status">学习目标暂时无法读取。本页不会把读失败当成没有目标。</text>
        <text class="field-title">学习目标</text>
        <view class="choice-list">
          <button tabindex="0" role="button" v-for="item in goalOptions" :key="item.value" :class="['choice', { selected: goal === item.value }]" type="button" :aria-pressed="goal === item.value" :data-goal-code="item.value" @click="goal = item.value"><text>{{ item.label }}</text><text class="choice-description">{{ item.description }}</text></button>
        </view>
        <text class="field-title">每天愿意投入多久？</text>
        <view class="choice-list choice-list--quota">
          <button tabindex="0" role="button" v-for="item in store.quotas" :key="item" :class="['choice', 'quota-choice', { selected: quota === item }]" type="button" :aria-pressed="quota === item" @click="quota = item">{{ item }} 分钟</button>
        </view>
      </view>

      <text class="flow-note">本页还没提交的内容只留在这一页，离开后不会保留。</text>
      <text v-if="adultError" class="error" role="alert">{{ adultError }}</text>
      <text v-if="resumeError" class="error" role="alert">{{ resumeError }}</text>
      <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
      <view v-if="session.adultGate !== 'REJECTED'" class="onboarding-actions">
        <button tabindex="0" role="button" v-if="step === 'consent' || step === 'goal'" class="yx-button yx-button--secondary" type="button" :disabled="saving" @click="back">上一步</button>
        <button tabindex="0" role="button" v-if="targetDirty" class="yx-button yx-button--secondary" type="button" :disabled="saving || !goal" @click="saveEdits">{{ saving ? '正在保存…' : '保存修改' }}</button>
        <button tabindex="0" role="button" class="yx-button" type="button" :data-primary-action="step === 'assessment' ? 'assessment' : step === 'goal' ? 'save-target' : 'continue'" :disabled="!canContinue || saving || store.onboardingStatus === 'loading'" @click="next">{{ primaryLabel }}</button>
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
.consent { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 22rpx; color: var(--yx-text-secondary); font-size: 25rpx; line-height: 1.5; }
.consent-copy { display: flex; flex-direction: column; gap: 4rpx; }
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
