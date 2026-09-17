<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMistakesQueue, type LoopMistake } from '../api/b2'
import PageHeader from '../components/PageHeader.vue'
import StatePanel from '../components/StatePanel.vue'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const router = useRouter()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const mistakes = ref<LoopMistake[]>([])

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    mistakes.value = await fetchMistakesQueue()
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
  <main class="page-stack">
    <PageHeader kicker="REVIEW LOOP" title="错题本" description="只读服务端判分落下的错题；修复在练习页完成，本页不改分。" />
    <StatePanel
      v-if="state !== 'ready'"
      :state="state"
      title="错题本"
      :description="state === 'empty' ? '暂无错题——答错的题目会自动出现在这里。' : state === 'permission' ? '当前会话没有错题读取权限。' : (lastError ?? '错题暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <section v-else class="info-card" aria-label="错题列表">
      <ul class="yx-mistake-list">
        <li v-for="item in mistakes" :key="String(item.interactionId ?? item.resourceKey)">
          <div><strong>{{ item.resourceKey ?? '练习题' }}</strong><span class="yx-pill yx-pill--warning">{{ item.mistakeStatus }}</span></div>
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
  </main>
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
