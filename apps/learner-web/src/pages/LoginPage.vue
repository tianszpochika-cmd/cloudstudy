<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const session = useSessionStore()
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))
const loginUrl = ref('')
const loginError = ref<string | null>(null)
const preparing = ref(false)
const callbackError = computed(() => {
  if (typeof route.query.error === 'string') {
    return route.query.error === 'access_denied' ? authT('login.cancelled') : authT('login.failed')
  }
  return session.authErrorCode === 'SESSION_EXPIRED' ? authT('session.expired') : null
})
const statusTitle = computed(() => {
  if (loginError.value) return authT('login.unavailable')
  if (loginUrl.value) return authT('login.ready')
  return authT('login.pending')
})
const statusDescription = computed(() => {
  if (loginError.value) return authT('login.retryHint')
  if (loginUrl.value) return authT('login.readyDescription')
  return authT('login.preparingDescription')
})

async function prepareLogin(): Promise<void> {
  if (preparing.value) return
  preparing.value = true
  loginError.value = null
  loginUrl.value = ''
  session.setReturnTo(redirectTarget.value)
  try {
    loginUrl.value = await session.prepareLogin(redirectTarget.value)
  } catch (error) {
    loginError.value = error instanceof Error && /cancel|denied/i.test(error.message)
      ? authT('login.cancelled')
      : authT('error.network')
  } finally {
    preparing.value = false
  }
}

onMounted(() => { void prepareLogin() })
</script>

<template>
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="login-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="login-title">{{ authT('login.title') }}</h1>
      <p class="lead">{{ authT('login.description') }}</p>
      <div class="login-status" :class="{ 'login-status--error': loginError }" :role="loginError ? 'alert' : 'status'" aria-live="polite" :aria-busy="preparing">
        <span class="login-status__mark" aria-hidden="true">{{ loginError ? '!' : '✦' }}</span>
        <div>
          <strong>{{ statusTitle }}</strong>
          <p>{{ statusDescription }}</p>
        </div>
      </div>
      <p v-if="callbackError" class="error-text" role="alert">{{ callbackError }}</p>
      <div class="login-card__actions">
        <a v-if="loginUrl" class="button button--primary" :href="loginUrl">{{ authT('login.start') }}</a>
        <button v-else class="button button--primary" type="button" :disabled="preparing" @click="prepareLogin">
          {{ preparing ? authT('login.preparing') : authT('login.retry') }}
        </button>
      </div>
      <p class="micro-copy">{{ authT('login.afterLogin') }}</p>
    </section>
  </main>
</template>
