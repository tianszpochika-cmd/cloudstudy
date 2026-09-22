<script setup lang="ts">
import AppIcon, { type AppIconName } from './AppIcon.vue'
/**
 * Unified non-data panel: loading (skeleton), empty, error, offline and
 * permission states share one look, one wording pattern and one retry slot.
 */
withDefaults(defineProps<{
  state: 'loading' | 'empty' | 'error' | 'offline' | 'permission'
  title: string
  description?: string
  actionLabel?: string
}>(), {
  description: '',
  actionLabel: '',
})

defineEmits<{
  action: []
}>()

const marks: Record<string, AppIconName> = {
  loading: 'target',
  empty: 'book',
  error: 'help',
  offline: 'monitor',
  permission: 'lock',
}
</script>

<template>
  <section
    class="empty-state yx-state-panel"
    :class="`yx-state-panel--${state}`"
    :role="state === 'error' ? 'alert' : 'status'"
    aria-live="polite"
  >
    <div class="empty-state__mark" aria-hidden="true"><AppIcon :name="marks[state]" :size="24" /></div>
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <div v-if="state === 'loading'" class="yx-state-panel__skeletons" aria-hidden="true">
      <div class="yx-skeleton" style="height: 18px; width: 72%"></div>
      <div class="yx-skeleton" style="height: 18px; width: 54%"></div>
      <div class="yx-skeleton" style="height: 18px; width: 63%"></div>
    </div>
    <button v-if="actionLabel" type="button" class="button button--primary" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </section>
</template>

<style scoped>
.yx-state-panel__skeletons {
  display: grid;
  gap: 10px;
  justify-items: center;
  width: min(420px, 100%);
  margin-top: 4px;
}
</style>
