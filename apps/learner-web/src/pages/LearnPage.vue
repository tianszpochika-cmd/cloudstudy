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
  <section class="page-stack v2-page v2-page--learn" aria-labelledby="session-title">
    <ExperienceHeader page="Session" icon="book" title-id="session-title" />
    <StatePanel v-if="loading" state="loading" title="正在读取课程内容" description="正在准备你的学习内容，请稍候。" />
    <StatePanel v-else-if="error || !content" state="error" title="课程暂时不可用" :description="error ?? '服务端没有返回课程内容。'" action-label="返回课程" @action="router.push({ name: 'courses' })" />
    <template v-else>
      <div class="v2-learn-layout">
        <nav class="v2-learn-toc" aria-label="学习单元目录"><p class="card-kicker">本课目录</p><a v-for="(item, index) in content.items" :key="`toc-${item.itemId}`" :href="`#unit-${index + 1}`">{{ index + 1 }}. {{ ({ DIALOGUE: '对话', VOCAB: '词汇', CHOICE: '选择题', LESSON: '讲解', READING: '阅读', LISTENING: '听力' } as Record<string, string>)[item.itemType] ?? '学习内容' }}</a></nav>
        <div class="v2-learn-main">
          <article class="lesson-card"><p class="eyebrow">{{ ({ COURSE_UNIT: '课程单元', LESSON: '课程', READING: '阅读', LISTENING: '听力' } as Record<string, string>)[content.kind] ?? '课程' }} · {{ content.contentLocale }}</p><h2 id="learn-title">{{ content.title }}</h2><p class="lead">{{ content.description || '按自己的节奏，完成今天的一小步。' }}</p><div class="lesson-meta"><span>{{ content.items.length }} 个学习单元</span><span>本次 {{ elapsed }} 秒</span></div></article>
          <article v-for="(item, index) in content.items" :key="item.itemId" class="info-card v2-learn-unit" :id="`unit-${index + 1}`"><span class="card-kicker">学习单元 {{ index + 1 }} · {{ ({ DIALOGUE: '对话', VOCAB: '词汇', CHOICE: '选择题', LESSON: '讲解', READING: '阅读', LISTENING: '听力' } as Record<string, string>)[item.itemType] ?? '学习内容' }}</span><h3>{{ item.text || '学习内容' }}</h3><div v-if="item.options.length" class="option-list"><span v-for="option in item.options" :key="option.key" class="option">{{ option.key }} · {{ option.text }}</span></div></article>
          <article v-if="!content.items.length" class="info-card"><h3>课程没有可学习单元</h3><p>这节课程的内容正在准备中，先看看其他课程吧。</p></article>
          <div class="actions"><button class="button button--secondary" type="button" @click="saveAndExit">保存并返回今日任务</button></div>
        </div>
        <aside class="v2-learn-tools" aria-label="学习工具"><p class="card-kicker">本次学习</p><dl><div><dt>学习单元</dt><dd>{{ content.items.length }} 个</dd></div><div><dt>本次用时</dt><dd>{{ elapsed }} 秒</dd></div></dl><p class="muted">进度会自动保存，离开后可以从这里继续。</p><button class="button button--primary" type="button" @click="saveAndExit">保存并返回今日任务</button></aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.lesson-card{padding:36px;border-radius:20px;color:var(--yx-color-on-brand);background:var(--yx-hero-gradient);box-shadow:0 16px 48px color-mix(in srgb,var(--yx-color-brand-primary) 20%, transparent)}.lesson-card h2{max-width:680px;margin:12px 0;font-size:clamp(28px,5vw,46px);line-height:1.2}.lesson-card .lead{color:color-mix(in srgb,var(--yx-color-on-brand) 84%, transparent)}.lesson-meta{display:flex;justify-content:space-between;margin-top:24px;font-size:13px;opacity:.85}.info-card{padding:28px}.info-card h3{margin:10px 0}.info-card p{color:var(--yx-color-text-secondary);line-height:1.8}.option-list{display:flex;flex-wrap:wrap;gap:10px}.option{padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary)}.state-card{display:grid;gap:12px}.actions{display:flex;gap:12px;margin-top:24px}@media(max-width:640px){.lesson-card{padding:24px}.actions{display:grid}}
</style>

<style>
.v2-page--learn .v2-learn-layout { display: grid; grid-template-columns: 185px minmax(0, 1fr) 270px; gap: 20px; align-items: start; }
.v2-page--learn .v2-learn-toc, .v2-page--learn .v2-learn-tools { position: sticky; top: 96px; display: flex; flex-direction: column; gap: 6px; padding: 18px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); }
.v2-page--learn .v2-learn-toc a { display: block; padding: 8px 10px; border-radius: var(--v2-radius-md); color: var(--v2-ink); font-size: 13px; text-decoration: none; transition: background var(--v2-motion-fast); }
.v2-page--learn .v2-learn-toc a:hover { background: var(--v2-soft); color: var(--v2-brand); }
.v2-page--learn .v2-learn-main { display: grid; gap: 16px; min-width: 0; }
.v2-page--learn .lesson-card { background: var(--v2-grad-soft); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); padding: 26px; }
.v2-page--learn .lesson-card h2 { font-size: 26px; letter-spacing: -.6px; margin: 6px 0; }
.v2-page--learn .lesson-meta { display: flex; gap: 10px; color: var(--v2-mut); font-size: 12px; }
.v2-page--learn .v2-learn-unit h3 { white-space: pre-line; font-size: 17px; line-height: 1.7; color: var(--v2-ink); }
.v2-page--learn .v2-learn-unit .option-list { display: grid; gap: 8px; }
.v2-page--learn .v2-learn-unit .option { padding: 10px 14px; border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); background: var(--v2-surface); }
.v2-page--learn .v2-learn-unit { scroll-margin-top: 96px; }
.v2-page--learn .v2-learn-main > .actions { display: none; }
.v2-page--learn .v2-learn-tools dl { margin: 6px 0; display: grid; gap: 8px; }
.v2-page--learn .v2-learn-tools dl div { display: flex; justify-content: space-between; font-size: 13px; }
.v2-page--learn .v2-learn-tools dt { color: var(--v2-mut); }
.v2-page--learn .v2-learn-tools dd { margin: 0; font-weight: 700; }
.v2-page--learn .v2-learn-tools p { font-size: 12px; margin: 0 0 6px; }
@media (max-width: 1190px) { .v2-page--learn .v2-learn-layout { grid-template-columns: 170px minmax(0, 1fr); } .v2-page--learn .v2-learn-tools { grid-column: 2; position: static; } }
@media (max-width: 900px) { .v2-page--learn .v2-learn-layout { grid-template-columns: 1fr; } .v2-page--learn .v2-learn-toc { display: none; } .v2-page--learn .v2-learn-tools { grid-column: 1; } }
</style>
