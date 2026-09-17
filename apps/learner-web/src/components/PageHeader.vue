<script setup lang="ts">
/**
 * Unified page header: kicker eyebrow + title + optional description and
 * action slot. Replaces the per-page ad-hoc hero variants over time.
 */
withDefaults(defineProps<{
  kicker: string
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <div class="yx-page-header">
    <div>
      <p class="yx-kicker">{{ kicker }}</p>
      <h2>{{ title }}</h2>
      <p v-if="description" class="yx-page-header__desc">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="yx-page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.yx-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 4px;
}
.yx-page-header h2 {
  margin: 8px 0 0;
  font-size: clamp(24px, 3.4vw, 34px);
  letter-spacing: -0.02em;
}
.yx-page-header__desc {
  max-width: 680px;
  margin: 10px 0 0;
  color: var(--yx-color-text-secondary);
  line-height: 1.7;
}
.yx-page-header__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
  padding-top: 8px;
}
@media (max-width: 640px) {
  .yx-page-header { display: grid; }
}
</style>
