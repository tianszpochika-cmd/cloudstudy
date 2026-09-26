<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatePanel from '../components/StatePanel.vue'
import { learnerContentPort } from '../api/learner-content'
import type { LearnerContentDetail } from '../domain/learner-content'
import { useB1Store } from '../stores/b1'
import { userFacingError } from '../platform/user-facing-error'

const b1 = useB1Store()
const route = useRoute()
const router = useRouter()
const context = computed(() => b1.continueContext)
const content = ref<LearnerContentDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const elapsed = ref(0)
let timer: number | undefined

onMounted(async () => {
  b1.restore()
  void b1.loadContinueContext()
  timer = window.setInterval(() => { elapsed.value += 1 }, 1000)
  const contentCode = typeof route.query.contentCode === 'string'
    ? route.query.contentCode
    : typeof route.query.contentId === 'string' ? route.query.contentId : ''
  if (!contentCode) {
    error.value = '请先在课程书架里选择一节想学的内容。'
    loading.value = false
    return
  }
  try { content.value = await learnerContentPort.readContent(contentCode) }
  catch (reason) { error.value = userFacingError(reason instanceof Error ? reason.message : null, '课程内容暂时无法读取。') }
  finally { loading.value = false }
})

onUnmounted(() => { if (timer) window.clearInterval(timer) })

async function saveAndExit(): Promise<void> {
  if (!content.value) return
  await b1.updateContinueContext({
    moduleId: content.value.contentId,
    moduleLabel: content.value.title,
    lessonId: content.value.items[0]?.itemId ?? content.value.contentId,
    lessonTitle: content.value.title,
    stepIndex: 1,
    totalSteps: Math.max(1, content.value.items.length),
    elapsedTimeMs: (context.value?.elapsedTimeMs ?? 0) + elapsed.value * 1000,
  })
  if (b1.lastError) {
    error.value = userFacingError(b1.lastError, '保存阅读位置失败，请稍后重试。')
    return
  }
  await router.push({ name: 'today' })
}

</script>

<template>
  <section class="page-stack" aria-labelledby="session-title">
    <ExperienceHeader page="Session" icon="book" title-id="session-title" />
    <StatePanel v-if="loading" state="loading" title="正在读取课程内容" description="正在准备你的学习内容，请稍候。" />
    <StatePanel v-else-if="error || !content" state="error" title="课程暂时不可用" :description="error ?? '服务端没有返回课程内容。'" action-label="返回课程" @action="router.push({ name: 'courses' })" />
    <template v-else>
      <article class="lesson-card"><p class="eyebrow">{{ content.kind }} · {{ content.contentLocale }}</p><h2 id="learn-title">{{ content.title }}</h2><p class="lead">{{ content.description || '按自己的节奏，完成今天的一小步。' }}</p><div class="lesson-meta"><span>{{ content.items.length }} 个学习单元</span><span>本次 {{ elapsed }} 秒</span></div></article>
      <article v-for="(item, index) in content.items" :key="item.itemId" class="info-card"><span class="card-kicker">学习单元 {{ index + 1 }} · {{ item.itemType }}</span><h3>{{ item.text || '学习内容' }}</h3><div v-if="item.options.length" class="option-list"><span v-for="option in item.options" :key="option.key" class="option">{{ option.key }} · {{ option.text }}</span></div></article>
      <article v-if="!content.items.length" class="info-card"><h3>课程没有可学习单元</h3><p>这节课程的内容正在准备中，先看看其他课程吧。</p></article>
      <div class="actions"><button class="button button--secondary" type="button" @click="saveAndExit">保存并返回今日任务</button></div>
    </template>
  </section>
</template>

<style scoped>
.lesson-card{padding:36px;border-radius:20px;color:var(--yx-color-on-brand);background:var(--yx-hero-gradient);box-shadow:0 16px 48px color-mix(in srgb,var(--yx-color-brand-primary) 20%, transparent)}.lesson-card h2{max-width:680px;margin:12px 0;font-size:clamp(28px,5vw,46px);line-height:1.2}.lesson-card .lead{color:color-mix(in srgb,var(--yx-color-on-brand) 84%, transparent)}.lesson-meta{display:flex;justify-content:space-between;margin-top:24px;font-size:13px;opacity:.85}.info-card{padding:28px}.info-card h3{margin:10px 0}.info-card p{color:var(--yx-color-text-secondary);line-height:1.8}.option-list{display:flex;flex-wrap:wrap;gap:10px}.option{padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary)}.state-card{display:grid;gap:12px}.actions{display:flex;gap:12px;margin-top:24px}@media(max-width:640px){.lesson-card{padding:24px}.actions{display:grid}}
</style>
