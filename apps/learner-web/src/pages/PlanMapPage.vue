<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPlanCurrent, type LoopPlan } from '../api/b2'
import StatePanel from '../components/StatePanel.vue'
import { userFacingError } from '../platform/user-facing-error'

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
  <section class="page-stack v2-page v2-page--planmap">
    <ExperienceHeader class="v2-planmap-head" page="Plan" icon="route" />
    <div class="v2-planmap-body"><div class="v2-planmap-main">
    <StatePanel
      v-if="state !== 'ready'"
      class="v2-planmap-state"
      :state="state"
      title="计划地图"
      :description="state === 'loading' ? '正在读取计划。' : state === 'empty' ? '目前没有可用的学习计划。请稍后再试。' : state === 'permission' ? '当前账号暂不能查看计划。' : userFacingError(lastError, '计划暂时不可用，请稍后重试。')"
      :action-label="state === 'error' || state === 'empty' ? '重试' : ''"
      @action="load"
    />
    <section v-else-if="plan" class="info-card v2-planmap-card" aria-label="当前计划">
      <dl class="yx-stats v2-planmap-stats">
        <div class="v2-planmap-stat"><dt>状态</dt><dd>{{ ({ EMPTY: '暂无计划', ACTIVE: '进行中', IN_PROGRESS: '进行中', CREATED: '已创建', COMPLETED: '已完成', INTERRUPTED: '已中断', EXPIRED: '已过期' } as Record<string, string>)[plan.status ?? ''] ?? plan.status ?? '—' }}</dd></div>
        <div class="v2-planmap-stat"><dt>每日分钟</dt><dd>{{ plan.targetMinutes ?? '—' }}</dd></div>
        <div class="v2-planmap-stat v2-sr-only"><dt>版本</dt><dd>{{ plan.planVersion ?? '—' }}</dd></div>
        <div class="v2-planmap-stat v2-sr-only"><dt>更新</dt><dd>{{ plan.updatedAt ?? '—' }}</dd></div>
      </dl>
      <div class="actions v2-planmap-actions">
        <button class="button button--primary v2-planmap-action" type="button" @click="today">去今日任务</button>
        <button class="button v2-planmap-action" type="button" @click="mistakes">看错题本</button>
      </div>
    </section>
    </div><aside class="v2-planmap-side"><h2>看懂学习计划</h2><ol><li>先看当前状态，再确认每天的时间安排。</li><li>去今日任务完成后，计划会更新。</li><li>遇到困难时，先看看错题本再回来。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
</style>

<style>
/* PlanMap v2 外观层：映射原型 desktop-dashboard（主列 + 300px 侧栏）与 metrics/tag 质感；只用 --v2-* 变量，暗色由变量自动适配。 */
.v2-page--planmap { display: grid; gap: var(--v2-space-6); width: 100%; max-width: 1320px; margin: 0 auto; font-family: var(--v2-font); }
.v2-page--planmap .v2-planmap-head { min-width: 0; }
.v2-page--planmap .v2-planmap-body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--v2-space-6); align-items: start; min-width: 0; }
.v2-page--planmap .v2-planmap-main { display: grid; gap: var(--v2-space-5); align-content: start; min-width: 0; }
.v2-page--planmap .v2-planmap-state { min-width: 0; }
.v2-page--planmap .v2-planmap-card { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-6); min-width: 0; display: grid; gap: var(--v2-space-5); align-content: start; }
.v2-page--planmap .v2-planmap-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v2-space-4); margin: 0; padding: 0; }
.v2-page--planmap .v2-planmap-stat { display: grid; gap: var(--v2-space-2); align-content: start; margin: 0; padding: var(--v2-space-4); background: var(--v2-surface); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); min-width: 0; }
.v2-page--planmap .v2-planmap-stat dd { order: 1; margin: 0; color: var(--v2-ink); font-size: var(--v2-text-xl); font-weight: 700; letter-spacing: -1px; line-height: 1.2; }
.v2-page--planmap .v2-planmap-stat dt { order: 2; display: inline-flex; align-items: center; width: max-content; max-width: 100%; border-radius: var(--v2-radius-pill); background: var(--v2-soft); color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 700; padding: var(--v2-space-1) var(--v2-space-3); line-height: 1.6; white-space: nowrap; }
.v2-page--planmap .v2-planmap-stat:first-child dd { color: var(--v2-brand); }
.v2-page--planmap .v2-planmap-actions { display: flex; flex-wrap: wrap; gap: var(--v2-space-2); }
.v2-page--planmap .v2-planmap-action { min-width: 0; }
.v2-page--planmap .v2-planmap-action:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.v2-page--planmap .v2-planmap-side { position: sticky; top: var(--v2-space-6); display: grid; gap: var(--v2-space-3); align-content: start; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-5); min-width: 0; }
.v2-page--planmap .v2-planmap-side h2 { margin: 0; color: var(--v2-ink); font-size: var(--v2-text-md); line-height: 1.5; }
.v2-page--planmap .v2-planmap-side ol { margin: 0; padding-left: var(--v2-space-5); display: grid; gap: var(--v2-space-2); color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--planmap .v2-planmap-side li { margin: 0; }
.v2-page--planmap .v2-planmap-side li::marker { color: var(--v2-brand); }
@media (max-width: 1190px) { .v2-page--planmap .v2-planmap-body { grid-template-columns: minmax(0, 1fr) 240px; gap: var(--v2-space-5); } .v2-page--planmap .v2-planmap-card { padding: var(--v2-space-5); } .v2-page--planmap .v2-planmap-side { padding: var(--v2-space-4); } }
@media (max-width: 900px) { .v2-page--planmap .v2-planmap-body { grid-template-columns: 1fr; } .v2-page--planmap .v2-planmap-card { padding: var(--v2-space-5) var(--v2-space-4); } .v2-page--planmap .v2-planmap-stats { grid-template-columns: 1fr; } .v2-page--planmap .v2-planmap-side { position: static; } .v2-page--planmap .v2-planmap-actions { display: grid; } }
</style>
