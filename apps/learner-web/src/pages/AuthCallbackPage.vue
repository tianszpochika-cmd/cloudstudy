<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const failed = ref(false)
const cancelled = computed(() => session.authErrorCode === 'OIDC_CANCELLED')

onMounted(async () => {
  const ok = await session.completeLogin({
    code: typeof route.query.code === 'string' ? route.query.code : undefined,
    state: typeof route.query.state === 'string' ? route.query.state : undefined,
    error: typeof route.query.error === 'string' ? route.query.error : undefined,
    errorDescription: typeof route.query.error_description === 'string' ? route.query.error_description : undefined,
    returnTo: typeof route.query.returnTo === 'string' ? route.query.returnTo : typeof route.query.redirect === 'string' ? route.query.redirect : undefined,
  })
  if (!ok) { failed.value = true; return }
  // Keep the callback as a short, branded handoff. The first-run checks live
  // inside onboarding so the learner does not see a second auth page.
  if (session.adultGate === 'REQUIRED') { await router.replace({ name: 'onboarding' }); return }
  await router.replace(session.consumeReturnTo())
})
</script>

<template>
  <main class="public-page public-page--handoff">
    <section class="login-card login-card--handoff" aria-labelledby="callback-title" :aria-busy="!failed">
      <div class="handoff-mark" aria-hidden="true">✦</div>
      <h1 id="callback-title">{{ failed ? authT('callback.failed') : authT('callback.title') }}</h1>
      <p v-if="!failed" class="lead">{{ authT('callback.restoring') }}</p>
      <p v-else class="error-text" role="alert">{{ cancelled ? authT('login.cancelled') : authT('callback.failed') }}</p>
      <RouterLink v-if="failed" class="button button--secondary" to="/login">{{ authT('forbidden.login') }}</RouterLink>
    </section>
  </main>
</template>
