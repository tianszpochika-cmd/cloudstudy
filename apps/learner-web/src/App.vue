<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import AppShell from './layouts/AppShell.vue'
import StatusLayout from './layouts/StatusLayout.vue'
import { useSessionStore } from './stores/session'

const errorMessage = ref<string | null>(null)
const booting = ref(true)
const router = useRouter()
const session = useSessionStore()

void router.isReady().finally(() => {
  booting.value = false
})

onErrorCaptured((error) => {
  errorMessage.value = error instanceof Error ? error.message : '页面出现了暂时无法恢复的错误。'
  return false
})

function retry(): void {
  errorMessage.value = null
}
</script>

<template>
  <main v-if="booting" class="app-startup" role="status" aria-live="polite">
    <span class="app-startup__mark" aria-hidden="true">✦</span>
    <h1>语学星</h1>
    <p>正在恢复安全会话并准备学习空间…</p>
  </main>
  <div v-else-if="errorMessage" class="fatal-error" role="alert">
    <div class="fatal-error__card">
      <span class="fatal-error__icon" aria-hidden="true">!</span>
      <h1>页面暂时不可用</h1>
      <p>{{ errorMessage }}</p>
      <button class="button button--primary" type="button" @click="retry">重试</button>
    </div>
  </div>
  <RouterView v-else>
    <template #default="{ Component, route }">
      <AppShell v-if="route.meta.shell || (route.meta.statusPage && session.isAuthenticated)">
        <component :is="Component" />
      </AppShell>
      <StatusLayout v-else-if="route.meta.statusPage">
        <component :is="Component" />
      </StatusLayout>
      <component :is="Component" v-else />
    </template>
  </RouterView>
</template>
