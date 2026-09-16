<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchSrsOverview, type LoopMastery } from '../api/b2'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const router = useRouter()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const mastery = ref<LoopMastery | null>(null)

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    mastery.value = await fetchSrsOverview()
    state.value = (mastery.value.total ?? 0) > 0 ? 'ready' : 'empty'
  } catch (error) {
    const status = (error as { status?: number })?.status
    state.value = status === 403 ? 'permission' : 'error'
    lastError.value = error instanceof Error ? error.message : '掌握度暂时不可用。'
  }
}

function review(): void {
  void router.push({ name: 'vocabulary' })
}

function plan(): void {
  void router.push({ name: 'plan-map' })
}

onMounted(() => { void load() })
</script>

<template>
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="mastery-title">
      <h1 id="mastery-title">掌握度</h1>
      <p class="lead">只读服务端 SRS 投影；阶段由服务端判定，页面不推算。</p>
      <div v-if="state === 'loading'" role="status">正在读取掌握度…</div>
      <div v-else-if="state === 'permission'" role="alert">当前会话没有掌握度读取权限。</div>
      <div v-else-if="state === 'error'" role="alert">{{ lastError ?? '掌握度暂时不可用。' }}</div>
      <p v-if="state === 'empty'" class="muted">还没有复习数据——去背几个词再回来。</p>
      <dl v-else-if="mastery" class="stats">
        <div><dt>全部</dt><dd>{{ mastery.total }}</dd></div>
        <div><dt>新词</dt><dd>{{ mastery.newCount }}</dd></div>
        <div><dt>学习中</dt><dd>{{ mastery.learningCount }}</dd></div>
        <div><dt>复习中</dt><dd>{{ mastery.reviewCount }}</dd></div>
        <div><dt>已掌握</dt><dd>{{ mastery.masteredCount }}</dd></div>
      </dl>
      <div class="actions">
        <button class="button button--primary" type="button" @click="review">去复习</button>
        <button class="button" type="button" @click="plan">看计划地图</button>
      </div>
    </section>
  </main>
</template>
