<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '../api/client'
import { dailyQuotaOptions, subTags, targetGoals, type DailyQuotaMinutes, type SubTag } from '../domain/b1'
import { emptyConsentChoices, readPublishedConsentVersion, requiredConsentItems } from '../domain/onboarding-consent-copy'
import { canonicalGoalOptions, mapUiGoal, onboardingProgressLabel, prefillSavedTarget, selectOnboardingResumeStep, type CanonicalTargetGoal, type OnboardingResumeStep } from '../domain/onboarding-resume'
import { useLearnerContentStore } from '../stores/learner-content'
import { useSessionStore } from '../stores/session'
import type { AdultGateStatus } from '../auth/gateway-auth'
import { userFacingError } from '../platform/user-facing-error'

const router = useRouter()
const store = useLearnerContentStore()
const session = useSessionStore()
const step = ref<OnboardingResumeStep>('gate')
const birthYear = ref<number | null>(null)
const ageConfirmed = ref(false)
const consentChecked = reactive(emptyConsentChoices())
const publishedConsentVersion = ref<string | null>(null)
const targetGoal = ref<CanonicalTargetGoal | null>(null)
const selectedTags = ref<SubTag[]>([])
const quota = ref<DailyQuotaMinutes>(15)
const saving = ref(false)
const savedGoal = ref<CanonicalTargetGoal | null>(null)
const savedQuota = ref<number | null>(null)
const resumeError = ref<string | null>(null)

const goalOptions = computed(() => canonicalGoalOptions(store.onboardingOptions.length ? store.onboardingOptions : targetGoals))
const quotaOptions = computed(() => store.onboardingQuotas.length ? store.onboardingQuotas : dailyQuotaOptions)
const adultBirthYearValid = computed(() => typeof birthYear.value === 'number' && Number.isInteger(birthYear.value) && birthYear.value >= 1900 && birthYear.value <= new Date().getFullYear() - 18)
const targetDirty = computed(() => Boolean(savedGoal.value) && (targetGoal.value !== savedGoal.value || quota.value !== savedQuota.value))
const requiredConsentsChecked = computed(() => requiredConsentItems.every((item) => consentChecked[item.purpose]))
const canContinue = computed(() => {
  if (step.value === 'gate') return adultBirthYearValid.value && ageConfirmed.value
  if (step.value === 'consent') return requiredConsentsChecked.value && Boolean(publishedConsentVersion.value)
  if (step.value === 'assessment') return true
  return Boolean(targetGoal.value && quota.value)
})
let consentVersionRequest = 0

function clearConsentChoices(): void {
  consentVersionRequest += 1
  for (const item of requiredConsentItems) consentChecked[item.purpose] = false
  publishedConsentVersion.value = null
}

async function loadPublishedConsentVersion(): Promise<void> {
  const request = ++consentVersionRequest
  publishedConsentVersion.value = null
  try {
    const raw = await apiClient.request<unknown>('/iam/principal/me')
    if (request !== consentVersionRequest || step.value !== 'consent') return
    publishedConsentVersion.value = readPublishedConsentVersion(raw)
  } catch {
    if (request !== consentVersionRequest || step.value !== 'consent') return
    publishedConsentVersion.value = null
  }
}
const stepLabel = computed(() => step.value === 'gate' ? '确认成人身份' : step.value === 'consent' ? '必要同意' : step.value === 'assessment' ? '目标已保存' : '选择学习目标')
const progressLabel = computed(() => store.onboardingResume ? onboardingProgressLabel(store.onboardingResume) : '正在读取已保存进度')
const stepRank = computed(() => step.value === 'gate' ? 0 : step.value === 'consent' ? 1 : step.value === 'goal' ? 2 : 3)
const primaryLabel = computed(() => {
  if (saving.value && step.value !== 'assessment') return step.value === 'goal' ? '正在保存…' : '正在确认…'
  if (step.value === 'assessment') return '开始定级'
  if (step.value === 'goal') return '保存并开始测评'
  return '继续'
})
const targetUnreadable = computed(() => step.value === 'goal' && store.onboardingResume?.target.readable === false)

onMounted(() => { void loadResume() })

