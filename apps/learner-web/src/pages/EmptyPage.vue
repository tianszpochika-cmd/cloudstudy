<script setup lang="ts">
import { useRouter } from 'vue-router'
import AuthLayout from '../layouts/AuthLayout.vue'
const router = useRouter()
import EmptyState from '../components/EmptyState.vue'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <AuthLayout><section class="page-stack">
    <EmptyState :title="title" :description="description" action-label="返回学习首页" @action="router.push({ name: 'home' })" />
  </section></AuthLayout>
</template>
