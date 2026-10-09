<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dailyQuotaOptions, subTags, targetGoals, type DailyQuotaMinutes, type SubTag, type TargetGoal } from '../domain/b1'
import { useLearnerContentStore } from '../stores/learner-content'
import { useSessionStore } from '../stores/session'
import { userFacingError } from '../platform/user-facing-error'

const router = useRouter()
const store = useLearnerContentStore()
const session = useSessionStore()
const step = ref<1 | 2>(1)
const birthYear = ref<number | null>(null)
const ageConfirmed = ref(false)
const privacyConsent = ref(false)
const termsConsent = ref(false)
const targetGoal = ref<TargetGoal | null>(null)
const selectedTags = ref<SubTag[]>([])
const quota = ref<DailyQuotaMinutes>(15)
const saving = ref(false)

const goalOptions = computed(() => store.onboardingOptions.length ? store.onboardingOptions : targetGoals)
const quotaOptions = computed(() => store.onboardingQuotas.length ? store.onboardingQuotas : dailyQuotaOptions)
const adultBirthYearValid = computed(() => typeof birthYear.value === 'number' && Number.isInteger(birthYear.value) && birthYear.value >= 1900 && birthYear.value <= new Date().getFullYear() - 18)
const canContinue = computed(() => {
  if (session.adultGate === 'REJECTED') return false
  return step.value === 1
    ? adultBirthYearValid.value && ageConfirmed.value && privacyConsent.value && termsConsent.value
    : Boolean(targetGoal.value && quota.value)
})
const stepLabel = computed(() => session.adultGate === 'REJECTED' ? '访问受限' : step.value === 1 ? '确认身份与同意事项' : '选择学习目标')

onMounted(async () => {
  store.restore()
  await store.loadOnboarding()
  targetGoal.value = store.onboarding.targetGoal
  quota.value = store.onboarding.dailyQuotaMinutes ?? 15
  selectedTags.value = [...store.onboarding.subTags]
})

function toggleTag(tag: SubTag): void {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((item) => item !== tag)
    : selectedTags.value.length < 3 ? [...selectedTags.value, tag] : selectedTags.value
}

function nextPath(): string | { name: 'assessment' } {
  const returnTo = session.consumeReturnTo()
  return returnTo === '/home' || returnTo === '/onboarding' || returnTo === '/adult-gate'
    ? { name: 'assessment' }
    : returnTo
}

async function next(): Promise<void> {
  if (!canContinue.value || saving.value) return

  if (step.value === 1) {
    saving.value = true
    try {
      // The server decision remains authoritative; this screen only keeps the
      // three explicit user acknowledgements together in one first-run step.
      if (session.adultGate !== 'PASSED' && !(await session.confirmAdultGate(Number(birthYear.value)))) return
      // Learner reads before consent can legitimately return 403. Do not carry
      // that stale read error into the goal step after the adult gate succeeds.
      store.lastError = null
      store.setConsent({ birthYear: Number(birthYear.value), ageConfirmed: true, privacyConsent: true, termsConsent: true })
      step.value = 2
    } finally {
      saving.value = false
    }
    return
  }

  store.setPreferences(targetGoal.value as TargetGoal, selectedTags.value, quota.value)
  saving.value = true
  try {
    if (await store.saveOnboarding()) await router.replace(nextPath())
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
        <p class="eyebrow">FIRST DAY · {{ step }}/2</p>
        <h1 id="onboarding-title">欢迎来到语学星</h1>
        <p class="lead">先确认身份，再选择学习目标。</p>

        <ol class="setup-progress" aria-label="首次设置进度">
          <li :class="{ 'setup-progress__item--active': step === 1, 'setup-progress__item--done': step === 2 }" :aria-current="step === 1 ? 'step' : undefined">
            <span class="setup-progress__number">1</span>
            <span>确认身份</span>
          </li>
          <li :class="{ 'setup-progress__item--active': step === 2 }" :aria-current="step === 2 ? 'step' : undefined">
            <span class="setup-progress__number">2</span>
            <span>选择目标</span>
          </li>
        </ol>
      </header>

      <Transition name="setup-step" mode="out-in">
        <div v-if="session.adultGate === 'REJECTED'" key="rejected" class="setup-card" role="alert">
          <p class="setup-card__kicker">访问受限</p>
          <h2>暂未开放学习</h2>
          <p class="setup-card__description">当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。</p>
          <p class="policy-note">根据平台合规要求，Phase 1 仅面向 18 周岁以上成年人开放。你可以访问账号设置、隐私与客服支持功能。</p>
          <div class="setup-actions">
            <RouterLink class="button button--secondary" to="/settings">前往账号设置</RouterLink>
            <RouterLink class="button button--ghost" to="/support">帮助与反馈</RouterLink>
          </div>
        </div>

        <form v-else-if="step === 1" key="identity" class="setup-card" @submit.prevent="next">
          <p class="setup-card__kicker">{{ stepLabel }}</p>
          <h2>确认成人身份</h2>
          <p class="setup-card__description">仅限已满 18 岁的学习者。</p>

          <label class="field-label" for="adult-birth-year">
            出生年份
            <input id="adult-birth-year" v-model.number="birthYear" type="number" min="1900" :max="new Date().getFullYear() - 18" autocomplete="bday-year" required />
          </label>
          <div class="consent-list">
            <label class="check"><input v-model="ageConfirmed" type="checkbox" required /> <span>我确认自己已满 18 周岁</span></label>
            <label class="check"><input v-model="privacyConsent" type="checkbox" required /> <span>我同意隐私说明</span></label>
            <label class="check"><input v-model="termsConsent" type="checkbox" required /> <span>我同意学习服务条款</span></label>
          </div>
          <p v-if="session.lastError" class="setup-error" role="alert">{{ userFacingError(session.lastError, '身份确认未完成，请重试。') }}</p>
          <div class="setup-actions">
            <button class="button button--primary" type="submit" :disabled="saving || !canContinue">{{ saving ? '正在确认…' : '继续' }}</button>
          </div>
        </form>

        <form v-else key="plan" class="setup-card" @submit.prevent="next">
          <p class="setup-card__kicker">{{ stepLabel }}</p>
          <h2>你想先解决什么？</h2>
          <p class="setup-card__description">选一个最重要的方向，我们会据此准备首日测评和学习任务。</p>

          <fieldset class="setup-fieldset">
            <legend>学习目标</legend>
            <div class="choice-grid">
              <button v-for="goal in goalOptions" :key="goal.value" class="choice" :class="{ selected: targetGoal === goal.value }" type="button" :aria-pressed="targetGoal === goal.value" @click="targetGoal = goal.value">
                <strong>{{ goal.label }}</strong>
                <span>{{ goal.description }}</span>
              </button>
            </div>
          </fieldset>

          <fieldset class="setup-fieldset">
            <legend>可选重点 <small>最多 3 个</small></legend>
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

          <p class="policy-note">目标不需要一次选对，以后可以随时调整。</p>
          <p v-if="store.lastError" class="setup-error" role="alert">{{ store.lastError }}</p>
          <div class="setup-actions">
            <button class="button button--ghost" type="button" :disabled="saving" @click="step = 1">上一步</button>
            <button class="button button--primary" type="submit" :disabled="saving || !canContinue || store.onboardingStatus === 'loading'">{{ saving ? '正在保存…' : '保存并开始测评' }}</button>
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