async function leaveRejected(): Promise<void> {
  await router.replace({ name: 'forbidden' })
}

function readAdultGate(): AdultGateStatus {
  return session.adultGate
}

async function loadResume(): Promise<void> {
  if (session.adultGate === 'REJECTED') { await leaveRejected(); return }
  resumeError.value = null
  birthYear.value = null
  ageConfirmed.value = false
  clearConsentChoices()
  selectedTags.value = []
  savedGoal.value = null
  savedQuota.value = null
  try {
    const facts = await store.loadOnboardingResume(true)
    if (readAdultGate() === 'REJECTED' || selectOnboardingResumeStep(facts) === 'rejected') { await leaveRejected(); return }
    step.value = selectOnboardingResumeStep(facts)
    const filled = prefillSavedTarget(facts.target)
    if (filled.goal && filled.quota) {
      savedGoal.value = filled.goal
      savedQuota.value = filled.quota
      targetGoal.value = filled.goal
      quota.value = filled.quota
    } else {
      targetGoal.value = null
      quota.value = 15
    }
    if (step.value === 'goal' || step.value === 'assessment') {
      try { await store.loadOnboarding() } catch { /* the local goal catalog remains usable */ }
    }
    if (step.value === 'consent') void loadPublishedConsentVersion()
  } catch (error) {
    resumeError.value = error instanceof Error ? error.message : '已保存进度暂时无法读取。'
    step.value = session.adultGate === 'PASSED' ? 'consent' : 'gate'
    if (step.value === 'consent') void loadPublishedConsentVersion()
  }
}

function toggleTag(tag: SubTag): void {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((item) => item !== tag)
    : selectedTags.value.length < 3 ? [...selectedTags.value, tag] : selectedTags.value
}

function back(): void {
  if (saving.value) return
  if (step.value === 'consent') step.value = 'gate'
  else if (step.value === 'goal') {
    step.value = 'consent'
    void loadPublishedConsentVersion()
  }
}

