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
  <section class="page-stack">
    <ExperienceHeader page="Mistakes" icon="bookmark" />
    <p data-zero-only>{{ ZERO_ONLY_COPY }}</p>
    <p data-projection-version>{{ projectionVersion }}</p>
    <p v-if="state === 'empty' || state === 'error'" data-empty-book>{{ emptyLabel }}</p>
    <p v-if="remediationId" data-remediation>{{ remediationId }}</p>
    <StatePanel
      v-if="state !== 'ready'"
      :state="state"
      title="错题本"
      :description="state === 'empty' || state === 'error' ? emptyLabel : state === 'permission' ? '当前会话没有错题读取权限。' : (lastError ?? '错题暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <section v-else class="info-card" aria-label="错题列表">
      <ul class="yx-mistake-list">
        <li v-for="item in mistakes" :key="String(item.interactionId ?? item.resourceKey)">
          <div><strong>{{ item.resourceKey ?? '练习题' }}</strong><span class="yx-pill yx-pill--warning" data-closure>{{ closureLabel(item.mistakeStatus) }}</span></div>
          <span class="yx-fact-tag">{{ item.domainCode ?? '' }} · {{ item.errorCategory ?? '' }}</span>
          <p v-if="item.message">{{ item.message }}</p>
          <p v-if="item.feedbackCode" class="yx-fact-tag">反馈：{{ item.feedbackCode }}</p>
        </li>
      </ul>
      <div class="actions">
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
