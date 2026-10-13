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
  <AuthLayout class="v2-page v2-page--empty">
    <div class="v2-empty-layout">
      <div class="v2-empty-main">
        <section class="page-stack v2-empty-card">
          <EmptyState class="v2-empty-state" :title="title" :description="description" action-label="返回学习首页" @action="router.push({ name: 'home' })" />
        </section>
      </div>
      <aside class="v2-empty-side" aria-label="空状态说明">
        <h2 class="v2-empty-side-title">看到这个页面时</h2>
        <ol class="v2-empty-tips">
          <li>这里暂时没有可显示的内容。</li>
          <li>用主列按钮返回学习首页继续。</li>
          <li>反复看到可返回后再试一次。</li>
        </ol>
      </aside>
    </div>
  </AuthLayout>
</template>
