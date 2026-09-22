<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import StatePanel from '../components/StatePanel.vue'
import AppIcon, { type AppIconName } from '../components/AppIcon.vue'
import StudyArtwork from '../components/StudyArtwork.vue'
import { useLearnerContentStore } from '../stores/learner-content'
import { useExperienceText } from '../platform/experience-ui'
const router = useRouter()
const store = useLearnerContentStore()
const t = useExperienceText()
const home = computed(() => store.home)
const stream = computed(() => home.value?.today?.dailyStream ?? home.value?.home?.dailyStream)
const tasks = computed(() => stream.value?.tasks ?? [])
const content = computed(() => home.value?.content ?? [])
const completeCount = computed(() => tasks.value.filter(task => task.completed).length)
const nextTask = computed(() => tasks.value.find(task => !task.completed))
const activities: Array<{ name: string; key: string; hint: string; icon: AppIconName }> = [
  { name: 'vocabulary', key: 'vocabulary', hint: 'vocabHint', icon: 'cards' },
  { name: 'b3-listening', key: 'listening', hint: 'listeningHint', icon: 'headphones' },
  { name: 'b3-reading', key: 'reading', hint: 'readingHint', icon: 'book' },
  { name: 'b3-speaking', key: 'speaking', hint: 'speakingHint', icon: 'mic' },
  { name: 'b3-grammar', key: 'grammar', hint: 'grammarHint', icon: 'spark' },
  { name: 'b3-writing', key: 'writing', hint: 'writingHint', icon: 'pen' },
]
function start(task = nextTask.value) {
  if (!task) { void router.push({ name: 'today' }); return }
  void router.push({ name: 'learn-session', query: { taskId: task.id, ...(task.contentCode ? { contentCode: task.contentCode } : {}) } })
}
onMounted(() => { store.restore(); void store.loadHome() })
</script>
<template>
  <section class="page-stack home-experience" aria-labelledby="home-title">
    <div class="home-greeting"><div><p class="experience-eyebrow"><AppIcon name="spark" :size="15" />A LITTLE, EVERY DAY</p><h1 id="home-title">{{ t('homeTitle') }}</h1><p>{{ t('homeDescription') }}</p></div><RouterLink class="text-link" :to="{ name: 'onboarding' }">{{ t('setGoal') }}<AppIcon name="arrow" :size="16" /></RouterLink></div>
    <div class="home-dashboard">
      <div class="home-main">
        <article class="home-hero">
          <div class="home-hero__copy"><span class="hero-label">{{ t('myTasks') }}</span><h2>{{ nextTask?.title || t('continue') }}</h2><p>{{ nextTask?.description || t('tagline') }}</p><button class="button button--white" type="button" @click="start()">{{ t(nextTask ? 'continue' : 'start') }}<AppIcon name="arrow" :size="18" /></button><small v-if="nextTask">{{ nextTask.minutes }} {{ t('minutes') }} · {{ t('next') }}</small></div>
          <StudyArtwork />
        </article>
        <article class="experience-card home-tasks">
          <div class="section-heading"><div><span class="card-kicker">YOUR DAILY PLAN</span><h2>{{ t('myTasks') }}</h2></div><RouterLink class="text-link" :to="{ name: 'today' }">{{ t('viewAll') }}<AppIcon name="arrow" :size="16" /></RouterLink></div>
          <StatePanel v-if="store.homeStatus === 'loading'" state="loading" :title="t('loading')" />
          <StatePanel v-else-if="store.lastError" state="error" :title="t('myTasks')" :description="store.lastError" action-label="重试" @action="() => { void store.loadHome() }" />
          <div v-else-if="tasks.length" class="daily-task-list"><button v-for="(task, index) in tasks.slice(0,4)" :key="task.id" type="button" class="daily-task" :class="{ 'daily-task--done': task.completed }" :disabled="task.completed" @click="start(task)"><span class="daily-task__number"><AppIcon v-if="task.completed" name="check" :size="18" /><template v-else>{{ String(index + 1).padStart(2, '0') }}</template></span><span class="daily-task__copy"><strong>{{ task.title }}</strong><small>{{ task.minutes }} {{ t('minutes') }} · {{ task.description }}</small></span><span class="daily-task__state">{{ t(task.completed ? 'completed' : 'start') }}</span><AppIcon v-if="!task.completed" name="arrow" :size="17" /></button></div>
          <StatePanel v-else state="empty" :title="t('noTasks')" :description="t('noTasksDescription')" :action-label="t('setGoal')" @action="router.push({ name: 'onboarding' })" />
        </article>
      </div>
      <aside class="home-aside">
        <article class="experience-card daily-progress"><span class="card-kicker">LITTLE STEPS COUNT</span><h2>{{ t('progress') }}</h2><div class="daily-progress__ring" :style="{ '--progress': (stream ? store.todayProgress : 0) + '%' }"><div><strong>{{ stream ? store.todayProgress + '%' : '—' }}</strong><span>{{ t('completed') }}</span></div></div><div class="daily-progress__facts"><span>{{ t('target') }}<strong>{{ stream ? stream.targetMinutes : '—' }} <small>{{ t('minutes') }}</small></strong></span><span>{{ t('completed') }}<strong>{{ stream ? stream.completedMinutes : '—' }} <small>{{ t('minutes') }}</small></strong></span></div><p v-if="tasks.length" class="muted">{{ completeCount }} / {{ tasks.length }} {{ t('completed') }}</p></article>
        <RouterLink class="world-invitation" :to="{ name: 'world' }"><div class="world-invitation__art" aria-hidden="true"><span>✦</span><i></i><b>✧</b></div><span class="card-kicker">YOUR LITTLE WORLD</span><h3>{{ t('worldTitle') }}</h3><p>{{ t('worldHint') }}</p><span class="text-link">{{ t('enterWorld') }}<AppIcon name="arrow" :size="17" /></span></RouterLink>
      </aside>
    </div>
    <section class="home-explore"><div class="section-heading"><div><span class="card-kicker">FIND YOUR RHYTHM</span><h2>{{ t('explore') }}</h2></div><p>{{ t('exploreDescription') }}</p></div><div class="activity-grid"><RouterLink v-for="(activity, index) in activities" :key="activity.key" class="activity-card" :data-tone="index % 3" :to="{ name: activity.name }"><span class="activity-card__icon"><AppIcon :name="activity.icon" :size="25" /></span><span><strong>{{ t(activity.key) }}</strong><small>{{ t(activity.hint) }}</small></span><AppIcon name="arrow" :size="17" /></RouterLink></div></section>
    <section v-if="content.length" class="home-books"><div class="section-heading"><h2>{{ t('bookshelf') }}</h2><RouterLink class="text-link" :to="{ name: 'courses' }">{{ t('viewAll') }}<AppIcon name="arrow" :size="16" /></RouterLink></div><div class="book-row"><RouterLink v-for="(item, index) in content.slice(0,3)" :key="item.contentId" class="book-card" :to="{ name: 'learn-session', query: { contentId: item.contentId } }"><span class="book-card__cover" :data-tone="index % 3"><AppIcon name="book" :size="32" /><small>{{ item.contentLocale }}</small></span><div><small>{{ t('availableContent') }}</small><h3>{{ item.title }}</h3><p>{{ item.description || t('courseFallback') }}</p></div><AppIcon name="arrow" :size="18" /></RouterLink></div></section>
  </section>
</template>
