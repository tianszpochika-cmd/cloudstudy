<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMistakesQueue, type LoopMistake } from '../api/b2'
import StatePanel from '../components/StatePanel.vue'
import { PROJECTION_VERSION, ZERO_ONLY_COPY, closureLabel, emptyBook } from '../domain/mistake-book'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const router = useRouter()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const mistakes = ref<LoopMistake[]>([])
const attemptCount = ref(0)
const serverEmptyCopy = ref('')
const projectionVersion = ref(PROJECTION_VERSION)
const emptyLabel = computed(() => {
  if (state.value === 'error') return emptyBook(0, 0, true).copy
  return serverEmptyCopy.value || emptyBook(attemptCount.value, mistakes.value.length).copy
})
const remediationId = computed(() => mistakes.value.find((item) => item.remediationId)?.remediationId ?? '')
const mistakeFilter = ref<'all' | 'pending' | 'verify'>('all')
const filteredMistakes = computed(() => mistakes.value.filter((item) => {
  const status = (item.mistakeStatus ?? '').toUpperCase()
  if (mistakeFilter.value === 'pending') return status === 'PENDING_RETRY' || status === 'OPEN' || status === 'NEW' || status === 'REOPENED'
  if (mistakeFilter.value === 'verify') return status.startsWith('DELAY_VERIFY')
  return true
}))

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    const book = await fetchMistakesQueue()
    mistakes.value = book.items
    attemptCount.value = book.attemptCount
    serverEmptyCopy.value = book.emptyCopy ?? ''
    projectionVersion.value = book.projectionVersion || PROJECTION_VERSION
    state.value = mistakes.value.length ? 'ready' : 'empty'
  } catch (error) {
    const status = (error as { status?: number })?.status
    state.value = status === 403 ? 'permission' : 'error'
    lastError.value = error instanceof Error ? error.message : '错题暂时不可用。'
  }
}

function verify(): void {
  void router.push({ name: 'b2-practice' })
}

function report(): void {
  void router.push({ name: 'b2-report' })
}

onMounted(() => { void load() })
</script>

