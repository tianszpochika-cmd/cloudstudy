<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchSrsOverview, type LoopMastery } from '../api/b2'
import StatePanel from '../components/StatePanel.vue'
import { weaknessView } from '../domain/mistake-book'

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
  <section class="page-stack">
    <ExperienceHeader page="Mastery" icon="star" />
    <StatePanel
      v-if="state !== 'ready'"
      :state="state"
      title="掌握度"
      :description="state === 'empty' ? weaknessView(0).copy : state === 'permission' ? '当前会话没有掌握度读取权限。' : (lastError ?? '掌握度暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <p v-if="state === 'empty'" data-weakness-unknown>{{ weaknessView(0).copy }}</p>
    <section v-else-if="mastery" class="info-card" data-weakness-evidence aria-label="掌握度统计">
      <dl class="yx-stats">
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
  </section>
</template>

<style scoped>
.yx-stats {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.yx-stats dd { color: var(--yx-color-brand-primary); font-size: 24px; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
@media (max-width: 640px) { .yx-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
