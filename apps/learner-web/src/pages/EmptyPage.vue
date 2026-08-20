<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="page-stack">
    <EmptyState :title="title" :description="description" />
  </section>
</template>