<template>
  <section class="page-stack v2-page v2-page--mistakes">
    <ExperienceHeader page="Mistakes" icon="bookmark" />
    <p data-zero-only class="v2-mistakes-note">{{ ZERO_ONLY_COPY }}</p>
    <p data-projection-version class="v2-sr-only">{{ projectionVersion }}</p>
    <p v-if="state === 'empty' || state === 'error'" data-empty-book>{{ emptyLabel }}</p>
    <p v-if="remediationId" data-remediation class="v2-sr-only">{{ remediationId }}</p>
    <StatePanel
      v-if="state !== 'ready'"
      :state="state"
      title="错题本"
      :description="state === 'empty' || state === 'error' ? emptyLabel : state === 'permission' ? '当前会话没有错题读取权限。' : (lastError ?? '错题暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <section v-else class="info-card v2-mistakes" aria-label="错题列表">
      <div class="v2-mistakes-filter" role="group" aria-label="筛选错题"><button v-for="option in [{ key: 'all', label: '全部' }, { key: 'pending', label: '待补救' }, { key: 'verify', label: '待验证' }] as const" :key="option.key" type="button" class="v2-chip" :class="{ active: mistakeFilter === option.key }" :aria-pressed="mistakeFilter === option.key" @click="mistakeFilter = option.key">{{ option.label }}</button></div>
      <ul class="yx-mistake-list v2-mistakes-grid">
        <li v-for="item in filteredMistakes" :key="String(item.interactionId ?? item.resourceKey)" class="v2-mistake-card">
          <div class="v2-mistake-head"><span class="yx-pill yx-pill--warning v2-mistake-status" data-closure>{{ closureLabel(item.mistakeStatus, ({ PENDING_RETRY: '待补救', DELAY_VERIFY_D1: '待次日验证', DELAY_VERIFY_D7: '待七日验证', REOPENED: '重新打开', OPEN: '待处理', NEW: '新错题' } as Record<string, string>)[item.mistakeStatus ?? ''] ?? '待处理') }}</span><strong>{{ item.resourceKey ?? '练习题' }}</strong></div>
          <span class="yx-fact-tag v2-mistake-meta">{{ [({ GRAMMAR: '语法', VOCAB: '词汇', READING: '阅读', LISTENING: '听力' } as Record<string, string>)[item.domainCode ?? ''] ?? '', item.errorCategory ?? ''].filter(Boolean).join(' · ') }}</span>
          <p v-if="item.message">{{ item.message }}</p>
          <p v-if="item.feedbackCode" class="yx-fact-tag">反馈：{{ item.feedbackCode }}</p>
        </li>
      </ul>
      <p v-if="!filteredMistakes.length" class="muted v2-mistakes-none">这个分类下暂时没有错题。</p>
      <div class="actions v2-mistakes-actions">
        <button class="button button--primary" type="button" @click="verify">去练习验证</button>
        <button class="button" type="button" @click="report">看学习报告</button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.yx-mistake-list {
  display: grid;
  gap: 12px;
  margin: 0 0 20px;
  padding: 0;
  list-style: none;
}
.yx-mistake-list li {
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--yx-color-border);
  border-radius: 12px;
  background: var(--yx-color-surface-card);
}
.yx-mistake-list li > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.yx-mistake-list p { margin: 0; color: var(--yx-color-text-secondary); font-size: 13px; line-height: 1.6; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
</style>

<style>
.v2-page--mistakes .v2-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.v2-page--mistakes .v2-mistakes-note { margin: 0; padding: 16px 20px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); color: var(--v2-mut); font-size: 13px; }
.v2-page--mistakes .v2-mistakes { background: transparent; border: 0; box-shadow: none; padding: 0; }
.v2-page--mistakes .v2-mistakes-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; list-style: none; margin: 0; padding: 0; }
.v2-page--mistakes .v2-mistake-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); text-align: left; transition: border-color var(--v2-motion-fast), transform var(--v2-motion-fast); }
.v2-page--mistakes .v2-mistake-card:hover { border-color: var(--v2-brand2); transform: translateY(-1px); }
.v2-page--mistakes .v2-mistake-head { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 6px; width: 100%; text-align: left; }
.v2-page--mistakes .v2-mistake-head strong { font-size: 16px; color: var(--v2-ink); line-height: 1.5; }
.v2-page--mistakes .v2-mistake-status { background: var(--v2-warn-soft); color: var(--v2-warn); font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: var(--v2-radius-pill); width: auto; }
.v2-page--mistakes .v2-mistake-meta { background: transparent; color: var(--v2-mut); padding: 0; font-size: 12px; font-weight: 500; }
.v2-page--mistakes .v2-mistake-card p { margin: 0; color: var(--v2-mut); font-size: 13px; }
.v2-page--mistakes .v2-mistakes-actions { display: flex; gap: 10px; margin-top: 18px; }
@media (max-width: 650px) { .v2-page--mistakes .v2-mistakes-grid { grid-template-columns: 1fr; } }
.v2-page--mistakes .v2-mistakes-filter { display: flex; gap: 8px; margin-bottom: 16px; } .v2-page--mistakes .v2-chip { min-height: 36px; padding: 0 16px; border: 1px solid var(--v2-line); border-radius: var(--v2-radius-pill); background: var(--v2-card); color: var(--v2-ink); font-size: 13px; cursor: pointer; transition: background var(--v2-motion-fast); } .v2-page--mistakes .v2-chip:hover { background: var(--v2-surface); } .v2-page--mistakes .v2-chip.active { border-color: var(--v2-brand); background: var(--v2-soft); color: var(--v2-brand); font-weight: 700; } .v2-page--mistakes .v2-chip:focus-visible { outline: 2px solid var(--v2-focus); outline-offset: 2px; }
</style>
