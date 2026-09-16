<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMistakesQueue, type LoopMistake } from '../api/b2'

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
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="mistakes-title">
      <h1 id="mistakes-title">错题本</h1>
      <p class="lead">只读服务端判分落下的错题；修复在练习页完成，本页不改分。</p>
      <div v-if="state === 'loading'" role="status">正在读取错题…</div>
      <div v-else-if="state === 'permission'" role="alert">当前会话没有错题读取权限。</div>
      <div v-else-if="state === 'error'" role="alert">{{ lastError ?? '错题暂时不可用。' }}</div>
      <p v-if="state === 'empty'" class="muted">暂无错题——答错的题目会自动出现在这里。</p>
      <ul v-else-if="mistakes.length">
        <li v-for="item in mistakes" :key="String(item.interactionId ?? item.resourceKey)">
          <strong>{{ item.resourceKey ?? '练习题' }}</strong>
          <span>{{ item.domainCode ?? '' }} · {{ item.errorCategory ?? '' }} · {{ item.mistakeStatus }}</span>
          <p v-if="item.message" class="muted">{{ item.message }}</p>
          <p v-if="item.feedbackCode" class="muted">反馈：{{ item.feedbackCode }}</p>
        </li>
      </ul>
      <div class="actions">
        <button class="button button--primary" type="button" @click="verify">去练习验证</button>
        <button class="button" type="button" @click="report">看学习报告</button>
      </div>
    </section>
  </main>
</template>
