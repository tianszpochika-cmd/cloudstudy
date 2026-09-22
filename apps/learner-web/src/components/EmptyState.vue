<script setup lang="ts">
import AppIcon from './AppIcon.vue'
withDefaults(defineProps<{
  title: string
  description: string
  actionLabel?: string
}>(), {
  actionLabel: '',
})

defineEmits<{
  action: []
}>()
</script>

<template>
  <section class="empty-state" role="status" aria-live="polite">
    <div class="empty-state__mark" aria-hidden="true"><AppIcon name="book" :size="24" /></div>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <button v-if="actionLabel" type="button" class="button button--primary" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </section>
</template>
