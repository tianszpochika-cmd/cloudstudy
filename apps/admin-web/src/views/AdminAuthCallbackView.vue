<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeAdminReturnTo } from '../auth/gateway-auth'
import { useAdminStore } from '../stores/admin'

const route = useRoute()
const router = useRouter()
const session = useAdminStore()
const state = ref<'restoring' | 'failed'>('restoring')
const returnTo = safeAdminReturnTo(typeof route.query.returnTo === 'string' ? route.query.returnTo : typeof route.query.redirect === 'string' ? route.query.redirect : undefined)
onMounted(async () => {
  const ok = await session.completeLogin({ code: typeof route.query.code === 'string' ? route.query.code : undefined, state: typeof route.query.state === 'string' ? route.query.state : undefined, error: typeof route.query.error === 'string' ? route.query.error : undefined, errorDescription: typeof route.query.error_description === 'string' ? route.query.error_description : undefined, returnTo: typeof route.query.returnTo === 'string' ? route.query.returnTo : typeof route.query.redirect === 'string' ? route.query.redirect : undefined })
  if (!ok) { state.value = 'failed'; return }
  await router.replace(session.consumeReturnTo())
})
</script>

<template><main class="login-page"><div class="login-card"><h1>{{ authT('callback.title') }}</h1><p v-if="state === 'restoring'">{{ authT('callback.restoring') }}</p><p v-else role="alert">{{ session.lastError ?? authT('callback.failed') }}</p><RouterLink v-if="state === 'failed'" :to="{ name: 'admin-login', query: { redirect: returnTo } }">{{ authT('forbidden.login') }}</RouterLink></div></main></template>
