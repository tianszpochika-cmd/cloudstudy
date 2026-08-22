<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dailyQuotaOptions, subTags, targetGoals, type DailyQuotaMinutes, type SubTag, type TargetGoal } from '../domain/b1'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const step = ref(1)
const birthYear = ref(1990)
const ageConfirmed = ref(false)
const privacyConsent = ref(false)
const termsConsent = ref(false)
const targetGoal = ref<TargetGoal | null>(null)
const selectedTags = ref<SubTag[]>([])
const quota = ref<DailyQuotaMinutes>(15)
const goalOptions = computed(() => store.onboardingOptions.length ? store.onboardingOptions : targetGoals)
const quotaOptions = computed(() => store.onboardingQuotas.length ? store.onboardingQuotas : dailyQuotaOptions)
const canContinue = computed(() => step.value === 1 ? ageConfirmed.value && privacyConsent.value && termsConsent.value : Boolean(targetGoal.value && quota.value))

onMounted(() => { store.restore(); targetGoal.value = store.onboarding.targetGoal; quota.value = store.onboarding.dailyQuotaMinutes ?? 15; selectedTags.value = [...store.onboarding.subTags]; void store.loadOnboarding() })
function toggleTag(tag: SubTag): void { selectedTags.value = selectedTags.value.includes(tag) ? selectedTags.value.filter((item) => item !== tag) : selectedTags.value.length < 3 ? [...selectedTags.value, tag] : selectedTags.value }
function next(): void {
  if (!canContinue.value) return
  if (step.value === 1) { store.setConsent({ birthYear: birthYear.value, ageConfirmed: true, privacyConsent: true, termsConsent: true }); step.value = 2; return }
  store.setPreferences(targetGoal.value as TargetGoal, selectedTags.value, quota.value)
  void store.saveOnboarding().then(() => router.push({ name: 'assessment' }))
}
</script>

<template>
  <section class="page-stack onboarding" aria-labelledby="onboarding-title">
    <div class="hero-panel"><div><p class="eyebrow">B9 · LEARNER PROFILE · {{ step }}/2</p><h2 id="onboarding-title">先定一个适合你的学习起点。</h2><p>目标、偏好和首日投影由 learner-service 管理；UI locale 与 contentLocale 不混用。</p></div><div class="hero-panel__orb" aria-hidden="true">✦</div></div>
    <article class="form-card" v-if="step === 1"><p class="card-kicker">成人学习确认</p><h3>欢迎来到语学星</h3><p class="muted">B9 只允许服务端成人 Gate 通过后的学习主体继续。</p><label class="field-label">出生年份<input v-model.number="birthYear" type="number" min="1900" :max="new Date().getFullYear() - 18" /></label><label class="check"><input v-model="ageConfirmed" type="checkbox" />我确认自己已满 18 周岁</label><label class="check"><input v-model="privacyConsent" type="checkbox" />我同意隐私说明</label><label class="check"><input v-model="termsConsent" type="checkbox" />我同意学习服务条款</label></article>
    <article class="form-card" v-else><p class="card-kicker">学习目标</p><h3>你想先解决什么？</h3><div class="choice-grid"><button v-for="goal in goalOptions" :key="goal.value" class="choice" :class="{ selected: targetGoal === goal.value }" type="button" @click="targetGoal = goal.value"><strong>{{ goal.label }}</strong><span>{{ goal.description }}</span></button></div><p class="card-kicker">可选重点（最多 3 个）</p><div class="tag-list"><button v-for="tag in subTags" :key="tag.value" class="tag" :class="{ selected: selectedTags.includes(tag.value) }" type="button" @click="toggleTag(tag.value)">{{ tag.label }}</button></div><p class="card-kicker">每天愿意投入多久？</p><div class="quota-list"><button v-for="item in quotaOptions" :key="item" class="quota" :class="{ selected: quota === item }" type="button" @click="quota = item">{{ item }} 分钟</button></div><p class="locale-note">UI：zh-CN · 内容：en-US</p></article>
    <div class="actions"><button v-if="step === 2" class="button button--ghost" type="button" @click="step = 1">上一步</button><button class="button button--primary" type="button" :disabled="!canContinue || store.onboardingStatus === 'loading'" @click="next">{{ step === 1 ? '继续设置目标' : '保存并开始测评' }}</button></div><p v-if="store.lastError" class="error-text" role="alert">{{ store.lastError }}</p>
  </section>
</template>

<style scoped>
.form-card{padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.form-card h3{margin:8px 0;font-size:24px}.muted,.locale-note{color:var(--yx-color-text-secondary)}.field-label{display:grid;gap:8px;margin:24px 0;color:var(--yx-color-text-secondary);font-weight:600}.field-label input{width:160px;padding:12px;border:1px solid var(--yx-color-border);border-radius:10px}.check{display:block;margin:16px 0;color:var(--yx-color-text-secondary)}.check input{margin-right:10px}.choice-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:18px 0 28px}.choice,.tag,.quota{border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:#fff;text-align:left}.choice{display:grid;gap:6px;padding:16px}.choice span{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.tag-list,.quota-list{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 26px}.tag,.quota{padding:10px 14px}.selected{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.actions{display:flex;justify-content:flex-end;gap:12px}.button:disabled{cursor:not-allowed;opacity:.45}.error-text{color:var(--yx-color-danger)}@media(max-width:640px){.choice-grid{grid-template-columns:1fr}.form-card{padding:20px}.actions{display:grid}}
</style>
