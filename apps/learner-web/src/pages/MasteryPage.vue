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
  <section class="page-stack v2-page v2-page--mastery">
    <ExperienceHeader class="v2-mastery-head" page="Mastery" icon="star" />
    <div class="v2-mastery-body"><div class="v2-mastery-main">
    <StatePanel
      v-if="state !== 'ready'"
      class="v2-mastery-state"
      :state="state"
      title="掌握度"
      :description="state === 'empty' ? weaknessView(0).copy : state === 'permission' ? '当前会话没有掌握度读取权限。' : (lastError ?? '掌握度暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <p v-if="state === 'empty'" data-weakness-unknown class="v2-mastery-unknown">{{ weaknessView(0).copy }}</p>
    <section v-else-if="mastery" class="info-card v2-mastery-evidence" data-weakness-evidence aria-label="掌握度统计">
      <dl class="yx-stats v2-mastery-stats">
        <div class="v2-mastery-stat"><dt>全部</dt><dd>{{ mastery.total }}</dd></div>
        <div class="v2-mastery-stat"><dt>新词</dt><dd>{{ mastery.newCount }}</dd></div>
        <div class="v2-mastery-stat"><dt>学习中</dt><dd>{{ mastery.learningCount }}</dd></div>
        <div class="v2-mastery-stat"><dt>复习中</dt><dd>{{ mastery.reviewCount }}</dd></div>
        <div class="v2-mastery-stat"><dt>已掌握</dt><dd>{{ mastery.masteredCount }}</dd></div>
      </dl>
      <div class="actions v2-mastery-actions">
        <button class="button button--primary v2-mastery-action" type="button" @click="review">去复习</button>
        <button class="button v2-mastery-action" type="button" @click="plan">看计划地图</button>
      </div>
    </section>
    </div><aside class="v2-mastery-side"><h2>看懂掌握度</h2><ol><li>先看整体分布，再看需要复习的部分。</li><li>去复习完成后，统计会更新。</li><li>看计划地图，把下一步放进安排。</li></ol></aside></div>
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

<style>
/* Mastery v2 外观层：映射原型 desktop-dashboard（主列 + 300px 侧栏）与 weekly 报告 metrics/tag 质感；只用 --v2-* 变量，暗色由变量自动适配。 */
.v2-page--mastery { display: grid; gap: var(--v2-space-6); width: 100%; max-width: 1320px; margin: 0 auto; font-family: var(--v2-font); }
.v2-page--mastery .v2-mastery-head { min-width: 0; }
.v2-page--mastery .v2-mastery-body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--v2-space-6); align-items: start; min-width: 0; }
.v2-page--mastery .v2-mastery-main { display: grid; gap: var(--v2-space-5); align-content: start; min-width: 0; }
.v2-page--mastery .v2-mastery-state { min-width: 0; }
.v2-page--mastery .v2-mastery-unknown { margin: 0; padding: var(--v2-space-4) var(--v2-space-5); background: var(--v2-soft); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--mastery .v2-mastery-evidence { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-6); min-width: 0; display: grid; gap: var(--v2-space-5); align-content: start; }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--v2-space-4); margin: 0; padding: 0; }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stat { display: grid; gap: var(--v2-space-2); align-content: start; margin: 0; padding: var(--v2-space-4); background: var(--v2-surface); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); min-width: 0; }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stat dd { order: 1; margin: 0; color: var(--v2-ink); font-size: var(--v2-text-xl); font-weight: 700; letter-spacing: -1px; line-height: 1.2; }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stat dt { order: 2; display: inline-flex; align-items: center; width: max-content; max-width: 100%; border-radius: var(--v2-radius-pill); background: var(--v2-soft); color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 700; padding: var(--v2-space-1) var(--v2-space-3); line-height: 1.6; white-space: nowrap; }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stat:first-child dd { color: var(--v2-brand); }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stat:last-child dt { background: var(--v2-ok-soft); color: var(--v2-ok); }
.v2-page--mastery .v2-mastery-evidence .v2-mastery-stat:last-child dd { color: var(--v2-ok); }
.v2-page--mastery .v2-mastery-actions { display: flex; flex-wrap: wrap; gap: var(--v2-space-2); }
.v2-page--mastery .v2-mastery-action { min-width: 0; }
.v2-page--mastery .v2-mastery-action:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.v2-page--mastery .v2-mastery-side { position: sticky; top: var(--v2-space-6); display: grid; gap: var(--v2-space-3); align-content: start; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-5); min-width: 0; }
.v2-page--mastery .v2-mastery-side h2 { margin: 0; color: var(--v2-ink); font-size: var(--v2-text-md); line-height: 1.5; }
.v2-page--mastery .v2-mastery-side ol { margin: 0; padding-left: var(--v2-space-5); display: grid; gap: var(--v2-space-2); color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--mastery .v2-mastery-side li { margin: 0; }
.v2-page--mastery .v2-mastery-side li::marker { color: var(--v2-brand); }
@media (max-width: 1190px) { .v2-page--mastery .v2-mastery-body { grid-template-columns: minmax(0, 1fr) 240px; gap: var(--v2-space-5); } .v2-page--mastery .v2-mastery-evidence { padding: var(--v2-space-5); } .v2-page--mastery .v2-mastery-side { padding: var(--v2-space-4); } }
@media (max-width: 900px) { .v2-page--mastery .v2-mastery-body { grid-template-columns: 1fr; } .v2-page--mastery .v2-mastery-evidence { padding: var(--v2-space-5) var(--v2-space-4); } .v2-page--mastery .v2-mastery-evidence .v2-mastery-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .v2-page--mastery .v2-mastery-side { position: static; } .v2-page--mastery .v2-mastery-actions { display: grid; } }
</style>
