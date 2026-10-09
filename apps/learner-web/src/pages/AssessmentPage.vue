<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLearnerContentStore } from '../stores/learner-content'
import { useSessionStore } from '../stores/session'
import { userFacingError } from '../platform/user-facing-error'

const router = useRouter()
const store = useLearnerContentStore()
const session = useSessionStore()
const isRestricted = computed(() => session.adultGate === 'REJECTED')
async function logout(): Promise<void> { await session.logout(); await router.replace({ name: 'login' }) }
const selected = ref('')
const startedAt = ref(Date.now())
const question = computed(() => store.assessment.currentQuestion)
const report = computed(() => store.assessment.report)
const baseline = computed(() => store.assessment.skipBaseline)
const isDone = computed(() => store.assessment.status === 'completed')
const totalSteps = computed(() => question.value?.totalSteps ?? (report.value ? Math.max(1, store.assessmentProgress) : 10))
const progressLabel = computed(() => isRestricted.value ? '访问受限' : question.value ? `${store.assessmentProgress}/${totalSteps.value}` : isDone.value ? '已完成' : `${store.assessmentProgress}/${totalSteps.value}`)
const isLoading = computed(() => store.assessmentStatus === 'loading' || store.assessment.status === 'submitting')
const hasError = computed(() => ['offline', 'forbidden', 'content-unavailable', 'error'].includes(store.assessmentStatus) && !question.value)
onMounted(() => { store.restore(); void store.loadAssessment(); startedAt.value = Date.now() })
async function submit(): Promise<void> { if (!selected.value) return; const answer = selected.value; selected.value = ''; await store.submitAnswer(answer, (Date.now() - startedAt.value) / 1000); startedAt.value = Date.now() }
async function fastTrack(level: 'ZERO_A1' | 'CET4_B1' | 'CET6_B2' | 'POSTGRAD_B2_PLUS'): Promise<void> { await store.applyFastTrack(level) }
async function restart(): Promise<void> { selected.value = ''; startedAt.value = Date.now(); await store.restartAssessment() }
function retry(): void { void store.loadAssessment() }
</script>
<template>
  <section class="page-stack" aria-labelledby="assessment-title"><ExperienceHeader page="Assessment" icon="target" title-id="assessment-title" hero><span class="assessment-progress-label">{{ progressLabel }}</span></ExperienceHeader>
  <article v-if="isRestricted" class="result-card restricted-card" role="alert"><p class="card-kicker">测评访问受限</p><h3>暂未开放测评</h3><p>当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。</p><div class="result-actions"><RouterLink class="button button--secondary" to="/settings">前往账号设置</RouterLink><RouterLink class="button button--ghost" to="/support">帮助与反馈</RouterLink><button class="button button--ghost" type="button" @click="logout">退出登录</button></div></article>
  <article v-else-if="isDone && baseline" class="result-card"><p class="card-kicker">已跳过测评</p><h3>水平尚未验证</h3><p v-if="baseline.requestedStartingLevel">你选择了 {{ baseline.requestedStartingLevel }} 作为起点；这不是测评等级。</p><div class="result-actions"><button class="button button--primary" type="button" @click="router.push({ name: 'today' })">查看今日状态</button><button class="button button--secondary" type="button" @click="restart">参加测评</button></div></article>
  <article v-else-if="isDone && report" class="result-card"><p class="card-kicker">历史两题练习结果</p><h3>{{ report.cefrLevel }} · {{ Math.round(report.score) }} 分</h3><p>这是旧版练习参考，不能代替四维定级。</p><div class="result-actions"><button class="button button--primary" type="button" @click="router.push({ name: 'today' })">查看今日状态</button><button class="button button--secondary" type="button" @click="restart">重新开始</button></div></article>
  <article v-else-if="question" class="question-card"><div class="question-meta"><span>{{ question.helperText }}</span><span>{{ question.stepIndex }}/{{ question.totalSteps }}</span></div><h3>{{ question.stemText }}</h3><div class="options"><button v-for="option in question.options" :key="option.key" class="option" :class="{ selected: selected === option.key }" type="button" @click="selected = option.key"><b>{{ option.key }}</b><span>{{ option.text }}</span></button></div><p v-if="store.assessment.status === 'error'" class="error-text" role="alert">答案状态尚未确认，请重新读取后继续。</p><button v-if="store.assessment.status === 'error'" class="button button--primary" type="button" @click="retry">重新读取</button><button v-else class="button button--primary" type="button" :disabled="!selected || store.assessment.status === 'submitting'" @click="submit">{{ store.assessment.status === 'submitting' ? '正在记录…' : '提交答案' }}</button></article>
  <article v-else-if="isLoading" class="info-card" role="status"><h3>正在准备测评</h3><p>请稍候。</p></article>
  <article v-else-if="hasError" class="info-card" role="alert"><h3>测评暂时不可用</h3><p>{{ userFacingError(store.lastError, '暂时无法读取测评，请稍后重试。') }}</p><button class="button button--primary" type="button" @click="retry">重试</button></article>
  <article v-else class="info-card"><h3>暂无可用测评</h3><p>目前没有可用题目，可以稍后重试。</p><button class="button button--primary" type="button" @click="retry">重新读取</button></article>
  <details v-if="!isDone && !isRestricted && !(question && store.assessment.status === 'error')" class="fast-track"><summary>跳过测评，选择起点</summary><p>自选起点不会生成测评等级。</p><div class="tag-list"><button class="tag" type="button" :disabled="isLoading" @click="fastTrack('ZERO_A1')">从 A1 开始</button><button class="tag" type="button" :disabled="isLoading" @click="fastTrack('CET4_B1')">从 B1 开始</button><button class="tag" type="button" :disabled="isLoading" @click="fastTrack('CET6_B2')">从 B2 开始</button></div></details></section>
</template>
<style scoped>.question-card,.result-card{padding:32px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.question-meta{display:flex;justify-content:space-between;color:var(--yx-color-brand-primary);font-size:13px;font-weight:700}.question-card h3,.result-card h3{margin:26px 0;font-size:clamp(22px,4vw,32px);line-height:1.4}.options{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}.option{display:flex;gap:12px;padding:18px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card);text-align:left}.option b{color:var(--yx-color-brand-primary)}.option.selected{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.result-grid{display:flex;gap:12px;margin:24px 0}.result-grid span{display:grid;gap:5px;min-width:120px;padding:14px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.result-grid strong{color:var(--yx-color-brand-primary);font-size:22px}.result-grid small{color:var(--yx-color-text-secondary)}.fast-track{padding:18px 20px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card)}.fast-track summary{cursor:pointer;color:var(--yx-color-text-secondary)}.tag-list{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.tag{padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card)}.error-text{color:var(--yx-color-danger)}@media(max-width:640px){.options{grid-template-columns:1fr}.question-card,.result-card{padding:22px}.result-grid{flex-wrap:wrap}}
</style>