async function saveEdits(): Promise<void> {
  const wireGoal = mapUiGoal(targetGoal.value)
  if (!targetDirty.value || !wireGoal || !quota.value || saving.value) return
  saving.value = true
  try {
    if (await store.saveTarget(wireGoal, quota.value)) {
      savedGoal.value = targetGoal.value
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
    await router.replace({ name: 'assessment' })
    return
  }
  saving.value = true
  try {
    if (step.value === 'gate') {
      if (!(await session.confirmAdultGate(Number(birthYear.value)))) {
        if (session.adultGate === 'REJECTED') await leaveRejected()
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
    const wireGoal = mapUiGoal(targetGoal.value)
    if (!wireGoal || !quota.value) return
    if (await store.saveTarget(wireGoal, quota.value)) await router.replace({ name: 'assessment' })
  } finally {
    saving.value = false
  }
}

async function cancel(): Promise<void> {
  if (saving.value) return
  saving.value = true
  await session.logout()
  await router.replace({ name: 'login' })
  saving.value = false
}
</script>

<template>
  <main class="public-page public-page--setup">
    <section class="onboarding-flow" aria-labelledby="onboarding-title" :aria-busy="saving || store.onboardingStatus === 'loading'">
      <header class="onboarding-flow__header">
        <div class="brand">
          <AppIcon name="spark" :size="32" />
          <span>语学星</span>
        </div>
        <p class="eyebrow">按已保存进度继续</p>
        <h1 id="onboarding-title">欢迎来到语学星</h1>
        <p class="lead">{{ progressLabel }}</p>

        <ol class="setup-progress" aria-label="设置进度">
          <li :class="{ 'setup-progress__item--active': stepRank === 0, 'setup-progress__item--done': stepRank > 0 }" :aria-current="stepRank === 0 ? 'step' : undefined">
            <span class="setup-progress__number">1</span>
            <span>确认身份</span>
          </li>
          <li :class="{ 'setup-progress__item--active': stepRank === 1, 'setup-progress__item--done': stepRank > 1 }" :aria-current="stepRank === 1 ? 'step' : undefined">
            <span class="setup-progress__number">2</span>
            <span>必要同意</span>
          </li>
          <li :class="{ 'setup-progress__item--active': stepRank === 2, 'setup-progress__item--done': stepRank > 2 }" :aria-current="stepRank === 2 ? 'step' : undefined">
            <span class="setup-progress__number">3</span>
            <span>学习目标</span>
          </li>
        </ol>
      </header>

      <p v-if="session.adultGate === 'REJECTED'" class="policy-note" role="status">正在打开无权限页。</p>

      <Transition v-else name="setup-step" mode="out-in">
        <form v-if="step === 'gate'" key="gate" class="setup-card" @submit.prevent="next">
          <p class="setup-card__kicker">{{ stepLabel }}</p>
          <h2>确认成人身份</h2>
          <p class="setup-card__description">只收集出生年份，用来判断是否已满 18 岁。现有成人门不需要月和日，所以不收集完整生日。成人门还没通过时，停在这一步。</p>
          <p class="policy-note">如果没有通过，仍可前往账号设置、帮助与反馈或退出登录。这里不提供再试一次，也不提供改年份。</p>
          <label class="field-label" for="adult-birth-year">
            出生年份
            <input id="adult-birth-year" v-model.number="birthYear" type="number" min="1900" :max="new Date().getFullYear() - 18" autocomplete="bday-year" required />
          </label>
          <div class="consent-list">
            <label class="check"><input v-model="ageConfirmed" type="checkbox" required /> <span>我确认自己已满 18 周岁</span></label>
          </div>
          <p class="policy-note">本页还没提交的内容只留在这一页，离开后不会保留。</p>
          <p v-if="resumeError" class="setup-error" role="alert">{{ resumeError }}</p>
          <p v-if="session.lastError" class="setup-error" role="alert">{{ userFacingError(session.lastError, '身份确认未完成，请重试。本页还没提交的内容，离开后不会保留。') }}</p>
          <div class="setup-actions">
            <button class="button button--primary" type="submit" :disabled="saving || !canContinue">{{ primaryLabel }}</button>
          </div>
        </form>

        <form v-else-if="step === 'consent'" key="consent" class="setup-card" @submit.prevent="next">
          <p class="setup-card__kicker">{{ stepLabel }}</p>
          <h2>完成必要同意</h2>
          <p class="setup-card__description">账号条款、隐私说明和成人学习资格要逐项看见。开始时不勾选，也不默认全选。</p>
          <div class="consent-list">
            <label v-for="item in requiredConsentItems" :key="item.purpose" class="check">
              <input v-model="consentChecked[item.purpose]" type="checkbox" />
              <span class="consent-copy">
                <strong>{{ item.label }}</strong>
                <small>用途码 {{ item.purpose }}</small>
                <small>必要</small>
                <small>已发布版本 {{ publishedConsentVersion || '版本未读到' }}</small>
              </span>
            </label>
          </div>
          <p v-if="!requiredConsentsChecked" class="policy-note">未勾选时，受影响的是学习资格，不是把账号设置、帮助与反馈和退出登录一起禁掉。</p>
          <p v-if="!publishedConsentVersion" class="policy-note">版本未读到。已发布版本暂时读不到，这一步先不提交同意。</p>
          <p class="policy-note">本页还没提交的内容只留在这一页，离开后不会保留。</p>
          <p v-if="resumeError" class="setup-error" role="alert">{{ resumeError }}</p>
          <p v-if="store.lastError" class="setup-error" role="alert">{{ userFacingError(store.lastError, '必要同意尚未保存。本页还没提交的内容，离开后不会保留。') }}</p>
          <div class="setup-actions">
            <button class="button button--ghost" type="button" :disabled="saving" @click="back">上一步</button>
            <button class="button button--primary" type="submit" :disabled="saving || !canContinue">{{ primaryLabel }}</button>
          </div>
        </form>

        <form v-else key="goal" class="setup-card" @submit.prevent="next">
          <p class="setup-card__kicker">{{ stepLabel }}</p>
          <h2>{{ step === 'assessment' ? '目标已保存' : '你想先解决什么？' }}</h2>
          <p class="setup-card__description">{{ step === 'assessment' ? '已保存的目标仍在服务端。没有改目标的话，直接开始定级，不必重填。' : '选一个目标并保存后，进入现有定级入口。' }}</p>
          <p v-if="targetUnreadable" class="policy-note" role="status">学习目标暂时无法读取。本页不会把读失败当成没有目标。</p>

          <fieldset class="setup-fieldset">
            <legend>学习目标</legend>
            <div class="choice-grid">
              <button v-for="goal in goalOptions" :key="goal.value" class="choice" :class="{ selected: targetGoal === goal.value }" type="button" :aria-pressed="targetGoal === goal.value" :data-goal-code="goal.value" @click="targetGoal = goal.value">
                <strong>{{ goal.label }}</strong>
                <span>{{ goal.description }}</span>
              </button>
            </div>
          </fieldset>

          <fieldset class="setup-fieldset">
            <legend>可选重点 <small>可以稍后补</small></legend>
            <div class="tag-list">
              <button v-for="tag in subTags" :key="tag.value" class="tag" :class="{ selected: selectedTags.includes(tag.value) }" type="button" :aria-pressed="selectedTags.includes(tag.value)" @click="toggleTag(tag.value)">{{ tag.label }}</button>
            </div>
          </fieldset>

          <fieldset class="setup-fieldset">
            <legend>每天愿意投入多久？</legend>
            <div class="quota-list">
              <button v-for="item in quotaOptions" :key="item" class="quota" :class="{ selected: quota === item }" type="button" :aria-pressed="quota === item" @click="quota = item">{{ item }} 分钟</button>
            </div>
          </fieldset>

          <p class="policy-note">本页还没提交的内容只留在这一页，离开后不会保留。可选重点还不能单独保存，离开本页后不会保留。</p>
          <p v-if="store.lastError" class="setup-error" role="alert">{{ userFacingError(store.lastError, '学习目标尚未保存。本页还没提交的内容，离开后不会保留。') }}</p>
          <div class="setup-actions">
            <button v-if="step === 'goal'" class="button button--ghost" type="button" :disabled="saving" @click="back">上一步</button>
            <button v-if="targetDirty" class="button button--secondary" type="button" :disabled="saving || !targetGoal" @click="saveEdits">{{ saving ? '正在保存…' : '保存修改' }}</button>
            <button class="button button--primary" type="submit" :data-primary-action="step === 'assessment' ? 'assessment' : 'save-target'" :disabled="saving || !canContinue || store.onboardingStatus === 'loading'">{{ primaryLabel }}</button>
          </div>
        </form>
      </Transition>

      <button class="setup-cancel" type="button" :disabled="saving" @click="cancel">退出登录</button>
    </section>
  </main>
</template>

<style scoped>
.public-page--setup { align-items: start; padding: clamp(24px, 6vw, 72px) 24px; }
.onboarding-flow { width: min(760px, 100%); }
.onboarding-flow__header { padding: 8px 4px 28px; }
.onboarding-flow__header h1 { margin: 22px 0 10px; font-size: clamp(32px, 5vw, 48px); letter-spacing: -.04em; }
.onboarding-flow__header .lead { max-width: 620px; margin: 0; }
.setup-progress { display: flex; gap: 12px; margin: 28px 0 0; padding: 0; list-style: none; }
.setup-progress li { display: flex; flex: 1; align-items: center; gap: 10px; min-width: 0; padding: 12px 14px; border: 1px solid var(--yx-color-border); border-radius: 14px; color: var(--yx-color-text-tertiary); background: color-mix(in srgb,var(--yx-color-surface-card) 66%, transparent); font-size: 13px; font-weight: 600; }
.setup-progress li + li { opacity: .72; }
.setup-progress li.setup-progress__item--active, .setup-progress li.setup-progress__item--done { border-color: var(--yx-color-brand-primary); color: var(--yx-color-brand-primary); background: var(--yx-color-brand-primary-soft); opacity: 1; }
.setup-progress__number { display: inline-grid; width: 26px; height: 26px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: var(--yx-color-text-secondary); background: var(--yx-color-surface-page); font-size: 12px; }
.setup-progress__item--active .setup-progress__number, .setup-progress__item--done .setup-progress__number { color: var(--yx-color-on-brand); background: var(--yx-color-brand-primary); }
.setup-card { padding: clamp(24px, 5vw, 40px); border: 1px solid var(--yx-color-border); border-radius: 24px; background: var(--yx-color-surface-card); box-shadow: var(--yx-shadow-card); }
.setup-card__kicker { margin: 0; color: var(--yx-color-brand-primary); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.setup-card h2 { margin: 10px 0 8px; font-size: clamp(24px, 4vw, 32px); letter-spacing: -.03em; }
.setup-card__description { margin: 0; color: var(--yx-color-text-secondary); line-height: 1.7; }
.field-label { display: grid; gap: 9px; margin: 28px 0 20px; color: var(--yx-color-text-primary); font-size: 14px; font-weight: 700; }
.field-label input { width: min(220px, 100%); min-height: 46px; padding: 0 13px; border: 1px solid var(--yx-color-border); border-radius: 12px; color: var(--yx-color-text-primary); background: var(--yx-color-surface-page); font-size: 16px; }
.consent-list { display: grid; gap: 12px; }
.check { display: flex; align-items: flex-start; gap: 10px; color: var(--yx-color-text-secondary); line-height: 1.6; }
.check input { width: 17px; height: 17px; flex: 0 0 auto; margin-top: 3px; accent-color: var(--yx-color-brand-primary); }
.consent-copy { display: grid; gap: 2px; }
.consent-copy small { color: var(--yx-color-text-tertiary); font-size: 12px; font-weight: 600; }
.policy-note { margin: 20px 0 0; color: var(--yx-color-text-tertiary); font-size: 13px; line-height: 1.7; }
.setup-fieldset { min-width: 0; margin: 26px 0 0; padding: 0; border: 0; }
.setup-fieldset legend { margin-bottom: 12px; color: var(--yx-color-text-primary); font-size: 14px; font-weight: 700; }
.setup-fieldset legend small { color: var(--yx-color-text-tertiary); font-size: 12px; font-weight: 500; }
.choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.choice, .tag, .quota { border: 1px solid var(--yx-color-border); border-radius: 12px; color: var(--yx-color-text-primary); background: var(--yx-color-surface-card); text-align: left; transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease; }
.choice:hover, .tag:hover, .quota:hover { transform: translateY(-1px); border-color: var(--yx-color-brand-primary); }
.choice { display: grid; gap: 6px; min-height: 92px; padding: 16px; }
.choice span { color: var(--yx-color-text-secondary); font-size: 13px; line-height: 1.5; }
.tag-list, .quota-list { display: flex; flex-wrap: wrap; gap: 10px; }
.tag, .quota { padding: 10px 14px; }
.selected { border-color: var(--yx-color-brand-primary); color: var(--yx-color-brand-primary); background: var(--yx-color-brand-primary-soft); }
.setup-error { margin: 18px 0 0; color: var(--yx-color-danger); font-size: 14px; line-height: 1.6; }
.setup-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
.setup-actions .button--primary { min-width: 176px; }
.setup-cancel { display: block; margin: 18px auto 0; border: 0; color: var(--yx-color-text-tertiary); background: transparent; font-size: 13px; }
.setup-cancel:hover { color: var(--yx-color-danger); }
.setup-step-enter-active, .setup-step-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.setup-step-enter-from { opacity: 0; transform: translateX(12px); }
.setup-step-leave-to { opacity: 0; transform: translateX(-12px); }
@media (max-width: 640px) {
  .public-page--setup { padding: 16px; }
  .onboarding-flow__header { padding-top: 4px; }
  .setup-progress { gap: 8px; }
  .setup-progress li { padding: 10px; font-size: 12px; }
  .setup-progress__number { width: 23px; height: 23px; }
  .choice-grid { grid-template-columns: 1fr; }
  .setup-actions { display: grid; grid-template-columns: 1fr; }
  .setup-actions .button--primary { min-width: 0; }
  .setup-actions .button--ghost { order: 2; }
}
@media (prefers-reduced-motion: reduce) {
  .setup-step-enter-active, .setup-step-leave-active { transition-duration: .01ms; }
}
</style>
