<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dailyQuotaOptions, subTags, targetGoals, type DailyQuotaMinutes, type SubTag, type TargetGoal } from '../domain/b1'
import { useB1Store } from '../stores/b1'

const router = useRouter()
const b1 = useB1Store()
const step = ref(1)
const birthYear = ref(b1.onboarding.birthYear ?? 1990)
const ageConfirmed = ref(b1.onboarding.ageConfirmed)
const privacyConsent = ref(b1.onboarding.privacyConsent)
const termsConsent = ref(b1.onboarding.termsConsent)
const targetGoal = ref<TargetGoal | null>(b1.onboarding.targetGoal)
const selectedTags = ref<SubTag[]>([...b1.onboarding.subTags])
const quota = ref<DailyQuotaMinutes>(b1.onboarding.dailyQuotaMinutes ?? 15)
const canContinue = computed(() => step.value === 1 ? ageConfirmed.value && privacyConsent.value && termsConsent.value : Boolean(targetGoal.value))

function toggleTag(tag: SubTag): void { selectedTags.value = selectedTags.value.includes(tag) ? selectedTags.value.filter((item) => item !== tag) : selectedTags.value.length < 3 ? [...selectedTags.value, tag] : selectedTags.value }
function next(): void {
  if (!canContinue.value) return
  if (step.value === 1) { b1.setConsent({ birthYear: birthYear.value, ageConfirmed: true, privacyConsent: true, termsConsent: true }); step.value = 2; return }
  b1.setPreferences(targetGoal.value as TargetGoal, selectedTags.value, quota.value)
  void b1.commitOnboarding().then(() => router.push({ name: 'assessment' }))
}
</script>

<template>
  <section class="page-stack onboarding" aria-labelledby="onboarding-title">
    <div class="hero-panel"><div><p class="eyebrow">FIRST DAY · {{ step }}/2</p><h2 id="onboarding-title">先定一个适合你的学习起点。</h2><p>我们只收集完成学习闭环所需的信息，偏好可随时在设置中修改。</p></div><div class="hero-panel__orb" aria-hidden="true">✦</div></div>
    <article class="form-card" v-if="step === 1"><p class="card-kicker">成人学习确认</p><h3>欢迎来到语学星</h3><p class="muted">B1 首期面向 18 岁以上成人与大学生。</p><label class="field-label">出生年份<input v-model.number="birthYear" type="number" min="1900" :max="new Date().getFullYear() - 18" /></label><label class="check"><input v-model="ageConfirmed" type="checkbox" />我确认自己已满 18 周岁</label><label class="check"><input v-model="privacyConsent" type="checkbox" />我同意隐私说明</label><label class="check"><input v-model="termsConsent" type="checkbox" />我同意学习服务条款</label></article>
    <article class="form-card" v-else><p class="card-kicker">学习计划</p><h3>你想先解决什么？</h3><div class="choice-grid"><button v-for="goal in targetGoals" :key="goal.value" class="choice" :class="{ selected: targetGoal === goal.value }" type="button" @click="targetGoal = goal.value"><strong>{{ goal.label }}</strong><span>{{ goal.description }}</span></button></div><p class="card-kicker">可选重点（最多 3 个）</p><div class="tag-list"><button v-for="tag in subTags" :key="tag.value" class="tag" :class="{ selected: selectedTags.includes(tag.value) }" type="button" @click="toggleTag(tag.value)">{{ tag.label }}</button></div><p class="card-kicker">每天愿意投入多久？</p><div class="quota-list"><button v-for="item in dailyQuotaOptions" :key="item" class="quota" :class="{ selected: quota === item }" type="button" @click="quota = item">{{ item }} 分钟</button></div></article>
    <div class="actions"><button v-if="step === 2" class="button button--ghost" type="button" @click="step = 1">上一步</button><button class="button button--primary" type="button" :disabled="!canContinue" @click="next">{{ step === 1 ? '继续设置目标' : '保存并开始测评' }}</button></div><p v-if="b1.lastError" class="error-text" role="alert">{{ b1.lastError }}</p>
  </section>
</template>

<style scoped>
.form-card { padding: 28px; border: 1px solid var(--yx-color-border); border-radius: var(--yx-radius-card); background: var(--yx-color-surface-card); box-shadow: var(--yx-shadow-card); } .form-card h3 { margin: 8px 0; font-size: 24px; }.muted { color: var(--yx-color-text-secondary); }.field-label { display: grid; gap: 8px; margin: 24px 0; color: var(--yx-color-text-secondary); font-weight: 600; }.field-label input { width: 160px; padding: 12px; border: 1px solid var(--yx-color-border); border-radius: 10px; }.check { display: block; margin: 16px 0; color: var(--yx-color-text-secondary); }.check input { margin-right: 10px; }.choice-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 18px 0 28px; }.choice, .tag, .quota { border: 1px solid var(--yx-color-border); border-radius: 12px; color: var(--yx-color-text-primary); background: #fff; text-align: left; }.choice { display: grid; gap: 6px; padding: 16px; }.choice span { color: var(--yx-color-text-secondary); font-size: 13px; line-height: 1.5; }.tag-list, .quota-list { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 26px; }.tag, .quota { padding: 10px 14px; }.selected { border-color: var(--yx-color-brand-primary); color: var(--yx-color-brand-primary); background: var(--yx-color-brand-primary-soft); }.actions { display: flex; justify-content: flex-end; gap: 12px; }.button:disabled { cursor: not-allowed; opacity: .45; }.error-text { color: var(--yx-color-danger); }
@media (max-width: 640px) { .choice-grid { grid-template-columns: 1fr; } .form-card { padding: 20px; } .actions { display: grid; } }
</style>
