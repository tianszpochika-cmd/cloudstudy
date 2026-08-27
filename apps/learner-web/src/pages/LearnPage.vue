<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { learnerContentPort } from '../api/learner-content'
import type { LearnerContentDetail } from '../domain/learner-content'
import { useB1Store } from '../stores/b1'
import { useLearnerContentStore } from '../stores/learner-content'

const b1 = useB1Store()
const learnerContent = useLearnerContentStore()
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
    error.value = '请从已发布课程进入学习，未使用本地静态课文。'
    loading.value = false
    return
  }
  try { content.value = await learnerContentPort.readContent(contentCode) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '课程内容暂时无法读取。' }
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
    error.value = b1.lastError
    return
  }
  await router.push({ name: 'today' })
}

async function complete(): Promise<void> {
  const taskId = typeof route.query.taskId === 'string' ? route.query.taskId : ''
  if (taskId) {
    await learnerContent.completeTask(taskId)
    if (learnerContent.lastError) {
      error.value = learnerContent.lastError
      return
    }
  }
  b1.completeContinue()
  await router.push({ name: 'today' })
}
</script>

<template>
  <section class="page-stack" aria-labelledby="learn-title">
    <div v-if="loading" class="info-card"><h2 id="learn-title">正在读取课程内容…</h2><p>内容来自 content-service 的已发布 MySQL 投影。</p></div>
    <div v-else-if="error || !content" class="info-card state-card"><h2 id="learn-title">课程暂时不可用</h2><p>{{ error ?? '服务端没有返回课程内容。' }}</p><button class="button button--secondary" type="button" @click="router.push({ name: 'courses' })">返回课程</button></div>
    <template v-else>
      <article class="lesson-card"><p class="eyebrow">{{ content.kind }} · {{ content.contentLocale }}</p><h2 id="learn-title">{{ content.title }}</h2><p class="lead">{{ content.description || '本节内容由服务端发布版本提供。' }}</p><div class="lesson-meta"><span>{{ content.items.length }} 个学习单元</span><span>本次 {{ elapsed }} 秒</span></div></article>
      <article v-for="(item, index) in content.items" :key="item.itemId" class="info-card"><span class="card-kicker">学习单元 {{ index + 1 }} · {{ item.itemType }}</span><h3>{{ item.text || '服务端内容单元' }}</h3><div v-if="item.options.length" class="option-list"><span v-for="option in item.options" :key="option.key" class="option">{{ option.key }} · {{ option.text }}</span></div></article>
      <article v-if="!content.items.length" class="info-card"><h3>课程没有可学习单元</h3><p>课程元数据已读取，但服务端尚未发布学习单元。</p></article>
      <div class="actions"><button class="button button--secondary" type="button" @click="saveAndExit">保存断点</button><button class="button button--primary" type="button" @click="complete">完成本步</button></div>
    </template>
  </section>
</template>

<style scoped>
:global(.app-shell__sidebar){overflow-y:auto}:global(.nav-list){min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior-y:contain;scrollbar-gutter:stable}:global(.sidebar-footer){flex:0 0 auto;margin-top:12px}
.lesson-card{padding:36px;border-radius:20px;color:#fff;background:linear-gradient(135deg,var(--yx-color-brand-primary),var(--yx-color-brand-secondary));box-shadow:0 16px 48px rgb(89 107 255 / 20%)}.lesson-card h2{max-width:680px;margin:12px 0;font-size:clamp(28px,5vw,46px);line-height:1.2}.lesson-card .lead{color:rgba(255,255,255,.84)}.lesson-meta{display:flex;justify-content:space-between;margin-top:24px;font-size:13px;opacity:.85}.info-card{padding:28px}.info-card h3{margin:10px 0}.info-card p{color:var(--yx-color-text-secondary);line-height:1.8}.option-list{display:flex;flex-wrap:wrap;gap:10px}.option{padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary)}.state-card{display:grid;gap:12px}.actions{display:flex;gap:12px;margin-top:24px}@media(max-width:640px){.lesson-card{padding:24px}.actions{display:grid}}
</style>
