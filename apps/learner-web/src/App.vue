<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { RouterView } from 'vue-router'
import AppShell from './layouts/AppShell.vue'

const errorMessage = ref<string | null>(null)

onErrorCaptured((error) => {
  errorMessage.value = error instanceof Error ? error.message : '页面出现了暂时无法恢复的错误。'
  return false
})

function retry(): void {
  errorMessage.value = null
}
</script>

<template>
  <div v-if="errorMessage" class="fatal-error" role="alert">
    <div class="fatal-error__card">
      <span class="fatal-error__icon" aria-hidden="true">!</span>
      <h1>页面暂时不可用</h1>
      <p>{{ errorMessage }}</p>
      <button class="button button--primary" type="button" @click="retry">重试</button>
    </div>
  </div>
  <RouterView v-else>
    <template #default="{ Component, route }">
      <AppShell v-if="route.meta.shell">
        <component :is="Component" />
      </AppShell>
      <component :is="Component" v-else />
    </template>
  </RouterView>
</template>
