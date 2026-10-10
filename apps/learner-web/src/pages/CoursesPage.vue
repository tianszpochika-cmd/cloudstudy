<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ExperienceHeader from '../components/ExperienceHeader.vue'
import StatePanel from '../components/StatePanel.vue'
import AppIcon from '../components/AppIcon.vue'
import { useLearnerContentStore } from '../stores/learner-content'
import { useExperienceText } from '../platform/experience-ui'
import { userFacingError } from '../platform/user-facing-error'
import { continueCheckpoint, isAccessibleContent, shelfSearchState } from '../domain/plan-today'
const router = useRouter()
const store = useLearnerContentStore()
const t = useExperienceText()
const query = ref('')
const kind = ref('')
const content = computed(() => (store.home?.content ?? []).filter((item) => isAccessibleContent(item)))
const contentStatus = computed(() => store.home?.contentStatus ?? 'EMPTY')
const kinds = computed(() => [...new Set(content.value.map(item => item.kind))])
const labels: Record<string, string> = { VOCAB: 'vocabulary', VOCABULARY: 'vocabulary', VOCAB_PACK: 'vocabulary', LISTENING: 'listening', READING: 'reading', SPEAKING: 'speaking', GRAMMAR: 'grammar', WRITING: 'writing' }
const kindLabel = (value: string) => labels[value] ? t(labels[value]) : t('availableContent')
const results = computed(() => content.value.filter(item => (!kind.value || item.kind === kind.value) && (item.title + ' ' + (item.description ?? '')).toLowerCase().includes(query.value.trim().toLowerCase())))
const shelfFailed = computed(() => Boolean(store.lastError) || contentStatus.value === 'UNAVAILABLE' || store.homeStatus === 'offline' || store.homeStatus === 'error')
const shelf = computed(() => shelfSearchState(content.value.length, results.value.length, shelfFailed.value))
const activeContinue = computed(() => continueCheckpoint(store.home?.continueContext ?? null))
onMounted(() => { store.restore(); void store.loadHome() })
function retry() { void store.retry('home') }
function openCourse(contentId: string) { void router.push({ name: 'learn-session', query: { contentId } }) }
function resumeActive(): void {
  const next = activeContinue.value
  if (!next) return
  void router.push({ name: 'learn-session', query: { contentId: next.contentId, step: next.step } })
}
</script>
<template>
  <section class="page-stack library-experience" aria-labelledby="courses-title">
    <ExperienceHeader page="Courses" title-id="courses-title" icon="book" />
    <div class="library-toolbar"><div class="filter-pills"><button type="button" :class="{ active: !kind }" :aria-pressed="!kind" @click="kind = ''">{{ t('all') }}</button><button v-for="value in kinds" :key="value" type="button" :class="{ active: kind === value }" :aria-pressed="kind === value" @click="kind = value">{{ kindLabel(value) }}</button></div><label class="search-field"><AppIcon name="search" :size="18" /><input v-model="query" type="search" :aria-label="t('searchCourses')" :placeholder="t('searchCourses')" /></label><button v-if="activeContinue" class="button button--secondary" type="button" @click="resumeActive">继续学习</button></div>
    <StatePanel v-if="store.homeStatus === 'loading'" state="loading" :title="t('loading')" />
    <StatePanel v-else-if="store.homeStatus === 'forbidden'" state="permission" title="暂时没有访问权限" description="请确认使用了正确的账号，或前往帮助页反馈。" action-label="帮助与反馈" @action="router.push({ name: 'support' })" />
    <StatePanel v-else-if="shelf === 'error'" state="error" title="内容暂时没能加载" :description="userFacingError(store.lastError, '请检查网络后重试。')" action-label="重新加载" @action="retry" />
    <StatePanel v-else-if="shelf === 'catalog-empty'" state="empty" title="书架正在准备中" description="有可学习的内容时，会出现在这里。你也可以先调整学习目标。" :action-label="t('setGoal')" @action="router.push({ name: 'onboarding' })" />
    <StatePanel v-else-if="shelf === 'no-matches'" state="empty" :title="t('noResults')" :action-label="t('clearFilter')" @action="() => { query = ''; kind = '' }" />
    <div v-else class="library-grid"><button v-for="(item, index) in results" :key="item.contentId" type="button" class="library-card" @click="openCourse(item.contentId)"><span class="library-card__art" :data-tone="index % 3"><span class="library-card__edition">{{ String(index + 1).padStart(2, '0') }}</span><AppIcon name="book" :size="62" /><span class="library-card__language">{{ item.contentLocale }}</span><i></i></span><span class="library-card__body"><small>{{ kindLabel(item.kind) }}</small><strong>{{ item.title }}</strong><span>{{ item.description || t('courseFallback') }}</span><span class="library-card__cta">{{ t('openCourse') }}<AppIcon name="arrow" :size="18" /></span></span></button></div>
  </section>
</template>
