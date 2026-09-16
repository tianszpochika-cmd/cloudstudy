<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlanCurrent, type LoopPlan } from '../api/b2'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const router = useRouter()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const plan = ref<LoopPlan | null>(null)

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    plan.value = await fetchPlanCurrent()
    state.value = plan.value.status && plan.value.status !== 'EMPTY' ? 'ready' : 'empty'
  } catch (error) {
    const status = (error as { status?: number })?.status
    state.value = status === 403 ? 'permission' : 'error'
    lastError.value = error instanceof Error ? error.message : '计划暂时不可用。'
  }
}

function today(): void {
  void router.push({ name: 'today' })
}

function mistakes(): void {
  void router.push({ name: 'mistakes' })
}

onMounted(() => { void load() })
</script>

<template>
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="plan-title">
      <h1 id="plan-title">计划地图</h1>
      <p class="lead">只读服务端当前计划；闭环从这里出发：计划 → 今日 → 练习 → 错题 → 报告。</p>
      <div v-if="state === 'loading'" role="status">正在读取计划…</div>
      <div v-else-if="state === 'permission'" role="alert">当前会话没有计划读取权限。</div>
      <div v-else-if="state === 'error'" role="alert">{{ lastError ?? '计划暂时不可用。' }}</div>
      <p v-if="state === 'empty'" class="muted">暂无生效计划——完成开户目标后自动生成。</p>
      <dl v-else-if="plan" class="stats">
        <div><dt>状态</dt><dd>{{ plan.status }}</dd></div>
        <div><dt>每日分钟</dt><dd>{{ plan.targetMinutes ?? '—' }}</dd></div>
        <div><dt>版本</dt><dd>{{ plan.planVersion ?? '—' }}</dd></div>
        <div><dt>更新</dt><dd>{{ plan.updatedAt ?? '—' }}</dd></div>
      </dl>
      <div class="actions">
        <button class="button button--primary" type="button" @click="today">去今日任务</button>
        <button class="button" type="button" @click="mistakes">看错题本</button>
      </div>
    </section>
  </main>
</template>
