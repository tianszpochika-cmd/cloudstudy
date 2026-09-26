<script setup lang="ts">
import { computed } from 'vue'
import type { B10PerformanceLevel, B10Status } from '../../domain/b10'
import { useLearningUi } from '../../platform/learning-ui'
import { userFacingError } from '../../platform/user-facing-error'

const props = withDefaults(defineProps<{
  status: B10Status
  message?: string | null
  queueCount?: number
  cached?: boolean
  moduleLabel?: string
  performanceLevel?: B10PerformanceLevel
}>(), { message: null, queueCount: 0, cached: false, moduleLabel: '学习数据', performanceLevel: 'High' })
const emit = defineEmits<{ retry: []; sync: []; performance: [level: B10PerformanceLevel] }>()
const ui = useLearningUi()
const title = computed(() => ui.t(`b10.state.${props.status}`))
const description = computed(() => userFacingError(props.message, props.cached ? ui.t('b10.state.cached') : ui.t(`b10.state.${props.status}`)))
const retryable = computed(() => ['offline', 'error', 'forbidden', 'stale'].includes(props.status))
</script>

<template>
  <section class="state-panel" :class="`state-panel--${status}`" role="status" aria-live="polite">
    <div class="state-panel__copy">
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </div>
    <div class="state-panel__actions">
      <span v-if="queueCount" class="state-panel__queue">{{ ui.t('b10.state.queued') }} · {{ queueCount }}</span>
      <button v-if="retryable" class="state-panel__button" type="button" @click="emit('retry')">{{ ui.t('b10.common.retry') }}</button>
      <button v-if="queueCount" class="state-panel__button" type="button" @click="emit('sync')">{{ ui.t('b10.common.sync') }}</button>
      <select :value="performanceLevel" :aria-label="ui.t('b10.common.performance', { level: '' })" @change="emit('performance', ($event.target as HTMLSelectElement).value as B10PerformanceLevel)">
        <option value="Ultra">Ultra</option><option value="High">High</option><option value="Medium">Medium</option><option value="Performance">Performance</option>
      </select>
    </div>
  </section>
</template>

<style scoped>
.state-panel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:15px 17px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}
.state-panel--offline,.state-panel--error,.state-panel--forbidden,.state-panel--stale{border-color:var(--yx-color-danger);background:var(--yx-color-surface-card)}
.state-panel--empty{border-style:dashed}.state-panel__copy{display:grid;gap:5px;min-width:220px}.state-panel__module{color:var(--yx-color-brand-primary);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.state-panel__copy>span{color:var(--yx-color-text-secondary);line-height:1.5}.state-panel__copy small{color:var(--yx-color-text-secondary);font-size:11px}.state-panel__actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.state-panel__queue{color:var(--yx-color-warning);font-size:12px;font-weight:750}.state-panel__button{min-height:38px;padding:0 12px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page);font-weight:750}.state-panel select{min-height:38px;padding:0 8px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary);background:var(--yx-color-surface-page)}
</style>
